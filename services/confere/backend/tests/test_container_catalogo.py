from __future__ import annotations

import pytest

from infrastructure.catalogo.verai_cliente import CatalogoVerAI
from infrastructure.di.container import DIContainer


def test_catalogo_verai_e_singleton() -> None:
    container = DIContainer()

    assert container.catalogo_verai() is container.catalogo_verai()
    assert isinstance(container.catalogo_verai(), CatalogoVerAI)


def test_sem_configuracao_obter_devolve_vazio_sem_excecao(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("VERAI_BASE_URL", raising=False)
    monkeypatch.delenv("VERAI_API_KEY", raising=False)
    container = DIContainer()

    assert container.catalogo_verai().obter() == {}
