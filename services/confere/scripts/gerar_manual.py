"""Gera o `Manual de Utilização do Confere` sobre o modelo institucional.

O documento nasce de uma **cópia** de `Papel de Carta e Capa de Apostila.docx`,
pelo mesmo motivo do relatório de comprovação (ESPEC 003 `R-DOC-01`): é o que
preserva as sete fontes embutidas — `Parabolica Test` no corpo, `Exo 2` nos
títulos —, as três imagens, o papel timbrado e o rodapé institucional. Montar do
zero perderia tudo isso, e nenhuma dessas fontes pode ser reconstruída.

A capa é a do modelo, com os três blocos de texto reescritos: o modelo grava o
contrato e a proposta do piloto, e um manual não é peça daquele processo.

Executar, do diretório `backend/`:

    uv run python ../scripts/gerar_manual.py

Saída: `docs/manual_utilizacao/Manual_de_Utilizacao_Confere.docx`.
"""

from __future__ import annotations

import re
import shutil
from collections.abc import Iterable, Sequence
from pathlib import Path
from typing import Any

import docx
from docx.document import Document
from docx.enum.section import WD_SECTION
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Pt, RGBColor
from docx.table import Table, _Cell

RAIZ = Path(__file__).resolve().parent.parent
MODELO = RAIZ / "docs" / "documentos" / "Papel de Carta e Capa de Apostila.docx"
DESTINO = RAIZ / "docs" / "manual_utilizacao" / "Manual_de_Utilizacao_Confere.docx"

# ── Paleta ────────────────────────────────────────────────────────────────────
# As institucionais saem do rodapé do modelo (ESPEC 006 §3); as de severidade,
# do eixo da ESPEC 009 — as mesmas quatro cores que a tela usa nas situações.
NAVY = "0E3E5E"
LARANJA = "FF671D"
TINTA = "0B2235"
CINZA = "4E747E"
FAIXA = "E7EEF2"
ZEBRA = "F4F7F8"
LINHA = "C9D8E0"
BRANCO = "FFFFFF"

CRITICO = "B91C1C"
MAIOR = "B45309"
DIVERGENTE = "17416B"
CONFORME = "006E52"

# Largura útil da seção retrato do modelo: A4 (11906 twips) menos as margens
# laterais de 1077 twips. Em pontos, porque é a unidade de `w:tcW`.
LARGURA_UTIL = (11906 - 2 * 1077) / 20.0

CORPO = 10.5
CORPO_TABELA = 9.0
MONO = "Consolas"


# ── OOXML: o que o modelo não traz pronto ─────────────────────────────────────
#
# O modelo institucional tem apenas `Normal Table` — `Table Grid` não existe, e
# referenciá-lo levanta erro. Bordas e sombreamento saem elemento a elemento,
# como em `infrastructure/report/ooxml.py`.


def _elemento(tag: str) -> Any:
    return OxmlElement(tag)


def _rgb(cor: str) -> RGBColor:
    return RGBColor.from_string(cor)


def _sombrear(celula: _Cell, cor: str) -> None:
    shd = _elemento("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), cor)
    celula._tc.get_or_add_tcPr().append(shd)


def _bordas(tabela: Table, cor: str = LINHA, espessura: int = 4) -> None:
    bordas = _elemento("w:tblBorders")
    for lado in ("top", "left", "bottom", "right", "insideH", "insideV"):
        elemento = _elemento(f"w:{lado}")
        elemento.set(qn("w:val"), "single")
        elemento.set(qn("w:sz"), str(espessura))
        elemento.set(qn("w:space"), "0")
        elemento.set(qn("w:color"), cor)
        bordas.append(elemento)
    tabela._tbl.tblPr.append(bordas)


def _sem_bordas(tabela: Table) -> None:
    bordas = _elemento("w:tblBorders")
    for lado in ("top", "left", "bottom", "right", "insideH", "insideV"):
        elemento = _elemento(f"w:{lado}")
        elemento.set(qn("w:val"), "none")
        elemento.set(qn("w:sz"), "0")
        bordas.append(elemento)
    tabela._tbl.tblPr.append(bordas)


def _borda_lateral(celula: _Cell, cor: str, espessura: int = 24) -> None:
    """Tarja de acento à esquerda da célula — usada nas notas."""
    propriedades = celula._tc.get_or_add_tcPr()
    bordas = _elemento("w:tcBorders")
    elemento = _elemento("w:left")
    elemento.set(qn("w:val"), "single")
    elemento.set(qn("w:sz"), str(espessura))
    elemento.set(qn("w:space"), "0")
    elemento.set(qn("w:color"), cor)
    bordas.append(elemento)
    propriedades.append(bordas)


def _margens(tabela: Table, lateral: int = 108, vertical: int = 60) -> None:
    margens = _elemento("w:tblCellMar")
    for lado, valor in (
        ("top", vertical),
        ("left", lateral),
        ("bottom", vertical),
        ("right", lateral),
    ):
        elemento = _elemento(f"w:{lado}")
        elemento.set(qn("w:w"), str(valor))
        elemento.set(qn("w:type"), "dxa")
        margens.append(elemento)
    tabela._tbl.tblPr.append(margens)


def _fixar_larguras(tabela: Table, fracoes: Sequence[float]) -> None:
    """Larguras exatas. Sem isto o Word redistribui as colunas pelo conteúdo."""
    tabela.autofit = False
    larguras = [LARGURA_UTIL * fracao for fracao in fracoes]

    grade = tabela._tbl.find(qn("w:tblGrid"))
    if grade is not None:
        for coluna, largura in zip(grade.findall(qn("w:gridCol")), larguras, strict=False):
            coluna.set(qn("w:w"), str(int(round(largura * 20))))

    colunas = len(fracoes)
    for indice, celula in enumerate(tabela._cells):
        celula.width = Pt(larguras[indice % colunas])


def _repetir_cabecalho(fileira: Any) -> None:
    """A primeira fileira reaparece no topo de cada página que a tabela invade."""
    trPr = fileira._tr.get_or_add_trPr()
    trPr.append(_elemento("w:tblHeader"))


def _nao_dividir(tabela: Table) -> None:
    """Nenhuma fileira parte ao meio na virada de página.

    Vale sobretudo para as notas, que são uma fileira só: sem isto o título da
    nota fica no pé de uma página e o corpo no topo da seguinte, separados pela
    tarja — e o destaque some justamente onde ele mais importa.
    """
    for fileira in tabela.rows:
        trPr = fileira._tr.get_or_add_trPr()
        trPr.append(_elemento("w:cantSplit"))


# Ordem que o esquema OOXML exige dos filhos de `w:tblPr` (CT_TblPrBase).
# Bordas e margens são acrescentadas por `append`, que as deixa depois de
# `tblW` e `tblLook`; fora de ordem, o Word pode descartá-las em silêncio — a
# tabela abre, sem grade e sem que nada acuse o motivo.
ORDEM_DO_TBLPR = (
    "tblStyle",
    "tblpPr",
    "tblOverlap",
    "bidiVisual",
    "tblStyleRowBandSize",
    "tblStyleColBandSize",
    "tblW",
    "jc",
    "tblCellSpacing",
    "tblInd",
    "tblBorders",
    "shd",
    "tblLayout",
    "tblCellMar",
    "tblLook",
    "tblCaption",
    "tblDescription",
)


def _ordenar_tblPr(tabela: Table) -> None:  # noqa: N802 - o nome é o do elemento
    """Reordena `w:tblPr` conforme o esquema, preservando o conteúdo."""
    tblPr = tabela._tbl.tblPr
    posicao = {qn(f"w:{nome}"): indice for indice, nome in enumerate(ORDEM_DO_TBLPR)}
    filhos = sorted(tblPr, key=lambda filho: posicao.get(filho.tag, len(posicao)))
    for filho in filhos:
        tblPr.append(filho)


def _manter_junto(paragrafo: Any) -> None:
    paragrafo.paragraph_format.keep_with_next = True


# ── Escrita com formatação em linha ───────────────────────────────────────────
#
# `**negrito**`, `*itálico*` e `` `monoespaçado` ``. Três marcações e nada mais:
# o manual distingue rótulo de tela (negrito), citação literal do que a
# aplicação escreve (itálico) e nome de arquivo, código de serviço ou
# identificador de validação (mono).
#
# A alternativa de negrito vem **antes** da de itálico na alternância. Invertida,
# `*` casaria a primeira estrela de `**texto**` e o negrito nunca seria
# reconhecido — o sintoma seria asterisco impresso no meio da frase.

MARCACAO = re.compile(r"(\*\*.+?\*\*|\*[^*\n]+?\*|`[^`]+`)")


def _escrever(
    paragrafo: Any,
    texto: str,
    *,
    corpo: float = CORPO,
    cor: str = TINTA,
    negrito: bool = False,
    italico: bool = False,
) -> None:
    for pedaco in MARCACAO.split(texto):
        if not pedaco:
            continue
        if pedaco.startswith("**") and pedaco.endswith("**"):
            execucao = paragrafo.add_run(pedaco[2:-2])
            execucao.bold = True
        elif pedaco.startswith("*") and pedaco.endswith("*"):
            execucao = paragrafo.add_run(pedaco[1:-1])
            execucao.bold = negrito
            execucao.italic = True
            execucao.font.size = Pt(corpo)
            execucao.font.color.rgb = _rgb(cor)
            continue
        elif pedaco.startswith("`") and pedaco.endswith("`"):
            execucao = paragrafo.add_run(pedaco[1:-1])
            execucao.font.name = MONO
            execucao.font.size = Pt(corpo - 1)
            execucao.font.color.rgb = _rgb(cor)
            execucao.bold = negrito
            execucao.italic = italico
            _fixar_fonte(execucao, MONO)
            continue
        else:
            execucao = paragrafo.add_run(pedaco)
            execucao.bold = negrito
        execucao.italic = italico
        execucao.font.size = Pt(corpo)
        execucao.font.color.rgb = _rgb(cor)


def _fixar_fonte(execucao: Any, nome: str) -> None:
    """`font.name` sozinho não cobre os conjuntos complexos; o Word lê `cs`."""
    rPr = execucao._element.get_or_add_rPr()
    fontes = rPr.find(qn("w:rFonts"))
    if fontes is None:
        fontes = _elemento("w:rFonts")
        rPr.append(fontes)
    for atributo in ("w:ascii", "w:hAnsi", "w:cs"):
        fontes.set(qn(atributo), nome)


def _celula(
    celula: _Cell,
    texto: str,
    *,
    corpo: float = CORPO_TABELA,
    cor: str = TINTA,
    negrito: bool = False,
    alinhamento: str = "left",
    espaco_depois: float = 0.0,
) -> None:
    paragrafo = celula.paragraphs[0]
    formato = paragrafo.paragraph_format
    formato.space_before = Pt(0)
    formato.space_after = Pt(espaco_depois)
    formato.line_spacing = 1.0
    if alinhamento != "left":
        paragrafo.alignment = {
            "center": WD_ALIGN_PARAGRAPH.CENTER,
            "right": WD_ALIGN_PARAGRAPH.RIGHT,
        }[alinhamento]
    _escrever(paragrafo, texto, corpo=corpo, cor=cor, negrito=negrito)


# ── Blocos do documento ───────────────────────────────────────────────────────


class Manual:
    def __init__(self, documento: Document) -> None:
        self.documento = documento

    # Títulos usam os estilos do modelo — `Exo 2`, com os corpos e os espaços
    # que o próprio modelo define. Reescrevê-los aqui trocaria o padrão de
    # layout que o documento existe para seguir.

    def h1(self, texto: str) -> None:
        paragrafo = self.documento.add_paragraph(style="Heading 1")
        for execucao in paragrafo.runs:
            execucao._element.getparent().remove(execucao._element)
        execucao = paragrafo.add_run(texto)
        execucao.font.color.rgb = _rgb(NAVY)
        paragrafo.paragraph_format.space_before = Pt(20)
        paragrafo.paragraph_format.space_after = Pt(6)
        paragrafo.paragraph_format.keep_with_next = True
        self._faixa_inferior(paragrafo)

    def h2(self, texto: str) -> None:
        paragrafo = self.documento.add_paragraph(style="Heading 2")
        execucao = paragrafo.add_run(texto)
        execucao.font.color.rgb = _rgb(TINTA)
        execucao.font.size = Pt(13)
        paragrafo.paragraph_format.space_before = Pt(14)
        paragrafo.paragraph_format.space_after = Pt(4)
        paragrafo.paragraph_format.keep_with_next = True

    def h3(self, texto: str) -> None:
        paragrafo = self.documento.add_paragraph(style="Heading 3")
        execucao = paragrafo.add_run(texto)
        execucao.font.color.rgb = _rgb(NAVY)
        execucao.font.size = Pt(11)
        paragrafo.paragraph_format.space_before = Pt(10)
        paragrafo.paragraph_format.space_after = Pt(3)
        paragrafo.paragraph_format.keep_with_next = True

    @staticmethod
    def _faixa_inferior(paragrafo: Any) -> None:
        """Filete laranja sob o título de capítulo — o acento da marca PRODAM."""
        pPr = paragrafo._p.get_or_add_pPr()
        bordas = _elemento("w:pBdr")
        inferior = _elemento("w:bottom")
        inferior.set(qn("w:val"), "single")
        inferior.set(qn("w:sz"), "8")
        inferior.set(qn("w:space"), "3")
        inferior.set(qn("w:color"), LARANJA)
        bordas.append(inferior)
        pPr.append(bordas)

    def p(self, texto: str, *, corpo: float = CORPO, cor: str = TINTA) -> None:
        paragrafo = self.documento.add_paragraph()
        paragrafo.paragraph_format.space_after = Pt(7)
        paragrafo.paragraph_format.space_before = Pt(0)
        _escrever(paragrafo, texto, corpo=corpo, cor=cor)

    def lista(self, itens: Iterable[str], *, numerada: bool = False) -> None:
        """Marcadores escritos à mão.

        O pacote do modelo **não tem `numbering.xml`**: um estilo de lista
        referenciaria uma definição de numeração que não existe, e o Word
        renderizaria a lista sem marcador nenhum.
        """
        for indice, item in enumerate(itens, start=1):
            paragrafo = self.documento.add_paragraph()
            formato = paragrafo.paragraph_format
            formato.left_indent = Pt(18)
            formato.first_line_indent = Pt(-18)
            formato.space_after = Pt(3)
            formato.space_before = Pt(0)
            marca = f"{indice}." if numerada else "•"
            execucao = paragrafo.add_run(f"{marca}\t")
            execucao.font.size = Pt(CORPO)
            execucao.font.color.rgb = _rgb(NAVY if numerada else LARANJA)
            execucao.bold = numerada
            _escrever(paragrafo, item)

    def tabela(
        self,
        cabecalho: Sequence[str],
        linhas: Sequence[Sequence[str]],
        fracoes: Sequence[float],
        *,
        alinhamentos: Sequence[str] | None = None,
        cor_do_cabecalho: str = NAVY,
    ) -> None:
        alinhamentos = alinhamentos or ["left"] * len(cabecalho)
        tabela = self.documento.add_table(rows=len(linhas) + 1, cols=len(cabecalho))
        _bordas(tabela)
        _margens(tabela)
        _fixar_larguras(tabela, fracoes)

        for celula, titulo, alinhamento in zip(
            tabela.rows[0].cells, cabecalho, alinhamentos, strict=True
        ):
            _sombrear(celula, cor_do_cabecalho)
            _celula(
                celula,
                titulo,
                cor=BRANCO,
                negrito=True,
                alinhamento=alinhamento,
                corpo=CORPO_TABELA,
            )
        _repetir_cabecalho(tabela.rows[0])

        for indice, valores in enumerate(linhas):
            fileira = tabela.rows[indice + 1]
            for celula, valor, alinhamento in zip(
                fileira.cells, valores, alinhamentos, strict=True
            ):
                if indice % 2 == 1:
                    _sombrear(celula, ZEBRA)
                _celula(celula, valor, alinhamento=alinhamento)

        _nao_dividir(tabela)
        _ordenar_tblPr(tabela)
        self._respiro()

    def nota(self, titulo: str, texto: str, *, cor: str = LARANJA, fundo: str = FAIXA) -> None:
        """Aviso destacado: tarja de acento à esquerda, fundo claro."""
        tabela = self.documento.add_table(rows=1, cols=1)
        _sem_bordas(tabela)
        _margens(tabela, lateral=170, vertical=110)
        _fixar_larguras(tabela, [1.0])

        celula = tabela.rows[0].cells[0]
        _sombrear(celula, fundo)
        _borda_lateral(celula, cor)

        paragrafo = celula.paragraphs[0]
        paragrafo.paragraph_format.space_after = Pt(2)
        paragrafo.paragraph_format.space_before = Pt(0)
        _escrever(paragrafo, titulo, corpo=CORPO, cor=cor, negrito=True)

        corpo_da_nota = celula.add_paragraph()
        corpo_da_nota.paragraph_format.space_after = Pt(0)
        corpo_da_nota.paragraph_format.space_before = Pt(0)
        _escrever(corpo_da_nota, texto, corpo=CORPO - 0.5, cor=TINTA)

        _nao_dividir(tabela)
        _ordenar_tblPr(tabela)
        self._respiro()

    def passo(self, numero: int, titulo: str) -> None:
        """Cabeçalho de passo: o numeral em disco, o título ao lado."""
        paragrafo = self.documento.add_paragraph()
        formato = paragrafo.paragraph_format
        formato.space_before = Pt(12)
        formato.space_after = Pt(4)
        formato.keep_with_next = True

        numeral = paragrafo.add_run(f"  {numero}  ")
        numeral.bold = True
        numeral.font.size = Pt(CORPO)
        numeral.font.color.rgb = _rgb(BRANCO)
        self._realce(numeral, NAVY)

        espaco = paragrafo.add_run("  ")
        espaco.font.size = Pt(CORPO)

        nome = paragrafo.add_run(titulo)
        nome.bold = True
        nome.font.size = Pt(CORPO + 1.5)
        nome.font.color.rgb = _rgb(NAVY)

    @staticmethod
    def _realce(execucao: Any, cor: str) -> None:
        rPr = execucao._element.get_or_add_rPr()
        shd = _elemento("w:shd")
        shd.set(qn("w:val"), "clear")
        shd.set(qn("w:color"), "auto")
        shd.set(qn("w:fill"), cor)
        rPr.append(shd)

    def _respiro(self) -> None:
        paragrafo = self.documento.add_paragraph()
        paragrafo.paragraph_format.space_after = Pt(0)
        paragrafo.paragraph_format.space_before = Pt(0)
        paragrafo.add_run("").font.size = Pt(5)

    def quebra_de_pagina(self) -> None:
        paragrafo = self.documento.add_paragraph()
        paragrafo.paragraph_format.space_after = Pt(0)
        quebra = _elemento("w:br")
        quebra.set(qn("w:type"), "page")
        execucao = paragrafo.add_run()
        execucao._element.append(quebra)


# ── A capa ────────────────────────────────────────────────────────────────────

CAPA = (
    # (índice do bloco de texto, parágrafos como (texto, corpo em pontos))
    (0, (("MANUAL DE UTILIZAÇÃO", 26), ("CONFERE", 46), ("ANÁLISE DE MEDIÇÃO CONTRATUAL", 18))),
    (
        1,
        (
            ("Conferência da medição mensal de contratos de TIC", 15),
            ("", 15),
            ("Documento de apoio à operação", 15),
            ("Versão 1.0", 15),
        ),
    ),
    (2, (("DIRETORIA DE INFRAESTRUTURA E TECNOLOGIA", 19), ("GIO - GERÊNCIA DE OPERAÇÕES", 19))),
)


def _reescrever_capa(documento: Document) -> None:
    """Reescreve os três blocos de texto da capa do modelo.

    Cada bloco existe **duas vezes** no XML — `mc:Choice` para quem entende
    `wps` e `mc:Fallback` em VML para quem não entende —, e as duas cópias
    precisam dizer a mesma coisa. Daí percorrer os seis na ordem do documento e
    tratá-los aos pares.

    O modelo grava `TC 52/SMIT/2024` e `PA-SMIT-260319-739` na capa. Um manual
    não é peça daquele processo administrativo, e deixá-los ali datava o
    documento num contrato que ele não descreve.
    """
    caixas = documento.element.body.findall(".//" + qn("w:txbxContent"))
    if len(caixas) != 6:
        raise RuntimeError(f"a capa do modelo mudou: {len(caixas)} blocos de texto, esperava 6")

    for indice_do_bloco, paragrafos in CAPA:
        for caixa in (caixas[indice_do_bloco * 2], caixas[indice_do_bloco * 2 + 1]):
            _reescrever_bloco(caixa, paragrafos)


def _reescrever_bloco(caixa: Any, paragrafos: Sequence[tuple[str, int]]) -> None:
    existentes = caixa.findall(qn("w:p"))

    for indice, elemento in enumerate(existentes):
        if indice >= len(paragrafos):
            caixa.remove(elemento)
            continue
        texto, corpo = paragrafos[indice]
        _reescrever_paragrafo(elemento, texto, corpo)


def _reescrever_paragrafo(elemento: Any, texto: str, corpo: int) -> None:
    """Mantém a primeira execução — com a fonte, a cor e o alinhamento do
    modelo — e descarta as demais, que existiam para o texto antigo."""
    execucoes = elemento.findall(qn("w:r"))
    for extra in execucoes[1:]:
        elemento.remove(extra)

    # O corpo é ajustado **também na marca de parágrafo** (`w:pPr/w:rPr`), e não
    # só na execução. A marca não imprime caractere nenhum, mas entra no cálculo
    # da altura da linha: deixá-la em 38 pt numa linha de 26 pt abriria um vão
    # que só apareceria no papel.
    _redimensionar(elemento.find(qn("w:pPr")), corpo)

    if not execucoes:
        return

    primeira = execucoes[0]
    for filho in list(primeira):
        if filho.tag in (qn("w:t"), qn("w:br")):
            primeira.remove(filho)

    _redimensionar(primeira, corpo)

    alvo = _elemento("w:t")
    alvo.set(qn("xml:space"), "preserve")
    alvo.text = texto
    primeira.append(alvo)


def _redimensionar(portador: Any, corpo: int) -> None:
    """Ajusta `w:sz` e `w:szCs` do `w:rPr` que o portador contiver."""
    if portador is None:
        return
    rPr = portador.find(qn("w:rPr"))
    if rPr is None:
        return
    for tag in ("w:sz", "w:szCs"):
        for tamanho in rPr.findall(qn(tag)):
            tamanho.set(qn("w:val"), str(corpo * 2))


# ── Estrutura do documento ────────────────────────────────────────────────────


def _encerrar_a_capa(documento: Document) -> None:
    """Remove a quebra de página e os parágrafos que a seguem.

    O modelo tem duas páginas: a capa e uma folha timbrada em branco, para quem
    for escrever nela à mão. Mantê-las produziria uma página vazia entre a capa
    e o texto.
    """
    corpo = documento.element.body
    paragrafos = corpo.findall(qn("w:p"))

    quebra = f".//{qn('w:br')}[@{qn('w:type')}='page']"
    inicio = next((i for i, p in enumerate(paragrafos) if p.findall(quebra)), None)
    if inicio is None:
        raise RuntimeError("quebra de página da capa não localizada no modelo")

    for paragrafo in paragrafos[inicio:]:
        corpo.remove(paragrafo)


def _abrir_o_corpo(documento: Document) -> None:
    """Nova seção, em retrato, com a página e as margens do modelo.

    Cabeçalho e rodapé ficam vinculados à seção anterior — o padrão do
    python-docx —, então o papel timbrado aparece em todas as páginas sem
    duplicar recurso no pacote.
    """
    capa = documento.sections[0]
    corpo = documento.add_section(WD_SECTION.NEW_PAGE)
    corpo.page_width, corpo.page_height = capa.page_width, capa.page_height
    corpo.left_margin, corpo.right_margin = capa.left_margin, capa.right_margin
    corpo.top_margin, corpo.bottom_margin = capa.top_margin, capa.bottom_margin


def gerar(destino: Path = DESTINO) -> Path:
    destino.parent.mkdir(parents=True, exist_ok=True)

    # Copiar antes de abrir deixa explícito que o modelo é entrada, nunca saída.
    shutil.copy2(MODELO, destino)
    documento = docx.Document(str(destino))

    _reescrever_capa(documento)
    _encerrar_a_capa(documento)
    _abrir_o_corpo(documento)

    escrever_o_manual(Manual(documento))

    documento.save(str(destino))
    return destino


def escrever_o_manual(m: Manual) -> None:
    from conteudo_do_manual import CONTEUDO  # noqa: PLC0415

    CONTEUDO(m)


if __name__ == "__main__":
    import sys

    sys.path.insert(0, str(Path(__file__).resolve().parent))
    caminho = gerar()
    print(f"manual gerado em {caminho}")