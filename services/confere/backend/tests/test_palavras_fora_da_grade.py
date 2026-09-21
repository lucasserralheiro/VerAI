"""ESPEC 035 — a linha de item que ficou acima da moldura, e o que a grade descarta.

`montar_grade` sintetiza fronteira **no rodapé** desde a ESPEC 001 §9.4 — foi
assim que `12.074.00005.00` e `14.048.00008.00` deixaram de se perder. A metade
de cima nunca foi escrita, e não por decisão: nenhuma peça da amostra tinha linha
de item acima da primeira fronteira, até o `PA-FTM-251001-143`.

E o descarte não deixava rastro. `ler_celulas` joga fora, calada, a palavra cujo
centro cai fora de `[horizontais[0], horizontais[-1]]`; o único sintoma era o
checksum de `V-CTR-03` dizendo *quanto* faltava, nunca *onde*.

Este módulo cobre a metade que **não depende do documento do defeito**:
`R-GRD-10`, o contador, e `R-CAP-16`, a classe de traços. A fronteira superior
(`R-GRD-11`, `R-GRD-12`) espera a fixture — TASKS 035 `I-01`.
"""

from __future__ import annotations

import re
from pathlib import Path

import pdfplumber
import pytest

from domain.entities.contract import Contract, DiagnosticoDaGrade
from infrastructure.contract.grid import (
    analisar_geometria,
    montar_grade,
    palavras_fora_da_grade,
)
from infrastructure.contract.pdfplumber_extractor import PdfPlumberContractExtractor

FIXTURES = Path(__file__).parent / "fixtures"

# ── `R-GRD-10` · a impressão digital do descarte ──────────────────────────────
#
# **Não é zero, e não deveria ser** (TASKS 035 §11). O backlog pediu zero por ter
# confundido duas medições da espec: a §2.4 mede **zero páginas com código de
# serviço entre as órfãs** — que é o crivo da `R-GRD-11` —, não zero palavras
# descartadas. Prosa acima da tabela é descartada todo dia, e está certo.
#
# Como régua, a impressão digital é **mais forte que zero**: é o comportamento da
# grade em cada página de cada peça, e é o que a `R-GRD-11` poderia perturbar sem
# mover um `sha`.
#
# As três páginas de cauda da ESPEC 032 — `contrato.pdf` p27 e p28,
# `contrato_pgm.pdf` p23 — **não aparecem**, e é a prova de que o resgate é
# subtraído: o que a cauda costurou não foi perdido.

DESCARTE = [
    ("contrato.pdf", ((25, 177),)),  # prosa sobre SOA
    ("contrato_pgm.pdf", ((22, 214),)),  # marcadores sobre VPN
    ("aditivo_pgm.pdf", ((6, 138),)),  # título de seção e explicação
    ("contrato_smul.pdf", ((11, 8), (13, 1))),  # prosa de seção e fragmento
    ("aditivo_smul.pdf", ((3, 1),)),  # o rótulo `Aumento`
    ("modelo.pdf", ()),  # sem gabarito: não há grade que descarte
    ("amostra_sem_tabela.pdf", ()),
    ("aditivo_pgm_2.pdf", ()),
]


@pytest.mark.parametrize(("nome", "esperado"), DESCARTE)
def test_r_grd_10_a_impressao_digital_do_descarte(
    nome: str, esperado: tuple[tuple[int, int], ...]
) -> None:
    """O que cada peça descarta, página por página, por extenso.

    Régua de não-regressão da `R-GRD-11`: uma fronteira sintetizada onde não
    devia muda este número **antes** de mudar qualquer `sha`.
    """
    contrato = PdfPlumberContractExtractor().extrair(FIXTURES / nome)
    assert contrato.diagnostico is not None
    assert contrato.diagnostico.palavras_descartadas == esperado


@pytest.mark.parametrize("nome", ["contrato.pdf", "contrato_pgm.pdf"])
def test_r_grd_10_as_paginas_de_cauda_nao_contam_como_descarte(nome: str) -> None:
    """`contrato.pdf` p27 e p28 e `contrato_pgm.pdf` p23 saem da conta.

    São as três caudas que a ESPEC 032 costura. Contá-las diria *"a grade perdeu
    dez palavras"* sobre um documento que não perdeu nenhuma — e o número existe
    para dizer o tamanho do problema, não para inventar um.
    """
    contrato = PdfPlumberContractExtractor().extrair(FIXTURES / nome)
    assert contrato.diagnostico is not None
    paginas = {pagina for pagina, _ in contrato.diagnostico.palavras_descartadas}
    assert paginas.isdisjoint({23, 27, 28})


def test_r_grd_10_a_contagem_e_por_pagina_e_nao_por_geometria() -> None:
    """T-2262 — o `aditivo_pgm.pdf` tem página casada por mais de uma geometria.

    O laço do extrator é `por página × por geometria`. Sem o guarda de
    `paginas_contadas`, a página 6 entraria uma vez por geometria e o número
    dobraria — num campo cuja razão de existir é dizer o tamanho do problema.

    Três geometrias admitidas, e a página aparece **uma** vez.
    """
    contrato = PdfPlumberContractExtractor().extrair(FIXTURES / "aditivo_pgm.pdf")
    assert contrato.diagnostico is not None
    paginas = [pagina for pagina, _ in contrato.diagnostico.palavras_descartadas]
    assert paginas == sorted(set(paginas))
    assert contrato.diagnostico.palavras_descartadas == ((6, 138),)


def test_r_grd_10_a_funcao_irma_mede_o_vao_da_tabela() -> None:
    """`palavras_fora_da_grade` sozinha, sem o extrator em volta.

    A página 25 do piloto é a maior das nove que imprimem acima da grade: 177
    palavras de prosa sobre SOA, dentro do vão horizontal da tabela e fora de
    toda linha dela.
    """
    with pdfplumber.open(FIXTURES / "contrato.pdf") as pdf:
        geometria = analisar_geometria(pdf)
        assert geometria.gabarito is not None
        grade = montar_grade(pdf.pages[24], geometria.gabarito)
        assert grade is not None
        assert palavras_fora_da_grade(pdf.pages[24], grade) == 177


# ── `R-GRD-10` · o sufixo de `V-CTR-03` ───────────────────────────────────────


def _mensagem(palavras_descartadas: tuple[tuple[int, int], ...]) -> str:
    """A mensagem de `V-CTR-03` para um contrato cujo checksum não fecha.

    Construída à mão, sem PDF: o que se prova aqui é a **redação**, e ela não
    depende de documento nenhum.
    """
    from decimal import Decimal

    from domain.entities.contract_item import ContractItem
    from domain.entities.validation_finding import ValidationReport
    from domain.value_objects.service_code import ServiceCode
    from infrastructure.validations.contract_validations import v_ctr_03_checksum

    item = ContractItem(
        codigo=ServiceCode("10.050.00001.00"),
        descricao="ITEM",
        unidade="HORA/HOMEM",
        quantidade=Decimal(1),
        preco_unitario=Decimal(1),
        meses=1,
        total_declarado=Decimal(1),
        pagina=1,
    )
    contrato = Contract(
        proposta="PA-TESTE-1",
        total_declarado=Decimal(2),
        itens=[item],
        diagnostico=DiagnosticoDaGrade(
            paginas=1,
            paginas_com_borda=1,
            maior_numero_de_divisorias=8,
            paginas_com_texto=1,
            palavras_descartadas=palavras_descartadas,
        ),
    )
    achados = ValidationReport()
    v_ctr_03_checksum(contrato, achados)
    return next(a.mensagem for a in achados.bloqueantes if a.validacao == "V-CTR-03")


def test_r_grd_10_sem_descarte_a_mensagem_e_a_de_sempre() -> None:
    """Byte por byte igual à de antes desta espec.

    É o que torna o sufixo sem risco: nenhum documento que hoje bloqueia por
    checksum passa a ver texto novo por causa dela.
    """
    assert _mensagem(()) == (
        "extração incompleta: a soma dos itens (1) não bate com o "
        "total declarado (2) — diferença de 1"
    )


def test_r_grd_10_com_descarte_a_mensagem_nomeia_a_pagina() -> None:
    """O caso do `PA-FTM-251001-143`: uma página, e ela é nomeada.

    É a metade que faltava. Sem ela o sintoma é *"faltam R$ 51.676,20"*, e a
    página só aparece por subtração sobre o valor declarado (ESPEC 035 §2.6).
    """
    assert _mensagem(((7, 14),)).endswith(
        "— e a grade descartou 14 palavras fora de qualquer linha "
        "da tabela, na página 7"
    )


def test_r_grd_10_o_sufixo_traz_as_tres_maiores() -> None:
    """Quatro páginas descartando, três na mensagem, maior primeiro.

    Uma lista de dez páginas não é pista de nada. O total continua sendo o de
    **todas**, e é ele que diz o tamanho.
    """
    mensagem = _mensagem(((5, 2), (7, 14), (9, 200), (11, 30)))
    assert "descartou 246 palavras" in mensagem
    assert mensagem.endswith("nas páginas 9 (200), 11 (30), 7 (14)")


# ── `R-CAP-16` · a classe de traços ───────────────────────────────────────────
#
# Os oito nomes derivados hoje, congelados na `T-2251`. **Os três `''` são
# resultado**, e não ausência de medição: são o que prova que a classe não passa
# a "achar órgão" onde não há.

ORGAOS = [
    ("contrato.pdf", "SECRETARIA MUNICIPAL DE INOVAÇÃO E TECNOLOGIA"),
    ("contrato_pgm.pdf", "PROCURADORIA GERAL DO MUNICÍPIO DE SÃO PAULO"),
    ("contrato_smul.pdf", "SECRETARIA MUNICIPAL DE URBANISMO E LICENCIAMENTO"),
    ("aditivo_smul.pdf", "SECRETARIA MUNICIPAL DE URBANISMO E LICENCIAMENTO"),
    ("aditivo_pgm_2.pdf", "PROCURADORIA GERAL DO MUNICÍPIO DE SÃO PAULO"),
    ("aditivo_pgm.pdf", ""),
    ("modelo.pdf", ""),
    ("amostra_sem_tabela.pdf", ""),
]


@pytest.mark.parametrize(("nome", "esperado"), ORGAOS)
def test_r_cap_17_os_oito_orgaos_nao_se_movem(nome: str, esperado: str) -> None:
    """A régua da `T-2251`, por extenso.

    A classe de traços alcança **só** documento cuja derivação falha hoje. Se
    algum destes oito se mover, a classe está casando o que não devia.
    """
    with pdfplumber.open(FIXTURES / nome) as pdf:
        texto = pdf.pages[0].extract_text() or ""
    assert PdfPlumberContractExtractor()._cliente(texto) == esperado


# O separador de cada peça real, medido. Os dois primeiros são a razão de o
# padrão ter `\s*` dos dois lados desde a ESPEC 020 §2.5; o terceiro é esta espec.
SEPARADORES = [
    ("Tecnologia- SMIT", "hífen sem espaço à esquerda — o piloto"),
    ("Paulo - PGM", "hífen com espaço dos dois lados — o PGM"),
    ("Municipal – FTMSP", "en dash U+2013 — o FTM"),
]


@pytest.mark.parametrize(("trecho", "o_que_e"), SEPARADORES)
def test_r_cap_16_os_tres_separadores_reais(trecho: str, o_que_e: str) -> None:
    """As três grafias que os documentos usam, sem abrir PDF.

    O terceiro é o defeito desta espec: até aqui `_CLIENTE` exigia hífen ASCII, e
    `Fundação Theatro Municipal – FTMSP` não casava.
    """
    from infrastructure.contract.pdfplumber_extractor import _CLIENTE

    texto = f"prestação de serviços para a Secretaria Municipal de {trecho}"
    assert _CLIENTE.search(texto) is not None, o_que_e


def test_r_cap_16_a_sigla_sai_com_qualquer_traco() -> None:
    """`_SIGLA` leva a mesma classe, e é metade da correção.

    Com a classe só em `_CLIENTE`, o FTM derivaria e a capa sairia
    `FUNDAÇÃO THEATRO MUNICIPAL – FTMSP`, com a sigla colada — pior que o aviso
    de hoje, porque **parece** certo.
    """
    from infrastructure.contract.pdfplumber_extractor import _SIGLA

    for trecho in ("Tecnologia- SMIT", "Paulo - PGM", "Municipal – FTMSP"):
        assert not re.search(r"[A-Z]{2,}$", _SIGLA.sub("", trecho)), trecho


def test_r_cap_16_a_capa_do_ftm_deriva_o_orgao() -> None:
    """O caso positivo, sobre o texto da primeira página do `PA-FTM-251001-143`.

    **Sem a fixture**, e é decisão: o defeito é de prosa, e a prosa está aqui por
    extenso. O caso que precisa do arquivo é o da extração (`R-GRD-11`), que
    espera o `I-01`.

    A página nomeia **um** órgão — `Fundação` está no vocabulário desde a ESPEC
    034 `D-04`, por antecipação —, então `R-CAP-13` deriva em vez de calar.
    """
    capa = (
        "EMPRESA DE TECNOLOGIA DA INFORMAÇÃO E COMUNICAÇÃO DO MUNICÍPIO DE SÃO PAULO "
        "GERÊNCIA DE RELACIONAMENTO COM CLIENTES - 3 "
        "PROCESSO 7010.2024/0010232-6 "
        "Proposta Comercial PRODAM/DRM/GRC-3 Nº 880 "
        "Proposta de Aditivo: PA-FTM-251001-143 "
        "O objeto desta Proposta de Aditivo Contratual é a Prorrogação do contrato "
        "n° 094/FTMSP/2024 por mais 12 (doze) meses para continuidade da Prestação "
        "de Serviços de Sustentação de TIC da Fundação Theatro Municipal – FTMSP"
    )
    extrator = PdfPlumberContractExtractor()
    assert extrator._cliente(capa) == "FUNDAÇÃO THEATRO MUNICIPAL"
    assert extrator._proposta(capa) == "PA-FTM-251001-143"


def test_r_cap_16_o_cabecalho_com_hifen_nao_vira_orgao() -> None:
    """`GERÊNCIA DE RELACIONAMENTO COM CLIENTES - 3` não é órgão.

    A classe alarga o **separador**, não o vocabulário: `Gerência` continua fora
    da lista fechada da ESPEC 034 `D-04`, e a sigla continua tendo de ser duas
    letras maiúsculas — `3` não é.
    """
    from infrastructure.contract.pdfplumber_extractor import _CLIENTE

    assert _CLIENTE.search("GERÊNCIA DE RELACIONAMENTO COM CLIENTES - 3") is None


# ── `R-GRD-11` e `R-GRD-12` · a fronteira que falta em cima ───────────────────
#
# Casos construídos, sem abrir PDF, no espírito de `_escolher_gabarito` (ESPEC
# 017) e de `_faixa_mais_estreita` (ESPEC 033). É o único ponto onde a síntese
# pode falhar em silêncio — e falhar aqui significa **inventar uma linha de item
# a partir de prosa**, que é o risco número um desta espec.

GABARITO = (34.5, 117.0, 262.5, 352.5, 403.5, 447.7, 498.0, 561.0)


def _palavra(texto: str, x0: float, topo: float) -> dict[str, object]:
    return {
        "text": texto,
        "x0": x0,
        "x1": x0 + 8.0 * len(texto),
        "top": topo,
        "bottom": topo + 10.0,
    }


class _PaginaFalsa:
    """Uma página com a moldura desenhada e as palavras que se quiser.

    As bordas horizontais ficam em 100 e 130; tudo acima de 100 é órfão. As
    verticais são o gabarito do piloto, para que `_fronteiras_verticais` case.
    """

    def __init__(self, palavras: list[dict[str, object]]) -> None:
        self._palavras = palavras
        self.rects = [
            {"top": t, "bottom": t + 0.7, "x0": 34.5, "width": 526.5, "height": 0.7}
            for t in (100.0, 130.0)
        ] + [
            {"top": 100.0, "bottom": 130.0, "x0": x, "width": 0.7, "height": 30.0}
            for x in GABARITO
        ]

    def extract_words(self) -> list[dict[str, object]]:
        return self._palavras


#: Uma linha de item completa, acima da moldura: código na coluna 0 e as células
#: numéricas nas suas. É a forma da `14.031.00018.00` na página 7 do FTM.
LINHA_DE_ITEM = [
    _palavra("14.031.00018.00", 36.0, 60.0),
    _palavra("PERFIL", 119.0, 60.0),
    _palavra("EXECUTIVE", 119.0, 72.0),
    _palavra("BRL", 354.0, 60.0),
    _palavra("95,00", 405.0, 60.0),
    _palavra("12", 449.0, 60.0),
    _palavra("51.676,20", 500.0, 72.0),
]


def test_r_grd_11_a_linha_de_item_acima_da_moldura_ganha_fronteira() -> None:
    """O caso do `PA-FTM-251001-143` p7: código na coluna 0, nada acima dele.

    A fronteira sai **acima** da palavra mais alta, para que `_indice` a encontre
    dentro — o mesmo `1.0` da síntese de rodapé da ESPEC 001 §9.4.
    """
    grade = montar_grade(_PaginaFalsa(LINHA_DE_ITEM), GABARITO)
    assert grade is not None
    assert grade.horizontais[0] == 59.0
    assert grade.horizontais[:3] == [59.0, 100.0, 130.0]


def test_r_grd_12_com_palavra_acima_do_codigo_nao_sintetiza() -> None:
    """Cauda de descrição **e** linha de item no mesmo bloco: não se separa.

    Sintetizar aqui juntaria as duas na mesma célula e produziria descrição que
    **parece** certa. É a `D-02` da ESPEC 032 pelo mesmo motivo: num documento
    que vai ao órgão, *degradado* é melhor que *errado*.
    """
    com_cauda = [_palavra("SEGURANÇA)", 119.0, 40.0), *LINHA_DE_ITEM]
    grade = montar_grade(_PaginaFalsa(com_cauda), GABARITO)
    assert grade is not None
    assert grade.horizontais == [100.0, 130.0]


def test_r_grd_12_com_dois_codigos_nao_sintetiza() -> None:
    """Duas linhas de item precisam da fronteira **entre** elas.

    Ela não está desenhada e não se adivinha. Uma fronteira só juntaria as duas
    numa linha, com dois códigos na mesma célula.
    """
    duas = [*LINHA_DE_ITEM, _palavra("14.031.00019.00", 36.0, 84.0)]
    grade = montar_grade(_PaginaFalsa(duas), GABARITO)
    assert grade is not None
    assert grade.horizontais == [100.0, 130.0]


def test_r_grd_11_prosa_acima_da_moldura_nao_vira_linha() -> None:
    """O comportamento de hoje, e o que ele protege.

    São as nove páginas do corpus que imprimem acima da grade — 177 palavras
    sobre SOA no piloto, 214 sobre VPN no PGM. Nenhuma tem código de serviço, e é
    por isso que esta espec não move um `sha`.
    """
    prosa = [_palavra("Elementos", 36.0, 60.0), _palavra("que", 119.0, 60.0)]
    grade = montar_grade(_PaginaFalsa(prosa), GABARITO)
    assert grade is not None
    assert grade.horizontais == [100.0, 130.0]


def test_r_grd_11_codigo_fora_da_coluna_do_codigo_nao_sintetiza() -> None:
    """O crivo é a coluna, e não só a presença do código.

    Um código citado na prosa — *"o item 14.031.00018.00 passa a…"* — cai na
    coluna de descrição, e prosa que cite código não é linha de item.
    """
    citado = [_palavra("14.031.00018.00", 200.0, 60.0)]
    grade = montar_grade(_PaginaFalsa(citado), GABARITO)
    assert grade is not None
    assert grade.horizontais == [100.0, 130.0]


def test_r_con_06_sintetizada_a_fronteira_nao_ha_cauda() -> None:
    """`R-CON-06` — os dois crivos são complementares, e a ordem sai de graça.

    `cauda_da_pagina` lê o que está acima de `horizontais[0]`. Sintetizada a
    fronteira, não há nada acima dela: a linha de item **deixa de ser** candidata
    a cauda, sem que o crivo da ESPEC 032 precise de uma linha nova.
    """
    from infrastructure.contract.grid import cauda_da_pagina

    pagina = _PaginaFalsa(LINHA_DE_ITEM)
    grade = montar_grade(pagina, GABARITO)
    assert grade is not None
    assert cauda_da_pagina(pagina, grade, 1) == ""
