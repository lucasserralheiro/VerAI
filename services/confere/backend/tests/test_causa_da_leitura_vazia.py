"""T-2027 e T-2028 — ESPEC 027 `[portão P2]`: os degraus da causa de `V-MED-01`.

Sobre `DiagnosticoDaAba` construído à mão, sem abrir arquivo nenhum — é o
espírito da `D-04` da ESPEC 025, aplicado ao lado da medição. Inclui o
degrau 1 (aba vazia), para o qual o repositório não tem fixture.
"""

from __future__ import annotations

from pathlib import Path

from domain.entities.measurement import DiagnosticoDaAba, Measurement
from domain.entities.validation_finding import ValidationReport
from infrastructure.di.container import DIContainer, Entradas
from infrastructure.validations.measurement_validations import (
    CausaDaLeituraVazia,
    causa_da_leitura_vazia,
    v_med_01_aba_reconhecida,
)


def test_degrau_1_aba_vazia() -> None:
    """Nenhuma linha preenchida — o degrau que não tem fixture real."""
    diagnostico = DiagnosticoDaAba(
        linhas_preenchidas=0, colunas_lidas=5, codigos_por_coluna={}
    )
    assert causa_da_leitura_vazia(diagnostico) is CausaDaLeituraVazia.ABA_VAZIA


def test_degrau_2_coluna_deslocada() -> None:
    diagnostico = DiagnosticoDaAba(
        linhas_preenchidas=12, colunas_lidas=5, codigos_por_coluna={8: 74}
    )
    assert causa_da_leitura_vazia(diagnostico) is CausaDaLeituraVazia.CODIGO_DESLOCADO


def test_degrau_2_com_empate_nomeia_a_maior() -> None:
    """T-2028 — o empate: uma implementação ingênua pegaria a primeira (C)."""
    achados = ValidationReport()
    diagnostico = DiagnosticoDaAba(
        linhas_preenchidas=80, colunas_lidas=5, codigos_por_coluna={3: 1, 8: 74}
    )
    v_med_01_aba_reconhecida(
        Measurement(diagnostico=diagnostico), achados, nome_do_arquivo=""
    )
    (achado,) = achados.bloqueantes
    assert "coluna H" in achado.causa
    assert "coluna C" not in achado.causa


def test_degrau_3_sem_codigo_algum() -> None:
    diagnostico = DiagnosticoDaAba(
        linhas_preenchidas=312, colunas_lidas=5, codigos_por_coluna={}
    )
    assert causa_da_leitura_vazia(diagnostico) is CausaDaLeituraVazia.SEM_CODIGO


def test_sem_diagnostico_causa_e_none() -> None:
    """A chamada direta, fora do fluxo do leitor — `R-GRD-06` mantida."""
    assert causa_da_leitura_vazia(None) is None


# ── T-2028 · o degrau 2 nomeia a coluna, ponta a ponta ────────────────────────


def test_o_degrau_2_nomeia_a_coluna_pelo_gerar_completo(
    caminho_contrato: Path, caminho_codigos_deslocados: Path
) -> None:
    """`[portão P2]` — a única informação **nova** que a ESPEC 027 produz.

    Ponta a ponta, sobre a fixture real de códigos deslocados (coluna H),
    passando pelo `gerar()` completo — não só pela função pura.
    """
    resultado = DIContainer().gerar(
        Entradas(contrato=caminho_contrato, levantamento=caminho_codigos_deslocados)
    )
    (achado,) = resultado.achados.bloqueantes
    assert achado.validacao == "V-MED-01"
    assert "coluna H" in achado.causa
