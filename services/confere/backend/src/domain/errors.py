"""Erros de domínio.

Definidos aqui — e não em ``infrastructure`` — para que as camadas internas
possam sinalizar violação de regra sem importar nada de fora.
"""

from __future__ import annotations


class DomainError(Exception):
    """Violação de uma invariante do domínio."""


class ExtractionError(DomainError):
    """A extração de uma fonte não produziu dado confiável.

    Levantado quando prosseguir significaria emitir um relatório com número
    errado — a ESPEC 001 §9.4 proíbe falha silenciosa com quantidade zero.
    """
