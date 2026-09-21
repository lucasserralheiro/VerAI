"""T-09 — Quantidade e sua formatação no relatório.

Sempre ``Decimal``, nunca ``float``: o relatório é instrumento de faturamento e
erro de arredondamento binário aqui vira divergência de conferência.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from enum import StrEnum

from domain.errors import DomainError


class NumberFormat(StrEnum):
    """Formatação da quantidade na célula do relatório.

    O relatório modelo é inconsistente: na mesma página grafa ``1500`` sem
    separador de milhar e ``4.000`` com. Como o objetivo declarado é reproduzir
    o documento atual, a formatação é atributo do item — vem do catálogo — e não
    regra global (PLANO 001 D-02; ESPEC 001 R-MED-04 revisada).
    """

    MILHAR = "MILHAR"
    SIMPLES = "SIMPLES"


def para_decimal(texto: str) -> Decimal | None:
    """Converte texto no padrão pt-BR em ``Decimal``.

    Aceita ``4.000,00``, ``BRL 229,02``, ``1500`` e ``117,2889``. Devolve
    ``None`` para o que não é número — ``PACOTE`` e ``Perfil D`` precisam
    sobreviver como texto até a reconciliação (ESPEC 001 R-REC-04).

    **T-2214 / ESPEC 033 ``R-NUM-01`` — o sinal separado dos dígitos.** A célula
    de total do ``12.030.00002.00`` traz três tokens no PDF: ``BRL``, ``-`` e
    ``986.810,00``. Sem normalizar, ``Decimal('- 986810.00')`` levanta
    ``InvalidOperation`` e o item é recusado por *"sem valor total"*. O
    ``PA-PGM-260304-715`` grafa ``BRL -897.734,40``, colado, e por isso nenhum
    aditivo tinha exposto isto — e a variação não é entre documentos: a linha
    ``Redução TOTAL:`` da **mesma página** grafa o sinal colado.

    **Só o espaço depois do sinal, e é decisão** (``D-06``). Remover todo espaço
    interno faria ``'BRL -200,00 986,81'`` — a célula que a grade errada produzia,
    com preço e quantidade fundidos — deixar de ser recusada por sorte em vez de
    por regra. ``_montar_item`` precisa continuar denunciando célula fundida: é
    ela que acusa tabela genuinamente truncada (ESPEC 001 §9.4).
    """
    if texto is None:
        return None
    limpo = str(texto).strip().replace("BRL", "").replace("R$", "").strip()
    if not limpo:
        return None
    limpo = re.sub(r"^([+-])\s+", r"\g<1>", limpo)
    limpo = limpo.replace(".", "").replace(",", ".")
    try:
        return Decimal(limpo)
    except InvalidOperation:
        return None


@dataclass(frozen=True)
class Quantity:
    """Quantidade com a formatação que deve receber no relatório."""

    valor: Decimal
    formato: NumberFormat = NumberFormat.MILHAR

    def __post_init__(self) -> None:
        if not isinstance(self.valor, Decimal):
            raise DomainError(f"quantidade deve ser Decimal, veio {type(self.valor).__name__}")

    @classmethod
    def de_texto(cls, texto: str, formato: NumberFormat = NumberFormat.MILHAR) -> Quantity | None:
        valor = para_decimal(texto)
        return None if valor is None else cls(valor, formato)

    @classmethod
    def zero(cls, formato: NumberFormat = NumberFormat.MILHAR) -> Quantity:
        return cls(Decimal(0), formato)

    def somar(self, outra: Quantity) -> Quantity:
        return Quantity(self.valor + outra.valor, self.formato)

    @property
    def e_zero(self) -> bool:
        return self.valor == 0

    def formatar(self) -> str:
        """Renderiza a quantidade como aparece na célula do relatório.

        Parte fracionária vira duas casas com vírgula; parte inteira recebe
        ponto de milhar apenas no formato ``MILHAR``.
        """
        quantizado = self.valor.quantize(Decimal("0.01"))
        inteiro, _, decimal = f"{abs(quantizado):.2f}".partition(".")

        if self.formato is NumberFormat.MILHAR:
            inteiro = f"{int(inteiro):,}".replace(",", ".")

        sinal = "-" if quantizado < 0 else ""
        if decimal == "00":
            return f"{sinal}{inteiro}"
        return f"{sinal}{inteiro},{decimal}"

    def __str__(self) -> str:
        return self.formatar()
