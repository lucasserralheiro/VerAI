"""T-1303 a T-1305 — Extração do aditivo (ESPEC 019, fase A).

O terceiro documento de contratação da suíte, e o primeiro que **não é uma
proposta**. Antes desta espec ele rendia **zero itens e nenhum erro**: a
`R-GRD-02` procurava oito divisórias por página, e um aditivo é feito de blocos
curtos que dividem folha (ESPEC 019 §2.3).

As asserções são nominais, no padrão do `test_extractor_contract`: citam os itens
e os totais, para que uma regressão apareça pelo nome.
"""

from __future__ import annotations

from collections.abc import Iterator
from decimal import Decimal
from pathlib import Path
from typing import Any

import pdfplumber
import pytest

from domain.entities.contract import Contract
from domain.entities.validation_finding import ValidationReport
from domain.value_objects.block_label import RotuloDeBloco
from infrastructure.contract.grid import analisar_geometria
from infrastructure.contract.pdfplumber_extractor import PdfPlumberContractExtractor
from infrastructure.validations.contract_validations import (
    v_ctr_01_tabela_localizada,
    v_ctr_03_checksum,
)

# Os três blocos do `PA-PGM-260304-715`, medidos no PDF (ESPEC 019 §2.4).
AUMENTO = Decimal("884902.44")
REDUCAO = Decimal("-897734.40")
INCLUSAO = Decimal("12831.84")

# A primeira página declara em prosa: "apresenta um Decréscimo de R$ 0,12".
DECRESCIMO = Decimal("-0.12")


@pytest.fixture(scope="module")
def aditivo(caminho_aditivo_pgm: Path) -> Contract:
    return PdfPlumberContractExtractor().extrair(caminho_aditivo_pgm)


@pytest.fixture(scope="module")
def pdf_do_aditivo(caminho_aditivo_pgm: Path) -> Iterator[Any]:
    with pdfplumber.open(caminho_aditivo_pgm) as pdf:
        yield pdf


# ── T-1303 · O aditivo passa a ser lido ───────────────────────────────────────


def test_t1303_o_aditivo_rende_itens(aditivo: Contract) -> None:
    """O conserto, no número mais direto possível: era zero.

    Quatro no bloco `Aumento`, um no `Redução`, dois no `Inclusão` — e nenhum
    código repetido entre eles.
    """
    assert len(aditivo.itens) == 7
    assert len(aditivo.codigos) == 7


def test_t1303_a_proposta_do_aditivo(aditivo: Contract) -> None:
    assert aditivo.proposta == "PA-PGM-260304-715"


def test_t1303_os_codigos_de_cada_bloco(aditivo: Contract) -> None:
    """Nominal de propósito: são estes sete, e a ordem é a do documento.

    A ordem importa porque é o que o contrato fornece ao relatório (`R-REL-03`),
    e ler página por página em vez de geometria por geometria é o que a preserva.
    """
    assert [item.codigo.valor for item in aditivo.itens] == [
        # Aumento — página 6
        "10.050.00001.00",
        "14.031.00020.00",
        "14.024.00006.00",
        "14.048.00027.00",
        # Redução — página 6
        "12.030.00001.00",
        # Inclusão — página 7
        "14.071.00006.00",
        "14.071.00007.00",
    ]


def test_t1303_a_quantidade_de_reducao_e_negativa(aditivo: Contract) -> None:
    """ESPEC 019 `R-ADT-03` — o sinal é dado, e sobrevive à extração.

    A `CONEXÃO INTERNET` sai do bloco `Redução` com `QUANT = -80,00`. Nada no
    caminho pode truncar em zero — e o total da linha carrega o mesmo sinal.
    """
    assert aditivo.quantidade_para("12.030.00001.00") == Decimal("-80.00")

    (linha,) = aditivo.itens_de("12.030.00001.00")
    assert linha.total_declarado == REDUCAO
    assert linha.unidade == "Mbps/MÊS"


def test_t1303_os_dois_itens_de_inclusao(aditivo: Contract) -> None:
    """São o *grupo C* da ESPEC 018 §2.3 — os que a planilha afirmava e o PDF não.

    Aparecem aqui com a designação contratual, que é a que `R-REL-07` manda ao
    documento.
    """
    assert aditivo.quantidade_para("14.071.00006.00") == Decimal("5.00")
    assert aditivo.quantidade_para("14.071.00007.00") == Decimal("1.00")
    assert aditivo.descricao_para("14.071.00006.00") == (
        "MIDDLEWARE - DIREITO DE USO DE SOFTWARE"
    )


def test_t1303_o_periodo_do_aditivo_e_de_oito_meses(aditivo: Contract) -> None:
    """A peça vige por 8 meses contra os 12 da proposta.

    Não é usado para nada — `D-02` mantém o quantitativo fora do relatório —, mas
    é o sinal de que a coluna `PERÍODO` foi lida da linha certa.
    """
    assert {item.meses for item in aditivo.itens} == {8}


# ── T-1304 · O total declarado é a soma dos blocos ────────────────────────────


def test_t1304_os_tres_totais_sao_somados(aditivo: Contract) -> None:
    """ESPEC 019 `R-ADT-07` / `D-05` — era *"vale o último"*, e o último é `12.831,84`.

    Guardar só o último daria menos de um centésimo do que a peça movimenta, e o
    checksum passaria a acusar erro onde não há.
    """
    assert AUMENTO + REDUCAO + INCLUSAO == DECRESCIMO
    assert aditivo.total_declarado == DECRESCIMO


def test_t1304_o_checksum_do_aditivo_fecha(aditivo: Contract) -> None:
    """A prova de ponta a ponta da extração, agora com três blocos.

    Nenhuma das sete linhas se perdeu, e nenhum total foi contado duas vezes —
    duas geometrias alcançam a página 6, e `R-ADT-12` é o que as reconcilia.
    """
    assert aditivo.soma_dos_totais == DECRESCIMO

    achados = ValidationReport()
    v_ctr_01_tabela_localizada(aditivo, achados)
    v_ctr_03_checksum(aditivo, achados)
    assert achados.bloqueantes == []


# ── T-1305 · O crivo de admissão das geometrias ───────────────────────────────


def test_t1305_tres_das_quatro_geometrias_sao_tabela_de_itens(
    pdf_do_aditivo: Any,
) -> None:
    """ESPEC 019 `D-05` — o discriminador de `R-GRD-02` virou filtro, não eleição.

    Quatro conjuntos de oito divisórias, três de itens e um do cronograma
    físico-financeiro.
    """
    extrator = PdfPlumberContractExtractor()
    geometria = analisar_geometria(pdf_do_aditivo)

    assert len(geometria.candidatos) == 4
    assert len(extrator._geometrias_de_itens(pdf_do_aditivo, geometria)) == 3


def test_t1305_o_cronograma_do_aditivo_tem_codigo_e_nao_e_tabela_de_itens(
    pdf_do_aditivo: Any,
) -> None:
    """A asserção que prova o critério, e não apenas o resultado `[risco]`.

    A geometria do cronograma do aditivo está na **mesma página** que a da
    `Inclusão`, e enxerga os mesmos dois códigos de serviço. Um crivo do tipo
    *"tem código na página"* — a leitura literal de `R-GRD-02` — admitiria as
    duas e injetaria linha malformada.

    O que as separa é **render linha de item completa**: o cronograma não rende
    nenhuma. Sem este teste, `_e_item_completo` poderia ser trocado por uma
    contagem de códigos e a suíte não notaria.
    """
    extrator = PdfPlumberContractExtractor()
    geometria = analisar_geometria(pdf_do_aditivo)
    admitidas = extrator._geometrias_de_itens(pdf_do_aditivo, geometria)

    cronograma = next(c for c in geometria.candidatos if c.divisorias not in admitidas)
    assert cronograma.codigos == 2, "o cronograma vê códigos de serviço na página"
    assert cronograma.divisorias[0] == 34.5


@pytest.mark.parametrize(
    ("fixture", "malformadas"),
    [("caminho_contrato", 6), ("caminho_contrato_pgm", 5)],
)
def test_t1305_sem_o_crivo_o_cronograma_injetaria_lixo(
    fixture: str,
    malformadas: int,
    request: pytest.FixtureRequest,
) -> None:
    """Contraprova de `D-05`, no padrão da T-1106 — o crivo carrega peso.

    Aplicada às páginas da tabela de itens, a geometria do cronograma das duas
    propostas rende linhas **com código e sem número**: quantidade e período
    colados numa célula, meses vazio. São 6 no piloto e 5 no PGM.

    Sem esta contraprova, `test_t1305_tres_das_quatro` passaria também numa
    implementação que aceitasse todas as geometrias — porque nas propostas há uma
    só tabela de itens, e o dano apareceria apenas no checksum.
    """
    extrator = PdfPlumberContractExtractor()
    caminho: Path = request.getfixturevalue(fixture)

    with pdfplumber.open(caminho) as pdf:
        geometria = analisar_geometria(pdf)
        admitidas = extrator._geometrias_de_itens(pdf, geometria)
        rejeitada = next(
            c.divisorias for c in geometria.candidatos if c.divisorias not in admitidas
        )
        com_codigo = [
            celulas
            for pagina in pdf.pages
            for celulas in extrator._linhas(pagina, rejeitada)
            if celulas[0].strip().count(".") == 3
        ]

    assert len(com_codigo) == malformadas
    assert not any(extrator._e_item_completo(celulas) for celulas in com_codigo)


# ── T-1312 · A partição em blocos, no documento real ──────────────────────────


def test_t1312_os_tres_blocos_do_aditivo(aditivo: Contract) -> None:
    """ESPEC 019 `R-ADT-01` / `D-01` — rótulo, tamanho e total de cada bloco.

    O rótulo chega pela **mesma grade** que traz os itens, na linha `TOTAL:` que
    fecha o bloco. Não é preciso casar título de seção com tabela por coordenada,
    nem interpretar a prosa da primeira página.
    """
    particao = [
        (bloco.rotulo, len(bloco.itens), bloco.total_declarado)
        for bloco in aditivo.blocos
    ]
    assert particao == [
        (RotuloDeBloco.AUMENTO, 4, AUMENTO),
        (RotuloDeBloco.REDUCAO, 1, REDUCAO),
        (RotuloDeBloco.INCLUSAO, 2, INCLUSAO),
    ]


def test_t1312_so_o_bloco_de_inclusao_altera_o_conjunto(aditivo: Contract) -> None:
    """`R-ADT-03` — cinco dos sete itens do aditivo não mudam nada aqui.

    É o coração da espec: `Aumento` e `Redução` alteram quantitativo, e o relatório
    não usa quantitativo do contrato.
    """
    alteram = [bloco for bloco in aditivo.blocos if bloco.altera_o_conjunto]

    assert [bloco.rotulo for bloco in alteram] == [RotuloDeBloco.INCLUSAO]
    assert aditivo.codigos_de(RotuloDeBloco.INCLUSAO) == {
        "14.071.00006.00",
        "14.071.00007.00",
    }
    # Os cinco descartados, que a `D-08` usa como evidência.
    assert aditivo.codigos_de(RotuloDeBloco.AUMENTO) | aditivo.codigos_de(
        RotuloDeBloco.REDUCAO
    ) == {
        "10.050.00001.00",
        "14.031.00020.00",
        "14.024.00006.00",
        "14.048.00027.00",
        "12.030.00001.00",
    }
    assert aditivo.codigos_de(RotuloDeBloco.EXCLUSAO) == set()


def test_t1312_a_soma_dos_totais_dos_blocos_e_o_total_da_peca(aditivo: Contract) -> None:
    """`R-ADT-09` — o checksum vale por peça, sobre **todos** os blocos.

    Inclusive os que `R-ADT-03` descarta: é por isso que `D-06` manda extrair tudo
    e aplicar pouco. Sem o `Aumento` e o `Redução`, a conta não fecha.
    """
    soma = sum(bloco.total_declarado or Decimal(0) for bloco in aditivo.blocos)
    assert soma == aditivo.total_declarado == DECRESCIMO


@pytest.mark.parametrize(
    ("celulas", "esperado"),
    [
        (["", "", "", "", "Aumento", "TOTAL:", "BRL 24.551.037,72"], RotuloDeBloco.AUMENTO),
        (["", "", "", "", "", "Aumento TOTAL:", "BRL 24.551.037,72"], RotuloDeBloco.AUMENTO),
        (["", "", "", "", "", "TOTAL:", "BRL 10.637.425,00"], None),
    ],
)
def test_t1312_o_rotulo_sobrevive_as_duas_formas_da_celula(
    celulas: list[str], esperado: RotuloDeBloco | None
) -> None:
    """`R-ADT-01` — a palavra cai numa célula ou em duas, conforme a geometria.

    As duas primeiras são **a mesma linha física** da página 25 da proposta do PGM,
    lida pelos dois gabaritos daquele documento. Um reconhecimento por coluna fixa
    acertaria uma e erraria a outra.
    """
    assert PdfPlumberContractExtractor._rotulo(celulas) == esperado


@pytest.mark.parametrize(
    ("fixture", "rotulo", "itens"),
    [("caminho_contrato", None, 60), ("caminho_contrato_pgm", RotuloDeBloco.AUMENTO, 47)],
)
def test_t1312_a_proposta_tem_um_bloco_so_e_ele_vale_inteiro(
    fixture: str,
    rotulo: RotuloDeBloco | None,
    itens: int,
    request: pytest.FixtureRequest,
) -> None:
    """`R-ADT-02` / `D-03` — e o teste que impede o erro mais fácil da espec.

    O bloco único da proposta do PGM é rotulado **`Aumento`** e vale o contrato
    **inteiro**: `24.551.037,72`. Uma regra do tipo *"ignore todo bloco `Aumento`"*,
    aplicada sem distinguir o papel da peça, zeraria essa proposta.

    O que separa proposta de aditivo não é o rótulo — é o campo em que o arquivo
    foi submetido.
    """
    contrato = PdfPlumberContractExtractor().extrair(request.getfixturevalue(fixture))

    (bloco,) = contrato.blocos
    assert bloco.rotulo == rotulo
    assert len(bloco.itens) == itens
    assert bloco.total_declarado == contrato.total_declarado
    assert not bloco.altera_o_conjunto


# ── O portão de não-regressão (ESPEC 019 §9.1) ────────────────────────────────


def test_a_proposta_do_pgm_lida_sozinha_nao_mudou(caminho_contrato_pgm: Path) -> None:
    """`R-ADT-08` é estreitamento: a proposta segue com os números da ESPEC 017.

    Vive aqui, e não em `test_extractor_contract`, porque aquele arquivo é o
    portão que a ESPEC 019 se proibiu de tocar (§9.1). Esta é a mesma afirmação
    escrita do lado de dentro da espec nova.
    """
    contrato = PdfPlumberContractExtractor().extrair(caminho_contrato_pgm)

    assert len(contrato.itens) == 47
    assert len(contrato.codigos) == 46
    assert contrato.total_declarado == Decimal("24551037.72")
    assert contrato.soma_dos_totais == contrato.total_declarado
