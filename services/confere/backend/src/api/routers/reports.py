"""T-51 — `POST /reports`.

Dois arquivos entram; sai o grid de divergências com o documento embutido
(ESPEC 002 §6, ESPEC 003). Havendo achado bloqueante, saem os achados e
**nenhum documento, nenhuma linha** — nunca um relatório parcial.
"""

from __future__ import annotations

import base64
import logging
import tempfile
from pathlib import Path
from typing import Annotated

import anyio
import anyio.to_thread
from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status
from fastapi.responses import JSONResponse

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


def _processar(
    entradas: Entradas, destino: Path
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
    resultado = container.gerar(entradas)

    if resultado.bloqueado or resultado.relatorio is None:
        return resultado, None, None, None

    documento = container.renderizador().renderizar(resultado.relatorio, destino / NOME_DA_SAIDA)
    # ESPEC 009 `R-XLS-06` — a análise sai na **mesma passagem**. Ela é
    # derivação do relatório já pronto: nenhuma leitura de arquivo a mais,
    # nenhuma reconciliação repetida.
    analise = AnaliseDaMedicao.de_relatorio(resultado.relatorio)
    planilha = container.renderizador_de_analise().renderizar(analise, destino / NOME_DA_ANALISE)
    # Lidos antes de a pasta temporária sumir. Devolver os bytes evita um
    # arquivo intermediário de nome previsível, que colidiria entre requisições
    # concorrentes e vazaria em disco.
    return resultado, analise, documento.read_bytes(), planilha.read_bytes()


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

        entradas = Entradas(
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

        try:
            # Fora do event loop (`R-RSP-01`): o servidor continua atendendo
            # enquanto os ~30 s de CPU rodam numa thread. Não acelera a geração
            # — devolve o processo ao resto do mundo durante ela.
            resultado, analise, conteudo, conteudo_da_analise = await anyio.to_thread.run_sync(
                _processar, entradas, destino, limiter=_UMA_POR_REPLICA
            )
        except ExtractionError as erro:
            # Falha de leitura conhecida: mensagem clara, nunca um documento errado.
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, str(erro)) from erro
        except Exception as erro:  # pragma: no cover - rede de segurança
            logger.exception("falha inesperada ao gerar o relatório")
            raise HTTPException(
                status.HTTP_500_INTERNAL_SERVER_ERROR, "falha ao processar os arquivos"
            ) from erro

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
