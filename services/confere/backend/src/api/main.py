"""Aplicação FastAPI — T-52 e T-53.

Serviço sem estado: recebe os três arquivos, devolve o PDF, nada persiste.
Sem banco, sem autenticação e sem multi-tenancy (ESPEC 001 §7.2).
"""

from __future__ import annotations

import os

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

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


app.include_router(reports.router)


@app.get("/health", summary="Verificação de saúde")
def saude() -> Saude:
    return Saude()
