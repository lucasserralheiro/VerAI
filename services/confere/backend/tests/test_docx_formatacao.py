"""T-212 — A formatação aplicada por propriedades diretas.

O modelo não traz estilo de tabela utilizável, então bordas, sombreamento e
larguras vão elemento a elemento. Estes testes conferem no XML que as
propriedades **foram aplicadas** — não que o resultado é bonito.

**A diferença importa.** Um documento com as 55 linhas certas e as bordas
erradas passaria no teste-âncora. A conferência visual no Word segue sendo
parte do aceite (PLANO 003, insumo J-02); estes testes reduzem o que sobra para
ela, não a substituem.
"""

from __future__ import annotations

import re
import zipfile
from collections.abc import Callable
from pathlib import Path

import docx
import pytest

from application.use_cases.generate_measurement_report import ReportResult
from infrastructure.report import layout
from infrastructure.report.docx_renderer import DocxRenderer


@pytest.fixture(scope="module")
def gerado(
    gerar_piloto: Callable[..., ReportResult],
    tmp_path_factory: pytest.TempPathFactory,
) -> Path:
    # `gerar_piloto()` devolve um relatório novo, e é o que este módulo precisa:
    # a linha abaixo o esvazia, e um relatório compartilhado levaria os anexos
    # embora para todo mundo.
    resultado = gerar_piloto()
    assert resultado.relatorio is not None

    # Sem os anexos. Estes testes contam ocorrências no XML do documento
    # **inteiro**, e as 25 mil células dos anexos trazem as suas próprias cores
    # e datas — a lavanda de `Office365`, os horários de `Usuários`. Contá-las
    # aqui mediria outra coisa: a formatação da tabela de comprovação é o que
    # está sob teste, e ela tem os seus próprios testes em `test_docx_anexos`.
    resultado.relatorio.anexos = []

    destino = tmp_path_factory.mktemp("formatacao") / "relatorio.docx"
    return DocxRenderer().renderizar(resultado.relatorio, destino)


@pytest.fixture(scope="module")
def xml(gerado: Path) -> str:
    with zipfile.ZipFile(gerado) as pacote:
        return pacote.read("word/document.xml").decode("utf-8")


def _sem_cerquilha(cor: str) -> str:
    return cor.lstrip("#").upper()


# ── Cores medidas no relatório modelo ─────────────────────────────────────────


def test_as_faixas_usam_o_navy_do_modelo(xml: str) -> None:
    assert f'w:fill="{_sem_cerquilha(layout.NAVY)}"' in xml


def test_a_coluna_da_medida_usa_a_lavanda_do_modelo(xml: str) -> None:
    assert f'w:fill="{_sem_cerquilha(layout.LAVANDA)}"' in xml


def test_a_lavanda_aparece_uma_vez_por_linha(xml: str) -> None:
    """54 linhas de item, 54 células destacadas.

    Foram 55, depois 58, e voltam a 55 por outro caminho. A ESPEC 018 trocou o
    universo pelo da aba `Levantamento` e nada mais era omitido (`D-04`): entraram
    os 4 do bloco final e saiu 1 do desdobramento por qualificador. A ESPEC 028
    `R-ZER-01` retira 3 desses 4 — os que a aba zera nas duas colunas.

    **O número coincidir com o de antes da ESPEC 018 é acaso**, e não vale como
    conferência: aqueles 55 eram outro conjunto de códigos. Quem afirma quais são
    é `test_anchor_por_codigo`.
    """
    ocorrencias = xml.count(f'w:fill="{_sem_cerquilha(layout.LAVANDA)}"')
    assert ocorrencias == 54


def test_o_texto_das_faixas_e_branco(xml: str) -> None:
    assert f'w:val="{_sem_cerquilha(layout.BRANCO)}"' in xml


# ── Tipografia ────────────────────────────────────────────────────────────────


def test_o_corpo_de_fonte_e_o_do_modelo(xml: str) -> None:
    """5,6 pt — meios-pontos no OOXML, portanto 11."""
    meios_pontos = int(layout.CORPO_FONTE * 2)
    assert f'<w:sz w:val="{meios_pontos}"/>' in xml


def test_a_fonte_e_calibri(xml: str) -> None:
    assert f'w:ascii="{layout.FONTE_REGULAR}"' in xml


# ── Grade e larguras ──────────────────────────────────────────────────────────


def test_a_grade_usa_a_cor_do_modelo(xml: str) -> None:
    assert f'w:color="{_sem_cerquilha(layout.GRADE)}"' in xml


def test_as_tabelas_tem_disposicao_fixa(xml: str) -> None:
    """Sem `fixed`, o Word redistribui as colunas e as medidas do GRC se perdem."""
    tabelas = xml.count("<w:tbl>")
    assert tabelas > 0
    assert xml.count('<w:tblLayout w:type="fixed"/>') == tabelas


def test_as_larguras_de_coluna_sao_as_do_grc_menos_a_folga(gerado: Path) -> None:
    """Quatro colunas idênticas ao GRC; só a descrição cede.

    A margem interna das células empurrava a tabela para fora da área útil e a
    coluna "Quantidade Medida" saía cortada. A folga é descontada da descrição
    porque ela é a única que pode ceder — as outras quatro não quebram linha, e
    apertá-las cortaria número (`layout.FOLGA_DESCRICAO`).
    """
    documento = docx.Document(str(gerado))
    # A primeira tabela é o bloco de título, de três colunas; as demais são as
    # seções do relatório, de cinco.
    secoes = [t for t in documento.tables if len(t.columns) == len(layout.LARGURAS_COLUNAS_DOCX)]
    assert secoes

    esperadas = [round(v, 1) for v in layout.LARGURAS_COLUNAS_DOCX]
    for tabela in secoes:
        # A primeira fileira pode estar mesclada; a última é sempre de dados.
        larguras = [round(c.width.pt, 1) for c in tabela.rows[-1].cells]
        assert larguras == esperadas

    # Só a descrição difere do GRC, e apenas pela folga.
    assert esperadas[1] == round(layout.LARGURAS_COLUNAS[1] - layout.FOLGA_DESCRICAO, 1)
    for indice in (0, 2, 3, 4):
        assert esperadas[indice] == round(layout.LARGURAS_COLUNAS[indice], 1)


def test_a_grade_da_tabela_acompanha_as_celulas(gerado: Path) -> None:
    """Com disposição fixa é o `w:gridCol` que o Word usa para montar as colunas.

    Definir só o `w:tcW` deixava a grade com colunas uniformes — a tabela saía
    com as proporções erradas.
    """
    with zipfile.ZipFile(gerado) as pacote:
        xml = pacote.read("word/document.xml").decode("utf-8")

    tabelas = re.findall(r"<w:tbl>.*?</w:tbl>", xml, re.S)
    de_secao = [t for t in tabelas if len(re.findall(r'<w:gridCol w:w="(\d+)"', t)) == 5]
    assert de_secao

    esperadas = [int(round(v * 20)) for v in layout.LARGURAS_COLUNAS_DOCX]
    for tabela in de_secao:
        assert [int(x) for x in re.findall(r'<w:gridCol w:w="(\d+)"', tabela)] == esperadas


def test_a_tabela_com_as_margens_cabe_na_area_util(gerado: Path) -> None:
    """A conta que faltava: a margem interna das células conta na largura.

    Com o padrão do Word — 108 twips por lado — as cinco colunas somavam 1,9 cm
    a mais e a última era empurrada para fora da página.
    """
    from infrastructure.report.ooxml import MARGEM_CELULA

    corpo = docx.Document(str(gerado)).sections[-1]
    util_twips = (corpo.page_width - corpo.left_margin - corpo.right_margin) / 635

    colunas_twips = sum(v * 20 for v in layout.LARGURAS_COLUNAS_DOCX)
    margens_twips = len(layout.LARGURAS_COLUNAS_DOCX) * 2 * MARGEM_CELULA

    assert colunas_twips + margens_twips <= util_twips


# ── Determinismo do pacote ────────────────────────────────────────────────────


def test_o_pacote_tem_carimbo_de_tempo_fixo(gerado: Path) -> None:
    """Sem isto, dois documentos idênticos diferem nos bytes (R-DOC-10)."""
    with zipfile.ZipFile(gerado) as pacote:
        carimbos = {info.date_time for info in pacote.infolist()}
    assert carimbos == {(1980, 1, 1, 0, 0, 0)}


def test_nao_ha_carimbo_de_relogio_no_conteudo(xml: str) -> None:
    """Uma data de geração no corpo quebraria a identidade entre execuções."""
    assert not re.search(r"\d{2}/\d{2}/20\d{2}\s+\d{2}:\d{2}", xml)


# ── Bloco de título, medido no relatório modelo ───────────────────────────────


def test_o_bloco_de_titulo_tem_as_linhas_em_branco_do_modelo(gerado: Path) -> None:
    """Duas linhas vazias: após o título e antes da primeira seção.

    Medidas no GRC: as faixas navy saltam de 57,1 para 72,0 e de 79,4 para
    94,3, com a altura de linha em 7,4 — um salto de 14,9 é uma linha vazia.
    """
    titulo = docx.Document(str(gerado)).tables[0]
    assert len(titulo.rows) == 5

    conteudo = ["".join(c.text for c in f.cells).strip() for f in titulo.rows]
    assert conteudo[0].startswith("LEVANTAMENTO - COMPROVAÇÃO")
    assert conteudo[1] == ""
    assert conteudo[2].startswith("Data do Levantamento")
    assert conteudo[3].startswith("*Valores conforme contrato")
    assert conteudo[4] == ""


def test_o_navy_das_linhas_de_rotulo_cobre_so_as_quantidades(gerado: Path) -> None:
    """No modelo a faixa dessas linhas vai de 681 a 799, e não de 37 a 799.

    O rótulo à esquerda fica em fundo branco com texto preto; só as duas
    colunas de quantidade recebem o navy.
    """
    titulo = docx.Document(str(gerado)).tables[0]
    navy = _sem_cerquilha(layout.NAVY)

    for indice in (2, 3):
        celulas = titulo.rows[indice].cells
        assert navy not in celulas[0]._tc.xml, "o rótulo à esquerda não deve ser navy"
        for celula in celulas[1:]:
            assert navy in celula._tc.xml


def test_as_linhas_em_branco_nao_tem_preenchimento(gerado: Path) -> None:
    titulo = docx.Document(str(gerado)).tables[0]
    navy = _sem_cerquilha(layout.NAVY)
    for indice in (1, 4):
        for celula in titulo.rows[indice].cells:
            assert navy not in celula._tc.xml


def test_o_bloco_de_rotulo_tem_o_contorno_do_modelo(gerado: Path) -> None:
    """Os traços medidos no GRC, e só eles.

    Horizontal em 71,8 e em 86,6 na largura toda — topo e base do bloco;
    verticais nas duas extremidades; e um horizontal em 79,2 que **para em
    x=681**, separando as duas linhas de rótulo sem cortar as colunas de
    quantidade, que ficam unidas pelo preenchimento navy.

    Aplicar a grade inteira produziria linhas que o modelo não tem.
    """
    titulo = docx.Document(str(gerado)).tables[0]

    def lados(linha: int, coluna: int) -> set[str]:
        xml = titulo.rows[linha].cells[coluna]._tc.xml
        return set(re.findall(r'<w:(top|left|bottom|right) w:val="single"', xml))

    assert lados(2, 0) == {"top", "left", "bottom"}
    assert lados(2, 1) == {"top"}
    assert lados(2, 2) == {"top", "right"}

    assert lados(3, 0) == {"left", "bottom"}
    assert lados(3, 1) == {"bottom"}
    assert lados(3, 2) == {"bottom", "right"}


def test_o_titulo_e_as_linhas_em_branco_nao_tem_borda(gerado: Path) -> None:
    """Na área do título o GRC só tem traços entre 71,8 e 86,6 — nada em 57,1."""
    titulo = docx.Document(str(gerado)).tables[0]
    for linha in (0, 1, 4):
        for celula in titulo.rows[linha].cells:
            assert 'w:val="single"' not in celula._tc.xml


# ── ESPEC 024 · o asterisco que explica o bloco final ────────────────────────
#
# Os dois textos são fixados aqui **por extenso**, e não via `layout.*`: são
# autorais desta espec, não transcrição de arquivo externo, e comparar contra
# a própria constante que a implementação vai definir provaria só que o código
# concorda com ele mesmo (PLANO 024 §1).

_TITULO_BLOCO_FINAL = "DEMAIS ITENS DO LEVANTAMENTO*"
_NOTA_BLOCO_FINAL = (
    "*Itens presentes na aba de levantamento sem código correspondente na "
    "tabela de itens do contrato analisado."
)


def _faixas(caminho: Path) -> list[str]:
    """A primeira fileira de cada tabela.

    O bloco é mesclado (`ooxml.mesclar_linha`): todas as células de `row.cells`
    apontam para o mesmo `<w:tc>`, e juntá-las repetiria o texto uma vez por
    coluna. Basta a primeira.
    """
    return [tabela.rows[0].cells[0].text.strip() for tabela in docx.Document(str(caminho)).tables]


# T-2159b / ESPEC 031 §2.7 — **os dois testes abaixo mudaram de par, e não de
# regra.** Eram sobre o piloto, que tinha uma linha no bloco final. A `R-APU-03`
# zerou essa linha, a `R-ZER-01` a retirou e o bloco esvaziou — então a
# `R-ZER-04` apaga faixa, asterisco e nota, e o piloto deixou de ter o que estes
# testes afirmam.
#
# **Repontados ao PGM, que continua com três linhas exibidas. Não afrouxados:**
# trocar a asserção por um `if` que aceitasse os dois estados apagaria a
# `R-NOT-01` e a `R-NOT-02` em vez de movê-las. Onde há bloco final, elas valem.


def test_o_titulo_do_bloco_final_termina_em_asterisco(documento_do_pgm: Path) -> None:
    """`R-NOT-01` — o PGM tem três itens exibidos no bloco final."""
    assert _TITULO_BLOCO_FINAL in _faixas(documento_do_pgm)


def test_a_nota_do_bloco_final_aparece_no_corpo(documento_do_pgm: Path) -> None:
    """`R-NOT-02` — uma vez, em parágrafo de corpo, não em célula de tabela."""
    textos = [p.text for p in docx.Document(str(documento_do_pgm)).paragraphs]
    assert _NOTA_BLOCO_FINAL in textos


def test_r_zer_04_o_piloto_perde_faixa_asterisco_e_nota(gerado: Path) -> None:
    """O par simétrico, e o **primeiro caso real** da `R-ZER-04`.

    A ESPEC 028 §8.1 registrou que aquela regra só era exercitada por cenário
    construído. A ESPEC 031 lhe deu par real sem pedir: o `14.049.00054.00` era a
    única linha que a `R-ZER-01` ainda desenhava no bloco final do piloto, e
    zerá-la esvaziou o bloco.

    Vale como asserção própria, e não como efeito colateral de um `sha256`: um
    asterisco órfão — título prometendo nota que não existe, ou nota remetendo a
    faixa que não está lá — é exatamente o que a `R-ZER-04` existe para impedir,
    e agora há um documento real onde conferir isso.
    """
    documento = docx.Document(str(gerado))

    assert _TITULO_BLOCO_FINAL not in _faixas(gerado)
    assert _NOTA_BLOCO_FINAL not in [p.text for p in documento.paragraphs]
    # E o asterisco não sobrevive sozinho em lugar nenhum do corpo.
    assert not any(p.text.strip().startswith("*") for p in documento.paragraphs)
