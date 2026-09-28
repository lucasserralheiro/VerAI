<#
  `prisma migrate status|deploy` contra o banco do arquivo de ambiente (padrão: PRODUÇÃO, Neon) pela
  conexão DIRETA (DATABASE_URL_UNPOOLED) — o pooler do Neon não serve para migração e o schema.prisma
  não tem directUrl. Usa as migrações da pasta onde este script está (o worktree da release), nunca as
  de outra pasta. Só aceita status e deploy (nada de reset). Plano docs/superpowers/plans/2026-09-28-subida-main-producao.md.

    powershell -ExecutionPolicy Bypass -File scripts\prisma-producao.ps1 -Comando status
    powershell -ExecutionPolicy Bypass -File scripts\prisma-producao.ps1 -Comando deploy
    powershell -ExecutionPolicy Bypass -File scripts\prisma-producao.ps1 -Comando status -ArquivoEnv C:\projeto\VerAI\.env.development
#>
param(
  [Parameter(Mandatory = $true)][ValidateSet('status', 'deploy')][string]$Comando,
  [string]$ArquivoEnv = 'C:\projeto\VerAI\.env.production.local'
)

$ErrorActionPreference = 'Stop'
$raiz = Split-Path $PSScriptRoot -Parent
$linhas = Get-Content -LiteralPath $ArquivoEnv

function Valor([string]$nome) {
  $linha = $linhas | Where-Object { $_ -match "^$nome=" } | Select-Object -First 1
  if ($linha) { return ($linha -replace "^$nome=", '').Trim().Trim('"') }
  return $null
}

$url = Valor 'DATABASE_URL_UNPOOLED'
if (-not $url) { $url = Valor 'DATABASE_URL' }
if (-not $url) { throw "Sem DATABASE_URL_UNPOOLED nem DATABASE_URL em $ArquivoEnv" }

# Só neste processo: o terminal de quem rodou não fica apontando para produção.
$env:DATABASE_URL = $url
$servidor = ([uri]($url -replace '^postgres(ql)?://', 'http://')).Host
Write-Host "Banco: $servidor  |  migracoes de: $raiz"

Push-Location $raiz
try {
  npx prisma migrate $Comando
  exit $LASTEXITCODE
} finally {
  Pop-Location
}
