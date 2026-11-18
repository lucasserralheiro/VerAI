"""Catálogo de preços do VerAI, lido via API de plataforma.

Spec docs/superpowers/specs/2026-11-18-confere-catalogo-precos-design.md §3-4. Nunca derruba a
geração do relatório: configuração ausente, timeout, erro HTTP — tudo cai em cache vazio (ou no
que já havia), e quem usa (`infrastructure/validations/catalog_validations.py`) trata `{}` como
"catálogo indisponível", não como "catálogo sem item nenhum".
"""

from __future__ import annotations

import os
import time
from dataclasses import dataclass

import httpx

TTL_PADRAO_S = 600.0
TIMEOUT_PADRAO_S = 3.0


@dataclass(frozen=True)
class ItemCatalogo:
    codigo: str
    descricao: str
    grupo: str


class CatalogoVerAI:
    def __init__(self, ttl_s: float = TTL_PADRAO_S, timeout_s: float = TIMEOUT_PADRAO_S) -> None:
        self._ttl_s = ttl_s
        self._timeout_s = timeout_s
        self._cache: dict[str, ItemCatalogo] = {}
        self._cache_em: float | None = None

    def obter(
        self, *, agora: float | None = None, cliente: httpx.Client | None = None
    ) -> dict[str, ItemCatalogo]:
        """O catálogo vigente, código → item. `agora`/`cliente` existem para o teste controlar
        o relógio e a rede; em produção os dois ficam no padrão (relógio real, cliente novo)."""
        momento = agora if agora is not None else time.monotonic()
        if self._cache_em is not None and momento - self._cache_em < self._ttl_s:
            return self._cache

        base_url = os.getenv("VERAI_BASE_URL")
        chave = os.getenv("VERAI_API_KEY")
        if not base_url or not chave:
            return self._cache

        proprio = cliente is None
        http = cliente or httpx.Client(timeout=self._timeout_s)
        try:
            self._cache = self._buscar_tudo(http, base_url.rstrip("/"), chave)
            self._cache_em = momento
        except (httpx.HTTPError, KeyError, ValueError, TypeError):
            pass
        finally:
            if proprio:
                http.close()

        return self._cache

    def _buscar_tudo(self, http: httpx.Client, base_url: str, chave: str) -> dict[str, ItemCatalogo]:
        itens: dict[str, ItemCatalogo] = {}
        pagina = 1
        while True:
            resposta = http.get(
                f"{base_url}/api/v1/tabelaPrecos",
                params={"pagina": pagina, "limite": 1000},
                headers={"Authorization": f"Bearer {chave}"},
                timeout=self._timeout_s,
            )
            resposta.raise_for_status()
            corpo = resposta.json()
            for registro in corpo["data"]:
                dados = registro["dados"]
                itens[dados["codigo"]] = ItemCatalogo(
                    codigo=dados["codigo"], descricao=dados["descricao"], grupo=dados["grupo"]
                )
            if pagina >= corpo["paginas"]:
                break
            pagina += 1
        return itens
