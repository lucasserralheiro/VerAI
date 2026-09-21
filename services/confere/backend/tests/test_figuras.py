"""As figuras coladas nas abas (ESPEC 004).

O que parece um gráfico em `ServicosEmNuvem` é um PNG ancorado sobre a grade.
Não está em célula nenhuma, e por isso um leitor de células o perdia inteiro —
foi o defeito que motivou este módulo.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from domain.entities.annex import Anexo, CelulaAnexo, ImagemAnexo, Orientacao
from infrastructure.measurement.figuras import figuras_por_aba

ASSINATURA_PNG = bytes.fromhex("89504E470D0A1A0A")


@pytest.fixture(scope="module")
def figuras(caminho_levantamento: Path) -> dict[str, tuple[ImagemAnexo, ...]]:
    return figuras_por_aba(caminho_levantamento)


def test_acha_as_tres_figuras_da_planilha(figuras: dict[str, tuple[ImagemAnexo, ...]]) -> None:
    assert set(figuras) == {"Capa", "Internet", "ServicosEmNuvem"}


@pytest.mark.parametrize(("aba", "linha"), [("ServicosEmNuvem", 5), ("Internet", 14)])
def test_a_ancora_diz_sobre_qual_linha_a_figura_flutua(
    figuras: dict[str, tuple[ImagemAnexo, ...]], aba: str, linha: int
) -> None:
    """É o que decide onde ela entra: `Internet` a ancora **depois** da tabela."""
    assert figuras[aba][0].linha == linha


def test_os_bytes_sao_de_um_png(figuras: dict[str, tuple[ImagemAnexo, ...]]) -> None:
    for achadas in figuras.values():
        for figura in achadas:
            assert figura.dados[:8] == ASSINATURA_PNG
            assert len(figura.dados) > 1000


def test_o_tamanho_natural_e_lido_sem_biblioteca_de_imagem(
    figuras: dict[str, tuple[ImagemAnexo, ...]],
) -> None:
    """Vem do bloco IHDR do PNG — Pillow não é dependência deste projeto."""
    for achadas in figuras.values():
        for figura in achadas:
            assert figura.largura_pt > 0 and figura.altura_pt > 0


# ── Onde a figura entra no anexo ──────────────────────────────────────────────


def _linha(texto: str = "") -> tuple[CelulaAnexo, ...]:
    return (CelulaAnexo(texto=texto),)


def _anexo(linhas: int, imagem_na_linha: int, vazias: range | None = None) -> Anexo:
    conteudo = tuple(
        _linha("" if vazias and indice in vazias else f"linha {indice}")
        for indice in range(linhas)
    )
    return Anexo(
        aba="X",
        orientacao=Orientacao.RETRATO,
        corpo=8.0,
        linhas=conteudo,
        imagens=(ImagemAnexo(dados=b"", linha=imagem_na_linha, largura_pt=10, altura_pt=5),),
    )


def test_figura_sobre_linhas_vazias_toma_o_lugar_delas() -> None:
    """`ServicosEmNuvem`: a figura ocupa a faixa vazia, como no GRC."""
    blocos = _anexo(20, imagem_na_linha=5, vazias=range(5, 12)).blocos()
    faixas = [(inicio, fim) for inicio, fim, imagem in blocos if imagem is None]
    assert faixas == [(0, 5), (12, 20)]


def test_figura_ancorada_depois_do_fim_sai_no_fim() -> None:
    """`Internet`: a tabela tem 13 linhas e a âncora está na 15."""
    blocos = _anexo(13, imagem_na_linha=14).blocos()
    assert [(i, f, imagem is not None) for i, f, imagem in blocos] == [
        (0, 13, False),
        (0, 0, True),
    ]


def test_figura_sobre_linha_com_conteudo_nao_engole_a_linha() -> None:
    """Engolir apagaria o dado que a linha mostra — a figura só se intercala."""
    blocos = _anexo(10, imagem_na_linha=4).blocos()
    faixas = [(inicio, fim) for inicio, fim, imagem in blocos if imagem is None]
    assert faixas == [(0, 4), (4, 10)]


def test_anexo_sem_figura_sai_numa_faixa_so() -> None:
    anexo = Anexo(aba="X", orientacao=Orientacao.RETRATO, corpo=8.0, linhas=(_linha("a"),) * 5)
    assert anexo.blocos() == [(0, 5, None)]
