"""T-703 a T-706 — ESPEC 012: o servidor continua atendendo durante a geração.

`POST /reports` executa ~30 s de trabalho de CPU. Enquanto ele roda, o processo
tem de continuar respondendo — é `R-RSP-02`, e é o critério de aceite da
ESPEC 012.

**Por que não `TestClient` aqui.** O resto da suíte usa `TestClient`, que executa
a aplicação num *portal* próprio, com seu próprio *event loop*. A serialização
que ele impõe é dele, não da aplicação: um teste de concorrência escrito sobre
`TestClient` pode ficar vermelho contra código correto ou verde contra código
quebrado. `ASGITransport` roda a aplicação no **mesmo** *event loop* do teste,
que é a topologia real do uvicorn em produção.

**Por que a asserção é sobre instantes, e não sobre latência.** Com o *event
loop* bloqueado, a tarefa da sonda não chega sequer a partir — ela fica na fila
até a geração acabar, e aí mede uma latência pequena, porque o cronômetro dela
só começa quando ela roda. Latência sozinha faria este teste passar contra o
código quebrado. O que distingue os dois mundos é **quando a sonda responde em
relação ao fim da geração**: antes, com folga, ou junto.
"""

from __future__ import annotations

import time
from pathlib import Path

import anyio
import httpx
import pytest

from api.main import app

XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

# Espera antes de sondar: dá tempo de o upload terminar e a geração entrar no
# trabalho pesado. Curta de propósito — a geração leva ~30 s, e sondar cedo é o
# que torna a sobreposição real.
ATRASO_DA_SONDA = 2.0

# Folga exigida entre a resposta da sonda e o fim da geração. Com o loop livre a
# sonda responde em milissegundos e a folga é de dezenas de segundos; com ele
# bloqueado, as duas coisas acontecem no mesmo instante.
FOLGA_MINIMA = 5.0


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


def _envio(contrato: Path, levantamento: Path) -> dict[str, tuple[str, bytes, str]]:
    return {
        "contrato": ("contrato.pdf", contrato.read_bytes(), "application/pdf"),
        "levantamento": ("levantamento.xlsx", levantamento.read_bytes(), XLSX),
    }


@pytest.mark.anyio
async def test_r_rsp_02_a_saude_responde_durante_a_geracao(
    caminho_contrato: Path, caminho_levantamento: Path
) -> None:
    """O critério de aceite da ESPEC 012.

    Falha contra o código que executa a geração dentro do *event loop*: a sonda
    só é atendida depois de a geração terminar, e a folga vai a zero.
    """
    arquivos = _envio(caminho_contrato, caminho_levantamento)
    marcas: dict[str, float] = {}

    transporte = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transporte, base_url="http://teste") as cliente:

        async def gerar() -> None:
            marcas["geracao_inicio"] = time.perf_counter()
            resposta = await cliente.post("/reports", files=arquivos, timeout=None)
            marcas["geracao_fim"] = time.perf_counter()
            assert resposta.status_code == 200, resposta.text

        async def sondar() -> None:
            await anyio.sleep(ATRASO_DA_SONDA)
            marcas["sonda_pedido"] = time.perf_counter()
            resposta = await cliente.get("/health", timeout=None)
            marcas["sonda_resposta"] = time.perf_counter()
            assert resposta.status_code == 200

        async with anyio.create_task_group() as grupo:
            grupo.start_soon(gerar)
            grupo.start_soon(sondar)

    inicio = marcas["geracao_inicio"]
    geracao = marcas["geracao_fim"] - inicio
    sonda = marcas["sonda_resposta"] - inicio
    folga = marcas["geracao_fim"] - marcas["sonda_resposta"]

    assert folga >= FOLGA_MINIMA, (
        f"a sonda de saúde só foi atendida junto com o fim da geração — "
        f"geração terminou em {geracao:.2f}s, sonda respondeu em {sonda:.2f}s, "
        f"folga de {folga:.2f}s (mínimo {FOLGA_MINIMA}s). "
        f"O event loop ficou bloqueado durante a geração."
    )


@pytest.mark.anyio
async def test_a_sonda_de_fato_sobrepoe_a_geracao(
    caminho_contrato: Path, caminho_levantamento: Path
) -> None:
    """T-705 — mede o teste, não a aplicação.

    Um teste de concorrência que não sobrepõe passa contra o código quebrado.
    Este garante que a sonda é **emitida** com a geração em curso; sem ele, o
    teste acima poderia ficar verde por ter deixado de sobrepor.
    """
    arquivos = _envio(caminho_contrato, caminho_levantamento)
    marcas: dict[str, float] = {}

    transporte = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transporte, base_url="http://teste") as cliente:

        async def gerar() -> None:
            marcas["geracao_inicio"] = time.perf_counter()
            await cliente.post("/reports", files=arquivos, timeout=None)
            marcas["geracao_fim"] = time.perf_counter()

        async def sondar() -> None:
            await anyio.sleep(ATRASO_DA_SONDA)
            marcas["sonda_pedido"] = time.perf_counter()
            await cliente.get("/health", timeout=None)

        async with anyio.create_task_group() as grupo:
            grupo.start_soon(gerar)
            grupo.start_soon(sondar)

    assert marcas["sonda_pedido"] > marcas["geracao_inicio"], (
        "a sonda partiu antes de a geração começar — não há sobreposição nenhuma"
    )
    assert marcas["sonda_pedido"] < marcas["geracao_fim"], (
        "a sonda só partiu depois de a geração terminar — o teste de "
        "responsividade estaria medindo o nada"
    )


@pytest.mark.anyio
async def test_r_rsp_04_duas_geracoes_simultaneas_saem_corretas(
    caminho_contrato: Path, caminho_levantamento: Path
) -> None:
    """`R-RSP-04` / `D-02` — uma geração por réplica.

    Passa hoje por acidente: o bloqueio do *event loop* serializa tudo. Existe
    para que continue passando quando a serialização virar escolha explícita do
    `CapacityLimiter` — e para que um dia, se alguém o remover, a corrupção
    entre gerações concorrentes apareça aqui e não em produção.
    """
    arquivos = _envio(caminho_contrato, caminho_levantamento)
    respostas: list[httpx.Response] = []

    transporte = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transporte, base_url="http://teste") as cliente:

        async def gerar() -> None:
            respostas.append(await cliente.post("/reports", files=arquivos, timeout=None))

        async with anyio.create_task_group() as grupo:
            grupo.start_soon(gerar)
            grupo.start_soon(gerar)

    assert len(respostas) == 2
    assert all(r.status_code == 200 for r in respostas), [r.status_code for r in respostas]

    # Mesma entrada, mesma saída: o determinismo do renderizador (`R-DOC-10`)
    # vale também entre gerações concorrentes. Divergência aqui seria estado
    # compartilhado vazando de uma para a outra.
    primeiro, segundo = (r.json()["docx_base64"] for r in respostas)
    assert primeiro == segundo
