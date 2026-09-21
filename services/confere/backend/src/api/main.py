"""Aplicação FastAPI — T-52 e T-53.

Serviço sem estado: recebe os três arquivos, devolve o PDF, nada persiste.
Sem banco, sem autenticação e sem multi-tenancy (ESPEC 001 §7.2).
"""

from __future__ import annotations

import hmac
import os

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from api.routers import reports
from api.schemas import Saude

app = FastAPI(
    title="Análise de Medição Contratual",
    description="Compara o que foi contratado com o que foi medido e gera o "
    "relatório de comprovação.",
    version="0.1.0",
)

# CORS sem curinga. Em produção `CORS_ORIGINS` é obrigatória; o default de
# desenvolvimento libera apenas o frontend local. Curinga com credenciais é
# inseguro, e por isso o default nunca é "*".
#
# `localhost` e `127.0.0.1` são origens distintas para o navegador. Sem as duas
# no default, abrir a aplicação por um endereço e não pelo outro produz uma
# falha muda: a requisição sai, o backend responde, e o navegador descarta a
# resposta sem nada aparecer na tela.
_PADRAO_DE_DESENVOLVIMENTO = "http://localhost:3000,http://127.0.0.1:3000"

_origens = [
    origem.strip()
    for origem in os.getenv("CORS_ORIGINS", _PADRAO_DE_DESENVOLVIMENTO).split(",")
    if origem.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origens,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["X-Avisos", "X-Linhas", "Content-Disposition"],
)

# CSP estrito vale para as respostas de API. /docs e /redoc carregam Swagger de
# CDN externa e ficam isentos, mantendo os demais cabeçalhos.
_ISENTOS_DE_CSP = ("/docs", "/redoc", "/openapi.json")


@app.middleware("http")
async def _cabecalhos_de_seguranca(request: Request, call_next):  # type: ignore[no-untyped-def]
    resposta = await call_next(request)
    resposta.headers.setdefault("X-Content-Type-Options", "nosniff")
    resposta.headers.setdefault("X-Frame-Options", "DENY")
    resposta.headers.setdefault("Referrer-Policy", "no-referrer")
    resposta.headers.setdefault(
        "Strict-Transport-Security", "max-age=63072000; includeSubDomains"
    )
    resposta.headers.setdefault(
        "Permissions-Policy", "geolocation=(), microphone=(), camera=()"
    )
    if not request.url.path.startswith(_ISENTOS_DE_CSP):
        resposta.headers.setdefault(
            "Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'"
        )
    return resposta


# Barreira de acesso — VerAI/integração (docs/superpowers/specs/2026-09-21-
# integracao-confere-design.md §3.5, no repositório do VerAI). O Confere sobe
# sem autenticação por design (ESPEC 001 §7.2, serviço sem estado e sem
# multi-tenancy) — isso não muda. Mas passa a ficar publicamente alcançável
# (chamado pelo VerAI a partir de uma function serverless, sem IP fixo de
# saída pra allowlist funcionar), então a proteção vira um segredo
# compartilhado no header, verificado na borda, sem tocar em nenhuma regra
# de domínio.
_HEADER_DO_SEGREDO = "X-Confere-Secret"
# /health fica isento — é o endpoint que a plataforma de hospedagem usa pra
# monitorar o serviço, e não carrega o header custom.
_ISENTOS_DO_SEGREDO = ("/health",)


@app.middleware("http")
async def _verificar_segredo_compartilhado(request: Request, call_next):  # type: ignore[no-untyped-def]
    """Falha ABERTA quando `CONFERE_SHARED_SECRET` não está configurado —
    é o caso de desenvolvimento local e da suíte de testes, que não define
    essa variável a menos que um teste faça isso explicitamente. Em produção
    (Render), a variável é obrigatória; esquecê-la lá é erro de configuração
    de deploy, e este middleware não tem como detectar isso sozinho.

    Comparação por `hmac.compare_digest` — não é `==` porque o tempo de uma
    comparação de string comum vaza quantos caracteres iniciais bateram, e
    aqui o valor comparado é literalmente a chave de acesso.
    """
    segredo_esperado = os.getenv("CONFERE_SHARED_SECRET")
    if segredo_esperado and request.url.path not in _ISENTOS_DO_SEGREDO:
        informado = request.headers.get(_HEADER_DO_SEGREDO, "")
        if not hmac.compare_digest(informado, segredo_esperado):
            return JSONResponse(
                {"detail": "não autorizado"}, status_code=status.HTTP_401_UNAUTHORIZED
            )
    return await call_next(request)


app.include_router(reports.router)


@app.get("/health", summary="Verificação de saúde")
def saude() -> Saude:
    return Saude()
