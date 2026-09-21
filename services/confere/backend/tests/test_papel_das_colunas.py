"""T-2674 / T-2675 / ESPEC 045 — o papel de preço, quantidade e período.

`classificar_rotulo_de_coluna` e `resolver_papel_das_colunas` são funções puras
sobre texto já extraído — nenhuma abre PDF, no espírito de `_escolher_gabarito`
(ESPEC 017) e `_faixa_mais_estreita` (ESPEC 033): entrada de dados simples, para
que o crivo do vocabulário fechado (`R-COL-02`) e a resolução do papel
(`R-COL-04`) possam ser provados sem abrir arquivo nenhum.
"""

from __future__ import annotations

from infrastructure.contract.grid import (
    classificar_rotulo_de_coluna,
    resolver_papel_das_colunas,
)

# ── T-2674 · `classificar_rotulo_de_coluna` — o vocabulário fechado ───────────


def test_t2674a_preco_unitario_classifica_preco() -> None:
    assert classificar_rotulo_de_coluna("PREÇO UNITÁRIO (R$)") == "preco"


def test_t2674b_unitario_sozinho_classifica_preco() -> None:
    """Metade do cabeçalho de "5.4 Data Center" — a outra linha traz `Unitário`
    isolado, sem a palavra `PREÇO` (medido na ESPEC §2.2)."""
    assert classificar_rotulo_de_coluna("Unitário") == "preco"


def test_t2674c_qtde_classifica_quantidade() -> None:
    assert classificar_rotulo_de_coluna("QTDE") == "quantidade"


def test_t2674d_quantidade_contratado_classifica_quantidade() -> None:
    assert classificar_rotulo_de_coluna("Quantidade Contratado") == "quantidade"


def test_t2674e_periodo_mes_classifica_meses() -> None:
    assert classificar_rotulo_de_coluna("PERIODO (MÊS)") == "meses"


def test_t2674f_periodo_mes_quebrado_em_duas_linhas_classifica_meses() -> None:
    assert classificar_rotulo_de_coluna("Período Mês") == "meses"


def test_t2674g_total_nao_classifica() -> None:
    assert classificar_rotulo_de_coluna("TOTAL (R$)") is None


def test_t2674h_texto_vazio_nao_classifica() -> None:
    assert classificar_rotulo_de_coluna("") is None


def test_t2674i_texto_fora_do_vocabulario_nao_classifica() -> None:
    """A frase de prosa medida na ESPEC §2.4, ao lado do cabeçalho de "5.4":
    "Ocorrerá limitação de banda na quantidade contratada." — contém a palavra
    `quantidade` e classifica como tal quando isolada (é o mesmo texto que o
    cabeçalho legítimo usa). A guarda contra o falso positivo não é aqui: é o
    fato de essa frase cair na coluna de descrição, nunca nas colunas 3-5 —
    `R-COL-03`, exercitado em `test_ordem_alternativa_de_colunas.py`."""
    assert classificar_rotulo_de_coluna("CÓDIGO") is None
    assert classificar_rotulo_de_coluna("DESCRIÇÃO") is None
    assert classificar_rotulo_de_coluna("UNIDADE") is None


# ── T-2675 · `resolver_papel_das_colunas` — a fusão das três colunas ─────────


def test_t2675a_tres_papeis_distintos_resolve() -> None:
    """A ordem canônica de "5.2"/"5.3" — uma linha só, sem quebra."""
    pendentes = {
        3: ["PREÇO UNITÁRIO (R$)"],
        4: ["QTDE"],
        5: ["PERIODO (MÊS)"],
    }
    assert resolver_papel_das_colunas(pendentes) == {"preco": 3, "quantidade": 4, "meses": 5}


def test_t2675b_ordem_invertida_tambem_resolve() -> None:
    """A ordem de "5.4 Data Center" (ESPEC §2.4) — o mapeamento segue o texto,
    não a posição."""
    pendentes = {
        3: ["Quantidade", "Contratado"],
        4: ["Período", "Mês"],
        5: ["Unitário"],
    }
    assert resolver_papel_das_colunas(pendentes) == {"quantidade": 3, "meses": 4, "preco": 5}


def test_t2675c_cabecalho_quebrado_em_duas_linhas_resolve() -> None:
    """A quebra física medida na ESPEC §2.2: `Quantidade`/`Período` numa linha
    do PDF, `Contratado`/`Mês`/`Unitário` na seguinte — o buffer acumula as
    duas antes de a linha de item chegar."""
    pendentes = {
        3: ["Quantidade", "Contratado"],
        4: ["Período", "Mês"],
        5: ["", "Unitário"],
    }
    assert resolver_papel_das_colunas(pendentes) == {"quantidade": 3, "meses": 4, "preco": 5}


def test_t2675d_coluna_sem_rotulo_reconhecido_nao_resolve() -> None:
    pendentes = {3: ["PREÇO UNITÁRIO (R$)"], 4: ["QTDE"], 5: [""]}
    assert resolver_papel_das_colunas(pendentes) is None


def test_t2675e_papel_repetido_nao_resolve() -> None:
    """Duas colunas casando o mesmo papel — rótulo ambíguo ou linha de prosa
    solta — não decide sozinho."""
    pendentes = {3: ["PREÇO UNITÁRIO (R$)"], 4: ["PREÇO"], 5: ["PERIODO (MÊS)"]}
    assert resolver_papel_das_colunas(pendentes) is None


def test_t2675f_todas_as_colunas_vazias_nao_resolve() -> None:
    assert resolver_papel_das_colunas({3: [], 4: [], 5: []}) is None


def test_t2675g_buffer_sem_todas_as_tres_colunas_nao_resolve() -> None:
    """Só duas colunas presentes no dicionário — a terceira nunca acumulou
    nada, porque a linha de cabeçalho não chegou a preenchê-la."""
    pendentes = {3: ["PREÇO UNITÁRIO (R$)"], 4: ["QTDE"]}
    assert resolver_papel_das_colunas(pendentes) is None
