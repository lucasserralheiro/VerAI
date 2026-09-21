"""T-1900 a T-1927 / ESPEC 025 — O arquivo submetido no campo errado.

O `modelo.pdf` é o relatório GRC de referência — o documento que o Confere
**produz**. Submetê-lo no campo do contrato é o engano mais provável que existe
nesta tela, e até a ESPEC 025 ele devolvia três mensagens para uma causa, todas
descrevendo o mecanismo interno da extração.

Este módulo é a âncora dessa tela. Duas regras o governam (TASKS 025 §1.1):

* **conjunto, nunca índice** — a entrega remove e acrescenta achados na mesma
  lista, e `bloqueantes[0]` ficaria verde tendo removido a validação errada;
* **cadeias por extenso** — as mensagens nascem da espec, não de planilha;
  compará-las com a constante da implementação provaria só que o código
  concorda com ele mesmo.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from domain.entities.contract import Contract, DiagnosticoDaGrade
from domain.entities.validation_finding import ValidationReport
from infrastructure.contract.pdfplumber_extractor import PdfPlumberContractExtractor
from infrastructure.di.container import DIContainer, Entradas
from infrastructure.validations.contract_validations import (
    CausaProvavel,
    causa_provavel,
    v_adt_01_peca_sem_itens,
    v_doc_01_peca_nao_e_proposta,
)

NOME_DO_GRC = "SMIT_SUSTENTACAO_Levantamento_05969_TC_52SMIT2024_V2.0___GRC.pdf"


@pytest.fixture(scope="session")
def achados_do_modelo(
    caminho_modelo: Path, caminho_levantamento: Path
) -> ValidationReport:
    """T-1901 — o par que reproduz a tela, lido **uma vez por sessão**.

    A extração do `modelo.pdf` custa ~17 s: são 41 páginas, e a varredura de
    geometria as percorre todas. Três testes deste módulo pedem o mesmo par, e
    pagá-lo três vezes seria um minuto de suíte por nada.

    Devolve o `ValidationReport`, que ninguém muta depois de gerado — ao
    contrário do `Report`, que `gerar_piloto` recusa compartilhar por ser
    mutável.
    """
    return DIContainer().gerar(
        Entradas(
            contrato=caminho_modelo,
            levantamento=caminho_levantamento,
            nome_do_contrato=NOME_DO_GRC,
        )
    ).achados


def _diagnostico(**campos: object) -> DiagnosticoDaGrade:
    """A assinatura do `modelo.pdf`, com o campo que cada teste quiser mover.

    Construído à mão de propósito (`D-04`): a causa é função pura do
    diagnóstico, e é isso que torna o degrau *sem camada de texto* testável —
    o repositório não tem, e não vai ter, uma fixture digitalizada.
    """
    base: dict[str, object] = {
        "paginas": 41,
        "paginas_com_borda": 40,
        "maior_numero_de_divisorias": 23,
        "paginas_com_texto": 41,
    }
    base.update(campos)
    return DiagnosticoDaGrade(**base)  # type: ignore[arg-type]


# ── T-1924 · O positivo, no par real ──────────────────────────────────────────


def test_t1924_o_relatorio_grc_como_contrato(achados_do_modelo: ValidationReport) -> None:
    """De três achados para um, e o que fica é o que diz o que fazer.

    Antes desta espec eram três, para uma causa só: `V-ADT-01` acusava a peça,
    `V-CTR-01` acusava o consolidado que estava vazio **porque** a peça estava, e
    `V-CAP-01` avisava que o cliente não saiu da primeira página — consequência
    da mesma extração.

    O conjunto novo é **decidido pela espec**, não lido da saída: por isso a
    reancoragem não tem a ressalva do PLANO 021 sobre colar o que o código
    produziu.
    """
    assert {a.validacao for a in achados_do_modelo.achados} == {"V-DOC-01"}


def test_t1924_a_mensagem_nomeia_as_propostas_citadas(
    achados_do_modelo: ValidationReport,
) -> None:
    """`R-DOC-03` degrau 4 — o arquivo certo está escrito no arquivo errado.

    A linha `Proposta :` da página 1 do GRC nomeia as três peças do contrato, e
    `PA-SMIT-260319-739` é o PDF que deveria ter sido enviado. O sistema já lia
    essa página para outras duas coisas e jogava a informação fora.
    """
    (achado,) = achados_do_modelo.bloqueantes

    assert "PC-SMIT-240402-53" in achado.mensagem
    assert "PA-SMIT-250220-15" in achado.mensagem
    assert "PA-SMIT-260319-739" in achado.mensagem
    assert "Envie uma delas" in achado.mensagem


def test_t1924_a_mensagem_diz_a_causa_e_identifica_o_arquivo(
    achados_do_modelo: ValidationReport,
) -> None:
    """`R-DOC-06` — *"contrato (sem identificação)"* não localiza nada.

    O relatório GRC não traz `Proposta de Aditivo:` na primeira página, e sem o
    nome do arquivo quem submeteu quatro PDFs não descobre qual deles reprovou.
    """
    (achado,) = achados_do_modelo.bloqueantes

    assert NOME_DO_GRC in achado.mensagem
    assert "(sem identificação)" not in achado.mensagem
    assert "não trazem códigos de serviço" in achado.mensagem


def test_t1924_o_bloqueio_impede_o_relatorio(
    achados_do_modelo: ValidationReport,
) -> None:
    """O que não pode mudar: o documento continua não sendo emitido.

    Toda a ESPEC 025 é sobre **o que se diz** de uma recusa que já estava certa.
    """
    assert achados_do_modelo.bloqueado


# ── T-1925 · Os três negativos ────────────────────────────────────────────────


@pytest.mark.parametrize(
    "fixture",
    ["caminho_contrato", "caminho_contrato_pgm", "caminho_aditivo_pgm"],
)
def test_t1925_proposta_legitima_nao_dispara_v_doc_01(
    fixture: str, request: pytest.FixtureRequest
) -> None:
    """**O portão que a pressa pula.**

    O caso feliz — o `modelo.pdf` acusado — é o que dá prazer escrever. Estes
    três são o que impede a entrega de recusar proposta legítima, que é o pior
    resultado possível desta espec e o único que ninguém descobre em teste de
    mesa.

    ESPEC 025 §2.3 é o gabarito: os dois sinais da `R-DOC-02` separam os quatro
    documentos sem exceção, e concordam entre si.
    """
    caminho: Path = request.getfixturevalue(fixture)
    peca = PdfPlumberContractExtractor().extrair(caminho)

    achados = ValidationReport()
    v_doc_01_peca_nao_e_proposta(peca, "Contrato", achados)

    assert achados.achados == [], f"{caminho.name} foi recusado como proposta"


@pytest.mark.parametrize(
    ("fixture", "esperado"),
    [
        ("caminho_contrato", True),
        ("caminho_contrato_pgm", True),
        ("caminho_aditivo_pgm", True),
        ("caminho_modelo", False),
    ],
)
def test_t1920_o_gabarito_dos_sinais(
    fixture: str, esperado: bool, request: pytest.FixtureRequest
) -> None:
    """T-1920 / `R-DOC-02` — a medição da ESPEC §2.3 virando teste.

    Escrito como **gabarito** e não como confirmação: uma asserção redigida
    depois da regra implementada não prova que ela deixa passar proposta boa,
    prova que ela faz o que faz.
    """
    caminho: Path = request.getfixturevalue(fixture)
    diagnostico = PdfPlumberContractExtractor().extrair(caminho).diagnostico

    assert diagnostico is not None
    assert diagnostico.parece_proposta is esperado, (
        f"{caminho.name}: candidatas={diagnostico.codigos_nas_candidatas}"
    )


# ── T-1926 · O degrau mais baixo ──────────────────────────────────────────────


def test_t1926_pdf_sem_sinal_nenhum_ainda_diz_o_que_enviar(
    caminho_amostra_sem_tabela: Path,
) -> None:
    """ESPEC 025 `D-06` — a âncora da mensagem é o campo, não o documento.

    Uma folha solta: com texto, sem tabela de sete colunas, sem proposta citada.
    Nenhum acréscimo da `R-DOC-03` se aplica — e a parte fixa, sozinha, ainda diz
    qual arquivo enviar. É o teste que impede a mensagem de depender de o sistema
    reconhecer o documento.
    """
    peca = PdfPlumberContractExtractor().extrair(caminho_amostra_sem_tabela)

    achados = ValidationReport()
    v_doc_01_peca_nao_e_proposta(peca, "Contrato", achados, "amostra.pdf")

    (achado,) = achados.bloqueantes
    assert achado.validacao == "V-DOC-01"
    assert "não é uma proposta comercial" in achado.mensagem
    assert "Envie no campo Contrato o PDF da proposta comercial" in achado.mensagem
    # Nada a citar: o acréscimo do degrau 4 **não** aparece.
    assert "cita as propostas" not in achado.mensagem


# ── T-1919 · Os quatro degraus, sem abrir PDF ─────────────────────────────────


def test_t1919_degrau_1_pdf_digitalizado() -> None:
    """Sem camada de texto. **Não há fixture para este caso, e nem precisa.**

    É a razão de a `D-04` exigir função pura: o degrau que não se pode montar em
    arquivo é exatamente o que a função pura torna testável.
    """
    diagnostico = _diagnostico(paginas_com_texto=0)

    assert causa_provavel(diagnostico) is CausaProvavel.SEM_TEXTO

    # `parece_proposta=False` é o que a extração apuraria de um PDF sem texto:
    # sem página 1 legível e sem candidata com código, os dois sinais falham.
    peca = Contract(
        proposta="",
        diagnostico=_diagnostico(paginas_com_texto=0, parece_proposta=False),
    )
    achados = ValidationReport()
    v_doc_01_peca_nao_e_proposta(peca, "Contrato", achados, "escaneado.pdf")

    (achado,) = achados.bloqueantes
    assert "imagem digitalizada" in achado.mensagem
    # A ação muda com a causa: aqui o conserto é outro.
    assert "não a versão escaneada" in achado.mensagem
    assert "Envie no campo Contrato o PDF da proposta" not in achado.mensagem


def test_t1919_degrau_2_sem_tabela_de_sete_colunas() -> None:
    """Tem texto, e nenhuma tabela com a geometria da tabela de itens."""
    diagnostico = _diagnostico(paginas=2, paginas_com_texto=2, geometrias_candidatas=0)

    assert causa_provavel(diagnostico) is CausaProvavel.SEM_TABELA


def test_t1919_degrau_3_tabelas_sem_codigo_de_servico() -> None:
    """A assinatura do `modelo.pdf`: três tabelas de sete colunas, zero códigos."""
    diagnostico = _diagnostico(
        geometrias_candidatas=3, codigos_nas_candidatas=(0, 0, 0)
    )

    assert causa_provavel(diagnostico) is CausaProvavel.TABELA_SEM_CODIGOS


def test_t1919_a_ordem_dos_degraus_importa() -> None:
    """PDF digitalizado **também** não tem tabela, e a pergunta certa vem antes.

    Invertida a ordem, quem escaneou o documento receberia *"não há tabela de
    preços"* — verdade inútil que manda a pessoa procurar no lugar errado.
    """
    digitalizado = _diagnostico(paginas_com_texto=0, geometrias_candidatas=0)

    assert causa_provavel(digitalizado) is CausaProvavel.SEM_TEXTO


# ── T-1927 · O canário do padrão conservador ──────────────────────────────────


def test_t1927_sem_diagnostico_nao_ha_v_doc_01() -> None:
    """TASKS 025 §1.1 regra 1 — sem diagnóstico, a peça é proposta.

    Trinta e tantos pontos da suíte constroem `Contract(proposta="X")` sem
    diagnóstico. Se `V-DOC-01` puder disparar sobre eles, o caminho `V-ADT-01`
    desaparece de todos os testes de unidade **e nada diz que isso aconteceu** —
    a suíte fica verde afirmando outra coisa.

    Irmão da `test_t1121_sem_diagnostico_a_mensagem_e_a_de_sempre`, que guarda a
    mesma fronteira pela `V-CTR-01`.
    """
    achados = ValidationReport()
    v_doc_01_peca_nao_e_proposta(Contract(proposta="X"), "Contrato", achados)

    assert achados.achados == []


def test_t1927_sem_diagnostico_v_adt_01_continua_valendo() -> None:
    """A outra metade do canário, e a que falha em silêncio.

    Uma `V-DOC-01` gulosa deixaria este caminho inalcançável sem deixar teste
    vermelho: a peça simplesmente deixaria de produzir achado nenhum.
    """
    achados = ValidationReport()
    v_adt_01_peca_sem_itens(Contract(proposta="PA-VAZIO"), "1º aditivo", achados)

    assert [a.validacao for a in achados.bloqueantes] == ["V-ADT-01"]
    assert "PA-VAZIO" in achados.bloqueantes[0].mensagem


def test_t1922_proposta_reconhecida_e_ilegivel_vai_para_o_suporte() -> None:
    """`R-DOC-04` — o caso que sobra, e que **muda de dono**.

    Aqui o usuário não errou: o arquivo é uma proposta e o Confere é que não
    sabe lê-la. A mensagem tem de dizer isso com todas as letras, senão ele fica
    trocando de arquivo até desistir.
    """
    peca = Contract(
        proposta="PA-NOVA-01",
        diagnostico=_diagnostico(geometrias_candidatas=0, parece_proposta=True),
    )

    achados = ValidationReport()
    v_adt_01_peca_sem_itens(peca, "Contrato", achados)

    (achado,) = achados.bloqueantes
    assert achado.validacao == "V-ADT-01"
    assert "Não é erro no seu envio" in achado.mensagem
    assert "suporte" in achado.mensagem
