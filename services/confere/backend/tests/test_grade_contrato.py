"""Testes diretos da grade da tabela de itens (ESPEC 017).

São os primeiros testes que tocam `grid.py` sem passar pelo extrator. A ausência
deles é a explicação mecânica de por que o defeito da ESPEC 017 chegou em campo:
não havia onde uma asserção sobre geometria pudesse falhar.
"""

from __future__ import annotations

from collections.abc import Iterator
from pathlib import Path
from typing import Any

import pdfplumber
import pytest

from infrastructure.contract.grid import (
    COLUNAS_DA_TABELA,
    COMPRIMENTO_MINIMO_VERTICAL,
    DIVISORIAS_DA_TABELA,
    ESPESSURA_MAXIMA_DO_TRACO,
    TOLERANCIA,
    _candidatas_verticais,
    _Candidato,
    _escolher_gabarito,
    _faixas_verticais,
    _fronteiras_verticais,
    analisar_geometria,
    derivar_gabarito,
    montar_grade,
)

# Medido no PDF, não copiado da saída do extrator (ESPEC 017 §2.5).
GABARITO_DO_PGM = (51.4, 122.3, 273.0, 353.6, 404.3, 445.3, 491.1, 551.5)


def _filtro_de_referencia(pagina: Any) -> list[float]:
    """T-1131 — fotografia do `_fronteiras_verticais` anterior à ESPEC 017.

    **Cópia literal, e não deve ser mantida em dia.** Ela existe para que a
    T-1105 compare duas implementações em vez de comparar contra uma lista de
    números escrita à mão — que seria um terceiro lugar codificando a geometria
    do piloto, exatamente o vício que a ESPEC 017 remove.

    Guarda a candidata que estiver perto de *alguma* coluna. A assimetria em
    relação ao filtro novo — que pergunta se *a coluna* tem candidata perto — é
    o defeito B da ESPEC 017 §2.3.
    """
    todas = sorted(
        {
            round(r["x0"], 1)
            for r in pagina.rects
            if r["width"] < ESPESSURA_MAXIMA_DO_TRACO
            and r["height"] > COMPRIMENTO_MINIMO_VERTICAL
        }
    )
    return [x for x in todas if any(abs(x - c) < TOLERANCIA for c in COLUNAS_DA_TABELA)]


@pytest.fixture(scope="module")
def paginas_do_piloto(caminho_contrato: Path) -> Iterator[list[Any]]:
    """As páginas só valem enquanto o PDF está aberto — daí o `yield`.

    `pdfplumber` resolve o conteúdo da página sob demanda; devolver a lista de
    dentro de um `with` fechado rende `seek of closed file` na primeira leitura.
    """
    with pdfplumber.open(caminho_contrato) as pdf:
        yield list(pdf.pages)


# ── T-1105 · O casamento por coluna não muda o piloto ─────────────────────────


def test_t1105_as_mesmas_paginas_produzem_grade(paginas_do_piloto: list[Any]) -> None:
    """Portão P2, primeira metade — nenhuma página entra, nenhuma sai.

    A identidade **não** é entre as listas cruas, e a diferença é de desenho: nas
    páginas sem grade o filtro antigo devolve uma lista parcial — as duas ou três
    divisórias que por acaso caíam perto de alguma coluna — enquanto o novo
    devolve vazio, porque nem toda coluna tem candidata (`R-GRD-04`).

    As duas levam `montar_grade` a `None`, e uma lista parcial não significa
    nada. O que precisa ser idêntico é o **conjunto de páginas com grade**.
    """
    antes = {
        numero
        for numero, pagina in enumerate(paginas_do_piloto, start=1)
        if len(_filtro_de_referencia(pagina)) == len(COLUNAS_DA_TABELA)
    }
    depois = {
        numero
        for numero, pagina in enumerate(paginas_do_piloto, start=1)
        if _fronteiras_verticais(pagina, COLUNAS_DA_TABELA)
    }
    assert antes == depois
    assert antes == {25, 26, 27, 28, 29}


def test_t1105_onde_ha_grade_as_divisorias_sao_as_mesmas(
    paginas_do_piloto: list[Any],
) -> None:
    """Portão P2, segunda metade — e é a que autoriza toda a ESPEC 017.

    Nas cinco páginas que produzem grade, as oito divisórias são **iguais**,
    valor por valor. Uma igualdade entre duas implementações prova mais que
    qualquer bateria de asserções sobre o resultado, e custa menos.
    """
    divergentes = [
        (numero, referencia, novo)
        for numero, pagina in enumerate(paginas_do_piloto, start=1)
        if len(referencia := _filtro_de_referencia(pagina)) == len(COLUNAS_DA_TABELA)
        and referencia != (novo := _fronteiras_verticais(pagina, COLUNAS_DA_TABELA))
    ]
    assert divergentes == [], f"{len(divergentes)} páginas divergiram: {divergentes}"


# ── T-1106 · O defeito B, isolado da geometria de qualquer contrato ───────────


class _PaginaFalsa:
    """Só o que `_candidatas_verticais` lê: retângulos finos e altos."""

    def __init__(self, xs: list[float]) -> None:
        self.rects = [
            {"x0": x, "width": 0.7, "height": 60.0, "top": 100.0} for x in xs
        ]


def test_t1106_duas_candidatas_para_a_mesma_coluna_resolvem_para_uma() -> None:
    """O defeito B em caso construído, e não amostrado do `PA-PGM`.

    Os números vêm da página 25 daquele contrato — coluna esperada `404,3`,
    candidatas `404,3` e `405,0`, a `0,7 pt` uma da outra —, mas o teste os
    reproduz sobre o gabarito do piloto para isolar o **mecanismo** da geometria
    de um documento específico. É o que o mantém válido se aquele contrato um
    dia sair da suíte.

    Este é o teste que pega a armadilha de simetria da T-1104: escrever o laço
    na direção antiga passa nos testes do piloto, porque lá as duas direções
    coincidem, e reproduz o defeito com código diferente.
    """
    intrusa = COLUNAS_DA_TABELA[4] + 0.7
    pagina = _PaginaFalsa([*COLUNAS_DA_TABELA, intrusa])

    escolhidas = _fronteiras_verticais(pagina, COLUNAS_DA_TABELA)

    assert len(escolhidas) == len(COLUNAS_DA_TABELA)
    assert escolhidas == list(COLUNAS_DA_TABELA)
    assert intrusa not in escolhidas


def test_t1106_o_filtro_antigo_falharia_neste_caso() -> None:
    """Prova que o caso da T-1106 é o defeito, e não uma asserção decorativa.

    Sem esta contraprova, o teste acima passaria também na implementação antiga
    e não guardaria nada.
    """
    intrusa = COLUNAS_DA_TABELA[4] + 0.7
    pagina = _PaginaFalsa([*COLUNAS_DA_TABELA, intrusa])

    assert len(_filtro_de_referencia(pagina)) == len(COLUNAS_DA_TABELA) + 1


def test_t1106_coluna_sem_candidata_devolve_vazio() -> None:
    """`R-GRD-04` — grade parcial não significa nada."""
    pagina = _PaginaFalsa(list(COLUNAS_DA_TABELA[:-1]))
    assert _fronteiras_verticais(pagina, COLUNAS_DA_TABELA) == []


# ── T-1112 a T-1115 · O gabarito derivado do documento ────────────────────────


@pytest.fixture(scope="module")
def pdf_do_piloto(caminho_contrato: Path) -> Iterator[Any]:
    with pdfplumber.open(caminho_contrato) as pdf:
        yield pdf


@pytest.fixture(scope="module")
def pdf_do_pgm(caminho_contrato_pgm: Path) -> Iterator[Any]:
    with pdfplumber.open(caminho_contrato_pgm) as pdf:
        yield pdf


def test_t1112_o_gabarito_do_piloto_e_a_constante(pdf_do_piloto: Any) -> None:
    """Portão P3 — a ponte entre o mundo antigo e o novo (`R-GRD-09`).

    Não "equivalente", não "dentro da tolerância": **igual**. Se o gabarito
    derivado do piloto é idêntico à constante que o selecionava antes, nada do
    que vinha depois dela pode ter mudado.

    É também o que mantém `COLUNAS_DA_TABELA` honesta em vez de decorativa: o
    dia em que divergir, a suíte cobra.
    """
    assert derivar_gabarito(pdf_do_piloto) == COLUNAS_DA_TABELA


def test_t1113_o_gabarito_do_pgm(pdf_do_pgm: Any) -> None:
    """Outro órgão, outra margem, o mesmo código sem parâmetro de layout."""
    assert derivar_gabarito(pdf_do_pgm) == GABARITO_DO_PGM


def test_t1114_o_concorrente_sem_codigos_nao_e_escolhido(pdf_do_piloto: Any) -> None:
    """`R-GRD-02` sob prova — o desempate por código de serviço `[risco]`.

    A página 30 do piloto traz **outro** conjunto de oito divisórias, com 85% da
    largura útil contra 88% da tabela certa — quase indistinguível por
    geometria. O que a separa é não ter nenhum código de serviço, enquanto as
    páginas da tabela têm 51.

    Um `max()` por vão em vez de por códigos passa em todos os outros testes
    desta suíte e escolhe a tabela errada.
    """
    escolhido = derivar_gabarito(pdf_do_piloto)
    assert escolhido is not None
    assert escolhido[0] != 53.2, "escolheu o conjunto da página 30"


def test_t1114_o_desempate_prefere_codigos_a_vao() -> None:
    """O mesmo desempate sem abrir PDF — continua valendo se o piloto mudar."""
    tabela_certa = _Candidato(divisorias=(34.5, 561.0), paginas=(26, 27, 28), codigos=51)
    concorrente_maior = _Candidato(divisorias=(10.0, 580.0), paginas=(30,), codigos=0)

    assert _escolher_gabarito([concorrente_maior, tabela_certa]) == (34.5, 561.0)


def test_t1114_no_empate_de_codigos_vence_o_maior_vao() -> None:
    estreito = _Candidato(divisorias=(100.0, 400.0), paginas=(5,), codigos=3)
    largo = _Candidato(divisorias=(34.5, 561.0), paginas=(6,), codigos=3)

    assert _escolher_gabarito([estreito, largo]) == (34.5, 561.0)


def test_t1114_sem_candidato_nao_ha_gabarito() -> None:
    assert _escolher_gabarito([]) is None


def test_t1115_as_paginas_com_grade_no_piloto_nao_mudaram(pdf_do_piloto: Any) -> None:
    """`R-GRD-03` — o conjunto de hoje, escrito literalmente (ESPEC 017 §2.6).

    A 25 e a 29 entram por **conter** o gabarito, não por serem iguais a ele: as
    duas trazem também as divisórias do quadro de totais. É o que devolve a
    página do `TOTAL:` à extração.
    """
    gabarito = derivar_gabarito(pdf_do_piloto)
    assert gabarito is not None

    com_grade = {
        numero
        for numero, pagina in enumerate(pdf_do_piloto.pages, start=1)
        if montar_grade(pagina, gabarito) is not None
    }
    assert com_grade == {25, 26, 27, 28, 29}


def test_t1115_as_paginas_com_grade_no_pgm(pdf_do_pgm: Any) -> None:
    gabarito = derivar_gabarito(pdf_do_pgm)
    assert gabarito is not None

    com_grade = {
        numero
        for numero, pagina in enumerate(pdf_do_pgm.pages, start=1)
        if montar_grade(pagina, gabarito) is not None
    }
    assert com_grade == {22, 23, 24, 25}


# ── T-1301 · A descoberta por faixa (ESPEC 019 `R-ADT-08`) ────────────────────


@pytest.fixture(scope="module")
def pdf_do_aditivo(caminho_aditivo_pgm: Path) -> Iterator[Any]:
    with pdfplumber.open(caminho_aditivo_pgm) as pdf:
        yield pdf


def test_t1301_nenhuma_pagina_do_aditivo_tem_oito_divisorias(
    pdf_do_aditivo: Any,
) -> None:
    """O defeito da ESPEC 019 §2.3, medido no documento e não no resultado.

    É a razão de existir da `R-ADT-08`, e precisa de asserção própria: se algum
    dia uma página do aditivo passar a ter oito divisórias, o teste seguinte
    passaria pelo motivo errado e ninguém saberia.
    """
    por_pagina = {
        numero: len(_candidatas_verticais(pagina))
        for numero, pagina in enumerate(pdf_do_aditivo.pages, start=1)
        if _candidatas_verticais(pagina)
    }
    assert por_pagina == {6: 11, 7: 15}
    assert DIVISORIAS_DA_TABELA not in por_pagina.values()


def test_t1301_as_faixas_do_aditivo_revelam_quatro_geometrias(
    pdf_do_aditivo: Any,
) -> None:
    """A união de duas tabelas não tem oito divisórias; cada faixa tem.

    Quatro conjuntos: `Aumento` e `Redução` na página 6, `Inclusão` e o
    cronograma físico-financeiro na 7. O crivo de `D-05` reduz a três — mas essa
    é outra asserção, no extrator, porque depende de ler célula.
    """
    conjuntos = {
        tuple(sorted(xs))
        for pagina in pdf_do_aditivo.pages
        for xs in _faixas_verticais(pagina).values()
        if len(xs) == DIVISORIAS_DA_TABELA
    }
    assert len(conjuntos) == 4


def test_t1301_as_tres_geometrias_de_itens_nao_se_confundem(
    pdf_do_aditivo: Any,
) -> None:
    """`D-04` — não são variações dentro da tolerância; são geometrias distintas.

    `272,2` contra `274,5` são 2,3 pt e `354,0` contra `355,5` são 1,5 pt, ambas
    fora de `TOLERANCIA`. É o que impede um gabarito único de ler as três, e o
    que torna a lista de `R-ADT-08` necessária em vez de conveniente.
    """
    aumento = (53.2, 126.7, 272.2, 354.0, 408.0, 449.2, 496.5, 561.0)
    inclusao = (53.2, 126.7, 274.5, 355.5, 408.7, 450.0, 496.5, 561.0)

    distancias = [abs(a - b) for a, b in zip(aumento, inclusao, strict=True)]
    assert max(distancias) >= TOLERANCIA

    # E a prova operacional: a geometria da `Inclusão` não monta grade na página
    # do `Aumento`, nem o contrário. É `R-GRD-04` fazendo o seu trabalho.
    pagina_6, pagina_7 = pdf_do_aditivo.pages[5], pdf_do_aditivo.pages[6]
    assert montar_grade(pagina_6, aumento) is not None
    assert montar_grade(pagina_6, inclusao) is None
    assert montar_grade(pagina_7, inclusao) is not None
    assert montar_grade(pagina_7, aumento) is None


@pytest.mark.parametrize(
    ("nome", "candidatas"),
    [("piloto", 2), ("pgm", 2), ("aditivo", 4)],
)
def test_t1302_toda_geometria_de_sete_colunas_e_devolvida(
    nome: str,
    candidatas: int,
    pdf_do_piloto: Any,
    pdf_do_pgm: Any,
    pdf_do_aditivo: Any,
) -> None:
    """`R-ADT-08` — `analisar_geometria` deixou de devolver só a campeã.

    As propostas têm duas — tabela de itens e cronograma —, e o aditivo tem
    quatro. A redução ao que é tabela de itens é do extrator (`D-05`).
    """
    pdf = {"piloto": pdf_do_piloto, "pgm": pdf_do_pgm, "aditivo": pdf_do_aditivo}[nome]
    geometria = analisar_geometria(pdf)

    assert len(geometria.candidatos) == candidatas
    # A primeira é a campeã de `R-GRD-02`, e continua sendo o `gabarito`.
    assert geometria.candidatos[0].divisorias == geometria.gabarito


def test_t1302_a_descoberta_por_faixa_nao_move_o_gabarito_das_propostas(
    pdf_do_piloto: Any, pdf_do_pgm: Any
) -> None:
    """Portão da ESPEC 019 §9.1 — `R-ADT-08` é estreitamento, não afrouxamento.

    Se o gabarito das duas propostas é o mesmo de antes, nada do que vinha depois
    dele pode ter mudado. É a mesma prova que a T-1112 faz para a ESPEC 017,
    agora contra a troca de página por faixa.
    """
    assert derivar_gabarito(pdf_do_piloto) == COLUNAS_DA_TABELA
    assert derivar_gabarito(pdf_do_pgm) == GABARITO_DO_PGM
