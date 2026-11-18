"""18/11/2026 — a `TOTAL:` de uma seção, numa página sem tabela de item nenhuma.

Achado no `PC-SP REGULA-260526-821` (TC 07/SPREGULA/2026): a seção "E - DATA
CENTER" fecha com `TOTAL: BRL\n1.184.353,44` no topo da página 6, e nenhuma
geometria de item casa ali — a página só tem essa linha solta e, abaixo, o
Cronograma Físico-Financeiro (outra tabela, outra geometria). A busca normal
por `TOTAL:` (`_total_declarado`) só lê célula de grade — essa linha nunca é
vista, e `total_declarado` para nos `55.020,00` da seção A enquanto
`soma_dos_totais` soma as duas seções certas (`1.239.373,44`). `V-CTR-03`
bloqueava um documento cuja extração de itens estava certa.

Mesma marca de sempre (`_MARCA_TOTAL`), lida fora de célula — é o análogo, pro
total, do que `cauda_da_pagina` já faz pra descrição cortada entre páginas.
"""

from __future__ import annotations

from decimal import Decimal
from pathlib import Path

from infrastructure.contract.pdfplumber_extractor import (
    PdfPlumberContractExtractor,
    _total_orfao_do_texto,
)


def test_total_com_brl_e_quebra_de_linha_antes_do_valor() -> None:
    """A forma real: `TOTAL:` e `BRL` numa linha, o valor na próxima."""
    texto = "E - DATA CENTER TOTAL: BRL\n1.184.353,44\nOs códigos dos serviços..."

    assert _total_orfao_do_texto(texto) == Decimal("1184353.44")


def test_total_sem_brl() -> None:
    assert _total_orfao_do_texto("A - SISTEMAS TOTAL: 55.020,00") == Decimal("55020.00")


def test_pagina_sem_total_nenhum_devolve_none() -> None:
    assert _total_orfao_do_texto("Cronograma Físico Financeiro\nMês 01 ...") is None


# ── Sobre o documento real ────────────────────────────────────────────────────


def test_contrato_spregula_fecha_o_total_declarado(caminho_contrato_spregula: Path) -> None:
    """A extração de itens já estava certa; só o total declarado ficava curto.

    `soma_dos_totais` é a prova independente: soma as duas seções que a tabela
    de itens realmente leu, e fecha com o mesmo `1.239.373,44` que a frase em
    prosa e o Cronograma Físico-Financeiro da página 6 declaram (checado à mão
    contra o PDF). Se a `TOTAL:` órfã da seção E não for resgatada,
    `total_declarado` para nos `55.020,00` da seção A e este teste falha com a
    soma dando `1239373.44` contra um `total_declarado` de `55020.00`.
    """
    contrato = PdfPlumberContractExtractor().extrair(caminho_contrato_spregula)

    assert contrato.total_declarado == Decimal("1239373.44")
    assert contrato.soma_dos_totais == Decimal("1239373.44")


def test_contrato_spregula_tem_as_duas_secoes(caminho_contrato_spregula: Path) -> None:
    contrato = PdfPlumberContractExtractor().extrair(caminho_contrato_spregula)

    # 2 itens da seção A + 5 da seção E, na ordem do documento.
    assert len(contrato.itens) == 7
    assert str(contrato.itens[0].codigo) == "10.050.00065.00"
    assert str(contrato.itens[-1].codigo) == "14.024.00005.00"
