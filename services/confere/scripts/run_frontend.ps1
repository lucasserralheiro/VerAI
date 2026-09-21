# Sobe o frontend em modo de desenvolvimento.
#
#   .\scripts\run_frontend.ps1
#
# Abra http://localhost:3000 — use `localhost`, nao `127.0.0.1`: sao origens
# distintas para o navegador, e o CORS do backend lista as duas por isso.

$ErrorActionPreference = "Stop"
$raiz = Split-Path -Parent $PSScriptRoot
Set-Location (Join-Path $raiz "frontend")

pnpm dev --port 3000
