"""T-10 — Item da tabela de itens do contrato (páginas 26 a 29 do PDF)."""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal

from domain.value_objects.service_code import ServiceCode


@dataclass(frozen=True)
class ContractItem:
    codigo: ServiceCode
    descricao: str
    unidade: str
    quantidade: Decimal
    preco_unitario: Decimal
    meses: int | None
    total_declarado: Decimal
    pagina: int
    qualificador: str | None = None
    # T-2611 / ESPEC 040 `R-MES-01` — o texto original da célula de período,
    # preenchido só quando `meses` não parseia como número (ex.: "2 meses e 14
    # dias"). É o que dá conteúdo ao aviso de `V-CTR-07`: sem ele, a mensagem
    # diria apenas "não é número", e quem confere teria de reabrir o PDF.
    meses_bruto: str | None = None

    @property
    def chave(self) -> tuple[str, str | None]:
        return (self.codigo.valor, self.qualificador)
