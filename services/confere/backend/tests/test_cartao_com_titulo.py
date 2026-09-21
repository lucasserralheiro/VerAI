"""T-2652 / ESPEC 043 — sete avisos ganham título, causa e ação.

Cada validação aqui já existia e já disparava certo; o que faltava era o
`titulo` que `CartaoDeAchado` (`ResultadoPanel.tsx`) usa para decidir entre o
formato antigo — sigla colada na frase crua — e o formato da ESPEC 025
(título em português, técnico recolhido em "Detalhes técnicos").

`V-MED-03` e `V-MED-04` não tinham teste dedicado antes desta espec — só uma
menção em docstring de fixture e um comentário, respectivamente. Os dois
casos aqui são os primeiros a exercitá-las isoladas.
"""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal

from domain.entities.contract import BlocoDeItens, Contract, DiagnosticoDaGrade
from domain.entities.contract_item import ContractItem
from domain.entities.measurement import Measurement
from domain.entities.measurement_item import MeasurementItem
from domain.entities.validation_finding import Severity, ValidationReport
from domain.value_objects.block_label import RotuloDeBloco
from domain.value_objects.service_code import ServiceCode
from infrastructure.validations.contract_validations import (
    v_adt_02_aditivo_sem_efeito,
    v_adt_04_movimento_de_codigo_ausente,
    v_cap_01_cliente_nao_derivado,
    v_ctr_04_geometria_nao_canonica,
    v_ctr_05_codigo_contratado_ausente_da_aba,
    v_ctr_06_cauda_sem_linha_anterior,
    v_ctr_07_periodo_nao_numerico,
)
from infrastructure.validations.measurement_validations import (
    v_med_03_desconto_por_posicao,
    v_med_04_apuracao_sem_par,
)


def _item(codigo: str = "10.050.00001.00", **overrides: object) -> ContractItem:
    base: dict[str, object] = {
        "codigo": ServiceCode(codigo),
        "descricao": "ITEM DE TESTE",
        "unidade": "HORA/HOMEM",
        "quantidade": Decimal("1"),
        "preco_unitario": Decimal("1"),
        "meses": 12,
        "total_declarado": Decimal("1"),
        "pagina": 1,
    }
    base.update(overrides)
    return ContractItem(**base)  # type: ignore[arg-type]


def _preenchidos(achados: ValidationReport) -> None:
    assert len(achados.achados) == 1
    achado = achados.achados[0]
    assert achado.titulo, "titulo vazio — o card cairia no formato antigo"
    assert achado.causa
    assert achado.acao


# ── V-CTR-04 ───────────────────────────────────────────────────────────────


def test_v_ctr_04_ganha_titulo_causa_e_acao() -> None:
    achados = ValidationReport()
    diagnostico = DiagnosticoDaGrade(
        paginas=1,
        paginas_com_borda=1,
        maior_numero_de_divisorias=8,
        paginas_com_texto=1,
        gabarito=(30.0, 100.0, 260.0, 350.0, 400.0, 445.0, 495.0, 555.0),
    )
    contrato = Contract(proposta="PA-CONSTRUIDA", diagnostico=diagnostico)

    v_ctr_04_geometria_nao_canonica(contrato, achados)

    _preenchidos(achados)
    assert achados.achados[0].severidade is Severity.AVISA


# ── V-CTR-06 ───────────────────────────────────────────────────────────────


def test_v_ctr_06_ganha_titulo_causa_e_acao() -> None:
    achados = ValidationReport()
    diagnostico = DiagnosticoDaGrade(
        paginas=1,
        paginas_com_borda=1,
        maior_numero_de_divisorias=8,
        paginas_com_texto=1,
        caudas_orfas=((7, "150 MBPS SIMULTÂNEO NOS SERVIÇOS DE SEGURANÇA)"),),
    )
    contrato = Contract(proposta="PA-CONSTRUIDA", diagnostico=diagnostico)

    v_ctr_06_cauda_sem_linha_anterior(contrato, achados)

    _preenchidos(achados)
    assert "página 7" in achados.achados[0].mensagem


# ── V-CTR-07 ───────────────────────────────────────────────────────────────


def test_v_ctr_07_ganha_titulo_causa_e_acao() -> None:
    achados = ValidationReport()
    contrato = Contract(
        proposta="PA-CONSTRUIDA",
        itens=[_item(meses=None, meses_bruto="2 meses e 14 dias")],
    )

    v_ctr_07_periodo_nao_numerico(contrato, achados)

    _preenchidos(achados)
    mensagem = achados.achados[0].mensagem
    assert "10.050.00001.00" in mensagem
    assert "página 1" in mensagem
    assert "2 meses e 14 dias" in mensagem


# ── V-ADT-02 ───────────────────────────────────────────────────────────────


def test_v_adt_02_ganha_titulo_causa_e_acao() -> None:
    achados = ValidationReport()
    item = _item()
    aditivo = Contract(
        proposta="PA-ADT",
        blocos=(BlocoDeItens(rotulo=RotuloDeBloco.AUMENTO, itens=(item,)),),
        itens=[item],
    )

    v_adt_02_aditivo_sem_efeito(aditivo, achados)

    _preenchidos(achados)
    assert "documento sai igual" in achados.achados[0].mensagem


# ── V-ADT-04 ───────────────────────────────────────────────────────────────


def test_v_adt_04_ganha_titulo_causa_e_acao() -> None:
    achados = ValidationReport()
    consolidado = Contract(proposta="PA-BASE", itens=[_item("10.050.00001.00")])
    item_ausente = _item("99.999.00001.00")
    aditivo = Contract(
        proposta="PA-ADT",
        blocos=(
            BlocoDeItens(
                rotulo=RotuloDeBloco.AUMENTO,
                itens=(_item("10.050.00001.00"), item_ausente),
            ),
        ),
        itens=[_item("10.050.00001.00"), item_ausente],
    )

    v_adt_04_movimento_de_codigo_ausente(consolidado, [aditivo], achados)

    _preenchidos(achados)
    assert achados.achados[0].codigo == "99.999.00001.00"


# ── V-MED-03 ───────────────────────────────────────────────────────────────


@dataclass(frozen=True)
class _Ocorrencia:
    linha: int
    medida_texto: str


def _item_medido(
    codigo: str, linha: int, medida_texto: str, bloco_titulo: str = "BLOCO"
) -> MeasurementItem:
    return MeasurementItem(
        codigo=ServiceCode(codigo),
        descricao="ITEM MEDIDO",
        bloco_titulo=bloco_titulo,
        medida_texto=medida_texto,
        linha=linha,
    )


def test_v_med_03_ganha_titulo_causa_e_acao() -> None:
    achados = ValidationReport()
    medicao = Measurement(
        itens=[
            _item_medido("14.031.00023.00", 100, "500"),
            _item_medido("14.031.00023.00", 120, "793"),
        ]
    )

    v_med_03_desconto_por_posicao(medicao, achados)

    _preenchidos(achados)
    mensagem = achados.achados[0].mensagem
    assert "14.031.00023.00" in mensagem
    assert "120" in mensagem
    assert "793" in mensagem


# ── V-MED-04 ───────────────────────────────────────────────────────────────


def test_v_med_04_ganha_titulo_causa_e_acao() -> None:
    achados = ValidationReport()
    titulo_descontado = "HOSPEDAGEM DE APLICAÇÃO — DESCONTANDO RECURSOS DE DESENVOLVIMENTO"
    medicao = Measurement(
        itens=[_item_medido("14.049.00037.00", 50, "10", bloco_titulo=titulo_descontado)]
    )

    v_med_04_apuracao_sem_par(medicao, achados)

    _preenchidos(achados)
    assert titulo_descontado in achados.achados[0].mensagem


# ── V-CAP-01 / ESPEC 044 ───────────────────────────────────────────────────


def test_v_cap_01_ganha_titulo_causa_e_acao() -> None:
    achados = ValidationReport()
    proposta = Contract(proposta="PA-CONSTRUIDA", cliente="")

    v_cap_01_cliente_nao_derivado(proposta, achados)

    _preenchidos(achados)


# ── V-CTR-05 / ESPEC 044 ───────────────────────────────────────────────────


def test_v_ctr_05_ganha_titulo_causa_e_acao() -> None:
    achados = ValidationReport()
    contrato = Contract(proposta="PA-CONSTRUIDA", itens=[_item("10.050.00001.00")])
    medicao = Measurement(itens=[])

    v_ctr_05_codigo_contratado_ausente_da_aba(contrato, medicao, achados)

    _preenchidos(achados)
    assert achados.achados[0].codigo == "10.050.00001.00"
