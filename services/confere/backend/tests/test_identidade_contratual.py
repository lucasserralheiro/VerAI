"""T-2077 a T-2081 — ESPEC 029: o par que não é do mesmo contrato.

**Escritos antes da implementação** (PLANO 029 F1). Contra o `HEAD` intocado,
os de detecção reprovam por achado ausente e os três negativos passam — e é o
que a `T-2081` confere.

## O oráculo é o arquivo, nunca o *parser*

As strings deste módulo foram **copiadas da leitura da `T-2074`**, não geradas
por `IdentidadeContratual.de_texto`. Derivá-las do código sob teste faria cada
asserção afirmar *"o código concorda com o código"* — o modo de falha que o
PLANO 021 §1 nomeou.

    contrato.pdf      "…prorrogação do Contrato Nº 52/SMIT/2024, por mais…"
    contrato_pgm.pdf  "…de recursos no Contrato Nº 15/PGM/2024, a partir…"
    aditivo_pgm.pdf   "…de recursos no Contrato Nº 15/PGM/2024 por 8 mes…"
    levantamento.xlsx      "*Valores conforme contrato : TC 52/SMIT/2024"
    levantamento_pgm.xlsx  "*Valores conforme contrato : TC 015/PGM/2024"
    modelo.pdf / amostra_sem_tabela.pdf / …deslocados.xlsx   não declaram

## O que este módulo evita pagar

A extração completa de um contrato custa de 7 a 17 s. As peças são extraídas
**uma vez por sessão**, e o cruzamento é feito chamando as validações
diretamente — que é o que `test_reconciliation` já faz do outro lado do
formulário. A ordem no container tem **um** teste, e ele é o da `T-2079`: é lá
que a ordem importa, porque depois de `aplicar` a peça de origem não é mais
distinguível.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from domain.entities.contract import Contract
from domain.entities.measurement import Measurement
from domain.entities.validation_finding import Severity, ValidationReport
from domain.value_objects.identidade_contratual import IdentidadeContratual
from infrastructure.contract.pdfplumber_extractor import PdfPlumberContractExtractor
from infrastructure.measurement.levantamento_reader import LevantamentoReader
from infrastructure.validations.identity_validations import (
    v_idt_01_levantamento_de_outro_orgao,
    v_idt_02_numero_de_contrato_divergente,
    v_idt_03_peca_de_outro_contrato,
)

# ── T-2077 · o objeto de valor, sem abrir arquivo `[portão P4]` ───────────────

PILOTO_NO_PDF = "prorrogação do Contrato Nº 52/SMIT/2024, por mais 12 (doze) meses"
PGM_NO_PDF = "Aumento de recursos no Contrato Nº 15/PGM/2024, a partir do 01/12/2025"
PILOTO_NA_ABA = "*Valores conforme contrato : TC 52/SMIT/2024"
PGM_NA_ABA = "*Valores conforme contrato : TC 015/PGM/2024"


def test_t2077_a_identidade_sai_da_prosa_do_pdf() -> None:
    identidade = IdentidadeContratual.de_texto(PILOTO_NO_PDF)

    assert identidade is not None
    assert (identidade.base, identidade.orgao, identidade.ano) == (52, "SMIT", "2024")


def test_t2077_a_identidade_sai_da_linha_da_aba() -> None:
    identidade = IdentidadeContratual.de_referencia_da_aba(PILOTO_NA_ABA)

    assert identidade is not None
    assert (identidade.base, identidade.orgao, identidade.ano) == (52, "SMIT", "2024")


def test_t2077_o_zero_a_esquerda_nao_separa_o_par_real() -> None:
    """ESPEC 029 §2.3 — o caso que mataria a espec no primeiro dia de uso.

    O par **real** da PGM compara `15/PGM/2024` com `TC 015/PGM/2024`. Comparação
    textual acusaria o par certo.
    """
    assert IdentidadeContratual.de_texto(PGM_NO_PDF) == (
        IdentidadeContratual.de_referencia_da_aba(PGM_NA_ABA)
    )


def test_t2077_o_sufixo_nao_divide_o_contrato() -> None:
    """`I-03` — *"sim, pode ganhar sufixo"*, respondido pelo negócio.

    `52-A/SMIT/2024` é o mesmo contrato de `52/SMIT/2024`, aditivado. Comparar
    a string faria todo contrato renumerado perguntar à toa.
    """
    com_sufixo = IdentidadeContratual.de_texto("Contrato Nº 52-A/SMIT/2024")
    sem_sufixo = IdentidadeContratual.de_texto("Contrato Nº 52/SMIT/2024")

    assert com_sufixo == sem_sufixo
    assert hash(com_sufixo) == hash(sem_sufixo)
    # …e o sufixo **não se perde**: ele vai para o detalhe técnico do achado.
    assert com_sufixo is not None and com_sufixo.sufixo == "A"
    assert str(com_sufixo) == "52-A/SMIT/2024"


def test_t2077_a_caixa_da_sigla_nao_importa() -> None:
    assert IdentidadeContratual.de_texto("contrato nº 52/smit/2024") == (
        IdentidadeContratual.de_texto(PILOTO_NO_PDF)
    )


def test_t2077_orgaos_diferentes_nao_sao_o_mesmo_contrato() -> None:
    assert IdentidadeContratual.de_texto(PILOTO_NO_PDF) != (
        IdentidadeContratual.de_texto(PGM_NO_PDF)
    )


@pytest.mark.parametrize(
    "texto",
    [
        "",
        "EMPRESA DE TECNOLOGIA DA INFORMAÇÃO E COMUNICAÇÃO DO MUNICÍPIO DE SÃO PAULO",
        "LEVANTAMENTO - COMPROVAÇÃO FIXTURE DESLOCADA",
        # `R-IDT-03` / `I-02` — a aba pode citar a peça junto do contrato, e peça
        # **não é** contrato: sozinha, ela não rende identidade nenhuma.
        "Proposta de Aditivo: PA-SMIT-260319-739",
    ],
)
def test_t2077_texto_sem_identidade_devolve_none(texto: str) -> None:
    """`R-IDT-06` — ausência de sinal é ausência de evidência."""
    assert IdentidadeContratual.de_texto(texto) is None
    assert IdentidadeContratual.de_referencia_da_aba(texto) is None


def test_t2077_a_aba_com_contrato_e_aditivo_rende_o_contrato() -> None:
    """`I-02` — *"pode juntar um contrato e um aditivo"*, que é **um** instrumento.

    A citação da peça na mesma linha não é um segundo contrato.
    """
    identidade = IdentidadeContratual.de_referencia_da_aba(
        "*Valores conforme contrato : TC 52/SMIT/2024 e PA-SMIT-260319-739"
    )

    assert identidade is not None
    assert (identidade.base, identidade.orgao) == (52, "SMIT")


# ── As peças reais, extraídas uma vez por sessão ──────────────────────────────


@pytest.fixture(scope="session")
def contrato_do_pgm(caminho_contrato_pgm: Path) -> Contract:
    """A proposta do PGM, extraída uma vez. São ~17 s, e três testes a usam."""
    return PdfPlumberContractExtractor().extrair(caminho_contrato_pgm)


@pytest.fixture(scope="session")
def aditivo_do_pgm(caminho_aditivo_pgm: Path) -> Contract:
    return PdfPlumberContractExtractor().extrair(caminho_aditivo_pgm)


@pytest.fixture(scope="session")
def medicao_do_piloto(caminho_levantamento: Path) -> Measurement:
    return LevantamentoReader().ler(caminho_levantamento)


@pytest.fixture(scope="session")
def medicao_do_pgm(caminho_levantamento_pgm: Path) -> Measurement:
    return LevantamentoReader().ler(caminho_levantamento_pgm)


# ── T-2078 · os quatro cruzamentos `[portão P1]` ──────────────────────────────


def _achados_do_par(contrato: Contract, medicao: Measurement) -> ValidationReport:
    achados = ValidationReport()
    v_idt_01_levantamento_de_outro_orgao(contrato, medicao, achados)
    v_idt_02_numero_de_contrato_divergente(contrato, medicao, achados)
    return achados


def test_t2078_o_par_do_piloto_nao_acusa_nada(
    contrato_do_piloto: Contract, medicao_do_piloto: Measurement
) -> None:
    """`P0` — o par real não se move. É o portão que autoriza todos os outros."""
    assert _achados_do_par(contrato_do_piloto, medicao_do_piloto).achados == []


def test_t2078_o_par_do_pgm_nao_acusa_nada(
    contrato_do_pgm: Contract, medicao_do_pgm: Measurement
) -> None:
    """O par que compara `15/PGM/2024` com `TC 015/PGM/2024` — e cala."""
    assert _achados_do_par(contrato_do_pgm, medicao_do_pgm).achados == []


def test_t2078_contrato_do_smit_com_levantamento_do_pgm(
    contrato_do_piloto: Contract, medicao_do_pgm: Measurement
) -> None:
    achados = _achados_do_par(contrato_do_piloto, medicao_do_pgm).achados

    assert [a.validacao for a in achados] == ["V-IDT-01"]
    assert "52/SMIT/2024" in achados[0].causa
    assert "015/PGM/2024" in achados[0].causa
    # A frase da consequência é o que `D-02` exige: quem decide precisa saber o
    # que acontece se decidir seguir.
    assert "assim mesmo" in achados[0].acao


def test_t2078_contrato_do_pgm_com_levantamento_do_smit(
    contrato_do_pgm: Contract, medicao_do_piloto: Measurement
) -> None:
    achados = _achados_do_par(contrato_do_pgm, medicao_do_piloto).achados

    assert [a.validacao for a in achados] == ["V-IDT-01"]


def test_t2078_o_aditivo_do_pgm_tambem_e_conferido_contra_a_aba(
    aditivo_do_pgm: Contract, medicao_do_piloto: Measurement
) -> None:
    """A peça vale como contrato para esta conferência: ela declara o mesmo campo."""
    assert [a.validacao for a in _achados_do_par(aditivo_do_pgm, medicao_do_piloto).achados] == [
        "V-IDT-01"
    ]


def test_t2078_um_achado_e_nao_dezenove() -> None:
    """ESPEC 029 §1 — a frase que explica os dezenove sintomas.

    Construído em memória: o que se afirma aqui é a **cardinalidade**, e ela não
    depende de quantos códigos a aba tem.
    """
    contrato = Contract(
        proposta="PA-SMIT-260319-739",
        identidade=IdentidadeContratual.de_texto(PILOTO_NO_PDF),
    )
    medicao = Measurement(contrato_referencia="TC 015/PGM/2024")

    assert len(_achados_do_par(contrato, medicao).achados) == 1


# ── `V-IDT-02` — mesmo órgão, contrato diferente ──────────────────────────────


def test_t2078_mesmo_orgao_numero_diferente_acusa_a_v_idt_02() -> None:
    contrato = Contract(
        proposta="PA-PGM-251015-159",
        identidade=IdentidadeContratual.de_texto("Contrato Nº 15/PGM/2024"),
    )
    medicao = Measurement(contrato_referencia="TC 20/PGM/2024")

    achados = _achados_do_par(contrato, medicao).achados

    assert [a.validacao for a in achados] == ["V-IDT-02"]


def test_t2078_mesmo_orgao_so_o_sufixo_diferente_e_silencio() -> None:
    """`I-03` — o aditivo que renumerou o contrato **não** chega à tela."""
    contrato = Contract(
        proposta="PA-SMIT-260319-739",
        identidade=IdentidadeContratual.de_texto("Contrato Nº 52-A/SMIT/2024"),
    )
    medicao = Measurement(contrato_referencia="TC 52/SMIT/2024")

    assert _achados_do_par(contrato, medicao).achados == []


def test_t2078_ano_diferente_acusa_a_v_idt_02() -> None:
    contrato = Contract(
        proposta="PA-PGM-251015-159",
        identidade=IdentidadeContratual.de_texto("Contrato Nº 15/PGM/2024"),
    )
    medicao = Measurement(contrato_referencia="TC 15/PGM/2023")

    assert [a.validacao for a in _achados_do_par(contrato, medicao).achados] == ["V-IDT-02"]


# ── T-2079 · o aditivo de outro contrato `[portão P2]` ────────────────────────


def test_t2079_aditivo_de_outro_contrato_e_acusado(
    contrato_do_piloto: Contract, aditivo_do_pgm: Contract
) -> None:
    achados = ValidationReport()
    v_idt_03_peca_de_outro_contrato(contrato_do_piloto, aditivo_do_pgm, "1º aditivo", achados)

    assert [a.validacao for a in achados.achados] == ["V-IDT-03"]
    assert "1º aditivo" in achados.achados[0].titulo
    # Os dois eixos divergem neste par, e o detalhe técnico diz quais.
    assert "contrato" in achados.achados[0].detalhe and "processo" in achados.achados[0].detalhe


def test_t2079_o_aditivo_legitimo_do_pgm_nao_e_acusado(
    contrato_do_pgm: Contract, aditivo_do_pgm: Contract
) -> None:
    """§2.5 — o único caminho com aditivo do repositório passa pelos dois eixos."""
    achados = ValidationReport()
    v_idt_03_peca_de_outro_contrato(contrato_do_pgm, aditivo_do_pgm, "1º aditivo", achados)

    assert achados.achados == []


def test_t2079_a_peca_e_conferida_antes_de_consolidar(
    caminho_contrato: Path, caminho_levantamento: Path, caminho_aditivo_pgm: Path
) -> None:
    """**A segunda asserção é a que guarda a ordem no container.**

    Sem ela, a validação poderia ser chamada depois de `aplicar` e o teste
    continuaria verde — com os sete códigos do aditivo já somados ao escopo.
    """
    from infrastructure.di.container import DIContainer, Entradas

    class _SemAnexos(DIContainer):
        """Os ~20 s de anexo não dizem nada sobre identidade."""

        def leitor_de_anexos(self) -> object:  # type: ignore[override]
            return type("_Vazio", (), {"ler": lambda self, caminho: []})()

    resultado = _SemAnexos().gerar(
        Entradas(
            contrato=caminho_contrato,
            levantamento=caminho_levantamento,
            aditivos=(caminho_aditivo_pgm,),
        )
    )

    assert "V-IDT-03" in [a.validacao for a in resultado.achados.achados]


# ── T-2080 · ausência é silêncio `[portão P3]` ────────────────────────────────


def test_t2080_contrato_sem_identidade_nao_acusa_a_aba(
    medicao_do_piloto: Measurement,
) -> None:
    """`R-IDT-06` — um contrato que não declara número não acusa ninguém."""
    sem_identidade = Contract(proposta="", identidade=None)

    assert _achados_do_par(sem_identidade, medicao_do_piloto).achados == []


def test_t2080_aba_sem_identidade_nao_e_acusada(contrato_do_piloto: Contract) -> None:
    assert _achados_do_par(contrato_do_piloto, Measurement()).achados == []


def test_t2080_o_pdf_que_nao_declara_contrato_rende_none(
    caminho_amostra_sem_tabela: Path,
) -> None:
    """Arquivo real, e barato: uma folha, com texto, sem declarar contrato.

    `modelo.pdf` fica de fora **por custo** — 17 s de extração para afirmar o
    mesmo `None`. Ele é coberto pelo teste de `identificar()`, que lê só a
    página 1 (T-2096).
    """
    peca = PdfPlumberContractExtractor().extrair(caminho_amostra_sem_tabela)

    assert peca.identidade is None


def test_t2080_a_planilha_deslocada_nao_ganha_achado_de_identidade(
    contrato_do_piloto: Contract, caminho_codigos_deslocados: Path
) -> None:
    """ESPEC 027 §2.3 — a planilha do cartão único de `V-MED-01`.

    Ela não declara contrato, e por isso não pode ganhar um segundo cartão
    dizendo que é de outro — consequência descrita como causa (`R-GRD-06`).
    """
    medicao = LevantamentoReader().ler(caminho_codigos_deslocados)

    assert medicao.itens == []
    assert _achados_do_par(contrato_do_piloto, medicao).achados == []


# ── A confirmação (`R-IDT-11`) ────────────────────────────────────────────────


def test_o_par_confirmado_desce_a_aviso_e_permanece() -> None:
    """`R-IDT-11` — um portão que some ao ser atravessado não deixa rastro."""
    contrato = Contract(
        proposta="PA-SMIT-260319-739",
        identidade=IdentidadeContratual.de_texto(PILOTO_NO_PDF),
    )
    medicao = Measurement(contrato_referencia="TC 015/PGM/2024")

    achados = ValidationReport()
    v_idt_01_levantamento_de_outro_orgao(contrato, medicao, achados, identidade_confirmada=True)

    assert len(achados.achados) == 1
    assert achados.achados[0].severidade is Severity.AVISA
    assert "confirmad" in achados.achados[0].titulo.lower()
    assert not achados.bloqueado


# ── T-2094 · a severidade nova não alcança quem já existia `[portão]` ─────────


def test_t2094_nenhuma_validacao_anterior_registra_pergunta() -> None:
    """**O teste mais barato e mais importante do épico.**

    `Severity.PERGUNTA` mudou o significado de `bloqueado` para as onze
    validações que já existiam, e `bloqueado` decide se o caso de uso monta
    relatório, se os ~20 s de anexos são pagos e qual o status HTTP.

    Acrescentar um valor ao `enum` é uma linha; não perceber que alguma
    validação antiga passou a cair nele é um bloqueio permanente e falso — do
    tipo que a ESPEC 025 §1 levou meses para diagnosticar.

    A varredura é sobre o **código-fonte** dos três módulos anteriores, e não
    sobre uma execução: o que se afirma é que nenhum deles menciona o valor
    novo, o que vale para todos os cenários, inclusive os que a suíte não
    exercita.
    """
    from pathlib import Path

    import infrastructure.validations as pacote

    anteriores = [
        "contract_validations.py",
        "measurement_validations.py",
        "reconciliation_validations.py",
    ]
    raiz = Path(pacote.__file__).parent

    for nome in anteriores:
        assert "PERGUNTA" not in (raiz / nome).read_text(encoding="utf-8"), (
            f"{nome} passou a registrar a severidade da ESPEC 029 — "
            "ver T-2094 e PLANO 029 §5"
        )


# ── T-2096 / T-2098 · o portão de entrada `[portão P6]` ──────────────────────


def test_t2096_identificar_le_so_a_primeira_pagina(caminho_modelo: Path) -> None:
    """`modelo.pdf` sem pagar os 17 s da extração completa.

    É o relatório GRC — 41 páginas, três tabelas de sete colunas, nenhuma
    declaração de contrato. `R-IDT-06` o mantém em silêncio, e aqui isso custa
    0,3 s em vez de 17.
    """
    peca = PdfPlumberContractExtractor().identificar(caminho_modelo)

    assert peca.identidade is None
    assert peca.itens == []


def test_t2096_identificar_rende_a_identidade_das_pecas_reais(
    caminho_contrato: Path, caminho_aditivo_pgm: Path
) -> None:
    extrator = PdfPlumberContractExtractor()

    piloto = extrator.identificar(caminho_contrato)
    aditivo = extrator.identificar(caminho_aditivo_pgm)

    assert str(piloto.identidade) == "52/SMIT/2024"
    assert piloto.processo == "7010.2024/0004617-5"
    assert str(aditivo.identidade) == "15/PGM/2024"
    assert aditivo.processo == "7010.2024/0009720-9"


def test_t2096_o_cabecalho_da_aba_sai_de_dez_linhas(
    caminho_levantamento_pgm: Path,
) -> None:
    medicao = LevantamentoReader().identificar(caminho_levantamento_pgm)

    assert medicao.contrato_referencia == "TC 015/PGM/2024"
    # **Só o cabeçalho**: os itens não são lidos, e é o que torna a chamada barata.
    assert medicao.itens == []


def test_t2098_o_portao_e_barato_e_nao_extrai_a_tabela(
    caminho_contrato_pgm: Path,
    caminho_levantamento_pgm: Path,
    caminho_aditivo_pgm: Path,
) -> None:
    """`P6` — contrato + 1 aditivo + levantamento abaixo de 2 s.

    O limiar é folgado sobre os ~0,9 s medidos: apertá-lo transformaria uma
    máquina de CI lenta em falha vermelha que não afirma nada.

    Se o portão passar a custar como a extração, ele perde a razão de existir
    (`D-10`) — e o sintoma seria este teste, não uma reclamação de usuário.
    """
    import time

    from infrastructure.di.container import DIContainer, Entradas

    entradas = Entradas(
        contrato=caminho_contrato_pgm,
        levantamento=caminho_levantamento_pgm,
        aditivos=(caminho_aditivo_pgm,),
    )

    inicio = time.perf_counter()
    conferencia = DIContainer().conferir_identidade(entradas)
    duracao = time.perf_counter() - inicio

    assert conferencia.combinam
    assert conferencia.contrato == "15/PGM/2024"
    assert conferencia.levantamento == "TC 015/PGM/2024"
    assert duracao < 2, f"o portão custou {duracao:.1f} s — ver `D-10` e `P6`"


def test_t2098_o_portao_pergunta_no_par_cruzado(
    caminho_contrato: Path, caminho_levantamento_pgm: Path
) -> None:
    from infrastructure.di.container import DIContainer, Entradas

    conferencia = DIContainer().conferir_identidade(
        Entradas(
            contrato=caminho_contrato,
            levantamento=caminho_levantamento_pgm,
            nome_do_levantamento="levantamento_pgm.xlsx",
        )
    )

    assert not conferencia.combinam
    assert [a.validacao for a in conferencia.achados.achados] == ["V-IDT-01"]
    # O portão e o fluxo completo dizem **a mesma frase**: as validações são as
    # mesmas, e uma segunda redação seria a primeira porta para divergirem.
    assert "levantamento_pgm.xlsx" in conferencia.achados.achados[0].causa


# ── T-2095 · a confirmação, e a ausência que não confirma ────────────────────

XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


def _envio(contrato: Path, levantamento: Path) -> dict[str, tuple[str, bytes, str]]:
    return {
        "contrato": ("contrato.pdf", contrato.read_bytes(), "application/pdf"),
        "levantamento": ("levantamento.xlsx", levantamento.read_bytes(), XLSX),
    }


def test_t2097_a_conferencia_previa_responde_pelo_http(
    caminho_contrato: Path, caminho_levantamento_pgm: Path
) -> None:
    from fastapi.testclient import TestClient

    from api.main import app

    resposta = TestClient(app).post(
        "/reports/conferencia-previa",
        files=_envio(caminho_contrato, caminho_levantamento_pgm),
    )

    assert resposta.status_code == 200
    corpo = resposta.json()
    assert corpo["combinam"] is False
    assert corpo["contrato"] == "52/SMIT/2024"
    assert corpo["levantamento"] == "TC 015/PGM/2024"
    assert [a["validacao"] for a in corpo["achados"]] == ["V-IDT-01"]


def test_t2097_o_par_real_passa_pela_conferencia_sem_pergunta(
    caminho_contrato: Path, caminho_levantamento: Path
) -> None:
    from fastapi.testclient import TestClient

    from api.main import app

    resposta = TestClient(app).post(
        "/reports/conferencia-previa", files=_envio(caminho_contrato, caminho_levantamento)
    )

    assert resposta.json()["combinam"] is True
    assert resposta.json()["achados"] == []


def test_t2095_confirmado_o_documento_sai_com_o_aviso(
    caminho_contrato: Path, caminho_levantamento_pgm: Path
) -> None:
    """`R-IDT-11` — o portão atravessado deixa rastro.

    Pelo container e não pelo HTTP: o que se afirma aqui é a **degradação do
    achado**, e o `.docx` de um par cruzado custaria ~50 s para não afirmar nada
    a mais.
    """
    from infrastructure.di.container import DIContainer, Entradas

    class _SemAnexos(DIContainer):
        def leitor_de_anexos(self) -> object:  # type: ignore[override]
            return type("_Vazio", (), {"ler": lambda self, caminho: []})()

    resultado = _SemAnexos().gerar(
        Entradas(
            contrato=caminho_contrato,
            levantamento=caminho_levantamento_pgm,
            identidade_confirmada=True,
        )
    )

    achado = next(a for a in resultado.achados.achados if a.validacao == "V-IDT-01")
    assert achado.severidade is Severity.AVISA
    assert "confirmad" in achado.titulo.lower()
    assert resultado.relatorio is not None
    assert not resultado.bloqueado


# ── T-2104 · a severidade que fecha a entrega ────────────────────────────────


def test_t2104_o_par_divergente_nao_emite_sem_resposta(
    caminho_contrato: Path, caminho_levantamento_pgm: Path
) -> None:
    """`R-IDT-10` — sem resposta, não sai documento.

    É o que separa *perguntar* de *só avisar*. O aviso passivo — emitir e torcer
    para que alguém leia — é o que a ESPEC 029 §1 mostrou não funcionar:
    dezenove avisos não impediram nada.

    E o par continua **não** sendo um bloqueio comum: `confirmaveis` o separa dos
    achados que exigem outro arquivo, e é o que a tela usa para oferecer a saída.
    """
    from infrastructure.di.container import DIContainer, Entradas

    resultado = DIContainer().gerar(
        Entradas(contrato=caminho_contrato, levantamento=caminho_levantamento_pgm)
    )

    assert resultado.bloqueado
    assert resultado.relatorio is None
    assert [a.validacao for a in resultado.achados.confirmaveis] == ["V-IDT-01"]
    assert resultado.achados.bloqueantes == []


# ── T-2111 · dezenove cartões viram um `[ESPEC 029 D-07]` ────────────────────


def test_t2111_o_par_sob_pergunta_nao_emite_os_dezenove_cartoes(
    caminho_contrato: Path, caminho_levantamento_pgm: Path
) -> None:
    """ESPEC 029 §1 e `D-07` — a promessa central da espec, medida.

    O par cruzado produzia **19** cartões `V-CTR-05` e nenhuma frase que os
    explicasse. Com a pergunta de identidade no lugar, a tela recebe **um**
    achado — e não vinte.

    `contrato.codigos - medicao.codigos` entre dois instrumentos diferentes não
    descobre nada: é aritmética de conjuntos alheios.
    """
    from infrastructure.di.container import DIContainer, Entradas

    resultado = DIContainer().gerar(
        Entradas(contrato=caminho_contrato, levantamento=caminho_levantamento_pgm)
    )

    assert [a.validacao for a in resultado.achados.achados] == ["V-IDT-01"]
    assert resultado.relatorio is None


def test_t2111_confirmado_o_par_a_v_ctr_05_volta(
    caminho_contrato: Path, caminho_levantamento_pgm: Path
) -> None:
    """A outra metade de `D-07`: a guarda é sobre o par estar **em questão**.

    Confirmada a divergência, ela deixa de ser dúvida e passa a ser escolha — e
    os códigos contratados que a aba não traz voltam a ser observação legítima
    para quem confere. Nada é suprimido por lista; o que muda é a pergunta estar
    ou não de pé.
    """
    from infrastructure.di.container import DIContainer, Entradas

    class _SemAnexos(DIContainer):
        def leitor_de_anexos(self) -> object:  # type: ignore[override]
            return type("_Vazio", (), {"ler": lambda self, caminho: []})()

    resultado = _SemAnexos().gerar(
        Entradas(
            contrato=caminho_contrato,
            levantamento=caminho_levantamento_pgm,
            identidade_confirmada=True,
        )
    )

    validacoes = {a.validacao for a in resultado.achados.achados}
    assert validacoes == {"V-IDT-01", "V-CTR-05"}
    assert resultado.relatorio is not None
