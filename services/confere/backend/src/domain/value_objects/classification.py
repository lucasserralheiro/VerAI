"""T-506 — As quatro situações da análise (ESPEC 009 §5).

A taxonomia particiona o que a ESPEC 002 tratava como binário. Lá a pergunta era
*bate ou não bate*; aqui é *quão grave é não bater* — e as respostas não são da
mesma espécie: medir acima do contratado é consumo sem cobertura, medir zero é
serviço não entregue ou não demandado, medir a menor é entrega parcial.
"""

from __future__ import annotations

from enum import StrEnum


class Classificacao(StrEnum):
    """As quatro situações, **na ordem de gravidade**.

    ``StrEnum`` pelo mesmo motivo de ``NumberFormat``: o valor serializa sozinho
    na resposta da API, sem conversão na fronteira.

    A ordem de declaração é a ordem de apresentação — do achado que mais
    compromete o faturamento ao que não compromete nenhum. Quem exibe itera o
    enum; não há uma segunda lista para manter em sincronia.
    """

    CRITICO = "CRITICO"
    MAIOR_RELEVANCIA = "MAIOR_RELEVANCIA"
    DIVERGENTE = "DIVERGENTE"
    SEM_DIVERGENCIA = "SEM_DIVERGENCIA"

    @property
    def rotulo(self) -> str:
        """O nome da situação para quem lê o relatório.

        Vive no domínio, e não na tela, porque tela e arquivo têm de dizer a
        mesma coisa (``R-XLS-02``). Rótulo é dado de apresentação e muda em uma
        linha — é o insumo ``I-07``.
        """
        return _ROTULOS[self]

    @property
    def glosa(self) -> str:
        """O critério, em palavras.

        Existe porque o rótulo sozinho não diz o que a situação significa —
        *divergente de maior relevância* não se explica — e porque a distinção
        entre as quatro **não pode depender de cor** (``R-ACE-02``).

        A redação descreve o fato e não imputa causa: num contrato de sustentação
        é normal haver item sob demanda sem consumo no mês, e nem o contrato nem
        a planilha dizem se o serviço não foi entregue ou não foi pedido.
        """
        return _GLOSAS[self]


_ROTULOS = {
    Classificacao.CRITICO: "Item crítico",
    Classificacao.MAIOR_RELEVANCIA: "Divergente de maior relevância",
    Classificacao.DIVERGENTE: "Divergente",
    Classificacao.SEM_DIVERGENCIA: "Sem divergência",
}

_GLOSAS = {
    Classificacao.CRITICO: "medido acima do contratado",
    Classificacao.MAIOR_RELEVANCIA: "contratado sem medição no período",
    Classificacao.DIVERGENTE: "medido abaixo do contratado",
    Classificacao.SEM_DIVERGENCIA: "medido igual ao contratado",
}
