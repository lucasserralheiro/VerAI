"""T-1500 a T-1507 — As linhas que saem `1 / 1` por derivação (ESPEC 021).

Uma linha cuja célula de *Quantidade Medida* não traz número é tratada como
perfil ou pacote e sai do documento com 1 contratado e 1 medido (`R-REL-08`).
Até a ESPEC 021 o único registro disso era uma frase — `V-REC-02` —, e o texto
da célula morria dentro dela.

Este módulo guarda o **oráculo** dessa exibição: as nove células dos dois pares
reais, transcritas das planilhas. É a única verdade externa desta entrega, e é
por isso que ela não pode ser regenerada a partir do código.
"""

from __future__ import annotations

import json
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path

import pytest
from leitura_relatorio import ler_docx

from application.use_cases.generate_measurement_report import ReportResult
from infrastructure.di.container import DIContainer, Entradas
from infrastructure.measurement.levantamento_reader import LevantamentoReader

# ── T-1500 · o oráculo ────────────────────────────────────────────────────────
#
# **Transcrito das duas planilhas, nunca da saída do código.** Um teste escrito a
# partir do que a implementação produziu afirma apenas que o código faz o que o
# código faz — e o `-` da linha 73, que é o valor mais fácil de estragar sem
# querer, ficaria protegido por uma asserção que copia o estrago.
#
# `contratada` e `medida` guardam o que a célula **mostra a quem abre o arquivo**.
# Quatro delas são numéricas no XLSX (`2` e três `1`), e o leitor as entrega como
# texto pt-BR pela `_texto()`; para estas nove, o que se lê na tela do Excel e o
# que o leitor devolve coincidem. Ver a emenda de `R-PER-02` na ESPEC 021 §14.1.


@dataclass(frozen=True)
class CelulaDerivada:
    """Uma linha da aba `Levantamento` cuja medida não é número."""

    linha: int
    codigo: str
    descricao: str
    contratada: str
    medida: str


PILOTO: tuple[CelulaDerivada, ...] = (
    CelulaDerivada(
        linha=88,
        codigo="14.048.00008.00",
        descricao="BANCO DE DADOS - SQL SERVER - PERFIL IV(D) - DE 200GB ATÉ 500GB",
        contratada="D",
        medida="C",
    ),
    CelulaDerivada(
        linha=89,
        codigo="14.046.00010.00",
        descricao="BANCO DE DADOS - MYSQL - PERFIL II(B) - DE 10GB ATÉ 100GB",
        contratada="B",
        medida="B",
    ),
    CelulaDerivada(
        linha=98,
        codigo="14.025.00011.00",
        descricao="PLATAFORMA DE BI - MS SQL",
        contratada="2",
        medida="PACOTE",
    ),
    CelulaDerivada(
        linha=114,
        codigo="14.070.00002.00",
        descricao="GERENCIAMENTO DE CONSUMO DE NUVEM",
        contratada="1",
        medida="PACOTE",
    ),
)

PGM: tuple[CelulaDerivada, ...] = (
    CelulaDerivada(
        linha=72,
        codigo="14.048.00009.00",
        descricao="BANCO DE DADOS - SQL SERVER - PERFIL VI(F) - DE 1.000GB ATÉ 3.000GB",
        contratada="F",
        medida="F",
    ),
    CelulaDerivada(
        linha=73,
        codigo="14.046.00003.00",
        descricao="BANCO DE DADOS - MYSQL - PERFIL I(A) - ATÉ 10GB",
        contratada="-",
        medida="A",
    ),
    CelulaDerivada(
        linha=74,
        codigo="14.046.00008.00",
        descricao="BANCO DE DADOS - POSTGRESQL - PERFIL I(A) - ATÉ 10GB",
        contratada="A",
        medida="A",
    ),
    CelulaDerivada(
        linha=83,
        codigo="14.025.00011.00",
        descricao="PLATAFORMA DE BI - MS SQL",
        contratada="1",
        medida="PACOTE",
    ),
    CelulaDerivada(
        linha=105,
        codigo="14.071.00007.00",
        descricao=(
            "GERENCIAMENTO DE TECNOLOGIAS EM CAMADA INTERMEDIÁRIA (MIDDLEWARE) (GTCI) - M1 "
            "- DISPONIBILIZADAS NO TENANT DA PRODAM - ATÉ 1000 LICENÇAS CONTRATADAS"
        ),
        contratada="1",
        medida="PACOTE",
    ),
)

ORACULO = {"piloto": PILOTO, "pgm": PGM}


# ── T-1501 · a transcrição casa o que o leitor lê `[portão P0]` ───────────────


@pytest.mark.parametrize("par", sorted(ORACULO))
def test_t1501_o_oraculo_casa_o_que_o_leitor_le(
    par: str, caminho_levantamento: Path, caminho_levantamento_pgm: Path
) -> None:
    """Portão `P0` — as nove células, contra o leitor e nada mais.

    Sem relatório, sem container, sem API: se esta asserção reprovar, o defeito
    está entre a planilha e o `LevantamentoReader`, e não adianta procurá-lo em
    camada nenhuma acima.

    **Compara os cinco campos**, e não só os códigos. O valor que a ESPEC 021
    existe para exibir é justamente o texto das duas quantidades, e um teste que
    conferisse só o código passaria com as colunas trocadas.

    Reprovar aqui tem duas causas de custo oposto: dedo errado na transcrição —
    barato, corrige-se a constante — ou o leitor entregando outra coisa, que muda
    a espec. Descobrir a diferença agora custa dez minutos; descobri-la depois
    custa refazer as asserções todas com a saída do código como referência.
    """
    caminho = {"piloto": caminho_levantamento, "pgm": caminho_levantamento_pgm}[par]

    medicao = LevantamentoReader().ler(caminho)
    lidas = tuple(
        CelulaDerivada(
            linha=item.linha,
            codigo=item.codigo.valor,
            descricao=item.descricao,
            contratada=item.contratada_texto,
            medida=item.medida_texto,
        )
        for item in medicao.itens
        if item.medida is None
    )

    assert lidas == ORACULO[par]


# ── Fixtures dos dois pares ───────────────────────────────────────────────────


@pytest.fixture(scope="session")
def resultado_do_piloto(gerar_piloto: Callable[..., ReportResult]) -> ReportResult:
    return gerar_piloto()


@pytest.fixture(scope="session")
def resultado_do_pgm(
    caminho_contrato_pgm: Path, caminho_levantamento_pgm: Path
) -> ReportResult:
    """O par do PGM **sem aditivo** — o caminho medido na ESPEC 021 §2.1.

    Sem aditivo saem 10 avisos (5 `V-REC-01` e 5 `V-REC-02`) e 5 linhas
    derivadas; com aditivo os `V-REC-01` calam e as derivadas continuam 5. Esta
    entrega não depende do aditivo, e depender dele acoplaria estes testes à
    ESPEC 019 sem necessidade.
    """
    return DIContainer().gerar(
        Entradas(contrato=caminho_contrato_pgm, levantamento=caminho_levantamento_pgm)
    )


@pytest.fixture(scope="session")
def resultados(
    resultado_do_piloto: ReportResult, resultado_do_pgm: ReportResult
) -> dict[str, ReportResult]:
    return {"piloto": resultado_do_piloto, "pgm": resultado_do_pgm}


# ── T-1503 · as asserções de conteúdo ─────────────────────────────────────────


@pytest.mark.parametrize("par", sorted(ORACULO))
def test_t1503_as_celulas_chegam_como_a_planilha_as_traz(
    par: str, resultados: dict[str, ReportResult]
) -> None:
    """As cinco colunas de cada linha derivada, contra o oráculo da T-1500.

    Cobre de uma vez `R-PER-01` (todas as linhas `1 / 1` estão aqui),
    `R-PER-02` (os textos), `R-PER-03` (a descrição é a da aba) e `R-PER-04`
    (o número da linha).
    """
    lidas = tuple(
        CelulaDerivada(
            linha=derivada.linha_na_aba,
            codigo=derivada.codigo,
            descricao=derivada.descricao,
            contratada=derivada.contratada_texto,
            medida=derivada.medida_texto,
        )
        for derivada in resultados[par].derivadas
    )

    assert lidas == ORACULO[par]


@pytest.mark.parametrize("par", sorted(ORACULO))
def test_t1503_a_ordem_e_a_da_aba(par: str, resultados: dict[str, ReportResult]) -> None:
    """`R-PER-05` — ascendente por número de linha, que é a ordem de quem percorre
    a planilha.

    Não é a ordem do relatório: `R-REL-03` ordena pela posição no contrato, e
    essa ordem não serve a quem vai conferir células. Sai de graça — o laço de
    `executar` percorre `medicao.codigos_em_ordem`, que já é a ordem da aba.
    """
    linhas = [derivada.linha_na_aba for derivada in resultados[par].derivadas]

    assert linhas == sorted(linhas)


@pytest.mark.parametrize("par", sorted(ORACULO))
def test_t1503_a_descricao_e_a_da_aba_e_nao_a_do_contrato(
    par: str, resultados: dict[str, ReportResult]
) -> None:
    """`R-PER-03` / `D-01` — as duas fontes divergem, e aqui vale a da planilha.

    O caso que decide é o `14.048.00008.00` do piloto: a descrição contratual
    **termina na palavra `PERFIL`**, cortada antes da letra, e é justamente a do
    único item cuja letra contratada difere da medida (ESPEC 021 §2.4).

    A asserção é de **sufixo**. Conferir o prefixo passaria com a fonte errada:
    as duas começam parecido.
    """
    por_codigo = {d.codigo: d.descricao for d in resultados[par].derivadas}

    if par == "piloto":
        assert por_codigo["14.048.00008.00"].endswith("PERFIL IV(D) - DE 200GB ATÉ 500GB")
    else:
        assert por_codigo["14.048.00009.00"].endswith("PERFIL VI(F) - DE 1.000GB ATÉ 3.000GB")


@pytest.mark.parametrize("par", sorted(ORACULO))
def test_t1503_todas_saem_um_e_um(par: str, resultados: dict[str, ReportResult]) -> None:
    """`R-PER-06` / `D-06` — o que saiu vem da `ReportLine` construída.

    A coluna do resultado é o que transforma a tabela de extrato da planilha em
    conferência: a dedução do sistema fica ao lado do dado que a originou.
    """
    for derivada in resultados[par].derivadas:
        assert derivada.emitida.contratada.valor == 1
        assert derivada.emitida.medida.valor == 1
        assert derivada.emitida.perfil_ou_pacote


# ── T-1504 · o `-` chega como `-` ─────────────────────────────────────────────


def test_t1504_o_traco_da_quantidade_contratada_sobrevive(
    resultado_do_pgm: ReportResult,
) -> None:
    """`R-PER-02` / `D-03` — a célula do `14.046.00003.00` contém um traço.

    Não é vazio e não é zero: alguém digitou o `-` de propósito, e a linha do
    `T-1272` em `report.py` — que descreve a célula como *"em branco"* — é que
    estava imprecisa (ESPEC 021 §2.3).

    As três negativas são explícitas porque `== "-"` já falharia, mas a mensagem
    não diria **em que direção** o valor foi estragado. Mostrar o traço como `0`
    ou como vazio seria repetir na tela o apagamento que esta tabela existe para
    desfazer — e é o defeito mais provável desta entrega, porque parece
    acabamento.
    """
    (alvo,) = [d for d in resultado_do_pgm.derivadas if d.codigo == "14.046.00003.00"]

    assert alvo.contratada_texto == "-"
    assert alvo.contratada_texto != ""
    assert alvo.contratada_texto != "0"


# ── T-1505 · invariante de acoplamento ────────────────────────────────────────


@pytest.mark.parametrize("par", sorted(ORACULO))
def test_t1505_nenhuma_linha_um_e_um_fica_fora_da_tabela(
    par: str, resultados: dict[str, ReportResult]
) -> None:
    """`R-PER-01` — as duas coleções não podem divergir.

    Parece impossível: as duas nascem no mesmo `if`. Divergem no dia em que
    alguém acrescentar um segundo caminho de derivação — um `N/A` tratado à
    parte, uma família excluída — e esquecer de acumular. O sintoma seria uma
    linha `1 / 1` no documento sem entrada na tabela, que é exatamente o
    silêncio que a ESPEC 021 existe para acabar.
    """
    relatorio = resultados[par].relatorio
    assert relatorio is not None

    no_documento = [linha for linha in relatorio.todas_as_linhas if linha.perfil_ou_pacote]
    na_tabela = resultados[par].derivadas

    assert len(na_tabela) == len(no_documento)
    assert {d.codigo for d in na_tabela} == {str(linha.codigo) for linha in no_documento}


# ── T-1507 · âncora de invariância do documento `[portão P4]` ─────────────────
#
# **A única captura da saída do código sancionada neste módulo.** A regra que
# governa o resto — nada de asserção escrita a partir do que o programa produziu
# — vale para o conteúdo **novo**, as nove células. Esta âncora não afirma que o
# documento está certo: afirma que ele **não se moveu**. O `.docx` de hoje já é
# entregue ao órgão, e a E2 abre justamente o arquivo que o monta (`R-PER-11`).
#
# Vive aqui, e não em `test_docx_estrutura.py`, porque o portão `P4` exige aquele
# arquivo **sem uma linha alterada** — acrescentar um teste nele o alteraria.

ANCORA = Path(__file__).parent / "fixtures" / "linhas_do_documento.json"


@pytest.fixture(scope="session")
def docx_do_pgm(
    caminho_contrato_pgm: Path,
    caminho_levantamento_pgm: Path,
    tmp_path_factory: pytest.TempPathFactory,
) -> Path:
    from infrastructure.report.docx_renderer import DocxRenderer

    resultado = DIContainer().gerar(
        Entradas(contrato=caminho_contrato_pgm, levantamento=caminho_levantamento_pgm)
    )
    assert resultado.relatorio is not None

    destino = tmp_path_factory.mktemp("derivadas-pgm") / "pgm.docx"
    return DocxRenderer().renderizar(resultado.relatorio, destino)


@pytest.mark.parametrize("par", sorted(ORACULO))
def test_t1507_o_documento_nao_se_move(
    par: str, docx_do_piloto: Path, docx_do_pgm: Path
) -> None:
    """`R-PER-11` — as 58 linhas de cada documento, idênticas às de antes.

    Nada na suíte afirmava isto: os 522 testes cobriam o documento por estrutura
    e por formatação, indiretamente. É um cinto barato, e a fase que o exige é a
    que abre o `generate_measurement_report.py`.
    """
    esperado = json.loads(ANCORA.read_text(encoding="utf-8"))[par]
    caminho = {"piloto": docx_do_piloto, "pgm": docx_do_pgm}[par]

    lidas = [
        [linha.codigo, linha.descricao, linha.unidade, linha.contratada, linha.medida]
        for linha in ler_docx(caminho)
    ]

    assert lidas == esperado
