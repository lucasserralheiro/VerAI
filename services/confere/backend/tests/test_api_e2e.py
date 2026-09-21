"""T-58 — Teste de ponta a ponta pela API.

Os dois arquivos entram por HTTP e o documento sai. As asserções cobrem também
os caminhos de erro: o requisito é que entrada inválida produza mensagem clara e
**nenhum documento**.
"""

from __future__ import annotations

import base64
import io
import re
import zipfile
from pathlib import Path

import docx
import pytest
from fastapi.testclient import TestClient

from api.main import app


def ler_docx_de_bytes(conteudo: bytes) -> list[list[str]]:
    """Linhas de item do documento, direto dos bytes da resposta."""
    codigo = re.compile(r"^\d{2}\.\d{3}\.\d{5}\.\d{2}$")
    documento = docx.Document(io.BytesIO(conteudo))
    return [
        [c.text.strip() for c in fileira.cells]
        for tabela in documento.tables
        for fileira in tabela.rows
        if codigo.match(fileira.cells[0].text.strip())
    ]


@pytest.fixture(scope="module")
def cliente() -> TestClient:
    return TestClient(app)


XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


def _envio(
    contrato: Path, levantamento: Path
) -> dict[str, tuple[str, bytes, str]]:
    arquivos = {
        "contrato": ("contrato.pdf", contrato.read_bytes(), "application/pdf"),
        "levantamento": ("levantamento.xlsx", levantamento.read_bytes(), XLSX),
    }
    return arquivos


@pytest.fixture(scope="module")
def resposta_do_piloto(
    cliente: TestClient, caminho_contrato: Path, caminho_levantamento: Path
) -> dict:
    """O caminho feliz, requisitado **uma vez** para todo o módulo.

    Sem catálogo: ele é embutido na aplicação (ESPEC 001 Anexo B, revisão 14).

    Cada `POST /reports` custa ~40 s, dos quais 29 s são a renderização dos
    anexos no DOCX. Sete testes deste módulo faziam esta mesma requisição, com
    os mesmos arquivos, para conferir partes diferentes da mesma resposta —
    quatro minutos gastos em reproduzir um resultado idêntico. Conferir sete
    aspectos de uma resposta não exige sete respostas.

    Os testes de **bloqueio** continuam com requisição própria: a carga é outra,
    e é o código de status que está sob teste.
    """
    resposta = cliente.post("/reports", files=_envio(caminho_contrato, caminho_levantamento))

    assert resposta.status_code == 200, resposta.text
    return resposta.json()


# ── Caminho feliz ─────────────────────────────────────────────────────────────


def test_dois_arquivos_entram_e_o_relatorio_sai(resposta_do_piloto: dict) -> None:
    corpo = resposta_do_piloto
    assert corpo["total_linhas"] == 58
    assert corpo["contrato_referencia"] == "TC 52/SMIT/2024"
    assert corpo["data_levantamento"] == "15/07/2026"


def test_o_documento_embutido_decodifica_para_um_docx_valido(resposta_do_piloto: dict) -> None:
    """ESPEC 003 — o entregável passou de PDF para DOCX."""
    conteudo = base64.b64decode(resposta_do_piloto["docx_base64"])

    # Um DOCX é um pacote ZIP; a assinatura é a do ZIP.
    assert conteudo.startswith(b"PK\x03\x04")

    with zipfile.ZipFile(io.BytesIO(conteudo)) as pacote:
        nomes = pacote.namelist()
    assert "word/document.xml" in nomes
    # As fontes e as imagens do modelo acompanham o documento (R-DOC-01).
    assert sum(1 for n in nomes if "fonts/" in n) == 7
    # Três do modelo (`R-DOC-01`) mais as duas figuras coladas nas abas
    # `Internet` e `ServicosEmNuvem` (ESPEC 004). As do modelo continuam lá: o
    # documento nasce de uma cópia dele, e nada aqui as remove.
    assert sum(1 for n in nomes if "media/" in n) == 3 + 2

    documento = docx.Document(io.BytesIO(conteudo))
    # Capa, tabela de comprovação e um anexo de detalhamento cada (ESPEC 004).
    assert len(documento.sections) == 2 + 19
    # ESPEC 028 `R-ZER-01` + ESPEC 031 `R-APU-03` — 54, e não 58: o bloco final
    # do piloto **esvaziou**. Eram três linhas zeradas nas duas colunas; a
    # quarta, o `14.049.00054.00`, media 2 por artefato de leitura e passou a
    # medir 0. Sem linha exibida, a `R-ZER-04` apaga faixa, asterisco e nota.
    #
    # **O par com `total_linhas == 58`, no teste do caminho feliz acima, é a
    # `R-ZER-05` afirmada por dois testes do mesmo módulo**: a resposta da API
    # continua contando 58 linhas enquanto o documento que ela carrega desenha
    # 55. Se algum dia os dois números voltarem a ser iguais, ou a omissão vazou
    # para o `Report`, ou ela sumiu do documento.
    assert len(ler_docx_de_bytes(conteudo)) == 54


def test_a_resposta_traz_o_grid_de_divergencias(resposta_do_piloto: dict) -> None:
    """ESPEC 018 — 37 divergências numa lista, e não 36 em 16 seções.

    O campo `secoes` deu lugar a `divergencias`: o documento perdeu o
    agrupamento (`R-REL-05`) e o grid o acompanha.
    """
    corpo = resposta_do_piloto

    assert corpo["total_divergencias"] == 36

    linhas = corpo["divergencias"]
    assert len(linhas) == 36
    # `sem_previsao_contratual` entrou com a ESPEC 009 (`R-API-02`): campo
    # aditivo, com padrão `false`, que permite a mesma `LinhaDoGrid` servir ao
    # grid e às quatro situações da análise. A asserção continua sendo de
    # **conjunto exato** de propósito — é ela que faz um campo novo aparecer na
    # revisão em vez de entrar despercebido no contrato da API.
    assert set(linhas[0]) == {
        "codigo",
        "descricao",
        "unidade",
        "contratada",
        "medida",
        "saldo",
        "perfil_ou_pacote",
        "sem_previsao_contratual",
    }
    # As quantidades chegam formatadas, idênticas às do PDF (R-DIV-02).
    assert any(linha["contratada"] == "4.000" for linha in linhas)
    # `R-REL-09` — o separador de milhar passou a ser sempre; era `1500`.
    assert any(linha["contratada"] == "1.500" for linha in linhas)

    # R-DIV-08 — o saldo acompanha a formatação do item.
    san = next(linha for linha in linhas if linha["codigo"] == "14.024.00005.00")
    assert (san["contratada"], san["medida"], san["saldo"]) == ("3.500", "762,55", "2.737,45")

    # `D-06` — o que só a aba conhece deixou de ser omitido do documento e passa
    # a sair no bloco final. São quatro no piloto, e um deles é o consumo sem
    # cobertura contratual que a `R-REC-01` escondia.
    fora = corpo["demais_itens"]
    assert len(fora) == 4

    # ESPEC 031 — **nenhum**. O único era o `14.049.00054.00`, e o `2` que o
    # punha aqui vinha do bloco bruto de `E1.1`. A marca continua no contrato da
    # API (`R-API-02`) e continua sendo verdadeira onde houver o caso.
    sem_cobertura = [linha for linha in fora if linha["sem_previsao_contratual"]]
    assert sem_cobertura == []


def test_saude(cliente: TestClient) -> None:
    resposta = cliente.get("/health")
    assert resposta.status_code == 200
    assert resposta.json() == {"status": "ok"}


# ── T-53 · cabeçalhos de segurança ────────────────────────────────────────────


def test_cabecalhos_de_seguranca(cliente: TestClient) -> None:
    cabecalhos = cliente.get("/health").headers
    assert cabecalhos["X-Content-Type-Options"] == "nosniff"
    assert cabecalhos["X-Frame-Options"] == "DENY"
    assert "default-src 'none'" in cabecalhos["Content-Security-Policy"]
    assert "max-age=" in cabecalhos["Strict-Transport-Security"]


def test_cors_nunca_libera_curinga(cliente: TestClient) -> None:
    resposta = cliente.options(
        "/reports",
        headers={"Origin": "https://invasor.example", "Access-Control-Request-Method": "POST"},
    )
    assert resposta.headers.get("access-control-allow-origin") != "*"


# ── T-54 · verificação dos uploads ────────────────────────────────────────────


def test_pdf_falso_e_recusado(
    cliente: TestClient, caminho_levantamento: Path
) -> None:
    """Um XLSX renomeado para .pdf é ZIP por dentro — a assinatura o denuncia."""
    arquivos = _envio(caminho_levantamento, caminho_levantamento)
    resposta = cliente.post("/reports", files=arquivos)

    assert resposta.status_code == 400
    assert "não é um arquivo PDF válido" in resposta.json()["detail"]
    assert not resposta.content.startswith(b"%PDF-")


def test_arquivo_corrompido_produz_mensagem_e_nenhum_documento(
    cliente: TestClient, caminho_contrato: Path
) -> None:
    arquivos = _envio(caminho_contrato, caminho_contrato)
    arquivos["levantamento"] = ("levantamento.xlsx", b"PK\x03\x04lixo", "application/octet-stream")

    resposta = cliente.post("/reports", files=arquivos)
    assert resposta.status_code in (400, 422)
    assert resposta.headers["content-type"].startswith("application/json")


def test_falta_de_arquivo_e_recusada(cliente: TestClient, caminho_contrato: Path) -> None:
    resposta = cliente.post(
        "/reports", files={"contrato": ("contrato.pdf", caminho_contrato.read_bytes())}
    )
    assert resposta.status_code == 422


# ── ESPEC 019 · o terceiro campo, opcional ────────────────────────────────────


def test_t1350_o_par_do_pgm_com_aditivo_entra_por_http(
    cliente: TestClient,
    caminho_contrato_pgm: Path,
    caminho_aditivo_pgm: Path,
    caminho_levantamento_pgm: Path,
) -> None:
    """ESPEC 019 `R-ADT-10` — *n* arquivos pelo mesmo endpoint.

    O `multipart` expressa lista repetindo o nome do campo, e é assim que os
    aditivos chegam. A prova de que passaram é o número de linhas ordenadas: 47
    contra as 45 que o mesmo par produz sem o aditivo.
    """
    arquivos = [
        ("contrato", ("contrato.pdf", caminho_contrato_pgm.read_bytes(), "application/pdf")),
        ("levantamento", ("levantamento.xlsx", caminho_levantamento_pgm.read_bytes(), XLSX)),
        ("aditivos", ("aditivo.pdf", caminho_aditivo_pgm.read_bytes(), "application/pdf")),
    ]

    resposta = cliente.post("/reports", files=arquivos)

    assert resposta.status_code == 200, resposta.text
    corpo = resposta.json()
    assert corpo["contrato_referencia"] == "TC 015/PGM/2024"
    assert corpo["total_linhas"] == 58
    assert len(corpo["demais_itens"]) == 11
    # `D-08` — os cinco avisos de quantidade que o aditivo explica não saem.
    assert corpo["avisos"] == []
    # T-1523 / ESPEC 021 — a **âncora nova**. A `V-REC-02` deixou de ser achado
    # (`R-PER-08`), e sem esta segunda asserção `avisos == []` ficaria verde
    # também num pipeline que não registrasse coisa alguma. É o canário de
    # `D-08` mudando de galho, não sendo apagado.
    assert len(corpo["linhas_derivadas"]) == 5


def test_t1350_o_campo_de_aditivos_e_opcional(
    cliente: TestClient, caminho_contrato_pgm: Path, caminho_levantamento_pgm: Path
) -> None:
    """`D-10` — sem o terceiro campo, a requisição é a de antes.

    É a asserção que impede o campo novo de virar obrigatório por descuido: o
    piloto não tem aditivo nenhum, e precisa continuar submissível.
    """
    resposta = cliente.post(
        "/reports", files=_envio(caminho_contrato_pgm, caminho_levantamento_pgm)
    )

    assert resposta.status_code == 200, resposta.text
    corpo = resposta.json()
    assert corpo["total_linhas"] == 58
    assert len(corpo["demais_itens"]) == 13
    # T-1524 / ESPEC 021 — a `V-REC-02` saiu de `avisos`; as cinco linhas que ela
    # descrevia viajam agora estruturadas, com o texto das duas células.
    #
    # T-1728 / ESPEC 023 — a `V-REC-01` fez o mesmo caminho, e `avisos` esvaziou.
    # As duas asserções seguintes são o que impede este teste de ficar verde num
    # pipeline que parasse de registrar qualquer coisa: a lista vazia sozinha não
    # distingue *nada a acusar* de *nada foi conferido*.
    assert corpo["avisos"] == []
    assert len(corpo["divergencias_de_fonte"]) == 5
    assert len(corpo["linhas_derivadas"]) == 5


def test_t1350_aditivo_repetido_bloqueia(
    cliente: TestClient,
    caminho_contrato_pgm: Path,
    caminho_aditivo_pgm: Path,
    caminho_levantamento_pgm: Path,
) -> None:
    """`V-ADT-03` pela API — a duplicata que dobraria as inclusões.

    Os dois chegam com o **mesmo nome de arquivo**, que é o caso realista: é o
    que o navegador envia quando alguém seleciona o mesmo PDF duas vezes.
    """
    conteudo = caminho_aditivo_pgm.read_bytes()
    arquivos = [
        ("contrato", ("contrato.pdf", caminho_contrato_pgm.read_bytes(), "application/pdf")),
        ("levantamento", ("levantamento.xlsx", caminho_levantamento_pgm.read_bytes(), XLSX)),
        ("aditivos", ("aditivo.pdf", conteudo, "application/pdf")),
        ("aditivos", ("aditivo.pdf", conteudo, "application/pdf")),
    ]

    resposta = cliente.post("/reports", files=arquivos)

    assert resposta.status_code == 422
    corpo = resposta.json()
    assert [a["validacao"] for a in corpo["bloqueantes"]] == ["V-ADT-03"]
    assert "docx_base64" not in corpo


# ── Bloqueio por validação ────────────────────────────────────────────────────


def test_pdf_no_lugar_do_levantamento_bloqueia(
    cliente: TestClient, caminho_contrato: Path
) -> None:
    """Era o catálogo inválido; o campo saiu com a ESPEC 018 (`R-REL-10`).

    O princípio a exercitar é o mesmo: entrada errada devolve 422 e **nenhum
    documento**, nunca um relatório parcial.
    """
    arquivos = _envio(caminho_contrato, caminho_contrato)
    arquivos["levantamento"] = ("contrato.pdf", caminho_contrato.read_bytes(), "application/pdf")
    resposta = cliente.post("/reports", files=arquivos)

    assert resposta.status_code == 400
    assert not resposta.content.startswith(b"PK")


# ── T-527 · ESPEC 009 · a análise na resposta ─────────────────────────────────


def test_a_resposta_traz_a_analise_e_a_planilha(resposta_do_piloto: dict) -> None:
    corpo = resposta_do_piloto

    assert corpo["analise"]["total_itens"] == 58
    assert corpo["analise"]["competencia"] == "julho/2026"
    # `PK` é a assinatura do ZIP — todo OOXML é um ZIP por dentro.
    assert base64.b64decode(corpo["analise_xlsx_base64"]).startswith(b"PK")


def test_r_api_01_as_quatro_situacoes_saem_sempre(resposta_do_piloto: dict) -> None:
    """Quem exibe não decide quais existem.

    No piloto todas têm item, então a asserção que vale é sobre a **lista**:
    quatro entradas, na ordem de gravidade. A situação vazia é verificada em
    `test_analise.py`, com caso construído — o piloto não a produz.
    """
    situacoes = resposta_do_piloto["analise"]["situacoes"]

    assert [s["classificacao"] for s in situacoes] == [
        "CRITICO",
        "MAIOR_RELEVANCIA",
        "DIVERGENTE",
        "SEM_DIVERGENCIA",
    ]
    # ESPEC 031 — a categoria mais grave do piloto passa a ser **vazia**, e é o
    # resultado que quem confere mais quer ler (`R-API-01`).
    assert [s["quantidade"] for s in situacoes] == [0, 20, 16, 22]
    assert all(s["quantidade"] == len(s["linhas"]) for s in situacoes)
    assert all(s["rotulo"] and s["glosa"] for s in situacoes)


def test_a_situacao_critica_sai_vazia_e_sai_assim_mesmo(resposta_do_piloto: dict) -> None:
    """`R-API-01` — as quatro saem sempre, inclusive vazias.

    Era o `14.049.00054.00`, com `sem_previsao_contratual` e saldo `-2`. A ESPEC
    031 mostrou que o `2` era artefato de leitura, e a categoria esvaziou.

    **A asserção que sobra é a mais valiosa da resposta**: *"nenhum item
    crítico"* é resultado, e a estrutura precisa dizê-lo — não sumir com a
    situação. É a `R-API-01` sendo exercitada por par real pela primeira vez.
    """
    critica = resposta_do_piloto["analise"]["situacoes"][0]

    assert critica["classificacao"] == "CRITICO"
    assert critica["quantidade"] == 0
    assert critica["linhas"] == []
    assert critica["rotulo"] and critica["glosa"]


def test_o_grid_de_divergencias_nao_mudou(resposta_do_piloto: dict) -> None:
    """Regressão da ESPEC 002: a análise **acrescenta**, não substitui."""
    corpo = resposta_do_piloto

    assert corpo["total_linhas"] == 58
    # ESPEC 031 — 37 → 36. `total_linhas` e `demais_itens` **não se movem**: o
    # `14.049.00054.00` continua no `Report`; o que mudou é ele ter parado de
    # divergir, com `0 = 0`.
    assert corpo["total_divergencias"] == 36
    assert len(corpo["divergencias"]) == 36
    assert len(corpo["demais_itens"]) == 4


def test_t557_tela_e_arquivo_nao_divergem(resposta_do_piloto: dict) -> None:
    """`R-XLS-02` — as contagens da resposta e as linhas das abas, na mesma execução.

    "Os dois saem do mesmo agregado" é verdade **hoje**: basta alguém formatar a
    quantidade num lugar e não no outro para deixar de ser. Argumento de
    arquitetura não é teste de regressão.
    """
    import openpyxl
    from leitura_analise import ABA_DA_CLASSIFICACAO, PRIMEIRA_LINHA_DE_DADO

    from domain.value_objects.classification import Classificacao

    livro = openpyxl.load_workbook(
        io.BytesIO(base64.b64decode(resposta_do_piloto["analise_xlsx_base64"])), data_only=True
    )

    for situacao in resposta_do_piloto["analise"]["situacoes"]:
        aba = livro[ABA_DA_CLASSIFICACAO[Classificacao(situacao["classificacao"])]]
        no_arquivo = [
            str(linha[0])
            for linha in aba.iter_rows(min_row=PRIMEIRA_LINHA_DE_DADO, values_only=True)
            if linha and linha[0] is not None
        ]
        na_tela = [linha["codigo"] for linha in situacao["linhas"]]

        assert no_arquivo == na_tela, situacao["classificacao"]
    livro.close()


def test_r_api_04_bloqueio_nao_traz_analise(
    cliente: TestClient, caminho_contrato: Path, caminho_levantamento: Path
) -> None:
    """Análise de número possivelmente errado é pior que análise nenhuma: ela classifica."""
    arquivos = _envio(caminho_contrato, caminho_contrato)
    corpo = cliente.post("/reports", files=arquivos).json()

    assert "analise" not in corpo
    assert "analise_xlsx_base64" not in corpo
    assert "docx_base64" not in corpo
