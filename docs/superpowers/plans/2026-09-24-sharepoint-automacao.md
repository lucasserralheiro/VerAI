# SharePoint sempre em dia — automação da sincronização — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A sincronização do SharePoint roda sozinha do PC do Lucas a cada 30 min, sem janela, e alcança tudo depois que o PC volta a ser ligado.

**Architecture:** Um `.ps1` versionado instala a tarefa do Agendador do Windows (do próprio usuário, sem administrador) que chama o `.bat` já existente. O `.bat` ganha rotação de log. Nada muda no VerAI.

**Tech Stack:** PowerShell 5.1 (módulo ScheduledTasks), cmd, o script `scripts/sincronizar-sharepoint.ts` que já existe.

## Andamento (24/09/2026)

- ✅ Task 1 concluída. Conferência em dev (18:42): repetição `PT30M` sem duração (= para sempre), gatilho
  de logon aceito sem administrador, **nenhuma janela**, sincronização em 9 s — 1.171 arquivos,
  `TUDO NO VERAI`, `codigo 0`.
- Desvios do plano, descobertos na execução:
  1. `conhost --headless` devolve **sempre 0** ao Agendador (`cmd /c exit 3` → 0), então o
     "resultado 0" do Step 3 não provava nada. O `.bat` grava `[inicio …]` / `[fim … - codigo N]` no log e o
     `-Estado` lê o código dali; o `LastTaskResult` só aparece quando o Agendador nem abriu o `.bat`.
  2. `-Estado` não usa `Get-Content -Tail 8`: o fim do log é a lista da auditoria (38 pontos em dev), que
     empurrava o `TUDO NO VERAI` para fora. Mostra o resumo filtrado da última execução ou, se ela caiu
     antes do resumo (ou ainda está rodando), as últimas 15 linhas. Datas em `dd/MM/yyyy HH:mm`.
  3. `.ps1` em UTF-8 **com BOM** (o PowerShell 5.1 lê arquivo sem BOM como ANSI e estraga os acentos);
     `.bat` em CRLF **sem** BOM (com BOM o `cmd` erra a primeira linha).
  4. A tarefa **não** foi removida no fim do Step 3: o usuário pediu para deixá-la instalada e ligada,
     já apontada para produção ("já deixa instalado apontado" → "Produção, ligada já"). Produção está
     com 7 migrações pendentes (`20260924100000`–`170000`); a primeira consulta da sincronização é a
     checagem de migração, só leitura, então cada execução para ali com `codigo 1`, sem gravar nada, até
     a Task 2.

## Global Constraints

- Spec manda: `docs/superpowers/specs/2026-09-24-sharepoint-automacao-design.md`. Onde plano e spec divergirem, pare e pergunte.
- Roda **sempre do PC do Lucas**; **sem** e-mail, painel, selo ou registro de execução no banco (decisões do usuário, 24/09/2026).
- Instalar/remover a tarefa é configuração persistente do Windows e a Task 2 mexe em produção: **ok explícito do usuário antes de cada passo**.
- Outras sessões commitam na `main`: `git add` só os arquivos da task, **nunca** `git add -A` / `git commit -a`.
- Comentários e mensagens em português, no estilo dos arquivos vizinhos.

---

### Task 1: Agendador versionado, sem janela e com log girando

**Files:**
- Create: `scripts/agendador-sharepoint.ps1`
- Modify: `scripts/sincronizar-sharepoint.bat`
- Modify: `CLAUDE.md` (seção "Sincronização com o SharePoint"), `docs/superpowers/plans/2026-09-23-sharepoint-lugar-certo.md` (Task 14 Step 6), `docs/superpowers/specs/2026-09-24-sharepoint-automacao-design.md` (Status)

- [x] **Step 1: Log girando no `.bat`** — antes da linha `echo. >> logs\sincronizar-sharepoint.log`:

```bat
REM Log acima de 5 MB vira .1.log (guarda só uma geração).
if exist logs\sincronizar-sharepoint.log for %%A in (logs\sincronizar-sharepoint.log) do if %%~zA GTR 5000000 move /y logs\sincronizar-sharepoint.log logs\sincronizar-sharepoint.1.log >nul
```

- [x] **Step 2: `scripts/agendador-sharepoint.ps1`** (versão final no arquivo — o `-Estado` mudou, ver Andamento, desvios 1–3)

```powershell
<#
  Agendador do Windows para a sincronização do SharePoint (spec docs/superpowers/specs/2026-09-24-sharepoint-automacao-design.md §4).
  Tarefa do próprio usuário — não precisa de administrador. Roda só com o usuário logado (o OneDrive vive na sessão dele).

    powershell -ExecutionPolicy Bypass -File scripts\agendador-sharepoint.ps1 -Instalar
    powershell -ExecutionPolicy Bypass -File scripts\agendador-sharepoint.ps1 -Estado
    powershell -ExecutionPolicy Bypass -File scripts\agendador-sharepoint.ps1 -Remover
#>
param([switch]$Instalar, [switch]$Remover, [switch]$Estado)

$ErrorActionPreference = 'Stop'
$nome = 'VerAI - Sincronizar SharePoint'
$projeto = Split-Path $PSScriptRoot -Parent
$bat = Join-Path $PSScriptRoot 'sincronizar-sharepoint.bat'
$usuario = "$env:USERDOMAIN\$env:USERNAME"

if ($Instalar) {
  # conhost --headless: sem janela piscando a cada 30 min.
  $acao = New-ScheduledTaskAction -Execute 'conhost.exe' -Argument "--headless cmd.exe /c `"$bat`"" -WorkingDirectory $projeto
  $aCada30 = New-ScheduledTaskTrigger -Once -At (Get-Date).Date.AddHours(7) -RepetitionInterval (New-TimeSpan -Minutes 30)
  $config = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew `
    -ExecutionTimeLimit (New-TimeSpan -Hours 2) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
  $quem = New-ScheduledTaskPrincipal -UserId $usuario -LogonType Interactive -RunLevel Limited
  try {
    $logon = New-ScheduledTaskTrigger -AtLogOn -User $usuario
    Register-ScheduledTask -TaskName $nome -Action $acao -Trigger @($aCada30, $logon) -Settings $config -Principal $quem -Force | Out-Null
    Write-Output 'Instalada: a cada 30 min e ao fazer logon.'
  } catch {
    # Sem administrador o Windows pode recusar o gatilho de logon; "StartWhenAvailable" cobre o logon do mesmo jeito.
    Register-ScheduledTask -TaskName $nome -Action $acao -Trigger $aCada30 -Settings $config -Principal $quem -Force | Out-Null
    Write-Output "Instalada: a cada 30 min (gatilho de logon recusado: $($_.Exception.Message))."
  }
}

if ($Remover) {
  Unregister-ScheduledTask -TaskName $nome -Confirm:$false
  Write-Output 'Removida.'
}

if ($Estado -or $Instalar) {
  $tarefa = Get-ScheduledTask -TaskName $nome -ErrorAction SilentlyContinue
  if (-not $tarefa) { Write-Output 'Tarefa não instalada.'; exit 1 }
  $info = $tarefa | Get-ScheduledTaskInfo
  Write-Output "Situação: $($tarefa.State) · última: $($info.LastRunTime) (resultado $($info.LastTaskResult)) · próxima: $($info.NextRunTime)"
  $log = Join-Path $projeto 'logs\sincronizar-sharepoint.log'
  if (Test-Path $log) { Get-Content $log -Tail 8 }
}
```

- [x] **Step 3: Conferir em dev (com ok do usuário — configuração persistente do Windows)**
  - Troque temporariamente `ENV_FILE` do `.bat` para `.env.development`.
  - `powershell -ExecutionPolicy Bypass -File scripts\agendador-sharepoint.ps1 -Instalar` → `Situação: Ready`, próxima execução em até 30 min.
  - `(Get-ScheduledTask 'VerAI - Sincronizar SharePoint').Triggers[0].Repetition` → `Interval PT30M`, `Duration` vazio (= para sempre). Se vier com duração, acrescente `-RepetitionDuration (New-TimeSpan -Days 3650)` ao gatilho.
  - `Start-ScheduledTask -TaskName 'VerAI - Sincronizar SharePoint'` → **nenhuma janela aparece**; em ~2 min, `-Estado` mostra resultado `0` e o fim do log com `TUDO NO VERAI`.
  - Se `conhost --headless` abrir janela ou não rodar, troque a ação por `-Execute 'cmd.exe' -Argument "/c `"$bat`""` e registre no spec §4.
  - Volte `ENV_FILE` para `.env.production.local` e rode `-Remover` (a instalação de verdade é na Task 2).
    **Não removida**, a pedido do usuário — ver Andamento, desvio 4.

- [x] **Step 4: Documentação**
  - `CLAUDE.md`, seção "Sincronização com o SharePoint": troque "(Agendador de Tarefas, `scripts/sincronizar-sharepoint.bat`)" por "(Agendador do Windows, instalado por `scripts/agendador-sharepoint.ps1` — a cada 30 min, do PC do Lucas)".
  - Plano lugar-certo, Task 14 Step 6: substitua o `schtasks /create …` por `powershell -ExecutionPolicy Bypass -File scripts\agendador-sharepoint.ps1 -Instalar` e o `schtasks /query …` por `… -Estado`.
  - Spec de automação: Status → "implementado (aguardando produção)".

- [x] **Step 5: Commit**

```bash
git add scripts/agendador-sharepoint.ps1 scripts/sincronizar-sharepoint.bat CLAUDE.md docs/superpowers/plans/2026-09-23-sharepoint-lugar-certo.md docs/superpowers/plans/2026-09-24-sharepoint-automacao.md docs/superpowers/specs/2026-09-24-sharepoint-automacao-design.md
git commit -m "feat(sharepoint): agendador do Windows versionado, sem janela e com log girando"
```

---

### Task 2: Produção (com o usuário, passo a passo)

Cada passo mexe em produção, na Vercel ou no Windows: **peça confirmação explícita antes de cada um**. Os comandos são os da Task 14 do plano lugar-certo.

- [ ] **Step 1:** Usuário: 4 variáveis `R2_*` na Vercel; pasta da biblioteca com "Sempre manter neste dispositivo".
- [ ] **Step 2:** Pausar a tarefa (`Disable-ScheduledTask -TaskName 'VerAI - Sincronizar SharePoint'` — ela já está ligada em produção desde 24/09; sem a pausa, uma execução entre a migração e o código novo gravaria `r2:` que o código antigo não abre). Depois: deploy do código e `npx dotenv -e .env.production.local -- npx prisma migrate deploy`; `migrar-sharepoint-lugar-certo.ts` listagem → `--aplicar` (Task 14 Steps 2–4 do lugar-certo).
- [ ] **Step 3:** Primeira sincronização completa manual (Task 14 Step 5 do lugar-certo). Expected: `TUDO NO VERAI`.
- [ ] **Step 4:** Religar (`Enable-ScheduledTask -TaskName 'VerAI - Sincronizar SharePoint'`; já instalada em 24/09). Depois de 30 min: `-Estado` com `TUDO NO VERAI` e `codigo 0` na última execução.
- [ ] **Step 5:** Registrar: spec de automação → Status "em produção" com data; memória do projeto atualizada; commit só dos docs.
