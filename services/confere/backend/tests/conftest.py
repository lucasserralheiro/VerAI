"""T-65 — Fixtures compartilhadas.

Os arquivos são abertos uma vez por sessão: o contrato tem 32 páginas e o
modelo 41, e reabri-los a cada teste dominaria o tempo da suíte.

A planilha aqui é a fixture **sanitizada** (T-05), sem as abas com dado pessoal.
Ela é gerada por ``scripts/sanitize_fixture.py`` a partir do arquivo íntegro,
que não é versionado.
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from datetime import date
from pathlib import Path

import pytest

from application.use_cases.generate_measurement_report import ReportResult
from domain.entities.annex import Anexo
from domain.entities.contract import Contract
from domain.entities.report import Report
from infrastructure.annex.anexo_reader import AnexoReader
from infrastructure.contract.pdfplumber_extractor import PdfPlumberContractExtractor
from infrastructure.di.container import DIContainer, Entradas

FIXTURES = Path(__file__).parent / "fixtures"


@pytest.fixture(scope="session")
def caminho_contrato() -> Path:
    return FIXTURES / "contrato.pdf"


@pytest.fixture(scope="session")
def caminho_contrato_pgm() -> Path:
    """Segundo contrato real — outro órgão, outra geometria de tabela (ESPEC 017).

    Existe porque a suíte rodava contra um PDF só e passava 100% enquanto o
    produto falhava em campo: o acoplamento à geometria do piloto é o que uma
    suíte de um-só-documento não tem como enxergar.
    """
    return FIXTURES / "contrato_pgm.pdf"


@pytest.fixture(scope="session")
def caminho_aditivo_pgm() -> Path:
    """O aditivo do `TC 015/PGM/2024` — `PA-PGM-260304-715` (ESPEC 019).

    Terceiro documento de contratação da suíte, e o primeiro que **não é uma
    proposta**. Traz três tabelas de itens em duas páginas, com três geometrias
    distintas, e nenhuma página com exatamente oito divisórias verticais.

    Antes da ESPEC 019 ele rendia **zero itens e nenhum erro**: `R-GRD-02`
    procurava por página, e a premissa *uma tabela de itens por página* só valia
    porque a amostra tinha propostas e nenhum aditivo (ESPEC 019 §2.3).
    """
    return FIXTURES / "aditivo_pgm.pdf"


@pytest.fixture(scope="session")
def caminho_aditivo_pgm_2() -> Path:
    """T-2223 / ESPEC 034 — o `PA-PGM-260818-201`, o **segundo** aditivo do PGM.

    Entra por uma razão só, e ela é a razão de a ESPEC 034 não ser uma correção
    para um documento: **ele também não deriva o órgão hoje, e não é do SMUL.**
    A capa dele escreve `prestação de serviços de sustentação de TIC para a
    Procuradoria…`, com o objeto entre `serviços` e `para a` — e `R-CAP-04`
    exigia os dois colados.

    Não tem par de levantamento e não rende itens (`geom=0`): serve à derivação
    da capa, e a nada mais.
    """
    return FIXTURES / "aditivo_pgm_2.pdf"


@pytest.fixture(scope="session")
def caminho_contrato_smul() -> Path:
    """T-2195 / ESPEC 033 — a proposta do `Contrato 17/2024-SMUL`.

    Terceiro órgão da suíte. Entra em par com o aditivo abaixo, e não sozinha:
    é ela que declara os `27.415.244,95` que o aditivo cita como *"valor inicial
    do contrato"* — conferência entre peças que não depende de código nenhum.
    """
    return FIXTURES / "contrato_smul.pdf"


@pytest.fixture(scope="session")
def caminho_aditivo_smul() -> Path:
    """T-2195 / ESPEC 033 — o `PA-SMUL-250314-22`, e por que ele está aqui.

    **O único documento do repositório com três tabelas de itens de larguras
    diferentes na mesma folha.** A página 4 traz `Inclusão`, `Redução` e
    `Aumento` — e o cronograma —, e as duas últimas têm uma divisória a mais,
    em `343,5`, porque o cabeçalho `PREÇO LISTA (R$)` quebra em três linhas e
    estreita a coluna.

    Antes da ESPEC 033 ele não era lido: a grade da `Inclusão` casava na folha
    inteira, por 0,6 pt de folga, e fatiava as linhas dos outros dois blocos com
    as colunas erradas. O `aditivo_pgm.pdf` também tem três tabelas, mas em
    páginas diferentes — e foi essa circunstância da amostra que sustentou a
    premissa *uma geometria por página* por três especs (ESPEC 033 §2.7).
    """
    return FIXTURES / "aditivo_smul.pdf"


@pytest.fixture(scope="session")
def caminho_contrato_cgm() -> Path:
    """T-2605 / ESPEC 040 — o `PC-CGM-240603-82`, e por que ele está aqui.

    Origem da mensagem que abriu a espec: `item 10.050.00001.00 (página 10) sem
    meses`. A tabela "5. PREÇO DOS SERVIÇOS" traz esse código duas vezes — uma
    com período `9`, outra com o período escrito por extenso, `2 meses e 14
    dias`, porque é a cauda de um contrato que não fecha em mês cheio.

    Continua bloqueando depois da correção — só que noutro código e por outro
    motivo (`I-04` da ESPEC): a página 10 também tem uma linha de escopo sem
    faixa própria de oito divisórias, lida pela geometria da tabela de preços
    via `R-FXA-04` (ESPEC 033). Este documento não é usado para provar que o
    relatório sai; é usado para provar que a mensagem original some e a
    prevista aparece no lugar dela.
    """
    return FIXTURES / "contrato_cgm.pdf"


@pytest.fixture(scope="session")
def caminho_aditivo_cgm() -> Path:
    """T-2671 / ESPEC 045 — o `PA-CGM-250912-127 v4.0`, e por que ele está aqui.

    Origem da mensagem: `item 14.049.00039.00 (página 4) sem quantidade`. A
    seção "5.4 Data Center" declara a ordem preço/quantidade/período **invertida**
    em relação a "5.2 Redes e Conectividades"/"5.3 Serviços de Comunicação" —
    mesma geometria, cabeçalho diferente. A maioria dos itens da seção passava
    calada, com preço e quantidade trocados; só `14.049.00039.00`, cujo período é
    escrito por extenso (`"2 meses e 16 dias"`), estourava.

    Com a ordem lida do cabeçalho, o documento extrai 27 itens e o checksum
    fecha em `R$ 6.110.655,79` — o valor que a peça declara em prosa e no
    cronograma físico-financeiro (ESPEC 042).
    """
    return FIXTURES / "aditivo_cgm.pdf"


@pytest.fixture(scope="session")
def caminho_levantamento() -> Path:
    return FIXTURES / "levantamento.xlsx"


@pytest.fixture(scope="session")
def caminho_levantamento_pgm() -> Path:
    """Levantamento do segundo par, sanitizado (ESPEC 018).

    Fecha o par que a ESPEC 017 deixou pela metade: havia o contrato do PGM na
    suíte, e não a medição correspondente. É nela que a `R-MED-02` estava
    desligada — 68 de 68 itens sem título de bloco (ESPEC 018 §2.8).
    """
    return FIXTURES / "levantamento_pgm.xlsx"


@pytest.fixture(scope="session")
def caminho_blocos_invertidos() -> Path:
    """`DESCONTANDO` **acima** do total cheio, com a faixa nas cinco colunas.

    O caso que nenhum dos dois pares reais exercita: neles o desconto vem por
    último, e é por isso que o atalho por posição acertava sem regra.
    """
    return FIXTURES / "levantamento_blocos_invertidos.xlsx"


@pytest.fixture(scope="session")
def caminho_sem_marca_de_desconto() -> Path:
    """Código repetido em dois blocos, nenhum com a marca — o caso da `V-MED-03`."""
    return FIXTURES / "levantamento_sem_marca_de_desconto.xlsx"


@pytest.fixture(scope="session")
def caminho_apuracao_incompleta() -> Path:
    """T-2139 / ESPEC 031 `R-APU-03` — a apuração descontada que omite um código.

    Bloco bruto com três códigos, descontado com dois. O `14.049.00092.00` está
    só em cima, com contratada `0` e medida `2`: descontado o desenvolvimento,
    ele mede zero, e quem montou a planilha expressou isso **apagando a linha**.

    É o piloto em miniatura — um código que encolhe (`…00090.00`, 4 → 2), um que
    não muda (`…00091.00`) e um que some. Gerada por
    `scripts/gerar_fixtures_desconto.py::gerar_apuracao_incompleta`.
    """
    return FIXTURES / "levantamento_apuracao_incompleta.xlsx"


@pytest.fixture(scope="session")
def caminho_codigos_deslocados() -> Path:
    """ESPEC 027 §2.3 — códigos de serviço na coluna H, fora das colunas lidas.

    Gerada por `scripts/gerar_fixture_deslocada.py` (T-2034). Zero itens saem
    da leitura, e o cabeçalho não traz data nem contrato de referência — é o
    cenário dos sessenta cartões da ESPEC 027 §2.1.
    """
    return FIXTURES / "levantamento_codigos_deslocados.xlsx"


@pytest.fixture(scope="session")
def caminho_amostra_sem_tabela() -> Path:
    """T-1926 / ESPEC 025 §2.5 — o degrau mais baixo da `R-DOC-03`.

    Uma folha, com texto, **sem** tabela de sete colunas e sem citar proposta
    nenhuma: é o PDF aleatório, onde o sistema não tem sinal positivo algum. A
    mensagem que sobra é a parte fixa, e é ela que a `D-06` afirma bastar.

    Copiado de `saida/`, que é diretório de trabalho: nada garante que um
    arquivo lá sobreviva a uma limpeza, e âncora não pode depender disso.
    """
    return FIXTURES / "amostra_sem_tabela.pdf"


@pytest.fixture(scope="session")
def caminho_modelo() -> Path:
    """Relatório GRC de referência — origem do teste-âncora (T-50)."""
    return FIXTURES / "modelo.pdf"


@pytest.fixture(scope="session")
def relatorio_vazio() -> Report:
    """Relatório sem seções — para testar a estrutura do documento isoladamente.

    A estrutura do DOCX (capa, seções, timbrado) não depende do conteúdo, e
    testá-la com um relatório real misturaria duas coisas que falham por motivos
    diferentes.
    """
    return Report(
        # T-1429 / ESPEC 020 — título **no padrão** e cliente derivado: com a capa
        # preenchida, esta fixture passou a ser o caso feliz. O caso da cascata
        # ganhou fixture própria, `relatorio_sem_capa_derivavel` (T-1430).
        titulo="LEVANTAMENTO - COMPROVAÇÃO SMIT SUSTENTAÇÃO - CATÁLOGO DE SERVIÇOS DIT",
        data_levantamento=date(2026, 7, 15),
        contrato_referencia="TC 52/SMIT/2024",
        proposta_origem="PA-SMIT-260319-739",
        propostas=("PA-SMIT-260319-739",),
        cliente="SECRETARIA MUNICIPAL DE INOVAÇÃO E TECNOLOGIA",
    )


@pytest.fixture(scope="session")
def relatorio_sem_capa_derivavel() -> Report:
    """T-1430 / ESPEC 020 `R-CAP-10` — o pior caso da cascata de `D-10`.

    Sem cliente e com título fora do padrão. Fixture **própria**, e não a
    `relatorio_vazio` reaproveitada: depois da T-1429 aquela é o caso feliz, e o
    caso de cascata perderia o seu exemplar — que é justamente o que a revisão da
    ESPEC 020 descobriu estar aberto.
    """
    return Report(
        titulo="LEVANTAMENTO - COMPROVAÇÃO",
        data_levantamento=None,
        contrato_referencia="TC 52/SMIT/2024",
        proposta_origem="PA-SMIT-260319-739",
    )


# ── O que é caro, e o que vale cachear ────────────────────────────────────────
#
# A suíte pedia uma geração completa do piloto por módulo — nove módulos
# reconstruindo o mesmo artefato. Cada etapa, cronometrada isoladamente:
#
#     renderizar DOCX com os 19 anexos   29,0 s
#     extrair contrato (32 páginas)       7,0 s
#     ler anexos (19 abas com estilos)    3,2 s
#     renderizar DOCX sem anexos          1,5 s
#     ler medição (`read_only`)           0,1 s
#
# Duas consequências para o desenho daqui:
#
# 1. O gargalo é **escrever** os anexos no DOCX, não lê-los. Por isso o
#    documento renderizado também entra em cache (`docx_do_piloto`) — é um
#    arquivo, ninguém o altera, e compartilhá-lo é seguro.
# 2. A medição fica fora do cache de propósito: 0,1 s não paga o risco descrito
#    em `FontesCaras`.
#
# A montagem do relatório em si é aritmética em memória e não aparece na medição.


@dataclass(frozen=True)
class FontesCaras:
    """O que se lê uma vez e se reaproveita entre módulos.

    A **medição fica fora de propósito**, e não por esquecimento: ela custa
    0,2 s, e `test_reconciliation` substitui um item dela no lugar para forçar
    uma divergência. Cacheá-la faria essa mutação vazar para os outros módulos,
    trocando dez minutos de lentidão por falha dependente de ordem — que é pior.

    O contrato e os anexos são seguros: nenhum teste os altera, e todo o
    conteúdo de `Anexo` é `frozen`.
    """

    contrato: Contract
    anexos: tuple[Anexo, ...]


@pytest.fixture(scope="session")
def fontes_caras(caminho_contrato: Path, caminho_levantamento: Path) -> FontesCaras:
    return FontesCaras(
        contrato=PdfPlumberContractExtractor().extrair(caminho_contrato),
        anexos=tuple(AnexoReader().ler(caminho_levantamento)),
    )


@pytest.fixture(scope="session")
def anexos_do_piloto(fontes_caras: FontesCaras) -> tuple[Anexo, ...]:
    """Os 19 anexos do piloto — para quem os quer sem passar pela geração."""
    return fontes_caras.anexos


@pytest.fixture(scope="session")
def contrato_do_piloto(fontes_caras: FontesCaras) -> Contract:
    """O contrato extraído — para quem exercita uma validação isolada.

    Só para leitura: são 7 s de extração compartilhados por toda a sessão.
    """
    return fontes_caras.contrato


class _ContratoEmCache:
    """`IContractExtractor` que devolve o contrato já extraído."""

    def __init__(self, contrato: Contract) -> None:
        self._contrato = contrato

    def extrair(self, caminho: Path) -> Contract:
        return self._contrato


class _AnexosEmCache:
    """`IAnnexReader` que devolve os anexos já lidos.

    Lista nova a cada chamada: o agregado guarda a que recebe, e um módulo que
    a esvazie não deve afetar o próximo.
    """

    def __init__(self, anexos: tuple[Anexo, ...]) -> None:
        self._anexos = anexos

    def ler(self, caminho: Path) -> list[Anexo]:
        return list(self._anexos)


class _ContainerComFontesEmCache(DIContainer):
    """O container real, com as duas leituras caras já resolvidas.

    Sobrescreve os dois *ports* pela via pública do container, e nada mais: a
    ordem das validações e o caso de uso continuam sendo os de
    produção. É o que mantém estes testes valendo como teste de integração.

    Os dois leitores substituídos têm cobertura própria — `test_extractor_contract`
    para o contrato e `test_docx_anexos` para os anexos.
    """

    def __init__(self, fontes: FontesCaras) -> None:
        super().__init__()
        self._fontes = fontes

    def extrator_de_contrato(self) -> _ContratoEmCache:  # type: ignore[override]
        return self._obter("contrato", lambda: _ContratoEmCache(self._fontes.contrato))

    def leitor_de_anexos(self) -> _AnexosEmCache:  # type: ignore[override]
        return self._obter("anexos", lambda: _AnexosEmCache(self._fontes.anexos))


@pytest.fixture(scope="session")
def gerar_piloto(
    fontes_caras: FontesCaras, caminho_contrato: Path, caminho_levantamento: Path
) -> Callable[..., ReportResult]:
    """Gera o relatório do piloto — completo, mas sem repagar as leituras caras.

    Devolve uma **fábrica**, não o resultado: cada chamada monta um `Report`
    novo. Um `Report` de sessão seria compartilhado, e ele é mutável — nas
    listas de linhas e no campo `anexos`, que `test_docx_formatacao` esvazia.
    """

    def _gerar() -> ReportResult:
        return _ContainerComFontesEmCache(fontes_caras).gerar(
            Entradas(
                contrato=caminho_contrato,
                levantamento=caminho_levantamento,
            )
        )

    return _gerar


@pytest.fixture(scope="session")
def docx_do_piloto(
    gerar_piloto: Callable[..., ReportResult], tmp_path_factory: pytest.TempPathFactory
) -> Path:
    """O DOCX completo do piloto — renderizado uma vez por sessão.

    São 29 s, a etapa mais cara da suíte, e vários módulos pediam exatamente
    este documento. É um arquivo pronto, e ninguém o altera: compartilhá-lo não
    tem o risco que o `Report` tem.

    Sem catálogo enviado — é assim que a aplicação roda.
    """
    from infrastructure.report.docx_renderer import DocxRenderer

    resultado = gerar_piloto()
    assert resultado.relatorio is not None, [a.mensagem for a in resultado.achados.bloqueantes]

    destino = tmp_path_factory.mktemp("piloto") / "relatorio.docx"
    return DocxRenderer().renderizar(resultado.relatorio, destino)


@pytest.fixture(scope="session")
def xlsx_da_analise_do_piloto(
    gerar_piloto: Callable[..., ReportResult], tmp_path_factory: pytest.TempPathFactory
) -> Path:
    """T-2022 — o segundo artefato do piloto, derivado do mesmo `Report`.

    É a mesma sequência de `_processar` em `api/routers/reports.py`: a análise é
    derivação do relatório já pronto, sem nenhuma leitura de arquivo a mais
    (`R-XLS-06`). Custa 0,1 s.
    """
    from domain.entities.analysis import AnaliseDaMedicao
    from infrastructure.report.xlsx_analise_renderer import XlsxAnaliseRenderer

    resultado = gerar_piloto()
    assert resultado.relatorio is not None

    destino = tmp_path_factory.mktemp("piloto-analise") / "analise.xlsx"
    analise = AnaliseDaMedicao.de_relatorio(resultado.relatorio)
    return XlsxAnaliseRenderer().renderizar(analise, destino)


@dataclass(frozen=True)
class ArtefatosDoPgm:
    """Os dois artefatos do PGM, de uma geração só.

    Juntos porque a geração é que é cara — ~19 s de extração e leitura —, e
    pedi-la duas vezes para tirar um `.docx` de uma e um `.xlsx` de outra seria
    pagar duas vezes pelo mesmo `Report`.
    """

    docx: Path
    xlsx: Path
    # T-2233 / ESPEC 034 — o `Report` que gerou os dois, exposto.
    #
    # Ele já era construído aqui e descartado. A régua de capa da ESPEC 034
    # precisa dos campos dele no par **com aditivo**, que é onde `propostas` tem
    # dois elementos — e pedir uma segunda geração custaria os ~115 s que esta
    # fixture existe para não pagar duas vezes.
    relatorio: Report


@pytest.fixture(scope="session")
def artefatos_do_pgm(
    tmp_path_factory: pytest.TempPathFactory,
    caminho_contrato_pgm: Path,
    caminho_aditivo_pgm: Path,
    caminho_levantamento_pgm: Path,
) -> ArtefatosDoPgm:
    """T-2001 — o DOCX do PGM **com aditivo**, renderizado uma vez por sessão.

    Veio de `test_capa.py`, onde nasceu com a ESPEC 020 e onde era invisível
    para os outros módulos: fixture de sessão declarada num arquivo de teste só
    vale dentro dele.

    São ~115 s — o par mais caro da suíte, com 3.462 linhas de anexo e 3.157
    mesclagens, contra 1.947 e 871 do piloto. Mudou de casa porque a `T-2021`
    precisa exatamente deste artefato, e uma fixture nova seria a **quarta**
    renderização de PGM da suíte.

    **Não é a mesma coisa que `test_linhas_derivadas.docx_do_pgm` nem que
    `test_anchor_por_codigo.pgm`**: aquelas duas são o documento *sem* aditivo,
    outro artefato e outras asserções. Unificá-las é `I-34` da ESPEC 026, e não
    se faz de passagem.

    Sem cache de fontes, ao contrário de `docx_do_piloto`: o `_ContainerComFontesEmCache`
    guarda o contrato e os anexos **do piloto**, e reaproveitá-lo aqui daria o
    documento errado em silêncio.
    """
    from domain.entities.analysis import AnaliseDaMedicao

    container = DIContainer()
    resultado = container.gerar(
        Entradas(
            contrato=caminho_contrato_pgm,
            levantamento=caminho_levantamento_pgm,
            aditivos=(caminho_aditivo_pgm,),
        )
    )
    assert resultado.relatorio is not None, [a.mensagem for a in resultado.achados.bloqueantes]

    destino = tmp_path_factory.mktemp("pgm")
    analise = AnaliseDaMedicao.de_relatorio(resultado.relatorio)
    return ArtefatosDoPgm(
        docx=container.renderizador().renderizar(resultado.relatorio, destino / "pgm.docx"),
        xlsx=container.renderizador_de_analise().renderizar(analise, destino / "analise.xlsx"),
        relatorio=resultado.relatorio,
    )


@pytest.fixture(scope="session")
def documento_do_pgm(artefatos_do_pgm: ArtefatosDoPgm) -> Path:
    """O `.docx` do PGM — o nome pelo qual `test_capa` e a `T-2021` o pedem."""
    return artefatos_do_pgm.docx


@pytest.fixture(scope="session")
def xlsx_da_analise_do_pgm(artefatos_do_pgm: ArtefatosDoPgm) -> Path:
    return artefatos_do_pgm.xlsx