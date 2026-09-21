"""T-1400 a T-1435 — A capa do documento (ESPEC 020).

Os instrumentos deste arquivo nascem **antes** do alvo, na ordem que a ESPEC 017
estabeleceu e a 019 confirmou: uma varredura escrita depois da correção mede a
correção, não o defeito.

**O piloto é o oráculo.** A capa correta dele já existe, gravada no modelo, e as
regras de derivação a reproduzem caractere por caractere. O PGM não tem oráculo —
nada independente diz que `PGM TC 015` é o subtítulo certo. O que ele prova é o
**negativo**: nenhuma cadeia do SMIT sobrou (ESPEC 020 §9.4).
"""

from __future__ import annotations

import hashlib
import re
import zipfile
from pathlib import Path
from typing import Any

import pytest

from domain.entities.report import Report
from infrastructure.di.container import DIContainer, Entradas
from infrastructure.report.modelo import (
    CADEIAS_DO_MODELO,
    CADEIAS_INSTITUCIONAIS,
    CAPA_CAIXAS_LOGICAS,
    CAPA_COPIAS_POR_CAIXA,
    CAPA_TEXTOS_POR_CAIXA,
    MODELO,
)

# T-1408 — a âncora da invariância do corpo, medida no documento do piloto
# **antes** de qualquer alteração do renderizador.
#
# Medida sobre a **fixture**, que é o que esta suíte gera — não sobre o arquivo de
# `docs/documentos/`. A primeira medição usou o original e deu 16.027 contra
# 16.028: a planilha sanitizada tem uma célula de texto a mais. É a lição da ESPEC
# 018 §14.2, e ela custa um número errado gravado num teste se for ignorada.
# **Reancorada pela ESPEC 024** — 2026-08-18. Era 16.028 textos e o `sha256`
# `a5c241f6…`. A âncora **fez o seu trabalho**: a espec acrescenta texto ao corpo
# de propósito (`R-NOT-01`, `R-NOT-02`), e ela acusou.
#
# O novo valor não foi colado da saída às cegas. Antes de trocá-lo, ficou provado
# que desfazer **apenas** as duas mudanças previstas — retirar a nota e tirar o
# asterisco do título — reproduz o `sha256` anterior caractere a caractere. É o
# que separa *reancorar* de *apagar a linha vermelha*: se qualquer outra célula
# das 16 mil tivesse se movido junto, a reversão não teria batido.
#
# `CORPO_DO_PILOTO_CODIGOS` **não muda**, e é a confirmação independente: a espec
# não acrescenta nem remove linha de item, só texto explicativo.
#
# **Reancorada pela ESPEC 028** — 2026-08-19, e de uma vez só. Esteve vermelha de
# propósito por um dia, com duas mudanças de documento em voo ao mesmo tempo:
#
#   1. a correção da ESPEC 024 v1.1 — o `*` inicial na nota de `R-NOT-02`, que
#      nascera sem o marcador que o título promete;
#   2. a ESPEC 028 `R-ZER-01` — o bloco final deixa de exibir a linha que a aba
#      zera nas duas colunas.
#
# Reancorar contra uma implementação em andamento gravaria o estado de meia hora
# daquela tarde (TASKS 026 §9.10), e por isso a troca esperou a árvore parar. Os
# **dois deltas foram provados em separado**, cada um desfazendo apenas a sua
# mudança e medindo o que sobra:
#
#     ancorado (sem `*`, sem 028) ....... 16.029 textos · 79 códigos · f549ca4c…
#     com o `*`, sem a 028 .............. 16.029 textos · 79 códigos · 797165ea…
#     com as duas — o valor abaixo ...... 16.017 textos · 76 códigos · b9d29dd9…
#
# A aritmética fecha nas duas contagens, e é ela que separa *reancorar* de *apagar
# a linha vermelha*: o `*` move **um** caractere de um `<w:t>` que já existia — os
# 16.029 não se mexem —, e a omissão tira 3 linhas do bloco final do piloto, que
# valem 12 textos (código, descrição, contratada e medida; a unidade sai vazia,
# porque no bloco final não há contrato de onde tirá-la) e 3 códigos.
#
# `CORPO_DO_PILOTO_CODIGOS` deixa de ser a confirmação de que nada some — passa a
# ser a **medida do que some de propósito**: 79 → 76, e 55 linhas de relatório em
# vez de 58. Quais são os três é `test_anchor_por_codigo` que afirma.
# T-2157 / ESPEC 031 — 16.017 → 16.006. **Onze textos, e os onze medidos por
# diferença de lista, não deduzidos** (T-2156): a faixa `DEMAIS ITENS DO
# LEVANTAMENTO*`, as 5 células do cabeçalho de colunas, as 4 da linha do
# `14.049.00054.00` — a unidade sai vazia no bloco final — e a nota do rodapé.
# **Nenhum texto entrou.**
#
# Não é uma linha a menos: é o **bloco final inteiro**. O `14.049.00054.00` era a
# única linha que a `R-ZER-01` ainda desenhava ali; zerado, o bloco esvazia e a
# `R-ZER-04` da ESPEC 028 apaga faixa, asterisco e nota. Primeiro caso real
# daquela regra (ESPEC 031 §2.7).
# T-2186 / ESPEC 032 — **os dois primeiros não mudam, e foi medido, não previsto.**
# A descrição sai num único `<w:t>`, então completá-la não acrescenta elemento
# nenhum: 16.006 antes e depois, 75 códigos antes e depois. Só o `sha256` se
# move, e ele acusa exatamente duas trocas — as duas descrições que a quebra de
# página cortava.
CORPO_DO_PILOTO_TEXTOS = 16_006
CORPO_DO_PILOTO_CODIGOS = 75  # 54 linhas do relatório + 21 nas tabelas de anexo
CORPO_DO_PILOTO_SHA256 = (
    "aaafd0a4b1c4182489bc5133d62398caa822a4ce89f69b603128134d80ef1c94"
)

# ── Leitura do pacote ─────────────────────────────────────────────────────────


def _caixas(caminho: Path) -> list[tuple[str, ...]]:
    """As seis caixas da capa, uma tupla de nós `<w:t>` por caixa.

    **Por `<w:t>`, e não por parágrafo.** Medido no modelo, os parágrafos por
    caixa são 3, 4 e 2 — a do contrato tem um vazio no meio, e na do rodapé o
    `GIO` e a proposta dividem o mesmo parágrafo em dois *runs*. Os nós `<w:t>`
    são três em todas as seis, e cada campo é um deles inteiro.
    """
    with zipfile.ZipFile(caminho) as pacote:
        xml = pacote.read("word/document.xml").decode("utf-8")

    return [
        tuple(re.findall(r"<w:t[^>]*>([^<]*)</w:t>", conteudo))
        for conteudo in re.findall(r"<w:txbxContent>(.*?)</w:txbxContent>", xml, re.S)
    ]


def _campo(caminho: Path, posicao: tuple[int, int]) -> str:
    """O texto de um campo da capa, lido da **primeira** cópia da caixa lógica."""
    caixa, indice = posicao
    return _caixas(caminho)[caixa * CAPA_COPIAS_POR_CAIXA][indice]


def _texto_fora_da_capa(caminho: Path) -> list[str]:
    """Todo `<w:t>` que **não** está dentro de uma caixa de texto.

    É o corpo do documento — título, tabela, bloco final e anexos.
    """
    with zipfile.ZipFile(caminho) as pacote:
        xml = pacote.read("word/document.xml").decode("utf-8")
    sem_caixas = re.sub(r"<w:txbxContent>.*?</w:txbxContent>", "", xml, flags=re.S)
    return re.findall(r"<w:t[^>]*>([^<]*)</w:t>", sem_caixas)


def _ocorrencias_no_pacote(caminho: Path, cadeia: str) -> int:
    total = 0
    with zipfile.ZipFile(caminho) as pacote:
        for nome in pacote.namelist():
            try:
                conteudo = pacote.read(nome).decode("utf-8")
            except UnicodeDecodeError:
                continue
            total += conteudo.count(cadeia)
    return total


# ── Os documentos, gerados uma vez por sessão ─────────────────────────────────


def _gerar(container: DIContainer, entradas: Entradas, destino: Path) -> Path:
    resultado = container.gerar(entradas)
    assert resultado.relatorio is not None, resultado.achados.bloqueantes
    return container.renderizador().renderizar(resultado.relatorio, destino)


@pytest.fixture(scope="session")
def documento_do_piloto(
    tmp_path_factory: pytest.TempPathFactory,
    caminho_contrato: Path,
    caminho_levantamento: Path,
) -> Path:
    destino = tmp_path_factory.mktemp("capa-piloto") / "piloto.docx"
    return _gerar(
        DIContainer(),
        Entradas(contrato=caminho_contrato, levantamento=caminho_levantamento),
        destino,
    )


# T-2001 / ESPEC 026 — `documento_do_pgm` mudou de casa: vive no `conftest.py`,
# ao lado de `docx_do_piloto`, porque a `T-2021` precisa dela e uma fixture de
# sessão declarada num módulo de teste só é visível dentro dele. O corpo é o
# mesmo; nada aqui mudou além do lugar de onde ela vem.


# ── T-1401 · a lista é necessária e suficiente `[portão P0]` ──────────────────


def test_t1401_a_lista_cobre_todo_o_residuo_do_modelo() -> None:
    """**Suficiente** — as cinco cadeias cobrem as 12 ocorrências de `SMIT`.

    Se sobrar uma menção que a lista não alcança, a varredura ficaria verde com
    resíduo no documento.
    """
    with zipfile.ZipFile(MODELO) as pacote:
        xml = pacote.read("word/document.xml").decode("utf-8")

    assert xml.count("SMIT") == 12

    restante = xml
    for cadeia in CADEIAS_DO_MODELO:
        restante = restante.replace(cadeia, "")
    assert "SMIT" not in restante


def test_t1401_a_lista_nao_casa_dado_legitimo_do_cliente(documento_do_pgm: Path) -> None:
    """**Necessária** — e é a asserção que torna o critério atingível.

    O documento do PGM contém `SMIT`, e **corretamente**: a aba `NAS` do
    levantamento que o cliente enviou traz a palavra numa célula, e ela vira linha
    de anexo. Um critério escrito sobre a palavra nunca ficaria verde.

    Aqui se afirma o que interessa de verdade: *nada do contrato do SMIT vaza para
    o documento do PGM*. A diferença entre as duas frases é uma célula de planilha.
    """
    with zipfile.ZipFile(documento_do_pgm) as pacote:
        xml = pacote.read("word/document.xml").decode("utf-8")

    assert "SMIT" in xml, "a aba NAS do PGM traz a palavra; se sumiu, o anexo mudou"

    legitimas = xml
    for cadeia in CADEIAS_DO_MODELO:
        legitimas = legitimas.replace(cadeia, "")
    assert legitimas.count("SMIT") == 1


# ── T-1403 · a varredura ──────────────────────────────────────────────────────


def test_t1403_o_documento_do_pgm_nao_traz_nada_do_smit(documento_do_pgm: Path) -> None:
    """`R-CAP-09` — o critério de aceite da ESPEC 020 §9.3.

    **A varredura é assimétrica, e tem de ser.** As cadeias do modelo são resíduo
    no documento do PGM e são a **resposta certa** no do piloto: `SMIT SUSTENTAÇÃO`
    e `PA-SMIT-260319-739` são os dados verdadeiros daquele contrato, e a derivação
    os reproduz. Aplicar a mesma lista aos dois reprovaria o comportamento correto
    — é a mesma armadilha da palavra `SMIT`, um grau mais fina.

    O que a regra afirma é *nada de **outro** contrato sobrevive aqui*.

    Sobre o **pacote**, e não sobre a capa: `mc:AlternateContent` guarda uma
    representação que uma leitura por `w:txbxContent` pode não estar olhando.
    Nominal por cadeia, e não por contagem: um teste que afirme *"12 ocorrências"*
    fica verde no dia em que alguém preencher quatro campos e esquecer o quinto, se
    outro passar a aparecer duas vezes.
    """
    sobreviventes = {
        cadeia: _ocorrencias_no_pacote(documento_do_pgm, cadeia)
        for cadeia in CADEIAS_DO_MODELO
        if _ocorrencias_no_pacote(documento_do_pgm, cadeia)
    }
    assert sobreviventes == {}


def test_t1405_o_documento_do_piloto_nao_traz_nada_do_pgm(
    documento_do_piloto: Path,
) -> None:
    """O simétrico — impede "resolver" o problema escrevendo o PGM no modelo."""
    for cadeia in ("PROCURADORIA GERAL", "TC 015/PGM/2024", "PA-PGM-"):
        assert _ocorrencias_no_pacote(documento_do_piloto, cadeia) == 0


# ── T-1406 · a estrutura que `D-09` pressupõe `[portão P4]` ───────────────────


@pytest.mark.parametrize("origem", ["modelo", "piloto", "pgm"])
def test_t1406_a_estrutura_da_capa_nao_muda(
    origem: str, documento_do_piloto: Path, documento_do_pgm: Path
) -> None:
    """Seis blocos de três parágrafos — três caixas lógicas, cada uma duplicada.

    Parece decorativo e é o que sustenta a `D-09`: endereçar campo por
    `(caixa, parágrafo)` só é seguro enquanto a forma for essa. Um modelo novo com
    outra estrutura acusa aqui, antes de o endereçamento escrever no lugar errado.
    """
    caminho = {
        "modelo": MODELO,
        "piloto": documento_do_piloto,
        "pgm": documento_do_pgm,
    }[origem]

    caixas = _caixas(caminho)
    assert len(caixas) == CAPA_CAIXAS_LOGICAS * CAPA_COPIAS_POR_CAIXA
    assert all(len(caixa) == CAPA_TEXTOS_POR_CAIXA for caixa in caixas)


# ── T-1407 · o delta sancionado da capa do piloto `[portão P2]` ───────────────
#
# Os valores esperados são **transcritos do modelo à mão**, nunca copiados da
# saída do código: um teste que compare o programa consigo mesmo não mede nada.

DELTA_IDENTICO = ((0, 0), (0, 1), (0, 2), (2, 0), (2, 1), (2, 2))
DELTA_MUDADO = {
    (1, 0): "Contrato : TC 52/SMIT/2024",
    (1, 1): "Proposta : PA-SMIT-260319-739",
    (1, 2): "",
}


@pytest.mark.parametrize("posicao", DELTA_IDENTICO)
def test_t1407_os_seis_paragrafos_que_nao_se_movem(
    posicao: tuple[int, int], documento_do_piloto: Path
) -> None:
    """ESPEC 020 §9.1, categoria **sancionado** — a metade que não muda.

    Inclui o cliente e o subtítulo, que saem por **derivação** e mesmo assim
    reproduzem o modelo caractere por caractere. É o oráculo de `D-05`.
    """
    assert _campo(documento_do_piloto, posicao) == _campo(MODELO, posicao)


@pytest.mark.parametrize(("posicao", "esperado"), sorted(DELTA_MUDADO.items()))
def test_t1407_os_tres_paragrafos_que_mudam(
    posicao: tuple[int, int], esperado: str, documento_do_piloto: Path
) -> None:
    """A metade que muda, e **exatamente assim**.

    São o custo que `D-03` e `D-04` declaram — o ` - TA 02` e a pilha histórica —,
    aqui convertido de prosa em asserção. Custo declarado num texto de decisão não
    é custo verificado: sem esta lista, quem vir a capa do piloto diferente não
    consegue distinguir *era esperado* de *quebrou*.
    """
    assert _campo(documento_do_piloto, posicao) == esperado
    assert _campo(documento_do_piloto, posicao) != _campo(MODELO, posicao)


# ── T-1408 · a invariância do corpo `[portão P4]` ─────────────────────────────


def test_t1408_o_corpo_do_documento_nao_se_move(documento_do_piloto: Path) -> None:
    """Fora das caixas da capa, o texto do piloto é o de sempre.

    Cinto de uma linha: nada na suíte afirma isso hoje, e esta espec abre o
    renderizador. Pega edição acidental no corpo enquanto o arquivo está aberto —
    o risco que a ESPEC 018 `D-10` tratou como prioridade.

    Os três números foram medidos **antes** de o renderizador ser tocado, e estão
    registrados como constante. O `sha256` é o que torna a asserção total: um
    caractere que mude em qualquer das 16 mil células o derruba.
    """
    fora = _texto_fora_da_capa(documento_do_piloto)

    assert len(fora) == CORPO_DO_PILOTO_TEXTOS
    codigo = re.compile(r"^\d{2}\.\d{3}\.\d{5}\.\d{2}$")
    assert sum(1 for t in fora if codigo.match(t.strip())) == CORPO_DO_PILOTO_CODIGOS
    assert hashlib.sha256("\0".join(fora).encode()).hexdigest() == CORPO_DO_PILOTO_SHA256

    # E nenhum texto da capa vazou para o corpo.
    for cadeia in CADEIAS_INSTITUCIONAIS:
        assert cadeia not in fora


# ── T-1418 · os dois separadores da sigla `[risco]` ───────────────────────────


@pytest.mark.parametrize(
    ("caminho", "esperado"),
    [
        ("caminho_contrato", "SECRETARIA MUNICIPAL DE INOVAÇÃO E TECNOLOGIA"),
        ("caminho_contrato_pgm", "PROCURADORIA GERAL DO MUNICÍPIO DE SÃO PAULO"),
    ],
)
def test_t1418_o_cliente_sai_sem_a_sigla_nos_dois_separadores(
    caminho: str, esperado: str, request: pytest.FixtureRequest
) -> None:
    """`R-CAP-04` — e o separador **não é o mesmo** nos dois documentos.

    ```
    SMIT:  'Secretaria Municipal de Inovação e Tecnologia- SMIT'   ← sem espaço
    PGM:   'Procuradoria Geral do Município de São Paulo - PGM'    ← com espaço
    ```

    Um `rsplit(" - ")` — a leitura natural de *"sem a sigla"* — passa no PGM e
    **falha no piloto**, deixando `TECNOLOGIA- SMIT` na capa. E falha no par cuja
    capa correta já se conhece, onde ninguém olharia duas vezes.
    """
    from infrastructure.contract.pdfplumber_extractor import PdfPlumberContractExtractor

    contrato = PdfPlumberContractExtractor().extrair(request.getfixturevalue(caminho))
    assert contrato.cliente == esperado


def test_t1418_o_aditivo_nao_traz_a_frase(caminho_aditivo_pgm: Path) -> None:
    """E é indiferente: o cliente vem da **proposta**, nunca do aditivo."""
    from infrastructure.contract.pdfplumber_extractor import PdfPlumberContractExtractor

    assert PdfPlumberContractExtractor().extrair(caminho_aditivo_pgm).cliente == ""


# ── T-1421 · o cliente sobrevive à consolidação `[risco]` ─────────────────────


def test_t1421_o_cliente_sobrevive_ao_aditivo(
    caminho_contrato_pgm: Path, caminho_aditivo_pgm: Path
) -> None:
    """T-1420 — `aplicar` monta um `Contract` novo a partir de campos fixos.

    Um campo que não entre nessa lista **some em silêncio, e só no caminho com
    aditivo** — que é o do PGM, que é o motivo de a ESPEC 020 existir.
    """
    from infrastructure.contract.pdfplumber_extractor import PdfPlumberContractExtractor

    extrator = PdfPlumberContractExtractor()
    proposta = extrator.extrair(caminho_contrato_pgm)
    aditivo = extrator.extrair(caminho_aditivo_pgm)

    assert proposta.aplicar([aditivo]).cliente == proposta.cliente
    assert proposta.aplicar([aditivo]).cliente != ""


# ── T-1423 · a cascata de `D-10` ──────────────────────────────────────────────


def _relatorio(**campos: Any) -> Report:
    base: dict[str, Any] = {
        "titulo": "LEVANTAMENTO - COMPROVAÇÃO SMIT SUSTENTAÇÃO - CATÁLOGO DE SERVIÇOS DIT",
        "data_levantamento": None,
        "contrato_referencia": "TC 52/SMIT/2024",
        "proposta_origem": "PA-SMIT-260319-739",
        "propostas": ("PA-SMIT-260319-739",),
        "cliente": "SECRETARIA MUNICIPAL DE INOVAÇÃO E TECNOLOGIA",
    }
    return Report(**{**base, **campos})


def test_t1423_com_tudo_derivado_a_cascata_nao_atua() -> None:
    relatorio = _relatorio()
    assert relatorio.cliente_da_capa == "SECRETARIA MUNICIPAL DE INOVAÇÃO E TECNOLOGIA"
    assert relatorio.subtitulo_da_capa == "SMIT SUSTENTAÇÃO"


def test_t1423_sem_cliente_cai_para_o_subtitulo() -> None:
    assert _relatorio(cliente="").cliente_da_capa == "SMIT SUSTENTAÇÃO"


def test_t1423_sem_titulo_no_padrao_cai_para_o_contrato() -> None:
    """O caso que a revisão da espec descobriu aberto.

    A fixture `relatorio_vazio` da própria suíte tem `titulo` fora do padrão. Sem
    este degrau, o cliente cairia num vazio e a linha mais visível da capa ficaria
    em branco.
    """
    relatorio = _relatorio(cliente="", titulo="LEVANTAMENTO - COMPROVAÇÃO")
    assert relatorio.subtitulo_da_capa == "TC 52/SMIT/2024"
    assert relatorio.cliente_da_capa == "TC 52/SMIT/2024"


def test_t1430_a_cascata_no_documento_gerado(
    relatorio_sem_capa_derivavel: Report, tmp_path: Path
) -> None:
    """T-1430 — a cascata sob prova **no DOCX**, e não só no agregado.

    A fixture é própria porque a `relatorio_vazio` passou a ser o caso feliz
    (T-1429). Sem ela o pior caminho de `D-10` perderia o seu exemplar — que é
    justamente o que a revisão da ESPEC 020 descobriu estar aberto.
    """
    from infrastructure.report.docx_renderer import DocxRenderer
    from infrastructure.report.modelo import CAPA_CLIENTE, CAPA_SUBTITULO

    destino = DocxRenderer().renderizar(relatorio_sem_capa_derivavel, tmp_path / "c.docx")

    assert _campo(destino, CAPA_CLIENTE) == "TC 52/SMIT/2024"
    assert _campo(destino, CAPA_SUBTITULO) == "TC 52/SMIT/2024"


def test_t1423_nenhum_campo_da_capa_sai_vazio() -> None:
    """`R-CAP-10` — o invariante da cascata, sobre o pior caso possível."""
    relatorio = _relatorio(cliente="", titulo="", propostas=())
    assert relatorio.cliente_da_capa
    assert relatorio.subtitulo_da_capa
    assert relatorio.propostas_da_capa


# ── T-1425 · `V-CAP-01` ───────────────────────────────────────────────────────


def test_t1425_v_cap_01_avisa_sem_cliente() -> None:
    from domain.entities.contract import Contract
    from domain.entities.validation_finding import ValidationReport
    from infrastructure.validations.contract_validations import (
        v_cap_01_cliente_nao_derivado,
    )

    achados = ValidationReport()
    v_cap_01_cliente_nao_derivado(Contract(proposta="PA-X"), achados)

    assert not achados.bloqueado
    assert [a.validacao for a in achados.avisos] == ["V-CAP-01"]


@pytest.mark.parametrize("caminho", ["caminho_contrato", "caminho_contrato_pgm"])
def test_t1425_v_cap_01_nao_dispara_nos_dois_pares(
    caminho: str, request: pytest.FixtureRequest
) -> None:
    from domain.entities.validation_finding import ValidationReport
    from infrastructure.contract.pdfplumber_extractor import PdfPlumberContractExtractor
    from infrastructure.validations.contract_validations import (
        v_cap_01_cliente_nao_derivado,
    )

    contrato = PdfPlumberContractExtractor().extrair(request.getfixturevalue(caminho))
    achados = ValidationReport()
    v_cap_01_cliente_nao_derivado(contrato, achados)

    assert achados.avisos == []


# ── T-1426 · o teste-oráculo `[portão P2]` ────────────────────────────────────


def test_t1426_a_derivacao_reproduz_a_capa_do_modelo(documento_do_piloto: Path) -> None:
    """**O portão mais forte desta entrega, e custa três linhas.**

    A capa correta do piloto já existe, escrita por quem sabia o que devia estar
    lá. Se a derivação a reproduz caractere por caractere, ela está certa — não
    *provavelmente certa*. Mesma natureza da T-1112 da ESPEC 017, que exigiu
    igualdade e não equivalência.

    É prova **externa**: o resultado é conferido contra algo que este código não
    produziu. O PGM não tem equivalente (ESPEC 020 §9.4).
    """
    from infrastructure.report.modelo import CAPA_CLIENTE, CAPA_SUBTITULO

    assert _campo(documento_do_piloto, CAPA_CLIENTE) == (
        "SECRETARIA MUNICIPAL DE INOVAÇÃO E TECNOLOGIA"
    )
    assert _campo(documento_do_piloto, CAPA_SUBTITULO) == "SMIT SUSTENTAÇÃO"


# ── T-1431 · a capa do PGM ────────────────────────────────────────────────────


def test_t1431_a_capa_do_pgm(documento_do_pgm: Path) -> None:
    """**Conferência, não prova.**

    Nada independente diz que `PGM TC 015` é o subtítulo certo, ou que o cliente
    deva ser o nome formal em vez da sigla. Este teste guarda a **estabilidade**
    desses valores; o oráculo do PGM é humano, e está no insumo `K-20`.
    """
    from infrastructure.report.modelo import (
        CAPA_CLIENTE,
        CAPA_CONTRATO,
        CAPA_PROPOSTAS,
        CAPA_PROPOSTAS_CONTINUACAO,
        CAPA_PROPOSTAS_RODAPE,
        CAPA_SUBTITULO,
    )

    esperado = {
        CAPA_CLIENTE: "PROCURADORIA GERAL DO MUNICÍPIO DE SÃO PAULO",
        CAPA_SUBTITULO: "PGM TC 015",
        CAPA_CONTRATO: "Contrato : TC 015/PGM/2024",
        CAPA_PROPOSTAS: "Proposta : PA-PGM-251015-159 / PA-PGM-260304-715",
        CAPA_PROPOSTAS_CONTINUACAO: "",
        CAPA_PROPOSTAS_RODAPE: "PA-PGM-251015-159 / PA-PGM-260304-715",
    }
    obtido = {posicao: _campo(documento_do_pgm, posicao) for posicao in esperado}
    assert obtido == esperado


@pytest.mark.parametrize("par", ["piloto", "pgm"])
def test_t1431_os_textos_da_prodam_ficam(
    par: str, documento_do_piloto: Path, documento_do_pgm: Path
) -> None:
    """`R-CAP-08` — identificam a PRODAM, não o cliente, e não são tocados."""
    from infrastructure.report.modelo import CAPA_FIXAS

    documento = {"piloto": documento_do_piloto, "pgm": documento_do_pgm}[par]
    for posicao in CAPA_FIXAS:
        assert _campo(documento, posicao) == _campo(MODELO, posicao)


# ── T-1410 · o escape `[risco]` ───────────────────────────────────────────────


def test_t1410_nome_com_caractere_de_marcacao_nao_quebra_o_pacote(
    tmp_path: Path,
) -> None:
    """Um `&` cru no `<w:t>` produz XML inválido e o **Word recusa o arquivo**.

    Falha total, num caminho que só aparece com um cliente cujo nome o tenha. O
    `lxml` escapa ao atribuir `.text`; este teste é o que prova que ninguém trocou
    a atribuição por concatenação de cadeia.
    """
    import docx

    from infrastructure.report.docx_renderer import DocxRenderer
    from infrastructure.report.modelo import CAPA_CLIENTE

    relatorio = _relatorio(cliente="SECRETARIA DE A & B <TESTE>")
    destino = DocxRenderer().renderizar(relatorio, tmp_path / "escape.docx")

    docx.Document(str(destino))  # reabre: o pacote continua válido
    assert _campo(destino, CAPA_CLIENTE) == "SECRETARIA DE A &amp; B &lt;TESTE&gt;"
