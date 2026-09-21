"""T-64 — Teste de contrato de camada.

A regra de dependência da Clean Architecture vira teste, não convenção. Sem
isso, o primeiro `import pdfplumber` no domínio passa despercebido em revisão e
a inversão de dependência deixa de existir na prática.
"""

from __future__ import annotations

import ast
from pathlib import Path

import pytest

DOMINIO = Path(__file__).parent.parent / "src" / "domain"
APLICACAO = Path(__file__).parent.parent / "src" / "application"

# Tudo que o domínio não pode conhecer: framework web, bibliotecas de I/O e a
# própria camada de infraestrutura.
PROIBIDOS_NO_DOMINIO = (
    "fastapi",
    "starlette",
    "pydantic",
    "pdfplumber",
    "openpyxl",
    "docx",
    "infrastructure",
    "api",
)

# A aplicação orquestra, mas também não conhece detalhe técnico.
PROIBIDOS_NA_APLICACAO = (
    "fastapi",
    "starlette",
    "pdfplumber",
    "openpyxl",
    "docx",
    "infrastructure",
)


def _modulos_importados(arquivo: Path) -> set[str]:
    arvore = ast.parse(arquivo.read_text(encoding="utf-8"), filename=str(arquivo))
    modulos: set[str] = set()
    for no in ast.walk(arvore):
        if isinstance(no, ast.Import):
            modulos.update(alias.name for alias in no.names)
        elif isinstance(no, ast.ImportFrom) and no.module:
            modulos.add(no.module)
    return modulos


def _raizes(modulos: set[str]) -> set[str]:
    return {m.split(".")[0] for m in modulos}


def _arquivos(pasta: Path) -> list[Path]:
    return sorted(p for p in pasta.rglob("*.py") if p.name != "__init__.py")


@pytest.mark.parametrize("arquivo", _arquivos(DOMINIO), ids=lambda p: p.name)
def test_dominio_nao_depende_de_framework_nem_de_infraestrutura(arquivo: Path) -> None:
    proibidos = _raizes(_modulos_importados(arquivo)) & set(PROIBIDOS_NO_DOMINIO)
    assert not proibidos, (
        f"{arquivo.relative_to(DOMINIO.parent)} importa {sorted(proibidos)} — "
        "o domínio não pode conhecer framework, biblioteca de I/O nem infraestrutura"
    )


@pytest.mark.parametrize("arquivo", _arquivos(APLICACAO), ids=lambda p: p.name)
def test_aplicacao_nao_depende_de_infraestrutura(arquivo: Path) -> None:
    proibidos = _raizes(_modulos_importados(arquivo)) & set(PROIBIDOS_NA_APLICACAO)
    assert not proibidos, (
        f"{arquivo.relative_to(APLICACAO.parent)} importa {sorted(proibidos)} — "
        "a aplicação orquestra pelos ports, sem conhecer detalhe técnico"
    )


def test_o_teste_enxerga_os_arquivos_do_dominio() -> None:
    """Guarda contra o próprio teste: uma pasta vazia passaria vacuamente."""
    assert len(_arquivos(DOMINIO)) >= 5
