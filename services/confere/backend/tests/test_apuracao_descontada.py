"""ESPEC 031 — a apuração descontada vale pela seção inteira.

A `R-MED-02` manda prevalecer a variante que desconta recursos de desenvolvimento,
e foi implementada **por código**: `item_para` procura uma ocorrência descontada
daquele código e, não achando, cai no atalho *"vale a última lida"*.

O que a planilha expressa é regra **por bloco**. O bloco descontado é um
restabelecimento completo da seção, e código que ele omite mede **zero** — quem
monta a planilha expressa o zero apagando a linha, não escrevendo `0`.

São dois códigos em 120 nos dois pares reais, e os dois são o mesmo caso:
`14.049.00054.00` no piloto e `14.049.00037.00` no PGM, ambos com contratada `0`.
Hoje saem medindo 2 e 1, e o piloto tem por isso o seu único item crítico.

**Os códigos deste módulo entram por extenso** (TASKS 031 regra 1). Derivá-los do
predicado faria o teste afirmar que o código concorda consigo mesmo.
"""

from __future__ import annotations

from decimal import Decimal
from pathlib import Path
from typing import Any

import pytest

from domain.entities.measurement import Measurement
from domain.entities.measurement_item import MeasurementItem
from domain.value_objects.service_code import ServiceCode
from infrastructure.measurement.levantamento_reader import LevantamentoReader

MARCA = "DESCONTANDO RECURSOS DE DESENVOLVIMENTO"

BASE_E11 = "E1.1 - HOSPEDAGEM DE APLICAÇÃO - TOTAL DE RECURSOS"
BASE_VCPU = "TOTAIS VCPU e VRAM"

# ── Os órfãos, medidos na planilha ────────────────────────────────────────────
#
# Cada um está no bloco bruto da sua seção e **ausente** da apuração descontada.
# O valor entre parênteses é o que o Confere devolve hoje — o do bloco bruto.

ORFAO_DO_PILOTO = "14.049.00054.00"  # L59, contratada 0, hoje medida 2
ORFAO_DO_PGM = "14.049.00037.00"  # L45, contratada 0, hoje medida 1

# O órfão da fixture mínima, e os dois vizinhos que provam que a regra é estreita.
ORFAO_DA_FIXTURE = "14.049.00092.00"
ENCOLHE_NA_FIXTURE = "14.049.00090.00"  # 4 no bruto, 2 no descontado
IGUAL_NA_FIXTURE = "14.049.00091.00"  # 2 nos dois


def _medicao(caminho: Path) -> Measurement:
    return LevantamentoReader().ler(caminho)


def _item(
    codigo: str,
    bloco: str,
    *,
    medida: str = "1",
    contratada: str = "1",
    descricao: str = "ITEM",
    linha: int = 1,
) -> MeasurementItem:
    return MeasurementItem(
        codigo=ServiceCode(codigo),
        descricao=descricao,
        bloco_titulo=bloco,
        medida_texto=medida,
        linha=linha,
        contratada_texto=contratada,
    )


# ── `R-APU-01` · o pareamento por título ──────────────────────────────────────


def test_r_apu_01_os_quatro_blocos_reais_emparelham(
    caminho_levantamento: Path, caminho_levantamento_pgm: Path
) -> None:
    """Dois blocos descontados em cada par, e os quatro acham o seu bruto.

    O critério é o título de baixo **menos a marca e o separador**. Medido: casa
    exato nos quatro, sem sobra e sem ambiguidade.
    """
    for caminho in (caminho_levantamento, caminho_levantamento_pgm):
        pareadas = _medicao(caminho)._apuracoes_descontadas()
        assert set(pareadas) == {BASE_E11, BASE_VCPU}, caminho.name


def test_r_apu_01_o_pareamento_nao_e_por_posicao(caminho_levantamento: Path) -> None:
    """O bloco descontado de `E1.1` **não** é o seguinte ao bruto dele.

    No piloto, `TOTAIS VCPU e VRAM` fica entre os dois (L66-67 contra L53-63 e
    L71-80). Parear com o anterior zeraria os códigos da seção errada, e é a
    razão de a `D-02` recusar a resolução por posição.
    """
    medicao = _medicao(caminho_levantamento)
    blocos: list[str] = []
    for item in medicao.itens:
        if not blocos or blocos[-1] != item.bloco_titulo:
            blocos.append(item.bloco_titulo)

    descontado_de_e11 = f"{BASE_E11} - {MARCA}"
    anterior = blocos[blocos.index(descontado_de_e11) - 1]
    assert anterior == BASE_VCPU
    assert anterior != BASE_E11


def test_r_apu_01_marca_abreviada_nao_pareia() -> None:
    """Título que não reproduz a marca inteira não constitui par.

    É o modo de falha da ESPEC 018 §2.8 aplicado a esta regra: uma planilha
    futura que grafe `DESCONTANDO REC. DE DESENVOLVIMENTO` desligaria a regra em
    silêncio. Aqui ela não pareia — e a `V-MED-04` é quem transforma isso em
    achado, em vez de deixar o silêncio (`R-APU-05`).
    """
    medicao = Measurement(
        itens=[
            _item("14.049.00090.00", BASE_E11, linha=1),
            _item("14.049.00090.00", f"{BASE_E11} - DESCONTANDO REC. DE DESENV.", linha=2),
        ]
    )
    assert medicao._apuracoes_descontadas() == {}


# ── `R-APU-03` · a ausência rende zero ────────────────────────────────────────


def test_r_apu_03_o_codigo_ausente_da_apuracao_descontada_mede_zero(
    caminho_apuracao_incompleta: Path,
) -> None:
    """A fixture mínima: três códigos em cima, dois embaixo.

    O terceiro é devolvido como **ocorrência bruta intacta** — quem chama precisa
    da linha, do bloco e do texto da célula para o registro de `R-APU-08`. Quem
    converte para zero é a emissão, não a resolução (`D-03`).
    """
    medicao = _medicao(caminho_apuracao_incompleta)

    omitido = medicao.omitido_da_apuracao_descontada(ORFAO_DA_FIXTURE)
    assert omitido is not None
    assert omitido.medida_texto == "2"
    assert omitido.contratada_texto == "0"
    assert omitido.bloco_titulo == "E1.1 - APURAÇÃO INCOMPLETA - TOTAL DE RECURSOS"


@pytest.mark.parametrize("codigo", [ENCOLHE_NA_FIXTURE, IGUAL_NA_FIXTURE])
def test_r_apu_03_quem_esta_nos_dois_blocos_nao_e_alcancado(
    caminho_apuracao_incompleta: Path, codigo: str
) -> None:
    """A condição 1 da guarda: tendo variante própria, a `R-MED-02` resolve.

    São os dois vizinhos do órfão na mesma seção. Se a regra nova os alcançasse,
    ela estaria substituindo a `R-MED-02` em vez de completá-la.
    """
    medicao = _medicao(caminho_apuracao_incompleta)
    assert medicao.omitido_da_apuracao_descontada(codigo) is None


@pytest.mark.parametrize(
    ("arquivo", "orfao"),
    [("caminho_levantamento", ORFAO_DO_PILOTO), ("caminho_levantamento_pgm", ORFAO_DO_PGM)],
)
def test_r_apu_03_nos_dois_pares_reais(
    request: pytest.FixtureRequest, arquivo: str, orfao: str
) -> None:
    """Os dois códigos de produção, nomeados por extenso (`R-APU-09`)."""
    medicao = _medicao(request.getfixturevalue(arquivo))
    omitido = medicao.omitido_da_apuracao_descontada(orfao)
    assert omitido is not None
    assert omitido.contratada_texto == "0"


@pytest.mark.parametrize(
    ("arquivo", "esperado"),
    [
        ("caminho_levantamento", {ORFAO_DO_PILOTO}),
        ("caminho_levantamento_pgm", {ORFAO_DO_PGM}),
    ],
)
def test_r_apu_09_o_conjunto_tocado_e_este_e_nao_outro(
    request: pytest.FixtureRequest, arquivo: str, esperado: set[str]
) -> None:
    """`R-APU-09` — invariante mantido, e não medição de uma vez.

    Cresceu, encolheu ou esvaziou: alguém olha. É a única asserção da suíte que
    reprova quando a regra passa a alcançar mais do que estes dois códigos.
    """
    medicao = _medicao(request.getfixturevalue(arquivo))
    tocados = {
        codigo
        for codigo in medicao.codigos
        if medicao.omitido_da_apuracao_descontada(codigo) is not None
    }
    assert tocados == esperado


# ── `R-APU-05` e `R-APU-07` · o que nenhum par real exercita ──────────────────


def test_r_apu_05_bloco_descontado_sem_bruto_nao_muda_nada() -> None:
    """Sem par, a regra degrada para o comportamento de hoje.

    Um bloco que carregue a marca e não ache o bruto correspondente **não** pode
    zerar coisa alguma: não há do que ele seja o restabelecimento.
    """
    medicao = Measurement(
        itens=[_item("14.049.00090.00", f"BLOCO ÓRFÃO - {MARCA}", medida="3", linha=1)]
    )
    assert medicao._apuracoes_descontadas() == {}
    assert medicao.omitido_da_apuracao_descontada("14.049.00090.00") is None


def test_r_apu_07_medida_nao_numerica_nao_e_zerada() -> None:
    """`PACOTE` ausente da apuração descontada continua caindo na `R-REL-08`.

    **Nenhum arquivo real acusaria a falta desta guarda**, e é por isso que o
    cenário é construído. Um item de pacote não é recurso de desenvolvimento
    contável; zerá-lo seria trocar um `1 / 1` por um `1 / 0` em silêncio.
    """
    medicao = Measurement(
        itens=[
            _item("14.049.00090.00", BASE_E11, medida="PACOTE", linha=1),
            _item("14.049.00091.00", BASE_E11, medida="2", linha=2),
            _item("14.049.00091.00", f"{BASE_E11} - {MARCA}", medida="1", linha=3),
        ]
    )
    assert medicao.omitido_da_apuracao_descontada("14.049.00090.00") is None


# ── `R-APU-04` e `R-APU-06` · o que **não** muda ──────────────────────────────
#
# As duas passam contra o código intocado, e é resultado e não folga: elas
# afirmam que a regra é estreita. Reprovando aqui, a premissa estaria errada
# antes de a implementação começar (TASKS 031 `T-2145`).


def test_r_apu_04_a_contratada_nao_e_arrastada(caminho_levantamento: Path) -> None:
    """O defeito **simétrico** ao que esta espec corrige, e ele tem caso real.

    O `14.024.00005.00` traz a contratada `3500` na ocorrência primária e a
    coluna **vazia** na descontada. Ler a contratada da variante descontada
    produziria `0` onde a planilha afirma 3.500, e um item conforme viraria
    consumo sem cobertura — exatamente o que esta espec existe para desfazer.
    """
    medicao = _medicao(caminho_levantamento)
    assert medicao.contratada_para("14.024.00005.00") == Decimal("3500")
    assert medicao.item_para("14.024.00005.00").medida == Decimal("762.55")


def test_r_apu_06_marca_na_descricao_nao_constitui_apuracao_de_bloco(
    caminho_levantamento: Path,
) -> None:
    """O limite declarado da `D-05`.

    No `14.024.00005.00` a marca está na **descrição da linha**, e o bloco
    `E5.1 - ARMAZENAMENTO DE DADOS` não é apuração descontada. Ali as duas
    ocorrências existem e a `R-MED-02` acerta; inferir apuração de seção a partir
    de uma descrição zeraria todos os demais códigos dela.
    """
    medicao = _medicao(caminho_levantamento)

    blocos_de_e51 = {
        item.bloco_titulo for item in medicao.itens_de("14.024.00005.00")
    }
    assert blocos_de_e51 == {"E5.1 - ARMAZENAMENTO DE DADOS"}
    assert "E5.1 - ARMAZENAMENTO DE DADOS" not in _medicao(
        caminho_levantamento
    )._apuracoes_descontadas()


def test_r_apu_02_os_codigos_repetidos_nao_se_movem(caminho_levantamento: Path) -> None:
    """A `R-MED-02` continua resolvendo os 13 códigos repetidos do piloto.

    Os valores estão congelados em `test_desconto_desenvolvimento.py`, lidos da
    planilha na ESPEC 018. Aqui basta afirmar que **nenhum** deles é alcançado
    pela regra nova: quem tem variante própria para na condição 1 da guarda.
    """
    medicao = _medicao(caminho_levantamento)
    repetidos = [c for c in medicao.codigos if len(medicao.itens_de(c)) > 1]

    assert len(repetidos) == 13
    for codigo in repetidos:
        assert medicao.omitido_da_apuracao_descontada(codigo) is None, codigo


# ── `D-03` · o atalho da camada errada ────────────────────────────────────────


def test_d_03_item_para_devolve_a_ocorrencia_bruta_intacta(
    caminho_levantamento: Path,
) -> None:
    """O único ponto da suíte que reprova o atalho de zerar dentro de `item_para`.

    O atalho é devolver o item com `medida_texto` trocado por `'0'`: sai em duas
    linhas, o número fica certo, e **mente sobre a célula**. A `R-PER-02` foi
    emendada na ESPEC 021 sobre a promessa de que aquele campo guarda o conteúdo
    lido, e é ele que o `LinhaZerada` mostra a quem confere.

    `item_para` responde *qual ocorrência vale*; onde a resposta é *nenhuma*, quem
    responde é `omitido_da_apuracao_descontada`.
    """
    escolhida = _medicao(caminho_levantamento).item_para(ORFAO_DO_PILOTO)

    assert escolhida is not None
    assert escolhida.medida_texto == "2"
    assert escolhida.linha == 59


# ── `R-APU-03` pelo fluxo · o vermelho que mostra o número errado ─────────────
#
# Os testes acima reprovam por `AttributeError`: o mecanismo ainda não existe.
# É vermelho legítimo, e é fraco — não diz **qual** número está errado hoje.
#
# Os dois abaixo passam pelo caso de uso inteiro, com a API pública de sempre, e
# reprovam com o valor de produção na mensagem. São eles que provam que o defeito
# é real e que a correção o alcança (TASKS 031 `T-2145`).


def _linha_emitida(
    contrato: Path, levantamento: Path, codigo: str, aditivos: list[Path] | None = None
) -> Any:
    from infrastructure.di.container import DIContainer, Entradas

    resultado = DIContainer().gerar(
        Entradas(contrato=contrato, levantamento=levantamento, aditivos=aditivos or [])
    )
    assert resultado.relatorio is not None
    return next(
        linha for linha in resultado.relatorio.todas_as_linhas if str(linha.codigo) == codigo
    )


def test_r_apu_03_a_linha_do_piloto_deixa_de_medir_dois(
    caminho_contrato: Path, caminho_levantamento: Path
) -> None:
    """O item que originou a espec, pelo fluxo que gera o documento.

    Hoje sai `contratada 0 / medida 2`, saldo `-2`, e é o **único item crítico do
    piloto**. Os dois servidores são de desenvolvimento, e a apuração descontada
    da seção não os lista.
    """
    from domain.value_objects.classification import Classificacao

    linha = _linha_emitida(caminho_contrato, caminho_levantamento, ORFAO_DO_PILOTO)

    assert linha.medida.valor == 0
    assert linha.contratada.valor == 0
    assert not linha.sem_cobertura_contratual
    assert linha.classificacao is Classificacao.SEM_DIVERGENCIA
    # ESPEC 028 `R-ZER-01` — com os dois zeros, a linha sai do bloco final do
    # `.docx`. O dado continua no `Report`, na análise e na API (`R-ZER-05`).
    assert linha.sem_quantidade_alguma


def test_r_apu_03_a_linha_do_pgm_deixa_de_medir_um(
    caminho_contrato_pgm: Path, caminho_levantamento_pgm: Path, caminho_aditivo_pgm: Path
) -> None:
    """O mesmo caso no segundo par, em outro código — a prova de que não é acaso."""
    linha = _linha_emitida(
        caminho_contrato_pgm, caminho_levantamento_pgm, ORFAO_DO_PGM, [caminho_aditivo_pgm]
    )

    assert linha.medida.valor == 0
    assert not linha.sem_cobertura_contratual


# ── ESPEC 031 §8.3 · os arquivos reais, e não só as fixtures ──────────────────

DOCUMENTOS = Path(__file__).resolve().parents[2] / "docs" / "documentos"
LEVANTAMENTOS_REAIS = {
    "piloto": DOCUMENTOS
    / "SMIT SUSTENTAÇÃO_Levantamento_05969_TC 52SMIT2024_15072026_101414_V2.0.xlsx",
    "pgm": DOCUMENTOS
    / "PMG"
    / "PGM_TC 015_Levantamento_06008_TC 015PGM2024_23072026_095059_V1.0.xlsx",
}


@pytest.mark.producao
@pytest.mark.parametrize(
    ("par", "orfao"), [("piloto", ORFAO_DO_PILOTO), ("pgm", ORFAO_DO_PGM)]
)
def test_espec_031_8_3_a_regra_vale_nos_arquivos_de_producao(par: str, orfao: str) -> None:
    """A fixture prova a forma; este prova que a produção tem a mesma forma.

    **É a única asserção da suíte que abre `docs/documentos/`.** Existe porque a
    ESPEC 018 §2.8 registra o custo de não a ter: a `R-MED-02` ficou desligada nos
    dois arquivos reais por vários incrementos, com a suíte verde, porque a
    fixture era regravada por `openpyxl` numa forma que a produção nunca vê.

    Conferência feita à mão em agosto não é garantia em novembro, e é isso que
    este teste automatiza.
    """
    caminho = LEVANTAMENTOS_REAIS[par]
    if not caminho.exists():  # pragma: no cover — árvore sem os documentos
        pytest.skip(f"arquivo de produção ausente: {caminho.name}")

    medicao = _medicao(caminho)

    assert set(medicao._apuracoes_descontadas()) == {BASE_E11, BASE_VCPU}
    tocados = {
        codigo
        for codigo in medicao.codigos
        if medicao.omitido_da_apuracao_descontada(codigo) is not None
    }
    assert tocados == {orfao}
