"""T-1706 a T-1709 — A divergência de contratado, estruturada (ESPEC 023).

A `V-REC-01` deixou de ser cinco frases e passou a ser um registro por código,
com a diferença que endereça o aditivo faltante e a severidade que separa os
dois diagnósticos.

**O oráculo é o mesmo da ESPEC 022** — `DELTAS_DO_ADITIVO`, transcrito do PDF.
Reaproveitá-lo é deliberado: a coluna de diferença desta espec **é**, número a
número, o conteúdo dos blocos daquela, e importar a constante é o que trava essa
igualdade.
"""

from __future__ import annotations

from decimal import Decimal
from pathlib import Path

import pytest

from domain.entities.report import DivergenciaDeFonte
from domain.entities.validation_finding import ValidationReport
from domain.value_objects.classification import Classificacao
from infrastructure.di.container import DIContainer, Entradas, _deltas_por_codigo
from infrastructure.validations.reconciliation_validations import (
    v_rec_01_divergencia_de_quantidade_contratada as v_rec_01,
)
from tests.test_quantitativo_consolidado import (
    CODIGO_ADULTERADO,
    DELTAS_DO_ADITIVO,
    _ContainerComAbaAdulterada,
)

# `R-FON-06` — magnitude relativa decrescente. Calculada sobre o oráculo, não
# transcrita da saída do código:
#
#   14.048.00027.00     200,00 →  1.300,00   +550%
#   14.031.00020.00       5,00 →     10,00   +100%
#   12.030.00001.00     150,00 →     70,00    −53%
#   14.024.00006.00   6.100,00 →  9.000,89    +48%
#   10.050.00001.00  42.260,00 → 42.814,01     +1%
ORDEM_POR_MAGNITUDE = [
    "14.048.00027.00",
    "14.031.00020.00",
    "12.030.00001.00",
    "14.024.00006.00",
    "10.050.00001.00",
]


@pytest.fixture(scope="module")
def sem_aditivo(caminho_contrato_pgm: Path, caminho_levantamento_pgm: Path):  # type: ignore[no-untyped-def]
    return DIContainer().gerar(
        Entradas(contrato=caminho_contrato_pgm, levantamento=caminho_levantamento_pgm)
    )


@pytest.fixture(scope="module")
def com_aditivo_e_aba_adulterada(  # type: ignore[no-untyped-def]
    caminho_contrato_pgm: Path,
    caminho_aditivo_pgm: Path,
    caminho_levantamento_pgm: Path,
):
    """O estado B, que **nenhuma fixture do repositório produz**.

    Reaproveita o container da ESPEC 022 que adultera a aba em memória — mesma
    adulteração, outra pergunta: lá se media se a divergência era *acusada*, aqui
    se mede como ela é *descrita*.
    """
    extrator = DIContainer().extrator_de_contrato()
    return _ContainerComAbaAdulterada(
        {
            caminho_contrato_pgm: extrator.extrair(caminho_contrato_pgm),
            caminho_aditivo_pgm: extrator.extrair(caminho_aditivo_pgm),
        },
        DIContainer().leitor_de_medicao().ler(caminho_levantamento_pgm),
    ).gerar(
        Entradas(
            contrato=caminho_contrato_pgm,
            levantamento=caminho_levantamento_pgm,
            aditivos=(caminho_aditivo_pgm,),
        )
    )


# ── T-1706 · as cinco divergências, com a diferença ───────────────────────────


def test_t1706_as_cinco_divergencias_do_pgm(sem_aditivo) -> None:  # type: ignore[no-untyped-def]
    """`R-FON-01` — uma entrada por código, com contrato e planilha."""
    assert len(sem_aditivo.divergencias) == 5

    por_codigo = {d.codigo: d for d in sem_aditivo.divergencias}
    assert por_codigo["14.048.00027.00"].no_contrato == Decimal("200.00")
    assert por_codigo["14.048.00027.00"].na_planilha == Decimal("1300")
    assert por_codigo["10.050.00001.00"].no_contrato == Decimal("42260.00")
    assert por_codigo["10.050.00001.00"].na_planilha == Decimal("42814.01")


def test_t1706_a_diferenca_e_o_conteudo_do_aditivo(sem_aditivo) -> None:  # type: ignore[no-untyped-def]
    """`R-FON-05` / `D-03` — **a razão de a tabela existir.**

    A diferença de cada linha é, número a número, a quantidade que os blocos
    `Aumento` e `Redução` do aditivo trazem. Quem abrir o PDF encontra `554,01`
    lá.

    É o que transforma o aviso de *"algo está diferente"* em *"procure por 554,01
    no aditivo"*. Se esta asserção cair, a coluna vira aritmética decorativa.
    """
    diferencas = {d.codigo: d.diferenca for d in sem_aditivo.divergencias}

    assert diferencas == DELTAS_DO_ADITIVO


def test_t1706_o_contratado_zero_nao_estoura() -> None:
    """Contratado zero não é divisível, e **não é erro**.

    Nenhum código dos pares reais tem contratado zero, e é por isso que o caso
    precisa de teste próprio: ele não aparece em fixture nenhuma. A variação sai
    `None`, e a magnitude o ordena como o maior possível — em proporção, é.
    """
    divergencia = DivergenciaDeFonte(
        codigo="99.999.00001.00",
        descricao="X",
        unidade="UN",
        no_contrato=Decimal(0),
        na_planilha=Decimal(10),
    )

    assert divergencia.variacao is None
    assert divergencia.magnitude == Decimal("Infinity")
    assert divergencia.diferenca == Decimal(10)


# ── T-1707 · a ordem ──────────────────────────────────────────────────────────


def test_t1707_a_ordem_e_por_magnitude(sem_aditivo) -> None:  # type: ignore[no-untyped-def]
    """`R-FON-06` — maior primeiro, e não a ordem do contrato.

    Quem lê está triando, não percorrendo o documento. Na frase de hoje o `+550%`
    do `14.048.00027.00` e o `+1%` do `10.050.00001.00` têm o mesmo peso visual,
    e um pede atenção enquanto o outro é ruído.

    Falha se alguém "arrumar" a ordenação para casar com a do grid.
    """
    assert [d.codigo for d in sem_aditivo.divergencias] == ORDEM_POR_MAGNITUDE


# ── T-1708 · as duas severidades ──────────────────────────────────────────────


def test_t1708_sem_aditivo_a_severidade_e_maior_relevancia(sem_aditivo) -> None:  # type: ignore[no-untyped-def]
    """`R-FON-02`, primeira metade — o diagnóstico provável é *falta uma peça*."""
    assert {d.severidade for d in sem_aditivo.divergencias} == {
        Classificacao.MAIOR_RELEVANCIA
    }
    assert not any(d.tem_aditivo_aplicado for d in sem_aditivo.divergencias)


def test_t1708_com_aditivo_a_remanescente_e_critica(com_aditivo_e_aba_adulterada) -> None:  # type: ignore[no-untyped-def]
    """`R-FON-02`, segunda metade — **é o conteúdo desta espec.**

    Com o aditivo aplicado e a aba ainda divergindo, os números não fecham *nem
    com a peça*: falta outra, ou um dos dois documentos está errado. É o mais
    próximo de *dado errado* que o sistema detecta, e não pode chegar ao usuário
    com a mesma tarja do caso rotineiro.

    Se este teste cair junto com a `T-1708` de cima, os dois estados colapsaram —
    e o que sobrou da entrega foi uma tabela mais bonita.
    """
    (divergencia,) = com_aditivo_e_aba_adulterada.divergencias

    assert divergencia.codigo == CODIGO_ADULTERADO
    assert divergencia.severidade is Classificacao.CRITICO
    assert divergencia.tem_aditivo_aplicado


# ── T-1709 · a decomposição ───────────────────────────────────────────────────


def test_t1709_a_decomposicao_traz_os_dois_numeros(com_aditivo_e_aba_adulterada) -> None:  # type: ignore[no-untyped-def]
    """`R-FON-04` — proposta **e** delta, não a soma.

    Sem os dois, `1.300,00` é um número que o leitor tem de aceitar. Com eles, a
    tela prova que somou, e o `200,00 + 1.100,00` é conferível contra o PDF.
    """
    (divergencia,) = com_aditivo_e_aba_adulterada.divergencias

    assert divergencia.no_aditivo == Decimal("1100.00")
    assert divergencia.no_contrato == Decimal("1300.00")
    assert divergencia.no_contrato - divergencia.no_aditivo == Decimal("200.00")


# ── A guarda: `deltas` descreve, não decide ───────────────────────────────────


def test_deltas_nao_alteram_o_que_e_comparado(
    caminho_contrato_pgm: Path, caminho_aditivo_pgm: Path, caminho_levantamento_pgm: Path
) -> None:
    """`deltas` tem a forma do antigo `explicados` e o papel oposto.

    Aquele **suprimia** comparações — e a ESPEC 022 §2.4 mediu o que isso
    escondia. Este só enriquece o relato de uma divergência já encontrada.

    A confusão entre os dois é barata de cometer e cara de descobrir, e esta é a
    asserção que a impede: os mesmos códigos e as mesmas diferenças, com e sem o
    mapa.
    """
    extrator = DIContainer().extrator_de_contrato()
    proposta = extrator.extrair(caminho_contrato_pgm)
    medicao = DIContainer().leitor_de_medicao().ler(caminho_levantamento_pgm)

    sem = v_rec_01(proposta, medicao, ValidationReport())
    com = v_rec_01(
        proposta,
        medicao,
        ValidationReport(),
        deltas=_deltas_por_codigo([extrator.extrair(caminho_aditivo_pgm)]),
    )

    assert [d.codigo for d in sem] == [d.codigo for d in com]
    assert [d.diferenca for d in sem] == [d.diferenca for d in com]


def test_deltas_por_codigo_acumula_entre_pecas(caminho_aditivo_pgm: Path) -> None:
    """T-1713 — o mapa **soma** o que as peças trazem, e não sobrescreve.

    Duas peças podem tocar o mesmo código, e o que interessa a `R-FON-04` é o
    total que entrou no consolidado. A duplicação da mesma peça serve de
    exercício: `V-ADT-03` a bloquearia em produção, e aqui a função é chamada
    isolada.
    """
    aditivo = DIContainer().extrator_de_contrato().extrair(caminho_aditivo_pgm)

    um = _deltas_por_codigo([aditivo])
    dois = _deltas_por_codigo([aditivo, aditivo])

    assert um == DELTAS_DO_ADITIVO
    assert dois["10.050.00001.00"] == DELTAS_DO_ADITIVO["10.050.00001.00"] * 2
