"""T-31 — Testes de integração dos leitores de medição e catálogo.

Rodam contra a fixture sanitizada, sem a aba `Usuários`. As asserções da regra
R-MED-02 são nominais e trazem os dois valores — o certo e o que sairia sem a
regra — para que a falha diga o que aconteceu.
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from pathlib import Path

import pytest

from domain.entities.measurement import Measurement
from domain.entities.validation_finding import ValidationReport
from domain.errors import ExtractionError
from infrastructure.measurement.levantamento_reader import LevantamentoReader
from infrastructure.validations.measurement_validations import (
    v_med_01_aba_reconhecida,
    v_med_02_cabecalho_localizado,
)


@pytest.fixture(scope="module")
def medicao(caminho_levantamento: Path) -> Measurement:
    return LevantamentoReader().ler(caminho_levantamento)


# ── T-24 / T-25 · varredura da aba ────────────────────────────────────────────


def test_todos_os_itens_da_aba_sao_lidos(medicao: Measurement) -> None:
    assert len(medicao.itens) == 74
    assert len(medicao.codigos) == 61


def test_treze_codigos_aparecem_duas_vezes(medicao: Measurement) -> None:
    """São os que têm variante descontando desenvolvimento: E1.1 inteira e a SAN.

    A duplicidade é o motivo de existir a R-MED-02 — sem ela, qual das duas
    ocorrências prevalece seria acidente de ordem de leitura.
    """
    repetidos = {c for c in medicao.codigos if len(medicao.itens_de(c)) > 1}
    assert len(repetidos) == 13
    assert "14.024.00005.00" in repetidos
    assert all(medicao.item_para(c) is not None for c in repetidos)


def test_codigo_e_localizado_em_qualquer_coluna(medicao: Measurement) -> None:
    """O layout varia entre blocos: em uns o código está na coluna B, em outros na C."""
    coluna_b = medicao.item_para("12.029.00021.00")  # bloco com unidade
    coluna_c = medicao.item_para("10.050.00001.00")  # bloco sem unidade
    assert coluna_b is not None
    assert coluna_c is not None


def test_linhas_de_total_nao_viram_item(medicao: Measurement) -> None:
    """A aba tem linhas "TOTAL" e "TOTAL GERAL" sem código — devem ser ignoradas."""
    assert all(item.descricao.upper() not in {"TOTAL", "TOTAL GERAL"} for item in medicao.itens)


# ── T-26 · texto bruto preservado ─────────────────────────────────────────────


def test_perfil_de_banco_sobrevive_como_texto(medicao: Measurement) -> None:
    """Sem isso, `Perfil D` viraria None e a regra R-REC-04 não teria o que tratar."""
    item = medicao.item_para("14.048.00008.00")
    assert item is not None
    assert not item.e_numerica
    assert item.medida_texto.strip() == "C"


def test_literal_pacote_sobrevive(medicao: Measurement) -> None:
    item = medicao.item_para("14.070.00002.00")
    assert item is not None
    assert item.medida_texto.strip().upper() == "PACOTE"


# ── T-27 · R-MED-02, descontando recursos de desenvolvimento ──────────────────


@pytest.mark.parametrize(
    ("codigo", "descontado", "sem_desconto"),
    [
        ("14.049.00047.00", "2", "4"),            # E1.1 — marca no título do bloco
        ("14.049.00038.00", "2", "5"),
        ("14.049.00048.00", "5", "7"),
        ("14.049.00005.00", "121.29", "130.25"),  # vRAM adicional
        ("14.024.00005.00", "762.55", "1097.55"), # SAN — marca na própria descrição
    ],
)
def test_variante_descontada_prevalece(
    medicao: Measurement, codigo: str, descontado: str, sem_desconto: str
) -> None:
    item = medicao.item_para(codigo)
    assert item is not None
    assert item.medida == Decimal(descontado), (
        f"{codigo} devolveu {item.medida}; esperado {descontado} "
        f"(o valor sem desconto seria {sem_desconto})"
    )


def test_codigo_com_ocorrencia_unica_nao_muda(medicao: Measurement) -> None:
    item = medicao.item_para("12.055.00002.00")
    assert item is not None
    assert item.medida == Decimal("21")


def test_codigo_ausente_devolve_nada(medicao: Measurement) -> None:
    assert medicao.item_para("99.999.99999.99") is None


# ── T-28 · cabeçalho ──────────────────────────────────────────────────────────


def test_data_e_contrato_saem_do_cabecalho(medicao: Measurement) -> None:
    assert medicao.data_levantamento == date(2026, 7, 15)
    assert medicao.contrato_referencia == "TC 52/SMIT/2024"


# ── T-30 · validações ─────────────────────────────────────────────────────────


def test_v_med_01_aceita_medicao_com_itens(medicao: Measurement) -> None:
    achados = ValidationReport()
    v_med_01_aba_reconhecida(medicao, achados)
    assert not achados.bloqueado


def test_v_med_01_bloqueia_medicao_vazia() -> None:
    achados = ValidationReport()
    v_med_01_aba_reconhecida(Measurement(), achados)
    assert achados.bloqueado


def test_v_med_02_apenas_avisa(medicao: Measurement) -> None:
    """T-2044 / ESPEC 027 `R-LEV-07` `[canário]` — **a única âncora que esta espec altera.**

    Era `== 2`: um achado para a data ausente, outro para o contrato ausente.
    A `R-LEV-07` funde os dois num achado só — eles saem das mesmas dez
    primeiras linhas do cabeçalho e falham juntos —, e o valor certo passa a
    ser `1`. O texto único diz **os dois** campos que faltaram.

    O número mudou porque a regra mudou, **não** porque o teste estava
    errado. Se qualquer outra âncora do repositório pedir alteração no mesmo
    commit, é sinal de que algo saiu do escopo da ESPEC 027 (TASKS 027 §1.1
    regra 4).
    """
    achados = ValidationReport()
    v_med_02_cabecalho_localizado(Measurement(), achados)
    assert not achados.bloqueado
    assert len(achados.avisos) == 1
    assert "data" in achados.avisos[0].titulo
    assert "contrato" in achados.avisos[0].titulo

    limpos = ValidationReport()
    v_med_02_cabecalho_localizado(medicao, limpos)
    assert not limpos.achados


def test_planilha_sem_a_aba_levantamento_falha(caminho_modelo: Path, tmp_path: Path) -> None:
    """XLSX válido, mas sem a aba `Levantamento`.

    Usava o catálogo, que era exatamente isso e saiu com a ESPEC 018. A fixture
    passa a ser construída aqui, e o teste deixa de depender de um artefato de
    outro subsistema para exercitar o seu.
    """
    import openpyxl

    livro = openpyxl.Workbook()
    aba = livro.active
    assert aba is not None
    aba.title = "OutraAba"
    caminho = tmp_path / "sem_levantamento.xlsx"
    livro.save(caminho)
    livro.close()

    with pytest.raises(ExtractionError, match="Levantamento"):
        LevantamentoReader().ler(caminho)


# ── Dado pessoal ──────────────────────────────────────────────────────────────


def test_a_fixture_traz_as_abas_nominais_sintetizadas(caminho_levantamento: Path) -> None:
    """A estratégia de LGPD mudou com a ESPEC 004 — vale registrar onde.

    Até aqui as abas com registros nominais eram **removidas** da fixture
    (PLANO 001 D-04), o que bastava enquanto só `Levantamento` era lido. Com os
    anexos elas viraram dois dos dezenove — e logo os dois mais difíceis —,
    então passaram a ficar com dados sintéticos (`R-ANX-10`).

    A guarda completa está em `test_dado_pessoal.py`. Esta continua aqui para
    que quem procurar a guarda antiga neste arquivo encontre a mudança.
    """
    import openpyxl

    livro = openpyxl.load_workbook(caminho_levantamento, read_only=True)
    abas = set(livro.sheetnames)
    livro.close()
    assert {"Usuários", "Office365"} <= abas


# ── T-29 · leitor do catálogo ─────────────────────────────────────────────────


def test_titulo_sai_da_primeira_linha_da_aba(medicao: Measurement) -> None:
    """Compor o título a partir do contrato daria "COMPROVAÇÃO TC 52/SMIT/2024";
    o modelo traz "COMPROVAÇÃO SMIT SUSTENTAÇÃO"."""
    assert medicao.titulo.startswith("LEVANTAMENTO - COMPROVAÇÃO SMIT SUSTENTAÇÃO")
    assert medicao.titulo.endswith("CATÁLOGO DE SERVIÇOS DIT")


# ── ESPEC 027 · V-MED-02 nos três casos do cabeçalho ──────────────────────────


def test_v_med_02_so_a_data_falta() -> None:
    """T-2029 — só a data ausente: um achado, título nomeia só ela."""
    achados = ValidationReport()
    v_med_02_cabecalho_localizado(
        Measurement(contrato_referencia="TC 00/TESTE/2026"), achados
    )
    assert len(achados.avisos) == 1
    assert "data" in achados.avisos[0].titulo
    assert "contrato" not in achados.avisos[0].titulo


def test_v_med_02_so_o_contrato_falta() -> None:
    """T-2029 — só o contrato ausente: um achado, título nomeia só ele."""
    achados = ValidationReport()
    v_med_02_cabecalho_localizado(
        Measurement(data_levantamento=date(2026, 7, 15)), achados
    )
    assert len(achados.avisos) == 1
    assert "contrato" in achados.avisos[0].titulo
    assert "a data" not in achados.avisos[0].titulo


def test_v_med_02_os_dois_faltam() -> None:
    """T-2029 — os dois ausentes: um achado, título nomeia os dois."""
    achados = ValidationReport()
    v_med_02_cabecalho_localizado(Measurement(), achados)
    assert len(achados.avisos) == 1
    assert "data" in achados.avisos[0].titulo
    assert "contrato" in achados.avisos[0].titulo
