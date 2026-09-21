"""T-208 — Estrutura e preservação do documento gerado. Encerra o portão P1.

Os números vêm da inspeção do modelo real (ESPEC 003 §3), não de estimativa.
São eles que provam que gerar a partir de uma cópia não perde nada: fontes
embutidas não podem ser reconstruídas, e uma perda silenciosa só apareceria
quando alguém abrisse o documento.
"""

from __future__ import annotations

import re
import zipfile
from pathlib import Path

import docx
import pytest

from domain.entities.report import Report
from infrastructure.report import modelo
from infrastructure.report.docx_renderer import DocxRenderer
from infrastructure.report.modelo import MODELO

# Largura da tabela medida no relatório GRC (infrastructure/report/layout.py).
LARGURA_DA_TABELA_CM = 26.9


def _caixas_de_texto(caminho: Path) -> list[tuple[str, ...]]:
    """Texto de cada caixa da capa, uma tupla de linhas por caixa."""
    with zipfile.ZipFile(caminho) as pacote:
        xml = pacote.read("word/document.xml").decode("utf-8")

    caixas = []
    for conteudo in re.findall(r"<w:txbxContent>(.*?)</w:txbxContent>", xml, re.S):
        linhas = [
            "".join(re.findall(r"<w:t[^>]*>([^<]*)</w:t>", paragrafo))
            for paragrafo in re.split(r"(?=<w:p[ >])", conteudo)
            if paragrafo.startswith("<w:p")
        ]
        caixas.append(tuple(linhas))
    return caixas


@pytest.fixture(scope="module")
def gerado(tmp_path_factory: pytest.TempPathFactory, relatorio_vazio: Report) -> Path:
    destino = tmp_path_factory.mktemp("estrutura") / "relatorio.docx"
    return DocxRenderer().renderizar(relatorio_vazio, destino)


# ── R-DOC-01 · o pacote sobrevive ─────────────────────────────────────────────


def test_nenhuma_parte_do_pacote_se_perde(gerado: Path) -> None:
    with zipfile.ZipFile(MODELO) as m, zipfile.ZipFile(gerado) as g:
        perdidas = set(m.namelist()) - set(g.namelist())
    assert not perdidas, f"partes perdidas: {sorted(perdidas)}"


def test_fontes_imagens_e_timbrado_sobrevivem(gerado: Path) -> None:
    with zipfile.ZipFile(gerado) as pacote:
        nomes = pacote.namelist()

    assert sum(1 for n in nomes if "fonts/" in n) == 7
    assert sum(1 for n in nomes if "media/" in n) == 3
    assert "word/header1.xml" in nomes
    assert "word/footer1.xml" in nomes


def test_o_modelo_nao_e_alterado(gerado: Path) -> None:
    """O modelo é entrada, nunca saída."""
    assert gerado != MODELO
    with zipfile.ZipFile(MODELO) as pacote:
        assert len(pacote.namelist()) == 39


# ── R-DOC-02 · a capa é reproduzida como está ─────────────────────────────────


def test_a_capa_e_identica_a_do_modelo_salvo_os_campos(gerado: Path) -> None:
    """T-1427 / ESPEC 020 `D-08` — **a asserção inverteu de sentido.**

    Até a ESPEC 020 este teste exigia igualdade **total** com o modelo, e era a
    `R-DOC-02` escrita como asserção — a regra certa enquanto o produto tinha um
    cliente só. Com a capa preenchida ela fica falsa por construção, e o teste
    passa a afirmar o que continua verdadeiro: **igualdade menos os cinco campos**.

    Não foi apagado. O que ele guarda agora é mais estreito e mais útil: que o
    preenchimento não vazou para nada além dos campos previstos.
    """
    campos = {*modelo.CAPA_FIXAS}
    obtidas, referencia = _caixas_de_texto(gerado), _caixas_de_texto(MODELO)

    assert len(obtidas) == len(referencia)
    for ordem, (caixa, esperada) in enumerate(zip(obtidas, referencia, strict=True)):
        logica = ordem // modelo.CAPA_COPIAS_POR_CAIXA
        for indice, (texto, modelo_) in enumerate(zip(caixa, esperada, strict=True)):
            if (logica, indice) in campos:
                assert texto == modelo_, f"campo fixo {(logica, indice)} foi tocado"


def test_a_capa_traz_o_conteudo_do_par_submetido(gerado: Path) -> None:
    """T-1428 — deixa de citar o SMIT como conteúdo esperado de **qualquer** documento.

    A versão anterior afirmava `SMIT SUSTENTAÇÃO` e `TC 52/SMIT/2024` sobre o
    relatório gerado, fosse ele de quem fosse. Era o teste que **protegia** o
    defeito da ESPEC 020: com um segundo par na suíte, ele teria pego o vazamento.

    A conferência por par vive em `test_capa.py`; aqui fica o que é estrutural.
    """
    caixas = _caixas_de_texto(gerado)
    # Seis blocos: três caixas, cada uma duplicada por mc:AlternateContent.
    assert len(caixas) == 6
    achatado = " ".join(linha for caixa in caixas for linha in caixa)
    assert "DIRETORIA DE INFRAESTRUTURA E TECNOLOGIA" in achatado
    assert "GIO - GERÊNCIA DE OPERAÇÕES" in achatado


# ── R-DOC-03 / R-DOC-04 · as duas seções ──────────────────────────────────────


def test_duas_secoes_retrato_e_paisagem(gerado: Path) -> None:
    secoes = docx.Document(str(gerado)).sections
    assert len(secoes) == 2

    capa, corpo = secoes
    assert (round(capa.page_width.cm, 1), round(capa.page_height.cm, 1)) == (21.0, 29.7)
    assert (round(corpo.page_width.cm, 1), round(corpo.page_height.cm, 1)) == (29.7, 21.0)


def test_a_largura_util_acomoda_a_tabela_exatamente(gerado: Path) -> None:
    """R-DOC-04 — igualdade, não aproximação.

    Se a largura útil não bater com a da tabela, ou a tabela transborda ou as
    colunas teriam de ser estreitadas — e cada largura foi medida no GRC.
    """
    corpo = docx.Document(str(gerado)).sections[-1]
    util = (corpo.page_width - corpo.left_margin - corpo.right_margin) / 360000
    assert round(util, 1) == LARGURA_DA_TABELA_CM


# ── R-DOC-05 · o timbrado é herdado ───────────────────────────────────────────


def test_a_secao_paisagem_herda_o_timbrado(gerado: Path) -> None:
    corpo = docx.Document(str(gerado)).sections[-1]
    assert corpo.header.is_linked_to_previous
    assert corpo.footer.is_linked_to_previous


def test_o_pacote_nao_ganha_timbrado_duplicado(gerado: Path) -> None:
    with zipfile.ZipFile(gerado) as pacote:
        nomes = pacote.namelist()
    assert sum(1 for n in nomes if re.search(r"word/header\d+\.xml$", n)) == 1
    assert sum(1 for n in nomes if re.search(r"word/footer\d+\.xml$", n)) == 1


# ── Sem página em branco ──────────────────────────────────────────────────────


def test_nao_ha_pagina_em_branco_entre_a_capa_e_a_tabela(gerado: Path) -> None:
    """O modelo tem duas páginas: a capa e uma folha timbrada em branco.

    Mantê-la produziria uma página vazia entre a capa e a tabela. A quebra de
    página do modelo e os parágrafos vazios que a seguem são removidos.
    """
    with zipfile.ZipFile(gerado) as pacote:
        xml = pacote.read("word/document.xml").decode("utf-8")
    corpo = xml[xml.index("<w:body>") :]
    assert 'w:type="page"' not in corpo


def test_a_capa_sobrevive_a_remocao_da_folha_em_branco(gerado: Path) -> None:
    """Guarda contra o modo de falha da remoção: levar a capa junto.

    **Terceiro teste que a ESPEC 020 inverte**, e o inventário do PLANO 020 §5.1
    previa dois. Ele também comparava a capa inteira com o modelo — para provar
    outra coisa, que ela não foi removida junto com a folha em branco.

    O que prova a sobrevivência é a **estrutura**, não o texto: se a capa tivesse
    sido levada, não haveria caixa nenhuma.
    """
    caixas = _caixas_de_texto(gerado)
    assert len(caixas) == modelo.CAPA_CAIXAS_LOGICAS * modelo.CAPA_COPIAS_POR_CAIXA
    assert all(any(linha for linha in caixa) for caixa in caixas)


# ── Timbrado centralizado ─────────────────────────────────────────────────────


def test_o_timbrado_e_centralizado_na_pagina(gerado: Path) -> None:
    """No modelo o cabeçalho é ancorado à direita e o rodapé à esquerda.

    As duas imagens têm cerca de 21 cm — a largura do A4 retrato. Na capa isso
    não aparece, mas na seção paisagem, de 29,7 cm, sobram 8,8 cm que se
    acumulam de um lado só e o timbrado fica visivelmente torto.
    """
    with zipfile.ZipFile(gerado) as pacote:
        for nome in ("word/header1.xml", "word/footer1.xml"):
            xml = pacote.read(nome).decode("utf-8")
            posicao = re.search(
                r'<wp:positionH[^>]*relativeFrom="([^"]+)">(.*?)</wp:positionH>', xml, re.S
            )
            assert posicao is not None, f"{nome} sem posicionamento horizontal"
            assert posicao.group(1) == "page"
            assert "<wp:align>center</wp:align>" in re.sub(r"\s+", "", posicao.group(2))


def test_o_modelo_conserva_o_alinhamento_original() -> None:
    """A centralização acontece na cópia, nunca no modelo."""
    with zipfile.ZipFile(MODELO) as pacote:
        xml = pacote.read("word/header1.xml").decode("utf-8")
    assert "<wp:align>right</wp:align>" in re.sub(r"\s+", "", xml)


# ── ESPEC 024 · sem bloco final, nada de novo aparece ────────────────────────


def test_sem_bloco_final_nao_ha_asterisco_nem_nota(gerado: Path) -> None:
    """`R-NOT-03` — `relatorio_vazio` não tem `demais_itens`.

    Reaproveita a fixture desta suíte: ela já é o caso "sem bloco final", feita
    para testar a estrutura isolada de conteúdo (T-208), e serve de graça ao
    `PLANO 024 §1`.
    """
    documento = docx.Document(str(gerado))
    faixas = [t.rows[0].cells[0].text.strip() for t in documento.tables]
    assert not any(f.endswith("*") for f in faixas)

    textos = [p.text for p in documento.paragraphs]
    assert not any("levantamento sem código correspondente" in t for t in textos)
