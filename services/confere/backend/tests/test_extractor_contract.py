"""T-23 — Testes de integração do extrator do contrato. Encerra o portão P2.

Rodam contra o PDF real. As asserções são nominais: citam os itens que as
abordagens anteriores perdiam, para que uma regressão apareça pelo nome e não
como um número agregado que mudou.
"""

from __future__ import annotations

from decimal import Decimal
from pathlib import Path

import pytest

from domain.entities.contract import Contract
from domain.entities.validation_finding import ValidationReport
from infrastructure.contract.pdfplumber_extractor import PdfPlumberContractExtractor
from infrastructure.validations.contract_validations import (
    v_ctr_01_tabela_localizada,
    v_ctr_03_checksum,
)

TOTAL_DECLARADO = Decimal("10637425.00")


@pytest.fixture(scope="module")
def contrato(caminho_contrato: Path) -> Contract:
    return PdfPlumberContractExtractor().extrair(caminho_contrato)


# ── Cobertura da extração ─────────────────────────────────────────────────────


def test_checksum_confere_com_o_total_declarado(contrato: Contract) -> None:
    """Prova de ponta a ponta: nenhuma linha se perdeu (PLANO 001 D-03)."""
    assert contrato.total_declarado == TOTAL_DECLARADO
    assert contrato.soma_dos_totais == TOTAL_DECLARADO


def test_todas_as_linhas_de_item_foram_extraidas(contrato: Contract) -> None:
    assert len(contrato.itens) == 60
    assert len(contrato.codigos) == 57


def test_itens_perdidos_pela_extracao_por_tabela(contrato: Contract) -> None:
    """`extract_tables()` perde estes dois: são a última linha de sua página,
    abaixo da última borda horizontal da moldura (ESPEC 001 §9.4)."""
    assert contrato.quantidade_para("12.074.00005.00") == Decimal("9")
    assert contrato.quantidade_para("14.048.00008.00") == Decimal("1")


def test_todo_item_tem_os_quatro_campos(contrato: Contract) -> None:
    for item in contrato.itens:
        assert item.descricao, f"{item.codigo} sem descrição"
        assert item.unidade, f"{item.codigo} sem unidade"
        assert item.quantidade is not None
        assert item.total_declarado is not None


# ── R-CTR-02 · soma e desdobramento ───────────────────────────────────────────


def test_codigo_repetido_sem_qualificador_e_somado(contrato: Contract) -> None:
    """`10.050.00001.00` ocupa três linhas: 300 + 4.000 + 480."""
    assert len(contrato.itens_de("10.050.00001.00")) == 3
    assert contrato.quantidade_para("10.050.00001.00") == Decimal("4780")


def test_codigo_repetido_com_qualificador_nao_soma(contrato: Contract) -> None:
    """A Plataforma de BI rende duas linhas de 1, IT0101 e SG0721."""
    assert len(contrato.itens_de("14.025.00011.00")) == 2
    assert contrato.quantidade_para("14.025.00011.00", "IT0101") == Decimal("1")
    assert contrato.quantidade_para("14.025.00011.00", "SG0721") == Decimal("1")
    assert contrato.quantidade_para("14.025.00011.00") == Decimal("2")


def test_qualificador_inexistente_nao_resolve(contrato: Contract) -> None:
    assert contrato.quantidade_para("14.025.00011.00", "XX0000") is None


def test_codigo_ausente_devolve_nada(contrato: Contract) -> None:
    assert contrato.quantidade_para("99.999.99999.99") is None


# ── R-CTR-01 · quantidades e descrições ───────────────────────────────────────


@pytest.mark.parametrize(
    ("codigo", "esperado"),
    [
        ("11.027.00001.00", "10"),   # divergente do modelo, que grafa 6 — I-01
        ("12.030.00001.00", "60"),   # reduzido pelo aditivo, de 130 para 60
        ("14.070.00001.00", "120"),  # aumentado pelo aditivo, de 107 para 120
        ("14.023.00002.00", "1500"),
        ("14.024.00005.00", "3500"),
        ("14.024.00006.00", "4000"),
        ("12.055.00002.00", "30"),
        ("14.049.00039.00", "9"),
    ],
)
def test_quantidades_conferem_com_o_contrato(
    contrato: Contract, codigo: str, esperado: str
) -> None:
    assert contrato.quantidade_para(codigo) == Decimal(esperado)


def test_descricao_vem_integra_das_celulas_multilinha(contrato: Contract) -> None:
    """A descrição ocupa de três a cinco linhas de texto, com o código no meio."""
    descricao = contrato.descricao_para("12.029.00021.00") or ""
    assert descricao.startswith("SOLUÇÃO DE ACESSO A REDE CORPORATIVA PMSP - 8192 KBPS")
    assert descricao.endswith("(PARA CONTRATAÇÕES DE 1 A 500 ACESSOS POR CLIENTE)")


def test_unidade_e_lida(contrato: Contract) -> None:
    item = contrato.itens_de("14.049.00037.00")[0]
    assert item.unidade == "SERVIDOR/MÊS"


def test_proposta_de_origem_e_identificada(contrato: Contract) -> None:
    """Vai para o rodapé do relatório (ESPEC 001 R-CTR-05)."""
    assert contrato.proposta == "PA-SMIT-260319-739"


# ── Validações ────────────────────────────────────────────────────────────────


def test_v_ctr_01_aceita_contrato_com_itens(contrato: Contract) -> None:
    achados = ValidationReport()
    v_ctr_01_tabela_localizada(contrato, achados)
    assert not achados.bloqueado


def test_v_ctr_01_bloqueia_contrato_vazio() -> None:
    achados = ValidationReport()
    v_ctr_01_tabela_localizada(Contract(proposta="X"), achados)
    assert achados.bloqueado


def test_v_ctr_03_aceita_checksum_correto(contrato: Contract) -> None:
    achados = ValidationReport()
    v_ctr_03_checksum(contrato, achados)
    assert not achados.bloqueado


def test_v_ctr_03_bloqueia_quando_falta_uma_linha(contrato: Contract) -> None:
    """Guarda contra o modo de falha que motivou o checksum."""
    mutilado = Contract(
        proposta=contrato.proposta,
        total_declarado=contrato.total_declarado,
        itens=contrato.itens[:-1],
    )
    achados = ValidationReport()
    v_ctr_03_checksum(mutilado, achados)
    assert achados.bloqueado
    assert "extração incompleta" in achados.bloqueantes[0].mensagem


def test_v_ctr_03_bloqueia_sem_total_declarado(contrato: Contract) -> None:
    achados = ValidationReport()
    v_ctr_03_checksum(Contract(proposta="X", itens=contrato.itens), achados)
    assert achados.bloqueado


# ── V-CTR-02 · o catálogo resolve inteiro no contrato ─────────────────────────


