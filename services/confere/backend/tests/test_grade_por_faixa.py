"""T-2199 a T-2201 / ESPEC 033 — as divisórias que valem em cada linha.

Até aqui a grade era **da página**: as verticais de uma geometria valiam para
todas as linhas da folha. O `PA-SMUL-250314-22` põe três tabelas de itens de
larguras diferentes na mesma página, e a grade de uma passa a fatiar as linhas
das outras (`R-FXA-01` a `R-FXA-05`).

As asserções citam as faixas pelos valores medidos no PDF, para que uma
regressão apareça pelo número e não por um `assert` genérico.
"""

from __future__ import annotations

from collections.abc import Iterator
from pathlib import Path
from typing import Any

import pdfplumber
import pytest

from infrastructure.contract.grid import Grade, montar_grade, verticais_por_linha

# As quatro geometrias da página 4 do `aditivo_smul.pdf`, medidas na `T-2198`.
#
# A `Inclusão` aparece **duas vezes** porque o desenho muda no meio da página:
# a borda anda 0,6 pt à esquerda a partir de `y=80,7`. É a mesma tabela.
INCLUSAO_TOPO = [38.7, 99.9, 230.1, 299.7, 379.5, 429.3, 462.9, 515.1]
INCLUSAO_BASE = [38.7, 99.9, 230.7, 299.7, 378.9, 428.7, 462.3, 515.1]
REDUCAO = [38.7, 99.9, 230.1, 299.7, 343.5, 378.9, 428.7, 516.9]
AUMENTO = [38.7, 99.9, 230.1, 299.7, 343.5, 378.9, 431.7, 515.1]
CRONOGRAMA = [38.7, 82.5, 147.9, 213.3, 278.7, 344.1, 409.5, 474.9]


@pytest.fixture(scope="module")
def pagina_4(caminho_aditivo_smul: Path) -> Iterator[Any]:
    with pdfplumber.open(caminho_aditivo_smul) as pdf:
        yield pdf.pages[3]


@pytest.fixture(scope="module")
def grade_da_inclusao(pagina_4: Any) -> Grade:
    """A grade que o extrator monta hoje para a página 4, pelo gabarito.

    É a geometria da `Inclusão` — a campeã de `R-GRD-02`, com 16 códigos entre
    as páginas 3 e 4 — e é ela que hoje lê a folha inteira.
    """
    grade = montar_grade(pagina_4, tuple(INCLUSAO_TOPO))
    assert grade is not None
    return grade


def _linha_em(grade: Grade, altura: float) -> int:
    """O índice da linha da grade que contém aquela altura."""
    for indice in range(len(grade.horizontais) - 1):
        if grade.horizontais[indice] <= altura < grade.horizontais[indice + 1]:
            return indice
    raise AssertionError(f"nenhuma linha da grade contém y={altura}")


# ── T-2199 · Cada linha lê com as divisórias da sua tabela ────────────────────


@pytest.mark.parametrize(
    ("altura", "esperado", "o_que_e"),
    [
        (40.0, INCLUSAO_TOPO, "Inclusão, primeira faixa"),
        (73.0, INCLUSAO_TOPO, "Inclusão, terceira faixa"),
        (90.0, INCLUSAO_BASE, "Inclusão, depois da deriva de 0,6 pt"),
        (190.0, INCLUSAO_BASE, "Inclusão, última linha de item"),
        (300.0, REDUCAO, "a linha do 12.030.00002.00"),
        (460.0, AUMENTO, "Aumento, primeira linha de item"),
        (520.0, AUMENTO, "Aumento, terceira linha de item"),
        (760.0, CRONOGRAMA, "cronograma físico-financeiro"),
    ],
)
def test_t2199_cada_linha_usa_as_divisorias_desenhadas_na_sua_faixa(
    pagina_4: Any,
    grade_da_inclusao: Grade,
    altura: float,
    esperado: list[float],
    o_que_e: str,
) -> None:
    """`R-FXA-01` — a faixa desenhada manda, e não a geometria da página.

    A grade é sempre a mesma — a da `Inclusão` —, e mesmo assim cada linha sai
    com as divisórias da tabela a que pertence. Sem isto, a linha da `Redução`
    seria lida sem o corte em `343,5` e com um corte espúrio em `462,9`
    (ESPEC 033 §2.3).
    """
    por_linha = verticais_por_linha(pagina_4, grade_da_inclusao)

    assert por_linha[_linha_em(grade_da_inclusao, altura)] == esperado, o_que_e


def test_t2199_a_linha_do_item_da_reducao_nao_usa_a_grade_da_inclusao(
    pagina_4: Any, grade_da_inclusao: Grade
) -> None:
    """A asserção que prova o critério, e não apenas o resultado `[risco]`.

    A diferença entre as duas grades é de **duas** divisórias, e são as duas que
    quebram a linha: falta `343,5` na `Inclusão`, e sobra `462,9` dentro da
    coluna de total da `Redução`.
    """
    vertical = verticais_por_linha(pagina_4, grade_da_inclusao)[
        _linha_em(grade_da_inclusao, 300.0)
    ]

    assert 343.5 in vertical, "sem este corte, preço e quantidade saem fundidos"
    assert 462.9 not in vertical, "com este corte, o sinal se separa do número"
    assert vertical != grade_da_inclusao.verticais


# ── T-2200 · A herança da linha `TOTAL:` ──────────────────────────────────────


@pytest.mark.parametrize(
    ("altura", "esperado", "bloco"),
    [
        (210.0, INCLUSAO_BASE, "Inclusão TOTAL:"),
        (350.0, REDUCAO, "Redução TOTAL:"),
        (550.0, AUMENTO, "Aumento TOTAL:"),
    ],
)
def test_t2200_a_linha_de_total_herda_da_tabela_a_que_pertence(
    pagina_4: Any,
    grade_da_inclusao: Grade,
    altura: float,
    esperado: list[float],
    bloco: str,
) -> None:
    """`R-FXA-03` — célula mesclada não desenha oito traços; desenha dois.

    Sem a herança, a linha `Redução TOTAL:` seria lida pela grade da página e
    sairia `['…', 'Redução TOTAL:', '-986.810,00', 'BRL']` — o valor à esquerda
    da moeda, porque ele quebra para a segunda linha visual. `_total_declarado`
    devolveria `None`, o bloco não fecharia, e o seu item migraria para o bloco
    seguinte com o rótulo errado.
    """
    por_linha = verticais_por_linha(pagina_4, grade_da_inclusao)

    assert por_linha[_linha_em(grade_da_inclusao, altura)] == esperado, bloco


def test_t2200_a_heranca_e_por_subconjunto_e_nao_por_proximidade() -> None:
    """`D-05` — o teste que reprova *"vale a última linha que teve divisórias"*.

    Os dois traços do `Redução TOTAL:` são `428,7` e `516,9`. O `516,9` **não
    existe** no conjunto da `Inclusão`, que é a tabela imediatamente acima na
    folha — e é por isso que a herança por proximidade levaria a linha para a
    tabela errada.
    """
    tracos_do_total_da_reducao = {428.7, 516.9}

    assert tracos_do_total_da_reducao <= set(REDUCAO)
    assert not tracos_do_total_da_reducao <= set(INCLUSAO_BASE)
    assert 516.9 not in INCLUSAO_BASE


def test_t2200_linha_fora_de_qualquer_tabela_cai_na_grade_da_pagina(
    pagina_4: Any, grade_da_inclusao: Grade
) -> None:
    """`R-FXA-04` — o branco entre dois blocos não herda nada.

    Entre o `Inclusão TOTAL:` (termina em `224,7`) e o cabeçalho da `Redução`
    (começa em `257,7`) não há traço desenhado. A linha cai nas divisórias da
    página, que é o comportamento de hoje — e é o que mantém intactos os
    documentos cuja tabela não desenha traço por linha.
    """
    por_linha = verticais_por_linha(pagina_4, grade_da_inclusao)

    assert por_linha[_linha_em(grade_da_inclusao, 240.0)] == grade_da_inclusao.verticais


# ── T-2201 · A cobertura, medida com a espessura do traço ─────────────────────


class _PaginaDeTraços:
    """Página mínima: só o que `_faixas_verticais` lê.

    Caso construído, sem abrir PDF, no espírito de `_escolher_gabarito` — a
    tolerância de cobertura pode ser provada sem documento nenhum.
    """

    def __init__(self, rects: list[dict[str, float]]) -> None:
        self.rects = rects


def _traco(x0: float, topo: float, base: float) -> dict[str, float]:
    return {"x0": x0, "top": topo, "bottom": base, "width": 0.7, "height": base - topo}


COLUNAS = [34.5, 117.0, 262.5, 352.5, 403.5, 447.7, 498.0, 561.0]
PAGINA = [30.0, 120.0, 260.0, 350.0, 400.0, 445.0, 495.0, 560.0]


def test_t2201_a_faixa_cobre_a_linha_apesar_da_espessura_da_borda() -> None:
    """`R-FXA-05` — `57,0` contra `57,7`, e a razão de a folga existir.

    A fronteira horizontal é lida em `top`; o traço vertical começa na **base**
    daquela borda, 0,7 pt abaixo. Exigir coincidência exata faria **nenhuma**
    linha do piloto achar a sua faixa, e o documento inteiro cairia na grade da
    página — sem erro, e sem correção.
    """
    pagina = _PaginaDeTraços([_traco(x, 57.7, 99.7) for x in COLUNAS])
    grade = Grade(horizontais=[57.0, 99.0], verticais=PAGINA)

    assert verticais_por_linha(pagina, grade) == [COLUNAS]


def test_t2201_faixa_que_nao_cobre_a_linha_nao_vale() -> None:
    """A folga é a espessura do traço, e não um limiar generoso.

    Uma faixa que começa 3 pt abaixo do topo da linha é de outra linha. Aceitá-la
    seria trocar a fronteira desenhada por uma vizinhança arbitrária.
    """
    pagina = _PaginaDeTraços([_traco(x, 60.7, 99.7) for x in COLUNAS])
    grade = Grade(horizontais=[57.0, 99.0], verticais=PAGINA)

    assert verticais_por_linha(pagina, grade) == [PAGINA]


def test_t2201_entre_duas_faixas_que_cobrem_vale_a_mais_estreita() -> None:
    """`R-FXA-02` — a mais específica é a da linha, não a da moldura.

    Não ocorre nos documentos de hoje, e é limite declarado: uma tabela desenhada
    com moldura externa **e** traço por linha teria as duas cobrindo a mesma
    linha, e a externa é a que não sabe nada sobre ela.
    """
    moldura = [30.0, 118.0, 261.0, 351.0, 401.0, 446.0, 496.0, 561.0]
    pagina = _PaginaDeTraços(
        [_traco(x, 40.0, 200.0) for x in moldura] + [_traco(x, 57.7, 99.7) for x in COLUNAS]
    )
    grade = Grade(horizontais=[57.0, 99.0], verticais=PAGINA)

    assert verticais_por_linha(pagina, grade) == [COLUNAS]
