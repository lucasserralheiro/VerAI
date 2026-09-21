"""T-08 — Código de serviço do Catálogo DIT."""

from __future__ import annotations

import re
from dataclasses import dataclass

from domain.errors import DomainError

_FORMATO = re.compile(r"^\d{2}\.\d{3}\.\d{5}\.\d{2}$")

# Reconhece o código em texto livre — usado pelos extratores para localizar a
# coluna do código sem depender de posição fixa (ESPEC 001 §4.2).
PADRAO_EM_TEXTO = re.compile(r"\d{2}\.\d{3}\.\d{5}\.\d{2}")


@dataclass(frozen=True, order=True)
class ServiceCode:
    """Código no formato ``NN.NNN.NNNNN.NN`` — ex.: ``14.049.00037.00``.

    Imutável e ordenável para servir de chave de dicionário e de critério de
    ordenação estável nos testes.
    """

    valor: str

    def __post_init__(self) -> None:
        if not _FORMATO.match(self.valor):
            raise DomainError(f"código de serviço inválido: {self.valor!r}")

    @classmethod
    def extrair(cls, texto: str) -> ServiceCode | None:
        """Devolve o primeiro código encontrado no texto, ou ``None``."""
        achado = PADRAO_EM_TEXTO.search(texto or "")
        return cls(achado.group()) if achado else None

    def __str__(self) -> str:
        return self.valor
