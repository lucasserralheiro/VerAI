"""T-43 — Reconciliação: um teste por regra `R-*` e por validação `V-*`.

Este é o primeiro ponto em que existe um relatório. Depois da ESPEC 018 as
asserções conferem as **58 linhas** do piloto — 54 ordenadas pelo contrato mais
4 no bloco final —, e não mais 55 linhas em 22 seções.
"""

from __future__ import annotations

from collections import Counter
from collections.abc import Callable
from decimal import Decimal
from pathlib import Path

import pytest
from conftest import FontesCaras, _ContainerComFontesEmCache

from application.use_cases.generate_measurement_report import ReportResult
from domain.entities.contract import Contract
from domain.entities.contract_item import ContractItem
from domain.entities.measurement import Measurement
from domain.entities.report import ReportLine
from domain.entities.validation_finding import ValidationReport
from domain.value_objects.service_code import ServiceCode
from infrastructure.di.container import DIContainer, Entradas
from infrastructure.validations.contract_validations import (
    v_ctr_05_codigo_contratado_ausente_da_aba,
)
from infrastructure.validations.reconciliation_validations import (
    v_rec_01_divergencia_de_quantidade_contratada,
)


class _MedicaoFixa:
    """ESPEC 027 T-2032 — devolve uma `Measurement` já adulterada, sem ler arquivo.

    Espelha `_ContratoEmCache` do `conftest.py`: mesmo padrão, para o outro
    dos dois leitores caros.
    """

    def __init__(self, medicao: Measurement) -> None:
        self._medicao = medicao

    def ler(self, caminho: Path) -> Measurement:
        return self._medicao


class _ExtratorFixo:
    """ESPEC 027 T-2033 — devolve um `Contract` construído à mão, sem ler PDF."""

    def __init__(self, contrato: Contract) -> None:
        self._contrato = contrato

    def extrair(self, caminho: Path) -> Contract:
        return self._contrato


@pytest.fixture(scope="module")
def resultado(gerar_piloto: Callable[..., ReportResult]) -> ReportResult:
    return gerar_piloto()


def _linha(resultado: ReportResult, codigo: str) -> ReportLine | None:
    assert resultado.relatorio is not None
    linhas = resultado.relatorio.todas_as_linhas
    return next((linha for linha in linhas if str(linha.codigo) == codigo), None)


# ── Forma do relatório ────────────────────────────────────────────────────────


def test_nao_ha_achado_bloqueante(resultado: ReportResult) -> None:
    assert not resultado.bloqueado, [a.mensagem for a in resultado.achados.bloqueantes]


def test_relatorio_tem_58_linhas(resultado: ReportResult) -> None:
    """`R-REL-01` — o universo é a aba, menos a família `10.050`."""
    assert resultado.relatorio is not None
    assert len(resultado.relatorio.linhas) == 54
    assert len(resultado.relatorio.demais_itens) == 4
    assert resultado.relatorio.total_linhas == 58


def test_ordem_das_linhas_segue_o_contrato(resultado: ReportResult) -> None:
    """`R-REL-03` — era a ordem editorial do catálogo.

    Ele listava `11.051` antes de `11.027`, invertendo contrato e planilha. A
    ordem passa a ser a de aparição na tabela de itens do contrato.
    """
    assert resultado.relatorio is not None
    primeiros = [str(linha.codigo) for linha in resultado.relatorio.linhas[:2]]
    assert primeiros == ["11.027.00001.00", "11.051.00012.00"]


def test_cabecalho_vem_da_planilha(resultado: ReportResult) -> None:
    assert resultado.relatorio is not None
    assert resultado.relatorio.contrato_referencia == "TC 52/SMIT/2024"
    assert str(resultado.relatorio.data_levantamento) == "2026-07-15"
    assert resultado.relatorio.proposta_origem == "PA-SMIT-260319-739"


# ── R-REL-06 · a família 10.050 ───────────────────────────────────────────────


def test_a_familia_10050_nao_aparece(resultado: ReportResult) -> None:
    """Era `exibir = N` no catálogo; passa a ser constante nomeada (`D-02`).

    Fora do **documento**, dentro da **comparação**.
    """
    assert _linha(resultado, "10.050.00001.00") is None
    assert resultado.relatorio is not None
    assert all(
        not str(linha.codigo).startswith("10.050.")
        for linha in resultado.relatorio.todas_as_linhas
    )


# ── D-04 · nada é omitido ─────────────────────────────────────────────────────


def test_item_sem_cobertura_contratual_entra_no_bloco_final(resultado: ReportResult) -> None:
    """`14.049.00054.00` entra no bloco final — e **já não é sem cobertura**.

    As duas metades desta asserção vêm de especs diferentes, e é o par que
    importa:

    * **entra** (`D-04` da ESPEC 018): o código que só a aba conhece continua no
      `Report`, e o `R-ZER-05` garante que a omissão da ESPEC 028 é do `.docx` e
      de mais nada;
    * **não é sem cobertura** (`R-APU-03` da ESPEC 031): a contratada continua 0,
      mas a medida virou 0. Aquele `2` vinha do bloco bruto de `E1.1`, e a
      apuração descontada da seção não lista o código.

    Trocar uma pela outra é o erro que este teste pega: um `Report` que perdesse
    a linha, ou uma linha que voltasse a acusar consumo sem cobertura.
    """
    linha = _linha(resultado, "14.049.00054.00")
    assert linha is not None
    assert not linha.sem_cobertura_contratual
    assert (linha.contratada.valor, linha.medida.valor) == (0, 0)
    assert resultado.relatorio is not None
    assert linha in resultado.relatorio.demais_itens


def test_o_bloco_final_traz_os_quatro_codigos_que_so_a_aba_conhece(
    resultado: ReportResult,
) -> None:
    assert resultado.relatorio is not None
    assert {str(linha.codigo) for linha in resultado.relatorio.demais_itens} == {
        "12.029.00001.00",
        "14.024.00001.00",
        "14.049.00004.00",
        "14.049.00054.00",
    }


# ── R-REL-08 · perfis e pacotes, derivados da aba ─────────────────────────────


@pytest.mark.parametrize(
    "codigo",
    ["14.048.00008.00", "14.046.00010.00", "14.070.00002.00", "14.025.00011.00"],
)
def test_perfil_e_pacote_saem_como_um_e_um(resultado: ReportResult, codigo: str) -> None:
    """A marcação deixou de vir do catálogo e passou a ser leitura da aba.

    Medida não numérica é perfil ou pacote. A correspondência é exata no piloto,
    nos dois sentidos, e alcança no PGM cinco códigos que o catálogo do SMIT
    desconhecia (ESPEC 018 §2.6).
    """
    linha = _linha(resultado, codigo)
    assert linha is not None
    assert linha.perfil_ou_pacote
    assert linha.contratada.valor == Decimal("1")
    assert linha.medida.valor == Decimal("1")


def test_item_com_medida_numerica_nao_vira_perfil(resultado: ReportResult) -> None:
    """A derivação não engoliu o caso comum."""
    linha = _linha(resultado, "12.055.00002.00")
    assert linha is not None
    assert not linha.perfil_ou_pacote


def test_plataforma_de_bi_rende_uma_linha(resultado: ReportResult) -> None:
    """`D-01` — era desdobrada em `IT0101` e `SG0721` pelo qualificador do catálogo.

    Uma linha por código: a aba traz o `14.025.00011.00` uma vez só, e a medição
    não teria como ser repartida entre as duas. É o custo declarado da decisão,
    registrado no insumo `I-02`.
    """
    assert resultado.relatorio is not None
    bi = [
        linha
        for linha in resultado.relatorio.todas_as_linhas
        if str(linha.codigo) == "14.025.00011.00"
    ]
    assert len(bi) == 1


# ── R-REL-04 e R-MED-02 · quantidades ─────────────────────────────────────────


@pytest.mark.parametrize(
    ("codigo", "contratada", "medida"),
    [
        ("11.051.00012.00", "100", "0"),
        ("12.029.00025.00", "5", "2"),
        ("12.055.00002.00", "30", "21"),
        ("12.030.00001.00", "60", "60"),
        ("14.049.00047.00", "5", "2"),  # R-MED-02 — descontado, não 4
        ("14.049.00048.00", "5", "5"),  # R-MED-02 — descontado, não 7
        ("14.024.00005.00", "3500", "762.55"),  # SAN descontada, não 1097,55
        ("14.049.00005.00", "150", "121.29"),  # vRAM descontada, não 130,25
        ("14.024.00006.00", "4000", "3265.64"),
        ("14.023.00002.00", "1500", "1012"),
        ("14.070.00001.00", "120", "117.29"),
    ],
)
def test_quantidades_da_linha(
    resultado: ReportResult, codigo: str, contratada: str, medida: str
) -> None:
    linha = _linha(resultado, codigo)
    assert linha is not None
    assert linha.contratada.valor == Decimal(contratada)
    assert linha.medida.valor.quantize(Decimal("0.01")) == Decimal(medida)


def test_a_contratada_vem_da_ocorrencia_que_a_declara(resultado: ReportResult) -> None:
    """`Measurement.contratada_para` — e não a da variante descontada.

    A linha do desconto traz a coluna `Quantidade Contratada` **vazia**. Lê-la
    de lá poria 0 onde a aba afirma 3.500, e um item conforme viraria *consumo
    sem cobertura* na análise.
    """
    linha = _linha(resultado, "14.024.00005.00")
    assert linha is not None
    assert linha.contratada.valor == Decimal("3500")
    assert linha.contratada_declarada


# ── R-REL-07 · descrição ──────────────────────────────────────────────────────


def test_descricao_vem_do_contrato(resultado: ReportResult) -> None:
    linha = _linha(resultado, "14.049.00037.00")
    assert linha is not None
    assert linha.descricao.startswith("HOSPEDAGEM DE APLICAÇÃO - TIPO A - GERENCIADA")


def test_a_descricao_e_a_do_contrato_e_nao_a_do_modelo(resultado: ReportResult) -> None:
    """`D-08` — a designação contratual prevalece sobre a redação editorial.

    O modelo grafava `SOA Faixa 5 - acima de 1.000.001`, texto que vinha do
    catálogo. Sem ele vale o que o contrato assinado diz.
    """
    linha = _linha(resultado, "15.076.00005.00")
    assert linha is not None
    assert linha.descricao == "SOA FAIXA 5 - DE 1.000.001 A 2.000.000"


def test_a_descricao_nao_carrega_a_metodologia_de_apuracao(resultado: ReportResult) -> None:
    """O caso que decidiu `D-08`.

    Na aba, a descrição do `14.024.00005.00` é
    `BAIXA PLATAFORMA - SAN - GB - DESCONTANDO RECURSOS DE DESENVOLVIMENTO`.
    O documento vai ao cliente, e metodologia de apuração não é nome de serviço.
    """
    linha = _linha(resultado, "14.024.00005.00")
    assert linha is not None
    assert "DESCONTANDO" not in linha.descricao.upper()


def test_a_descricao_do_bloco_final_vem_da_aba(resultado: ReportResult) -> None:
    """No bloco final não há contrato de onde tirar."""
    linha = _linha(resultado, "14.049.00054.00")
    assert linha is not None
    assert linha.descricao


# ── R-REL-09 · formatação ─────────────────────────────────────────────────────


def test_o_separador_de_milhar_e_sempre(resultado: ReportResult) -> None:
    """Era atributo do item, vindo do catálogo.

    O `14.023.00002.00` saía `1500` sem separador, para reproduzir o modelo. O
    modelo deixou de ser o critério, e uma regra uniforme não tem como divergir
    de si mesma.
    """
    simples = _linha(resultado, "14.023.00002.00")
    milhar = _linha(resultado, "14.024.00006.00")
    assert simples is not None and milhar is not None
    assert simples.contratada.formatar() == "1.500"
    assert milhar.contratada.formatar() == "4.000"
    assert milhar.medida.formatar() == "3.265,64"


# ── V-REC-01 · divergência entre as fontes ────────────────────────────────────


def test_v_rec_01_expoe_a_divergencia_do_certificado(resultado: ReportResult) -> None:
    """Contrato e aditivo dizem 10; o relatório modelo grafa 6 (ESPEC 001 §9.1).

    A aba concorda com o contrato, então a validação não acusa nada aqui — mas a
    linha sai com 10, divergindo do modelo. É divergência declarada no âncora.
    """
    linha = _linha(resultado, "11.027.00001.00")
    assert linha is not None
    assert linha.contratada.valor == Decimal("10")


def test_v_rec_01_acusa_quando_as_fontes_divergem(
    caminho_contrato: Path, caminho_levantamento: Path
) -> None:
    container = DIContainer()
    contrato = container.extrator_de_contrato().extrair(caminho_contrato)
    medicao = container.leitor_de_medicao().ler(caminho_levantamento)

    # Força a divergência num item que hoje concorda entre as fontes.
    alvo = next(i for i in medicao.itens if i.codigo.valor == "12.055.00002.00")
    medicao.itens[medicao.itens.index(alvo)] = type(alvo)(
        codigo=alvo.codigo,
        descricao=alvo.descricao,
        bloco_titulo=alvo.bloco_titulo,
        medida_texto=alvo.medida_texto,
        linha=alvo.linha,
        contratada_texto="99",
    )

    achados = ValidationReport()
    divergencias = v_rec_01_divergencia_de_quantidade_contratada(contrato, medicao, achados)

    # T-1728 / ESPEC 023 `R-FON-09` — a validação **devolve** em vez de registrar
    # (`I-29`). Ela continua sendo unidade nomeada, com arquivo e teste próprios;
    # o que mudou é o canal por onde a informação sai.
    #
    # As asserções antigas liam a mensagem em prosa — `"usa a do levantamento"` —,
    # e a prosa deixou de existir. Ler os campos é mais forte: a frase podia estar
    # certa com o número errado dentro dela.
    assert not achados.bloqueado
    assert achados.avisos == []

    (divergencia,) = [d for d in divergencias if d.codigo == "12.055.00002.00"]
    assert divergencia.na_planilha == Decimal("99")
    assert divergencia.no_contrato != divergencia.na_planilha


# ── V-CTR-05 · código contratado ausente da aba ───────────────────────────────


def test_v_ctr_05_nao_dispara_no_piloto(
    caminho_contrato: Path, caminho_levantamento: Path
) -> None:
    """A aba contém o contrato inteiro nos dois pares reais (ESPEC 018 §2.2)."""
    container = DIContainer()
    contrato = container.extrator_de_contrato().extrair(caminho_contrato)
    medicao = container.leitor_de_medicao().ler(caminho_levantamento)

    achados = ValidationReport()
    v_ctr_05_codigo_contratado_ausente_da_aba(contrato, medicao, achados)

    assert achados.achados == []


def test_v_ctr_05_dispara_quando_o_contratado_nao_foi_medido(
    caminho_contrato: Path, caminho_levantamento: Path
) -> None:
    """Preserva a metade útil da `V-CAT-03`, que morreu com o catálogo."""
    container = DIContainer()
    contrato = container.extrator_de_contrato().extrair(caminho_contrato)
    medicao = container.leitor_de_medicao().ler(caminho_levantamento)

    alvo = "11.051.00012.00"
    medicao.itens = [i for i in medicao.itens if i.codigo.valor != alvo]

    achados = ValidationReport()
    v_ctr_05_codigo_contratado_ausente_da_aba(contrato, medicao, achados)

    assert not achados.bloqueado
    assert [a.codigo for a in achados.avisos] == [alvo]


# ── ESPEC 027 · a guarda de R-LEV-01, pelo `gerar()` completo ─────────────────


def test_v_ctr_05_dispara_pelo_container_com_medicao_lida(
    fontes_caras: FontesCaras, caminho_contrato: Path, caminho_levantamento: Path
) -> None:
    """T-2032 / ESPEC 027 `R-LEV-03`, `D-03` — o negativo da guarda de `R-LEV-01`.

    `test_v_ctr_05_dispara_quando_o_contratado_nao_foi_medido`, acima, já prova
    isto pela validação direta. Este prova pela passagem que a guarda de
    `container.gerar` pode quebrar: com a medição **lida** —
    `medicao.itens` não vazio —, `V-CTR-05` precisa sair do fluxo completo, e
    não só quando chamada isoladamente.
    """
    alvo = "11.051.00012.00"
    medicao = DIContainer().leitor_de_medicao().ler(caminho_levantamento)
    medicao.itens = [i for i in medicao.itens if i.codigo.valor != alvo]

    class _ComMedicaoAdulterada(_ContainerComFontesEmCache):
        def leitor_de_medicao(self) -> _MedicaoFixa:  # type: ignore[override]
            return self._obter("medicao", lambda: _MedicaoFixa(medicao))

    resultado = _ComMedicaoAdulterada(fontes_caras).gerar(
        Entradas(contrato=caminho_contrato, levantamento=caminho_levantamento)
    )

    assert not resultado.achados.bloqueado
    assert alvo in [
        a.codigo for a in resultado.achados.avisos if a.validacao == "V-CTR-05"
    ]


def test_v_ctr_05_continua_com_contrato_bloqueado_por_checksum(
    caminho_levantamento: Path,
) -> None:
    """T-2033 / ESPEC 027 `R-LEV-03` `[risco]` — a guarda é por peça, não por gravidade.

    Contrato bloqueado por checksum, medição lida com um código do contrato
    ausente da aba: `V-CTR-05` continua registrando. É a tarefa que reprova se
    a guarda de `R-LEV-01` — ou qualquer outra — passar a olhar
    `achados.bloqueado` em vez de `medicao.itens`: um contrato bloqueado por
    outro motivo não invalida uma observação verdadeira sobre uma planilha que
    está íntegra.
    """
    alvo = "99.999.00001.00"
    item = ContractItem(
        codigo=ServiceCode(alvo),
        descricao="Item de teste, fora do levantamento",
        unidade="UN",
        quantidade=Decimal("1"),
        preco_unitario=Decimal("1"),
        meses=1,
        total_declarado=Decimal("1"),
        pagina=1,
    )
    contrato_com_checksum_quebrado = Contract(
        proposta="PC-TESTE-027",
        # Não bate com a soma dos itens — dispara `V-CTR-03`, bloqueante.
        total_declarado=Decimal("999999"),
        itens=[item],
    )

    class _ComContratoQuebrado(DIContainer):
        def extrator_de_contrato(self) -> _ExtratorFixo:  # type: ignore[override]
            return _ExtratorFixo(contrato_com_checksum_quebrado)

    resultado = _ComContratoQuebrado().gerar(
        Entradas(contrato=Path("nao-importa.pdf"), levantamento=caminho_levantamento)
    )

    assert resultado.achados.bloqueado
    assert any(a.validacao == "V-CTR-03" for a in resultado.achados.bloqueantes)
    assert alvo in [
        a.codigo for a in resultado.achados.avisos if a.validacao == "V-CTR-05"
    ]


def test_v_med_e_v_ctr_05_nao_disparam_no_pgm(
    caminho_contrato_pgm: Path, caminho_levantamento_pgm: Path
) -> None:
    """T-2030 — o caminho feliz não se moveu, e agora nos dois pares.

    `test_v_ctr_05_nao_dispara_no_piloto` cobre o piloto. Este é o par do PGM,
    pelo `gerar()` completo: nenhuma das quatro validações da guarda de
    `R-LEV-01` dispara quando a medição é lida com sucesso.
    """
    resultado = DIContainer().gerar(
        Entradas(contrato=caminho_contrato_pgm, levantamento=caminho_levantamento_pgm)
    )
    contagem = Counter(a.validacao for a in resultado.achados.achados)
    assert not any(v.startswith("V-MED-") for v in contagem)
    assert "V-CTR-05" not in contagem
