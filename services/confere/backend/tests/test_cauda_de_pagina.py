"""ESPEC 032 — a linha de item que atravessa a quebra de página.

`ler_celulas` distribui cada palavra pela posição do seu centro e **descarta em
silêncio** o que cai fora das fronteiras. Uma linha que atravessa a quebra tem a
cauda impressa no topo da página seguinte, acima de `horizontais[0]`, e o extrator
lê uma página por vez: não há quem a devolva à linha de onde ela veio.

São três itens em dois contratos, e o corte cai onde mais importa — o
`14.048.00008.00` termina na palavra `PERFIL`, antes da letra, justamente no item
cujo perfil contratado difere do medido.

**O risco desta correção não é perder texto; é colar texto errado.** Acima da
grade também moram prosa de outra seção e títulos de seção, e a regra ingênua
anexaria 177 palavras sobre SOA a uma descrição contratual. O crivo é a coluna:
continuação ocupa a de descrição, prosa atravessa a página.

Os seis casos entram **por documento e página**, com os números medidos da
geometria (TASKS 032 regra 1).
"""

from __future__ import annotations

import json
from decimal import Decimal
from pathlib import Path

import pdfplumber
import pytest

from infrastructure.contract.grid import analisar_geometria, montar_grade
from infrastructure.contract.pdfplumber_extractor import PdfPlumberContractExtractor

FIXTURES = Path(__file__).parent / "fixtures"
VALORES = FIXTURES / "valores_do_contrato.json"

# ── Os seis casos, medidos na geometria ───────────────────────────────────────
#
# `fora` é quantas palavras soltas caem **fora** da coluna de descrição. Zero é
# cauda; qualquer outro número é outra coisa, e outra coisa não entra.
#
# A separação é limpa — 0 contra 93 — e é ela que autoriza o crivo. Não há valor
# intermediário em nenhum dos três documentos.

CAUDAS = [
    ("contrato.pdf", 27, "150 MBPS SIMULTÂNEO NOS SERVIÇOS DE SEGURANÇA)"),
    ("contrato.pdf", 28, "D - Base de dados acima de 200GB até 500GB"),
    (
        "contrato_pgm.pdf",
        23,
        "1 (PARA LOCAIS ATÉ 50 USUÁRIOS E THROUGHPUT DE 150 MBPS "
        "SIMULTÂNEO NOS SERVIÇOS DE SEGURANÇA)",
    ),
]

ARMADILHAS = [
    ("contrato.pdf", 25, 110, "prosa sobre SOA"),
    ("contrato_pgm.pdf", 22, 117, "marcadores sobre VPN"),
    ("aditivo_pgm.pdf", 6, 93, "título da seção E5.10 e a explicação de cobrança por faixa"),
]

# ── As três descrições, e de onde vem cada alvo ───────────────────────────────

CORTADO_SD_WAN_PILOTO = (
    "DISPONIBILIZAÇÃO DE EQUIPAMENTO CPE-SD-WAN TIPO 1 "
    "(PARA LOCAIS ATÉ 50 USUÁRIOS E THROUGHPUT DE"
)
CORTADO_SD_WAN_PGM = "DISPONIBILIZAÇÃO DE EQUIPAMENTO CPE-SD-WAN TIPO"
CORTADO_SQL = "PLATAFORMA DE BANCO DE DADOS - SQL SERVER - PERFIL"

# `R-CON-06` — o alvo do `14.048.00008.00` **não** é leitura minha do PDF: é a
# forma que o próprio extrator produz para a mesma família quando a linha cabe na
# página. O `14.048.00009.00` do PGM está extraído inteiro há incrementos.
MOLDE_DA_FAMILIA_SQL = "PLATAFORMA DE BANCO DE DADOS - SQL SERVER - PERFIL F - Base de dados"
ALVO_SQL = (
    "PLATAFORMA DE BANCO DE DADOS - SQL SERVER - PERFIL D - Base de dados acima de 200GB até 500GB"
)


def _contrato(nome: str):  # type: ignore[no-untyped-def]
    return PdfPlumberContractExtractor().extrair(FIXTURES / nome)


def _cauda(nome: str, numero: int) -> str:
    """A cauda daquela página, pelo crivo de produção."""
    from infrastructure.contract.grid import cauda_da_pagina
    from infrastructure.contract.pdfplumber_extractor import COL_DESCRICAO

    with pdfplumber.open(FIXTURES / nome) as pdf:
        geometria = analisar_geometria(pdf)
        for candidato in geometria.candidatos:
            if numero not in candidato.paginas:
                continue
            pagina = pdf.pages[numero - 1]
            grade = montar_grade(pagina, candidato.divisorias)
            if grade is not None:
                return cauda_da_pagina(pagina, grade, COL_DESCRICAO)
    raise AssertionError(f"{nome} p{numero} não rendeu grade")


# ── `R-CON-01` e `R-CON-02` · o crivo ─────────────────────────────────────────


@pytest.mark.parametrize(("nome", "numero", "texto"), CAUDAS)
def test_r_con_01_as_tres_caudas_sao_reconhecidas(nome: str, numero: int, texto: str) -> None:
    """Zero palavras fora da coluna de descrição: é cauda, e o texto é este."""
    assert _cauda(nome, numero) == texto


@pytest.mark.parametrize(("nome", "numero", "fora", "o_que_e"), ARMADILHAS)
def test_r_con_02_as_tres_armadilhas_sao_rejeitadas(
    nome: str, numero: int, fora: int, o_que_e: str
) -> None:
    """Texto acima da grade que **não** é cauda de linha — e o crivo o recusa.

    São 110, 117 e 93 palavras fora da coluna de descrição. A regra ingênua
    anexaria qualquer um deles a uma descrição contratual, num documento que vai
    ao órgão: trocaria descrição cortada por descrição adulterada.
    """
    assert _cauda(nome, numero) == "", f"{nome} p{numero} — {o_que_e}, {fora} palavras fora"


def test_r_con_02_o_crivo_e_tudo_ou_nada(caminho_aditivo_pgm: Path) -> None:
    """`D-02` — a p6 do aditivo **tem** palavras na coluna de descrição.

    É o que separa *"rejeite a página"* de *"tome as que estão na coluna"*. A
    segunda leitura colaria metade de um parágrafo, e passaria em todos os outros
    testes deste módulo.

    O texto de lá parece descrição de item — `ADICIONAL DE VOLUMETRIA DE BANCO DE
    DADOS - ADICIONAL DE VOLUMETRIA - SQL SERVER - ATÉ 2.819,79…` —, e é título de
    seção mais explicação. O `14.048.00027.00` **já sai completo hoje**, e é a
    segunda asserção que prova que continuou saindo.
    """
    assert _cauda(caminho_aditivo_pgm.name, 6) == ""

    item = _contrato("aditivo_pgm.pdf").itens_de("14.048.00027.00")[0]
    assert item.descricao == (
        "ADICIONAL DE VOLUMETRIA - SQL SERVER - ATÉ 2.819,79 GB ACIMA DO PERFIL F - BACKUP STANDARD"
    )


# ── `R-CON-03` e `R-CON-06` · as três descrições reconstruídas ────────────────


def test_r_con_06_o_sd_wan_do_piloto_bate_com_a_aba(caminho_levantamento: Path) -> None:
    """O oráculo **externo**: outra fonte, outro sistema, a mesma cadeia.

    A aba `Levantamento` traz a descrição inteira do `12.074.00005.00`. É
    conferência independente do código — e é o que transforma *"o texto parece
    completo"* em asserção.
    """
    from infrastructure.measurement.levantamento_reader import LevantamentoReader

    da_aba = LevantamentoReader().ler(caminho_levantamento).itens_de("12.074.00005.00")[0]
    do_contrato = _contrato("contrato.pdf").descricao_para("12.074.00005.00")

    assert do_contrato == da_aba.descricao
    assert do_contrato != CORTADO_SD_WAN_PILOTO


def test_r_con_06_o_sd_wan_do_pgm_bate_com_a_aba(caminho_levantamento_pgm: Path) -> None:
    """O mesmo código no segundo par, cortado em outro ponto — depois de `TIPO`."""
    from infrastructure.measurement.levantamento_reader import LevantamentoReader

    da_aba = LevantamentoReader().ler(caminho_levantamento_pgm).itens_de("12.074.00005.00")[0]
    do_contrato = _contrato("contrato_pgm.pdf").descricao_para("12.074.00005.00")

    assert do_contrato == da_aba.descricao
    assert do_contrato != CORTADO_SD_WAN_PGM


def test_r_con_03_o_sql_server_do_piloto_ganha_o_perfil() -> None:
    """O corte que apagava a letra do perfil.

    **A aba não serve de oráculo aqui** — ela grafa `PERFIL IV(D) - DE 200GB ATÉ
    500GB`, redação diferente da contratual. O molde vem de dentro: o
    `14.048.00009.00` do PGM é o mesmo item noutro perfil, e a linha dele não cai
    numa quebra de página.
    """
    do_pgm = _contrato("contrato_pgm.pdf").descricao_para("14.048.00009.00")
    assert do_pgm is not None and do_pgm.startswith(MOLDE_DA_FAMILIA_SQL)

    do_piloto = _contrato("contrato.pdf").descricao_para("14.048.00008.00")
    assert do_piloto == ALVO_SQL
    assert do_piloto != CORTADO_SQL


# ── `R-CON-04` · nenhum valor numérico se move ────────────────────────────────


@pytest.mark.parametrize("nome", ["contrato.pdf", "contrato_pgm.pdf", "aditivo_pgm.pdf"])
def test_r_con_04_nenhum_valor_numerico_se_move(nome: str) -> None:
    """Os quatro campos de **todos** os itens dos três documentos.

    Conjunto inteiro contra conjunto inteiro, e não amostra: o defeito que este
    teste previne é justamente o que ninguém procuraria depois de uma correção de
    texto. A unidade entra junto porque é a coluna vizinha da descrição, e é a
    que uma cauda mal costurada invadiria primeiro.

    A âncora **não afirma que a extração está certa** — afirma que ela não se
    moveu. É o precedente da `T-1408` e da `T-1507`.
    """
    esperado = json.loads(VALORES.read_text(encoding="utf-8"))[nome]
    contrato = _contrato(nome)

    obtido = [
        [
            i.codigo.valor,
            i.unidade,
            str(i.quantidade),
            str(i.preco_unitario),
            i.meses,
            str(i.total_declarado),
        ]
        for i in contrato.itens
    ]
    assert obtido == esperado


@pytest.mark.parametrize("nome", ["contrato.pdf", "contrato_pgm.pdf", "aditivo_pgm.pdf"])
def test_r_con_04_o_checksum_continua_fechando(nome: str) -> None:
    """`V-CTR-03` por peça — a prova, anterior a esta espec, de que nada se perdeu."""
    contrato = _contrato(nome)
    for bloco in contrato.blocos:
        if bloco.total_declarado is None:
            continue
        soma = sum(
            (item.total_declarado for item in bloco.itens),
            start=Decimal(0),
        )
        assert soma == bloco.total_declarado, f"{nome} — bloco {bloco.rotulo}"

# ── `R-CON-05` · a cauda sem linha anterior ───────────────────────────────────


def test_r_con_05_cauda_orfa_vira_achado() -> None:
    """Cenário construído: nenhum dos três documentos o exercita.

    A cauda satisfaz o crivo — está toda na coluna de descrição — e a tabela
    começa naquela página, então não há linha anterior a que anexá-la. O texto é
    ignorado, e `V-CTR-06` o registra em vez de deixá-lo sumir em silêncio.

    É o modo de falha que a ESPEC 031 nomeou: regra que se desliga sozinha e
    devolve o defeito sem que nada acuse.
    """
    from domain.entities.contract import Contract, DiagnosticoDaGrade
    from domain.entities.validation_finding import Severity, ValidationReport
    from infrastructure.validations.contract_validations import (
        v_ctr_06_cauda_sem_linha_anterior,
    )

    achados = ValidationReport()
    contrato = Contract(
        proposta="PA-CONSTRUIDA",
        diagnostico=DiagnosticoDaGrade(
            paginas=1,
            paginas_com_borda=1,
            maior_numero_de_divisorias=8,
            paginas_com_texto=1,
            caudas_orfas=((7, "150 MBPS SIMULTÂNEO NOS SERVIÇOS DE SEGURANÇA)"),),
        ),
    )

    v_ctr_06_cauda_sem_linha_anterior(contrato, achados)

    assert [a.validacao for a in achados.achados] == ["V-CTR-06"]
    assert achados.achados[0].severidade is Severity.AVISA
    assert "página 7" in achados.achados[0].mensagem


def test_r_con_05_nao_dispara_em_documento_nenhum() -> None:
    """Guarda de anomalia: calada nos três, e é assim que tem de ser."""
    for nome in ("contrato.pdf", "contrato_pgm.pdf", "aditivo_pgm.pdf"):
        contrato = _contrato(nome)
        assert contrato.diagnostico is not None
        assert contrato.diagnostico.caudas_orfas == (), nome
