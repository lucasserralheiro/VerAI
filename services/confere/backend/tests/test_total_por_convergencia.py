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


# ── T-2641 · Sobre o documento real ───────────────────────────────────────────


def test_t2641_contrato_cgm_fecha_o_total_declarado(caminho_contrato_cgm: Path) -> None:
    extrator = _extrator()

    contrato = extrator.extrair(caminho_contrato_cgm)

    assert contrato.total_declarado == Decimal("5532203.96")
