"""Teste-âncora da análise — o critério de aceite da ESPEC 009.

Compara o que a aplicação classifica com o `Relatorio_Analise_Medição.xlsx`,
produzido **fora** deste projeto sobre o relatório modelo. É a mesma ideia do
`test_anchor_fidelity.py`: existe um documento que o negócio já reconhece, e a
aplicação tem de reproduzi-lo — inclusive onde discorda dele, e aí por escrito.

O âncora nasce com **duas** divergências declaradas, e nenhuma é acidental:

* `14.049.00054.00` — medido 2 sem previsão contratual. `R-REC-01` o omite do
  relatório, o gabarito foi derivado do relatório, e por isso ele declara **zero
  itens críticos existindo um**. `D-01` o traz para a análise.
* `11.027.00001.00` — contratado 10 contra 6. É o insumo `I-01`, e a
  classificação não muda com a resposta.

Qualquer terceira diferença reprova. O escopo do que é comparável — e por que a
descrição e a identificação ficam de fora — está em `leitura_analise.py`.

**O portão pegou uma terceira diferença, e ela não é divergência.** O
`14.070.00001.00` sai daqui com ``117,2889788312131``, o valor da planilha, e o
gabarito gravou ``117,29`` — a precisão do relatório impresso. Os dois lados
classificam igual, e o lado exato é o nosso. A comparação passou a arredondar
para duas casas, que é a única precisão que o gabarito pode ter conhecido; a
**classificação** continua usando o valor cheio, que é o que `R-ANA-06` exige.
"""

from __future__ import annotations

from collections.abc import Callable
from decimal import Decimal
from pathlib import Path

import pytest
from leitura_analise import (
    DIVERGENCIAS_DECLARADAS,
    Especie,
    Item,
    comparar,
    inesperadas,
    ler_referencia,
    ler_resumo_declarado,
)

from application.use_cases.generate_measurement_report import ReportResult
from domain.entities.analysis import AnaliseDaMedicao
from domain.entities.report import Report
from domain.value_objects.classification import Classificacao

FIXTURES = Path(__file__).parent / "fixtures"
REFERENCIA = FIXTURES / "analise_referencia.xlsx"

# ESPEC 009 §2.3 — o que a aplicação produz hoje, medido.
# **Reancorada pela ESPEC 031** — 2026-08-20. O único crítico do piloto era o
# `14.049.00054.00`, e o `2` que o punha ali vinha do bloco bruto de `E1.1`. Com
# a `R-APU-03` ele mede zero contra zero contratado: sai de *crítico* e entra em
# *sem divergência*. **A categoria mais grave do piloto passa a ser vazia.**
CONTAGEM_ESPERADA = {
    Classificacao.CRITICO: 0,
    Classificacao.MAIOR_RELEVANCIA: 20,
    Classificacao.DIVERGENTE: 16,
    # ESPEC 018 — eram 19. Entram os três zerados que só a aba conhece (`D-04`)
    # e sai o desdobramento por qualificador do `14.025.00011.00` (`D-01`).
    # ESPEC 031 — 21 → 22 com o `14.049.00054.00`, que deixou de ser crítico.
    Classificacao.SEM_DIVERGENCIA: 22,
}

# O gabarito, que não conhece o item sem previsão contratual.
CONTAGEM_NA_REFERENCIA = {
    Classificacao.CRITICO: 0,
    Classificacao.MAIOR_RELEVANCIA: 20,
    Classificacao.DIVERGENTE: 16,
    Classificacao.SEM_DIVERGENCIA: 19,
}


@pytest.fixture(scope="module")
def relatorio(gerar_piloto: Callable[..., ReportResult]) -> Report:
    resultado = gerar_piloto()
    assert resultado.relatorio is not None
    return resultado.relatorio


@pytest.fixture(scope="module")
def analise(relatorio: Report) -> AnaliseDaMedicao:
    return AnaliseDaMedicao.de_relatorio(relatorio)


def _como_itens(analise: AnaliseDaMedicao) -> dict[Classificacao, list[Item]]:
    """A análise no formato do comparador."""
    return {
        situacao.classificacao: [
            Item(
                codigo=str(item.linha.codigo),
                contratado=item.linha.contratada.valor,
                medido=item.linha.medida.valor,
            )
            for item in situacao.itens
        ]
        for situacao in analise.situacoes
    }


# ── T-503 · o gabarito é internamente coerente ────────────────────────────────
#
# Antes de tratar o arquivo como verdade, saber que ele não se contradiz. Ele foi
# montado fora deste projeto, e um defeito ali levaria a perseguir no código um
# erro que está na planilha.


def test_t503_o_resumo_do_gabarito_bate_com_as_abas() -> None:
    declarado = ler_resumo_declarado(REFERENCIA)
    contado = {
        classificacao: len(itens)
        for classificacao, itens in ler_referencia(REFERENCIA).items()
    }

    assert declarado == contado
    assert declarado == CONTAGEM_NA_REFERENCIA
    assert sum(declarado.values()) == 55


def test_t503_o_saldo_do_gabarito_e_contratado_menos_medido() -> None:
    """Coerência interna da única coluna derivada que o gabarito traz."""
    import openpyxl

    livro = openpyxl.load_workbook(REFERENCIA, data_only=True)
    for aba in ("Itens Críticos", "Divergências Maior Relevância", "Divergências"):
        for linha in livro[aba].iter_rows(min_row=4, values_only=True):
            if not linha or linha[0] is None:
                continue
            contratado, medido, saldo = (Decimal(str(v or 0)) for v in linha[2:5])
            assert saldo == contratado - medido, f"{aba}: {linha[0]}"
    livro.close()


# ── T-514 · a classificação contra o gabarito · portão P1 ─────────────────────


def test_t514_p1_a_diferenca_e_exatamente_a_linha_vermelha(analise: AnaliseDaMedicao) -> None:
    """**Portão P1.**

    Duas diferenças, e as duas com dono. Uma terceira significa que as regras
    `R-ANA-01` a `R-ANA-04` foram lidas errado — e significa isso antes de custar
    renderizador, resposta de API e painel.
    """
    diferencas = comparar(_como_itens(analise), ler_referencia(REFERENCIA))

    assert inesperadas(diferencas) == [], "\n".join(str(d) for d in inesperadas(diferencas))
    assert len(diferencas) == len(DIVERGENCIAS_DECLARADAS)
    assert {d.codigo for d in diferencas} == {d.codigo for d in DIVERGENCIAS_DECLARADAS}


def test_t514_as_duas_divergencias_sao_das_especies_declaradas(analise: AnaliseDaMedicao) -> None:
    diferencas = {d.codigo: d for d in comparar(_como_itens(analise), ler_referencia(REFERENCIA))}

    assert diferencas["14.049.00054.00"].especie is Especie.EXCEDENTE
    # ESPEC 031 — continua sendo diferença contra o gabarito (o GRC nunca teve
    # este código), mas **de outra natureza**: era *crítico* por medir 2 sem
    # cobertura, e agora é *sem divergência* por medir zero contra zero.
    assert diferencas["14.049.00054.00"].obtido == str(Classificacao.SEM_DIVERGENCIA)
    assert diferencas["11.027.00001.00"].especie is Especie.QUANTIDADE
    assert diferencas["11.027.00001.00"].esperado == "6/0"
    assert diferencas["11.027.00001.00"].obtido == "10/0"


def test_a_contagem_do_piloto(analise: AnaliseDaMedicao) -> None:
    """0 / 20 / 16 / 22, somando 58. Era 1 / 20 / 16 / 21 antes da ESPEC 031."""
    contagem = {s.classificacao: s.quantidade for s in analise.situacoes}

    assert contagem == CONTAGEM_ESPERADA
    assert analise.total_itens == 58


def test_o_insumo_i_01_nao_muda_a_categoria(analise: AnaliseDaMedicao) -> None:
    """6 e 10 caem os dois em `contratado > medido` com `medido = 0`.

    É o que permite entregar esta espec com `I-01` ainda em aberto: a resposta
    move uma célula, não uma categoria.
    """
    item = next(
        item
        for situacao in analise.situacoes
        for item in situacao.itens
        if str(item.linha.codigo) == "11.027.00001.00"
    )

    assert item.linha.contratada.valor == Decimal(10)
    assert item.classificacao is Classificacao.MAIOR_RELEVANCIA


def test_os_36_divergentes_da_espec_002_sao_as_duas_categorias_do_meio(
    analise: AnaliseDaMedicao, relatorio: Report
) -> None:
    """A taxonomia nova não contradiz a antiga: ela a particiona."""
    do_meio = analise.situacao(Classificacao.MAIOR_RELEVANCIA).quantidade + analise.situacao(
        Classificacao.DIVERGENTE
    ).quantidade

    # `do_meio` **não muda**: o `14.049.00054.00` nunca esteve nas duas categorias
    # do meio — era crítico —, e foi para *sem divergência*. O que muda é o total:
    # ele divergia por `0 ≠ 2`, e com `0 = 0` deixa de divergir (ESPEC 031).
    #
    # Os dois números passam a ser **iguais**, e é consequência de o piloto não ter
    # mais crítico nenhum: a partição de `R-ANA-01` a `R-ANA-04` sobre as 36
    # divergências agora cabe inteira nas duas categorias do meio.
    assert do_meio == 36
    assert relatorio.total_divergencias == 36


def test_os_quatro_perfis_estao_em_sem_divergencia(analise: AnaliseDaMedicao) -> None:
    """`R-ANA-08` sobre o piloto: 4 das 21 linhas conformes nunca poderiam divergir.

    Eram cinco: o `14.025.00011.00` contava duas vezes, desdobrado por
    qualificador. `D-01` o consolida numa linha por código.
    """
    conformes = analise.situacao(Classificacao.SEM_DIVERGENCIA)

    assert conformes.perfis_ou_pacotes == 4
    assert {
        str(item.linha.codigo) for item in conformes.itens if item.linha.perfil_ou_pacote
    } == {
        "14.048.00008.00",
        "14.046.00010.00",
        "14.025.00011.00",
        "14.070.00002.00",
    }
