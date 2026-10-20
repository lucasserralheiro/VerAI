"""Geração assíncrona — `POST /jobs` (20/10/2026).

O VerAI chamava `/reports` atrás de uma função da Vercel que morre aos 300 s, e
no plano free do Render a geração de um contrato maior passa disso: a tela
recebia 504 ("O Confere não terminou dentro do tempo máximo"). Com o job, a
requisição só entrega os arquivos; quem chama consulta a situação até o
resultado ficar pronto — e o resultado é **o mesmo** que `/reports` devolveria.
"""

from __future__ import annotations

import threading
import time
from collections.abc import Iterator
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient

from api.main import app
from api.routers import reports
from domain.errors import ExtractionError

FIXTURES = Path(__file__).parent / "fixtures"


@pytest.fixture
def cliente() -> Iterator[TestClient]:
    # Com `with`: o laço de eventos do cliente precisa continuar vivo depois da
    # resposta do `POST`, que é onde a tarefa da geração roda.
    with TestClient(app) as cliente:
        yield cliente
    reports._jobs.clear()


def _arquivos() -> list[tuple[str, tuple[str, bytes, str]]]:
    return [
        ("contrato", ("contrato.pdf", (FIXTURES / "contrato.pdf").read_bytes(), "application/pdf")),
        (
            "levantamento",
            (
                "levantamento.xlsx",
                (FIXTURES / "levantamento.xlsx").read_bytes(),
                "application/octet-stream",
            ),
        ),
    ]


def _esperar(cliente: TestClient, id_do_job: str, situacao: str, teto_s: float = 300) -> dict[str, Any]:
    limite = time.monotonic() + teto_s
    while time.monotonic() < limite:
        corpo: dict[str, Any] = cliente.get(f"/jobs/{id_do_job}").json()
        if corpo["situacao"] == situacao:
            return corpo
        time.sleep(0.2)
    raise AssertionError(f"o job não chegou a '{situacao}' em {teto_s} s")


def test_job_devolve_o_mesmo_relatorio_que_reports(cliente: TestClient) -> None:
    iniciado = cliente.post("/jobs", files=_arquivos())
    assert iniciado.status_code == 202
    id_do_job = iniciado.json()["id"]

    _esperar(cliente, id_do_job, "concluido")
    resultado = cliente.get(f"/jobs/{id_do_job}/resultado")

    assert resultado.status_code == 200
    corpo = resultado.json()
    assert corpo["docx_base64"] and corpo["analise_xlsx_base64"]
    # A consulta pode repetir — rede que caiu, duas abas — enquanto o resultado
    # estiver guardado.
    assert cliente.get(f"/jobs/{id_do_job}/resultado").json()["titulo"] == corpo["titulo"]


class _GeracaoPresa:
    """Substitui a geração por uma que espera o teste liberar."""

    def __init__(self) -> None:
        self.liberar = threading.Event()

    def __call__(self, entradas: Any, destino: Path, arquivo_de_fase: Path | None = None) -> Any:
        reports.registrar_fase(arquivo_de_fase, "Lendo a planilha de levantamento")
        assert self.liberar.wait(30)
        raise ExtractionError("planilha ilegível")


def test_situacao_fase_fila_e_erro_de_extracao(
    cliente: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    presa = _GeracaoPresa()
    monkeypatch.setattr(reports, "_processar_isolado", presa)

    primeiro = cliente.post("/jobs", files=_arquivos()).json()["id"]
    situacao = _esperar(cliente, primeiro, "processando", teto_s=10)
    assert situacao["fase"] == "Lendo a planilha de levantamento"

    # Um por vez: o segundo espera atrás do primeiro, e diz quantos há na frente.
    segundo = cliente.post("/jobs", files=_arquivos()).json()["id"]
    na_fila = cliente.get(f"/jobs/{segundo}").json()
    assert na_fila["situacao"] == "na_fila"
    assert na_fila["posicao"] == 1

    # Resultado antes da hora não existe — e não é 404, que diria "sumiu".
    assert cliente.get(f"/jobs/{primeiro}/resultado").status_code == 409

    presa.liberar.set()
    _esperar(cliente, primeiro, "concluido", teto_s=10)
    resultado = cliente.get(f"/jobs/{primeiro}/resultado")
    assert resultado.status_code == 422
    assert resultado.json() == {"detail": "planilha ilegível"}
    _esperar(cliente, segundo, "concluido", teto_s=10)


def test_job_desconhecido_diz_que_o_servico_pode_ter_reiniciado(cliente: TestClient) -> None:
    for caminho in ("/jobs/nao-existe", "/jobs/nao-existe/resultado"):
        resposta = cliente.get(caminho)
        assert resposta.status_code == 404
        assert resposta.json()["detail"] == reports.MENSAGEM_JOB_NAO_ENCONTRADO


def test_resultado_expira(cliente: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    presa = _GeracaoPresa()
    presa.liberar.set()
    monkeypatch.setattr(reports, "_processar_isolado", presa)
    id_do_job = cliente.post("/jobs", files=_arquivos()).json()["id"]
    _esperar(cliente, id_do_job, "concluido", teto_s=10)

    monkeypatch.setattr(reports, "RETENCAO_DO_RESULTADO_S", -1)

    assert cliente.get(f"/jobs/{id_do_job}").status_code == 404
