"""T-2676 / ESPEC 045 — a ordem de preço, quantidade e período, lida do cabeçalho.

`PA-CGM-250912-127 v4.0` declara a ordem canônica (`PREÇO UNITÁRIO · QTDE ·
PERÍODO`) nas seções "5.2 Redes e Conectividades" e "5.3 Serviços de
Comunicação", e a **invertida** (`Quantidade · Período · Unitário`) em "5.4
Data Center" — mesma geometria, cabeçalho diferente (ESPEC §2.2). A maioria dos
itens de "5.4" passava calada, com preço e quantidade trocados; só
`14.049.00039.00`, cujo período é escrito por extenso, estourava
`ExtractionError`.

Este módulo prova as duas pontas: o item que travava agora extrai, e os itens
vizinhos — que hoje passam *sem erro e sem aviso* — deixam de sair invertidos.
"""

from __future__ import annotations

from dataclasses import replace
from decimal import Decimal
from pathlib import Path

from conftest import FontesCaras, _ContainerComFontesEmCache

from domain.entities.contract import Contract, DiagnosticoDaGrade
from domain.entities.validation_finding import Severity, ValidationReport
from infrastructure.contract.pdfplumber_extractor import PdfPlumberContractExtractor
from infrastructure.di.container import Entradas
from infrastructure.validations.contract_validations import (
    v_ctr_08_ordem_alternativa_de_colunas,
)


def test_t2676a_item_que_travava_extrai_sem_erro(caminho_aditivo_cgm: Path) -> None:
    """`14.049.00039.00` — o item da submissão original. `R-COL-01` a `R-COL-06`."""
    extrator = PdfPlumberContractExtractor()

    contrato = extrator.extrair(caminho_aditivo_cgm)

    ocorrencias = [i for i in contrato.itens if i.codigo.valor == "14.049.00039.00"]
    assert len(ocorrencias) == 2

    primeira, segunda = ocorrencias
    assert primeira.quantidade == Decimal("1")
    assert primeira.preco_unitario == Decimal("4659.23")
    assert primeira.meses is None
    assert primeira.meses_bruto == "2 meses e 16 dias"
    assert primeira.total_declarado == Decimal("11803.38")

    assert segunda.quantidade == Decimal("2")
    assert segunda.meses_bruto == "9meses e 14 dias"
    assert segunda.total_declarado == Decimal("88214.75")


def test_t2676b_itens_vizinhos_nao_saem_mais_com_preco_e_quantidade_trocados(
    caminho_aditivo_cgm: Path,
) -> None:
    """`14.049.00038.00`, `14.049.00048.00`, `14.048.00012.00` — o defeito
    silencioso (ESPEC §2.1): período inteiro (`12`) parseava como `Decimal`
    tanto lido certo quanto invertido, e por isso nunca travava — só saía
    errado. Sem esta espec, `quantidade` viria `12` e `preco_unitario` viria
    `1`/`7`/`1`."""
    extrator = PdfPlumberContractExtractor()
    contrato = extrator.extrair(caminho_aditivo_cgm)
    por_codigo = {item.codigo.valor: item for item in contrato.itens}

    tipo_b_windows = por_codigo["14.049.00038.00"]
    assert tipo_b_windows.quantidade == Decimal("1")
    assert tipo_b_windows.preco_unitario == Decimal("3129.89")
    assert tipo_b_windows.meses == 12
    assert tipo_b_windows.total_declarado == Decimal("37558.68")

    tipo_b_linux = por_codigo["14.049.00048.00"]
    assert tipo_b_linux.quantidade == Decimal("7")
    assert tipo_b_linux.preco_unitario == Decimal("3129.89")
    assert tipo_b_linux.total_declarado == Decimal("262910.76")

    sql_server = por_codigo["14.048.00012.00"]
    assert sql_server.quantidade == Decimal("1")
    assert sql_server.preco_unitario == Decimal("109393.21")
    assert sql_server.total_declarado == Decimal("1312718.52")


def test_t2676c_papel_volta_ao_canonico_depois_de_5_4(caminho_aditivo_cgm: Path) -> None:
    """`15.069.00001.00`, seção "5.1 Produtos Customizados Por Órgão" — o
    cabeçalho canônico reaparece mais abaixo na página 4, e o papel muda de
    volta (`D-01`: estado por geometria, não resolução única por documento)."""
    extrator = PdfPlumberContractExtractor()
    contrato = extrator.extrair(caminho_aditivo_cgm)
    por_codigo = {item.codigo.valor: item for item in contrato.itens}

    etl = por_codigo["15.069.00001.00"]
    assert etl.quantidade == Decimal("1")
    assert etl.preco_unitario == Decimal("9976.84")
    assert etl.meses == 12
    assert etl.total_declarado == Decimal("119722.08")


def test_t2676d_checksum_fecha_com_o_valor_declarado(caminho_aditivo_cgm: Path) -> None:
    """27 itens, soma batendo com o total que a peça declara em prosa e no
    cronograma físico-financeiro (ESPEC 042) — `V-CTR-03` não bloqueia mais."""
    extrator = PdfPlumberContractExtractor()

    contrato = extrator.extrair(caminho_aditivo_cgm)

    assert len(contrato.itens) == 27
    assert contrato.soma_dos_totais == Decimal("6110655.79")
    assert contrato.total_declarado == Decimal("6110655.79")


def test_t2676e_ordem_de_colunas_alternativa_registra_as_duas_trocas(
    caminho_aditivo_cgm: Path,
) -> None:
    """`R-COL-07` — o diagnóstico carrega a página de cada troca, para `V-CTR-08`."""
    extrator = PdfPlumberContractExtractor()

    contrato = extrator.extrair(caminho_aditivo_cgm)

    assert contrato.diagnostico is not None
    paginas = [pagina for pagina, _ in contrato.diagnostico.ordem_de_colunas_alternativa]
    assert paginas == [3, 4]


# ── T-2676 · `R-COL-08` — nenhum documento do corpus muda ────────────────────
#
# As seis fixtures fixadas em `test_extractor_aditivo_smul.py::REGUA` já
# reprovariam por `sha` se esta entrega movesse alguma delas — não duplicado
# aqui. O que falta é a régua mais barata para as três que a `REGUA` não cobre:
# nenhuma delas pode registrar troca de papel.


def test_t2676f_nenhum_documento_do_corpus_registra_troca_de_papel(
    caminho_aditivo_pgm_2: Path,
    caminho_aditivo_smul: Path,
    caminho_contrato_cgm: Path,
) -> None:
    extrator = PdfPlumberContractExtractor()

    for caminho in (caminho_aditivo_pgm_2, caminho_aditivo_smul, caminho_contrato_cgm):
        contrato = extrator.extrair(caminho)
        assert contrato.diagnostico is not None
        assert contrato.diagnostico.ordem_de_colunas_alternativa == ()


# ── T-2684 · `V-CTR-08` isolada ───────────────────────────────────────────────


def test_t2684a_dispara_com_ordem_alternativa_registrada() -> None:
    achados = ValidationReport()
    contrato = Contract(
        proposta="PA-CONSTRUIDA",
        diagnostico=DiagnosticoDaGrade(
            paginas=4,
            paginas_com_borda=4,
            maior_numero_de_divisorias=8,
            paginas_com_texto=4,
            ordem_de_colunas_alternativa=(
                (3, "quantidade, período, preço unitário"),
            ),
        ),
    )

    v_ctr_08_ordem_alternativa_de_colunas(contrato, achados)

    assert [a.validacao for a in achados.achados] == ["V-CTR-08"]
    assert achados.achados[0].severidade is Severity.AVISA
    assert "página 3" in achados.achados[0].mensagem


def test_t2684b_nao_dispara_sem_ordem_alternativa() -> None:
    achados = ValidationReport()
    contrato = Contract(
        proposta="PA-CONSTRUIDA",
        diagnostico=DiagnosticoDaGrade(
            paginas=1,
            paginas_com_borda=1,
            maior_numero_de_divisorias=8,
            paginas_com_texto=1,
        ),
    )

    v_ctr_08_ordem_alternativa_de_colunas(contrato, achados)

    assert achados.achados == []


def test_t2684c_sem_diagnostico_nao_dispara() -> None:
    achados = ValidationReport()
    contrato = Contract(proposta="PA-CONSTRUIDA")

    v_ctr_08_ordem_alternativa_de_colunas(contrato, achados)

    assert achados.achados == []


# ── T-2686 · `V-CTR-08` está de fato ligada ao container ─────────────────────
#
# Mesma lição da ESPEC 040 `T-2622`: uma validação que existe e passa isolada
# não avisa ninguém sem uma linha em `container.py` chamando-a. O piloto
# (`contrato.pdf`) não exercita `ordem_de_colunas_alternativa` — nenhum
# documento do corpus exercita —, então o teste muta o `Contract` em memória,
# como `T-2622` já faz para `V-CTR-07`.


def test_t2686_v_ctr_08_dispara_pelo_container_completo(
    fontes_caras: FontesCaras, caminho_contrato: Path, caminho_levantamento: Path
) -> None:
    diagnostico_mutado = replace(
        fontes_caras.contrato.diagnostico,
        ordem_de_colunas_alternativa=((3, "quantidade, período, preço unitário"),),
    )
    contrato_mutado = replace(fontes_caras.contrato, diagnostico=diagnostico_mutado)
    fontes_mutadas = replace(fontes_caras, contrato=contrato_mutado)

    resultado = _ContainerComFontesEmCache(fontes_mutadas).gerar(
        Entradas(contrato=caminho_contrato, levantamento=caminho_levantamento)
    )

    assert not resultado.achados.bloqueado
    assert "V-CTR-08" in [a.validacao for a in resultado.achados.avisos]
