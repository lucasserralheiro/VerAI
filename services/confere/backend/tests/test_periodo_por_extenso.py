"""T-2608 a T-2610 / ESPEC 040 — o período escrito por extenso, e o que ele não é.

`10.050.00001.00` tem, na tabela de preços da proposta, uma segunda linha cuja
coluna de período traz `2 meses e 14 dias` — a cauda de um contrato que não
fecha em mês cheio. `para_decimal` não sabe ler isso, e `_montar_item` bloqueava
a extração inteira por causa de um campo que nenhum consumidor do backend lê
(ESPEC 040 §2.2).

A maior parte deste módulo não abre PDF nenhum: `_montar_item` é exercitada
com listas de célula construídas à mão, no espírito de `T-13` da ESPEC 033
sobre `para_decimal`. O PDF real entra só para as duas asserções que precisam
ser sobre o documento que originou a espec — a mensagem que some, e a que
aparece no lugar dela (`I-04`).
"""

from __future__ import annotations

from dataclasses import replace
from decimal import Decimal
from pathlib import Path

import pytest
from conftest import FontesCaras, _ContainerComFontesEmCache

from domain.entities.contract import Contract
from domain.entities.contract_item import ContractItem
from domain.entities.validation_finding import Severity, ValidationReport
from domain.errors import ExtractionError
from domain.value_objects.service_code import ServiceCode
from infrastructure.contract.pdfplumber_extractor import PdfPlumberContractExtractor
from infrastructure.di.container import Entradas
from infrastructure.validations.contract_validations import (
    v_ctr_07_periodo_nao_numerico,
)


def _linha(
    codigo: str = "10.050.00001.00",
    descricao: str = "ESPECIALISTA /ANALISTA DE SISTEMA DE INFORMAÇÃO",
    unidade: str = "HORA/HOMEM",
    preco: str = "217,70",
    quantidade: str = "100",
    meses: str = "9",
    total: str = "21.770,00",
) -> list[str]:
    """Uma linha de item completa, na ordem `COL_*` de `pdfplumber_extractor.py`."""
    return [codigo, descricao, unidade, preco, quantidade, meses, total]


# ── T-2608 · Os seis casos de `_montar_item` ──────────────────────────────────


def test_t2608a_celula_de_meses_limpa_nao_muda() -> None:
    """(a) — o caminho comum, que esta entrega não pode mexer."""
    extrator = PdfPlumberContractExtractor()

    item = extrator._montar_item(_linha(meses="9"), "10.050.00001.00", 10)

    assert item.meses == 9
    assert item.meses_bruto is None


def test_t2608b_celula_em_prosa_nao_bloqueia_mais() -> None:
    """(b) — o caso novo. `R-MES-01`."""
    extrator = PdfPlumberContractExtractor()

    item = extrator._montar_item(
        _linha(meses="2 meses e 14 dias"), "10.050.00001.00", 10
    )

    assert item.meses is None
    assert item.meses_bruto == "2 meses e 14 dias"
    assert item.quantidade == Decimal("100")
    assert item.preco_unitario == Decimal("217.70")
    assert item.total_declarado == Decimal("21770.00")


def test_t2608c_preco_ausente_continua_bloqueando() -> None:
    """(c) — `R-MES-02`: os três campos do checksum não mudam."""
    extrator = PdfPlumberContractExtractor()

    with pytest.raises(ExtractionError, match="sem preço unitário"):
        extrator._montar_item(_linha(preco=""), "10.050.00001.00", 10)


def test_t2608d_quantidade_ausente_continua_bloqueando() -> None:
    """(d) — `R-MES-02`."""
    extrator = PdfPlumberContractExtractor()

    with pytest.raises(ExtractionError, match="sem quantidade"):
        extrator._montar_item(_linha(quantidade=""), "10.050.00001.00", 10)


def test_t2608e_total_ausente_continua_bloqueando() -> None:
    """(e) — `R-MES-02`."""
    extrator = PdfPlumberContractExtractor()

    with pytest.raises(ExtractionError, match="sem valor total"):
        extrator._montar_item(_linha(total=""), "10.050.00001.00", 10)


def test_t2608g_celula_vazia_nao_e_confundida_com_prosa() -> None:
    """(g) — achado do code review: `_limpar('')` é `''`, não `None`.

    Célula vazia é ausência, não texto; sem este cuidado, o aviso de
    `V-CTR-07` sairia dizendo "texto extraído: ''", que não ajuda quem confere.
    """
    extrator = PdfPlumberContractExtractor()

    item = extrator._montar_item(_linha(meses=""), "10.050.00001.00", 10)

    assert item.meses is None
    assert item.meses_bruto is None


def test_t2608f_meses_e_preco_ausentes_cita_so_preco() -> None:
    """(f) — `meses` não entra mais na lista `faltando`, nem acompanhado."""
    extrator = PdfPlumberContractExtractor()

    with pytest.raises(ExtractionError) as excinfo:
        extrator._montar_item(
            _linha(preco="", meses="2 meses e 14 dias"), "10.050.00001.00", 10
        )

    mensagem = str(excinfo.value)
    assert "preço unitário" in mensagem
    assert "meses" not in mensagem


# ── T-2609 · A mensagem sobre o documento real ────────────────────────────────


def test_t2609_i04_fechado_pela_espec_041(caminho_contrato_cgm: Path) -> None:
    """`I-04` — fechado pela ESPEC 041 (`R-FXA-09`), não por esta.

    Até a ESPEC 041, `10.050.00001.00` deixava de bloquear a extração do
    `PC-CGM-240603-82` (`R-MES-01`) e a mesma página derrubava a extração de
    novo em `14.023.00002.00` — outra linha de escopo, lida pela geometria da
    tabela de preços via `R-FXA-04` (ESPEC 033). A `R-FXA-09` fechou essa
    lacuna: a linha só é lida pela geometria da página quando os traços dela
    pertencem à união das geometrias que o documento usa para item.

    A cobertura detalhada mora em `test_regua_da_tabela_errada.py`; este teste
    fica como o registro, no módulo da 040, de que o `I-04` que ela abriu está
    fechado — não mais reproduzido aqui em duplicidade.
    """
    extrator = PdfPlumberContractExtractor()

    contrato = extrator.extrair(caminho_contrato_cgm)

    assert not any(
        item.codigo.valor == "14.023.00002.00" and item.pagina == 10
        for item in contrato.itens
    )


# ── T-2616 · `V-CTR-07`, sem PDF nenhum ───────────────────────────────────────


def _item(codigo: str = "10.050.00001.00", **overrides: object) -> ContractItem:
    base: dict[str, object] = {
        "codigo": ServiceCode(codigo),
        "descricao": "ESPECIALISTA /ANALISTA DE SISTEMA DE INFORMAÇÃO",
        "unidade": "HORA/HOMEM",
        "quantidade": Decimal("100"),
        "preco_unitario": Decimal("217.70"),
        "meses": 9,
        "total_declarado": Decimal("21770.00"),
        "pagina": 10,
    }
    base.update(overrides)
    return ContractItem(**base)  # type: ignore[arg-type]


def test_t2616_meses_none_dispara_aviso_com_codigo_pagina_e_texto() -> None:
    achados = ValidationReport()
    contrato = Contract(
        proposta="PA-CONSTRUIDA",
        itens=[_item(meses=None, meses_bruto="2 meses e 14 dias")],
    )

    v_ctr_07_periodo_nao_numerico(contrato, achados)

    assert [a.validacao for a in achados.achados] == ["V-CTR-07"]
    achado = achados.achados[0]
    assert achado.severidade is Severity.AVISA
    assert "10.050.00001.00" in achado.mensagem
    assert "página 10" in achado.mensagem
    assert "2 meses e 14 dias" in achado.mensagem


def test_t2616_meses_preenchido_nao_dispara() -> None:
    achados = ValidationReport()
    contrato = Contract(proposta="PA-CONSTRUIDA", itens=[_item(meses=12)])

    v_ctr_07_periodo_nao_numerico(contrato, achados)

    assert achados.achados == []


def test_t2616_contrato_sem_itens_nao_dispara() -> None:
    achados = ValidationReport()
    contrato = Contract(proposta="PA-CONSTRUIDA", itens=[])

    v_ctr_07_periodo_nao_numerico(contrato, achados)

    assert achados.achados == []


# ── T-2622 · A validação está de fato ligada ao container ────────────────────
#
# Achado do code review: `v_ctr_07_periodo_nao_numerico` existia e passava
# isolada (T-2616) sem uma linha em `container.py` chamando-a — a mesma classe
# de lacuna que `test_v_ctr_05_dispara_pelo_container_com_medicao_lida`
# (test_reconciliation.py) guarda para `V-CTR-05`. Este teste é o que teria
# reprovado antes da lacuna chegar ao usuário.


def test_t2622_v_ctr_07_dispara_pelo_container_completo(
    fontes_caras: FontesCaras, caminho_contrato: Path, caminho_levantamento: Path
) -> None:
    alvo = fontes_caras.contrato.itens[0]
    mutado = replace(alvo, meses=None, meses_bruto="2 meses e 14 dias")
    itens = [mutado if item is alvo else item for item in fontes_caras.contrato.itens]
    blocos = tuple(
        replace(
            bloco,
            itens=tuple(mutado if item is alvo else item for item in bloco.itens),
        )
        for bloco in fontes_caras.contrato.blocos
    )
    contrato_mutado = replace(fontes_caras.contrato, itens=itens, blocos=blocos)
    fontes_mutadas = replace(fontes_caras, contrato=contrato_mutado)

    resultado = _ContainerComFontesEmCache(fontes_mutadas).gerar(
        Entradas(contrato=caminho_contrato, levantamento=caminho_levantamento)
    )

    assert not resultado.achados.bloqueado
    assert alvo.codigo.valor in [
        a.codigo for a in resultado.achados.avisos if a.validacao == "V-CTR-07"
    ]
