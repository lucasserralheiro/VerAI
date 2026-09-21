"""T-10 — Item da aba `Levantamento` da planilha de medição."""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal

from domain.value_objects.quantity import para_decimal
from domain.value_objects.service_code import ServiceCode

# T-2146 / ESPEC 031 — **pública desde a `R-APU-01`.** Era privada enquanto o
# único leitor era `desconta_desenvolvimento`, aqui ao lado. O pareamento de
# blocos vive em `Measurement` e precisa da mesma cadeia; duplicá-la lá criaria
# duas fontes para a mesma verdade, a divergirem no dia em que a planilha
# mudasse a grafia.
MARCA_SEM_DESENVOLVIMENTO = "DESCONTANDO RECURSOS DE DESENVOLVIMENTO"


@dataclass(frozen=True)
class MeasurementItem:
    """Uma linha de item da planilha.

    ``medida_texto`` preserva o conteúdo bruto da célula ao lado do valor
    convertido. Sem isso, ``PACOTE`` e ``Perfil D`` se perderiam antes da
    reconciliação poder tratá-los (ESPEC 001 R-REC-04).
    """

    codigo: ServiceCode
    descricao: str
    bloco_titulo: str
    medida_texto: str
    linha: int
    # A quantidade contratada da planilha tem **dois** consumidores, e o
    # comentário anterior só conhecia um (T-1625 / ESPEC 022 §7):
    #
    # 1. `Measurement.contratada_para` — alimenta a coluna *Quantidade
    #    Contratada* do documento desde a ESPEC 018 `R-REL-04` / `D-05`, que
    #    revogou a `R-CTR-01`. O comentário dizia que ela "não alimenta o
    #    relatório" e que "a fonte da verdade é o contrato": as duas frases
    #    ficaram falsas naquela espec e sobreviveram três especs sem correção;
    # 2. `V-REC-01` — confronta este valor com o do contrato consolidado.
    contratada_texto: str = ""

    @property
    def medida(self) -> Decimal | None:
        return para_decimal(self.medida_texto)

    @property
    def contratada(self) -> Decimal | None:
        return para_decimal(self.contratada_texto)

    @property
    def e_numerica(self) -> bool:
        return self.medida is not None

    @property
    def desconta_desenvolvimento(self) -> bool:
        """Indica se esta ocorrência é a variante que desconta desenvolvimento.

        A marca aparece ora no título do bloco (E1.1, linhas 69-80), ora na
        própria descrição da linha (SAN, linha 129) — por isso os dois são
        verificados (ESPEC 001 R-MED-02).
        """
        alvo = f"{self.bloco_titulo} {self.descricao}".upper()
        return MARCA_SEM_DESENVOLVIMENTO in alvo
