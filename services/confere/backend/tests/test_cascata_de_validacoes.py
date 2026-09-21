"""T-1118 a T-1123 — A cascata, o diagnóstico e o aviso de geometria (ESPEC 017).

Quando o `PA-PGM` foi submetido, a tela mostrou **57** achados: um `V-CTR-01`,
um `V-CTR-03` e 55 `V-CTR-02`, um por entrada visível do catálogo. Havia um
defeito, e 56 das mensagens eram consequência aritmética dele.

Depois da ESPEC 018 a cascata não tem como voltar: a `V-CTR-02` deixou de
existir junto com o catálogo. O que sobra a exercitar é a guarda de `R-GRD-06`
e o diagnóstico de `R-GRD-07`, que continuam valendo.
"""

from __future__ import annotations

import pytest

from domain.entities.contract import Contract, DiagnosticoDaGrade
from domain.entities.validation_finding import Severity, ValidationReport
from infrastructure.contract.grid import COLUNAS_DA_TABELA
from infrastructure.validations.contract_validations import (
    v_ctr_01_tabela_localizada,
    v_ctr_03_checksum,
    v_ctr_04_geometria_nao_canonica,
)

GABARITO_DO_PGM = (51.4, 122.3, 273.0, 353.6, 404.3, 445.3, 491.1, 551.5)


def _diagnostico(gabarito: tuple[float, ...] | None) -> DiagnosticoDaGrade:
    return DiagnosticoDaGrade(
        paginas=32,
        paginas_com_borda=6,
        maior_numero_de_divisorias=15,
        paginas_com_texto=32,
        gabarito=gabarito,
    )


def _validar_como_o_orquestrador(contrato: Contract) -> ValidationReport:
    """Reproduz a ordem e a guarda de `DIContainer.gerar` (`R-GRD-06`).

    O container lê três arquivos antes de chegar aqui. Reproduzir só o trecho
    das validações é o que torna o teste barato — e a guarda é justamente o que
    se quer exercitar.
    """
    achados = ValidationReport()
    v_ctr_01_tabela_localizada(contrato, achados)
    if contrato.itens:
        v_ctr_03_checksum(contrato, achados)
        v_ctr_04_geometria_nao_canonica(contrato, achados)
    return achados


# ── T-1118 · Um achado, e um só ───────────────────────────────────────────────


def test_t1118_contrato_ilegivel_produz_um_achado() -> None:
    """`R-GRD-06` — a tela relata a causa, não a consequência.

    Eram 57 achados. A guarda derrubou 56; a ESPEC 018 removeu a validação que
    os produzia, e agora sobra **um** por construção, não por contenção.
    """
    achados = _validar_como_o_orquestrador(Contract(proposta="X"))

    assert len(achados.bloqueantes) == 1
    assert achados.bloqueantes[0].validacao == "V-CTR-01"


def test_t1121_a_mensagem_de_v_ctr_01_traz_o_diagnostico() -> None:
    """`R-GRD-07` — PDF digitalizado, layout novo e arquivo errado davam o mesmo texto."""
    contrato = Contract(proposta="X", diagnostico=_diagnostico(None))

    achados = ValidationReport()
    v_ctr_01_tabela_localizada(contrato, achados)

    mensagem = achados.bloqueantes[0].mensagem
    assert "32 páginas" in mensagem
    assert "6 com borda desenhada" in mensagem
    assert "15 divisórias" in mensagem


def test_t1121_sem_diagnostico_a_mensagem_e_a_de_sempre() -> None:
    """Contratos construídos à mão não têm diagnóstico, e não podem quebrar."""
    achados = ValidationReport()
    v_ctr_01_tabela_localizada(Contract(proposta="X"), achados)

    assert achados.bloqueantes[0].mensagem.endswith("proposta comercial completa")


# ── T-1123 · O aviso de geometria ─────────────────────────────────────────────


def test_t1123_v_ctr_04_ausente_na_geometria_de_referencia() -> None:
    """A asserção que importa: disparar no piloto significaria que a T-1112 mentiu."""
    contrato = Contract(proposta="X", diagnostico=_diagnostico(COLUNAS_DA_TABELA))

    achados = ValidationReport()
    v_ctr_04_geometria_nao_canonica(contrato, achados)

    assert achados.achados == []


def test_t1123_v_ctr_04_presente_na_geometria_do_pgm() -> None:
    contrato = Contract(proposta="X", diagnostico=_diagnostico(GABARITO_DO_PGM))

    achados = ValidationReport()
    v_ctr_04_geometria_nao_canonica(contrato, achados)

    assert len(achados.avisos) == 1
    assert achados.avisos[0].validacao == "V-CTR-04"
    assert achados.avisos[0].severidade is Severity.AVISA
    assert not achados.bloqueado


@pytest.mark.parametrize("gabarito", [None])
def test_t1123_sem_gabarito_nao_ha_o_que_comparar(
    gabarito: tuple[float, ...] | None,
) -> None:
    contrato = Contract(proposta="X", diagnostico=_diagnostico(gabarito))

    achados = ValidationReport()
    v_ctr_04_geometria_nao_canonica(contrato, achados)

    assert achados.achados == []
