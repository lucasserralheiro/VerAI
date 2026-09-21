"""Testes do domínio — T-08 a T-13.

Rodam sem tocar em arquivo, rede ou framework. Se algum destes precisar de
mock de I/O, a camada está errada.
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal

import pytest

from domain.entities.contract_item import ContractItem
from domain.entities.measurement_item import MeasurementItem
from domain.entities.report import Report, ReportLine
from domain.entities.validation_finding import Severity, ValidationReport
from domain.errors import DomainError
from domain.value_objects.quantity import NumberFormat, Quantity, para_decimal
from domain.value_objects.service_code import ServiceCode

# ── T-08 · ServiceCode ────────────────────────────────────────────────────────


def test_codigo_valido_e_aceito() -> None:
    assert ServiceCode("14.049.00037.00").valor == "14.049.00037.00"


@pytest.mark.parametrize("invalido", ["14.049.37.00", "abc", "", "14049000370", "14.049.00037"])
def test_codigo_invalido_levanta_erro_de_dominio(invalido: str) -> None:
    with pytest.raises(DomainError):
        ServiceCode(invalido)


def test_codigo_serve_de_chave_de_dicionario() -> None:
    mapa = {ServiceCode("14.049.00037.00"): "hospedagem"}
    assert mapa[ServiceCode("14.049.00037.00")] == "hospedagem"


def test_codigo_e_extraido_de_texto_livre() -> None:
    """Os extratores localizam o código por padrão, nunca por posição fixa."""
    achado = ServiceCode.extrair("  14.049.00037.00  HOSPEDAGEM DE APLICACAO - TIPO A ")
    assert achado is not None
    assert achado.valor == "14.049.00037.00"


def test_texto_sem_codigo_devolve_nada() -> None:
    assert ServiceCode.extrair("TOTAL GERAL") is None


# ── T-09 · Quantity ───────────────────────────────────────────────────────────


@pytest.mark.parametrize(
    ("texto", "esperado"),
    [
        ("4.000,00", Decimal("4000.00")),
        ("1500", Decimal("1500")),
        ("BRL 229,02", Decimal("229.02")),
        ("3.265,64", Decimal("3265.64")),
        ("117,2889788312131", Decimal("117.2889788312131")),
        # T-2205 / ESPEC 033 `R-NUM-01` — o sinal separado do número.
        #
        # A célula de total do `12.030.00002.00` traz três tokens no PDF: `BRL`,
        # `-` e `986.810,00`. A do `PA-PGM-260304-715` traz `BRL -897.734,40`,
        # colado — e é por isso que nenhum aditivo tinha exposto isto. A variação
        # é de composição, e ocorre **dentro** do mesmo documento: a linha
        # `Redução TOTAL:` da mesma página grafa o sinal colado.
        ("BRL - 986.810,00", Decimal("-986810.00")),
        ("BRL -986.810,00", Decimal("-986810.00")),
        ("- 200,00", Decimal("-200.00")),
        ("+ 1.500", Decimal("1500")),
    ],
)
def test_conversao_ptbr_para_decimal(texto: str, esperado: Decimal) -> None:
    assert para_decimal(texto) == esperado


@pytest.mark.parametrize(
    "nao_numero",
    [
        "PACOTE",
        "D",
        "Perfil C",
        "",
        "   ",
        "-",
        "- ",
        # T-2205 / ESPEC 033 `D-06` — **a célula que a normalização não pode
        # resgatar.** É o que a grade errada produzia para o `12.030.00002.00`:
        # preço e quantidade fundidos por falta da divisória `343,5`.
        #
        # `R-NUM-01` normaliza **só** o espaço depois do sinal. Uma versão que
        # removesse todo espaço interno faria esta célula deixar de ser recusada
        # por sorte, e a guarda de `_montar_item` deixaria de denunciar tabela
        # genuinamente truncada (ESPEC 001 §9.4).
        "BRL -200,00 986,81",
        "BRL 7,48 697,00",
    ],
)
def test_texto_nao_numerico_sobrevive_como_none(nao_numero: str) -> None:
    """`PACOTE` e `Perfil D` precisam chegar íntegros à reconciliação."""
    assert para_decimal(nao_numero) is None


def test_quantidade_recusa_float() -> None:
    """Relatório de faturamento não admite arredondamento binário."""
    with pytest.raises(DomainError):
        Quantity(1500.0)  # type: ignore[arg-type]


@pytest.mark.parametrize(
    ("valor", "formato", "esperado"),
    [
        # O modelo grafa 1500 sem separador e 4.000 com — na mesma página.
        ("1500", NumberFormat.SIMPLES, "1500"),
        ("1500", NumberFormat.MILHAR, "1.500"),
        ("4000", NumberFormat.MILHAR, "4.000"),
        ("3500", NumberFormat.MILHAR, "3.500"),
        ("3265.64", NumberFormat.MILHAR, "3.265,64"),
        ("762.55", NumberFormat.MILHAR, "762,55"),
        ("117.2889788312131", NumberFormat.MILHAR, "117,29"),
        ("121.29", NumberFormat.MILHAR, "121,29"),
        ("0", NumberFormat.MILHAR, "0"),
        ("2", NumberFormat.MILHAR, "2"),
    ],
)
def test_formatacao_reproduz_o_modelo(valor: str, formato: NumberFormat, esperado: str) -> None:
    assert Quantity(Decimal(valor), formato).formatar() == esperado


def test_soma_preserva_o_formato() -> None:
    a = Quantity(Decimal("300"), NumberFormat.SIMPLES)
    total = a.somar(Quantity(Decimal("4000"))).somar(Quantity(Decimal("480")))
    assert total.valor == Decimal("4780")
    assert total.formato is NumberFormat.SIMPLES


# ── T-10 · Entidades de entrada ───────────────────────────────────────────────


def test_item_guarda_o_total_declarado_na_linha() -> None:
    """O total vem lido do documento, não recalculado.

    A fórmula varia por item: em HORA/HOMEM os meses não multiplicam, em
    serviços mensais sim. Somar o que o contrato afirma dispensa interpretar a
    regra de preço e ainda assim sustenta o checksum de V-CTR-03.
    """
    item = ContractItem(
        codigo=ServiceCode("14.049.00037.00"),
        descricao="HOSPEDAGEM DE APLICACAO - TIPO A",
        unidade="SERVIDOR/MES",
        quantidade=Decimal("1"),
        preco_unitario=Decimal("2488.21"),
        meses=12,
        total_declarado=Decimal("29858.52"),
        pagina=28,
    )
    assert item.total_declarado == Decimal("29858.52")


def test_chave_do_item_distingue_qualificador() -> None:
    """`14.025.00011.00` aparece duas vezes no contrato, IT0101 e SG0721."""
    comum = {
        "codigo": ServiceCode("14.025.00011.00"),
        "descricao": "PLATAFORMA DE BI - MS SQL",
        "unidade": "SOLUCAO/MES",
        "quantidade": Decimal("1"),
        "preco_unitario": Decimal("1"),
        "meses": 12,
        "total_declarado": Decimal("12"),
        "pagina": 27,
    }
    assert ContractItem(**comum, qualificador="IT0101").chave != (
        ContractItem(**comum, qualificador="SG0721").chave
    )


def _medicao(bloco: str, descricao: str, texto: str = "2") -> MeasurementItem:
    return MeasurementItem(
        codigo=ServiceCode("14.049.00047.00"),
        descricao=descricao,
        bloco_titulo=bloco,
        medida_texto=texto,
        linha=72,
    )


def test_desconto_de_desenvolvimento_detectado_no_titulo_do_bloco() -> None:
    item = _medicao("E1.1 - HOSPEDAGEM - DESCONTANDO RECURSOS DE DESENVOLVIMENTO", "TIPO A LINUX")
    assert item.desconta_desenvolvimento


def test_desconto_de_desenvolvimento_detectado_na_descricao_da_linha() -> None:
    """A SAN traz a marca na própria descrição da linha 129, não no bloco."""
    item = _medicao("E5.1 - ARMAZENAMENTO", "SAN - GB - DESCONTANDO RECURSOS DE DESENVOLVIMENTO")
    assert item.desconta_desenvolvimento


def test_bloco_sem_a_marca_nao_desconta() -> None:
    item = _medicao("E1.1 - HOSPEDAGEM - TOTAL DE RECURSOS", "TIPO A LINUX")
    assert not item.desconta_desenvolvimento


def test_medida_nao_numerica_e_reconhecida() -> None:
    item = _medicao("E2.3 GCN", "GERENCIAMENTO DE CONSUMO", texto="PACOTE")
    assert not item.e_numerica
    assert item.medida_texto == "PACOTE"


# ── T-11 · Agregado do relatório ──────────────────────────────────────────────


def _linha(codigo: str = "14.049.00037.00") -> ReportLine:
    return ReportLine(
        codigo=ServiceCode(codigo),
        descricao="HOSPEDAGEM",
        unidade="Servidor / Mes",
        contratada=Quantity(Decimal("1")),
        medida=Quantity(Decimal("1")),
    )


def test_o_documento_e_a_soma_das_linhas_e_do_bloco_final() -> None:
    """ESPEC 018 `R-REL-05` — o agregado deixou de ter seções.

    Era `secoes`, com supressão das vazias (`R-CAT-02`). Sem agrupamento não há
    cabeçalho a suprimir: o documento é a lista ordenada pelo contrato mais o
    bloco final.
    """
    relatorio = Report(
        "LEVANTAMENTO",
        date(2026, 7, 15),
        "TC 52/SMIT/2024",
        "PA-SMIT-260319-739",
        linhas=[_linha()],
        demais_itens=[_linha()],
    )

    assert relatorio.total_linhas == 2
    assert relatorio.todas_as_linhas == [*relatorio.linhas, *relatorio.demais_itens]


def test_celula_vazia_de_contratada_nao_e_zero() -> None:
    """T-1272 — ausência de afirmação não é afirmação de zero.

    O `14.046.00003.00` do PGM chega com a coluna em branco. Tratá-la como zero
    o classificaria como *medido acima do contratado* na análise.
    """
    declarada = _linha()
    ausente = ReportLine(
        codigo=ServiceCode("14.046.00003.00"),
        descricao="BANCO DE DADOS - MYSQL",
        unidade="GB/MÊS",
        contratada=Quantity(Decimal(0)),
        medida=Quantity(Decimal(0)),
        contratada_declarada=False,
    )

    assert declarada.contratada_declarada
    assert not ausente.contratada_declarada
    assert not ausente.sem_cobertura_contratual


# ── T-13 · Achados de validação ───────────────────────────────────────────────


def test_achado_bloqueante_impede_a_emissao() -> None:
    achados = ValidationReport()
    achados.registrar("V-REC-01", Severity.AVISA, "as fontes divergem")
    assert not achados.bloqueado

    achados.registrar("V-CTR-03", Severity.BLOQUEIA, "checksum não confere")
    assert achados.bloqueado
    assert len(achados.bloqueantes) == 1
    assert len(achados.avisos) == 1
