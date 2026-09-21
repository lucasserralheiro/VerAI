"""E2 da ESPEC 018 — o teste-âncora convertido: comparação **por código**.

O âncora antigo compara célula a célula com as páginas 2 e 3 do modelo GRC, e
depende de duas coisas que a ESPEC 018 troca de propósito: a **ordem** das
linhas, que passa a ser a do contrato, e o **agrupamento**, que deixa de
existir. Na forma posicional ele não tem como passar.

Este substitui o critério sem afrouxá-lo. O que o modelo continua provando é
que os **números estão certos e nenhuma linha se perdeu**; o que sai é a
verificação de diagramação, que é exatamente o que a decisão de negócio trocou.

**Escrito para reprovar** (T-1218). Contra o código atual ele acusa 55 linhas
onde se esperam 58, sem bloco final e com a família `10.050` ausente por
`exibir = N` em vez de por `R-REL-06`.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import pytest
from leitura_relatorio import Linha, ler, ler_pdf, por_codigo

from infrastructure.di.container import DIContainer, Entradas

PAGINAS_DO_MODELO = (1, 2)

# ── O alvo, medido nos dois pares (ESPEC 018 §7) ──────────────────────────────
#
# **Reancorado pela ESPEC 028** — 2026-08-19. Eram 58 e 58 linhas, com 4 e 13 no
# bloco final. A `R-ZER-01` deixa de **exibir** a linha do bloco final que traz
# zero contratado e zero medido; ela continua existindo no `Report`, na tela e
# na análise (`R-ZER-05`), e é isso que os testes abaixo conferem em separado —
# o documento encolhe, o dado não.

# **Reancorado pela ESPEC 031** — 2026-08-20. O `14.049.00054.00` do piloto e o
# `14.049.00037.00` do PGM saíam com medida 2 e 1 vindas do bloco **bruto** de
# `E1.1`; a apuração descontada da seção não os lista, e a `R-APU-03` lê essa
# ausência como zero. Com os dois zeros, a `R-ZER-01` os retira do bloco final.
#
# **No piloto isso esvazia o bloco**: o `…00054.00` era a única linha que a
# `R-ZER-01` ainda desenhava ali, e a `R-ZER-04` apaga faixa, asterisco e nota
# junto (ESPEC 031 §2.7). No PGM sobram três.

LINHAS_DO_PILOTO = 54  # 54 ordenadas pelo contrato + 0 no bloco final
LINHAS_DO_PGM = 50  # 45 + 5

ORDENADAS_PELO_CONTRATO_PILOTO = 54
BLOCO_FINAL_PILOTO = 0  # ESPEC 031 — o bloco final do piloto esvaziou
BLOCO_FINAL_PGM = 5

FAMILIA_FORA_DO_DOCUMENTO = "10.050"

# T-1270 — o conteúdo nominal do bloco final. São os códigos que a aba conhece
# e o contrato não: no piloto, quatro; no PGM, treze, dos quais dois revelam
# seções inteiras ausentes do PDF (ESPEC 018 §2.3, grupo C).
#
# Continuam **inteiros**: são o conteúdo de `relatorio.demais_itens`, e o que a
# ESPEC 028 muda é quantos deles chegam ao `.docx`.
BLOCO_FINAL_DO_PILOTO = {
    "12.029.00001.00",
    "14.024.00001.00",
    "14.049.00004.00",
    "14.049.00054.00",
}

BLOCO_FINAL_DO_PGM = {
    # grupo B — medido sem contrapartida contratual
    "14.049.00037.00",
    "14.067.00002.00",
    "15.076.00001.00",
    # grupo C — a aba diz contratado, e o PDF não conhece o código
    "14.071.00006.00",
    "14.071.00007.00",
    # grupo D — zerado dos dois lados, e entra assim mesmo (`D-04`)
    "12.074.00001.00",
    "12.074.00020.00",
    "14.046.00003.00",
    "14.049.00004.00",
    "15.076.00002.00",
    "15.076.00003.00",
    "15.076.00004.00",
    "15.076.00005.00",
}

# ── ESPEC 028 · os que a aba zera dos dois lados ──────────────────────────────
#
# Zero contratado **e** zero medido, com os dois valores afirmados pela aba. São
# os que a `R-ZER-01` deixa de exibir — e a lista está aqui por extenso, e não
# derivada de `sem_quantidade_alguma`, porque derivá-la faria o teste concordar
# com a implementação em vez de com a planilha.
#
# `14.046.00003.00` **não** está na lista do PGM, embora o comentário do grupo D
# o chame de zerado: a aba traz a contratada em branco e a medida não numérica, e
# a `R-REL-08` o emite `1 / 1` (ESPEC 021). Zerado na origem, não na linha.
ZERADOS_DO_PILOTO = {
    "12.029.00001.00",
    "14.024.00001.00",
    "14.049.00004.00",
    # T-2144 / ESPEC 031 `R-APU-03` — o quarto, e o que **esvazia o bloco**.
    #
    # Está no bloco bruto de `E1.1` (L59, contratada 0, medida 2) e ausente da
    # apuração descontada da mesma seção: descontado o desenvolvimento, ele mede
    # zero. Saía `0 / 2` e era o único item crítico do piloto.
    #
    # Com ele aqui, `EXIBIDOS_DO_PILOTO` fica **vazio** e a `R-ZER-04` da ESPEC
    # 028 dispara: o documento do piloto perde a faixa, o asterisco e a nota. É
    # o primeiro caso real daquela regra, e está na ESPEC 031 §2.7.
    "14.049.00054.00",
}

ZERADOS_DO_PGM = {
    # T-2144 / ESPEC 031 `R-APU-03` — o mesmo caso, em outro código: L45 do
    # levantamento do PGM, contratada 0, medida 1 no bloco bruto e ausente da
    # apuração descontada. O bloco final do PGM **não** esvazia: sobram três.
    "14.049.00037.00",
    "12.074.00001.00",
    "12.074.00020.00",
    "14.049.00004.00",
    "15.076.00002.00",
    "15.076.00003.00",
    "15.076.00004.00",
    "15.076.00005.00",
}

EXIBIDOS_DO_PILOTO = BLOCO_FINAL_DO_PILOTO - ZERADOS_DO_PILOTO
EXIBIDOS_DO_PGM = BLOCO_FINAL_DO_PGM - ZERADOS_DO_PGM

# ── T-1217 · as divergências declaradas ───────────────────────────────────────

# `11.027.00001.00` — contrato, aditivo e planilha dizem 10; o modelo grafa 6.
# Divergência que já existe hoje, pendente do insumo `I-01` da ESPEC 001.
#
# `14.025.00011.00` — o modelo imprime duas linhas de `1 / 1`, desdobradas por
# qualificador; a `D-01` consolida numa. É o custo declarado da decisão.
DIVERGENCIAS_DECLARADAS = {"11.027.00001.00", "14.025.00011.00"}


def _gerar(contrato: Path, levantamento: Path, destino: Path) -> Any:
    from infrastructure.report.docx_renderer import DocxRenderer

    resultado = DIContainer().gerar(Entradas(contrato=contrato, levantamento=levantamento))
    assert resultado.relatorio is not None, [a.mensagem for a in resultado.achados.bloqueantes]

    caminho = destino / "relatorio.docx"
    DocxRenderer().renderizar(resultado.relatorio, caminho)
    return resultado, ler(caminho)


@pytest.fixture(scope="module")
def modelo(caminho_modelo: Path) -> dict[str, Linha]:
    return por_codigo(ler_pdf(caminho_modelo, PAGINAS_DO_MODELO))


@pytest.fixture(scope="module")
def piloto(caminho_contrato: Path, caminho_levantamento: Path, tmp_path_factory: Any) -> Any:
    destino = tmp_path_factory.mktemp("ancora-piloto")
    return _gerar(caminho_contrato, caminho_levantamento, destino)


@pytest.fixture(scope="module")
def pgm(caminho_contrato_pgm: Path, caminho_levantamento_pgm: Path, tmp_path_factory: Any) -> Any:
    destino = tmp_path_factory.mktemp("ancora-pgm")
    return _gerar(caminho_contrato_pgm, caminho_levantamento_pgm, destino)


# ── T-1215 · o conjunto de códigos ────────────────────────────────────────────


def test_t1215_o_piloto_tem_58_linhas(piloto: Any) -> None:
    _, linhas = piloto
    assert len(linhas) == LINHAS_DO_PILOTO


def test_t1215_o_pgm_tem_58_linhas(pgm: Any) -> None:
    _, linhas = pgm
    assert len(linhas) == LINHAS_DO_PGM


def test_t1215_o_conjunto_e_a_aba_menos_a_familia_10050(
    piloto: Any, caminho_levantamento: Path
) -> None:
    """O universo é a aba, menos a família `10.050` e menos os zerados.

    **A segunda exclusão é da ESPEC 028** (`R-ZER-01`), e é de outra natureza: a
    da `10.050` tira o item da **comparação** do documento porque ele é faturado
    por outro instrumento; esta só deixa de **desenhar a linha** de um item que
    não afirma quantidade nenhuma — e apenas no bloco final, onde não há
    contrato de onde ele venha.
    """
    from infrastructure.measurement.levantamento_reader import LevantamentoReader

    _, linhas = piloto
    da_aba = LevantamentoReader().ler(caminho_levantamento).codigos
    esperado = {
        c
        for c in da_aba
        if not c.startswith(FAMILIA_FORA_DO_DOCUMENTO) and c not in ZERADOS_DO_PILOTO
    }

    assert {linha.codigo for linha in linhas} == esperado


def test_t1215_nenhuma_linha_da_familia_10050_no_documento(piloto: Any, pgm: Any) -> None:
    for _, linhas in (piloto, pgm):
        assert [
            linha.codigo
            for linha in linhas
            if linha.codigo.startswith(FAMILIA_FORA_DO_DOCUMENTO)
        ] == []


# ── T-1216 · a ordem é a do contrato ──────────────────────────────────────────


def test_t1216_as_primeiras_linhas_seguem_a_ordem_do_contrato(
    piloto: Any, caminho_contrato: Path
) -> None:
    from infrastructure.contract.pdfplumber_extractor import PdfPlumberContractExtractor

    _, linhas = piloto
    contrato = PdfPlumberContractExtractor().extrair(caminho_contrato)

    do_contrato: list[str] = []
    for item in contrato.itens:
        codigo = item.codigo.valor
        if codigo.startswith(FAMILIA_FORA_DO_DOCUMENTO) or codigo in do_contrato:
            continue
        do_contrato.append(codigo)

    assert [linha.codigo for linha in linhas[:ORDENADAS_PELO_CONTRATO_PILOTO]] == do_contrato


# ── T-1270 · o bloco final ────────────────────────────────────────────────────


def test_t1270_o_bloco_final_do_piloto(piloto: Any) -> None:
    _, linhas = piloto
    assert {linha.codigo for linha in linhas[ORDENADAS_PELO_CONTRATO_PILOTO:]} == (
        EXIBIDOS_DO_PILOTO
    )


def test_t1270_o_bloco_final_do_pgm(pgm: Any) -> None:
    _, linhas = pgm
    assert {linha.codigo for linha in linhas[-BLOCO_FINAL_PGM:]} == EXIBIDOS_DO_PGM


# ── ESPEC 028 · o que sai do documento continua no relatório ──────────────────


@pytest.mark.parametrize(
    ("par", "nominal", "zerados"),
    [
        ("piloto", BLOCO_FINAL_DO_PILOTO, ZERADOS_DO_PILOTO),
        ("pgm", BLOCO_FINAL_DO_PGM, ZERADOS_DO_PGM),
    ],
)
def test_o_relatorio_conserva_as_linhas_que_o_documento_nao_exibe(
    par: str, nominal: set[str], zerados: set[str], request: pytest.FixtureRequest
) -> None:
    """`R-ZER-05` — a omissão é do `.docx`, e de mais nada.

    É a asserção que separa esta espec de uma revogação da `D-04` da ESPEC 018:
    o `Report` — que alimenta o grid, a análise e a API — continua trazendo os
    treze do PGM e os quatro do piloto. Some a linha do documento que vai ao
    órgão; não some o item de quem confere.

    Sem este teste, trocar a omissão de lugar — para o caso de uso, onde seria
    uma linha mais curta — passaria despercebido, e levaria os zerados embora
    também da tela.
    """
    resultado, linhas = request.getfixturevalue(par)

    assert {linha.codigo.valor for linha in resultado.relatorio.demais_itens} == nominal
    assert zerados & {linha.codigo for linha in linhas} == set()


def test_t1270_o_grupo_c_do_pgm_sai_contratado_e_sem_medicao(pgm: Any) -> None:
    """A aba afirma que estão contratados, e o PDF não conhece os códigos.

    É a evidência de que o contrato submetido não cobre o escopo vigente — e a
    razão de o bloco final existir em vez de os itens serem descartados.
    """
    _, linhas = pgm
    por = por_codigo(linhas)

    assert por["14.071.00006.00"].contratada.replace(".", "") == "5"
    assert por["14.071.00006.00"].medida.replace(".", "") == "0"
    assert por["14.071.00007.00"].contratada.replace(".", "") == "1"


# ── T-1214 · o âncora: a quantidade medida bate com o modelo ──────────────────


def test_t1214_a_quantidade_medida_bate_com_o_modelo(
    piloto: Any, modelo: dict[str, Linha]
) -> None:
    """O que o modelo GRC continua provando: os números estão certos.

    A quantidade **contratada** sai da comparação — `D-05` troca a fonte dela
    de propósito, do contrato para a aba.
    """
    _, linhas = piloto
    nosso = por_codigo(linhas)

    comparaveis = set(nosso) & set(modelo) - DIVERGENCIAS_DECLARADAS
    assert len(comparaveis) >= 50, "o modelo tem de cobrir a maior parte do documento"

    divergentes = {
        codigo
        for codigo in comparaveis
        if nosso[codigo].medida.replace(".", "") != modelo[codigo].medida.replace(".", "")
    }
    assert divergentes == set()


def test_t1214_toda_linha_do_modelo_tem_correspondente(
    piloto: Any, modelo: dict[str, Linha]
) -> None:
    """Nenhuma linha do modelo se perdeu no caminho."""
    _, linhas = piloto
    assert set(modelo) - {linha.codigo for linha in linhas} == set()


# ── T-1219 · o âncora do PGM ──────────────────────────────────────────────────


def test_t1219_o_pgm_gera_sem_bloqueante(pgm: Any) -> None:
    resultado, _ = pgm
    assert resultado.achados.bloqueantes == []


def test_t1219_o_pgm_produz_cinco_avisos_de_v_rec_01(pgm: Any) -> None:
    """As divergências entre contrato e aba, com as duas que eram invisíveis.

    A ESPEC 018 §2.7 previa quatro. São **cinco** — a versão anterior da
    `V-REC-01` tinha duas cegueiras, e só uma delas estava medida:

    * `10.050.00001.00` — pulado por `exibir = N` (Seção A). Diferença de
      **554,01 horas**;
    * `14.048.00027.00` — nunca comparado, porque o código **não existe no
      catálogo do SMIT** e a validação iterava o catálogo. Contrato **200**,
      levantamento **1.300**.

    Avaliar todo código do contrato (`R-REL-12`) é o que os traz à superfície.
    """
    resultado, _ = pgm
    # T-1728 / ESPEC 023 — a `V-REC-01` deixou de ser achado (`R-FON-09`); os
    # mesmos cinco códigos, lidos da fonte nova. O âncora do PGM não perdeu nada:
    # continua sendo a lista, e não a contagem.
    codigos = {d.codigo for d in resultado.divergencias}
    assert codigos == {
        "10.050.00001.00",
        "12.030.00001.00",
        "14.024.00006.00",
        "14.031.00020.00",
        "14.048.00027.00",
    }
