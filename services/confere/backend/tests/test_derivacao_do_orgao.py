"""T-2228 a T-2233 / ESPEC 034 — o órgão da capa, e o identificador da peça.

`R-CAP-04` procurava `prestação de serviços para <órgão>` — a redação de
**aditivo**, e as duas peças sobre as quais ela foi calibrada são aditivos
(ESPEC 034 §2.3). As sete peças reais escrevem a mesma informação de quatro
maneiras, e a regra reconhecia uma:

    para a <órgão>.                          contrato.pdf · contrato_pgm.pdf
    de <objeto> para a <órgão>               aditivo_pgm_2.pdf
    entre a <órgão> e a <contratada> para…   contrato_smul.pdf
    à <órgão>.                               aditivo_smul.pdf

A âncora passa a ser o **sintagma institucional cortado na sigla** (`R-CAP-11`),
que é o que as quatro têm em comum.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import pdfplumber
import pytest

from infrastructure.contract.pdfplumber_extractor import PdfPlumberContractExtractor

SMIT = "SECRETARIA MUNICIPAL DE INOVAÇÃO E TECNOLOGIA"
PGM = "PROCURADORIA GERAL DO MUNICÍPIO DE SÃO PAULO"
SMUL = "SECRETARIA MUNICIPAL DE URBANISMO E LICENCIAMENTO"


def _capa(caminho: Path) -> str:
    with pdfplumber.open(caminho) as pdf:
        return pdf.pages[0].extract_text() or ""


# ── T-2228 · Os cinco nomes, por extenso ──────────────────────────────────────


@pytest.mark.parametrize(
    ("fixture", "esperado", "redacao"),
    [
        ("caminho_contrato", SMIT, "para a <órgão>."),
        ("caminho_contrato_pgm", PGM, "para a <órgão>"),
        ("caminho_aditivo_pgm_2", PGM, "de <objeto> para a <órgão>"),
        ("caminho_contrato_smul", SMUL, "entre a <órgão> e a <contratada> para a…"),
        ("caminho_aditivo_smul", SMUL, "à <órgão>."),
    ],
)
def test_t2228_o_orgao_sai_das_quatro_redacoes(
    fixture: str,
    esperado: str,
    redacao: str,
    request: pytest.FixtureRequest,
) -> None:
    """`R-CAP-11` — a âncora é o sintagma, e não a preposição que o introduz.

    As duas últimas linhas são as que **falhavam** antes da ESPEC 034, e a
    terceira é a que prova que o defeito não era do SMUL: o `PA-PGM-260818-201`
    põe o objeto do serviço entre `serviços` e `para a`.

    Enumerar preposições seria perseguir uma lista que não fecha — quatro
    redações em sete documentos. O sintagma é o mesmo nas quatro.
    """
    caminho: Path = request.getfixturevalue(fixture)

    assert PdfPlumberContractExtractor()._cliente(_capa(caminho)) == esperado, redacao


# ── T-2229 · Os dois vazios ───────────────────────────────────────────────────


@pytest.mark.parametrize(
    ("fixture", "o_que_e"),
    [
        ("caminho_aditivo_pgm", "a página 1 não nomeia órgão nenhum"),
        ("caminho_modelo", "não é proposta — é o relatório GRC"),
    ],
)
def test_t2229_sem_orgao_na_pagina_nao_deriva_nada(
    fixture: str, o_que_e: str, request: pytest.FixtureRequest
) -> None:
    """`R-CAP-15` — o contrapeso da `T-2228`.

    Uma regra que derivasse nome de qualquer página passaria nos cinco de cima e
    falharia nestes dois — e ninguém olharia, porque o vazio é o comportamento
    que já se esperava.
    """
    caminho: Path = request.getfixturevalue(fixture)

    assert PdfPlumberContractExtractor()._cliente(_capa(caminho)) == "", o_que_e


# ── T-2230 · O alargamento ingênuo ────────────────────────────────────────────


@pytest.mark.parametrize("proibido", ["PRODAM", "EMPRESA", "PRESTAÇÃO", "SUSTENTAÇÃO"])
def test_t2230_o_nome_do_cliente_nunca_contem_a_contratada(
    caminho_contrato_smul: Path, proibido: str
) -> None:
    """`R-CAP-12` — **o único teste que reprova a versão ingênua da regra.**

    A leitura natural da capa do `PC-SMUL` é *"o órgão vem depois de `entre a`"*.
    Aplicada com o terminador de hoje — capturar até o ponto — ela produz::

        SECRETARIA MUNICIPAL DE URBANISMO E LICENCIAMENTO - SMUL E A EMPRESA
        TECNOLOGIA DA INFORMAÇÃO E COMUNICAÇÃO DO MUNICÍPIO DE SÃO PAULO
        (PRODAM) PARA A PRESTAÇÃO DE SERVIÇOS DE "SUSTENTAÇÃO DE INFRAESTRUTURA
        DE TIC"

    A contratada dentro do nome do cliente, na capa de um documento que vai ao
    órgão — pior que o aviso que a espec existe para calar.

    **Passa antes e depois, e é assim que funciona:** antes o nome é vazio, e
    vazio não contém `PRODAM`; depois é o órgão, e também não. Só a versão
    ingênua reprova.
    """
    derivado = PdfPlumberContractExtractor()._cliente(_capa(caminho_contrato_smul))

    assert proibido not in derivado


# ── T-2231 · A ambiguidade não escolhe ────────────────────────────────────────


def test_t2231_o_mesmo_orgao_duas_vezes_deriva() -> None:
    """`R-CAP-13` — repetição é normal; o piloto cita o órgão **duas** vezes.

    Caso construído: a regra conta **nomes distintos**, não ocorrências.
    """
    texto = (
        "na prestação de serviços para a Secretaria Municipal de Urbanismo e "
        "Licenciamento - SMUL. O objeto contratado pela Secretaria Municipal de "
        "Urbanismo e Licenciamento - SMUL segue o anexo."
    )

    assert PdfPlumberContractExtractor()._cliente(texto) == SMUL


def test_t2231_dois_orgaos_distintos_nao_derivam_nenhum() -> None:
    """`D-03` — `R-CAP-10` sabe menos e erra menos.

    Uma página que fale de dois órgãos não diz qual é o cliente. Escolher o
    primeiro seria decidir por ordem de impressão, e a capa vai ao órgão.

    **O texto aciona a regra antiga de propósito.** Uma primeira versão deste
    caso usava `para a prestação`, que `R-CAP-04` não casava — e ele passava
    contra a árvore antiga sem provar nada. Com a frase-gatilho no lugar, a regra
    antiga captura até o ponto e devolve os **dois órgãos concatenados**:

        SECRETARIA MUNICIPAL DE URBANISMO E LICENCIAMENTO - SMUL E A
        PROCURADORIA GERAL DO MUNICÍPIO DE SÃO PAULO

    — um nome que não é de ninguém. É a mesma família de defeito da `T-2230`,
    com dois órgãos no lugar da contratada.

    O caminho seguro já existe desde a ESPEC 020: cai para o subtítulo da aba, e
    `V-CAP-01` avisa.
    """
    texto = (
        "na prestação de serviços para a Secretaria Municipal de Urbanismo e "
        "Licenciamento - SMUL e a Procuradoria Geral do Município de São Paulo - PGM."
    )

    assert PdfPlumberContractExtractor()._cliente(texto) == ""


# ── T-2232 · `R-DOC-11`, o identificador da peça ──────────────────────────────


@pytest.mark.parametrize(
    ("fixture", "esperado"),
    [
        ("caminho_contrato", "PA-SMIT-260319-739"),
        ("caminho_contrato_pgm", "PA-PGM-251015-159"),
        ("caminho_aditivo_pgm", "PA-PGM-260304-715"),
        ("caminho_aditivo_pgm_2", "PA-PGM-260818-201"),
        ("caminho_aditivo_smul", "PA-SMUL-250314-22"),
        ("caminho_modelo", ""),
        # A única que muda: declara `Proposta Comercial:`, e não
        # `Proposta de Aditivo:`.
        ("caminho_contrato_smul", "PC-SMUL-240916-136"),
    ],
)
def test_t2232_a_peca_e_identificada_pelo_codigo_que_declara(
    fixture: str, esperado: str, request: pytest.FixtureRequest
) -> None:
    """`R-DOC-11` — a metade que a ESPEC 025 deixou.

    Aquela espec **enunciou** que uma proposta comercial inicial não traz
    `Proposta de Aditivo:` em lugar nenhum, e criou `_DECLARA_PROPOSTA` por causa
    disso. Alargou o **detector**, e deixou o **extrator do identificador** como
    estava — e é por isso que a mensagem de `V-CAP-01` saía com um buraco no
    meio: *"não foi derivado da proposta  —"*.
    """
    caminho: Path = request.getfixturevalue(fixture)

    assert PdfPlumberContractExtractor()._proposta(_capa(caminho)) == esperado


def test_t2232_o_cabecalho_institucional_nao_e_identificador(
    caminho_contrato_smul: Path,
) -> None:
    """`D-05` — os dois-pontos são obrigatórios, e é o que segura o alargamento.

    A primeira página traz, no cabeçalho, `Proposta Comercial PRODAM/DRM/GRC-3/
    NRC3 Nº 668` — sem dois-pontos e sem código no formato. Um alargamento que
    aceitasse `Proposta Comercial` solto passaria a ler o número do expediente
    como identificador da peça.
    """
    texto = _capa(caminho_contrato_smul)

    assert "Proposta Comercial PRODAM" in texto.replace("\n", " ")
    assert PdfPlumberContractExtractor()._proposta(texto) == "PC-SMUL-240916-136"


# ── T-2233 · A régua: a capa dos dois pares não se move ───────────────────────

# Congelada na `T-2226`, **nesta árvore** — que carrega a ESPEC 033 não
# commitada. Medir contra `git show HEAD:` mediria um mundo em que o
# `aditivo_smul.pdf` nem sequer extrai (TASKS 034, regra 1).
CAPA_DO_PILOTO = {
    "cliente_da_capa": SMIT,
    "proposta_origem": "PA-SMIT-260319-739",
    "propostas": ("PA-SMIT-260319-739",),
    "contrato_referencia": "TC 52/SMIT/2024",
    "subtitulo_da_capa": "SMIT SUSTENTAÇÃO",
}
CAPA_DO_PGM = {
    "cliente_da_capa": PGM,
    "proposta_origem": "PA-PGM-251015-159 e PA-PGM-260304-715",
    "propostas": ("PA-PGM-251015-159", "PA-PGM-260304-715"),
    "contrato_referencia": "TC 015/PGM/2024",
    "subtitulo_da_capa": "PGM TC 015",
}


def _campos(relatorio: Any) -> dict[str, Any]:
    return {campo: getattr(relatorio, campo) for campo in CAPA_DO_PILOTO}


def test_t2233_a_capa_do_piloto_nao_se_move(gerar_piloto: Any) -> None:
    """`R-CAP-15` — a régua desta entrega, e ela **passa antes do código**.

    Esta espec só pode alcançar documentos cuja derivação **falha** hoje. O
    piloto deriva, e tem de continuar derivando o mesmo — inclusive o
    `subtitulo_da_capa`, que não é usado enquanto o cliente existir, mas é o
    degrau seguinte da cascata e não pode ter mudado por baixo.
    """
    assert _campos(gerar_piloto().relatorio) == CAPA_DO_PILOTO


def test_t2242_o_cliente_do_par_vem_da_proposta_e_nao_do_aditivo(
    caminho_contrato_smul: Path, caminho_aditivo_smul: Path
) -> None:
    """T-2242 / ESPEC 034 `I-04` — o efeito colateral, afirmado como invariante.

    O `aditivo_smul.pdf` **passou a derivar** o órgão com `R-CAP-11`: a capa dele
    escreve `à Secretaria Municipal de Urbanismo e Licenciamento - SMUL`, e antes
    nenhuma redação com `à` era reconhecida.

    Nada consome o `cliente` de um aditivo — `Contract.aplicar` usa o da
    **proposta** —, e é isso que este teste prende. A `T-1420` da ESPEC 020
    existe porque aquele campo **sumia** no caminho com aditivo: `aplicar` monta
    um `Contract` novo a partir de uma lista fixa de campos, e o que não entrar
    nela desaparece em silêncio.

    Aqui os dois coincidem — é o mesmo órgão —, e por isso a asserção é sobre a
    **origem**, não sobre o valor: o par tem de trazer o cliente da proposta
    ainda que o aditivo tivesse outro.
    """
    extrator = PdfPlumberContractExtractor()
    proposta = extrator.extrair(caminho_contrato_smul)
    aditivo = extrator.extrair(caminho_aditivo_smul)

    assert aditivo.cliente == SMUL, "o aditivo passou a derivar, e é esperado"
    assert proposta.aplicar([aditivo]).cliente == proposta.cliente


def test_t2233_a_capa_do_pgm_nao_se_move(artefatos_do_pgm: Any) -> None:
    """`R-CAP-15` — o par com aditivo, onde `propostas` tem dois elementos.

    É o que a `T-1420` da ESPEC 020 e a `T-2087` da 029 protegem: `aplicar` monta
    um `Contract` novo a partir de uma lista fixa de campos, e o que não entrar
    nela desaparece em silêncio.
    """
    assert _campos(artefatos_do_pgm.relatorio) == CAPA_DO_PGM
