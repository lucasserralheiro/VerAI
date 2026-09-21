"""E0 da ESPEC 018 — a regra do desconto de desenvolvimento passa a valer.

`R-MED-02` manda prevalecer, entre duas ocorrências do mesmo código, a que
desconta recursos de desenvolvimento: **o cliente não paga por servidor de
desenvolvimento**.

A regra estava **desligada nos dois pares reais**. A faixa `DESCONTANDO RECURSOS
DE DESENVOLVIMENTO` é célula mesclada, e chega ao leitor com o texto repetido
nas cinco colunas; o crivo anterior exigia *"texto só na primeira coluna"* e
rejeitava todas — 1 faixa reconhecida em cada arquivo, contra 35 e 38.

**Por que a suíte não pegou:** a fixture era gerada com `openpyxl`, que ao
regravar guarda a mesclagem e apaga as células não-âncora. A faixa saía de 5/5
preenchidas no arquivo real para 1/5 na fixture — e nessa forma o crivo antigo
funcionava. A suíte testava uma forma que a produção nunca vê.

O valor saía certo por coincidência: nos dois arquivos o bloco do desconto está
listado por último, e o atalho *"vale a última lida"* acertava. Este arquivo
prova a regra, e prova que ela não moveu número nenhum.
"""

from __future__ import annotations

from decimal import Decimal
from pathlib import Path

import pytest

from domain.entities.validation_finding import Severity, ValidationReport
from infrastructure.measurement.levantamento_reader import (
    _CABECALHOS,
    COL_DESCRICAO,
    COLUNAS_LIDAS,
    LevantamentoReader,
    _texto,
)
from infrastructure.shared.arquivos import abrir_planilha
from infrastructure.validations.measurement_validations import v_med_03_desconto_por_posicao

MARCA = "DESCONTANDO RECURSOS DE DESENVOLVIMENTO"

# ── T-1259 · os valores congelados ────────────────────────────────────────────
#
# Lidos **da planilha**, não da saída do extrator (TASKS 018 §1.1 regra 6): um
# teste que compara o código consigo mesmo não é invariância, é tautologia.
#
# Em cada par, o número é o da linha sob a faixa `DESCONTANDO`, e o valor entre
# parênteses é o do bloco cheio — o que sairia se a regra falhasse.

CONGELADOS_PILOTO = {
    "14.024.00005.00": Decimal("762.55"),  # linha 129, cheio 1097.55
    "14.049.00004.00": Decimal("0"),  # linha  83, cheio 0
    "14.049.00005.00": Decimal("121.29"),  # linha  84, cheio 130.25
    "14.049.00037.00": Decimal("1"),  # linha  71, cheio 1
    "14.049.00038.00": Decimal("2"),  # linha  73, cheio 5
    "14.049.00039.00": Decimal("6"),  # linha  75, cheio 6
    "14.049.00040.00": Decimal("2"),  # linha  77, cheio 2
    "14.049.00045.00": Decimal("0"),  # linha  79, cheio 0
    "14.049.00047.00": Decimal("2"),  # linha  72, cheio 4
    "14.049.00048.00": Decimal("5"),  # linha  74, cheio 7
    "14.049.00049.00": Decimal("1"),  # linha  76, cheio 1
    "14.049.00050.00": Decimal("0"),  # linha  78, cheio 0
    "14.049.00055.00": Decimal("0"),  # linha  80, cheio 0
}

CONGELADOS_PGM = {
    "14.024.00005.00": Decimal("2105.4"),  # linha 131, cheio 2470.4
    "14.049.00004.00": Decimal("0"),  # linha  67, cheio 0
    "14.049.00005.00": Decimal("15.07"),  # linha  68, cheio 22.08
    "14.049.00038.00": Decimal("5"),  # linha  59, cheio 9
    "14.049.00039.00": Decimal("1"),  # linha  61, cheio 1
    "14.049.00040.00": Decimal("1"),  # linha  63, cheio 1
    "14.049.00041.00": Decimal("3"),  # linha  64, cheio 3
    "14.049.00048.00": Decimal("5"),  # linha  60, cheio 7
    "14.049.00049.00": Decimal("2"),  # linha  62, cheio 3
}

# Faixas de bloco em cada arquivo, medidas com o crivo corrigido.
FAIXAS_DO_PILOTO = 35
FAIXAS_DO_PGM = 38

# O que o crivo anterior enxergava nos **arquivos reais**: uma. As demais são
# mescladas, e ele as rejeitava por terem texto fora da primeira coluna.
FAIXAS_PELO_CRIVO_ANTERIOR = 1


def _crivo_anterior(celulas: list[str]) -> bool:
    """O crivo de faixa como era antes da correção — função de referência.

    Vive no teste e não em ``src/``: existe só para a T-1203 poder afirmar uma
    **igualdade** entre o antes e o depois, que é uma asserção mais forte que
    qualquer bateria sobre o resultado.
    """
    primeira = celulas[COL_DESCRICAO].strip()
    if not primeira or primeira.lower() in _CABECALHOS:
        return False
    return not any(c.strip() for c in celulas[1:])


def _linhas(caminho: Path) -> list[list[str]]:
    """As linhas como o leitor as recebe, com a mesma abertura de produção."""
    livro = abrir_planilha(caminho, "medição")
    try:
        return [
            [_texto(valor) for valor in linha[:COLUNAS_LIDAS]]
            for linha in livro["Levantamento"].iter_rows(values_only=True)
        ]
    finally:
        livro.close()


# ── T-1203 / T-1204 · o defeito, e o que a correção devolve ───────────────────


@pytest.mark.parametrize(
    "planilha", ["caminho_levantamento", "caminho_levantamento_pgm"]
)
def test_t1203_o_crivo_anterior_via_uma_faixa_em_cada_arquivo(
    planilha: str, request: pytest.FixtureRequest
) -> None:
    """O defeito, isolado — e ele **não** era só do PGM.

    As faixas dos dois levantamentos são mescladas. O crivo anterior exigia
    texto só na primeira coluna e reconhecia **uma** em cada arquivo.
    """
    linhas = _linhas(request.getfixturevalue(planilha))

    reconhecidas = [n for n, celulas in enumerate(linhas, start=1) if _crivo_anterior(celulas)]

    assert len(reconhecidas) == FAIXAS_PELO_CRIVO_ANTERIOR


@pytest.mark.parametrize(
    ("planilha", "esperadas"),
    [
        ("caminho_levantamento", FAIXAS_DO_PILOTO),
        ("caminho_levantamento_pgm", FAIXAS_DO_PGM),
    ],
)
def test_t1204_a_correcao_devolve_todas_as_faixas(
    planilha: str, esperadas: int, request: pytest.FixtureRequest
) -> None:
    leitor = LevantamentoReader()
    linhas = _linhas(request.getfixturevalue(planilha))

    faixas = [n for n, celulas in enumerate(linhas, start=1) if leitor._e_titulo_de_bloco(celulas)]

    assert len(faixas) == esperadas


@pytest.mark.parametrize("planilha", ["caminho_levantamento", "caminho_levantamento_pgm"])
def test_t1204_nenhum_item_fica_sem_bloco(
    planilha: str, request: pytest.FixtureRequest
) -> None:
    """A causa mecânica do defeito: item sem título de bloco não tem como saber
    se está sob a faixa do desconto."""
    medicao = LevantamentoReader().ler(request.getfixturevalue(planilha))

    assert [item.linha for item in medicao.itens if not item.bloco_titulo.strip()] == []


@pytest.mark.parametrize("planilha", ["caminho_levantamento", "caminho_levantamento_pgm"])
def test_t1204_a_faixa_chega_repetida_nas_cinco_colunas(
    planilha: str, request: pytest.FixtureRequest
) -> None:
    """A forma do insumo, afirmada na fixture.

    É o que a geração da fixture tem de preservar: regravada com `openpyxl`
    sem cuidado, a faixa volta a 1/5 e o defeito some do alcance da suíte.
    """
    leitor = LevantamentoReader()
    # A marca aparece também na **descrição de item** — o `14.024.00005.00` da
    # SAN a traz. Aqui interessam só as faixas, que são as linhas sem código.
    faixas = [
        celulas
        for celulas in _linhas(request.getfixturevalue(planilha))
        if MARCA in celulas[COL_DESCRICAO].upper() and leitor._codigo(celulas) is None
    ]

    assert faixas, "o levantamento traz bloco de desconto"
    assert all(len({c for c in celulas if c.strip()}) == 1 for celulas in faixas)
    assert all(sum(1 for c in celulas if c.strip()) == COLUNAS_LIDAS for celulas in faixas)


# ── T-1205 · os repetidos resolvem pela marca ─────────────────────────────────


@pytest.mark.parametrize(
    ("planilha", "esperados"),
    [("caminho_levantamento", 13), ("caminho_levantamento_pgm", 9)],
)
def test_t1205_todo_codigo_repetido_resolve_pela_marca(
    planilha: str, esperados: int, request: pytest.FixtureRequest
) -> None:
    """Pela **marca**, não pela posição. No PGM eram 1 de 9 antes da correção."""
    medicao = LevantamentoReader().ler(request.getfixturevalue(planilha))

    repetidos = sorted(c for c in medicao.codigos if len(medicao.itens_de(c)) > 1)
    assert len(repetidos) == esperados

    for codigo in repetidos:
        escolhida = medicao.item_para(codigo)
        assert escolhida is not None
        assert escolhida.desconta_desenvolvimento, codigo


# ── T-1206 · nenhuma quantidade se moveu ──────────────────────────────────────


@pytest.mark.parametrize(
    ("planilha", "congelados"),
    [
        ("caminho_levantamento", CONGELADOS_PILOTO),
        ("caminho_levantamento_pgm", CONGELADOS_PGM),
    ],
)
def test_t1206_as_medidas_batem_com_os_valores_congelados(
    planilha: str, congelados: dict[str, Decimal], request: pytest.FixtureRequest
) -> None:
    """O portão P0.

    A correção troca o **motivo** de a quantidade estar certa, nunca a
    quantidade. Os esperados vêm da planilha, com a linha registrada ao lado.
    """
    medicao = LevantamentoReader().ler(request.getfixturevalue(planilha))

    obtidas = {codigo: medicao.item_para(codigo) for codigo in congelados}
    assert all(item is not None for item in obtidas.values())
    assert {c: item.medida for c, item in obtidas.items() if item} == congelados


# ── T-1200 / T-1201 · a ordem invertida, que nenhum par real exercita ─────────


def test_t1201_a_ordem_invertida_reprovaria_o_crivo_anterior(
    caminho_blocos_invertidos: Path,
) -> None:
    """Sem a correção, o atalho por posição escolheria o bloco **cheio**.

    É o defeito no seu pior caso: nove servidores faturados onde cinco são
    devidos, sem erro, sem aviso e sem teste que acusasse.
    """
    linhas = _linhas(caminho_blocos_invertidos)

    faixas = [
        celulas
        for celulas in linhas
        if "HOSPEDAGEM" in celulas[COL_DESCRICAO].upper() and _crivo_anterior(celulas)
    ]
    assert faixas == [], "o crivo anterior não reconhecia faixa mesclada"

    itens = [celulas for celulas in linhas if LevantamentoReader()._codigo(celulas)]
    assert itens[-1][4] == "9", "a última ocorrência é a do bloco cheio"


def test_t1200_a_ordem_invertida_resolve_pela_marca(caminho_blocos_invertidos: Path) -> None:
    medicao = LevantamentoReader().ler(caminho_blocos_invertidos)

    escolhida = medicao.item_para("14.049.00038.00")

    assert escolhida is not None
    assert escolhida.desconta_desenvolvimento
    assert escolhida.medida == Decimal("5")


# ── T-1208 · a rede, para o dia em que a marca não estiver lá ─────────────────


def test_t1208_v_med_03_dispara_sem_marca(caminho_sem_marca_de_desconto: Path) -> None:
    medicao = LevantamentoReader().ler(caminho_sem_marca_de_desconto)
    achados = ValidationReport()

    v_med_03_desconto_por_posicao(medicao, achados)

    assert [a.codigo for a in achados.achados] == ["14.049.00038.00"]
    assert achados.achados[0].severidade is Severity.AVISA
    assert not achados.bloqueado


@pytest.mark.parametrize("planilha", ["caminho_levantamento", "caminho_levantamento_pgm"])
def test_t1208_v_med_03_nao_dispara_nos_pares_reais(
    planilha: str, request: pytest.FixtureRequest
) -> None:
    """Aviso que sempre dispara é aviso que ninguém lê."""
    medicao = LevantamentoReader().ler(request.getfixturevalue(planilha))
    achados = ValidationReport()

    v_med_03_desconto_por_posicao(medicao, achados)

    assert achados.achados == []


def test_t1208_v_med_03_ignora_codigo_que_aparece_uma_vez(caminho_levantamento: Path) -> None:
    """A validação fala de código repetido; código único não é assunto dela."""
    medicao = LevantamentoReader().ler(caminho_levantamento)
    achados = ValidationReport()

    v_med_03_desconto_por_posicao(medicao, achados)

    unicos = [c for c in medicao.codigos if len(medicao.itens_de(c)) == 1]
    assert unicos
    assert not {a.codigo for a in achados.achados} & set(unicos)
