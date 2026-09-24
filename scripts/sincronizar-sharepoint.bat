@echo off
REM Sincroniza a biblioteca ContratosReceita (SharePoint/OneDrive) com o VerAI.
REM Agendador de Tarefas: Programa = este .bat, "Iniciar em" = pasta do projeto (C:\projeto\VerAI).
REM Troque ENV_FILE se quiser apontar pro banco de desenvolvimento.
setlocal
set ENV_FILE=.env.production.local
cd /d "%~dp0.."
if not exist logs mkdir logs
echo. >> logs\sincronizar-sharepoint.log
REM 1) contratos/termos novos no fluxo de cliente (cria cliente que faltar); 2) arquivos no repositório.
call npx dotenv -e %ENV_FILE% -- npx tsx scripts\importar-sharepoint-contratos.ts --aplicar --somente-novos >> logs\sincronizar-sharepoint.log 2>&1
call npx dotenv -e %ENV_FILE% -- npx tsx scripts\sincronizar-sharepoint.ts --aplicar >> logs\sincronizar-sharepoint.log 2>&1
endlocal
