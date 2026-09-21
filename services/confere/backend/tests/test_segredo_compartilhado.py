"""Barreira de acesso por segredo compartilhado — VerAI/integração.

O Confere passa a ficar publicamente alcançável (chamado pelo VerAI a partir
de uma function serverless, sem IP fixo de saída pra allowlist funcionar), e
sobe sem autenticação por design (ESPEC 001 §7.2). A proteção é de borda, via
header — não altera nenhuma regra de domínio. Ver
docs/superpowers/specs/2026-09-21-integracao-confere-design.md §3.5 (no
repositório do VerAI, fora daqui).

Os testes contra `/reports` não mandam arquivo nenhum — o que importa aqui é
só se o middleware deixa a requisição chegar ou não no roteador; se chegar,
o FastAPI recusa por falta de campo obrigatório (422), nunca 401. É esse
contraste (401 vs. "qualquer outra coisa") que prova onde a barreira agiu.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from api.main import app, _HEADER_DO_SEGREDO


@pytest.fixture()
def cliente() -> TestClient:
    return TestClient(app)


def test_sem_segredo_configurado_nao_bloqueia_endpoint_protegido(
    cliente: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.delenv("CONFERE_SHARED_SECRET", raising=False)

    resposta = cliente.post("/reports")

    assert resposta.status_code != 401


def test_com_segredo_configurado_rejeita_sem_header(cliente: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CONFERE_SHARED_SECRET", "segredo-de-teste")

    resposta = cliente.post("/reports")

    assert resposta.status_code == 401


def test_com_segredo_configurado_rejeita_header_errado(cliente: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CONFERE_SHARED_SECRET", "segredo-de-teste")

    resposta = cliente.post("/reports", headers={_HEADER_DO_SEGREDO: "chute-errado"})

    assert resposta.status_code == 401


def test_com_segredo_configurado_aceita_header_certo(cliente: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CONFERE_SHARED_SECRET", "segredo-de-teste")

    resposta = cliente.post("/reports", headers={_HEADER_DO_SEGREDO: "segredo-de-teste"})

    assert resposta.status_code != 401


def test_health_sempre_isento_mesmo_com_segredo_configurado(
    cliente: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("CONFERE_SHARED_SECRET", "segredo-de-teste")

    resposta = cliente.get("/health")

    assert resposta.status_code == 200
