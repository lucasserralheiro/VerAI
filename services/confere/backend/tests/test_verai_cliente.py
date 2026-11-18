from __future__ import annotations

import httpx
import pytest

from infrastructure.catalogo.verai_cliente import CatalogoVerAI


def _resposta_pagina(itens: list[dict], pagina: int, paginas: int) -> httpx.Response:
    return httpx.Response(
        200,
        json={
            "objeto": "lista",
            "recurso": "tabelaPrecos",
            "hash": "x",
            "total": len(itens),
            "pagina": pagina,
            "paginas": paginas,
            "limite": 1000,
            "data": [{"id": i["codigo"], "chaveCliente": None, "chaveGerencia": None, "dados": i} for i in itens],
        },
    )


def _item(codigo: str, descricao: str = "", grupo: str = "E") -> dict:
    return {"codigo": codigo, "descricao": descricao, "grupo": grupo}


@pytest.fixture(autouse=True)
def _configurado(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("VERAI_BASE_URL", "https://verai.teste")
    monkeypatch.setenv("VERAI_API_KEY", "vrai_teste")


def test_sem_configuracao_devolve_vazio(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("VERAI_BASE_URL", raising=False)
    monkeypatch.delenv("VERAI_API_KEY", raising=False)
    catalogo = CatalogoVerAI()

    assert catalogo.obter() == {}


def test_busca_e_concatena_paginas() -> None:
    chamadas: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        chamadas.append(request)
        pagina = int(request.url.params["pagina"])
        if pagina == 1:
            return _resposta_pagina([_item("14.046.00008.00", "PERFIL A")], 1, 2)
        return _resposta_pagina([_item("14.048.00010.00", "PERFIL A")], 2, 2)

    cliente = httpx.Client(transport=httpx.MockTransport(handler))
    catalogo = CatalogoVerAI()

    resultado = catalogo.obter(cliente=cliente)

    assert set(resultado) == {"14.046.00008.00", "14.048.00010.00"}
    assert resultado["14.046.00008.00"].descricao == "PERFIL A"
    assert len(chamadas) == 2
    assert chamadas[0].headers["authorization"] == "Bearer vrai_teste"


def test_cache_respeita_ttl() -> None:
    chamadas = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal chamadas
        chamadas += 1
        return _resposta_pagina([_item("14.046.00008.00")], 1, 1)

    cliente = httpx.Client(transport=httpx.MockTransport(handler))
    catalogo = CatalogoVerAI(ttl_s=600.0)

    catalogo.obter(agora=0.0, cliente=cliente)
    catalogo.obter(agora=500.0, cliente=cliente)

    assert chamadas == 1


def test_ttl_expirado_busca_de_novo() -> None:
    chamadas = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal chamadas
        chamadas += 1
        return _resposta_pagina([_item("14.046.00008.00")], 1, 1)

    cliente = httpx.Client(transport=httpx.MockTransport(handler))
    catalogo = CatalogoVerAI(ttl_s=600.0)

    catalogo.obter(agora=0.0, cliente=cliente)
    catalogo.obter(agora=601.0, cliente=cliente)

    assert chamadas == 2


def test_erro_http_sem_cache_anterior_devolve_vazio() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(500)

    cliente = httpx.Client(transport=httpx.MockTransport(handler))
    catalogo = CatalogoVerAI()

    assert catalogo.obter(cliente=cliente) == {}


def test_erro_http_mantem_cache_anterior() -> None:
    def handler_ok(request: httpx.Request) -> httpx.Response:
        return _resposta_pagina([_item("14.046.00008.00")], 1, 1)

    def handler_falha(request: httpx.Request) -> httpx.Response:
        return httpx.Response(500)

    catalogo = CatalogoVerAI(ttl_s=600.0)
    catalogo.obter(agora=0.0, cliente=httpx.Client(transport=httpx.MockTransport(handler_ok)))

    resultado = catalogo.obter(agora=601.0, cliente=httpx.Client(transport=httpx.MockTransport(handler_falha)))

    assert "14.046.00008.00" in resultado
