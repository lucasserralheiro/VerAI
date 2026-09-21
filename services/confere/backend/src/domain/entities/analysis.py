"""T-509 — Agregado da análise da medição (ESPEC 009).

A leitura **por gravidade** dos mesmos dados que o relatório apresenta por seção.
Não calcula nada novo: nomeia, agrupa e conta o que a reconciliação já produziu.

Por que uma fábrica de domínio e não uma etapa do caso de uso: a análise é
derivação do `Report`, da mesma espécie de `apenas_divergencias()` — que o router
já chama sobre o relatório pronto. Atravessar `application/` acrescentaria uma
camada sem decisão nenhuma a tomar (TASKS 009 §1.1 regra 2).
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date

from domain.entities.report import Report, ReportLine
from domain.value_objects.classification import Classificacao

# `R-RES-03` — o mês por extenso vem daqui, **nunca de `locale`**. `%B` depende
# da configuração do sistema operacional: devolveria `July` num container em
# inglês e falharia em outro sem `pt_BR` instalado. A aplicação roda em Docker,
# onde a configuração regional não é dada.
MESES = (
    "janeiro",
    "fevereiro",
    "março",
    "abril",
    "maio",
    "junho",
    "julho",
    "agosto",
    "setembro",
    "outubro",
    "novembro",
    "dezembro",
)


def competencia_por_extenso(data: date | None) -> str:
    """`15/07/2026` vira `julho/2026`. Sem data, string vazia."""
    if data is None:
        return ""
    return f"{MESES[data.month - 1]}/{data.year}"


@dataclass(frozen=True)
class ItemClassificado:
    """Uma linha do universo, com a situação e a origem.

    `sem_previsao_contratual` não vive em `ReportLine` porque não é atributo da
    linha: é atributo de **onde ela estava** no relatório. A mesma linha, com as
    mesmas quantidades, seria comum se tivesse contrapartida contratual.
    """

    linha: ReportLine
    sem_previsao_contratual: bool = False

    @property
    def classificacao(self) -> Classificacao:
        return self.linha.classificacao


@dataclass(frozen=True)
class SituacaoDaAnalise:
    """Uma das quatro situações, com os itens que caíram nela."""

    classificacao: Classificacao
    itens: list[ItemClassificado]

    @property
    def quantidade(self) -> int:
        return len(self.itens)

    @property
    def rotulo(self) -> str:
        return self.classificacao.rotulo

    @property
    def glosa(self) -> str:
        return self.classificacao.glosa

    @property
    def perfis_ou_pacotes(self) -> int:
        """Quantos itens desta situação nunca poderiam divergir (`R-REC-04`).

        Só faz sentido em *sem divergência*, e é lá que ele importa: cinco das
        dezenove linhas do piloto entram como `1/1` independentemente da planilha,
        e uma delas é o banco de dados **contratado no perfil D e medido no
        perfil C**. Sem esta contagem, a categoria afirma conformidade que não
        verificou (ESPEC 009 §6.4).
        """
        return sum(1 for item in self.itens if item.linha.perfil_ou_pacote)


@dataclass(frozen=True)
class AnaliseDaMedicao:
    """O quadro-resumo e as quatro situações, na ordem de gravidade."""

    contrato_referencia: str
    proposta_origem: str
    competencia: str
    situacoes: list[SituacaoDaAnalise]

    @property
    def total_itens(self) -> int:
        """`R-ANA-05` — a soma das quatro é o universo. O invariante fica visível."""
        return sum(situacao.quantidade for situacao in self.situacoes)

    def situacao(self, classificacao: Classificacao) -> SituacaoDaAnalise:
        return next(s for s in self.situacoes if s.classificacao is classificacao)

    @classmethod
    def de_relatorio(cls, relatorio: Report) -> AnaliseDaMedicao:
        """Classifica o universo de `R-ANA-07` e agrupa nas quatro situações.

        As quatro saem **sempre**, inclusive vazias (`R-API-01`): "nenhum item
        crítico" é resultado, e é o resultado que quem confere mais quer ler.
        Quem exibe não decide quais existem.

        A ordem dentro de cada situação é a do relatório (`R-ANA-09`), porque é
        ela que permite reconhecer a mesma linha no documento, no grid e aqui.
        """
        itens = [
            ItemClassificado(linha=linha, sem_previsao_contratual=sem_previsao)
            for linha, sem_previsao in relatorio.universo_da_analise()
        ]

        return cls(
            contrato_referencia=relatorio.contrato_referencia,
            proposta_origem=relatorio.proposta_origem,
            competencia=competencia_por_extenso(relatorio.data_levantamento),
            situacoes=[
                SituacaoDaAnalise(
                    classificacao=classificacao,
                    itens=[item for item in itens if item.classificacao is classificacao],
                )
                for classificacao in Classificacao
            ],
        )
