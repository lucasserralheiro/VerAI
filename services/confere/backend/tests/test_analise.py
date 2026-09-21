"""ESPEC 009 — Classificação e agregado da análise.

O teste que mais importa é o de fronteira: as quatro situações são exclusivas e
exaustivas, e é isso que faz o quadro-resumo poder ser lido como um todo. Se uma
linha ficar sem situação, ou cair em duas, o total deixa de significar alguma
coisa — e o total é a primeira coisa que quem confere olha.
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal

import pytest

from domain.entities.analysis import AnaliseDaMedicao, competencia_por_extenso
from domain.entities.report import Report, ReportLine
from domain.value_objects.classification import Classificacao
from domain.value_objects.quantity import NumberFormat, Quantity
from domain.value_objects.service_code import ServiceCode


def _linha(
    codigo: str,
    contratada: str,
    medida: str,
    *,
    perfil: bool = False,
) -> ReportLine:
    return ReportLine(
        codigo=ServiceCode(codigo),
        descricao="ITEM",
        unidade="UN",
        contratada=Quantity(Decimal(contratada)),
        medida=Quantity(Decimal(medida)),
        perfil_ou_pacote=perfil,
    )


def _relatorio(linhas: list[ReportLine], demais: list[ReportLine] | None = None) -> Report:
    """ESPEC 018 — sem seções. `demais` é o bloco final (`D-06`).

    O que era `sem_previsao_contratual` — lista à parte, com as linhas que a
    `R-DIV-05` mantinha **fora** do documento — passou a ser leitura da própria
    linha (`sem_cobertura_contratual`), porque nada mais é omitido.
    """
    return Report(
        titulo="LEVANTAMENTO",
        data_levantamento=date(2026, 7, 15),
        contrato_referencia="TC 52/SMIT/2024",
        proposta_origem="PA-SMIT-260319-739",
        linhas=linhas,
        demais_itens=demais or [],
    )


# ── T-511 · as fronteiras de R-ANA-01 a R-ANA-04 ──────────────────────────────


@pytest.mark.parametrize(
    ("contratada", "medida", "esperada"),
    [
        # `c < m` — medido acima do contratado.
        ("0", "2", Classificacao.CRITICO),
        ("5", "5.01", Classificacao.CRITICO),
        # `c > m` e `m == 0` — contratado e nada medido.
        ("100", "0", Classificacao.MAIOR_RELEVANCIA),
        ("1", "0", Classificacao.MAIOR_RELEVANCIA),
        # `c > m` e `m != 0` — entrega parcial.
        ("5", "2", Classificacao.DIVERGENTE),
        ("3500", "762.55", Classificacao.DIVERGENTE),
        # `c == m`.
        ("1", "1", Classificacao.SEM_DIVERGENCIA),
        ("3265.64", "3265.64", Classificacao.SEM_DIVERGENCIA),
        # Fronteira sem caso real, mas com regra: sem ela a linha ficaria sem
        # situação e `R-ANA-05` cairia (ESPEC 009 §5.1).
        ("0", "0", Classificacao.SEM_DIVERGENCIA),
    ],
)
def test_r_ana_01_a_04_fronteiras(contratada: str, medida: str, esperada: Classificacao) -> None:
    assert _linha("14.049.00037.00", contratada, medida).classificacao is esperada


def test_r_ana_06_compara_decimal_e_nao_texto_formatado() -> None:
    """O teste que pega a comparação por texto.

    `117,2889…` e `117,29` são o **mesmo texto** depois de formatados — a
    formatação arredonda para duas casas. Se a classificação passar a usar
    `formatar()`, este item vira *sem divergência*, e um item divergente sai do
    relatório de análise afirmando conformidade.
    """
    linha = _linha("14.070.00001.00", "117.29", "117.2889")

    assert linha.contratada.formatar() == linha.medida.formatar()
    assert linha.classificacao is Classificacao.DIVERGENTE


def test_r_ana_06_milhar_nao_muda_a_classificacao() -> None:
    """A formatação é atributo do item (`R-MED-04`) e não participa da comparação."""
    milhar = ReportLine(
        codigo=ServiceCode("14.024.00006.00"),
        descricao="NAS",
        unidade="GB/MÊS",
        contratada=Quantity(Decimal("4000"), NumberFormat.MILHAR),
        medida=Quantity(Decimal("4000"), NumberFormat.SIMPLES),
    )
    assert milhar.classificacao is Classificacao.SEM_DIVERGENCIA


# ── T-512 · o invariante da soma ──────────────────────────────────────────────


@pytest.mark.parametrize("com_sem_previsao", [True, False])
def test_r_ana_05_soma_das_quatro_e_o_universo(com_sem_previsao: bool) -> None:
    """Parametrizado pelos dois universos — 56 e 55 — desde já.

    `D-01` depende do insumo `I-06`. Se a resposta for "são as 55 linhas do
    relatório", o que muda é o corpo de `universo_da_analise()`; este teste
    continua valendo nos dois mundos, e é isso que torna a decisão barata.
    """
    linhas = [
        _linha("11.051.00012.00", "100", "0"),
        _linha("12.029.00025.00", "5", "2"),
        _linha("12.030.00001.00", "60", "60"),
    ]
    extras = [_linha("14.049.00054.00", "0", "2")] if com_sem_previsao else []

    analise = AnaliseDaMedicao.de_relatorio(_relatorio(linhas, extras))

    assert analise.total_itens == len(linhas) + len(extras)
    assert sum(s.quantidade for s in analise.situacoes) == analise.total_itens


def test_nenhuma_linha_fica_sem_situacao() -> None:
    """Exaustividade, dita de outro jeito: toda linha aparece uma vez, em uma só."""
    linhas = [
        _linha("14.049.00054.00", "0", "2"),
        _linha("11.051.00012.00", "100", "0"),
        _linha("12.029.00025.00", "5", "2"),
        _linha("12.030.00001.00", "1", "1"),
    ]
    analise = AnaliseDaMedicao.de_relatorio(_relatorio(linhas))

    classificadas = [item for situacao in analise.situacoes for item in situacao.itens]
    assert len(classificadas) == len(linhas)
    assert {str(item.linha.codigo) for item in classificadas} == {
        "14.049.00054.00",
        "11.051.00012.00",
        "12.029.00025.00",
        "12.030.00001.00",
    }


# ── T-553 · a situação vazia, que o piloto não produz ─────────────────────────


def test_r_api_01_as_quatro_situacoes_saem_sempre() -> None:
    """Caso **construído**, não amostrado.

    Com o universo de `D-01` as quatro situações do piloto têm itens — 1, 20, 16
    e 19 —, então nenhum teste alimentado pelos arquivos reais percorre este
    caminho. A única categoria vazia que este projeto conhece é a `Itens
    Críticos` do artefato de referência, e ela está vazia por engano.
    """
    analise = AnaliseDaMedicao.de_relatorio(_relatorio([_linha("12.030.00001.00", "1", "1")]))

    assert [s.classificacao for s in analise.situacoes] == list(Classificacao)
    assert analise.situacao(Classificacao.CRITICO).quantidade == 0
    assert analise.situacao(Classificacao.CRITICO).itens == []
    assert analise.situacao(Classificacao.MAIOR_RELEVANCIA).quantidade == 0
    assert analise.situacao(Classificacao.SEM_DIVERGENCIA).quantidade == 1


def test_relatorio_sem_linha_nenhuma_ainda_traz_as_quatro() -> None:
    analise = AnaliseDaMedicao.de_relatorio(_relatorio([]))

    assert len(analise.situacoes) == 4
    assert analise.total_itens == 0


# ── T-510 · a marca de origem ─────────────────────────────────────────────────


def test_d_01_item_sem_previsao_entra_como_critico_e_marcado() -> None:
    """O único item crítico da competência-piloto vive fora das 55 linhas.

    `R-REC-01` o omite do relatório; `D-01` o traz para a análise. A marca é o
    que o distingue de um excesso sobre item que ao menos tem cobertura
    contratual — dentro de *crítico*, ele é o caso mais grave de todos.
    """
    analise = AnaliseDaMedicao.de_relatorio(
        _relatorio(
            [_linha("12.030.00001.00", "60", "60")],
            [_linha("14.049.00054.00", "0", "2")],
        )
    )

    criticos = analise.situacao(Classificacao.CRITICO).itens
    assert [str(item.linha.codigo) for item in criticos] == ["14.049.00054.00"]
    assert criticos[0].sem_previsao_contratual is True


def test_linha_do_relatorio_nao_e_marcada_como_sem_previsao() -> None:
    analise = AnaliseDaMedicao.de_relatorio(_relatorio([_linha("12.030.00001.00", "1", "1")]))

    item = analise.situacao(Classificacao.SEM_DIVERGENCIA).itens[0]
    assert item.sem_previsao_contratual is False


# ── T-513 · perfil e pacote ───────────────────────────────────────────────────


def test_r_ana_08_perfil_cai_em_sem_divergencia_e_e_contado() -> None:
    """A contagem existe para que a categoria não afirme mais do que sabe.

    Itens de perfil entram como `1/1` por `R-REC-04`, independentemente da
    planilha: o banco de dados contratado no perfil D e medido no perfil C
    aparece como se não houvesse diferença nenhuma.
    """
    analise = AnaliseDaMedicao.de_relatorio(
        _relatorio(
            [
                _linha("14.048.00008.00", "1", "1", perfil=True),
                _linha("14.025.00011.00", "1", "1", perfil=True),
                _linha("12.030.00001.00", "60", "60"),
            ]
        )
    )

    conformes = analise.situacao(Classificacao.SEM_DIVERGENCIA)
    assert conformes.quantidade == 3
    assert conformes.perfis_ou_pacotes == 2


# ── T-555 · a competência por extenso ─────────────────────────────────────────


@pytest.mark.parametrize(
    ("data", "esperado"),
    [
        (date(2026, 7, 15), "julho/2026"),
        (date(2026, 1, 31), "janeiro/2026"),
        (date(2026, 3, 1), "março/2026"),
        (date(2025, 12, 31), "dezembro/2025"),
        (None, ""),
    ],
)
def test_r_res_03_competencia_nao_depende_de_locale(data: date | None, esperado: str) -> None:
    """Tabela própria, nunca `%B`.

    `strftime("%B")` devolve `July` num container em inglês e estoura em outro
    sem `pt_BR` instalado. A aplicação roda em Docker, onde a configuração
    regional não é dada — e um relatório que instrui faturamento não pode ter o
    nome do mês dependendo da imagem base.
    """
    assert competencia_por_extenso(data) == esperado


def test_os_doze_meses_estao_em_portugues() -> None:
    assert [competencia_por_extenso(date(2026, mes, 1)) for mes in range(1, 13)] == [
        "janeiro/2026",
        "fevereiro/2026",
        "março/2026",
        "abril/2026",
        "maio/2026",
        "junho/2026",
        "julho/2026",
        "agosto/2026",
        "setembro/2026",
        "outubro/2026",
        "novembro/2026",
        "dezembro/2026",
    ]


# ── Identificação e rótulos ───────────────────────────────────────────────────


def test_identificacao_vem_do_relatorio_e_nao_de_constante() -> None:
    """PLANO 009 §6.2 — o gabarito traz `TC 52/SMIT/2024 - TA 02` e uma proposta
    que não existe em nenhuma das duas fontes lidas. Gravar isso no código seria
    inventar dado que a aplicação não tem como saber."""
    analise = AnaliseDaMedicao.de_relatorio(_relatorio([_linha("12.030.00001.00", "1", "1")]))

    assert analise.contrato_referencia == "TC 52/SMIT/2024"
    assert analise.proposta_origem == "PA-SMIT-260319-739"
    assert analise.competencia == "julho/2026"


def test_rotulo_e_glosa_saem_do_dominio() -> None:
    """Tela e arquivo dizem a mesma coisa porque leem do mesmo lugar (`R-XLS-02`)."""
    assert Classificacao.CRITICO.rotulo == "Item crítico"
    assert Classificacao.CRITICO.glosa == "medido acima do contratado"
    assert Classificacao.MAIOR_RELEVANCIA.glosa == "contratado sem medição no período"
    assert all(c.rotulo and c.glosa for c in Classificacao)
