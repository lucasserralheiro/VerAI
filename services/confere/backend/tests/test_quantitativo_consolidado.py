"""T-1600 a T-1609 — O contratado é a proposta mais os seus aditivos (ESPEC 022).

O que esta espec entrega, num arquivo: `Aumento` e `Redução` somados ao
consolidado, a `V-REC-01` voltando a comparar em vez de suprimir, e a prova de
que nada disso alcança o `.docx` ou o `.xlsx`.

**O oráculo é o documento, não o extrator.** As constantes abaixo são
transcritas da proposta de aditivo — os mesmos valores que a ESPEC 019 §2.9
registrou lendo o PDF, antes de existir código que os somasse. A `T-1603` é o
que separa *erro de transcrição* de *extrator entregando outra coisa*, e é por
isso que ela roda só o extrator.
"""

from __future__ import annotations

from dataclasses import replace
from decimal import Decimal
from pathlib import Path

import pytest
from pacote import partes

from domain.entities.analysis import AnaliseDaMedicao
from domain.entities.contract import Contract
from domain.entities.measurement import Measurement
from domain.entities.validation_finding import ValidationReport
from domain.value_objects.block_label import RotuloDeBloco
from domain.value_objects.classification import Classificacao
from infrastructure.contract.pdfplumber_extractor import PdfPlumberContractExtractor
from infrastructure.di.container import DIContainer, Entradas
from infrastructure.report.docx_renderer import DocxRenderer
from infrastructure.report.xlsx_analise_renderer import XlsxAnaliseRenderer
from infrastructure.validations.reconciliation_validations import (
    v_rec_01_divergencia_de_quantidade_contratada,
)

# ── T-1600 · O oráculo, transcrito do documento ───────────────────────────────
#
# **Fonte única das asserções de quantidade deste arquivo.** Não pode ser
# regenerada a partir do código: derivá-la da saída do extrator transformaria
# todo teste daqui em *"o código faz o que o código faz"*.
#
# Os quatro `Aumento` e a única `Redução` da `PA-PGM-260304-715`. O sinal do
# `12.030.00001.00` **vem do documento** — a tabela de redução do aditivo traz
# `-80,00` e `-897.734,40`, não valores positivos a serem negados por rótulo
# (ESPEC 022 `D-02`). Transcrever `80,00` "porque redução é positiva" é o erro
# que a T-1603 existe para pegar.
DELTAS_DO_ADITIVO = {
    "10.050.00001.00": Decimal("554.01"),
    "14.031.00020.00": Decimal("5.00"),
    "14.024.00006.00": Decimal("2900.89"),
    "14.048.00027.00": Decimal("1100.00"),
    "12.030.00001.00": Decimal("-80.00"),
}

# O contratado resultante — proposta mais delta —, e o que a aba `Levantamento`
# declara para os mesmos códigos. As duas colunas da ESPEC 022 §2.2: elas batem,
# cinco de cinco, e é isso que devolve sentido ao silêncio da `V-REC-01`.
CONTRATADO_CONSOLIDADO = {
    "10.050.00001.00": Decimal("42814.01"),
    "12.030.00001.00": Decimal("70.00"),
    "14.024.00006.00": Decimal("9000.89"),
    "14.031.00020.00": Decimal("10.00"),
    "14.048.00027.00": Decimal("1300.00"),
}

# O código que a T-1605 adultera, e o valor adulterado. Fica em constante porque
# três testes o referenciam e a coincidência entre eles é o ponto.
CODIGO_ADULTERADO = "14.048.00027.00"
CONTRATADA_ADULTERADA = "1400"

# A comparação de pacotes vive em `pacote.py` desde a T-2000 (ESPEC 026), que
# precisou da mesma para provar o contrário — que uma reescrita do renderizador
# não alcança o documento. A exclusão do `docProps/core.xml` e a razão dela
# foram junto, e continuam lá.


# ── Fixtures ──────────────────────────────────────────────────────────────────


@pytest.fixture(scope="module")
def proposta_pgm(caminho_contrato_pgm: Path) -> Contract:
    return PdfPlumberContractExtractor().extrair(caminho_contrato_pgm)


@pytest.fixture(scope="module")
def aditivo_pgm(caminho_aditivo_pgm: Path) -> Contract:
    return PdfPlumberContractExtractor().extrair(caminho_aditivo_pgm)


@pytest.fixture(scope="module")
def medicao_pgm(caminho_levantamento_pgm: Path) -> Measurement:
    return DIContainer().leitor_de_medicao().ler(caminho_levantamento_pgm)


@pytest.fixture(scope="module")
def consolidado(proposta_pgm: Contract, aditivo_pgm: Contract) -> Contract:
    return proposta_pgm.aplicar([aditivo_pgm])


def _itens_de_delta(aditivo: Contract) -> list[int]:
    """Identidade dos itens que os blocos de delta contribuem.

    Por `id()`, e não por igualdade: `ContractItem` é `frozen` e comparável, e
    uma linha da proposta pode ser igual a uma do aditivo campo a campo. O que
    se quer remover é **aquele objeto**, não um equivalente.
    """
    return [
        id(item)
        for bloco in aditivo.blocos
        if bloco.rotulo in (RotuloDeBloco.AUMENTO, RotuloDeBloco.REDUCAO)
        for item in bloco.itens
    ]


def _sem_os_deltas(consolidado: Contract, aditivo: Contract) -> Contract:
    """O mesmo consolidado, com os deltas retirados — o *foil* das T-1601/T-1602.

    Antes da T-1610 os dois são idênticos, porque não há delta aplicado, e as
    duas asserções passam trivialmente. Depois dela os quantitativos divergem em
    cinco códigos e as asserções passam a **significar** o que dizem: que a
    quantidade do contrato não alcança os artefatos.
    """
    fora = set(_itens_de_delta(aditivo))
    return replace(consolidado, itens=[i for i in consolidado.itens if id(i) not in fora])


def _gerar(contrato: Contract, medicao: Measurement, destino: Path) -> tuple[Path, Path]:
    """Renderiza os dois artefatos a partir de um contrato dado.

    **Sem anexos, de propósito.** Eles vêm da planilha, são idênticos nos dois
    lados de toda comparação deste arquivo e custam os 29 s que dominam a suíte.
    O que se compara aqui é o efeito do **contrato** sobre os artefatos.
    """
    resultado = DIContainer().caso_de_uso().executar(
        contrato, medicao, ValidationReport(), anexos=[]
    )
    assert resultado.relatorio is not None

    docx = DocxRenderer().renderizar(resultado.relatorio, destino / "relatorio.docx")
    analise = AnaliseDaMedicao.de_relatorio(resultado.relatorio)
    xlsx = XlsxAnaliseRenderer().renderizar(analise, destino / "analise.xlsx")
    return docx, xlsx


def _relatorio_comparavel(contrato: Contract, medicao: Measurement) -> dict[str, object]:
    """O `Report` reduzido ao que o documento exibe."""
    resultado = DIContainer().caso_de_uso().executar(
        contrato, medicao, ValidationReport(), anexos=[]
    )
    assert resultado.relatorio is not None
    relatorio = resultado.relatorio

    def linha(item: object) -> tuple[str, ...]:
        return (
            str(item.codigo),  # type: ignore[attr-defined]
            item.descricao,  # type: ignore[attr-defined]
            item.unidade,  # type: ignore[attr-defined]
            str(item.contratada),  # type: ignore[attr-defined]
            str(item.medida),  # type: ignore[attr-defined]
        )

    return {
        "linhas": [linha(x) for x in relatorio.linhas],
        "demais_itens": [linha(x) for x in relatorio.demais_itens],
        "total_divergencias": relatorio.total_divergencias,
        "derivadas": len(resultado.derivadas),
    }


# ── T-1603 · O oráculo casa o que o extrator lê ───────────────────────────────


def test_t1603_a_transcricao_casa_o_extrator(aditivo_pgm: Contract) -> None:
    """`[portão P0]` — só o extrator, sem consolidação e sem relatório.

    Reprovar aqui tem duas hipóteses com consequências opostas: dedo errado ao
    transcrever (barato — corrige-se a constante) ou o extrator entregando outra
    coisa (caro — muda a ESPEC 022 §2.1). Descobrir na T-1603 custa dez minutos;
    descobrir depois da T-1610 custa refazer as asserções com a saída do código
    como referência, que é o defeito que a T-1600 existe para impedir.
    """
    lidos = {
        item.codigo.valor: item.quantidade
        for bloco in aditivo_pgm.blocos
        if bloco.rotulo in (RotuloDeBloco.AUMENTO, RotuloDeBloco.REDUCAO)
        for item in bloco.itens
    }
    divergentes = {
        codigo: (DELTAS_DO_ADITIVO[codigo], lidos[codigo])
        for codigo in set(lidos) & set(DELTAS_DO_ADITIVO)
        if lidos[codigo] != DELTAS_DO_ADITIVO[codigo]
    }

    assert lidos == DELTAS_DO_ADITIVO, (
        "a transcrição da T-1600 diverge do que o extrator lê — "
        f"só no oráculo: {set(DELTAS_DO_ADITIVO) - set(lidos)}; "
        f"só no extrator: {set(lidos) - set(DELTAS_DO_ADITIVO)}; "
        f"valores diferentes: {divergentes}"
    )


def test_t1603_a_reducao_chega_negativa_do_documento(aditivo_pgm: Contract) -> None:
    """`D-02` — o sinal é dado do documento, não conclusão sobre o rótulo.

    Separado do teste acima porque é a asserção que sustenta a decisão, e um
    relatório de falha que diga *"o dicionário difere"* não a nomearia.

    Derivar o sinal de `RotuloDeBloco.REDUCAO` criaria uma segunda fonte de
    verdade para a mesma informação, e ela divergiria no dia em que um aditivo
    trouxesse uma redução com valor positivo.
    """
    (reducao,) = [b for b in aditivo_pgm.blocos if b.rotulo is RotuloDeBloco.REDUCAO]

    (item,) = reducao.itens
    assert item.quantidade == Decimal("-80.00")
    assert reducao.total_declarado == Decimal("-897734.40")


# ── T-1601 e T-1602 · O entregável não se mexe ────────────────────────────────


def test_t1601_os_artefatos_nao_dependem_do_quantitativo_do_contrato(
    consolidado: Contract,
    aditivo_pgm: Contract,
    medicao_pgm: Measurement,
    tmp_path: Path,
) -> None:
    """`[portão P1]` / `R-QTD-05` — o `.docx` e o `.xlsx`, parte a parte.

    **É um teste diferencial, e não um instantâneo.** A alternativa era guardar
    os hashes de hoje num arquivo e comparar contra eles; ela prenderia a suíte
    à saída atual do renderizador, quebrando em toda mudança legítima de layout
    e obrigando a regenerar o esperado — que é o momento em que ninguém confere.

    A propriedade que `R-QTD-05` afirma não é *"o documento é este"*, e sim *"o
    quantitativo do contrato não alcança o documento"*. Comparar dois
    consolidados que diferem **só** nas quantidades afirma exatamente isso, e
    continua verdadeira depois de qualquer mudança de layout.

    Antes da T-1610 os dois lados são o mesmo objeto e o teste passa
    trivialmente. Depois dela, os cinco códigos de ESPEC §2.2 diferem entre os
    lados — e é aí que ele passa a provar alguma coisa.
    """
    com_deltas = tmp_path / "com"
    sem_deltas = tmp_path / "sem"
    com_deltas.mkdir()
    sem_deltas.mkdir()

    docx_a, xlsx_a = _gerar(consolidado, medicao_pgm, com_deltas)
    docx_b, xlsx_b = _gerar(
        _sem_os_deltas(consolidado, aditivo_pgm), medicao_pgm, sem_deltas
    )

    artefatos = (
        ("docx", partes(docx_a), partes(docx_b)),
        ("xlsx", partes(xlsx_a), partes(xlsx_b)),
    )
    for nome, a, b in artefatos:
        divergentes = sorted(k for k in a.keys() | b.keys() if a.get(k) != b.get(k))
        assert not divergentes, (
            f"o {nome} mudou ao somar os deltas do aditivo — partes divergentes: "
            f"{divergentes}. `R-QTD-05` diz que o entregável não se move"
        )


def test_t1602_o_report_nao_depende_do_quantitativo_do_contrato(
    consolidado: Contract,
    aditivo_pgm: Contract,
    medicao_pgm: Measurement,
) -> None:
    """`[portão P1]` — a mesma propriedade, um nível acima.

    Parece redundante com a T-1601 e não é: o hash do zip responde *sim ou não*,
    e quando a resposta for *não* — num refactor futuro, será — ele não diz se
    mudou uma quantidade, uma descrição ou a ordem. Este diz, e falha antes.

    É também a prova mais forte das duas: se o `Report` é idêntico, o `.docx` e
    o `.xlsx` não têm de onde divergir.
    """
    com = _relatorio_comparavel(consolidado, medicao_pgm)
    sem = _relatorio_comparavel(_sem_os_deltas(consolidado, aditivo_pgm), medicao_pgm)

    assert com["linhas"] == sem["linhas"]
    assert com["demais_itens"] == sem["demais_itens"]
    assert com["total_divergencias"] == sem["total_divergencias"]
    assert com["derivadas"] == sem["derivadas"]


# ── T-1604 e T-1606 · A soma, e o sinal ───────────────────────────────────────


def test_t1604_o_consolidado_soma_os_deltas(consolidado: Contract) -> None:
    """`R-QTD-01` — os cinco valores de ESPEC §2.2, um a um.

    **Os números, não a contagem.** Um teste que afirmasse apenas *"zero
    divergências contra a aba"* passaria com a soma errada em dois códigos que
    se cancelassem entre si.
    """
    somados = {codigo: consolidado.quantidade_para(codigo) for codigo in CONTRATADO_CONSOLIDADO}

    assert somados == CONTRATADO_CONSOLIDADO


def test_t1604_o_delta_entra_como_item_do_mesmo_codigo(
    consolidado: Contract, proposta_pgm: Contract
) -> None:
    """A metade da soma do antigo `test_t1320_aumento_e_reducao_nao_mudam_nada`.

    Aquele teste afirmava que a lista de itens não se mexia (T-1607). É esta a
    asserção inversa, e ela é a razão de `quantidade_para` funcionar sem uma
    linha nova: o mecanismo que soma as três ocorrências de `10.050.00001.00` na
    proposta soma também a quarta, que o aditivo trouxe (`D-01`).
    """
    for codigo in DELTAS_DO_ADITIVO:
        assert len(consolidado.itens_de(codigo)) == len(proposta_pgm.itens_de(codigo)) + 1


def test_t1606_a_reducao_e_subtraida_e_nao_somada(consolidado: Contract) -> None:
    """`R-QTD-02` / `D-02` — o único caso de redução dos dois pares.

    Separado da `T-1604` de propósito: lá seria uma linha entre cinco, e o
    relatório de falha diria *"uma das somas está errada"*. Aqui diz **qual
    defeito**: alguém aplicou `abs()` ao delta, ou negou por rótulo em vez de
    usar o sinal do documento.

    Com `abs()` este código sairia `230,00`; com dupla negação, `230,00`
    também — e a `T-1604` sozinha não distinguiria isso de um erro de leitura.
    """
    assert consolidado.quantidade_para("12.030.00001.00") == Decimal("70.00")


def test_t1604_v_rec_01_nao_aceita_mais_explicados() -> None:
    """`R-QTD-06` — asserção de **assinatura**.

    É o que impede o parâmetro de voltar como padrão silencioso: um
    `explicados: set[str] | None = None` reintroduzido não quebra nenhum
    chamador, não aparece em nenhum teste de comportamento, e devolve a
    supressão sem que nada acuse.
    """
    import inspect

    parametros = inspect.signature(v_rec_01_divergencia_de_quantidade_contratada).parameters

    assert "explicados" not in parametros


# ── T-1609 · Delta e exclusão na mesma sequência ──────────────────────────────


def test_t1609_o_delta_nao_ressuscita_codigo_excluido(
    proposta_pgm: Contract, aditivo_pgm: Contract
) -> None:
    """`R-QTD-04` — a combinação que nenhuma peça real exercita.

    `test_t1320_os_aditivos_sao_aplicados_em_sequencia` cobre `Inclusão` ×
    `Exclusão`. Com quatro rótulos aplicados existe uma combinação a mais:
    aumentar um código numa peça e excluí-lo na seguinte.

    A guarda de `R-QTD-03` é recalculada **dentro** do laço, e é isso que faz o
    caso funcionar: no momento em que o delta da segunda peça seria aplicado, o
    código já saiu.
    """
    from domain.entities.contract import BlocoDeItens

    codigo = "14.048.00027.00"
    linha = proposta_pgm.itens_de(codigo)[0]
    exclusao = replace(
        aditivo_pgm,
        proposta="PA-EXCLUI",
        blocos=(BlocoDeItens(rotulo=RotuloDeBloco.EXCLUSAO, itens=(linha,)),),
        itens=[linha],
    )

    consolidado = proposta_pgm.aplicar([aditivo_pgm, exclusao])

    assert codigo not in consolidado.codigos
    assert consolidado.quantidade_para(codigo) is None


# ── T-1605 · A cegueira ───────────────────────────────────────────────────────


class _LeitorComAbaAdulterada:
    """`IMeasurementReader` que devolve a medição com uma célula trocada.

    A adulteração acontece **no agregado**, e não na planilha: mexer no `.xlsx`
    exigiria uma fixture nova, e a fixture nova teria de ser mantida em sincronia
    com a real para o resto sempre valer. O que se quer exercitar é a
    reconciliação, não o leitor — que tem cobertura própria.
    """

    def __init__(self, medicao: Measurement) -> None:
        self._medicao = medicao

    def ler(self, caminho: Path) -> Measurement:
        itens = [
            replace(item, contratada_texto=CONTRATADA_ADULTERADA)
            if item.codigo.valor == CODIGO_ADULTERADO
            else item
            for item in self._medicao.itens
        ]
        return replace(self._medicao, itens=itens)


class _ContratosEmCache:
    """`IContractExtractor` que devolve as peças já extraídas, por caminho."""

    def __init__(self, por_caminho: dict[Path, Contract]) -> None:
        self._por_caminho = por_caminho

    def extrair(self, caminho: Path) -> Contract:
        return self._por_caminho[caminho]


class _ContainerComAbaAdulterada(DIContainer):
    """O container **real**, com as leituras substituídas e nada mais.

    A ordem das validações, o caso de uso e a consolidação continuam sendo os de
    produção — é o que mantém a T-1605 valendo como prova de ponta a ponta, e não
    como exercício de uma função isolada. Mesmo padrão do
    `_ContainerComFontesEmCache` do `conftest`.
    """

    def __init__(self, contratos: dict[Path, Contract], medicao: Measurement) -> None:
        super().__init__()
        self._contratos = contratos
        self._medicao = medicao

    def extrator_de_contrato(self) -> _ContratosEmCache:  # type: ignore[override]
        return self._obter("contrato", lambda: _ContratosEmCache(self._contratos))

    def leitor_de_medicao(self) -> _LeitorComAbaAdulterada:  # type: ignore[override]
        return self._obter("medicao", lambda: _LeitorComAbaAdulterada(self._medicao))


def test_t1605_a_aba_adulterada_e_acusada(
    caminho_contrato_pgm: Path,
    caminho_aditivo_pgm: Path,
    caminho_levantamento_pgm: Path,
    proposta_pgm: Contract,
    aditivo_pgm: Contract,
    medicao_pgm: Measurement,
) -> None:
    """`[portão P3]` — **o único teste deste arquivo que mede o objetivo.**

    Os demais medem que nada quebrou. Este mede o que a entrega existe para
    conseguir: que o silêncio da `V-REC-01` volte a significar *"eu conferi e
    bate"* em vez de *"a comparação foi desligada"*.

    Com o aditivo submetido e a aba trazendo `1.400` onde o contratado
    consolidado é `1.300`, o sistema **de hoje** não percebe: `14.048.00027.00`
    está na lista de códigos que `explicados` suprime, e a comparação não roda.
    Com os deltas somados, ela roda e acusa.

    ESPEC 022 §2.4 mediu os cinco cenários; este é a quarta e a quinta linhas
    daquela tabela, na mesma asserção.

    T-1618 — **verde desde a T-1614.** Escrito na T-1605 contra o código
    intocado, ele reprovou acusando `nada`, que é a cegueira medida. Fica
    registrado porque é a distinção que importa: um teste desta forma escrito
    *depois* da mudança estaria verde no primeiro dia e não provaria nada. Se
    algum dia ele voltar ao vermelho com `acusados == set()`, a supressão
    voltou — por lista de códigos ou por um `Aumento` deixando de ser somado.
    """
    resultado = _ContainerComAbaAdulterada(
        {caminho_contrato_pgm: proposta_pgm, caminho_aditivo_pgm: aditivo_pgm},
        medicao_pgm,
    ).gerar(
        Entradas(
            contrato=caminho_contrato_pgm,
            levantamento=caminho_levantamento_pgm,
            aditivos=(caminho_aditivo_pgm,),
        )
    )

    # T-1728 / ESPEC 023 — **reancorada, e mais forte do que entrou.**
    #
    # A `V-REC-01` deixou de registrar achado (`R-FON-09`) e passou a devolver
    # registros estruturados. A reancoragem barata seria `achados.avisos == []`,
    # que ficaria verde — **e ficaria verde também num sistema que voltasse a
    # suprimir**. Este teste é a única evidência viva de que a cegueira da ESPEC
    # 022 fechou; reduzido àquilo, sobreviveria como linha de código e morreria
    # como prova.
    #
    # A âncora nova lê a mesma informação da fonte nova, e acrescenta a
    # severidade: a divergência que sobra **com o aditivo aplicado** é o caso
    # mais grave que a validação sabe produzir (`R-FON-02`).
    acusados = {d.codigo for d in resultado.divergencias}

    assert acusados == {CODIGO_ADULTERADO}, (
        "a aba declara 1.400 para um código cujo contratado consolidado é 1.300, "
        f"e a V-REC-01 acusou {acusados or 'nada'} — o silêncio por lista de "
        "códigos não distingue *as fontes concordam* de *a planilha está errada*"
    )

    (divergencia,) = resultado.divergencias
    assert divergencia.severidade is Classificacao.CRITICO
    assert divergencia.tem_aditivo_aplicado
