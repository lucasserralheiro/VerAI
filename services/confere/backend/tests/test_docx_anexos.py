"""T-310 a T-318 — Os anexos no documento (ESPEC 004).

O documento completo é gerado **uma vez** neste módulo: são 25 mil células e
cerca de meio minuto, e repeti-lo por asserção dominaria a suíte.

Vale a advertência que a ESPEC 003 deixou registrada: estes testes garantem
estrutura e conteúdo, **não aparência**. Lá seis defeitos passaram pela suíte
inteira e só apareceram quando o documento foi aberto no Word. Aqui há 19
anexos, e a conferência visual continua sendo a única prova de que a página
está certa.
"""

from __future__ import annotations

from datetime import date
from pathlib import Path
from typing import Any

import docx
import pytest
from docx.oxml.ns import qn

from domain.entities.annex import Anexo, CelulaAnexo, Orientacao
from domain.entities.report import Report
from infrastructure.annex.anexo_reader import AnexoReader
from infrastructure.annex.configuracao import anexos_configurados
from infrastructure.report.docx_renderer import DocxRenderer

SECOES_ANTES_DOS_ANEXOS = 2  # a capa e a tabela de comprovação
# O bloco de título — faixa navy, data e contrato — é uma tabela, e sai mesmo
# num relatório sem seções. As tabelas de anexo começam depois dela.
TABELAS_ANTES_DOS_ANEXOS = 1


# ── Leitura do documento ──────────────────────────────────────────────────────


def _tem_cabecalho_repetido(fileira: Any) -> bool:
    trPr = fileira._tr.find(qn("w:trPr"))
    return trPr is not None and trPr.find(qn("w:tblHeader")) is not None


def _larguras_da_grade(tabela: Any) -> list[int]:
    grade = tabela._tbl.find(qn("w:tblGrid"))
    return [int(coluna.get(qn("w:w"))) for coluna in grade.findall(qn("w:gridCol"))]


def _texto_da_tabela(tabela: Any) -> list[list[str]]:
    return [[celula.text.strip() for celula in fileira.cells] for fileira in tabela.rows]


def _gridspan(celula: Any) -> int:
    tcPr = celula._tc.find(qn("w:tcPr"))
    span = tcPr.find(qn("w:gridSpan")) if tcPr is not None else None
    return int(span.get(qn("w:val"))) if span is not None else 1


def _sem_borda(celula: Any) -> bool:
    """A célula anula a grade da tabela nos quatro lados (ESPEC 014)."""
    tcPr = celula._tc.find(qn("w:tcPr"))
    bordas = tcPr.find(qn("w:tcBorders")) if tcPr is not None else None
    if bordas is None:
        return False
    lados = {lado.tag.split("}")[1]: lado.get(qn("w:val")) for lado in bordas}
    return lados == dict.fromkeys(("top", "left", "bottom", "right"), "nil")


# ── O documento completo ──────────────────────────────────────────────────────


@pytest.fixture(scope="module")
def anexos(caminho_levantamento: Path) -> list[Anexo]:
    return AnexoReader().ler(caminho_levantamento)


def _relatorio(anexos: list[Anexo]) -> Report:
    """Um relatório novo a cada uso.

    O `relatorio_vazio` do conftest tem escopo de sessão: acrescentar anexos a
    ele os despejaria nos testes dos outros módulos, que passariam a gerar 41
    páginas para conferir a capa.
    """
    return Report(
        titulo="LEVANTAMENTO - COMPROVAÇÃO",
        data_levantamento=date(2026, 7, 15),
        contrato_referencia="TC 52/SMIT/2024",
        proposta_origem="PA-SMIT-260319-739",
        anexos=anexos,
    )


@pytest.fixture(scope="module")
def documento(anexos: list[Anexo], tmp_path_factory: pytest.TempPathFactory) -> Any:
    """Relatório sem seções: aqui o que está sob teste são os anexos.

    A tabela de comprovação tem os seus próprios testes, e o teste-âncora garante
    que ela não se moveu.
    """
    destino = tmp_path_factory.mktemp("anexos") / "relatorio.docx"
    return docx.Document(str(DocxRenderer().renderizar(_relatorio(anexos), destino)))


@pytest.fixture(scope="module")
def secoes_de_anexo(documento: Any) -> list[Any]:
    return list(documento.sections)[SECOES_ANTES_DOS_ANEXOS:]


@pytest.fixture(scope="module")
def tabelas_por_anexo(documento: Any, anexos: list[Anexo]) -> dict[str, list[Any]]:
    """Distribui as tabelas do documento entre os anexos, na ordem em que saem.

    Um anexo produz uma tabela, ou mais quando algum cabeçalho precisa se
    repetir (`Anexo.cortes`, ESPEC 051).
    """
    tabelas = list(documento.tables)
    distribuidas: dict[str, list[Any]] = {}
    posicao = TABELAS_ANTES_DOS_ANEXOS
    for anexo in anexos:
        quantas = _tabelas_esperadas(anexo)
        distribuidas[anexo.aba] = tabelas[posicao : posicao + quantas]
        posicao += quantas
    return distribuidas


def _tabelas_esperadas(anexo: Anexo) -> int:
    """Uma tabela por segmento — um a mais por corte dentro da faixa.

    Uma figura no meio da aba parte a faixa em duas — é o caso de
    `ServicosEmNuvem`, que sai em três tabelas com o gráfico entre a primeira
    parte e a segunda. `Servidores` e `ServidoresSemDesenv` (ESPEC 051) têm
    dois cortes dentro da mesma faixa, e saem em três tabelas cada.
    """
    return sum(
        len([c for c in anexo.cortes if inicio < c < fim]) + 1
        for inicio, fim, imagem in anexo.blocos()
        if imagem is None
    )


# ── Estrutura (T-307, T-318) ──────────────────────────────────────────────────


def test_o_documento_ganha_uma_secao_por_anexo(documento: Any) -> None:
    assert len(documento.sections) == SECOES_ANTES_DOS_ANEXOS + 19


def test_cada_anexo_sai_na_orientacao_do_grc(
    secoes_de_anexo: list[Any], anexos: list[Anexo]
) -> None:
    saiu = [
        Orientacao.PAISAGEM if s.page_width > s.page_height else Orientacao.RETRATO
        for s in secoes_de_anexo
    ]
    assert saiu == [anexo.orientacao for anexo in anexos]


def test_quatorze_secoes_em_retrato_e_cinco_em_paisagem(secoes_de_anexo: list[Any]) -> None:
    paisagens = [s for s in secoes_de_anexo if s.page_width > s.page_height]
    assert (len(secoes_de_anexo) - len(paisagens), len(paisagens)) == (14, 5)


def test_todo_anexo_configurado_produziu_tabela(tabelas_por_anexo: dict[str, list[Any]]) -> None:
    assert set(tabelas_por_anexo) == {c.aba for c in anexos_configurados()}
    assert all(tabelas for tabelas in tabelas_por_anexo.values())


# ── Conteúdo (T-308) ──────────────────────────────────────────────────────────


def test_o_anexo_traz_a_aba_inteira(
    tabelas_por_anexo: dict[str, list[Any]], anexos: list[Anexo]
) -> None:
    """`R-ANX-05` — todas as linhas e todas as colunas, sem filtro.

    A exceção são as linhas que uma figura cobre: em `ServicosEmNuvem` a faixa
    vazia das linhas 6 a 18 existe para abrir espaço ao gráfico, e emiti-la
    junto deixaria um vão em branco de 6 cm.
    """
    for anexo in anexos:
        saiu = sum(len(tabela.rows) for tabela in tabelas_por_anexo[anexo.aba])
        emitidas = sum(fim - inicio for inicio, fim, imagem in anexo.blocos() if imagem is None)
        assert saiu == emitidas, anexo.aba
        if not anexo.imagens:
            assert saiu == len(anexo.linhas), anexo.aba


def test_o_conteudo_do_nas_e_o_da_planilha(tabelas_por_anexo: dict[str, list[Any]]) -> None:
    linhas = [linha for t in tabelas_por_anexo["NAS"] for linha in _texto_da_tabela(t)]
    assert linhas[0][0] == "ARMAZENAMENTO NAS - SMIT SUSTENTAÇÃO"
    assert linhas[6][:3] == ["Secretaria", "Pasta", "Share"]
    # Número em pt-BR, como na coluna de quantidades do relatório.
    assert linhas[7][5] == "219,92"


def test_o_titulo_ocupa_a_linha_inteira(tabelas_por_anexo: dict[str, list[Any]]) -> None:
    """`R-ANX-06` — a mesclagem A1:G1 do NAS chega ao documento."""
    primeira = tabelas_por_anexo["NAS"][0].rows[0]
    span = primeira.cells[0]._tc.find(qn("w:tcPr")).find(qn("w:gridSpan"))
    assert span is not None and int(span.get(qn("w:val"))) == 7


def test_o_preenchimento_do_cabecalho_vem_da_aba(
    tabelas_por_anexo: dict[str, list[Any]],
) -> None:
    """`A52A2A` foi medido na célula, não escolhido no código."""
    corpo = tabelas_por_anexo["NAS"][1]
    shd = corpo.rows[0].cells[0]._tc.find(qn("w:tcPr")).find(qn("w:shd"))
    assert shd is not None and shd.get(qn("w:fill")) == "A52A2A"


def _jc(celula: Any) -> str | None:
    """O `w:jc` da célula, ou `None` quando ausente — equivalente a `left`."""
    paragrafo = celula._tc.find(qn("w:p"))
    propriedades = paragrafo.find(qn("w:pPr")) if paragrafo is not None else None
    alinhamento = propriedades.find(qn("w:jc")) if propriedades is not None else None
    return alinhamento.get(qn("w:val")) if alinhamento is not None else None


def test_o_alinhamento_do_nas_e_o_da_planilha(tabelas_por_anexo: dict[str, list[Any]]) -> None:
    """ESPEC 052 `R-ALN-01` — medido na aba (§2.1): cabeçalho e `Storage Server`/
    `Volume` centralizados, número à direita, texto puro à esquerda (sem `w:jc`).
    """
    resumo, corpo = tabelas_por_anexo["NAS"]

    # Resumo — "USADO (GB)"/"ALOCADO (GB)" e os dois valores abaixo.
    assert [_jc(c) for c in resumo.rows[2].cells[5:]] == ["center", "center"]
    assert [_jc(c) for c in resumo.rows[3].cells[5:]] == ["right", "right"]

    # Corpo — cabeçalho de coluna, e a primeira linha de dado (SMIT/CACISP/...).
    assert [_jc(c) for c in corpo.rows[0].cells] == ["center"] * 7
    dado = corpo.rows[1].cells
    assert [_jc(c) for c in dado[:3]] == [None, None, None]  # Secretaria/Pasta/Share
    assert [_jc(c) for c in dado[3:5]] == ["center", "center"]  # Storage Server/Volume
    assert [_jc(c) for c in dado[5:]] == ["right", "right"]  # Usado(GB)/Alocado(GB)


def test_o_separador_entre_segmentos_recebe_a_marca_do_paragrafo(
    tabelas_por_anexo: dict[str, list[Any]],
) -> None:
    """ESPEC 053 `R-CEL-05` — o parágrafo entre os dois segmentos de
    `Comunicação Dados` (resumo e corpo, ESPEC 004/051) tem a marca do
    parágrafo no mesmo corpo da execução (1pt), não os 12pt herdados do
    documento — sem ela, o vão "imperceptível" deixa de ser.
    """
    primeira_tabela = tabelas_por_anexo["Comunicação Dados"][0]
    separador = primeira_tabela._tbl.getnext()
    assert separador.tag == qn("w:p")

    marca = separador.find(qn("w:pPr")).find(qn("w:rPr"))
    assert marca is not None
    assert marca.find(qn("w:sz")).get(qn("w:val")) == "2"


# ── Volume e paginação (T-311, T-312) ─────────────────────────────────────────


def test_usuarios_produz_as_mil_e_vinte_e_uma_linhas(
    tabelas_por_anexo: dict[str, list[Any]],
) -> None:
    assert sum(len(t.rows) for t in tabelas_por_anexo["Usuários"]) == 1021


def test_usuarios_se_parte_em_preambulo_e_corpo(
    tabelas_por_anexo: dict[str, list[Any]],
) -> None:
    """O corte existe para a restrição do Word — ver `Anexo.cortes`."""
    preambulo, corpo = tabelas_por_anexo["Usuários"]
    assert len(preambulo.rows) == 7  # título, resumo, subtítulo e os respiros
    assert len(corpo.rows) == 1014


def test_o_cabecalho_de_usuarios_se_repete(tabelas_por_anexo: dict[str, list[Any]]) -> None:
    """`R-ANX-11` — a única divergência deliberada em relação ao GRC."""
    corpo = tabelas_por_anexo["Usuários"][1]
    assert _tem_cabecalho_repetido(corpo.rows[0])


def test_o_wifi_repete_o_cabecalho_certo_em_cada_tabela(
    tabelas_por_anexo: dict[str, list[Any]],
) -> None:
    """ESPEC 054 `R-WIFI-01` — o resumo e a tabela `TIPO de TC` têm cabeçalhos

    diferentes, e cada um precisa repetir o seu, não o do outro. Antes desta
    espec, `WIFI` saía numa tabela só e a tabela larga (`TIPO de TC`, 21
    linhas) repetia, ao quebrar página, o cabeçalho do resumo.
    """
    resumo, corpo = tabelas_por_anexo["WIFI"][1:]

    assert _tem_cabecalho_repetido(resumo.rows[0])
    assert [c.text.strip() for c in resumo.rows[0].cells if c.text.strip()] == [
        "Unidade",
        "Quantidade Medida",
    ]

    assert _tem_cabecalho_repetido(corpo.rows[0])
    assert [c.text.strip() for c in corpo.rows[0].cells if c.text.strip()][:3] == [
        "Seq",
        "TIPO de TC",
        "Cod.Produto",
    ]


def test_a_marca_de_cabecalho_cai_na_primeira_fileira_da_tabela(
    tabelas_por_anexo: dict[str, list[Any]], anexos: list[Anexo]
) -> None:
    """Fora da primeira fileira o Word ignora a marca, e a regra não valeria.

    É o motivo de existir o corte: marcar a 8ª linha de uma tabela única não
    repetiria nada, e o teste passaria mesmo assim se olhasse só a marca.

    ESPEC 051 — a regra é por **tabela**, não por anexo: `Servidores` e
    `ServidoresSemDesenv` têm duas tabelas marcadas cada (resumo e detalhe),
    e cada marca continua tendo de ser a fileira 0 da sua própria tabela.
    """
    for anexo in anexos:
        for tabela in tabelas_por_anexo[anexo.aba]:
            marcadas = [
                indice
                for indice, fileira in enumerate(tabela.rows)
                if _tem_cabecalho_repetido(fileira)
            ]
            assert marcadas in ([], [0]), anexo.aba


def test_todo_anexo_de_mais_de_uma_pagina_repete_o_cabecalho(
    tabelas_por_anexo: dict[str, list[Any]],
) -> None:
    """Os três que ocupam mais de uma página no GRC: SOA, Office365 e Usuários."""
    for aba in ("Usuários", "Office365", "SOA"):
        tabelas = tabelas_por_anexo[aba]
        assert any(_tem_cabecalho_repetido(t.rows[0]) for t in tabelas), aba


# ── Largura (T-313, T-314) ────────────────────────────────────────────────────


def test_nenhuma_tabela_estoura_a_area_util(
    tabelas_por_anexo: dict[str, list[Any]],
    secoes_de_anexo: list[Any],
    anexos: list[Anexo],
) -> None:
    """A coluna cortada da ESPEC 003 vira teste, agora com até 22 colunas."""
    for anexo, secao in zip(anexos, secoes_de_anexo, strict=True):
        util = secao.page_width.twips - secao.left_margin.twips - secao.right_margin.twips
        for tabela in tabelas_por_anexo[anexo.aba]:
            assert sum(_larguras_da_grade(tabela)) <= util, anexo.aba


def test_as_colunas_nao_saem_uniformes(tabelas_por_anexo: dict[str, list[Any]]) -> None:
    """A grade recebe as medidas, não só as células — o defeito da ESPEC 003."""
    larguras = _larguras_da_grade(tabelas_por_anexo["NAS"][1])
    assert len(set(larguras)) > 1


def test_comunicacao_dados_cabe_com_as_vinte_e_duas_colunas(
    tabelas_por_anexo: dict[str, list[Any]],
) -> None:
    """As 22 colunas estão na tabela do **corpo**, não na do preâmbulo.

    Desde a ESPEC 014 a largura é decidida por bloco: o preâmbulo deste anexo
    usa 6 colunas e sai com 6. Era a tabela de baixo que a asserção sempre quis
    — é ela que tem as 22 e é ela que quase não coube.
    """
    larguras = _larguras_da_grade(tabelas_por_anexo["Comunicação Dados"][1])
    assert len(larguras) == 22
    assert all(largura > 0 for largura in larguras)


# ── Aba vazia (T-317, revista pela T-2288 / ESPEC 036) ────────────────────────


def test_t2288_anexo_sem_linhas_nao_produz_pagina(tmp_path: Path) -> None:
    """`R-VAZ-01` — nem seção, nem título, nem observação.

    Era `test_anexo_sem_linhas_sai_com_titulo_e_observacao`, e a `T-317` estava
    certa no fim e errada no meio: o que ela queria era que **a geração não
    caísse**, e a página com a frase foi o jeito escolhido quando só existia a
    planilha do piloto, onde nenhuma aba configurada falta.

    Com o PGM — três abas ausentes — a página deixou de ser hipótese, e o que se
    vê é que ela não protege nada: quem protege é o `AnexoReader` devolver
    `FormaDaAba` vazia em vez de estourar. **A terceira asserção é a que sobrevive
    da `T-317`**, e é ela que continua afirmando o fim daquela tarefa.
    """
    relatorio = _relatorio(
        [Anexo(aba="AbaSemNada", orientacao=Orientacao.RETRATO, corpo=8.0, linha_cabecalho=None)]
    )
    destino = DocxRenderer().renderizar(relatorio, tmp_path / "vazio.docx")

    documento = docx.Document(str(destino))
    assert len(documento.sections) == SECOES_ANTES_DOS_ANEXOS
    assert "AbaSemNada" not in [paragrafo.text for paragrafo in documento.paragraphs]
    assert len(documento.tables) == TABELAS_ANTES_DOS_ANEXOS


def test_anexo_de_uma_linha_nao_exige_corte(tmp_path: Path) -> None:
    """Guarda contra o caso degenerado: cabeçalho na primeira linha, sem preâmbulo."""
    relatorio = _relatorio(
        [
                Anexo(
                aba="Minima",
                orientacao=Orientacao.RETRATO,
                corpo=8.0,
                linha_cabecalho=0,
                linhas=((CelulaAnexo(texto="Coluna"),), (CelulaAnexo(texto="valor"),)),
                proporcoes=(10.0,),
            )
        ]
    )
    destino = DocxRenderer().renderizar(relatorio, tmp_path / "minima.docx")

    tabela = docx.Document(str(destino)).tables[TABELAS_ANTES_DOS_ANEXOS]
    assert _texto_da_tabela(tabela) == [["Coluna"], ["valor"]]
    assert _tem_cabecalho_repetido(tabela.rows[0])


# ── Bordas nas áreas vazias (ESPEC 014) ───────────────────────────────────────


def test_a_largura_e_do_bloco_e_nao_da_aba(tabelas_por_anexo: dict[str, list[Any]]) -> None:
    """`R-BRD-01` (ESPEC 014) e `R-SEG-03` (ESPEC 051) — três tabelas, três contagens.

    `Servidores` tem uma tabela de resumo (11 colunas) e uma de detalhe (15) —
    duas tabelas empilhadas na mesma aba, cada uma com a largura que o seu
    próprio cabeçalho usa. Antes da ESPEC 051 as duas eram uma tabela só, com
    15 colunas de grade e só 11 rótulos no cabeçalho repetido — as 4 colunas
    que sobravam ficavam sem texto na fileira que o Word repete a cada
    página.
    """
    preambulo, resumo, detalhe = tabelas_por_anexo["Servidores"]
    assert len(_larguras_da_grade(preambulo)) == 9
    assert len(_larguras_da_grade(resumo)) == 11
    assert len(_larguras_da_grade(detalhe)) == 15


def test_a_faixa_mesclada_nao_encolhe_o_bloco(
    tabelas_por_anexo: dict[str, list[Any]],
) -> None:
    """`R-BRD-02` — o teste que impede o defeito silencioso.

    O `openpyxl` deixa vazias as células cobertas por uma mesclagem: o valor
    mora só na âncora. Contar coluna por célula apararia `WIFI` de 4 para 1, e a
    faixa de título não sumiria — sairia com um quarto da largura, que é o tipo
    de defeito que passa por toda a suíte sem sintoma.
    """
    preambulo = tabelas_por_anexo["WIFI"][0]
    assert len(_larguras_da_grade(preambulo)) == 4
    assert _gridspan(preambulo.rows[0].cells[0]) == 4


def test_a_linha_em_branco_sai_sem_borda(
    tabelas_por_anexo: dict[str, list[Any]],
) -> None:
    """`R-BRD-04` — a linha de respiro fica, a moldura não.

    A aba **declara** borda nessas células, e o leitor as copia fielmente
    (`R-ANX-06`). O GRC não as desenha: entre o `TOTAIS` e a tabela de baixo há
    um vão limpo, e era essa moldura vazia que aparecia no documento.
    """
    respiro = tabelas_por_anexo["Servidores"][0].rows[-1]
    assert all(not celula.text.strip() for celula in respiro.cells)
    assert all(_sem_borda(celula) for celula in respiro.cells)
    # A linha permanece, com a altura medida no GRC: ela é o respiro.
    assert respiro._tr.find(qn("w:trPr")).find(qn("w:trHeight")) is not None


def test_a_mesclagem_que_estoura_e_limitada(
    tabelas_por_anexo: dict[str, list[Any]],
) -> None:
    """`R-BRD-05` — limitar, não descartar.

    É o único caso do piloto: o preâmbulo de `SOA` fica com 4 colunas e traz uma
    faixa mesclada de `A` a `E`. Descartá-la deixaria a fileira em células
    soltas onde a aba tem uma faixa só.
    """
    preambulo = tabelas_por_anexo["SOA"][0]
    assert len(_larguras_da_grade(preambulo)) == 4
    assert _gridspan(preambulo.rows[4].cells[0]) == 4


def test_coluna_vazia_no_meio_fica_e_sai_sem_borda(tmp_path: Path) -> None:
    """`R-BRD-03` — caso **construído**: o piloto não o percorre.

    Varridos os 37 blocos dos 19 anexos, nenhum tem coluna vazia no meio — a
    cobertura das mesclagens preenche todas. A regra existe porque recortar a
    coluna do meio deslocaria as seguintes e desfaria as larguras do GRC
    (`R-ANX-12`), e sem um caso construído ninguém saberia se ela funciona.
    """
    vao = CelulaAnexo(borda=True)
    relatorio = _relatorio(
        [
            Anexo(
                aba="ComVaoNoMeio",
                orientacao=Orientacao.RETRATO,
                corpo=8.0,
                linhas=(
                    (CelulaAnexo(texto="Código", borda=True), vao,
                     CelulaAnexo(texto="Valor", borda=True)),
                    (CelulaAnexo(texto="A1", borda=True), vao,
                     CelulaAnexo(texto="10", borda=True)),
                ),
                proporcoes=(1.0, 2.0, 1.0),
                largura_total_pt=200.0,
            )
        ]
    )
    destino = DocxRenderer().renderizar(relatorio, tmp_path / "vao.docx")

    tabela = docx.Document(str(destino)).tables[TABELAS_ANTES_DOS_ANEXOS]
    # A coluna fica, com a largura que a planilha lhe dá — 2 de 4 sobre 200 pt.
    assert [largura / 20 for largura in _larguras_da_grade(tabela)] == [50.0, 100.0, 50.0]
    assert all(_sem_borda(fileira.cells[1]) for fileira in tabela.rows)
    assert not any(_sem_borda(fileira.cells[0]) for fileira in tabela.rows)


# ── Geometria do GRC (larguras e alturas medidas) ─────────────────────────────


def test_as_larguras_sao_as_medidas_no_grc(
    tabelas_por_anexo: dict[str, list[Any]], anexos: list[Anexo]
) -> None:
    """Onde a medição resolve o anexo, a coluna sai com a largura do GRC.

    A tolerância de meio ponto é o arredondamento de pt para twips, que é a
    unidade em que o OOXML guarda a largura.

    Desde a ESPEC 014 uma tabela pode ter menos colunas que o anexo — mas as que
    ela tem são sempre um **prefixo** da medição, com a largura intacta
    (`R-BRD-01`, `R-BRD-03`). É o que impede o corte de virar redistribuição.
    """
    medidos = [anexo for anexo in anexos if anexo.larguras_medidas]
    assert len(medidos) == 17, "17 dos 19 anexos têm fronteira de coluna legível no PDF"

    for anexo in medidos:
        for tabela in tabelas_por_anexo[anexo.aba]:
            saiu = [largura / 20 for largura in _larguras_da_grade(tabela)]
            assert len(saiu) <= len(anexo.larguras_medidas), anexo.aba
            esperadas = anexo.larguras_medidas[: len(saiu)]
            for largura, esperada in zip(saiu, esperadas, strict=True):
                assert abs(largura - esperada) < 0.5, anexo.aba


def test_a_largura_total_e_a_do_grc(
    tabelas_por_anexo: dict[str, list[Any]], anexos: list[Anexo]
) -> None:
    """A tabela tem a largura que tem no PDF — inclusive nos dois de medição ambígua.

    A tolerância é de 2%, e tem causa conhecida: a soma das colunas fica cerca
    de 1% abaixo do vão externo da tabela no PDF, porque ali cada traço de borda
    ocupa espaço próprio. No OOXML a borda é desenhada **dentro** da largura da
    célula, então a mesma tabela sai com a mesma medida externa.

    A medida vale para a tabela que usa **todas** as colunas do anexo. Desde a
    ESPEC 014 as outras terminam onde o conteúdo delas termina, e é assim no
    GRC: o bloco de preâmbulo de `Servidores` mede 285,4 pt contra os 519,1 da
    tabela de baixo. Todo anexo tem ao menos uma tabela cheia — a que carrega o
    corpo —, e é ela que esta asserção alcança.
    """
    for anexo in anexos:
        assert anexo.largura_total_pt is not None, anexo.aba
        cheias = [
            tabela
            for tabela in tabelas_por_anexo[anexo.aba]
            if len(_larguras_da_grade(tabela)) == anexo.total_colunas
        ]
        assert cheias, anexo.aba
        for tabela in cheias:
            total = sum(_larguras_da_grade(tabela)) / 20
            desvio = abs(total - anexo.largura_total_pt) / anexo.largura_total_pt
            assert desvio < 0.02, f"{anexo.aba}: {total:.1f} pt contra {anexo.largura_total_pt}"


def test_a_altura_de_linha_e_a_do_grc(
    tabelas_por_anexo: dict[str, list[Any]], anexos: list[Anexo]
) -> None:
    for anexo in anexos:
        assert anexo.altura_linha_pt is not None, anexo.aba
        fileira = tabelas_por_anexo[anexo.aba][0].rows[0]
        altura = fileira._tr.find(qn("w:trPr")).find(qn("w:trHeight"))
        assert altura is not None, anexo.aba
        assert abs(int(altura.get(qn("w:val"))) / 20 - anexo.altura_linha_pt) < 0.5


def test_a_altura_e_minimo_e_nao_valor_exato(tabelas_por_anexo: dict[str, list[Any]]) -> None:
    """Altura exata cortaria o que o Word quebrar em duas linhas e o Excel não."""
    fileira = tabelas_por_anexo["NAS"][0].rows[0]
    altura = fileira._tr.find(qn("w:trPr")).find(qn("w:trHeight"))
    assert altura.get(qn("w:hRule")) == "atLeast"


def test_a_celula_vazia_recebe_a_mesma_normalizacao_de_paragrafo(
    tabelas_por_anexo: dict[str, list[Any]], anexos: list[Anexo]
) -> None:
    """ESPEC 049 `R-CEL-01` — sem isto, a célula vazia herda o `w:pPrDefault`/
    `w:rPrDefault` do modelo (8pt de espaço depois do parágrafo, fonte 12pt),
    maior que o mínimo da linha e maior que o corpo do próprio anexo — é o que
    fazia o respiro entre faixas de título sair bem maior que a linha de dado
    ao lado (medido: 25,4pt contra os 13,6pt declarados para `Internet`).
    """
    from infrastructure.report.ooxml import _meio_ponto

    internet = next(anexo for anexo in anexos if anexo.aba == "Internet")
    # A linha de respiro entre "INTERNET - SMIT SUSTENTAÇÃO" e "INTERNET" —
    # `Anexo.cortes` (= (6,)) parte a faixa 0-13 em duas tabelas, e esta é a
    # primeira, com o preâmbulo (título, respiro, subtítulo, respiro...).
    preambulo = tabelas_por_anexo["Internet"][0]
    vazia = preambulo.rows[1].cells[0]
    assert vazia.text == ""

    paragrafo = vazia._tc.find(qn("w:p"))
    espaco = paragrafo.find(qn("w:pPr")).find(qn("w:spacing"))
    assert espaco is not None
    assert espaco.get(qn("w:before")) == "0"
    assert espaco.get(qn("w:after")) == "0"

    tamanho = paragrafo.find(qn("w:r")).find(qn("w:rPr")).find(qn("w:sz"))
    assert tamanho is not None
    assert tamanho.get(qn("w:val")) == _meio_ponto(internet.corpo)


def test_usuarios_sai_com_as_oito_colunas_do_grc(anexos: list[Anexo]) -> None:
    """A aba tem 15 colunas no arquivo; o GRC imprime 8, e sete eram fantasma.

    As sete sobrando não têm texto nem preenchimento — só uma borda na faixa
    mesclada da última linha. Mantê-las espremia as oito reais em pouco mais da
    metade da largura da página.
    """
    usuarios = next(anexo for anexo in anexos if anexo.aba == "Usuários")
    assert usuarios.total_colunas == 8


# ── Figuras (o gráfico de `ServicosEmNuvem`) ──────────────────────────────────

WP = "{http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing}"
DRAWING = f"{WP}inline"
EMU_POR_PONTO = 12700


def _figuras_do_corpo(documento: Any) -> list[Any]:
    return documento.element.body.findall(f".//{DRAWING}")


def _largura_pt(figura: Any) -> float:
    """`wp:extent` guarda o tamanho renderizado, em EMU."""
    return float(figura.find(f"{WP}extent").get("cx")) / EMU_POR_PONTO


def test_as_figuras_das_abas_chegam_ao_documento(documento: Any) -> None:
    """Duas: o gráfico de custos de `ServicosEmNuvem` e o de `Internet`.

    Elas não são célula, e por isso o leitor de células as perdia inteiras. A
    `Capa` também tem uma, mas não é anexo (`R-ANX-08`).
    """
    assert len(_figuras_do_corpo(documento)) == 2


def test_a_figura_sai_no_tamanho_impresso_do_grc(documento: Any, anexos: list[Anexo]) -> None:
    """O PNG tem 1.238 px de largura — a 96 dpi daria 928 pt, o dobro da página."""
    esperadas = [
        imagem.largura_pt for anexo in anexos for imagem in anexo.imagens
    ]
    assert esperadas, "os dois anexos com figura precisam trazê-la"

    saiu = sorted(_largura_pt(figura) for figura in _figuras_do_corpo(documento))
    for largura, esperada in zip(saiu, sorted(esperadas), strict=True):
        assert abs(largura - esperada) < 1.0


def test_a_figura_cabe_na_area_util(documento: Any, secoes_de_anexo: list[Any]) -> None:
    retrato = min(
        s.page_width.pt - s.left_margin.pt - s.right_margin.pt for s in secoes_de_anexo
    )
    for figura in _figuras_do_corpo(documento):
        assert _largura_pt(figura) <= retrato


def test_o_grafico_fica_entre_as_duas_tabelas_de_servicos_em_nuvem(
    tabelas_por_anexo: dict[str, list[Any]], anexos: list[Anexo]
) -> None:
    """A figura ocupa as linhas 6 a 18, vazias — e o GRC a mostra ali.

    Se ela fosse jogada no fim, as 29 linhas de custo por serviço apareceriam
    antes do gráfico que as resume.
    """
    anexo = next(a for a in anexos if a.aba == "ServicosEmNuvem")
    assert [(i, f) for i, f, imagem in anexo.blocos() if imagem is None] == [(0, 5), (18, 47)]

    saiu = sum(len(t.rows) for t in tabelas_por_anexo["ServicosEmNuvem"])
    assert saiu == 5 + (47 - 18), "as linhas cobertas pela figura não são emitidas"
