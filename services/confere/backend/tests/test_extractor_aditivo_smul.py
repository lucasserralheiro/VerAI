"""T-2202 a T-2204 / ESPEC 033 — o aditivo do SMUL, e o que não pode se mover.

O `PA-SMUL-250314-22` é o quarto documento de contratação da suíte e o **único**
com três tabelas de itens de larguras diferentes na mesma folha. Antes desta
espec ele não era lido: a extração levantava `ExtractionError` na primeira linha
do bloco `Redução`, e a submissão inteira virava `422`.

A `T-2204` é a metade que importa deste módulo. Ela não afirma nada sobre o
SMUL: afirma que **nenhum dos documentos que já funcionavam se moveu**, por
igualdade do conjunto de itens. É a régua que separa *"corrigi o SMUL"* de
*"corrigi o SMUL sem quebrar o resto"*.
"""

from __future__ import annotations

import hashlib
import json
from decimal import Decimal
from pathlib import Path

import pytest

from domain.entities.contract import Contract
from domain.entities.validation_finding import Severity, ValidationReport
from domain.value_objects.block_label import RotuloDeBloco
from infrastructure.contract.pdfplumber_extractor import PdfPlumberContractExtractor
from infrastructure.validations.contract_validations import v_ctr_03_checksum

# Os três blocos do `PA-SMUL-250314-22`, medidos no PDF (ESPEC 033 §2.1).
INCLUSAO = Decimal("1304002.55")
REDUCAO = Decimal("-986810.00")
AUMENTO = Decimal("47601.38")

# A página 3 declara: "é de R$ 364.793,93 (…) para o período de 5 meses".
MOVIMENTADO = Decimal("364793.93")


@pytest.fixture(scope="module")
def aditivo_smul(caminho_aditivo_smul: Path) -> Contract:
    return PdfPlumberContractExtractor().extrair(caminho_aditivo_smul)


# ── T-2202 · A linha que quebrava a extração ──────────────────────────────────


def test_t2202_a_linha_da_reducao_sai_com_os_quatro_valores(
    aditivo_smul: Contract,
) -> None:
    """`R-FXA-08` — o `12.030.00002.00`, item único do bloco `Redução`.

    É a linha da mensagem que originou a espec: *"sem preço unitário, meses"*.
    Os quatro valores por extenso, porque é o conjunto deles que a grade errada
    embaralhava — preço e quantidade fundidos numa célula, `BRL -` em meses.
    """
    item = next(i for i in aditivo_smul.itens if str(i.codigo) == "12.030.00002.00")

    assert item.quantidade == Decimal("-200.00")
    assert item.preco_unitario == Decimal("986.81")
    assert item.meses == 5
    assert item.total_declarado == Decimal("-986810.00")
    assert item.pagina == 4


def test_t2202_a_reducao_e_negativa_nas_duas_pontas(aditivo_smul: Contract) -> None:
    """`R-NUM-01` — o total com o sinal separado do número.

    No PDF a célula traz três tokens: `BRL`, `-` e `986.810,00`. Sem a
    normalização do sinal, `Decimal('- 986810.00')` levanta `InvalidOperation` e
    o item é recusado por *"sem valor total"* — o segundo defeito, independente
    da grade (ESPEC 033 §2.6).

    A quantidade `-200,00` vem colada e sempre foi lida; é o contraste que mostra
    que a variação é de composição, dentro do mesmo documento.
    """
    item = next(i for i in aditivo_smul.itens if str(i.codigo) == "12.030.00002.00")

    assert item.quantidade < 0
    assert item.total_declarado < 0
    assert item.quantidade * item.preco_unitario * item.meses == item.total_declarado


# ── T-2203 · Os três blocos ───────────────────────────────────────────────────


def test_t2203_os_tres_blocos_saem_com_rotulo_contagem_e_total(
    aditivo_smul: Contract,
) -> None:
    """`R-ADT-01` — e o modo de falha que só este teste pega.

    Sem a herança de `R-FXA-03`, a linha `Redução TOTAL:` não é lida e o bloco
    não fecha: os seus itens ficam pendentes e saem no bloco seguinte, sob o
    rótulo `Aumento`. Seriam **quatro** itens no `Aumento` e nenhum bloco
    `Redução` — com o checksum ainda fechando, porque nenhum item se perde.

    É o defeito silencioso desta espec, e a asserção que o denuncia é o rótulo,
    não o total.
    """
    assert [
        (bloco.rotulo, len(bloco.itens), bloco.total_declarado)
        for bloco in aditivo_smul.blocos
    ] == [
        (RotuloDeBloco.INCLUSAO, 12, INCLUSAO),
        (RotuloDeBloco.REDUCAO, 1, REDUCAO),
        (RotuloDeBloco.AUMENTO, 3, AUMENTO),
    ]


def test_t2203_o_checksum_fecha_no_valor_impresso_na_peca(
    aditivo_smul: Contract,
) -> None:
    """`V-CTR-03` — e o oráculo não é o código.

    `364.793,93` é o que a própria proposta declara movimentar. A soma dos 16
    itens tem de chegar nele por conta própria, e os três blocos também:
    `1.304.002,55 − 986.810,00 + 47.601,38`.
    """
    achados = ValidationReport()
    v_ctr_03_checksum(aditivo_smul, achados)

    assert len(aditivo_smul.itens) == 16
    assert INCLUSAO + REDUCAO + AUMENTO == MOVIMENTADO
    assert aditivo_smul.total_declarado == MOVIMENTADO
    assert aditivo_smul.soma_dos_totais == MOVIMENTADO
    assert not [a for a in achados.achados if a.severidade is Severity.BLOQUEIA]


def test_t2203_as_quatro_geometrias_da_pagina_4_nao_duplicam_itens(
    aditivo_smul: Contract,
) -> None:
    """`R-ADT-12` — a mesma linha física alcançada por quatro geometrias.

    Com as divisórias por linha, as quatro geometrias admitidas passam a produzir
    células **idênticas** para a mesma linha, e a `linhas_vistas` as reduz a uma.
    Antes elas produziam quatro fatiamentos diferentes, e nenhum deduplicava.
    """
    codigos = [str(item.codigo) for item in aditivo_smul.itens]

    assert len(codigos) == len(set(codigos))


# ── T-2204 · A régua: nenhum documento que já funcionava se moveu ─────────────

# O `sha256` da lista de tuplas `(código, descrição, unidade, quantidade, preço,
# meses, total, página)` de **todos** os itens da peça, medido na `T-2197` —
# antes de uma linha de código desta espec.
#
# **As três primeiras fixtures são byte a byte os arquivos de `docs/documentos/`**
# (`PA-SMIT-260319-739`, `PA-PGM-251015-159`, `PA-PGM-260304-715`), conferido por
# `sha256` do arquivo. As dez linhas da ESPEC §8.2 são estas seis, com quatro
# repetições — a repetição vale como prova na espec e seria ruído aqui.
REGUA = {
    "contrato.pdf": (60, "10637425.00", 1, 1, "430e506cb76292f5"),
    "contrato_pgm.pdf": (47, "24551037.72", 1, 1, "b8a7117b631604f1"),
    "aditivo_pgm.pdf": (7, "-0.12", 3, 3, "0e7ec8ef5ddcc631"),
    "modelo.pdf": (0, "None", 0, 0, "4f53cda18c2baa0c"),
    "amostra_sem_tabela.pdf": (0, "None", 0, 0, "4f53cda18c2baa0c"),
    "contrato_smul.pdf": (41, "27415244.95", 1, 1, "6d0df30694ee2521"),
}


def _medida(caminho: Path) -> tuple[int, str, int, int, str]:
    """O mesmo que `scripts/medir_extracao.py` imprime, para a mesma peça."""
    import pdfplumber

    from infrastructure.contract.grid import analisar_geometria

    extrator = PdfPlumberContractExtractor()
    with pdfplumber.open(caminho) as pdf:
        admitidas = len(extrator._geometrias_de_itens(pdf, analisar_geometria(pdf)))

    contrato = extrator.extrair(caminho)
    tuplas = [
        [
            str(item.codigo),
            item.descricao,
            item.unidade,
            str(item.quantidade),
            str(item.preco_unitario),
            str(item.meses),
            str(item.total_declarado),
            item.pagina,
        ]
        for item in contrato.itens
    ]
    return (
        len(tuplas),
        str(contrato.total_declarado),
        len(contrato.blocos),
        admitidas,
        hashlib.sha256(json.dumps(tuplas, ensure_ascii=False).encode()).hexdigest()[:16],
    )


@pytest.mark.parametrize("nome", sorted(REGUA))
def test_t2204_nenhum_documento_que_ja_extraia_se_moveu(nome: str) -> None:
    """`R-FXA-07` — a régua desta entrega, e ela **passa antes do código**.

    Igualdade do **conjunto**, e não de amostra: o defeito que esta espec previne
    é uma linha fatiada com as divisórias erradas, e ele não apareceria no item
    que alguém escolhesse conferir.

    O número de geometrias admitidas entra na mesma asserção de propósito — é a
    `R-FXA-06` virando teste. Se alguém aplicar a leitura por faixa também ao
    crivo de admissão, **todas** as candidatas passam a ser admitidas, e este
    teste é um dos três que reprovam.
    """
    fixtures = Path(__file__).parent / "fixtures"

    assert _medida(fixtures / nome) == REGUA[nome]
