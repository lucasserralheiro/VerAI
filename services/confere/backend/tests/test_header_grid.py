"""17/11/2026 — leitura da tabela de itens sem grade (`header_grid.py`).

Achado no `PA-SPCine-211118-152`: a tabela de itens não tem borda nenhuma,
só texto alinhado por coluna. Os testes usam uma página falsa — só o que
`achar_cabecalhos`/`ler_linhas_sem_grade` leem: `extract_words()`, `width`,
`height` — para provar o mecanismo sem depender de PDF nenhum.
"""

from __future__ import annotations

from typing import Any

from infrastructure.contract.header_grid import (
    achar_cabecalhos,
    ler_linhas_sem_grade,
)


def _p(texto: str, x0: float, top: float, largura: float = 20.0, altura: float = 10.0) -> dict[str, Any]:
    return {"text": texto, "x0": x0, "x1": x0 + largura, "top": top, "bottom": top + altura}


class _PaginaDeTexto:
    def __init__(self, palavras: list[dict[str, Any]], width: float = 600.0, height: float = 800.0) -> None:
        self._palavras = palavras
        self.width = width
        self.height = height

    def extract_words(self) -> list[dict[str, Any]]:
        return self._palavras


_CABECALHO = [
    _p("CÓDIGO", 30, 100),
    _p("DESCRIÇÃO", 90, 100),
    _p("UNIDADE", 300, 100),
    _p("PREÇO", 350, 100),
    _p("QTDE", 400, 100),
    _p("PERÍODO", 450, 100),
    _p("TOTAL", 500, 100),
]


def _item(codigo: str, top: float, descricao: list[tuple[str, float]] | None = None) -> list[dict[str, Any]]:
    descricao = descricao or [("ITEM", 90), ("UM", 120)]
    return [
        _p(codigo, 30, top),
        *[_p(t, x, top) for t, x in descricao],
        _p("UN", 300, top),
        _p("10,00", 350, top),
        _p("2", 400, top),
        _p("12", 450, top),
        _p("120,00", 500, top),
    ]


# ── achar_cabecalhos ──────────────────────────────────────────────────────────


def test_acha_um_cabecalho_com_as_sete_colunas_na_ordem() -> None:
    pagina = _PaginaDeTexto([*_CABECALHO, *_item("14.048.00010.00", 120)])

    (cabecalho,) = achar_cabecalhos(pagina)

    assert cabecalho.topo == 100
    assert len(cabecalho.divisorias) == 8
    assert list(cabecalho.divisorias) == sorted(cabecalho.divisorias)


def test_cabecalho_fora_de_ordem_nao_e_achado() -> None:
    """CÓDIGO depois de DESCRIÇÃO não é o cabeçalho da tabela de itens."""
    fora_de_ordem = [
        _p("DESCRIÇÃO", 30, 100),
        _p("CÓDIGO", 90, 100),
        _p("UNIDADE", 300, 100),
        _p("PREÇO", 350, 100),
        _p("QTDE", 400, 100),
        _p("PERÍODO", 450, 100),
        _p("TOTAL", 500, 100),
    ]
    pagina = _PaginaDeTexto(fora_de_ordem)

    assert achar_cabecalhos(pagina) == []


def test_cabecalho_incompleto_nao_e_achado() -> None:
    """Falta UNIDADE: os outros seis rótulos não bastam."""
    incompleto = [p for p in _CABECALHO if p["text"] != "UNIDADE"]
    pagina = _PaginaDeTexto(incompleto)

    assert achar_cabecalhos(pagina) == []


def test_duas_secoes_na_mesma_pagina_acham_dois_cabecalhos() -> None:
    """O PA-SPCine repete o cabeçalho de seção em seção, na mesma página."""
    segunda_secao = [_p(p["text"], p["x0"], p["top"] + 300) for p in _CABECALHO]
    pagina = _PaginaDeTexto([*_CABECALHO, *segunda_secao])

    achados = achar_cabecalhos(pagina)

    assert [c.topo for c in achados] == [100, 400]


# ── ler_linhas_sem_grade ──────────────────────────────────────────────────────


def test_sem_cabecalho_nao_ha_linha() -> None:
    pagina = _PaginaDeTexto(_item("14.048.00010.00", 120))
    assert ler_linhas_sem_grade(pagina) == []


def test_le_um_item_de_linha_unica() -> None:
    pagina = _PaginaDeTexto([*_CABECALHO, *_item("14.048.00010.00", 120)])

    (linha,) = ler_linhas_sem_grade(pagina)

    assert linha == ["14.048.00010.00", "ITEM UM", "UN", "10,00", "2", "12", "120,00"]


def test_descricao_de_tres_linhas_junta_so_a_descricao() -> None:
    """Só a coluna de descrição embrulha — as numéricas ficam na 1ª linha."""
    item = _item(
        "14.048.00010.00",
        120,
        descricao=[("PLATAFORMA", 90)],
    )
    continuacao_1 = [_p("DE", 90, 130), _p("BANCO", 130, 130)]
    continuacao_2 = [_p("DE", 90, 140), _p("DADOS", 130, 140)]
    pagina = _PaginaDeTexto([*_CABECALHO, *item, *continuacao_1, *continuacao_2])

    (linha,) = ler_linhas_sem_grade(pagina)

    assert linha[1] == "PLATAFORMA DE BANCO DE DADOS"
    assert linha == ["14.048.00010.00", "PLATAFORMA DE BANCO DE DADOS", "UN", "10,00", "2", "12", "120,00"]


def test_dois_itens_a_fronteira_e_o_topo_do_segundo() -> None:
    pagina = _PaginaDeTexto(
        [
            *_CABECALHO,
            *_item("14.048.00010.00", 120),
            *_item("14.046.00008.00", 150),
        ]
    )

    linhas = ler_linhas_sem_grade(pagina)

    assert [linha[0] for linha in linhas] == ["14.048.00010.00", "14.046.00008.00"]


def test_numeracao_de_secao_fecha_a_tabela_e_prosa_depois_nao_entra() -> None:
    """`5.3.` na coluna do código fecha a seção — a prosa que vem depois
    (`TRIBUTOS`, a mesma posição da descrição) não entra na descrição do
    último item (achado real: ela entraria, inflando a descrição)."""
    item = _item("14.048.00010.00", 120)
    marca_de_secao = _p("5.3.", 35, 150)
    prosa_depois = _p("TRIBUTOS", 90, 155)
    pagina = _PaginaDeTexto([*_CABECALHO, *item, marca_de_secao, prosa_depois])

    (linha,) = ler_linhas_sem_grade(pagina)

    assert linha[1] == "ITEM UM"


def test_limite_da_ultima_descricao_sem_marca_de_secao() -> None:
    """Sem marca de seção nem próximo item, a descrição do último item tem
    um limite declarado (`LIMITE_DA_ULTIMA_DESCRICAO`) — não lê a página
    inteira até o fim."""
    item = _item("14.048.00010.00", 120, descricao=[("ITEM", 90)])
    continuacao_proxima = _p("PERTO", 90, 140)
    continuacao_distante = _p("LONGE", 90, 120 + 200)
    pagina = _PaginaDeTexto([*_CABECALHO, *item, continuacao_proxima, continuacao_distante])

    (linha,) = ler_linhas_sem_grade(pagina)

    assert "PERTO" in linha[1]
    assert "LONGE" not in linha[1]
