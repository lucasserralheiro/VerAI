# Reinstalar o PC do Lucas sem quebrar o VerAI

Varredura feita em 05/10/2026 na máquina antiga (usuário Windows `REDE\p017886`, projeto em
`C:\projeto\VerAI`). **Sessão de IA na máquina nova: leia este arquivo inteiro antes de executar
qualquer coisa, depois o `CLAUDE.md`.** Nenhum segredo está aqui. Os valores vêm dos arquivos `.env*`
que o usuário trouxe do backup.

Este PC não é só estação de trabalho. Ele é o **servidor da sincronização com o SharePoint**: a cada
30 min o Agendador do Windows lê as bibliotecas do SharePoint pela pasta do OneDrive e grava no banco
de **produção** (Neon) e no Cloudflare R2. Enquanto a máquina nova não estiver de pé, as telas mostram
"Documentos do SharePoint atualizados em …" ficando velho (laranja depois de 2 h). Nada se perde: a
sincronização é idempotente e a primeira passada na máquina nova recupera tudo.

---

## 1. ANTES de formatar (máquina antiga): o que só existe aqui

| O quê | Onde | Por que se perde |
|---|---|---|
| **330 commits do `main` que não estão no GitHub** | `.git` | `main...origin/main [ahead 330]`. O push está travado de propósito (ver abaixo). **Esta é a perda mais grave.** |
| Mudanças não commitadas (reajuste, anexos do assistente, CLAUDE.md, plano de subida) e o `git stash` (`confere: versão voltada às 11:33 (28/09)`) | árvore de trabalho | não estão em commit nenhum |
| Trava de push | `.git/hooks/pre-push` | hooks não vão no clone |
| Segredos | `.env`, `.env.development`, `.env.local`, `.env.production.local` | ignorados pelo git |
| Memória do Claude neste projeto (21 arquivos) | `C:\Users\p017886\.claude\projects\C--projeto-VerAI\memory\` | fica fora do repositório |
| Banco de desenvolvimento | volume Docker `postgres_data` (container `verai-postgres`, porta 5433) | formatar apaga o volume |
| Arquivos de régua/teste | `arquivos-teste-conversao/` (17 MB), `arquivos-teste-confere/`, `.superpowers/` (rodadas salvas das réguas), `logs/` | ignorados pelo git |
| Outros soltos | `backup-antes-importar.sql`, `.vercel/`, `uploads/`, `Claude outputs/` | ignorados ou não rastreados |

### Por que NÃO dar `git push` para salvar os commits
A Vercel faz deploy automático do `main`. Um push publica em produção na hora, e o `main` local tem
migrações que a produção ainda não tem (o log do agendador confirma:
`migração 20260929170000_valor_vigencia não aplicada neste banco`,
`migração 20260930130000_calendario_faturamento não aplicada neste banco`). A subida para produção
segue `docs/superpowers/plans/2026-09-28-subida-main-producao.md`, com o usuário rodando os passos.
**Backup não é motivo para push.**

### Backup: execute isto na máquina antiga (PowerShell, na pasta do projeto)
```powershell
# Destino fora do disco que será formatado (pendrive/HD externo). Ex.: E:\backup-verai
$dest = 'E:\backup-verai'; New-Item -ItemType Directory -Force $dest | Out-Null

# 1) Histórico completo do git (todas as branches + stash) num arquivo só
git bundle create "$dest\verai.bundle" --all
git bundle verify "$dest\verai.bundle"

# 2) A pasta inteira, com a árvore suja, .env*, hooks e arquivos de régua (sem o que se regenera)
robocopy C:\projeto\VerAI "$dest\VerAI" /E /XD node_modules .next .smoke-tmp .venv __pycache__ .pytest_cache /R:1 /W:1

# 2b) A tarefa do Agendador como está hoje (só referência: na máquina nova reinstale com -Instalar, não importe o XML)
Export-ScheduledTask -TaskName 'VerAI - Sincronizar SharePoint' | Out-File -Encoding utf8 "$dest\tarefa-agendador.xml"

# 3) Memória do Claude
robocopy C:\Users\p017886\.claude\projects\C--projeto-VerAI "$dest\claude-projeto" /E

# 4) Banco de dev (subir o Docker Desktop antes; senão, pular e recriar do zero na máquina nova)
docker compose up -d
docker exec verai-postgres pg_dump -U <POSTGRES_USER do .env.development> -d verai -Fc -f /tmp/verai-dev.dump
docker cp verai-postgres:/tmp/verai-dev.dump "$dest\verai-dev.dump"
```
Confira se `$dest\VerAI\.env.production.local` e `$dest\VerAI\.git\hooks\pre-push` existem antes de
formatar. **Guarde o backup como segredo**: os `.env` têm a senha do banco de produção, as chaves do R2
e as chaves de IA.

Por último, remova a tarefa na máquina antiga para que as duas máquinas nunca sincronizem ao mesmo tempo
(a trava contra execução dupla é um arquivo no `%TEMP%` local, que não protege entre máquinas):
```powershell
powershell -ExecutionPolicy Bypass -File scripts\agendador-sharepoint.ps1 -Remover
```

---

## 2. Como a sincronização funciona hoje (o que precisa ser reproduzido)

```
Agendador do Windows  "VerAI - Sincronizar SharePoint"
  gatilhos: diário a partir de 07:00, repete a cada 30 min · ao fazer logon de REDE\p017886
  ação:     conhost.exe --headless cmd.exe /c "C:\projeto\VerAI\scripts\sincronizar-sharepoint.bat"
  início em: C:\projeto\VerAI
  conta:    p017886, Interactive (só com o usuário logado, porque o OneDrive vive na sessão), RunLevel Limited
  ajustes:  StartWhenAvailable, IgnoreNew (não empilha), limite 2 h, roda na bateria
        │
        ▼
scripts\sincronizar-sharepoint.bat
  ENV_FILE=.env.production.local   ← grava em PRODUÇÃO (Neon)
  npx dotenv -e .env.production.local -- npx tsx scripts\sincronizar-sharepoint.ts --aplicar
  log em logs\sincronizar-sharepoint.log (gira em 5 MB → .1.log); grava "[fim … - codigo N]"
        │
        ▼
scripts\sincronizar-sharepoint.ts   (o .env.local completa: R2_*, BLOB_READ_WRITE_TOKEN, CONFERE_*)
  1. biblioteca ContratosReceita → arquivos dos clientes (R2) + histórico dos contratos + conferência + auditoria
  2. data "atualizados em" (AtualizacaoSharepoint), só em passada completa sem divergência
  3. biblioteca Documentos → tabela de preços, calendário, links MPLS, controles, planilha de contratos
  4. índice + fichas do assistente de IA
  5. junção de linhas duplicadas + valor/vigência com prova
  Etapas 3–5 têm guarda pela migração: com a migração faltando em produção, a etapa é pulada sem erro.
```

**Pastas lidas** (`src/lib/arquivos/sharepoint/fonte-pasta.ts`). O caminho padrão parte do perfil do usuário:

| Biblioteca | Pasta local | Endereço no SharePoint |
|---|---|---|
| ContratosReceita | `%USERPROFILE%\rede.sp\rede.sp - ContratosReceita` | `https://cloudprodamazhotmail.sharepoint.com/sites/Prodam.DAF.GFP.Services/ContratosReceita/` |
| Documentos | `%USERPROFILE%\rede.sp\rede.sp - Documentos` | `https://cloudprodamazhotmail.sharepoint.com/sites/Prodam.DAF.GFP.Services/Documentos Compartilhados/` |

Conta do OneDrive: `lucascardoso@prodam.sp.gov.br` (OneDrive for Business, tenant "rede.sp"). Se o
OneDrive criar as pastas com outro nome, defina `SHAREPOINT_PASTA` e `SHAREPOINT_PASTA_DOCUMENTOS` no
`.env.production.local` em vez de mexer no código.

**Arquivos sob demanda funcionam**: a listagem usa `stat`, que não baixa nada; só a leitura baixa o
arquivo. Não é preciso marcar "Manter sempre neste dispositivo".

**Saúde de referência** (passada de 02/10/2026 16:30): 1206 listados, 1201 inalterados, conferência
"TUDO NO VERAI", cerca de 13 s de leitura e cerca de 30 s no total. Avisos de "Sem cliente" para
`1. PUBLICAÇÕES NO DOC → PRODAM-SEGES / SUB-ST / PRODAM` e 47 pontos da auditoria já existiam antes;
não são defeito da reinstalação. Na manhã da varredura (05/10, 10:02) a passada caiu com
`Can't reach database server` no Neon, uma falha passageira logo depois do boot (às 10:10 o Neon
respondia). A próxima passada se recupera sozinha.

---

## 3. Máquina nova: passo a passo

Mantenha **o mesmo caminho `C:\projeto\VerAI`**. O nome da pasta de memória do Claude
(`C--projeto-VerAI`), o `prisma-producao.ps1` e a tarefa dependem dele. Se o usuário Windows mudar,
o `agendador-sharepoint.ps1 -Instalar` pega o usuário novo sozinho.

1. **Programas**: Node **v24** (a máquina antiga tinha 24.19.0, npm 11.17.0), Git para Windows,
   Docker Desktop (só para o banco de dev), OneDrive (já vem no Windows 11) e Claude Code / Claude desktop.
2. **OneDrive**: entre com `lucascardoso@prodam.sp.gov.br`. No navegador, abra as duas bibliotecas da
   tabela acima e clique em **Sincronizar** em cada uma. Espere aparecerem
   `%USERPROFILE%\rede.sp\rede.sp - ContratosReceita` e `...\rede.sp - Documentos`, com as pastas dos
   clientes (ADESAMPA, ALESP, CGM… e `1. PUBLICAÇÕES NO DOC`) e, em Documentos, `CALENDÁRIO FATURAMENTO`,
   `FATURAMENTO SERVIÇOS PRODAM`, `PLANILHA DE CONTRATOS DE RECEITA PRODAM` e `TABELA DE PREÇOS PRODAM-SP`.
3. **Projeto**: copie `E:\backup-verai\VerAI` para `C:\projeto\VerAI`. A cópia já traz o `.git` com
   os 330 commits, a árvore suja, os `.env*` e o hook. Confira:
   ```powershell
   cd C:\projeto\VerAI
   git status -sb              # esperado: main...origin/main [ahead 330] (ou mais) e as mesmas mudanças
   git stash list              # esperado: o stash do confere de 28/09
   Test-Path .git\hooks\pre-push, .env.production.local, .env.local   # tudo True
   ```
   Sem a cópia da pasta, use o bundle: `git clone E:\backup-verai\verai.bundle C:\projeto\VerAI`,
   `git remote set-url origin https://github.com/lucasserralheiro/VerAI.git`, depois copie os `.env*`
   e o `pre-push` do backup.
   **Não clone do GitHub**: o `origin/main` está 330 commits atrás e o agendador roda o código desta pasta.
4. **Dependências**: `npm ci` e depois `npx prisma generate`.
   - Não rode `prisma migrate` contra produção para "consertar" nada. Isso faz parte da subida, que é do usuário.
   - O agendador usa o cliente Prisma **desta pasta** contra produção. Isso funciona hoje porque só existem
     tabelas novas, com guarda (memória `agendador-usa-cliente-prisma-da-pasta`).
5. **Memória do Claude**: copie `E:\backup-verai\claude-projeto\*` para
   `C:\Users\<usuário>\.claude\projects\C--projeto-VerAI\`. Reinstale os plugins do Claude Code usados
   aqui (superpowers, ui-ux-pro-max).
6. **Teste manual antes de agendar** (só lista, não grava nada):
   ```powershell
   npx dotenv -e .env.production.local -- npx tsx scripts\sincronizar-sharepoint.ts
   ```
   Esperado: `SÓ LISTAGEM`, `pasta: C:\Users\…\rede.sp\rede.sp - ContratosReceita`,
   `listados ~1200`, **`novos 0`, `sumiram 0`**, conferência "TUDO NO VERAI".
   - `sumiram` alto quer dizer que o OneDrive ainda está baixando a árvore. **Não aplique**: com `--aplicar`
     o arquivo que "sumiu" sai do VerAI (remoção lógica). O código tem guarda (`remocaoSuspensa`), mas
     espere o OneDrive terminar e liste de novo.
   - `novos` alto com `já existiam` alto é normal (o R2 deduplica por hash). `novos` alto com
     `já existiam 0` quer dizer pasta errada.
   - `pasta não encontrada` → passo 2, ou ajuste `SHAREPOINT_PASTA`.
7. **Primeira passada gravando**, à mão:
   ```bat
   scripts\sincronizar-sharepoint.bat
   ```
   Confira em `logs\sincronizar-sharepoint.log` a linha `[fim … - codigo 0]` e `data das telas: atualizada`.
8. **Instalar o agendador**:
   ```powershell
   powershell -ExecutionPolicy Bypass -File scripts\agendador-sharepoint.ps1 -Instalar
   powershell -ExecutionPolicy Bypass -File scripts\agendador-sharepoint.ps1 -Estado
   ```
   Se o Windows recusar o gatilho de logon sem administrador, o script instala só o de 30 min, e o
   `StartWhenAvailable` cobre o logon. Confira o resultado com o `-Estado` e com o código no log, nunca com
   o "Último resultado" do Agendador (o conhost devolve sempre 0).
9. **Banco de dev** (opcional, só para desenvolver): `docker compose --env-file .env.development up -d`
   (porta 5433) e restaure o dump:
   `docker cp E:\backup-verai\verai-dev.dump verai-postgres:/tmp/` e depois
   `docker exec verai-postgres pg_restore -U <usuário> -d verai --clean --if-exists /tmp/verai-dev.dump`.
   **Nunca** use o banco de dev como shadow do Prisma (memória `nunca-shadow-no-banco-dev`).
10. **Validar na tela**: em produção, a lista de clientes mostra "Documentos do SharePoint atualizados em"
    com a hora da passada do passo 7.

---

## 4. Erros que quebram a sincronização (não cometer)

- Trocar `ENV_FILE` do `.bat` para dev e esquecer: a produção para de atualizar sem nenhum erro visível.
- Rodar a tarefa com "Executar estando o usuário conectado ou não" ou como SYSTEM: o OneDrive não existe
  fora da sessão do usuário e a pasta aparece vazia ou inexistente.
- Rodar com `--aplicar` antes de o OneDrive terminar de baixar a árvore (ver passo 6).
- Deixar a máquina antiga e a nova agendadas ao mesmo tempo.
- Apagar ou "consertar" o `pre-push`, ou dar push para salvar trabalho.
- Mudar regra de leitura sem rodar a régua (`npx tsx scripts/regua-sharepoint.ts --salvar` antes e sem
  `--salvar` depois). Ver `CLAUDE.md`.
- `--clientes=` em teste contra dev: dev e produção usam o **mesmo bucket R2**.

## 5. Para a sessão de IA da máquina nova

Prompt sugerido para colar:

> Formatei o PC. Leia `docs/reinstalar-pc.md` e o `CLAUDE.md`, confira item por item da seção 3 o que já
> está pronto nesta máquina (Node, OneDrive com as duas bibliotecas, pasta do projeto com os 330 commits,
> `.env*`, hook pre-push, memória) e me diga o que falta. Não faça push nem rode migração em produção.
> Rode a listagem sem `--aplicar` e só me peça para aplicar e instalar o agendador quando `sumiram` for 0.
