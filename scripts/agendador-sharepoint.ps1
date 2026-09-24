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

if (-not ($Instalar -or $Remover -or $Estado)) { Write-Output 'Use -Instalar, -Estado ou -Remover.'; exit 1 }

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
  Write-Output ('Situação: {0} · última: {1:dd/MM/yyyy HH:mm} · próxima: {2:dd/MM/yyyy HH:mm}' -f $tarefa.State, $info.LastRunTime, $info.NextRunTime)
  # 267009 = rodando agora, 267011 = ainda não rodou. Fora isso, o Agendador só erra se nem conseguiu abrir o .bat.
  if ($info.LastTaskResult -notin 0, 267009, 267011) { Write-Output "O Agendador não conseguiu iniciar o .bat (código $($info.LastTaskResult))." }

  # O conhost devolve sempre 0 ao Agendador: o código de verdade o .bat grava no log ("[fim ... - codigo N]").
  $log = Join-Path $projeto 'logs\sincronizar-sharepoint.log'
  $linhas = if (Test-Path $log) { @(Get-Content $log -Encoding UTF8) } else { @() }
  if ($linhas.Count -eq 0) { Write-Output 'Ainda sem log: a sincronização não rodou por aqui.'; exit 0 }
  $inicio = 0
  for ($i = $linhas.Count - 1; $i -ge 0; $i--) { if ($linhas[$i].StartsWith('[inicio ')) { $inicio = $i; break } }
  $ultima = @($linhas[$inicio..($linhas.Count - 1)])
  if ($ultima -cmatch 'APLICADO') {
    # Terminou: só o resumo (avisos e a lista inteira da auditoria ficam no log).
    $ultima -cmatch '^\[|APLICADO|^arquivos:|^contratos:|^  [+~] cliente|^Sem cliente|^  ".*": \d+ arquivo|^  falha |ATENÇÃO|Conferência:|DIVERGÊNCIA|Auditoria das contas:|^  \S.*: \d+$'
  } else {
    # Caiu antes do resumo, ou ainda está rodando: o fim da execução mostra o motivo.
    $ultima | Select-Object -Last 15
  }
}
