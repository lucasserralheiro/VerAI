from __future__ import annotations

from domain.entities.measurement import Measurement
from domain.entities.measurement_item import MeasurementItem
from domain.entities.validation_finding import ValidationReport
from domain.value_objects.service_code import ServiceCode
from infrastructure.catalogo.verai_cliente import ItemCatalogo
from infrastructure.validations.catalog_validations import (
    v_cat_01_codigo_fora_do_catalogo_ou_perfil_incoerente,
)


def _item(codigo: str, contratada: str = "", medida: str = "") -> MeasurementItem:
    return MeasurementItem(
        codigo=ServiceCode(codigo),
        descricao="",
        bloco_titulo="",
        medida_texto=medida,
        contratada_texto=contratada,
        linha=1,
    )


def _catalogo(*itens: ItemCatalogo) -> dict[str, ItemCatalogo]:
    return {i.codigo: i for i in itens}


def test_catalogo_vazio_nao_gera_achado() -> None:
    medicao = Measurement(itens=[_item("14.999.00000.00")])
    achados = ValidationReport()

    v_cat_01_codigo_fora_do_catalogo_ou_perfil_incoerente(medicao, achados, catalogo={})

    assert achados.achados == []


def test_codigo_fora_do_catalogo_gera_aviso() -> None:
    medicao = Measurement(itens=[_item("14.999.00000.00")])
    achados = ValidationReport()
    catalogo = _catalogo(
        ItemCatalogo(codigo="14.046.00008.00", descricao="PLATAFORMA POSTGRESQL - PERFIL A", grupo="E")
    )

    v_cat_01_codigo_fora_do_catalogo_ou_perfil_incoerente(medicao, achados, catalogo)

    assert len(achados.avisos) == 1
    assert achados.avisos[0].codigo == "14.999.00000.00"
    assert "não encontrado na tabela de preços" in achados.avisos[0].mensagem


def test_codigo_no_catalogo_sem_letra_nao_gera_achado() -> None:
    medicao = Measurement(itens=[_item("14.046.00008.00", contratada="10", medida="8")])
    achados = ValidationReport()
    catalogo = _catalogo(
        ItemCatalogo(codigo="14.046.00008.00", descricao="MPLS - 8 Mbps", grupo="C")
    )

    v_cat_01_codigo_fora_do_catalogo_ou_perfil_incoerente(medicao, achados, catalogo)

    assert achados.achados == []


def test_perfil_coerente_com_catalogo_nao_gera_achado() -> None:
    medicao = Measurement(itens=[_item("14.046.00008.00", contratada="A", medida="A")])
    achados = ValidationReport()
    catalogo = _catalogo(
        ItemCatalogo(codigo="14.046.00008.00", descricao="PLATAFORMA POSTGRESQL - PERFIL A", grupo="E")
    )

    v_cat_01_codigo_fora_do_catalogo_ou_perfil_incoerente(medicao, achados, catalogo)

    assert achados.achados == []


def test_perfil_incoerente_com_descricao_oficial_gera_aviso() -> None:
    """O caso do e-mail: `14.048.00010.00` contratado perfil A, catálogo diz outro perfil."""
    medicao = Measurement(itens=[_item("14.048.00010.00", contratada="A", medida="-")])
    achados = ValidationReport()
    catalogo = _catalogo(
        ItemCatalogo(codigo="14.048.00010.00", descricao="PLATAFORMA SQL SERVER - PERFIL B", grupo="E")
    )

    v_cat_01_codigo_fora_do_catalogo_ou_perfil_incoerente(medicao, achados, catalogo)

    assert len(achados.avisos) == 1
    assert "perfil A" in achados.avisos[0].mensagem
    assert achados.avisos[0].codigo == "14.048.00010.00"
