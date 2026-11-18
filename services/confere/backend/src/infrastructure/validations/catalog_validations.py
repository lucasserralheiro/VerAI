"""V-CAT-01: código e perfil contra o catálogo de preços do VerAI.

Spec docs/superpowers/specs/2026-11-18-confere-catalogo-precos-design.md §5. Só avisa — nunca
bloqueia, nunca altera quantidade, classificação ou `perfil_ou_pacote` de linha nenhuma.
"""

from __future__ import annotations

import re
from collections.abc import Mapping

from domain.entities.measurement import Measurement
from domain.entities.validation_finding import Severity, ValidationReport
from infrastructure.catalogo.verai_cliente import ItemCatalogo

_LETRA_DE_PERFIL = re.compile(r"^[A-Z]$")
_PERFIL_NA_DESCRICAO = re.compile(r"PERFIL\s+([A-E])\b", re.IGNORECASE)


def _letra(texto: str) -> str | None:
    limpo = texto.strip().upper()
    return limpo if _LETRA_DE_PERFIL.fullmatch(limpo) else None


def v_cat_01_codigo_fora_do_catalogo_ou_perfil_incoerente(
    medicao: Measurement,
    achados: ValidationReport,
    catalogo: Mapping[str, ItemCatalogo],
) -> None:
    """Código ausente do catálogo vigente, ou perfil que a descrição oficial não confirma.

    `catalogo` vazio é "catálogo indisponível" (VerAI fora do ar, chave não configurada) — a
    validação sai em silêncio, porque ausência de dado não é evidência de problema.
    """
    if not catalogo:
        return

    for codigo in medicao.codigos_em_ordem:
        item_catalogo = catalogo.get(codigo)
        if item_catalogo is None:
            achados.registrar(
                "V-CAT-01",
                Severity.AVISA,
                f"código {codigo} não encontrado na tabela de preços vigente — "
                "confira se não foi descontinuado ou digitado errado.",
                codigo=codigo,
            )
            continue

        item = medicao.item_para(codigo)
        if item is None:  # pragma: no cover — código veio da própria medição
            continue

        letra = _letra(item.contratada_texto) or _letra(item.medida_texto)
        if letra is None:
            continue

        achado_perfil = _PERFIL_NA_DESCRICAO.search(item_catalogo.descricao)
        if achado_perfil is None or achado_perfil.group(1).upper() != letra:
            achados.registrar(
                "V-CAT-01",
                Severity.AVISA,
                f"perfil {letra} do código {codigo} não corresponde à descrição "
                f'oficial do catálogo: "{item_catalogo.descricao}".',
                codigo=codigo,
            )
