@echo off
REM Sincroniza a biblioteca ContratosReceita (SharePoint/OneDrive) com o VerAI.
REM Agendado por scripts\agendador-sharepoint.ps1 (-Instalar / -Estado / -Remover), a cada 30 min.
REM Troque ENV_FILE se quiser apontar pro banco de desenvolvimento.
setlocal
set ENV_FILE=.env.production.local
cd /d "%~dp0.."
if not exist logs mkdir logs
REM Log acima de 5 MB vira .1.log (guarda só uma geração).
if exist logs\sincronizar-sharepoint.log for %%A in (logs\sincronizar-sharepoint.log) do if %%~zA GTR 5000000 move /y logs\sincronizar-sharepoint.log logs\sincronizar-sharepoint.1.log >nul
echo. >> logs\sincronizar-sharepoint.log
echo [inicio %DATE% %TIME%] >> logs\sincronizar-sharepoint.log
REM Uma passada só: clientes, arquivos (aba Documentos), contratos/histórico que mudaram, conferência.
call npx dotenv -e %ENV_FILE% -- npx tsx scripts\sincronizar-sharepoint.ts --aplicar >> logs\sincronizar-sharepoint.log 2>&1
REM O Agendador só enxerga o conhost, que devolve sempre 0: o código de verdade vai pro log (o -Estado lê dali).
set CODIGO=%ERRORLEVEL%
echo [fim %DATE% %TIME% - codigo %CODIGO%] >> logs\sincronizar-sharepoint.log
endlocal & exit /b %CODIGO%
