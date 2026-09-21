"""T-518 · T-521 · T-522 · T-554 — O arquivo da análise.

O teste-âncora compara o arquivo gerado com o gabarito, **célula a célula**, nas
posições que os dois têm em comum: as cinco primeiras colunas das abas de
detalhe. As colunas numéricas e as marcas são acréscimo nosso e são verificadas
à parte — elas não existem no gabarito.

O que nenhum teste daqui alcança: **o arquivo abrir no Excel**. `openpyxl` relê
perfeitamente o que ele mesmo escreveu, e foi essa mesma cegueira que deixou seis
defeitos de DOCX passarem por toda a suíte na ESPEC 003 até alguém abrir o Word.
É o portão P2, e ele é humano (T-523, insumo `K-01`).
"""

from __future__ import annotations

from collections.abc import Callable
from datetime import date
from decimal import Decimal
from pathlib import Path

import openpyxl
import pytest
from grafia import CABECALHOS_DE_QUANTIDADE, divergencias_de_grafia, texto_exibido
from leitura_analise import (
    ABA_DA_CLASSIFICACAO,
    PRIMEIRA_LINHA_DE_DADO,
    ler_referencia,
    na_precisao_do_gabarito,
)

from application.use_cases.generate_measurement_report import ReportResult
from domain.entities.analysis import AnaliseDaMedicao
from domain.entities.report import Report, ReportLine
from domain.value_objects.classification import Classificacao
from domain.value_objects.quantity import NumberFormat, Quantity
from domain.value_objects.service_code import ServiceCode
from infrastructure.report.xlsx_analise_renderer import (
    FORMATO_MILHAR_DECIMAL,
    FORMATO_MILHAR_INTEIRO,
    FORMATO_SIMPLES_INTEIRO,
    FORMATOS,
    LINHA_DO_CABECALHO,
    XlsxAnaliseRenderer,
    _formato_de,
)

FIXTURES = Path(__file__).parent / "fixtures"
REFERENCIA = FIXTURES / "analise_referencia.xlsx"

# As duas divergências declaradas da T-505 — as linhas que o âncora não compara
# por valor, porque a diferença é conhecida e tem dono.
FORA_DA_COMPARACAO = {"11.027.00001.00", "14.049.00054.00"}

# ESPEC 018 `D-04` — nada é omitido do documento, e por isso a análise passou a
# ver três códigos que o gabarito do GRC não tem: a aba `Levantamento` os traz
# zerados dos dois lados, e o catálogo os desconhecia.
#
# Não são divergência com o gabarito: são itens que ele nunca teve como
# enxergar, porque o universo anterior era o catálogo.
FORA_DO_GABARITO = {"12.029.00001.00", "14.024.00001.00", "14.049.00004.00"}


@pytest.fixture(scope="module")
def analise(gerar_piloto: Callable[..., ReportResult]) -> AnaliseDaMedicao:
    resultado = gerar_piloto()
    assert resultado.relatorio is not None
    return AnaliseDaMedicao.de_relatorio(resultado.relatorio)


@pytest.fixture(scope="module")
def arquivo(analise: AnaliseDaMedicao, tmp_path_factory: pytest.TempPathFactory) -> Path:
    destino = tmp_path_factory.mktemp("analise") / "Relatorio_Analise_Medicao.xlsx"
    return XlsxAnaliseRenderer().renderizar(analise, destino)


def _linhas_da_aba(caminho: Path, aba: str) -> list[tuple[object, ...]]:
    livro = openpyxl.load_workbook(caminho, data_only=True)
    linhas = [
        linha
        for linha in livro[aba].iter_rows(min_row=PRIMEIRA_LINHA_DE_DADO, values_only=True)
        if linha and linha[0] is not None
    ]
    livro.close()
    return linhas


# ── T-521 · o âncora do arquivo ───────────────────────────────────────────────


def test_as_cinco_abas_existem_com_os_nomes_do_gabarito(arquivo: Path) -> None:
    livro = openpyxl.load_workbook(arquivo)
    assert livro.sheetnames == [
        "Resumo Executivo",
        "Itens Críticos",
        "Divergências Maior Relevância",
        "Divergências",
        "Sem Divergência",
    ]
    livro.close()


@pytest.mark.parametrize("classificacao", list(Classificacao))
def test_t521_ancora_cada_aba_confere_com_o_gabarito(
    arquivo: Path, classificacao: Classificacao
) -> None:
    """Célula a célula, nas colunas que os dois lados têm.

    A descrição fica de fora: o gabarito traz descrição reescrita à mão
    (`ARMAZENAMENTO DE DADOS - NAS` contra a nossa `... - BAIXA PLATAFORMA - NAS`),
    enquanto a nossa vem do contrato por `R-CTR-03` — e chega a preservar o erro
    de digitação dele. Ajustar a nossa ao gabarito seria reescrever o contrato.
    """
    esperado = {
        item.codigo: (
            na_precisao_do_gabarito(item.contratado),
            na_precisao_do_gabarito(item.medido),
        )
        for item in ler_referencia(REFERENCIA)[classificacao]
        if item.codigo not in FORA_DA_COMPARACAO
    }

    obtido = {}
    for linha in _linhas_da_aba(arquivo, ABA_DA_CLASSIFICACAO[classificacao]):
        codigo = str(linha[0])
        if codigo in FORA_DA_COMPARACAO or codigo in FORA_DO_GABARITO:
            continue
        # As colunas numéricas não estão na mesma posição nas cinco abas: `Sem
        # Divergência` não tem saldo (`R-ANA-11`) e por isso tem duas colunas de
        # texto a menos. Localizar por **tipo** é o que sobrevive a isso — e as
        # únicas células numéricas da linha são as quantidades.
        numericas = [c for c in linha if isinstance(c, int | float | Decimal)]
        obtido[codigo] = (
            na_precisao_do_gabarito(Decimal(str(numericas[0]))),
            na_precisao_do_gabarito(Decimal(str(numericas[1]))),
        )

    assert obtido == esperado


def test_t811_a_grafia_da_planilha_e_a_do_relatorio(
    arquivo: Path, analise: AnaliseDaMedicao
) -> None:
    """`R-NUM-03` — o portão P1 da ESPEC 013, como teste permanente.

    Substitui a asserção que comparava a coluna de texto, removida por esta
    espec. A pergunta é a mesma: *a planilha exibe o mesmo que o documento
    formal?* — mudou o portador da resposta, de célula de texto para formato de
    célula.

    Contra o arranjo anterior este comparador acusava **141** divergências, todas
    inteiros grafados `4,00` onde o relatório grafa `4`.
    """
    divergencias = divergencias_de_grafia(arquivo, analise)
    assert divergencias == [], "\n".join(str(d) for d in divergencias)


def test_t811_os_dois_itens_de_referencia_saem_na_grafia_do_relatorio(arquivo: Path) -> None:
    """Os dois itens de referência, agora com **o mesmo** formato.

    Eram `MILHAR` e `SIMPLES`: o modelo grafava `1500` sem ponto, e o formato
    era atributo do item, vindo do catálogo. A ESPEC 018 `R-REL-09` uniformiza —
    o modelo deixou de ser o critério, e uma regra uniforme não tem como
    divergir de si mesma.
    """
    livro = openpyxl.load_workbook(arquivo)
    try:
        planilha = livro["Divergências"]
        cabecalho = [c.value for c in planilha[LINHA_DO_CABECALHO]]
        contratado = cabecalho.index("Contratado")

        por_codigo = {
            str(linha[0].value): linha[contratado]
            for linha in planilha.iter_rows(min_row=PRIMEIRA_LINHA_DE_DADO)
            if linha[0].value is not None
        }

        nas = por_codigo["14.024.00006.00"]
        assert texto_exibido(Decimal(str(nas.value)), nas.number_format) == "4.000"

        usuarios = por_codigo["14.023.00002.00"]
        assert texto_exibido(Decimal(str(usuarios.value)), usuarios.number_format) == "1.500"
        assert usuarios.number_format == nas.number_format
    finally:
        livro.close()


def _formatos_do_arquivo(arquivo: Path) -> set[str]:
    livro = openpyxl.load_workbook(arquivo)
    try:
        return {
            celula.number_format
            for aba in ABA_DA_CLASSIFICACAO.values()
            for linha in livro[aba].iter_rows(min_row=PRIMEIRA_LINHA_DE_DADO)
            if linha[0].value is not None
            for celula in linha
            if celula.data_type == "n"
        }
    finally:
        livro.close()


def test_t813_o_formato_e_um_so_no_arquivo_inteiro(arquivo: Path) -> None:
    """`R-REL-09` — o formato deixou de ser atributo do item.

    Este teste exigia o contrário: que `MILHAR` e `SIMPLES` **convivessem**,
    porque a grafia vinha do catálogo e o modelo era inconsistente — `1500` sem
    separador e `4.000` com, na mesma página.

    Sem catálogo não há de onde tirar a exceção, e a regra uniforme é a única
    que não tem como divergir de si mesma. O que sobra a exigir é que nenhuma
    célula use o formato simples, e que as duas precisões continuem existindo.
    """
    formatos = _formatos_do_arquivo(arquivo)

    assert formatos <= set(FORMATOS)
    assert FORMATO_SIMPLES_INTEIRO not in formatos
    assert {FORMATO_MILHAR_INTEIRO, FORMATO_MILHAR_DECIMAL} <= formatos


def test_t814_nenhum_formato_deixa_a_virgula_pendurada(arquivo: Path) -> None:
    """`R-NUM-08` — o defeito que a primeira versão desta espec introduziu.

    `#,##0.##` parece resolver os dois casos com um código só, e não resolve: o
    `#` omite o **dígito** ausente, mas o separador decimal é literal e fica.
    `10` saía `10,` na planilha aberta no Excel, contra o `10` do documento
    formal — em **52 das 56 linhas** do piloto, que é justamente a maioria que a
    escolha de `.##` pretendia servir.

    Nenhum teste percebeu porque o comparador de grafia repetia a suposição do
    renderizador. A asserção estrutural existe por isso: ela não depende de o
    comparador estar certo.
    """
    assert not any(".#" in formato for formato in _formatos_do_arquivo(arquivo))


def test_t812_o_caso_de_r_num_06_deixou_de_divergir(tmp_path: Path) -> None:
    """`R-NUM-06` foi **revogada** por `R-NUM-08`, não contornada.

    A divergência declarada era `4,50` saindo `4,5`: o `#` do formato omitia o
    zero à direita. Ela existia porque um código só tinha de servir a inteiros e
    a decimais, e `#` era o único jeito de omitir a casa. Com a escolha do código
    feita por célula, o valor decimal recebe `0.00` e não há o que omitir.

    O caso continua **construído** — as quatro quantidades com decimal do piloto
    são `117,29`, `121,29`, `3.265,64` e `762,55`, e nenhuma termina em zero na
    segunda casa. O que mudou é o veredito.
    """
    quantidade = Quantity(Decimal("4.50"), NumberFormat.MILHAR)

    assert quantidade.formatar() == "4,50"
    assert texto_exibido(quantidade.valor, FORMATO_MILHAR_DECIMAL) == "4,50"
    assert quantidade.valor == Decimal("4.50")


def test_t812_o_inteiro_sai_sem_a_virgula(tmp_path: Path) -> None:
    """`R-NUM-08` — o caso relatado, nas duas famílias de formato.

    É a asserção que fixa a paridade que a §2.5 da espec descreve: o inteiro
    grafa igual ao documento formal, e o decimal continua com as duas casas.
    """
    for formato in (NumberFormat.MILHAR, NumberFormat.SIMPLES):
        for valor in ("10", "1500", "4000", "0", "-4", "117.2889788312131", "4.50"):
            quantidade = Quantity(Decimal(valor), formato)
            exibido = texto_exibido(quantidade.valor, _formato_de(quantidade))
            assert exibido == quantidade.formatar(), f"{valor} em {formato.value}"


# ── T-518 · a quantidade também é número ──────────────────────────────────────


def test_t809_toda_quantidade_e_numero_em_todas_as_abas(arquivo: Path) -> None:
    """O defeito clássico do relatório em planilha — ESPEC 013 `R-NUM-01`.

    Uma coluna que **parece** número passa em qualquer conferência visual e falha
    na primeira vez que alguém a soma — e somar é exatamente o que se faz com uma
    análise de medição.

    Antes da ESPEC 013 este teste varria três colunas de seis, por índice fixo
    (`linha[5:8]`), e numa aba só. Agora localiza a quantidade **pelo cabeçalho**
    e cobre as quatro abas: passou de metade das células para todas elas.
    """
    livro = openpyxl.load_workbook(arquivo)
    try:
        for aba in ABA_DA_CLASSIFICACAO.values():
            planilha = livro[aba]
            cabecalho = [c.value for c in planilha[LINHA_DO_CABECALHO]]
            quantidades = [
                indice
                for indice, titulo in enumerate(cabecalho)
                if titulo in CABECALHOS_DE_QUANTIDADE
            ]
            assert quantidades, f"{aba}: nenhuma coluna de quantidade encontrada"

            for linha in planilha.iter_rows(min_row=PRIMEIRA_LINHA_DE_DADO):
                if linha[0].value is None:
                    continue
                for indice in quantidades:
                    celula = linha[indice]
                    assert celula.data_type == "n", (
                        f"{aba} · {linha[0].value}: {celula.coordinate} não é número"
                    )
    finally:
        livro.close()


def test_t810_a_celula_guarda_o_valor_cheio_e_exibe_o_arredondado(arquivo: Path) -> None:
    """`R-NUM-01` e `R-NUM-03` na mesma célula — ESPEC 013 §2.2.

    O `14.070.00001.00` é quem denuncia: a planilha de medição traz
    `117,2889788312131`, e o relatório grafa `117,29`. Antes da ESPEC 013 os dois
    moravam em colunas diferentes; agora moram na mesma célula — o valor no
    conteúdo, a grafia no formato.

    O teste afirma **os dois**. Só o valor deixaria passar um formato que exibe
    `117,2889788312131`; só o formato deixaria passar um `float`.
    """
    livro = openpyxl.load_workbook(arquivo)
    try:
        planilha = livro["Divergências"]
        cabecalho = [c.value for c in planilha[LINHA_DO_CABECALHO]]
        coluna_medido = cabecalho.index("Medido")

        celula = next(
            linha[coluna_medido]
            for linha in planilha.iter_rows(min_row=PRIMEIRA_LINHA_DE_DADO)
            if str(linha[0].value) == "14.070.00001.00"
        )

        assert Decimal(str(celula.value)) == Decimal("117.2889788312131")
        assert texto_exibido(Decimal(str(celula.value)), celula.number_format) == "117,29"
    finally:
        livro.close()


# ── T-519 · as marcas viajam dentro do arquivo ────────────────────────────────


def test_t519_a_aba_sem_divergencia_tem_as_colunas_do_gabarito(arquivo: Path) -> None:
    """`R-XLS-03` revisada — a coluna `Perfil ou pacote` saiu (ESPEC 009 §14).

    Ela era acréscimo nosso: o gabarito traz `Código`, `Descrição`, `Contratado`
    e `Medido`, e mais nada. A ressalva de `R-REC-04` continua na tela e na
    resposta da API, que é onde ela nasceu.

    **A asserção é de igualdade, não de ausência.** Afirmar só que
    `Perfil ou pacote` sumiu deixaria passar qualquer outra coluna nossa que
    entrasse depois — e é exatamente assim que a primeira apareceu.
    """
    livro = openpyxl.load_workbook(arquivo)
    try:
        cabecalho = [c.value for c in livro["Sem Divergência"][3] if c.value]
        assert cabecalho == ["Código", "Descrição", "Contratado", "Medido"]
    finally:
        livro.close()


def test_t519_o_arquivo_nao_diz_nada_sobre_perfil_ou_pacote(arquivo: Path) -> None:
    """A contrapartida da decisão, escrita para quem for reabrir o assunto.

    Cinco das dezenove linhas conformes entram como `1/1` por construção
    (`R-REC-04`), e uma delas é `14.048.00008.00` — contratado no perfil **D**,
    medido no perfil **C**. Ela agora está na aba `Sem Divergência` **sem
    nenhuma ressalva no arquivo**: quem conferir pelo XLSX sozinho não tem como
    saber que aquele `1 = 1` é convenção.

    Foi decisão consciente (ESPEC 009 §14) e este teste é o seu registro. Se um
    dia a marca voltar, é este teste que cai — e cai dizendo por quê.
    """
    linhas = _linhas_da_aba(arquivo, "Sem Divergência")
    perfil_d = [linha for linha in linhas if str(linha[0]) == "14.048.00008.00"]

    assert len(perfil_d) == 1
    assert len(perfil_d[0]) == 4
    assert perfil_d[0][2] == perfil_d[0][3] == 1


def test_t519_a_aba_de_criticos_sai_sem_dado_e_com_cabecalho(arquivo: Path) -> None:
    """`R-XLS-04` — a aba existe mesmo vazia, e é o resultado que se quer ler.

    Trazia o `14.049.00054.00`, marcado *"Sim — não consta no contrato"*. A ESPEC
    031 mostrou que o `2` que o punha ali vinha do bloco bruto de `E1.1`, e a aba
    ficou sem dado.

    **Sem linha, mas com aba**: quem abre a planilha tem de conseguir ler
    *"nenhum item crítico"*, e não descobrir que a aba sumiu. A marca de
    `R-XLS-04` continua no renderizador, exercitada por cenário construído.
    """
    assert _linhas_da_aba(arquivo, "Itens Críticos") == []


# ── Quadro-resumo ─────────────────────────────────────────────────────────────


def test_o_resumo_traz_as_quatro_situacoes_e_o_total(arquivo: Path) -> None:
    livro = openpyxl.load_workbook(arquivo)
    planilha = livro["Resumo Executivo"]

    quadro = {planilha[f"A{linha}"].value: planilha[f"B{linha}"].value for linha in range(7, 12)}
    # ESPEC 031 — 1 → 0 e 21 → 22: o `14.049.00054.00` deixou de ser crítico.
    assert quadro == {
        "Item crítico": 0,
        "Divergente de maior relevância": 20,
        "Divergente": 16,
        "Sem divergência": 22,
        "Total de itens analisados": 58,
    }
    # `R-RES-02` — o total é a soma das quatro, e isso fica visível na planilha.
    assert quadro["Total de itens analisados"] == sum(
        v for k, v in quadro.items() if k != "Total de itens analisados"
    )
    livro.close()


def test_a_identificacao_sai_do_dado_da_aplicacao(arquivo: Path) -> None:
    """PLANO 009 §6.2 — o `- TA 02` do gabarito não existe em fonte nenhuma."""
    livro = openpyxl.load_workbook(arquivo)
    planilha = livro["Resumo Executivo"]

    assert planilha["A2"].value == "Contrato : TC 52/SMIT/2024"
    assert planilha["A3"].value == "Proposta : PA-SMIT-260319-739"
    assert planilha["A4"].value == "Competência : julho/2026"
    livro.close()


# ── T-522 · determinismo ──────────────────────────────────────────────────────


def test_t522_duas_execucoes_produzem_o_mesmo_conteudo(
    analise: AnaliseDaMedicao, tmp_path: Path
) -> None:
    """Conteúdo de célula, não bytes.

    O pacote OOXML é um ZIP, e o `ZipInfo` que o `openpyxl` grava carrega o
    instante da escrita de cada entrada. As datas do documento estão fixadas
    (`CARIMBO`), mas as do ZIP não são acessíveis sem reescrever a serialização —
    e reescrevê-la para satisfazer um teste seria caro pelo motivo errado.
    """
    renderizador = XlsxAnaliseRenderer()
    primeiro = renderizador.renderizar(analise, tmp_path / "um.xlsx")
    segundo = renderizador.renderizar(analise, tmp_path / "dois.xlsx")

    for aba in ABA_DA_CLASSIFICACAO.values():
        assert _linhas_da_aba(primeiro, aba) == _linhas_da_aba(segundo, aba)


# ── T-554 · a aba vazia, que o piloto não produz ──────────────────────────────


def test_t554_situacao_sem_itens_ainda_produz_aba(tmp_path: Path) -> None:
    """Caso **construído**.

    Com o universo de `D-01` as quatro situações do piloto têm itens, então
    nenhum teste alimentado pelos arquivos reais percorre este caminho — que é,
    literalmente, o estado em que o gabarito entrega a aba `Itens Críticos`.
    """
    relatorio = Report(
        titulo="LEVANTAMENTO",
        data_levantamento=date(2026, 7, 15),
        contrato_referencia="TC 52/SMIT/2024",
        proposta_origem="PA-SMIT-260319-739",
    )
    relatorio.linhas.append(
        ReportLine(
            codigo=ServiceCode("12.030.00001.00"),
            descricao="CONEXÃO INTERNET",
            unidade="MBPS / MÊS",
            contratada=Quantity(Decimal(60)),
            medida=Quantity(Decimal(60)),
        )
    )

    destino = XlsxAnaliseRenderer().renderizar(
        AnaliseDaMedicao.de_relatorio(relatorio), tmp_path / "vazio.xlsx"
    )

    livro = openpyxl.load_workbook(destino)
    assert len(livro.sheetnames) == 5

    criticos = livro["Itens Críticos"]
    assert criticos["A1"].value.startswith("Item crítico")
    assert criticos["A3"].value == "Código"
    assert criticos["A4"].value is None  # cabeçalho sim, dado nenhum

    resumo = livro["Resumo Executivo"]
    assert resumo["B7"].value == 0
    assert resumo["B11"].value == 1
    livro.close()
