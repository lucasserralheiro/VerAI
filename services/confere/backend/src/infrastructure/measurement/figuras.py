"""As figuras coladas nas abas, lidas direto do pacote da planilha.

Um XLSX é um ZIP, e uma figura não está em célula nenhuma: fica em
``xl/media/`` como arquivo próprio, ligada à aba por uma cadeia de relações que
também guarda **sobre qual linha ela flutua** e **com que tamanho é exibida**.

Foi assim que o gráfico de custos de `ServicosEmNuvem` sumiu do documento: um
leitor de células não tem como vê-lo.

**Por que não usar o openpyxl aqui.** Ele expõe as figuras em ``ws._images``,
mas obter os bytes passa por Pillow — que não é dependência deste projeto e não
está no ambiente. Pedir uma biblioteca de imagem para copiar bytes de dentro de
um ZIP seria caro pelo motivo errado.

A cadeia percorrida:

    xl/workbook.xml            nome da aba  ->  r:id
    xl/_rels/workbook.xml.rels r:id         ->  worksheets/sheetN.xml
    .../_rels/sheetN.xml.rels  r:id         ->  drawings/drawingN.xml
    xl/drawings/drawingN.xml   âncora, tamanho e r:embed da figura
    .../_rels/drawingN.xml.rels r:embed     ->  media/imageN.png
"""

from __future__ import annotations

import posixpath
import zipfile
from pathlib import Path
from xml.etree.ElementTree import Element  # noqa: S405 — só o tipo, não o parser

# A leitura é de XML que veio no arquivo enviado pelo usuário. O parser da
# biblioteca padrão expande entidades, e uma planilha preparada pode trazer
# expansão recursiva que consome a memória do processo. O `defusedxml` é o mesmo
# ElementTree com essa porta fechada.
from defusedxml.ElementTree import fromstring

from domain.entities.annex import ImagemAnexo

NS = {
    "pkg": "http://schemas.openxmlformats.org/package/2006/relationships",
    "main": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    "xdr": "http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing",
    "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
}

# English Metric Unit: 914.400 por polegada, 12.700 por ponto tipográfico.
EMU_POR_PONTO = 12700.0

# Um pixel a 96 dpi vale 0,75 pt. É o tamanho natural da figura, usado só quando
# nada melhor existe: o GRC traz a medida impressa, e ela sempre prevalece.
PONTOS_POR_PIXEL = 0.75

ASSINATURA_PNG = bytes.fromhex("89504E470D0A1A0A")


def _relacoes(pacote: zipfile.ZipFile, parte: str) -> dict[str, str]:
    """Mapa `r:id` -> caminho absoluto dentro do pacote, para uma parte."""
    rels = posixpath.join(posixpath.dirname(parte), "_rels", posixpath.basename(parte) + ".rels")
    if rels not in pacote.namelist():
        return {}

    base = posixpath.dirname(parte)
    arvore = fromstring(pacote.read(rels))
    return {
        relacao.get("Id", ""): _resolver(base, relacao.get("Target", ""))
        for relacao in arvore.findall("pkg:Relationship", NS)
    }


def _resolver(base: str, alvo: str) -> str:
    """Caminho da parte como o ZIP o nomeia.

    Um `Target` pode ser relativo (``../drawings/drawing1.xml``) ou absoluto na
    raiz do pacote (``/xl/worksheets/sheet1.xml``) — esta planilha usa as duas
    formas. Nomes de entrada de ZIP **não têm barra inicial**, e mantê-la faz
    toda busca falhar em silêncio.
    """
    caminho = alvo if alvo.startswith("/") else posixpath.join(base, alvo)
    return posixpath.normpath(caminho).lstrip("/")


def _abas(pacote: zipfile.ZipFile) -> dict[str, str]:
    """Nome da aba -> caminho da sua parte XML."""
    workbook = "xl/workbook.xml"
    if workbook not in pacote.namelist():
        return {}

    relacoes = _relacoes(pacote, workbook)
    arvore = fromstring(pacote.read(workbook))
    abas = {}
    for aba in arvore.findall("main:sheets/main:sheet", NS):
        alvo = relacoes.get(aba.get(f"{{{NS['r']}}}id", ""))
        if alvo:
            abas[aba.get("name", "")] = alvo
    return abas


def _figuras_do_desenho(pacote: zipfile.ZipFile, desenho: str) -> list[ImagemAnexo]:
    relacoes = _relacoes(pacote, desenho)
    arvore = fromstring(pacote.read(desenho))
    figuras = []

    # `twoCellAnchor` e `oneCellAnchor` diferem em como o Excel redimensiona a
    # figura ao mexer nas células; para nós ambas dizem a mesma coisa — de qual
    # linha ela parte.
    for ancora in list(arvore.findall("xdr:twoCellAnchor", NS)) + list(
        arvore.findall("xdr:oneCellAnchor", NS)
    ):
        blip = ancora.find(".//a:blip", NS)
        linha = ancora.find("xdr:from/xdr:row", NS)
        if blip is None or linha is None or not (linha.text or "").isdigit():
            continue

        alvo = relacoes.get(blip.get(f"{{{NS['r']}}}embed", ""))
        if not alvo or alvo not in pacote.namelist():
            continue

        dados = pacote.read(alvo)
        largura, altura = _tamanho(ancora, dados)
        figuras.append(
            ImagemAnexo(
                dados=dados,
                linha=int(linha.text or 0),
                largura_pt=largura,
                altura_pt=altura,
            )
        )
    return figuras


def _tamanho(ancora: Element, dados: bytes) -> tuple[float, float]:
    """Tamanho de exibição da figura, em pontos.

    Só a âncora de uma célula (`oneCellAnchor`) declara a extensão. A de duas
    células — que é a destas duas figuras — dá os cantos, e reconstruir o
    tamanho a partir deles exigiria somar largura de coluna e altura de linha em
    EMU, célula a célula. Não vale: o GRC traz a medida impressa, que é a que
    prevalece, e o tamanho natural do PNG basta como reserva.
    """
    extensao = ancora.find("xdr:ext", NS)
    if extensao is not None:
        return (
            float(extensao.get("cx", 0)) / EMU_POR_PONTO,
            float(extensao.get("cy", 0)) / EMU_POR_PONTO,
        )

    if dados[:8] == ASSINATURA_PNG and len(dados) >= 24:
        # A largura e a altura são os dois primeiros campos do bloco IHDR, que
        # num PNG é sempre o primeiro bloco. Ler 8 bytes evita uma dependência
        # de biblioteca de imagem só para descobrir o tamanho.
        largura = int.from_bytes(dados[16:20], "big")
        altura = int.from_bytes(dados[20:24], "big")
        return largura * PONTOS_POR_PIXEL, altura * PONTOS_POR_PIXEL

    return 0.0, 0.0


def figuras_por_aba(caminho: Path) -> dict[str, tuple[ImagemAnexo, ...]]:
    """Todas as figuras da planilha, agrupadas pela aba em que estão coladas."""
    achadas: dict[str, tuple[ImagemAnexo, ...]] = {}
    with zipfile.ZipFile(caminho) as pacote:
        for nome, parte in _abas(pacote).items():
            desenhos = [
                alvo for alvo in _relacoes(pacote, parte).values() if "/drawings/" in alvo
            ]
            figuras = [
                figura
                for desenho in desenhos
                if desenho in pacote.namelist()
                for figura in _figuras_do_desenho(pacote, desenho)
            ]
            if figuras:
                achadas[nome] = tuple(sorted(figuras, key=lambda f: f.linha))
    return achadas
