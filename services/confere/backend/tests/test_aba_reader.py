"""T-303 — O leitor genérico de aba, contra abas de forma variada.

As três abas foram escolhidas pelo que têm de **diferente**, não por
conveniência: o caso completo, o extremo de largura e o caso pequeno. Um leitor
que atende as três atende as dezenove, porque a diferença entre elas é de forma,
não de significado.
"""

from __future__ import annotations

from datetime import datetime
from pathlib import Path

import openpyxl
import pytest
from openpyxl.styles import Alignment

from domain.entities.annex import Anexo, Mesclagem, Orientacao
from infrastructure.measurement.aba_reader import AbaReader, FormaDaAba


@pytest.fixture(scope="module")
def livro(caminho_levantamento: Path) -> object:
    return openpyxl.load_workbook(caminho_levantamento, data_only=True)


def _forma(livro: object, aba: str) -> FormaDaAba:
    return AbaReader().ler(livro[aba])  # type: ignore[index]


# ── O caso completo: NAS ──────────────────────────────────────────────────────


@pytest.fixture(scope="module")
def nas(livro: object) -> FormaDaAba:
    return _forma(livro, "NAS")


def test_nas_devolve_todas_as_linhas_e_colunas(nas: FormaDaAba) -> None:
    assert len(nas.linhas) == 42
    assert {len(linha) for linha in nas.linhas} == {7}


def test_nas_preserva_as_mesclagens(nas: FormaDaAba) -> None:
    assert len(nas.mesclagens) == 9
    # A1:G1 — o título ocupa a linha inteira. Sem isto ele sairia espremido na
    # primeira coluna, e a página deixaria de ser reconhecível.
    assert Mesclagem(0, 0, 0, 6) in nas.mesclagens


def test_as_mesclagens_saem_em_ordem_estavel(nas: FormaDaAba) -> None:
    """O openpyxl guarda as faixas num conjunto — a ordem varia entre execuções."""
    assert list(nas.mesclagens) == sorted(nas.mesclagens, key=lambda m: (m.linha, m.coluna))


def test_nas_preserva_preenchimento_e_negrito(nas: FormaDaAba) -> None:
    titulo = nas.linhas[0][0]
    assert titulo.preenchimento == "6A5ACD"
    assert titulo.negrito

    cabecalho = nas.linhas[6][0]  # linha 7 da aba
    assert cabecalho.preenchimento == "A52A2A"


def test_o_cabecalho_traz_a_cor_da_fonte(nas: FormaDaAba) -> None:
    """Sem a cor, texto preto sobre vinho — ilegível, e diferente do GRC."""
    assert nas.linhas[6][0].cor == "FFFFFF"


def test_celula_vazia_sai_vazia(nas: FormaDaAba) -> None:
    """Linha 2 da aba é o respiro entre o título e o resumo."""
    assert all(celula.texto == "" for celula in nas.linhas[1])


def test_a_borda_vem_da_aba(nas: FormaDaAba) -> None:
    assert nas.linhas[6][0].borda is True
    assert nas.linhas[4][0].borda is False  # linha 5 da aba, sem grade


def test_numero_sai_em_pt_br(nas: FormaDaAba) -> None:
    """A armadilha de sempre: `str(2636.87)` usa ponto decimal."""
    assert nas.linhas[3][5].texto == "2636,87"


def test_inteiro_nao_ganha_casa_decimal(nas: FormaDaAba) -> None:
    assert nas.linhas[7][6].texto == "220"


def test_nas_preserva_o_alinhamento_declarado_na_aba(nas: FormaDaAba) -> None:
    """ESPEC 052 `R-ALN-01` — medido direto na aba (ESPEC 052 §2.1): cabeçalho
    centralizado, número à direita, texto à esquerda, texto centralizado
    quando a aba assim declara (`Storage Server`/`Volume`).
    """
    assert nas.linhas[6][5].alinhamento == "center"  # cabeçalho "Usado(GB)"
    assert nas.linhas[6][6].alinhamento == "center"  # cabeçalho "Alocado(GB)"
    assert nas.linhas[7][5].alinhamento == "right"  # F8 — 219,92
    assert nas.linhas[7][6].alinhamento == "right"  # G8 — 220
    assert nas.linhas[7][0].alinhamento == "left"  # A8 — "SMIT"
    assert nas.linhas[7][3].alinhamento == "center"  # D8 — "nas.prodam"


# ── O extremo de largura: Comunicação Dados ───────────────────────────────────


def test_comunicacao_dados_devolve_as_22_colunas(livro: object) -> None:
    forma = _forma(livro, "Comunicação Dados")
    assert len(forma.linhas) == 13
    assert {len(linha) for linha in forma.linhas} == {22}
    assert len(forma.proporcoes) == 22


def test_coluna_sem_largura_declarada_herda_o_padrao(livro: object) -> None:
    """A aba só grava a largura das colunas ajustadas; as demais herdam o padrão.

    Ignorar isso daria proporção zero a colunas inteiras, que sairiam com
    largura nula na página.
    """
    forma = _forma(livro, "Comunicação Dados")
    assert all(proporcao > 0 for proporcao in forma.proporcoes)


# ── O caso pequeno: BD ────────────────────────────────────────────────────────


def test_bd_nao_inventa_linha_nem_coluna(livro: object) -> None:
    forma = _forma(livro, "BD")
    assert len(forma.linhas) == 24
    assert {len(linha) for linha in forma.linhas} == {7}


# ── Onde o anexo se parte (`R-ANX-11`) ────────────────────────────────────────


def _anexo(
    linha_cabecalho: int | None,
    mesclagens: tuple[Mesclagem, ...] = (),
    adicionais: tuple[int, ...] = (),
) -> Anexo:
    return Anexo(
        aba="X",
        orientacao=Orientacao.RETRATO,
        corpo=8.0,
        linha_cabecalho=linha_cabecalho,
        linhas_cabecalho_adicionais=adicionais,
        linhas=((),) * 20,
        mesclagens=mesclagens,
    )


def test_o_anexo_se_parte_no_cabecalho() -> None:
    """`Usuários` tem título, resumo e subtítulo antes do cabecalho, na 8ª linha."""
    assert _anexo(7).cortes == (7,)


def test_nao_ha_corte_quando_o_cabecalho_e_a_primeira_linha() -> None:
    """`Detalhes` começa no cabeçalho — não há preâmbulo a separar."""
    assert _anexo(0).cortes == ()


def test_nao_ha_corte_sem_cabecalho() -> None:
    assert _anexo(None).cortes == ()


def test_mesclagem_que_atravessa_o_corte_impede_a_divisao() -> None:
    """Partir uma região mesclada desalinharia as duas tabelas."""
    assert _anexo(7, (Mesclagem(5, 0, 9, 3),)).cortes == ()


# ── Mais de um cabeçalho por aba (ESPEC 051 `R-SEG-02` a `R-SEG-06`) ──────────


def test_duas_ancoras_em_linhas_distintas_viram_dois_cortes() -> None:
    """`Servidores`/`ServidoresSemDesenv`: resumo e detalhe, cada um com seu cabeçalho."""
    assert _anexo(7, adicionais=(14,)).cortes == (7, 14)


def test_duas_ancoras_na_mesma_linha_colapsam_num_corte_so() -> None:
    """`R-SEG-06` — sem isso, um segmento vazio entraria entre os dois cortes."""
    assert _anexo(7, adicionais=(7,)).cortes == (7,)


def test_mesclagem_bloqueia_so_o_corte_que_atravessa() -> None:
    """A guarda é por índice, e não pelo anexo inteiro.

    Uma mesclagem que atravessa a âncora adicional não pode derrubar a
    primária — são independentes.
    """
    assert _anexo(7, (Mesclagem(12, 0, 15, 3),), adicionais=(14,)).cortes == (7,)


# ── Data sem dia (ESPEC 047, `R-DAT-01` a `R-DAT-04`) ─────────────────────────

_DATA = datetime(2026, 12, 9)


def _texto_da_data(number_format: str | None) -> str:
    livro = openpyxl.Workbook()
    aba = livro.active
    assert aba is not None
    aba["A1"] = _DATA
    if number_format is not None:
        aba["A1"].number_format = number_format
    forma = AbaReader().ler(aba)
    return forma.linhas[0][0].texto


def test_mes_abreviado_sai_como_a_planilha_mostra() -> None:
    """`mmm/yy` não tem token de dia — a planilha nunca mostrou um dia 1º."""
    assert _texto_da_data("mmm/yy") == "dez/26"


def test_mes_por_extenso() -> None:
    assert _texto_da_data("mmmm/yyyy") == "dezembro/2026"


def test_mes_numerico_sem_dia() -> None:
    assert _texto_da_data("mm/yyyy") == "12/2026"


def test_data_completa_continua_fixa_em_dd_mm_aaaa() -> None:
    assert _texto_da_data("dd/mm/yyyy") == "09/12/2026"


def test_formato_com_dia_em_outra_ordem_nao_regride() -> None:
    """`mm-dd-yy` é o `number_format` real de `DATA VALIDADE` em `CertificadosDigitais`."""
    assert _texto_da_data("mm-dd-yy") == "09/12/2026"


def test_sem_number_format_ou_general_mantem_o_padrao_fixo() -> None:
    assert _texto_da_data(None) == "09/12/2026"
    assert _texto_da_data("General") == "09/12/2026"


# ── Alinhamento (ESPEC 052 `R-ALN-01` a `R-ALN-04`) ────────────────────────────


def _alinhamento_resolvido(valor: object = None, horizontal: str | None = None) -> str:
    """Uma aba real de uma célula só, para isolar o fallback do tipo do valor.

    `B1` fica com conteúdo fixo só para a aba não sair vazia (o leitor descarta
    aba sem coluna útil) — o que importa é sempre `A1`.
    """
    livro = openpyxl.Workbook()
    aba = livro.active
    assert aba is not None
    aba["B1"] = "âncora"
    if valor is not None:
        aba["A1"] = valor
    if horizontal is not None:
        aba["A1"].alignment = Alignment(horizontal=horizontal)
    forma = AbaReader().ler(aba)
    return forma.linhas[0][0].alinhamento


@pytest.mark.parametrize("horizontal", ["left", "center", "right"])
def test_alinhamento_explicito_e_preservado_mesmo_contra_o_tipo(horizontal: str) -> None:
    """`R-ALN-01` — o valor declarado na aba vale, mesmo quando o tipo sugeriria outro."""
    assert _alinhamento_resolvido("texto", horizontal) == horizontal
    assert _alinhamento_resolvido(10, horizontal) == horizontal


def test_sem_alinhamento_numero_e_data_vao_para_a_direita() -> None:
    """`R-ALN-02`/`R-ALN-03` — o "Geral" do Excel, reproduzido pelo tipo do valor."""
    assert _alinhamento_resolvido(220) == "right"
    assert _alinhamento_resolvido(18.261) == "right"
    assert _alinhamento_resolvido(_DATA) == "right"


def test_sem_alinhamento_texto_vai_para_a_esquerda() -> None:
    assert _alinhamento_resolvido("CACISP") == "left"


def test_celula_vazia_sem_alinhamento_vai_para_a_esquerda() -> None:
    assert _alinhamento_resolvido() == "left"


def test_sem_alinhamento_booleano_e_centralizado() -> None:
    """`bool` é subclasse de `int` em Python — checar na ordem errada daria `right`."""
    assert _alinhamento_resolvido(valor=True) == "center"
    assert _alinhamento_resolvido(valor=False) == "center"


@pytest.mark.parametrize(("valor", "esperado"), [("texto", "left"), (10, "right")])
def test_alinhamento_fora_dos_tres_conhecidos_cai_no_tipo(valor: object, esperado: str) -> None:
    """`R-ALN-04` — nenhuma das 22 abas do levantamento usa `justify`; sintético."""
    assert _alinhamento_resolvido(valor, "justify") == esperado
