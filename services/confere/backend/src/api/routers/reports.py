"""T-51 — `POST /reports`.

Dois arquivos entram; sai o grid de divergências com o documento embutido
(ESPEC 002 §6, ESPEC 003). Havendo achado bloqueante, saem os achados e
**nenhum documento, nenhuma linha** — nunca um relatório parcial.
"""

from __future__ import annotations

import base64
import logging
import asyncio
import multiprocessing
import os
import resource
import shutil
import tempfile
import threading
import time
import uuid
from dataclasses import dataclass, field
from concurrent.futures import ProcessPoolExecutor
from concurrent.futures.process import BrokenProcessPool
from pathlib import Path
from typing import Annotated

import anyio
import anyio.to_thread
from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status
from fastapi.responses import JSONResponse, Response

from api.schemas import (
    Achado,
    Analise,
    DivergenciaDeFonte,
    LinhaDerivada,
    LinhaDoGrid,
    LinhaZerada,
    RespostaBloqueada,
    RespostaDaConferencia,
    RespostaRelatorio,
    SituacaoDaAnalise,
)
from api.uploads import gravar
from application.use_cases.generate_measurement_report import ReportResult
from domain.entities.analysis import AnaliseDaMedicao
from domain.entities.report import DivergenciaDeFonte as DivergenciaDeFonteDoDominio
from domain.entities.report import LinhaDerivada as LinhaDerivadaDoDominio
from domain.entities.report import LinhaZerada as LinhaZeradaDoDominio
from domain.entities.report import ReportLine
from domain.errors import ExtractionError
from domain.value_objects.quantity import Quantity
from infrastructure.di.container import Entradas, get_container

logger = logging.getLogger(__name__)
router = APIRouter(tags=["relatórios"])

NOME_DA_SAIDA = "levantamento-comprovacao.docx"
NOME_DA_ANALISE = "relatorio-analise-medicao.xlsx"

# Uma geração por réplica — ESPEC 012 `D-02`.
#
# `DocxRenderer` e `XlsxAnaliseRenderer` não guardam estado entre chamadas
# (nenhum atribui a `self` fora do `__init__`), então concorrência **seria**
# segura. Mas segura por inspeção não é testada: até aqui o bloqueio do event
# loop serializava tudo por acidente, e tirá-lo passa a permitir uma
# concorrência que o projeto nunca exercitou.
#
# O `concurrentRequests: 1` do Container Apps não substitui isto: lá é alvo de
# escala, não limite rígido, e duas requisições podem cair na mesma réplica.
#
# Remover é uma linha, no dia em que houver teste que sustente — insumo `I-08`.
_UMA_POR_REPLICA = anyio.CapacityLimiter(1)


def _linha(origem: ReportLine, *, sem_previsao_contratual: bool = False) -> LinhaDoGrid:
    """Converte a linha do domínio na linha do grid, já formatada.

    Uma função só para o grid e para a análise: uma segunda conversão seria a
    primeira porta para tela e arquivo divergirem (`R-XLS-02`).
    """
    return LinhaDoGrid(
        codigo=str(origem.codigo),
        descricao=origem.descricao,
        unidade=origem.unidade,
        contratada=origem.contratada.formatar(),
        medida=origem.medida.formatar(),
        saldo=origem.saldo.formatar(),
        perfil_ou_pacote=origem.perfil_ou_pacote,
        sem_previsao_contratual=sem_previsao_contratual,
    )


def _zerada(origem: LinhaZeradaDoDominio) -> LinhaZerada:
    """T-2160 / ESPEC 031 `R-APU-08` — a linha zerada, com o emitido formatado.

    `medida` passa **intacta**: é o texto da célula do bloco bruto, e mostrá-lo
    é o ponto inteiro do registro. `saiu` vem da `ReportLine` construída, e não
    de um literal com `0` — a `R-APU-03` é regra de domínio, e escrevê-la aqui a
    poria num segundo lugar para divergir do primeiro.
    """
    return LinhaZerada(
        linha=origem.linha_na_aba,
        codigo=origem.codigo,
        descricao=origem.descricao,
        bloco_bruto=origem.bloco_bruto,
        bloco_descontado=origem.bloco_descontado,
        medida=origem.medida_texto,
        saiu=f"{origem.emitida.contratada.formatar()} / {origem.emitida.medida.formatar()}",
    )


def _derivada(origem: LinhaDerivadaDoDominio) -> LinhaDerivada:
    """T-1512 / ESPEC 021 — a linha derivada, com o emitido já formatado.

    `saiu` sai da `ReportLine` que a derivação construiu, e **não** de um literal
    `"1 / 1"` (`D-06`): `R-REL-08` é regra de domínio, e escrevê-la aqui a
    colocaria num segundo lugar para divergir do primeiro.

    As duas quantidades da planilha passam **intactas**. Nenhum `or "-"`, nenhum
    `or 0`: o valor da coluna é ser o que estava na célula.
    """
    return LinhaDerivada(
        linha=origem.linha_na_aba,
        codigo=origem.codigo,
        descricao=origem.descricao,
        contratada=origem.contratada_texto,
        medida=origem.medida_texto,
        saiu=f"{origem.emitida.contratada.formatar()} / {origem.emitida.medida.formatar()}",
    )


def _divergencia(origem: DivergenciaDeFonteDoDominio) -> DivergenciaDeFonte:
    """T-1715 / ESPEC 023 — a divergência de contratado, já formatada.

    As quantidades passam por `Quantity.formatar()`, como `_linha` faz, para que
    a tela e o documento escrevam os mesmos números do mesmo jeito.

    A diferença sai **com sinal explícito**: `+1.100,00` e `−80,00`. O sinal é a
    informação — redução tem leitura de negócio diferente de aumento — e o menos
    é o unicode `−` (U+2212), não o hífen: alinhado com os dígitos tabulares, o
    hífen fica curto demais para ser lido como sinal.
    """
    diferenca = origem.diferenca
    sinal = "+" if diferenca > 0 else "−"
    variacao = origem.variacao

    return DivergenciaDeFonte(
        codigo=origem.codigo,
        descricao=origem.descricao,
        unidade=origem.unidade,
        no_contrato=Quantity(origem.no_contrato).formatar(),
        na_planilha=Quantity(origem.na_planilha).formatar(),
        no_aditivo=(
            None if origem.no_aditivo is None else Quantity(abs(origem.no_aditivo)).formatar()
        ),
        na_proposta=(
            None if origem.na_proposta is None else Quantity(origem.na_proposta).formatar()
        ),
        diferenca=f"{sinal}{Quantity(abs(diferenca)).formatar()}",
        variacao_pct=None if variacao is None else float(round(variacao, 2)),
        tem_aditivo_aplicado=origem.tem_aditivo_aplicado,
        severidade=origem.severidade.value,
    )


def _analise(origem: AnaliseDaMedicao) -> Analise:
    """ESPEC 009 — as quatro situações, sempre as quatro (`R-API-01`)."""
    return Analise(
        contrato_referencia=origem.contrato_referencia,
        proposta_origem=origem.proposta_origem,
        competencia=origem.competencia,
        total_itens=origem.total_itens,
        situacoes=[
            SituacaoDaAnalise(
                classificacao=str(situacao.classificacao),
                rotulo=situacao.rotulo,
                glosa=situacao.glosa,
                quantidade=situacao.quantidade,
                perfis_ou_pacotes=situacao.perfis_ou_pacotes,
                linhas=[
                    _linha(item.linha, sem_previsao_contratual=item.sem_previsao_contratual)
                    for item in situacao.itens
                ],
            )
            for situacao in origem.situacoes
        ],
    )


def _achado(origem: object) -> Achado:
    return Achado(
        validacao=origem.validacao,  # type: ignore[attr-defined]
        severidade=str(origem.severidade),  # type: ignore[attr-defined]
        mensagem=origem.mensagem,  # type: ignore[attr-defined]
        codigo=origem.codigo,  # type: ignore[attr-defined]
        titulo=origem.titulo,  # type: ignore[attr-defined]
        causa=origem.causa,  # type: ignore[attr-defined]
        acao=origem.acao,  # type: ignore[attr-defined]
        detalhe=origem.detalhe,  # type: ignore[attr-defined]
    )


ARQUIVO_DE_FASE = "fase.txt"


def registrar_fase(arquivo: Path | None, fase: str) -> None:
    """Escreve a fase em curso num arquivo da pasta do job (20/10/2026).

    É o canal entre o processo filho, que conhece a fase, e o servidor, que
    responde `GET /jobs/{id}`. Arquivo e não fila do `multiprocessing`: uma fila
    exigiria um processo gerenciador a mais — memória que o plano free não tem —
    e o arquivo sobrevive a qualquer coisa que aconteça com o filho. Troca
    atômica (`os.replace`) para o leitor nunca ver o texto pela metade.
    """
    if arquivo is None:
        return
    try:
        provisorio = arquivo.with_suffix(".tmp")
        provisorio.write_text(fase, encoding="utf-8")
        os.replace(provisorio, arquivo)
    except OSError:  # pragma: no cover - informativo; a geração não depende disto
        pass


def _processar(
    entradas: Entradas, destino: Path, arquivo_de_fase: Path | None = None
) -> tuple[ReportResult, AnaliseDaMedicao | None, bytes | None, bytes | None]:
    """Todo o trabalho síncrono e pesado da geração, numa função só.

    Está separada para poder sair do *event loop* — ESPEC 012 `R-RSP-01`. São
    ~30 s de CPU: executá-los na thread do servidor deixa o processo inteiro sem
    atender nada, nem o `/health`, e foi o que impediu instalar *probes* no
    backend.

    Uma função e não três chamadas soltas (`D-01`): três trocas de thread
    custariam três vezes o mesmo *overhead* e devolveriam o controle entre as
    fases, dando a impressão de que o bloqueio é intermitente.

    Bloqueio de validação devolve os três últimos como `None` — a resposta HTTP
    é montada por quem chama, porque decidir status é do router, não daqui.
    """
    container = get_container()
    if arquivo_de_fase is None:
        resultado = container.gerar(entradas)
    else:
        resultado = container.gerar(
            entradas, ao_avancar=lambda fase: registrar_fase(arquivo_de_fase, fase)
        )

    if resultado.bloqueado or resultado.relatorio is None:
        return resultado, None, None, None

    registrar_fase(arquivo_de_fase, "Montando os anexos e gerando o DOCX")
    documento = container.renderizador().renderizar(resultado.relatorio, destino / NOME_DA_SAIDA)
    # ESPEC 009 `R-XLS-06` — a análise sai na **mesma passagem**. Ela é
    # derivação do relatório já pronto: nenhuma leitura de arquivo a mais,
    # nenhuma reconciliação repetida.
    analise = AnaliseDaMedicao.de_relatorio(resultado.relatorio)
    registrar_fase(arquivo_de_fase, "Gerando a planilha de análise")
    planilha = container.renderizador_de_analise().renderizar(analise, destino / NOME_DA_ANALISE)
    # Lidos antes de a pasta temporária sumir. Devolver os bytes evita um
    # arquivo intermediário de nome previsível, que colidiria entre requisições
    # concorrentes e vazaria em disco.
    return resultado, analise, documento.read_bytes(), planilha.read_bytes()


# ── Geração isolada num processo filho (19/10/2026) ───────────────────────────
#
# A instância do Render tem 512 MB, e a geração de um contrato grande com
# aditivos passava disso: o Render matava o serviço inteiro ("Ran out of
# memory"), levando junto quem estava na conferência prévia.
#
# Liberar as páginas do PDF (`infrastructure/shared/arquivos.py`) baixou o pico,
# mas não resolve uma coisa: o Python raramente devolve ao sistema a memória que
# já pediu. Depois de um documento grande o processo continuava ocupando o pico,
# e o próximo começava dali. No processo filho a memória volta **inteira** ao
# fim de cada geração (`max_tasks_per_child=1`), e se um documento ainda assim
# estourar, morre o filho — o servidor responde 503 com mensagem clara.
#
# `forkserver` e não `fork`: o servidor tem threads (a do `anyio`), e `fork` com
# threads vivas é inseguro. O `forkserver` já sobe com os módulos carregados
# (`set_forkserver_preload`), então cada filho nasce sem pagar os imports.
#
# Uma geração por vez continua garantida pelo `_UMA_POR_REPLICA`.
_executor: ProcessPoolExecutor | None = None
_executor_trava = threading.Lock()


def _obter_executor() -> ProcessPoolExecutor:
    global _executor
    with _executor_trava:
        if _executor is None:
            contexto = multiprocessing.get_context("forkserver")
            contexto.set_forkserver_preload(["api.routers.reports"])
            _executor = ProcessPoolExecutor(
                max_workers=1, mp_context=contexto, max_tasks_per_child=1
            )
        return _executor


def _descartar_executor() -> None:
    global _executor
    with _executor_trava:
        if _executor is not None:
            _executor.shutdown(wait=False, cancel_futures=True)
            _executor = None


def _processar_no_filho(
    entradas: Entradas, destino: Path, arquivo_de_fase: Path | None = None
) -> tuple[
    tuple[ReportResult, AnaliseDaMedicao | None, bytes | None, bytes | None], float
]:
    """Roda no processo filho: `_processar` e o pico de memória que ele custou."""
    saida = _processar(entradas, destino, arquivo_de_fase)
    # `ru_maxrss` é em KB no Linux. É o pico **deste** processo — por isso
    # medido aqui, e não no servidor, onde misturaria todas as gerações.
    pico_mb = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024
    return saida, pico_mb


def _tamanho_mb(caminho: Path) -> float:
    try:
        return caminho.stat().st_size / (1024 * 1024)
    except OSError:
        return 0.0


def _processar_isolado(
    entradas: Entradas, destino: Path, arquivo_de_fase: Path | None = None
) -> tuple[ReportResult, AnaliseDaMedicao | None, bytes | None, bytes | None]:
    """Executa `_processar` no processo filho e registra pico de memória e duração.

    O log diz **qual** entrada custou quanto — quando a instância cair de novo,
    é por ele que se descobre o documento.
    """
    inicio = time.monotonic()
    registrar_fase(arquivo_de_fase, "Iniciando a geração")
    try:
        saida, pico_mb = (
            _obter_executor()
            .submit(_processar_no_filho, entradas, destino, arquivo_de_fase)
            .result()
        )
    except BrokenProcessPool as erro:
        _descartar_executor()
        logger.error(
            "geração interrompida: o processo filho morreu (provável falta de memória) — "
            "contrato %.1f MB, levantamento %.1f MB, %d aditivo(s) %.1f MB",
            _tamanho_mb(entradas.contrato),
            _tamanho_mb(entradas.levantamento),
            len(entradas.aditivos),
            sum(_tamanho_mb(a) for a in entradas.aditivos),
        )
        raise GeracaoInterrompida from erro

    logger.info(
        "geração concluída em %.0f s: pico %.0f MB — contrato %.1f MB, levantamento %.1f MB, "
        "%d aditivo(s) %.1f MB",
        time.monotonic() - inicio,
        pico_mb,
        _tamanho_mb(entradas.contrato),
        _tamanho_mb(entradas.levantamento),
        len(entradas.aditivos),
        sum(_tamanho_mb(a) for a in entradas.aditivos),
    )
    return saida


class GeracaoInterrompida(Exception):
    """O processo filho morreu no meio da geração — em geral, falta de memória."""


MENSAGEM_GERACAO_INTERROMPIDA = (
    "A geração foi interrompida porque os documentos exigiram mais memória do que o "
    "serviço tem disponível. Tente de novo; se persistir, envie menos aditivos por vez "
    "ou avise o suporte com o nome dos arquivos."
)


@router.post(
    "/reports/conferencia-previa",
    summary="Os arquivos são do mesmo contrato?",
    response_model=RespostaDaConferencia,
)
async def conferir_identidade(
    contrato: Annotated[UploadFile, File(description="Proposta comercial em PDF")],
    levantamento: Annotated[UploadFile, File(description="Planilha de medição em XLSX")],
    aditivos: Annotated[
        list[UploadFile],
        File(description="Aditivos da proposta, em PDF — zero ou mais"),
    ] = [],  # noqa: B006 — FastAPI resolve o padrão por requisição, não o compartilha
) -> RespostaDaConferencia:
    """T-2097 / ESPEC 029 `R-IDT-10` — o portão que pergunta, antes dos ~30 s.

    Lê **só** a primeira página de cada peça e o cabeçalho da aba: 0,9 s contra
    os ~30 s da geração. É o que permite perguntar *"estes arquivos são do mesmo
    contrato?"* sem cobrar de quem vai responder *"não"* o processamento inteiro
    — e sem cobrar dele de novo de quem responder *"sim"* (`D-10`).

    **Conveniência, não garantia** (`R-IDT-12`): quem não passa por aqui recebe o
    mesmo portão no `POST /reports`, como 422 com `confirmaveis`. É por isso que
    o cliente pode falhar aberto e seguir direto para a geração.
    """
    with tempfile.TemporaryDirectory(prefix="conferencia-") as pasta:
        destino = Path(pasta)
        entradas = Entradas(
            contrato=await gravar(contrato, destino, "pdf", "contrato"),
            nome_do_contrato=contrato.filename or "",
            levantamento=await gravar(levantamento, destino, "xlsx", "levantamento"),
            nome_do_levantamento=levantamento.filename or "",
            aditivos=tuple(
                [
                    await gravar(arquivo, destino, "pdf", f"aditivo-{indice}")
                    for indice, arquivo in enumerate(aditivos, start=1)
                    if arquivo.filename
                ]
            ),
        )

        try:
            # Fora do event loop, como a geração (`R-RSP-01`): é ~1 s de CPU
            # abrindo PDF, e o servidor continua atendendo.
            #
            # **Sem o `_UMA_POR_REPLICA`**, e é deliberado: aquele limitador
            # existe para não exercitar concorrência não testada nos
            # renderizadores, e este caminho não os toca. Enfileirar o portão
            # atrás de uma geração de 30 s desfaria a razão de ele existir.
            conferencia = await anyio.to_thread.run_sync(
                get_container().conferir_identidade, entradas
            )
        except ExtractionError as erro:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, str(erro)) from erro

    return RespostaDaConferencia(
        combinam=conferencia.combinam,
        contrato=conferencia.contrato or None,
        levantamento=conferencia.levantamento or None,
        achados=[_achado(a) for a in conferencia.achados.achados],
    )


@router.post(
    "/reports",
    summary="Gera o relatório de comprovação",
    response_model=RespostaRelatorio,
    responses={422: {"model": RespostaBloqueada, "description": "Bloqueado por validação"}},
)
async def gerar_relatorio(
    contrato: Annotated[UploadFile, File(description="Proposta comercial em PDF")],
    levantamento: Annotated[UploadFile, File(description="Planilha de medição em XLSX")],
    aditivos: Annotated[
        list[UploadFile],
        File(description="Aditivos da proposta, em PDF — zero ou mais"),
    ] = [],  # noqa: B006 — FastAPI resolve o padrão por requisição, não o compartilha
    identidade_confirmada: Annotated[
        bool,
        Form(
            description=(
                "ESPEC 029 `R-IDT-10` — a resposta ao portão. Sem ele, par com "
                "identidades divergentes não produz documento"
            )
        ),
    ] = False,
) -> RespostaRelatorio | JSONResponse:
    # ESPEC 019 `R-ADT-10` — **dois obrigatórios e *n* aditivos.** Revisa a
    # `R-REL-10` da ESPEC 018 (*"dois arquivos, e só"*), cujo ganho era acabar
    # com o **cadastro prévio**, não fixar o número dois: aditivo é insumo
    # submetido como os outros, e não semeia nada. Sem aditivo, o caminho é o de
    # antes, bit a bit.
    #
    # O diretório temporário vive enquanto a resposta é montada. Nada é
    # persistido: a aplicação é sem estado (ESPEC 001 §7.2).
    with tempfile.TemporaryDirectory(prefix="analise-medicao-") as pasta:
        destino = Path(pasta)
        entradas = await _entradas_do_envio(
            destino, contrato, levantamento, aditivos, identidade_confirmada
        )

        try:
            # Fora do event loop (`R-RSP-01`): o servidor continua atendendo
            # enquanto os ~30 s de CPU rodam numa thread. Não acelera a geração
            # — devolve o processo ao resto do mundo durante ela.
            #
            # 19/10/2026 — e num processo filho (`_processar_isolado`): a memória
            # da geração volta inteira ao sistema quando ele termina.
            saida = await anyio.to_thread.run_sync(
                _processar_isolado, entradas, destino, limiter=_UMA_POR_REPLICA
            )
        except ExtractionError as erro:
            # Falha de leitura conhecida: mensagem clara, nunca um documento errado.
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, str(erro)) from erro
        except GeracaoInterrompida as erro:
            raise HTTPException(
                status.HTTP_503_SERVICE_UNAVAILABLE, MENSAGEM_GERACAO_INTERROMPIDA
            ) from erro
        except Exception as erro:  # pragma: no cover - rede de segurança
            logger.exception("falha inesperada ao gerar o relatório")
            raise HTTPException(
                status.HTTP_500_INTERNAL_SERVER_ERROR, "falha ao processar os arquivos"
            ) from erro

    return _responder(*saida)


async def _entradas_do_envio(
    destino: Path,
    contrato: UploadFile,
    levantamento: UploadFile,
    aditivos: list[UploadFile],
    identidade_confirmada: bool,
) -> Entradas:
    """Grava os arquivos enviados em `destino` e monta as `Entradas` — `/reports` e `/jobs`."""
    return Entradas(
        contrato=await gravar(contrato, destino, "pdf", "contrato"),
        # T-1909 / ESPEC 025 `R-DOC-06` — o nome com que o arquivo chegou.
        # O caminho acima é posicional e continua sendo; este é o que a tela
        # exibe quando a peça não tem identificação interna.
        nome_do_contrato=contrato.filename or "",
        levantamento=await gravar(levantamento, destino, "xlsx", "levantamento"),
        # ESPEC 027 `R-LEV-09` — o mesmo, para o levantamento: `V-MED-01`
        # precisa dizer qual arquivo enviar.
        nome_do_levantamento=levantamento.filename or "",
        # ESPEC 029 `R-IDT-10` — decide **a severidade do achado**, nunca a
        # sua existência: confirmado, ele desce a aviso e permanece na lista.
        identidade_confirmada=identidade_confirmada,
        # Nome por posição: dois aditivos com o mesmo nome de arquivo
        # sobrescreveriam um ao outro em disco, e o segundo entraria como
        # cópia do primeiro — que `V-ADT-03` acusaria como peça repetida, mas
        # depois de o dado já ter sido perdido.
        aditivos=tuple(
            [
                await gravar(arquivo, destino, "pdf", f"aditivo-{indice}")
                for indice, arquivo in enumerate(aditivos, start=1)
                if arquivo.filename
            ]
        ),
    )


def _responder(
    resultado: ReportResult,
    analise: AnaliseDaMedicao | None,
    conteudo: bytes | None,
    conteudo_da_analise: bytes | None,
) -> RespostaRelatorio | JSONResponse:
    """A resposta HTTP da geração — a mesma para `/reports` e para o resultado de um job."""
    # As quatro condições andam juntas: `_processar` devolve os três últimos
    # como `None` exatamente quando bloqueia. Verificar os quatro é o que
    # deixa o `mypy` estreitar os tipos daqui para baixo, sem `assert`.
    if (
        resultado.bloqueado
        or resultado.relatorio is None
        or analise is None
        or conteudo is None
        or conteudo_da_analise is None
    ):
        confirmaveis = resultado.achados.confirmaveis
        bloqueantes = resultado.achados.bloqueantes
        corpo = RespostaBloqueada(
            bloqueantes=[_achado(a) for a in bloqueantes],
            avisos=[_achado(a) for a in resultado.achados.avisos],
            # ESPEC 029 `R-IDT-10` — o que uma resposta destrava, separado do
            # que exige outro arquivo.
            confirmaveis=[_achado(a) for a in confirmaveis],
            pode_prosseguir=bool(confirmaveis) and not bloqueantes,
        )
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            content=corpo.model_dump(),
        )

    relatorio = resultado.relatorio
    return RespostaRelatorio(
        titulo=relatorio.titulo,
        data_levantamento=(
            relatorio.data_levantamento.strftime("%d/%m/%Y")
            if relatorio.data_levantamento
            else None
        ),
        contrato_referencia=relatorio.contrato_referencia,
        total_linhas=relatorio.total_linhas,
        total_divergencias=relatorio.total_divergencias,
        divergencias=[
            _linha(linha, sem_previsao_contratual=linha.sem_cobertura_contratual)
            for linha in relatorio.apenas_divergencias()
        ],
        demais_itens=[
            _linha(linha, sem_previsao_contratual=linha.sem_cobertura_contratual)
            for linha in relatorio.demais_itens
        ],
        analise=_analise(analise),
        linhas_derivadas=[_derivada(d) for d in resultado.derivadas],
        linhas_zeradas=[_zerada(z) for z in resultado.zeradas],
        divergencias_de_fonte=[_divergencia(d) for d in resultado.divergencias],
        avisos=[_achado(a) for a in resultado.achados.avisos],
        docx_base64=base64.b64encode(conteudo).decode("ascii"),
        analise_xlsx_base64=base64.b64encode(conteudo_da_analise).decode("ascii"),
    )


# ── Geração assíncrona: `POST /jobs` (20/10/2026) ─────────────────────────────
#
# `/reports` amarra ~2–4 min de CPU (no plano free do Render) a uma requisição
# HTTP, e o VerAI espera atrás de uma função da Vercel que morre aos 300 s: todo
# contrato maior virava 504. Aqui a requisição só **entrega** os arquivos e
# volta na hora com um `id`; a geração segue em segundo plano, e quem chama
# consulta `GET /jobs/{id}` (situação, fase, posição na fila) até poder buscar
# `GET /jobs/{id}/resultado` — que devolve **exatamente** o que `/reports`
# devolveria (200 com o relatório, 422 bloqueado, 503 sem memória...).
#
# Os jobs vivem **na memória deste processo**: o serviço continua sem banco
# (ESPEC 001 §7.2). Reiniciou (deploy, queda), o job some — e `GET` responde 404
# com mensagem que diz isso, para a tela pedir um novo envio em vez de esperar
# para sempre. O resultado fica guardado por `RETENCAO_DO_RESULTADO_S` depois
# de pronto, para a consulta poder repetir (rede que caiu no meio, duas abas).
#
# `/reports` continua existindo e igual: é o caminho de quem chama direto, da
# suíte e do VerAI enquanto ele não migra.

RETENCAO_DO_RESULTADO_S = 20 * 60
"""Quanto o resultado fica guardado depois de pronto."""

MAXIMO_DE_JOBS = 20
"""Teto de jobs na memória (na fila + guardados). Acima disso `POST /jobs` recusa
com 503 — no plano free, vinte envios pendentes já é sinal de coisa errada."""

MENSAGEM_JOB_NAO_ENCONTRADO = (
    "Esta geração não está mais no Confere — o serviço pode ter reiniciado, ou o "
    "resultado expirou. Envie os arquivos de novo."
)


@dataclass
class _Job:
    id: str
    pasta: Path
    criado_em: float = field(default_factory=time.monotonic)
    iniciado_em: float | None = None
    concluido_em: float | None = None
    status_http: int | None = None
    corpo: bytes | None = None

    @property
    def arquivo_de_fase(self) -> Path:
        return self.pasta / ARQUIVO_DE_FASE

    def fase(self) -> str | None:
        try:
            return self.arquivo_de_fase.read_text(encoding="utf-8") or None
        except OSError:
            return None


_jobs: dict[str, _Job] = {}


def _limpar_jobs_vencidos() -> None:
    agora = time.monotonic()
    for chave, job in list(_jobs.items()):
        if job.concluido_em is not None and agora - job.concluido_em > RETENCAO_DO_RESULTADO_S:
            del _jobs[chave]


def _situacao(job: _Job) -> str:
    if job.concluido_em is not None:
        return "concluido"
    # Quem marca o início é o filho, ao escrever a primeira fase — antes disso o
    # job está esperando o `_UMA_POR_REPLICA`.
    if job.iniciado_em is not None and job.arquivo_de_fase.exists():
        return "processando"
    return "na_fila"


def _posicao_na_fila(job: _Job) -> int:
    """Quantos envios estão na frente deste — 0 quando já é a vez dele."""
    return sum(
        1
        for outro in _jobs.values()
        if outro is not job and outro.concluido_em is None and outro.criado_em < job.criado_em
    )


def _serializar(resposta: RespostaRelatorio | JSONResponse) -> tuple[int, bytes]:
    if isinstance(resposta, JSONResponse):
        return resposta.status_code, bytes(resposta.body)
    return status.HTTP_200_OK, resposta.model_dump_json().encode("utf-8")


def _erro(status_http: int, mensagem: str) -> tuple[int, bytes]:
    return status_http, JSONResponse({"detail": mensagem}).body


async def _executar_job(job: _Job, entradas: Entradas) -> None:
    try:
        job.iniciado_em = time.monotonic()
        saida = await anyio.to_thread.run_sync(
            _processar_isolado, entradas, job.pasta, job.arquivo_de_fase, limiter=_UMA_POR_REPLICA
        )
        job.status_http, job.corpo = _serializar(_responder(*saida))
    except ExtractionError as erro:
        job.status_http, job.corpo = _erro(status.HTTP_422_UNPROCESSABLE_CONTENT, str(erro))
    except GeracaoInterrompida:
        job.status_http, job.corpo = _erro(
            status.HTTP_503_SERVICE_UNAVAILABLE, MENSAGEM_GERACAO_INTERROMPIDA
        )
    except Exception:  # pragma: no cover - rede de segurança
        logger.exception("falha inesperada ao gerar o relatório (job %s)", job.id)
        job.status_http, job.corpo = _erro(
            status.HTTP_500_INTERNAL_SERVER_ERROR, "falha ao processar os arquivos"
        )
    finally:
        job.concluido_em = time.monotonic()
        # Os arquivos de entrada não ficam: só o resultado, e só por um tempo.
        shutil.rmtree(job.pasta, ignore_errors=True)


# As tarefas em andamento precisam de referência forte: o `asyncio` só guarda
# referência fraca, e uma tarefa sem dono pode ser coletada no meio.
_tarefas: set[asyncio.Task[None]] = set()


@router.post(
    "/jobs",
    summary="Inicia a geração em segundo plano e devolve o id para consulta",
    status_code=status.HTTP_202_ACCEPTED,
)
async def iniciar_job(
    contrato: Annotated[UploadFile, File(description="Proposta comercial em PDF")],
    levantamento: Annotated[UploadFile, File(description="Planilha de medição em XLSX")],
    aditivos: Annotated[
        list[UploadFile],
        File(description="Aditivos da proposta, em PDF — zero ou mais"),
    ] = [],  # noqa: B006 — FastAPI resolve o padrão por requisição, não o compartilha
    identidade_confirmada: Annotated[bool, Form()] = False,
) -> dict[str, object]:
    _limpar_jobs_vencidos()
    if len(_jobs) >= MAXIMO_DE_JOBS:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "O Confere está com envios demais na fila. Espere alguns minutos e tente de novo.",
        )

    pasta = Path(tempfile.mkdtemp(prefix="analise-medicao-job-"))
    try:
        entradas = await _entradas_do_envio(
            pasta, contrato, levantamento, aditivos, identidade_confirmada
        )
    except BaseException:
        shutil.rmtree(pasta, ignore_errors=True)
        raise

    job = _Job(id=uuid.uuid4().hex, pasta=pasta)
    _jobs[job.id] = job
    tarefa = asyncio.create_task(_executar_job(job, entradas))
    _tarefas.add(tarefa)
    tarefa.add_done_callback(_tarefas.discard)
    return {"id": job.id, "situacao": _situacao(job), "posicao": _posicao_na_fila(job)}


def _job_ou_404(id_do_job: str) -> _Job:
    _limpar_jobs_vencidos()
    job = _jobs.get(id_do_job)
    if job is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, MENSAGEM_JOB_NAO_ENCONTRADO)
    return job


@router.get("/jobs/{id_do_job}", summary="Situação de uma geração em segundo plano")
async def situacao_do_job(id_do_job: str) -> dict[str, object]:
    job = _job_ou_404(id_do_job)
    situacao = _situacao(job)
    inicio = job.iniciado_em if situacao == "processando" else job.criado_em
    return {
        "id": job.id,
        "situacao": situacao,
        "fase": job.fase() if situacao == "processando" else None,
        "posicao": _posicao_na_fila(job) if situacao == "na_fila" else 0,
        "segundos": round(time.monotonic() - (inicio or job.criado_em)),
    }


@router.get(
    "/jobs/{id_do_job}/resultado",
    summary="O resultado de uma geração concluída — o mesmo que `/reports` devolveria",
)
async def resultado_do_job(id_do_job: str) -> Response:
    job = _job_ou_404(id_do_job)
    if job.concluido_em is None or job.status_http is None or job.corpo is None:
        raise HTTPException(status.HTTP_409_CONFLICT, "A geração ainda não terminou.")
    return Response(content=job.corpo, status_code=job.status_http, media_type="application/json")
