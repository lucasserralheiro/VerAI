"""T-2640/T-2641 / ESPEC 042 — o total que só existe em prosa e no cronograma.

`total_declarado` só era achado numa linha `TOTAL:` com célula `BRL`
(ESPEC 001). A família de propostas CGM não tem essa linha em nenhuma página
— declara o total duas vezes, em prosa e na seção "6. CRONOGRAMA
FÍSICO-FINANCEIRO", e nenhuma das duas é a marca que o extrator já sabia ler.

O teste que mais importa aqui é `test_t2640c`: medido no `aditivo_pgm.pdf`
(ESPEC 042 §2.2), o `TOTAL` do cronograma sozinho é o total absoluto do
contrato **depois** do aditivo, não o delta que aquela peça declara. Usá-lo
sem cruzar com a prosa produziria um `total_declarado` errado, não apenas
ausente — e é por isso que `_total_por_convergencia` exige as duas fontes
concordando, nunca uma só.
"""

from __future__ import annotations

from decimal import Decimal
from pathlib import Path

from infrastructure.contract.pdfplumber_extractor import PdfPlumberContractExtractor

# Os textos reais, medidos na ESPEC 042 §2.1 e §2.2 — reduzidos ao que as
# regexes precisam enxergar, sem o restante das páginas.

_PROSA_CGM = (
    "5. PREÇO DOS SERVIÇOS\n"
    "O Valor total dos Serviços, objeto desta proposta é estimado em "
    "R$ 5.532.203,96 (cinco milhões e quinhentos e trinta e dois mil e "
    "duzentos e tres reais e noventa e seis centavos), assim distribuídos:"
)

_CRONOGRAMA_CGM = (
    "6. CRONOGRAMA FÍSICO-FINANCEIRO\n"
    "A previsão de desembolsos terá como base a alocação de recursos previstos "
    "para cada etapa e forma de medição.\n"
    "PERÍODO A - SISTEMAS DE INFORMAÇÃO B - SERVIÇOS DE REDES E CONECTIVIDADES "
    "C - SOLUÇÕES DE SERVIÇOS DE COMUNICAÇÃO E - DATA CENTER H - PRODUTOS "
    "CUSTOMIZADOS POR ORGÃO VALOR TOTAL\n"
    "MÊS 1 - 16 DD 6.531,00 1.508,50 49.333,59 155.607,54 5.320,98 218.301,61\n"
    "TOTAL 607.600,70 24.299,18 1.110.005,88 3.670.576,12 119.722,08 5.532.203,96\n"
    "7. FORMA DE FATURAMENTO E PAGAMENTO"
)

_CRONOGRAMA_ADITIVO_PGM = (
    "6. CRONOGRAMA FÍSICO-FINANCEIRO\n"
    "PERÍODO A B C D E VALOR TOTAL\n"
    "MÊS 1 ...\n"
    "TOTAL R$ 9.200.002,00 R$ 30.170,00 R$ 2.004.792,84 R$ 13.075.742,70 "
    "R$ 119.722,08 R$ 24.551.037,60"
)


def _extrator() -> PdfPlumberContractExtractor:
    return PdfPlumberContractExtractor()


def test_t2640a_as_duas_fontes_concordando_dao_o_valor() -> None:
    texto = _PROSA_CGM + "\n" + _CRONOGRAMA_CGM

    valor = _extrator()._total_por_convergencia(texto)

    assert valor == Decimal("5532203.96")


def test_t2640b_so_a_frase_de_prosa_nao_basta() -> None:
    texto = _PROSA_CGM  # sem cronograma nenhum

    valor = _extrator()._total_por_convergencia(texto)

    assert valor is None


def test_t2640c_so_o_cronograma_nao_basta() -> None:
    """O caso do `aditivo_pgm.pdf` — o mais importante deste módulo.

    O `TOTAL` do cronograma, sozinho, é o total absoluto do contrato depois
    do aditivo — não o delta que esta peça declara (medido: `-0,12`, ESPEC 042
    §2.2). Se este teste voltar a passar com a função devolvendo um valor, a
    regra virou "uma fonte basta", e é exatamente o defeito que a ESPEC 042
    existe para não introduzir.
    """
    texto = _CRONOGRAMA_ADITIVO_PGM  # sem a frase de prosa

    valor = _extrator()._total_por_convergencia(texto)

    assert valor is None


def test_t2640d_as_duas_fontes_discordando_nao_produz_valor() -> None:
    texto = _PROSA_CGM + "\n" + _CRONOGRAMA_ADITIVO_PGM

    valor = _extrator()._total_por_convergencia(texto)

    assert valor is None


# ── Variantes da frase de prosa (medidas em 08/10/2026, corpus HSPM/SMDET) ────
#
# A frase original ("Valor total dos Serviços … estimado em R$") é de uma
# família só. As propostas do HSPM e do SMDET dizem o mesmo total com outras
# palavras, e sem a frase a `V-CTR-03` bloqueava com "total do contrato não
# localizado" — mesmo com os itens lidos certos e somando exatamente o total.

_PROSA_VALOR_PRINCIPAL = (
    "5.1 DIMENSIONAMENTO E PREÇO DOS SERVIÇOS\n"
    "O valor principal dos serviços, objeto desta proposta, é de R$ 963.333,48 "
    "(novecentos e sessenta e três mil, trezentos e trinta e três reais e "
    "quarenta e oito centavos), assim distribuído por serviços:"
)

_CRONOGRAMA_HSPM = (
    "6. CRONOGRAMA FÍSICO-FINANCEIRO\n"
    "PERÍODO EQUIPAMENTOS GESTÃO ACESSOS E WIFI INTERNET TOTAL\n"
    "MÊS 01 - - 41.762,09 28.054,20 69.816,29\n"
    "TOTAL 49.640,40 75.897,60 501.145,08 336.650,40 963.333,48"
)

_PROSA_VALOR_TOTAL_E_DIMENSIONAMENTO = (
    "O dimensionamento e o valor total dos serviços, objeto desta proposta, é "
    "de R$ 990.535,00 (novecentos e noventa mil e quinhentos e trinta e cinco "
    "reais), assim distribuídos:"
)

_CRONOGRAMA_990 = "TOTAL 742.357,00 248.178,00 990.535,00"

# Aditivo: o `TOTAL` do cronograma é o total absoluto do contrato depois dele,
# e a prosa diz o delta da peça (427.998,20). É o caso da `T-2640c` de novo.
_PROSA_ADITIVO = (
    "O Valor total dos Serviços, objeto desta proposta é de R$ 427.998,20 "
    "(quatrocentos e vinte e sete mil, novecentos e noventa e oito reais e vinte "
    "centavos), assim distribuídos:"
)

_CRONOGRAMA_ADITIVO_ABSOLUTO = (
    "TOTAL 2.139.991,00 417.984,00 56.290,53 1.718.842,37 4.333.107,90"
)


def test_variante_valor_principal_e_cronograma_concordando_dao_o_valor() -> None:
    texto = _PROSA_VALOR_PRINCIPAL + "\n" + _CRONOGRAMA_HSPM

    assert _extrator()._total_por_convergencia(texto) == Decimal("963333.48")


def test_variante_valor_total_dos_servicos_com_dimensionamento_da_o_valor() -> None:
    texto = _PROSA_VALOR_TOTAL_E_DIMENSIONAMENTO + "\n" + _CRONOGRAMA_990

    assert _extrator()._total_por_convergencia(texto) == Decimal("990535.00")


def test_variante_so_a_frase_nao_basta() -> None:
    """A regra da `T-2640b` vale para as variantes: uma fonte só não fecha."""
    assert _extrator()._total_por_convergencia(_PROSA_VALOR_PRINCIPAL) is None


def test_variante_discordando_do_cronograma_nao_produz_valor() -> None:
    """A regra da `T-2640c`/`T-2640d` vale para as variantes.

    Se este teste passar a devolver valor, a variante virou "uma fonte basta" e
    o aditivo passaria a declarar o total absoluto do contrato como se fosse o
    seu — o defeito que a ESPEC 042 existe para não introduzir.
    """
    texto = _PROSA_ADITIVO + "\n" + _CRONOGRAMA_ADITIVO_ABSOLUTO

    assert _extrator()._total_por_convergencia(texto) is None


def test_variante_nao_toma_o_lugar_da_frase_original() -> None:
    """A frase original vale primeiro. Um "valor principal … é de R$" que apareça
    antes dela, no mesmo documento, não pode mudar o número que já era lido."""
    texto = (
        "O valor principal dos serviços, objeto desta proposta, é de R$ 100,00.\n"
        + _PROSA_CGM
        + "\n"
        + _CRONOGRAMA_CGM
    )

    assert _extrator()._total_por_convergencia(texto) == Decimal("5532203.96")


def test_variante_nao_liga_a_frase_a_um_e_de_de_outro_paragrafo() -> None:
    """A janela de 80 caracteres: "serviços" no começo e um "é de R$" lá longe
    não formam a frase."""
    texto = (
        "O valor total dos serviços será medido mensalmente conforme o anexo técnico "
        "e as condições de atendimento descritas nas seções anteriores desta "
        "proposta comercial. Já o reajuste previsto é de R$ 1.000,00.\n"
        "TOTAL 1.000,00"
    )

    assert _extrator()._total_por_convergencia(texto) is None


# ── T-2641 · Sobre o documento real ───────────────────────────────────────────


def test_t2641_contrato_cgm_fecha_o_total_declarado(caminho_contrato_cgm: Path) -> None:
    extrator = _extrator()

    contrato = extrator.extrair(caminho_contrato_cgm)

    assert contrato.total_declarado == Decimal("5532203.96")
