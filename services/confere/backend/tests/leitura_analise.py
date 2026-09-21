"""T-502 · T-504 · T-505 — O gabarito da análise, e o comparador.

Instrumento de teste, não código de produção: nada de ``src/`` depende deste
módulo. Ele lê o ``Relatorio_Analise_Medição.xlsx`` — produzido **fora** desta
aplicação, sobre o relatório modelo — e compara o que a aplicação classifica com
o que o gabarito afirma.

**O que é comparável, e o que não é.** O gabarito foi montado à mão, e três
campos dele não descrevem a mesma coisa que os nossos:

======================  ==========================================================
Código                  Comparável. É a chave.
Contratado · Medido     Comparável, **por valor decimal** — o gabarito grava
                        número (``3265.64``), nós gravamos texto formatado
                        (``3.265,64``). Comparar texto seria comparar
                        apresentação.
Descrição               **Não comparável.** O gabarito traz descrição reescrita:
                        ``ARMAZENAMENTO DE DADOS - NAS`` contra a nossa
                        ``ARMAZENAMENTO DE DADOS - BAIXA PLATAFORMA - NAS``, e
                        ``NUVEM PLANO II WINDOWS`` contra ``NUVEM - PLANO II -
                        WINDOWS 2012/2016``. A nossa vem do contrato
                        (``R-CTR-03``) e chega a preservar o erro de digitação
                        dele — ``DISPONIBLIZACAO DE vRAM ADICIONAL``. Ajustar a
                        nossa ao gabarito seria reescrever o contrato.
Identificação do resumo **Não comparável** — PLANO 009 §6.2.
======================  ==========================================================
"""

from __future__ import annotations

from decimal import Decimal
from enum import StrEnum
from pathlib import Path
from typing import NamedTuple

import openpyxl

from domain.value_objects.classification import Classificacao

# As abas do gabarito, na ordem em que ele as traz.
ABA_DA_CLASSIFICACAO = {
    Classificacao.CRITICO: "Itens Críticos",
    Classificacao.MAIOR_RELEVANCIA: "Divergências Maior Relevância",
    Classificacao.DIVERGENTE: "Divergências",
    Classificacao.SEM_DIVERGENCIA: "Sem Divergência",
}

# Os rótulos do quadro-resumo do gabarito. Ele nomeia as duas categorias do meio
# pelo critério (`Medido = 0`), não pela consequência — daí não bastar o nome da
# aba para lê-lo.
ROTULO_NO_RESUMO = {
    Classificacao.CRITICO: "Itens Críticos",
    Classificacao.MAIOR_RELEVANCIA: "Divergências Medido = 0",
    Classificacao.DIVERGENTE: "Divergências Medido > 0",
    Classificacao.SEM_DIVERGENCIA: "Sem Divergência",
}

# Nas abas de detalhe: linha 1 título, linha 2 vazia, linha 3 cabeçalho.
PRIMEIRA_LINHA_DE_DADO = 4


class Item(NamedTuple):
    """Uma linha, reduzida ao que os dois lados têm em comum."""

    codigo: str
    contratado: Decimal
    medido: Decimal


class Especie(StrEnum):
    """Por que duas classificações diferem. Diferença sem espécie não orienta."""

    FALTANTE = "faltante"
    EXCEDENTE = "excedente"
    CATEGORIA = "categoria"
    QUANTIDADE = "quantidade"


class Diferenca(NamedTuple):
    codigo: str
    especie: Especie
    esperado: str
    obtido: str

    def __str__(self) -> str:
        return f"{self.codigo} [{self.especie}] esperado={self.esperado} obtido={self.obtido}"


class DivergenciaDeclarada(NamedTuple):
    """Uma diferença conhecida, aceita e com dono — nunca anônima."""

    codigo: str
    especie: Especie
    motivo: str
    insumo: str


# ── T-505 · a linha vermelha ──────────────────────────────────────────────────
#
# As duas — e só as duas — diferenças que o gabarito pode ter contra a aplicação.
# Qualquer terceira reprova o portão P1. Constantes nomeadas, não comentário: a
# exceção anônima é a que se esquece.
DIVERGENCIAS_DECLARADAS = (
    DivergenciaDeclarada(
        codigo="14.049.00054.00",
        especie=Especie.EXCEDENTE,
        motivo=(
            "medido 2 sem previsão contratual. R-REC-01 o omite do relatório, e o "
            "gabarito foi derivado do relatório: por isso ele declara zero itens "
            "críticos existindo um. D-01 o traz para a análise"
        ),
        insumo="I-06",
    ),
    DivergenciaDeclarada(
        codigo="11.027.00001.00",
        especie=Especie.QUANTIDADE,
        motivo=(
            "contrato, aditivo e planilha dizem 10; o relatório modelo grafa 6, e o "
            "gabarito copiou o modelo. A classificação não muda com a resposta: 6 e "
            "10 caem os dois em contratado > medido com medido zero"
        ),
        insumo="I-01",
    ),
    # ── ESPEC 018 ─────────────────────────────────────────────────────────────
    DivergenciaDeclarada(
        codigo="14.025.00011.00",
        especie=Especie.FALTANTE,
        motivo=(
            "o gabarito o traz duas vezes, desdobrado por qualificador (IT0101 e "
            "SG0721), porque o catálogo o desdobrava. D-01 consolida numa linha "
            "por código: a aba Levantamento o traz uma vez só, e a medição não "
            "teria como ser repartida entre as duas"
        ),
        insumo="I-02",
    ),
    *(
        DivergenciaDeclarada(
            codigo=codigo,
            especie=Especie.EXCEDENTE,
            motivo=(
                "zerado dos dois lados na aba Levantamento, e desconhecido do "
                "catálogo. D-04 não omite nada do documento, e por isso a análise "
                "passa a vê-lo — o gabarito nunca teve como enxergá-lo, porque o "
                "universo anterior era o catálogo"
            ),
            insumo="I-06",
        )
        for codigo in ("12.029.00001.00", "14.024.00001.00", "14.049.00004.00")
    ),
)


def _decimal(valor: object) -> Decimal:
    """Número do gabarito em ``Decimal``.

    Via ``str``: o gabarito grava ``float`` (``121.29``), e ``Decimal(float)``
    traria o ruído binário da representação para dentro da comparação.
    """
    if valor is None:
        return Decimal(0)
    if isinstance(valor, Decimal):
        return valor
    return Decimal(str(valor))


def ler_referencia(caminho: Path) -> dict[Classificacao, list[Item]]:
    """As quatro abas de detalhe, normalizadas."""
    livro = openpyxl.load_workbook(caminho, data_only=True)
    lido: dict[Classificacao, list[Item]] = {}

    for classificacao, aba in ABA_DA_CLASSIFICACAO.items():
        planilha = livro[aba]
        itens: list[Item] = []
        for linha in planilha.iter_rows(min_row=PRIMEIRA_LINHA_DE_DADO, values_only=True):
            if not linha or linha[0] is None:
                continue
            itens.append(
                Item(
                    codigo=str(linha[0]).strip(),
                    contratado=_decimal(linha[2]),
                    medido=_decimal(linha[3]),
                )
            )
        lido[classificacao] = itens

    livro.close()
    return lido


def ler_resumo_declarado(caminho: Path) -> dict[Classificacao, int]:
    """O quadro da aba ``Resumo Executivo``, como o gabarito o declara."""
    livro = openpyxl.load_workbook(caminho, data_only=True)
    planilha = livro["Resumo Executivo"]

    por_rotulo: dict[str, int] = {}
    for linha in planilha.iter_rows(min_row=1, values_only=True):
        # A linha de cabeçalho — `Classificação` / `Quantidade` — tem a mesma
        # forma das linhas de dado. O que a distingue é a segunda célula não ser
        # número, e não a posição: filtrar por número é o que sobrevive a alguém
        # acrescentar uma linha em branco no alto da aba.
        if linha and isinstance(linha[0], str) and isinstance(linha[1], int | float):
            por_rotulo[linha[0].strip()] = int(linha[1])
    livro.close()

    return {
        classificacao: por_rotulo[rotulo] for classificacao, rotulo in ROTULO_NO_RESUMO.items()
    }


def na_precisao_do_gabarito(valor: Decimal) -> Decimal:
    """Duas casas — a única precisão que o gabarito pode ter conhecido.

    Ele foi derivado do relatório **impresso**, e o relatório imprime duas casas
    (`R-MED-04`). No `14.070.00001.00` isso aparece: a planilha de medição traz
    ``117,2889788312131`` e o gabarito gravou ``117,29``.

    Comparar sem arredondar acusaria uma terceira divergência que não é
    divergência de classificação nem de leitura — é **a precisão que o gabarito
    não tinha**. Os dois lados caem em *divergente*, e a nossa é a exata: quem
    perdeu informação foi quem transcreveu o relatório, não quem leu a planilha.

    O arredondamento vale **só aqui**. A classificação continua comparando o
    valor cheio (`R-ANA-06`), que é o que impede `117,2889…` de virar `117,29`.
    """
    return valor.quantize(Decimal("0.01"))


def _chavear(itens: list[Item]) -> dict[tuple[str, int], Item]:
    """Chave ``(código, ocorrência)``.

    ``14.025.00011.00`` aparece **duas vezes** — as linhas ``IT0101`` e
    ``SG0721`` de ``R-CTR-02``. Chavear só pelo código faria uma sumir dentro da
    outra, e a comparação daria por certo um item que nem foi olhado.
    """
    contagem: dict[str, int] = {}
    chaveado: dict[tuple[str, int], Item] = {}
    for item in itens:
        ordem = contagem.get(item.codigo, 0)
        contagem[item.codigo] = ordem + 1
        chaveado[(item.codigo, ordem)] = item
    return chaveado


def comparar(
    obtido: dict[Classificacao, list[Item]],
    referencia: dict[Classificacao, list[Item]],
) -> list[Diferenca]:
    """A lista **nomeada** de diferenças. Nunca um booleano.

    Uma diferença sem nome diz que algo está errado e não diz o quê — e o portão
    P1 existe justamente para dizer o quê, antes de o erro custar renderizador,
    API e tela.
    """
    diferencas: list[Diferenca] = []

    de_referencia = {
        chave: (classificacao, item)
        for classificacao, itens in referencia.items()
        for chave, item in _chavear(itens).items()
    }
    de_obtido = {
        chave: (classificacao, item)
        for classificacao, itens in obtido.items()
        for chave, item in _chavear(itens).items()
    }

    for chave, (classificacao, item) in sorted(de_referencia.items()):
        if chave not in de_obtido:
            diferencas.append(
                Diferenca(chave[0], Especie.FALTANTE, str(classificacao), "ausente")
            )
            continue

        classificacao_obtida, item_obtido = de_obtido[chave]
        if classificacao_obtida is not classificacao:
            diferencas.append(
                Diferenca(
                    chave[0],
                    Especie.CATEGORIA,
                    str(classificacao),
                    str(classificacao_obtida),
                )
            )
        else:
            esperado = (
                na_precisao_do_gabarito(item.contratado),
                na_precisao_do_gabarito(item.medido),
            )
            obtido_ = (
                na_precisao_do_gabarito(item_obtido.contratado),
                na_precisao_do_gabarito(item_obtido.medido),
            )
            if esperado != obtido_:
                diferencas.append(
                    Diferenca(
                        chave[0],
                        Especie.QUANTIDADE,
                        f"{item.contratado}/{item.medido}",
                        f"{item_obtido.contratado}/{item_obtido.medido}",
                    )
                )

    for chave, (classificacao, _) in sorted(de_obtido.items()):
        if chave not in de_referencia:
            diferencas.append(
                Diferenca(chave[0], Especie.EXCEDENTE, "ausente", str(classificacao))
            )

    return diferencas


def inesperadas(diferencas: list[Diferenca]) -> list[Diferenca]:
    """As diferenças que **não** estão na linha vermelha da T-505."""
    declaradas = {(d.codigo, d.especie) for d in DIVERGENCIAS_DECLARADAS}
    return [d for d in diferencas if (d.codigo, d.especie) not in declaradas]
