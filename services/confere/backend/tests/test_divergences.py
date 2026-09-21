"""ESPEC 002 — Grid de divergências.

O teste que mais importa é o de não-regressão: o PDF **não muda**. O grid é uma
leitura nova sobre os mesmos dados, e o teste-âncora continua sendo a garantia
de que o entregável formal ficou intacto.
"""

from __future__ import annotations

from collections.abc import Callable
from datetime import date
from decimal import Decimal

import pytest

from application.use_cases.generate_measurement_report import ReportResult
from domain.entities.report import Report, ReportLine
from domain.value_objects.quantity import NumberFormat, Quantity
from domain.value_objects.service_code import ServiceCode


def _linha(codigo: str, contratada: str, medida: str) -> ReportLine:
    return ReportLine(
        codigo=ServiceCode(codigo),
        descricao="ITEM",
        unidade="UN",
        contratada=Quantity(Decimal(contratada)),
        medida=Quantity(Decimal(medida)),
    )


# ── R-DIV-01 · quando uma linha diverge ───────────────────────────────────────


@pytest.mark.parametrize(
    ("contratada", "medida", "diverge"),
    [
        ("100", "0", True),
        ("5", "2", True),
        ("1", "1", False),
        ("0", "0", False),
        ("0", "2", True),
        ("3265.64", "3265.64", False),
    ],
)
def test_divergencia_e_comparacao_de_valor(contratada: str, medida: str, diverge: bool) -> None:
    assert _linha("14.049.00037.00", contratada, medida).tem_divergencia is diverge


def test_comparacao_usa_o_valor_e_nao_o_texto_formatado() -> None:
    """`117,2889…` e `117,29` formatam igual, mas são valores diferentes.

    Comparar o texto faria essa divergência desaparecer no arredondamento.
    """
    linha = ReportLine(
        codigo=ServiceCode("14.070.00001.00"),
        descricao="USN",
        unidade="USN/MÊS",
        contratada=Quantity(Decimal("117.29"), NumberFormat.MILHAR),
        medida=Quantity(Decimal("117.2889788312131"), NumberFormat.MILHAR),
    )
    assert linha.contratada.formatar() == linha.medida.formatar()
    assert linha.tem_divergencia


# ── R-DIV-03 · o filtro de divergências ───────────────────────────────────────


def test_linha_sem_divergencia_nao_aparece() -> None:
    """Devolvia seções; devolve lista, pela mesma razão de o documento ter
    deixado de tê-las (ESPEC 018 `R-REL-05`)."""
    relatorio = Report(
        "t",
        date(2026, 7, 15),
        "TC",
        "PA",
        linhas=[_linha("11.051.00012.00", "100", "0"), _linha("14.067.00001.00", "4", "4")],
    )

    divergentes = relatorio.apenas_divergencias()
    assert [str(linha.codigo) for linha in divergentes] == ["11.051.00012.00"]


def test_o_filtro_mantem_a_ordem_do_relatorio() -> None:
    """Cada linha do grid tem de ser reconhecível ao lado da mesma no documento."""
    relatorio = Report(
        "t",
        date(2026, 7, 15),
        "TC",
        "PA",
        linhas=[
            _linha("12.029.00080.00", "15", "0"),
            _linha("12.029.00021.00", "1", "1"),
            _linha("12.029.00025.00", "5", "2"),
        ],
    )

    assert [str(linha.codigo) for linha in relatorio.apenas_divergencias()] == [
        "12.029.00080.00",
        "12.029.00025.00",
    ]


def test_o_filtro_alcanca_o_bloco_final() -> None:
    """`D-06` — o bloco final é documento, e o grid não pode ignorá-lo."""
    relatorio = Report(
        "t",
        date(2026, 7, 15),
        "TC",
        "PA",
        linhas=[_linha("11.027.00001.00", "1", "1")],
        demais_itens=[_linha("14.049.00054.00", "0", "2")],
    )

    assert [str(linha.codigo) for linha in relatorio.apenas_divergencias()] == [
        "14.049.00054.00"
    ]


def test_filtrar_nao_altera_o_relatorio() -> None:
    """O documento é montado do mesmo agregado: filtrar não pode consumi-lo."""
    relatorio = Report(
        "t",
        date(2026, 7, 15),
        "TC",
        "PA",
        linhas=[_linha("11.051.00012.00", "100", "0"), _linha("11.027.00001.00", "1", "1")],
    )
    relatorio.apenas_divergencias()
    assert relatorio.total_linhas == 2


# ── Com os arquivos reais ─────────────────────────────────────────────────────


@pytest.fixture(scope="module")
def resultado(gerar_piloto: Callable[..., ReportResult]) -> ReportResult:
    return gerar_piloto()


def test_36_divergencias(resultado: ReportResult) -> None:
    """36 → 37 na ESPEC 018, e de volta a 36 na ESPEC 031.

    A trigésima sétima era o `14.049.00054.00`: contratada 0, medida 2, que a
    `R-REC-01` mantinha fora do documento e a `D-04` trouxe para o bloco final.

    **Aquele `2` era artefato de leitura.** A apuração descontada de `E1.1` não
    lista o código, e a `R-APU-03` lê essa ausência como zero. Com `0 = 0` ele
    deixa de divergir, e o grid volta às 36 de antes — por outro caminho, e
    sobre o mesmo conjunto menos um.
    """
    assert resultado.relatorio is not None
    assert resultado.relatorio.total_divergencias == 36
    assert len(resultado.relatorio.apenas_divergencias()) == 36


def test_o_documento_continua_com_58_linhas(resultado: ReportResult) -> None:
    """R-DIV-06 — o grid não toca o entregável formal."""
    assert resultado.relatorio is not None
    assert resultado.relatorio.total_linhas == 58


def test_toda_linha_do_grid_realmente_diverge(resultado: ReportResult) -> None:
    assert resultado.relatorio is not None
    for linha in resultado.relatorio.apenas_divergencias():
        assert linha.contratada.valor != linha.medida.valor, str(linha.codigo)


# ── R-DIV-05 · medidos sem previsão contratual ────────────────────────────────


def test_o_piloto_nao_tem_consumo_sem_cobertura_contratual(resultado: ReportResult) -> None:
    """**A lista está vazia, e é o resultado da ESPEC 031.**

    Era um item: o `14.049.00054.00`, medido 2 sem constar do contrato. A ESPEC
    001 §9.2 registrava a sua invisibilidade como custo aceito, a ESPEC 018 o
    trouxe ao documento, e a ESPEC 009 fez dele o único crítico do piloto.

    Os dois servidores eram de desenvolvimento. A apuração descontada de `E1.1`
    não os lista, e o `2` vinha do bloco bruto — o Confere lia o silêncio da
    linha apagada como *"não há variante"* em vez de *"mediu zero"*.

    O item **continua no relatório**, com `0 / 0` (`R-ZER-05`); o que sai é a
    afirmação de que houve consumo sem cobertura. `sem_cobertura_contratual`
    segue sendo mecanismo válido, exercitado por cenário construído acima.
    """
    assert resultado.relatorio is not None
    assert resultado.relatorio.sem_previsao_contratual == []

    linha = next(
        linha
        for linha in resultado.relatorio.todas_as_linhas
        if str(linha.codigo) == "14.049.00054.00"
    )
    assert (linha.contratada.valor, linha.medida.valor) == (0, 0)


def test_itens_sem_previsao_ficam_fora_do_pdf(resultado: ReportResult) -> None:
    assert resultado.relatorio is not None
    no_pdf = {str(linha.codigo) for linha in resultado.relatorio.linhas}
    assert "14.049.00054.00" not in no_pdf


# ── R-DIV-04 · perfil e pacote ────────────────────────────────────────────────


def test_perfil_e_pacote_sao_marcados(resultado: ReportResult) -> None:
    assert resultado.relatorio is not None
    marcados = {
        str(linha.codigo) for linha in resultado.relatorio.linhas if linha.perfil_ou_pacote
    }
    assert marcados == {
        "14.048.00008.00",
        "14.046.00010.00",
        "14.070.00002.00",
        "14.025.00011.00",
    }


def test_perfil_e_pacote_nunca_divergem(resultado: ReportResult) -> None:
    """Entram como 1/1 — daí a marcação na tela (ESPEC 001 §9.3)."""
    assert resultado.relatorio is not None
    for linha in resultado.relatorio.linhas:
        if linha.perfil_ou_pacote:
            assert not linha.tem_divergencia


# ── R-DIV-08 / R-DIV-09 · saldo ───────────────────────────────────────────────


@pytest.mark.parametrize(
    ("contratada", "medida", "esperado"),
    [
        ("100", "0", "100"),
        ("5", "2", "3"),
        ("3500", "762.55", "2.737,45"),
        ("1", "1", "0"),
        ("0", "2", "-2"),      # medido acima do contratado
        ("18", "39", "-21"),
    ],
)
def test_saldo_e_contratada_menos_medida(contratada: str, medida: str, esperado: str) -> None:
    assert _linha("14.049.00037.00", contratada, medida).saldo.formatar() == esperado


def test_saldo_herda_a_formatacao_do_item() -> None:
    """`1500` sem separador no item significa `488` sem separador no saldo."""
    linha = ReportLine(
        codigo=ServiceCode("14.023.00002.00"),
        descricao="ACESSO A REDE PRODAM",
        unidade="USUÁRIO/MÊS",
        contratada=Quantity(Decimal("1500"), NumberFormat.SIMPLES),
        medida=Quantity(Decimal("1012"), NumberFormat.SIMPLES),
    )
    assert linha.saldo.formatar() == "488"
    assert linha.saldo.formato is NumberFormat.SIMPLES


def test_saldo_negativo_no_bloco_sem_previsao(resultado: ReportResult) -> None:
    """Por construção: contratada zero e medida maior que zero.

    **Vacuamente verdadeiro no piloto desde a ESPEC 031** — a lista está vazia. O
    laço fica porque a invariante é sobre a *propriedade*, não sobre este par: no
    dia em que um levantamento trouxer consumo sem cobertura de verdade, o saldo
    tem de sair negativo, e é aqui que isso é afirmado.

    A asserção do `-2` saiu junto com o item que a produzia.
    """
    assert resultado.relatorio is not None
    assert resultado.relatorio.sem_previsao_contratual == []
    for linha in resultado.relatorio.sem_previsao_contratual:  # pragma: no cover
        assert linha.saldo.valor < 0


def test_saldo_de_toda_linha_do_grid_e_diferente_de_zero(resultado: ReportResult) -> None:
    """Se o saldo fosse zero a linha não deveria estar no grid."""
    assert resultado.relatorio is not None
    for linha in resultado.relatorio.apenas_divergencias():
        assert linha.saldo.valor != 0, str(linha.codigo)
