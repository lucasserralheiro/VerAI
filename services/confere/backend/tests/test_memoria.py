"""Memória da geração — o "Ran out of memory" do Render de 19/10/2026.

A instância tem 512 MB, e um contrato com aditivos passava disso: o
``pdfplumber`` guarda em ``pdf.pages`` cada página lida com tudo o que analisou
(por volta de 1 KB por caractere), e o extrator percorre o documento várias
vezes sem soltar nada. Medido nas fixtures (``contrato_pgm`` + quatro PDFs como
aditivos): pico de 468 MB antes, 244 MB depois.

**Contagem, não cronômetro** — como em ``test_desempenho.py``. Um teto em MB
mediria a máquina e a versão do Python; o que estes testes afirmam é a causa:

- a análise de uma página não fica em memória enquanto as outras são lidas;
- nenhuma página é analisada mais de uma vez. Liberar tudo a cada passada
  também resolveria a memória, mas reanalisava as páginas — e no Render free,
  onde a CPU é o gargalo, o tempo a mais virou 504 no VerAI (20/10/2026).

E o caminho de quando, mesmo assim, faltar memória: o filho morre e a resposta
é um 503 que diz o que aconteceu, não um 500 genérico nem o serviço fora do ar.
"""

from __future__ import annotations

import threading
import time
from collections import Counter
from concurrent.futures import Future
from concurrent.futures.process import BrokenProcessPool
from pathlib import Path
from typing import Any

import pdfplumber.page
import pytest
from fastapi.testclient import TestClient

from api.main import app
from api.routers import reports
from infrastructure.contract.pdfplumber_extractor import PdfPlumberContractExtractor
from infrastructure.di.container import Entradas

FIXTURES = Path(__file__).parent / "fixtures"
DOCUMENTOS = ["contrato.pdf", "contrato_pgm.pdf", "aditivo_pgm.pdf", "contrato_smul.pdf"]


def _medir_retencao(monkeypatch: pytest.MonkeyPatch) -> dict[str, int]:
    """O maior número de **outras** páginas com análise em memória, durante a extração.

    Medido a cada página que começa a ser analisada — é ali que a anterior já
    deveria ter sido solta. Depois da extração não serve olhar: o ``with``
    fecha o PDF e o ``pdfplumber`` limpa tudo de uma vez, o que esconderia o
    acúmulo que estourava a memória no meio do caminho.
    """
    retencao = {"layout": 0, "objetos": 0, "paginas": 0}
    original = pdfplumber.page.Page.parse_objects

    def medindo(self: Any) -> Any:
        paginas = self.pdf.pages
        retencao["paginas"] = len(paginas)
        retencao["layout"] = max(
            retencao["layout"], sum(hasattr(p, "_layout") for p in paginas)
        )
        retencao["objetos"] = max(
            retencao["objetos"], sum(hasattr(p, "_objects") for p in paginas)
        )
        return original(self)

    monkeypatch.setattr(pdfplumber.page.Page, "parse_objects", medindo)
    return retencao


def _contar_analises(monkeypatch: pytest.MonkeyPatch) -> Counter[int]:
    """Quantas vezes cada página teve os objetos extraídos do PDF."""
    contagem: Counter[int] = Counter()
    original = pdfplumber.page.Page.parse_objects

    def contado(self: Any) -> Any:
        contagem[self.page_number] += 1
        return original(self)

    monkeypatch.setattr(pdfplumber.page.Page, "parse_objects", contado)
    return contagem


@pytest.mark.parametrize("documento", DOCUMENTOS)
def test_a_arvore_de_layout_nao_se_acumula_entre_paginas(
    monkeypatch: pytest.MonkeyPatch, documento: str
) -> None:
    """Antes: 31 das 32 páginas do contrato com layout e objetos ao mesmo tempo."""
    retencao = _medir_retencao(monkeypatch)

    PdfPlumberContractExtractor().extrair(FIXTURES / documento)

    assert retencao["layout"] == 0, f"páginas com layout retido: {retencao}"
    # Os objetos ficam só nas páginas com faixa de tabela, que serão relidas
    # (`analisar_geometria`) — uma minoria do documento. Antes eram todas.
    assert retencao["objetos"] <= retencao["paginas"] // 2, f"objetos retidos: {retencao}"


@pytest.mark.parametrize("documento", DOCUMENTOS)
def test_cada_pagina_e_analisada_uma_vez_so(
    monkeypatch: pytest.MonkeyPatch, documento: str
) -> None:
    """Liberar memória não pode custar tempo: no plano free a CPU é o gargalo.

    A primeira versão da correção (19/10) liberava toda página sem tabela e a
    reanalisava no laço principal — até 60% mais lento, e a geração passou a
    estourar os 300 s do VerAI. A página sem grade possível não é mais reaberta
    (`pode_ter_grade`), e a com tabela fica aliviada até o fim.
    """
    contagem = _contar_analises(monkeypatch)

    PdfPlumberContractExtractor().extrair(FIXTURES / documento)

    assert contagem, "a extração não analisou nenhuma página"
    excesso = {pagina: vezes for pagina, vezes in contagem.items() if vezes > 1}
    assert excesso == {}, f"páginas reanalisadas: {excesso}"


class _ExecutorQueMorre:
    """O que o `ProcessPoolExecutor` devolve quando o filho é morto pelo sistema."""

    def submit(self, *_: Any, **__: Any) -> Future[Any]:
        futuro: Future[Any] = Future()
        futuro.set_exception(BrokenProcessPool("o filho morreu"))
        return futuro

    def shutdown(self, *_: Any, **__: Any) -> None:
        pass


def test_filho_morto_vira_503_com_mensagem_clara(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(reports, "_executor", _ExecutorQueMorre())

    with (FIXTURES / "contrato.pdf").open("rb") as contrato, (
        FIXTURES / "levantamento.xlsx"
    ).open("rb") as levantamento:
        resposta = TestClient(app).post(
            "/reports",
            files={
                "contrato": ("contrato.pdf", contrato, "application/pdf"),
                "levantamento": ("levantamento.xlsx", levantamento, "application/octet-stream"),
            },
        )

    assert resposta.status_code == 503
    assert resposta.json()["detail"] == reports.MENSAGEM_GERACAO_INTERROMPIDA
    # O executor quebrado é descartado: a próxima geração sobe um filho novo.
    assert reports._executor is None


# ── Teto por fase (20/10/2026) ────────────────────────────────────────────────
#
# O contrato do HSPM ficou 9 min em "Extraindo a tabela de itens do contrato"
# e a tela só desistiria aos 20. Fase parada além do teto mata o filho e vira
# 504 com a etapa e o arquivo na mensagem.


class _ProcessoFalso:
    def __init__(self) -> None:
        self.morto = False

    def kill(self) -> None:
        self.morto = True


class _ExecutorQueTrava:
    """Filho vivo que escreve fases num ritmo dado e termina (ou nunca termina)."""

    def __init__(self, fases: list[str], intervalo_s: float, termina: bool) -> None:
        self._fases = fases
        self._intervalo_s = intervalo_s
        self._termina = termina
        self.processo = _ProcessoFalso()
        self._processes = {1: self.processo}

    def submit(self, _funcao: Any, _entradas: Any, _destino: Any, arquivo_de_fase: Path) -> Future[Any]:
        futuro: Future[Any] = Future()

        def rodar() -> None:
            for fase in self._fases:
                reports.registrar_fase(arquivo_de_fase, fase)
                time.sleep(self._intervalo_s)
            if self._termina:
                futuro.set_result(("saida", 1.0))

        threading.Thread(target=rodar, daemon=True).start()
        return futuro

    def shutdown(self, *_: Any, **__: Any) -> None:
        pass


def _entradas(tmp_path: Path) -> Entradas:
    return Entradas(
        contrato=tmp_path / "contrato.pdf",
        levantamento=tmp_path / "levantamento.xlsx",
        nome_do_contrato="PC-HSPM-TESTE.pdf",
    )


def test_fase_parada_mata_o_filho_e_diz_a_etapa_e_o_arquivo(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    executor = _ExecutorQueTrava(
        ["Extraindo a tabela de itens do contrato"], intervalo_s=0, termina=False
    )
    monkeypatch.setattr(reports, "_executor", executor)
    monkeypatch.setattr(reports, "TETO_DA_FASE_S", 0.3)
    monkeypatch.setattr(reports, "INTERVALO_DO_VIGIA_S", 0.05)

    with pytest.raises(reports.GeracaoDemorada) as erro:
        reports._processar_isolado(_entradas(tmp_path), tmp_path, tmp_path / "fase.txt")

    assert "Extraindo a tabela de itens do contrato" in str(erro.value)
    assert "PC-HSPM-TESTE.pdf" in str(erro.value)
    assert executor.processo.morto
    # O executor é descartado: a próxima geração sobe um filho novo.
    assert reports._executor is None


def test_fase_que_anda_nao_e_interrompida(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    # Geração inteira bem mais longa que o teto, mas cada fase abaixo dele.
    fases = [f"Lendo o aditivo {i} de 6" for i in range(1, 7)]
    executor = _ExecutorQueTrava(fases, intervalo_s=0.15, termina=True)
    monkeypatch.setattr(reports, "_executor", executor)
    monkeypatch.setattr(reports, "TETO_DA_FASE_S", 0.4)
    monkeypatch.setattr(reports, "INTERVALO_DO_VIGIA_S", 0.05)

    saida = reports._processar_isolado(_entradas(tmp_path), tmp_path, tmp_path / "fase.txt")

    assert saida == "saida"
    assert not executor.processo.morto


def test_job_com_fase_parada_responde_504_com_a_mensagem(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def parada(entradas: Entradas, *_: Any, **__: Any) -> Any:
        raise reports.GeracaoDemorada("a etapa passou do teto")

    monkeypatch.setattr(reports, "_processar_isolado", parada)

    with TestClient(app) as cliente, (FIXTURES / "contrato.pdf").open("rb") as contrato, (
        FIXTURES / "levantamento.xlsx"
    ).open("rb") as levantamento:
        iniciado = cliente.post(
            "/jobs",
            files={
                "contrato": ("contrato.pdf", contrato, "application/pdf"),
                "levantamento": ("levantamento.xlsx", levantamento, "application/octet-stream"),
            },
        )
        id_do_job = iniciado.json()["id"]
        limite = time.monotonic() + 30
        while cliente.get(f"/jobs/{id_do_job}").json()["situacao"] != "concluido":
            assert time.monotonic() < limite
            time.sleep(0.05)
        resultado = cliente.get(f"/jobs/{id_do_job}/resultado")

    reports._jobs.clear()
    assert resultado.status_code == 504
    assert resultado.json()["detail"] == "a etapa passou do teto"
