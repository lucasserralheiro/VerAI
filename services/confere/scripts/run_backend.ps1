# Sobe o backend em modo de desenvolvimento.
#
# Nao precisa de PYTHONPATH nem de --app-dir: o `uv sync` instala os pacotes de
# src/ no ambiente. Este script existe so por conveniencia.
#
#   .\scripts\run_backend.ps1

$ErrorActionPreference = "Stop"
$raiz = Split-Path -Parent $PSScriptRoot
Set-Location (Join-Path $raiz "backend")

uv run uvicorn api.main:app --reload --port 8000
