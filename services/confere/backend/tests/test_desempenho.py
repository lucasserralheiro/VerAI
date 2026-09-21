"""T-2010 a T-2012 e T-2023/T-2024 — ESPEC 026.

**Contagem, não cronômetro.** Os testes deste arquivo afirmam que certos
caminhos O(n) da biblioteca não são mais percorridos, e que o XML produzido pelo
caminho rápido é **idêntico** ao que a API pública do ``python-docx`` produzia.
Nenhum deles compara segundos contra um número fixo: um teto absoluto mede a
máquina, falha em CI carregado e — pior — passa se a correção for revertida numa
máquina rápida (ESPEC 026 `D-07`).

A única exceção é a `T-2011`, que compara uma **razão** entre duas medidas do
mesmo ambiente, onde a velocidade da máquina se cancela.

**Comparar XML, nunca comportamento.** Os três defeitos que o protótipo da
ESPEC 026 §2.5 teve — ``<w:t>`` vazio a mais, ``w:sz`` arredondado em vez de
truncado, ``\\t`` literal em vez de ``<w:tab/>`` — passam em qualquer asserção
sobre ``cell.text``, contagem de linhas ou número de células. Só o XML os vê.
"""

from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Any

import docx
import pytest
from docx.oxml.table import CT_Tc
from docx.oxml.xmlchemy import BaseOxmlElement
from lxml import etree

from domain.entities.annex import Anexo, CelulaAnexo, Mesclagem, Orientacao
from infrastructure.report import layout, ooxml
from infrastructure.report.docx_renderer import DocxRenderer

ANEXOS_JSON = Path(__file__).parents[1] / "src" / "infrastructure" / "annex" / "anexos.json"


# ── Instrumentação ────────────────────────────────────────────────────────────
#
# Os dois pontos abaixo são atributos de classe Python comuns — as classes do
# `lxml` derivam de `ElementBase` e aceitam `setattr` —, e por isso podem ser
# contados por `monkeypatch` sem tocar na biblioteca instalada.


def _contar_insercoes(monkeypatch: pytest.MonkeyPatch) -> list[int]:
    """Conta `insert_element_before`, o XPath por atributo do `python-docx`.

    É o custo que `escrever` pagava sete vezes por célula: cada atribuição de
    propriedade avalia um XPath sobre a lista de sucessores para descobrir em
    que posição do esquema OOXML o elemento entra.
    """
    total = [0]
    original = BaseOxmlElement.insert_element_before

    def contado(self: Any, elm: Any, *tagnames: str) -> Any:
        total[0] += 1
        return original(self, elm, *tagnames)

    monkeypatch.setattr(BaseOxmlElement, "insert_element_before", contado)
    return total


def _contar_varreduras_de_fileira(monkeypatch: pytest.MonkeyPatch) -> list[int]:
    """Conta `_tr_idx` e `_tr_below` — os dois caminhos O(fileiras) de `merge`.

    Ambos resolvem `self._tbl.tr_lst`, que reconstrói a lista de **todas** as
    fileiras da tabela, e depois procuram a sua nela. Numa aba com uma mesclagem
    por linha de dados, isso é quadrático.
    """
    total = [0]
    tr_idx = CT_Tc._tr_idx
    tr_below = CT_Tc._tr_below

    def contado(propriedade: Any) -> property:
        def acessor(self: Any) -> Any:
            total[0] += 1
            return propriedade.fget(self)

        return property(acessor)

    monkeypatch.setattr(CT_Tc, "_tr_idx", contado(tr_idx))
    monkeypatch.setattr(CT_Tc, "_tr_below", contado(tr_below))
    return total


# ── Insumos sintéticos ────────────────────────────────────────────────────────


def _celula(texto: str = "") -> CelulaAnexo:
    return CelulaAnexo(texto=texto, borda=True)


def _anexo_com_mesclagens(linhas: int = 20, colunas: int = 6) -> Anexo:
    """Uma aba de forma conhecida, com uma mesclagem de linha inteira por fileira.

    Sintética, e não a planilha real: abrir `levantamento.xlsx` custaria 2,8 s
    para provar uma contagem que não depende de nenhum dado dela.
    """
    return Anexo(
        aba="Sintetico",
        orientacao=Orientacao.PAISAGEM,
        corpo=5.6,
        linhas=tuple(
            tuple(_celula(f"c{linha}-{coluna}") for coluna in range(colunas))
            for linha in range(linhas)
        ),
        mesclagens=tuple(
            Mesclagem(linha=linha, coluna=0, ate_linha=linha, ate_coluna=colunas - 1)
            for linha in range(linhas)
        ),
        proporcoes=(10.0,) * colunas,
    )


def _renderizar_anexo(anexo: Anexo) -> None:
    """Só `_tabelas_do_anexo` — o trecho que a `R-DES-04` governa.

    O documento inteiro não serve: `mesclar_linha` continua usando `_Cell.merge`
    no bloco de título (`R-DES-09`), e são três células. Contar o documento todo
    daria um número diferente de zero por motivo legítimo, e o teste teria de
    aceitar um teto arbitrário. **Zero é uma asserção; "menos de 40" é uma
    opinião.**
    """
    documento = docx.Document()
    DocxRenderer()._tabelas_do_anexo(documento, anexo, documento.sections[0])


# ── T-2012 · `escrever` não consulta a ordem do esquema ───────────────────────


def test_escrever_nao_consulta_a_ordem_do_esquema(monkeypatch: pytest.MonkeyPatch) -> None:
    """`[portão P1]` — `R-DES-03`, pelo mecanismo.

    **Contagem medida em 2026-08-19, contra `f5c9f3d`, antes da T-2004: 8** —
    uma por atributo que `escrever` atribuía pela API pública (`space_before`,
    `space_after`, `jc`, `bold`, `font.size`, `font.name`, `font.color.rgb` e o
    `rFonts`). Sem `alinhamento` explícito são **7**: o `w:jc` não é emitido.
    Multiplicado por 15.955 células no piloto e 31.048 no PGM, dava as 114.112
    avaliações de XPath da ESPEC §2.2.

    O caso exercitado aqui é o de **oito**, de propósito: é o que passa por
    todos os ramos de `escrever`.

    Zero porque o `w:p` da célula nasce vazio e a ordem canônica do `w:rPr` é
    conhecida em tempo de escrita: não há o que procurar.
    """
    tabela = docx.Document().add_table(rows=1, cols=1)
    celula = tabela._cells[0]

    insercoes = _contar_insercoes(monkeypatch)
    ooxml.escrever(celula, "x", negrito=True, corpo=4.8, alinhamento="right")

    assert insercoes[0] == 0


def test_a_celula_vazia_recebe_a_marca_do_paragrafo() -> None:
    """`[portão P1]` — ESPEC 053 `R-CEL-04`, isolado, sem `Document` completo.

    A execução (`w:r/w:rPr`) já recebia o corpo do anexo, mesmo vazia (ESPEC
    049 `R-CEL-01`). O que faltava é a **marca** (`w:pPr/w:rPr`), que é o que o
    Word consulta para calcular a altura da linha quando a execução não tem
    glifo — sem ela, o parágrafo herda os 12pt do documento.
    """
    from docx.oxml.ns import qn

    tabela = docx.Document().add_table(rows=1, cols=1)
    celula = tabela._cells[0]

    ooxml.escrever(celula, "", corpo=3.5)

    paragrafo = celula._tc.find(qn("w:p"))
    marca = paragrafo.find(qn("w:pPr")).find(qn("w:rPr"))
    assert marca is not None
    assert marca.find(qn("w:sz")).get(qn("w:val")) == "7"


# ── T-2010 · a mesclagem não varre as fileiras ────────────────────────────────


def test_a_mesclagem_nao_varre_as_fileiras(monkeypatch: pytest.MonkeyPatch) -> None:
    """`[portão P1]` — `R-DES-04`, pelo mecanismo.

    **Contagem medida em 2026-08-19, contra `f5c9f3d`, antes da T-2008: 240**
    para as 20 mesclagens desta aba sintética — 12 por mesclagem. No piloto
    inteiro são 10.452 e no PGM, 37.884 (ESPEC §2.3).

    O número por mesclagem **cresce com o número de fileiras da tabela**, e é
    essa dependência que define o defeito: a mesma aba com 40 linhas não custa
    o dobro, custa o quádruplo (ESPEC §2.3, razão medida de 4,15×).

    Zero porque `_mesclar_anexo` já conhece o retângulo: `topo`, `esquerda`,
    `altura` e `largura` saem das coordenadas da `Mesclagem`, e `_span_dimensions`
    existia só para redescobri-las.
    """
    anexo = _anexo_com_mesclagens()

    varreduras = _contar_varreduras_de_fileira(monkeypatch)
    _renderizar_anexo(anexo)

    assert varreduras[0] == 0


# ── T-2023 · `escrever` reproduz a API pública ────────────────────────────────
#
# **Não remover `_escrever_de_referencia`.** Ela fica verde e parece redundante
# assim que a implementação nova funciona, mas é o **único** ponto do
# repositório que ainda escreve um `run` pela API pública do `python-docx`. É
# ela que vai acusar uma atualização da biblioteca que mude a ordem do `w:rPr`,
# a conversão de `w:sz` ou o tratamento de `\t` — no mesmo commit que a
# introduzir, e não em produção. Sem ela, o teto de versão do `pyproject.toml`
# (`R-DES-07`) é uma promessa sem quem a cobre.


def _escrever_de_referencia(
    celula: Any,
    texto: str,
    *,
    negrito: bool = False,
    cor: str = layout.PRETO,
    alinhamento: str = "left",
    corpo: float | None = None,
) -> None:
    """A implementação de `ooxml.escrever` **como estava antes da T-2004**.

    Cópia literal, via API pública. O que ela custa está medido na `T-2012`; o
    que ela produz é o oráculo desta comparação.
    """
    from docx.enum.text import WD_ALIGN_PARAGRAPH
    from docx.oxml import OxmlElement
    from docx.oxml.ns import qn
    from docx.shared import Pt, RGBColor

    paragrafo = celula.paragraphs[0]
    paragrafo.paragraph_format.space_before = Pt(0)
    paragrafo.paragraph_format.space_after = Pt(0)
    if alinhamento != "left":
        paragrafo.alignment = {
            "center": WD_ALIGN_PARAGRAPH.CENTER,
            "right": WD_ALIGN_PARAGRAPH.RIGHT,
        }[alinhamento]

    execucao = paragrafo.add_run(texto)
    execucao.bold = negrito
    execucao.font.size = Pt(corpo if corpo is not None else layout.CORPO_FONTE)
    execucao.font.name = layout.FONTE_REGULAR
    execucao.font.color.rgb = RGBColor.from_string(cor.lstrip("#").upper())

    rPr = execucao._element.get_or_add_rPr()
    fontes = rPr.find(qn("w:rFonts"))
    if fontes is None:
        fontes = OxmlElement("w:rFonts")
        rPr.append(fontes)
    for atributo in ("w:ascii", "w:hAnsi", "w:cs"):
        fontes.set(qn(atributo), layout.FONTE_REGULAR)

    # ESPEC 053 `R-CEL-04`/`R-DES-06` — a marca do parágrafo. A API pública não
    # a expõe (nem o oxml: `CT_PPr` não declara `rPr`), então é montada à mão,
    # copiando o `w:sz` que a própria API já calculou para a execução acima —
    # mesma fonte de verdade, sem recalcular o truncamento de `_meio_ponto`.
    marca = OxmlElement("w:rPr")
    marca_fontes = OxmlElement("w:rFonts")
    for atributo in ("w:ascii", "w:hAnsi", "w:cs"):
        marca_fontes.set(qn(atributo), layout.FONTE_REGULAR)
    marca.append(marca_fontes)
    marca_sz = OxmlElement("w:sz")
    marca_sz.set(qn("w:val"), rPr.find(qn("w:sz")).get(qn("w:val")))
    marca.append(marca_sz)
    paragrafo._p.get_or_add_pPr().append(marca)


def _corpos_dos_anexos() -> tuple[float, ...]:
    """Os catorze corpos de `anexos.json`, **lidos e não transcritos**.

    Seis deles — 4,3 · 4,4 · 4,8 · 5,8 · 6,4 · 8,9 — dão resultado diferente
    entre `int(...)` e `round(...)` na conversão para meio-ponto; os outros oito
    dão o mesmo. Uma amostra escolhida a esmo tem chance real de conter só os
    oito silenciosos, e passaria sobre um defeito que atinge **seis dos dezenove
    anexos**: `Servidores`, `ServidoresSemDesenv`, `Detalhes`, `WIFI`, `NAS` e
    `ServicosVcloud`.

    Lendo do JSON, um anexo novo com corpo novo entra na matriz sozinho.
    """
    dados = json.loads(ANEXOS_JSON.read_text(encoding="utf-8"))
    return tuple(sorted({float(entrada["corpo"]) for entrada in dados["anexos"]}))


def _corpos_parametrizados() -> list[Any]:
    """Os corpos com id legível, e os divergentes marcados como tais.

    Sem isto a falha aparece como `[…-4.8-…]` e alguém gasta vinte minutos
    descobrindo qual eixo importa. Com `corpo_4_8_trunca`, a mensagem já diz
    que o caso é o do truncamento (`T-2005`).
    """
    marcados = []
    for corpo in _corpos_dos_anexos():
        trunca = int(int(corpo * 12700) / 12700 * 2) != round(corpo * 2)
        sufixo = "_trunca" if trunca else ""
        marcados.append(
            pytest.param(corpo, id=f"corpo_{str(corpo).replace('.', '_')}{sufixo}")
        )
    return [pytest.param(None, id="corpo_padrao"), *marcados]


TEXTOS = [
    pytest.param("", id="texto_vazio"),
    pytest.param("x", id="simples"),
    pytest.param("  espaço  ", id="espaco_nas_pontas"),
    pytest.param("a\tb", id="com_tabulacao"),
    pytest.param("a\nb", id="com_quebra"),
    pytest.param("E&Cia <2>", id="com_escape"),
    pytest.param("ATIVAÇÃO", id="com_acento"),
    pytest.param("DATA DE ATIVACAO\t:\t26/06/2023\t,\tRUA , DA COROA, 1751", id="linha_do_anexo"),
]

CORES = [
    pytest.param(layout.PRETO, id="padrao"),
    pytest.param("#222854", id="com_cerquilha"),
    pytest.param("222854", id="sem_cerquilha"),
    pytest.param("e6e6fa", id="minuscula"),
]


def _celula_escrita(escritor: Any, texto: str, **opcoes: Any) -> Any:
    tabela = docx.Document().add_table(rows=1, cols=1)
    celula = tabela._cells[0]
    escritor(celula, texto, **opcoes)
    return celula._tc


@pytest.mark.parametrize("corpo", _corpos_parametrizados())
@pytest.mark.parametrize("negrito", [True, False])
@pytest.mark.parametrize("alinhamento", ["left", "center", "right"])
@pytest.mark.parametrize("texto", TEXTOS)
def test_escrever_reproduz_a_api_publica(
    texto: str, alinhamento: str, negrito: bool, corpo: float | None
) -> None:
    """`R-DES-03` e `R-DES-06` — o XML, elemento a elemento.

    Nasce trivialmente verde: antes da `T-2004` a referência e a implementação
    são o mesmo código. Depois dela divergem por construção, e a asserção passa
    a significar o que diz. É o padrão de `_sem_os_deltas` em
    `test_quantitativo_consolidado.py`, pelo mesmo motivo.
    """
    opcoes = {"negrito": negrito, "alinhamento": alinhamento, "corpo": corpo}
    esperado = _celula_escrita(_escrever_de_referencia, texto, **opcoes)
    obtido = _celula_escrita(ooxml.escrever, texto, **opcoes)

    assert etree.tostring(obtido) == etree.tostring(esperado)


@pytest.mark.parametrize("cor", CORES)
def test_escrever_reproduz_a_api_publica_nas_cores(cor: str) -> None:
    esperado = _celula_escrita(_escrever_de_referencia, "x", cor=cor)
    obtido = _celula_escrita(ooxml.escrever, "x", cor=cor)

    assert etree.tostring(obtido) == etree.tostring(esperado)


# ── T-2024 · `mesclar_regiao` reproduz a API pública ──────────────────────────
#
# **Não remover a rota de referência.** `ooxml.mesclar` continua existindo para
# `mesclar_linha` (`R-DES-09`), e é ela que este teste usa como oráculo: é o
# único ponto que ainda funde células por `_Cell.merge`, e é o que acusa uma
# atualização do `python-docx` que mude o XML da fusão.

REGIOES = [
    pytest.param(0, 0, 1, 4, id="horizontal_1xN"),
    pytest.param(0, 0, 4, 1, id="vertical_Nx1"),
    pytest.param(0, 0, 3, 3, id="retangulo_NxM"),
    pytest.param(2, 1, 2, 3, id="fora_da_fileira_zero"),
    pytest.param(1, 2, 1, 4, id="aparada_na_ultima_coluna"),
    pytest.param(0, 0, 1, 1, id="celula_unica"),
]

FILEIRAS_SINTETICAS = 6
COLUNAS_SINTETICAS = 6


def _tabela_sintetica() -> Any:
    """Uma tabela com conteúdo em toda célula, para a fusão ter o que mover.

    Células vazias esconderiam um defeito de `_move_content_to`: o XML sairia
    igual porque não há conteúdo a concatenar.
    """
    documento = docx.Document()
    tabela = documento.add_table(rows=FILEIRAS_SINTETICAS, cols=COLUNAS_SINTETICAS)
    for indice, celula in enumerate(tabela._cells):
        ooxml.escrever(celula, f"c{indice}")
    return tabela


@pytest.mark.parametrize(("topo", "esquerda", "altura", "largura"), REGIOES)
def test_mesclar_regiao_reproduz_a_api_publica(
    topo: int, esquerda: int, altura: int, largura: int
) -> None:
    """`R-DES-04` e `R-DES-06` — o XML da **tabela inteira**, não da célula.

    Da tabela e não da célula-topo de propósito: uma implementação que esqueça
    de remover os `w:tc` absorvidos produz a mesma célula-topo e uma tabela
    diferente, e a comparação por célula passaria.
    """
    esperada = _tabela_sintetica()
    grade = esperada._cells
    primeira = grade[topo * COLUNAS_SINTETICAS + esquerda]
    ultima = grade[(topo + altura - 1) * COLUNAS_SINTETICAS + (esquerda + largura - 1)]
    ooxml.mesclar(primeira, ultima)

    obtida = _tabela_sintetica()
    ooxml.mesclar_regiao(ooxml.fileiras_de(obtida), topo, esquerda, altura, largura)

    assert etree.tostring(obtida._tbl) == etree.tostring(esperada._tbl)


def test_mesclagens_disjuntas_na_mesma_tabela() -> None:
    """A invariante de não-sobreposição de `D-03`, exercitada.

    Duas mesclagens que não se tocam, aplicadas em sequência sobre a **mesma**
    lista de fileiras resolvida uma vez. Se fundir uma invalidasse a outra — que
    é o que a invariante nega —, o XML divergiria aqui.
    """
    esperada = _tabela_sintetica()
    grade = esperada._cells
    ooxml.mesclar(grade[0], grade[2])
    ooxml.mesclar(grade[3 * COLUNAS_SINTETICAS + 1], grade[4 * COLUNAS_SINTETICAS + 3])

    obtida = _tabela_sintetica()
    fileiras = ooxml.fileiras_de(obtida)
    ooxml.mesclar_regiao(fileiras, 0, 0, 1, 3)
    ooxml.mesclar_regiao(fileiras, 3, 1, 2, 3)

    assert etree.tostring(obtida._tbl) == etree.tostring(esperada._tbl)


# ── T-2011 · o custo é linear ─────────────────────────────────────────────────


@pytest.mark.lento
def test_o_custo_de_um_anexo_e_linear() -> None:
    """`D-07` — o único teste com relógio, e ele afirma uma **razão**.

    Dobrar as fileiras não pode mais que dobrar o custo. Medido em 2026-08-19,
    sobre `_tabelas_do_anexo` inteiro: **1,55×** depois da `T-2008`. A mesclagem
    isolada, sem a escrita das células, dava **4,15×** antes e **1,16×** depois
    — este teste mede o caminho de produção, que carrega junto o custo linear de
    escrever as células, e por isso fica acima de 1,16.

    O teto de 2,6 tem margem de 1,7× para baixo e sobra folga para o quadrático
    voltar a aparecer bem antes de os 4,15× serem alcançados.

    Razão entre duas medidas do **mesmo** ambiente: a velocidade da máquina se
    cancela, e por isso isto roda em qualquer lugar. A medida de 1,16 foi tomada
    de propósito **com a suíte inteira rodando em paralelo** — o pior caso de
    contenção que este projeto produz —, e sobreviveu.

    Se oscilar em CI, a saída é `-m "not lento"` no laço rápido. **Nunca
    afrouxar o fator**, que é o que ele mede.
    """
    def custo(fileiras: int) -> float:
        anexo = _anexo_com_mesclagens(linhas=fileiras, colunas=8)
        inicio = time.perf_counter()
        _renderizar_anexo(anexo)
        return time.perf_counter() - inicio

    # A primeira medida também aquece os caminhos do `python-docx`; descartá-la
    # evita que o custo de importação apareça como não-linearidade.
    custo(200)

    razao = custo(800) / custo(400)

    assert razao <= 2.6, f"o custo da mesclagem voltou a crescer mais que linearmente: {razao:.2f}x"
