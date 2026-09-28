# Subida do main para produção — plano de execução

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pôr em produção o `main` (177 commits e 22 migrações commitadas à frente do site em 28/09/2026, mais 1 migração ainda não commitada), encerrando os hotfixes, sem perder dado e com volta pronta a cada passo.

**Architecture:** "Banco primeiro, código depois". Todas as migrações pendentes só **acrescentam** tabelas, e às 12 tabelas que o código no ar usa só acrescentam colunas opcionais (conferido em 28/09 — ver "Por que nessa ordem"). Por isso entram antes do deploy sem derrubar o site e continuam compatíveis se o código voltar. O código sobe pela CLI da Vercel a partir de um worktree limpo num commit fixo (a *release*), sem `git push`. Cargas de dados vêm depois, uma a uma.

**Tech Stack:** Vercel CLI (plano Hobby, projeto ligado ao GitHub), Prisma 6 `migrate deploy` contra o Neon (conexão direta), Agendador do Windows (sincronização do SharePoint), Jest + `tsc` + `next build`.

## Global Constraints

- Todo passo que toca produção (banco Neon, Vercel, agendador) só com **ok explícito do usuário na conversa**. O classificador do modo auto barra a sessão nesses comandos (28/09: até `vercel deploy --help` foi barrado), então **quem roda é o usuário** — passos marcados 👤. A sessão prepara, confere e lê o resultado — passos 🤖.
- Nunca `git push` (o hook `.git/hooks/pre-push` trava). Liberar só na Task 10, se o usuário decidir (D4).
- Nunca `prisma migrate dev` nem `migrate diff` usando o banco de dev como shadow (memória `nunca-shadow-no-banco-dev`). Migração nova é conferida à mão; se aparecer `DROP INDEX "ArquivoCliente_clienteId_sha256_ativo_key"`, a linha sai (índice único parcial criado à mão).
- Migração em produção só pela **conexão direta** do Neon (`DATABASE_URL_UNPOOLED` do `.env.production.local`), nunca pelo pooler (`DATABASE_URL`, host `…-pooler…`): o `schema.prisma` não tem `directUrl`.
- Dev e produção dividem o bucket R2 `verai-documentos`.
- Depois de fixada a release, nada entra nela; conserto urgente no meio do caminho vira nova release (Tasks 2–3 de novo).
- O que roda em produção antes da subida: `hotfix/proposta-r2` (se o usuário já subiu em 28/09) ou `hotfix/confere-504`. O conteúdo dos dois está no main (conferido na Task 3).
- `vc.js` neste plano = `node "C:/Users/p017886/AppData/Local/npm-cache/_npx/69f9afb961c37556/node_modules/vercel/dist/vc.js"` (a CLI da Vercel logada, no cache do npx — memória `vercel-investigacao-cli`).

## Andamento

- [x] Decisões respondidas pelo usuário em 28/09/2026:
  - **D1 = tudo** ("vc termina tudo e sobe"): as quatro frentes entram. A suíte inteira do working tree do main passou em 28/09: 240 suítes e 1.779 testes.
    - **ConfereAI = a tela nova commitada** (usuário, 28/09). A versão "voltada" do working tree (feita às 11:33–11:35, sem commit) foi guardada em `stash@{0}` e em `.superpowers/backups/confere-versao-voltada-2026-09-28/` (cópias `.txt` + patch + LEIA-ME). A pasta `src/app/confere` voltou a ser igual ao HEAD: 15 suítes, 170 testes verdes.
    - Commits em 28/09, com índice próprio:
      - `f015d46`: Converter em Markdown, janela PC/PA e TC/TA e proposta no R2 (31 arquivos, com a migração `20260925190000_proposta_arquivo_do_cliente`);
      - `f4a30e3`: lista de clientes em pastas;
      - `2ee4673`: `scripts/prisma-producao.ps1` (Task 1).
    - Antes dos commits: `tsc` limpo e 46 suítes / 369 testes das frentes verdes.
    - Ficaram de fora, de propósito: `_to_delete/`, `backup-antes-importar.sql`, `Claude outputs/`, `.claude/launch.json` e os rascunhos `specs/2026-09-23-pesquisa-satisfacao-mapa-design.md` e `specs/2026-09-25-assistente-interface-design.md` (outros assuntos).
  - **D2 = manter** o login por senha-mestra em produção.
  - **D3:** o `AI_*` de produção já é DeepSeek, nada a fazer.
  - **D4 = sim:** push e fim da trava depois de validar.
- Release: `—` · backup no Neon: `—` · deploy anterior: `—` · deploy novo: `—`

## Decisões do usuário (antes da Task 1)

| # | Pergunta | Recomendação |
|---|---|---|
| D1 | O main tem 4 frentes **não commitadas** de outras sessões. O que entra na release? | **A — "Converter em Markdown" + proposta no R2** (schema, migração `20260925190000_proposta_arquivo_do_cliente`, rotas da proposta, `lib/propostas/imagens.ts`, `lib/arquivos/*`, ícone de converter na aba Documentos): **obrigatória** — o `route.ts` da proposta commitado no main ainda grava no Blob (linhas 134 e 163), e sem a frente A a Nova conversão volta a quebrar. **B — janela TC/TA da aba Contratos** (`documentos-do-contrato.tsx`, `aba-contratos.tsx`, plano `2026-09-28-tcta-janela-do-contrato.md`): entra se a sessão dona fechar com teste verde (depende da A). **C — lista de clientes em pastas** (`lista-clientes.tsx`): entra se o teste estiver verde. **D — reforma do ConfereAI** (preparada no índice compartilhado: `UploadForm.tsx`, `page.tsx`, `FaixaDoContrato.tsx`, sai `EntradaDoLevantamento.tsx`): só se a sessão dona terminar; senão fica fora. |
| D2 | Produção tem `DEV_AUTH_ENABLED`/`DEV_AUTH_TOKEN` (login por senha-mestra que entra como admin + "Simular usuário"). O código diz "nunca deve estar ligado em produção real". | Se a equipe entra assim de propósito, manter por enquanto e registrar; senão, remover na Task 5. |
| D3 | O assistente usa `ASSISTENTE_AI_*` e, na falta, `AI_*`. Nenhuma `ASSISTENTE_AI_*` existe hoje (nem no dev). O `AI_*` de produção é o mesmo provedor do dev (DeepSeek)? | Se for, nada a fazer; se não for, criar `ASSISTENTE_AI_PROVIDER`, `ASSISTENTE_AI_MODEL` e `ASSISTENTE_AI_API_KEY` na Task 5. |
| D4 | Depois de validar: `git push` da release para o GitHub e fim da trava de push? | Sim: GitHub = produção e o deploy volta a ser "migração antes → push → Vercel". |
| D5 | Cargas de dados em produção. | `reconciliar-clientes.ts` primeiro só como relatório. Índice e fichas saem sozinhos pelo agendador depois da migração (fichas usam IA uma vez por PDF). `migrar-documentos-para-repositorio.ts` e `--apagar-copias` **esperam o Blob voltar** (~24/10/2026): os dois leem ou apagam no Blob suspenso. |
| D6 | O que ainda grava no Blob suspenso: envio manual da aba Documentos, PDFs de relatório, PDF do faturamento, histórico do ConfereAI, envio de Documento para análise. | Depois da subida, num plano próprio. Já está quebrado hoje e subir o main não piora; só não conserta. |

## Por que nessa ordem

- **Migrações compatíveis com o código no ar** (conferido em 28/09 contra `hotfix/confere-504`): o site conhece 12 models (`Usuario`, `Cliente`, `AnaliseEvolucao`, `AnaliseConsolidada`, `Documento`, `Analise`, `PropostaComercial`, `PropostaComercialArquivo`, `RegraNotificacao`, `Notificacao`, `AcessoDocumento`, `ConfereExecucao`).
  - Nessas 12, as migrações só acrescentam colunas opcionais: `Cliente.bairro|endereco|numero|siglaLegado`, `Documento.arquivoId`, `ConfereExecucao.contratoId|competenciaAno|competenciaMes` e `PropostaComercialArquivo.arquivoClienteId`, todas com FK `ON DELETE SET NULL`.
  - O que apaga ou renomeia (`TermoConfirmacao.data`→`vigenciaInicio`, colunas de `ArquivoCliente`, FK de `ItemContrato`) é em tabela que o site no ar nem conhece.
- **Parte já está no Neon:** o agendador grava lá desde 24/09 (1.171 arquivos, contratos e auditoria). O log das rodadas de 28/09 diz que faltam pelo menos `20260926100000`, `20260926110000` e `20260928120000`. A lista exata sai da Task 4.
- **Deploy por CLI de um commit fixo:** o main recebe commits de várias sessões ao mesmo tempo. A release é um hash, e o que não estiver commitado nele não sobe.

---

### Task 1: Script de migração em produção pela conexão direta

**Files:**
- Create: `scripts/prisma-producao.ps1`

**Interfaces:**
- Produces: `powershell -ExecutionPolicy Bypass -File <repo>\scripts\prisma-producao.ps1 -Comando status|deploy [-ArquivoEnv <arquivo>]`. Usa as migrações da pasta onde o script está e a URL direta do arquivo de ambiente. Recusa qualquer outro comando (nada de `reset`).

- [x] **Step 1: Criar o script** — `scripts/prisma-producao.ps1`, UTF-8 **com BOM** como o
  `agendador-sharepoint.ps1` (o PowerShell 5.1 lê sem BOM como ANSI):

```powershell
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
```

- [x] **Step 2: Testar contra o dev** (🤖) — feito em 28/09:

Run: `powershell -ExecutionPolicy Bypass -File scripts\prisma-producao.ps1 -Comando status -ArquivoEnv C:\projeto\VerAI\.env.development`
Expected: `Banco: localhost  |  migracoes de: C:\projeto\VerAI` (só o host, sem usuário nem senha) e `39 migrations found` … `Database schema is up to date!`, código 0.

Run: `powershell -ExecutionPolicy Bypass -File scripts\prisma-producao.ps1 -Comando reset -ArquivoEnv C:\projeto\VerAI\.env.development`
Expected: erro de validação do parâmetro (`ValidateSet`), código 1, sem rodar o Prisma.

- [x] **Step 3: Commit** (`2ee4673`) (🤖, índice próprio — memória `git-indice-compartilhado`; nunca `git add -A`). O
  `git add` no índice próprio aplica a mesma regra de fim de linha de sempre; o `git reset` no fim
  ressincroniza o índice compartilhado, senão o arquivo aparece como "preparado ao contrário" para as
  outras sessões:

```bash
cd /c/projeto/VerAI
F=scripts/prisma-producao.ps1 && IDX=$(mktemp) && PAI=$(git rev-parse main)
GIT_INDEX_FILE=$IDX git read-tree $PAI && GIT_INDEX_FILE=$IDX git add -- "$F"
NOVO=$(printf 'chore(deploy): prisma migrate em producao pela conexao direta\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>\n' | git commit-tree $(GIT_INDEX_FILE=$IDX git write-tree) -p $PAI)
git update-ref refs/heads/main $NOVO $PAI && git reset -q -- "$F" && rm -f $IDX && git log --oneline -1
```

---

### Task 2: Fechar a release no main

**Files:** os das frentes aprovadas em D1 (commit de cada frente pela sessão dona ou, com ok do usuário, por esta sessão, sempre com índice próprio).

**Interfaces:**
- Produces: `RELEASE` = hash do commit que vai para produção (anotar em "Andamento").

- [x] **Step 1** (🤖): listar o que está pendente e agrupar por frente.

Run: `git status --porcelain` e `git diff --cached --stat`
Expected: as frentes A–D de D1. Arquivo que não se encaixa em nenhuma frente vira pergunta ao usuário, nunca commit.

- [x] **Step 2** (🤖): ~~conferir que a **única** mudança de schema pendente é a da frente A~~ — em 28/09 o classificador barrou esse `git diff`; foi trocada pela conferência mais forte da Task 3 Step 3b (migrações aplicadas do zero num banco descartável × `schema.prisma`).

Run: `git diff -- prisma/schema.prisma`
Expected: só `arquivoClienteId` (e a relação) em `PropostaComercialArquivo`/`ArquivoCliente`, casando com `prisma/migrations/20260925190000_proposta_arquivo_do_cliente/migration.sql`: `ADD COLUMN "arquivoClienteId"`, índice e FK `ON DELETE SET NULL`. Qualquer outra diferença: parar e perguntar.

- [x] **Step 3** (`f015d46`) (🤖 ou sessão dona): frente A commitada com os testes dela verdes.

Run: `npx jest src/app/api/propostas-comerciais src/lib/propostas src/lib/arquivos "src/app/clientes/\[id\]/abas"`
Expected: PASS. Depois, commit só dos arquivos da frente A (índice próprio, como na Task 1 Step 3).

- [x] **Step 4** (`f4a30e3`; ConfereAI = tela nova, já no HEAD) (🤖 ou sessões donas): frentes B, C e D conforme D1, cada uma com os testes dela verdes e commit próprio. A que ficar fora continua só no working tree, e isso já a deixa fora da release.
- [ ] **Step 5** (🤖): fixar a release.

Run: `git rev-parse main`
Expected: um hash. Anotar como `RELEASE` em "Andamento". O main pode continuar andando; a release não muda.

---

### Task 3: Worktree da release e verificação completa

**Files:** nenhum no repositório (cria `C:\projeto\VerAI-release`).

**Interfaces:**
- Consumes: `RELEASE` (Task 2).
- Produces: worktree `C:\projeto\VerAI-release` verificado (testes, tipos, build).

- [ ] **Step 1** (🤖): criar o worktree. `node_modules` fica como junção para o do projeto (nunca `npm install` nem `prisma generate` lá), e o `.vercel` é copiado.

```bash
cd /c/projeto/VerAI
git worktree add C:/projeto/VerAI-release -b release/2026-09-main $RELEASE
powershell -Command "New-Item -ItemType Junction -Path C:\projeto\VerAI-release\node_modules -Target C:\projeto\VerAI\node_modules | Out-Null; Copy-Item -Recurse C:\projeto\VerAI\.vercel C:\projeto\VerAI-release\.vercel"
```

- [ ] **Step 2** (🤖): o conteúdo dos hotfixes está na release.

Run (em `C:/projeto/VerAI-release`):
- `git diff --stat hotfix/proposta-r2 HEAD -- src/lib/r2.ts src/lib/propostas/envio.ts src/lib/propostas/imagens.ts src/lib/envio-r2-navegador.ts src/app/api/propostas-comerciais/envio src/app/propostas-comerciais/novo/page.tsx "src/app/api/propostas-comerciais/[id]/imagens"`
- `grep -c "ehEnderecoDeEnvio\|putR2(chaveOriginalProposta" src/app/api/propostas-comerciais/route.ts`
- `git merge-base --is-ancestor 74e588b HEAD && grep -n "maxDuration = 300" src/app/api/confere/reports/route.ts`

Expected: o primeiro diff vazio; o `grep -c` ≥ 2; a última linha mostra `export const maxDuration = 300` (conserto do 504 contido).

- [ ] **Step 3** (🤖): tipos e testes.

Run: `npx tsc --noEmit` e `npx jest`
Expected: `tsc` sem saída e código 0; jest com todas as suítes verdes. Suíte vermelha: parar e entender antes de seguir (em 24/09 havia suítes falhando por `showModal` no jsdom — conferir se ainda é isso).

- [ ] **Step 3b** (🤖): migrações × `schema.prisma` num banco **descartável**. É o que o Neon vai ficar depois da Task 6. O banco é criado no Postgres local do Docker (`verai-postgres`) e apagado no fim; **nunca** o banco de dev (memória `nunca-shadow-no-banco-dev`). O mesmo teste pega campo sem migração e migração que não aplica do zero, na ordem.

```bash
cd /c/projeto/VerAI-release
BASE=$(grep -E '^DATABASE_URL=' C:/projeto/VerAI/.env.development | head -1 | cut -d= -f2- | tr -d '"\r')
USUARIO=$(echo "$BASE" | sed -E 's#^[a-z]+://([^:@]+).*#\1#')
DESC=$(echo "$BASE" | sed -E 's#/[^/?]+(\?|$)#/verai_conferencia_release\1#')
docker exec verai-postgres createdb -U "$USUARIO" verai_conferencia_release
DATABASE_URL="$DESC" npx prisma migrate deploy | tail -2
npx prisma migrate diff --from-url "$DESC" --to-schema-datamodel prisma/schema.prisma --script
docker exec verai-postgres dropdb -U "$USUARIO" verai_conferencia_release
```
Expected:
- o `migrate deploy` aplica as 39 migrações e termina em `All migrations have been successfully applied.`;
- o `migrate diff` mostra no máximo `DROP INDEX "ArquivoCliente_clienteId_sha256_ativo_key";`. É o índice único parcial criado à mão, que o schema não sabe descrever, e é esperado.

Qualquer outra linha é campo do schema sem migração, que quebraria produção. **Parar** e corrigir no main (nova release).

- [ ] **Step 4** (🤖): build de produção local. Aqui é `npx next build`, não `npm run build`: este roda `prisma generate` e reescreveria o client no `node_modules` compartilhado. O `.next` do worktree é separado do dev.

Run: `npx next build --turbopack` (se reclamar de variável: `npx dotenv -e C:/projeto/VerAI/.env.development -- npx next build --turbopack`)
Expected: `✓ Compiled successfully` e a tabela de rotas, com `/api/propostas-comerciais/envio` e `/api/sharepoint/atualizacao` nela.

---

### Task 4: Backup e retrato do banco de produção

**Interfaces:**
- Consumes: `scripts/prisma-producao.ps1` (Task 1, dentro da release).
- Produces: branch de backup no Neon; lista exata das migrações pendentes em produção.

- [ ] **Step 1** (👤): no console do Neon → projeto do VerAI → **Branches** → **Create branch** a partir do branch de produção, "current point in time", nome `antes-main-AAAA-MM-DD`.
Expected: o branch aparece na lista. É a volta do banco (Task "Volta").
- [ ] **Step 2** (👤): retrato das migrações.

Run: `powershell -ExecutionPolicy Bypass -File C:\projeto\VerAI-release\scripts\prisma-producao.ps1 -Comando status`
Expected: `Banco: ep-nameless-term-…neon.tech` (host **sem** `-pooler`) e a lista "have not yet been applied", com pelo menos `20260925190000_proposta_arquivo_do_cliente`, `20260926100000_assistente_referencias`, `20260926110000_assistente_fichas` e `20260928120000_atualizacao_sharepoint`. Colar a saída na conversa.

- [ ] **Step 3** (🤖): conferir a lista. Toda pendente tem de ser uma das 23 analisadas em "Por que nessa ordem". Migração marcada como `failed` ou "modified after applied", ou nome fora da lista: **parar**.

---

### Task 5: Variáveis de produção

**Interfaces:**
- Produces: `CRON_SECRET` (e, conforme D2/D3, `ASSISTENTE_AI_*` e remoção de `DEV_AUTH_*`) em Production, **antes** do deploy — variável só vale para deploy feito depois dela.

- [ ] **Step 1** (👤): gerar e cadastrar o segredo do cron diário (`vercel.json`: `/api/assistente/indexar/cron`, `0 9 * * *` UTC = 6h em São Paulo). Sem ele a rota recusa tudo (401), o que é seguro mas não indexa. Rodar dentro de `C:\projeto\VerAI-release`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
```bash
node "C:/Users/p017886/AppData/Local/npm-cache/_npx/69f9afb961c37556/node_modules/vercel/dist/vc.js" env add CRON_SECRET production
```
(cola o valor gerado quando pedir)

- [ ] **Step 2** (👤, só se D3 pedir): `env add ASSISTENTE_AI_PROVIDER production`, `env add ASSISTENTE_AI_MODEL production` (`deepseek-chat`), `env add ASSISTENTE_AI_API_KEY production`.
- [ ] **Step 3** (👤, só se D2 pedir): `env rm DEV_AUTH_ENABLED production` e `env rm DEV_AUTH_TOKEN production`. Antes, confirmar que existe usuário admin com senha para entrar.
- [ ] **Step 4** (🤖): `vc.js env ls production` lista os nomes esperados (só nomes; valores ficam ocultos).

---

### Task 6: Migrações em produção (janela de ~15 min)

- [ ] **Step 1** (🤖): `powershell -ExecutionPolicy Bypass -File C:\projeto\VerAI\scripts\agendador-sharepoint.ps1 -Estado`. Esperar a rodada da hora cheia ou da meia hora terminar; começar logo depois (xx:05 ou xx:35).
- [ ] **Step 2** (👤): pausar o agendador. Uma rodada no meio da migração cairia com erro e sujaria o log.

```bash
powershell -Command "Disable-ScheduledTask -TaskName 'VerAI - Sincronizar SharePoint' | Select-Object TaskName, State"
```
Expected: `State` = `Disabled`.

- [ ] **Step 3** (👤): aplicar.

Run: `powershell -ExecutionPolicy Bypass -File C:\projeto\VerAI-release\scripts\prisma-producao.ps1 -Comando deploy`
Expected: cada pendente da Task 4 em "Applying migration …" e, no fim, `All migrations have been successfully applied.` A `20260923182055_assistente_ia` faz `CREATE EXTENSION IF NOT EXISTS unaccent`, que o Neon permite; se recusar, parar.

- [ ] **Step 4** (👤): `-Comando status` → `Database schema is up to date!`
- [ ] **Step 5** (👤): o site **antigo** continua de pé com o banco novo. Em `https://verai-virid.vercel.app`: login, Proposta Comercial (lista abre) e ConfereAI (tela abre).

**Se o Step 3 falhar:** não rodar de novo. Copiar o erro e parar. O Prisma marca a migração como falha e cada caso se decide com o usuário. Banco estragado → Task "Volta" (banco).

---

### Task 7: Deploy do código

**Interfaces:**
- Consumes: worktree da release (Task 3), migrações aplicadas (Task 6), variáveis (Task 5).
- Produces: `DEPLOY_ANTERIOR` e `DEPLOY_NOVO` (anotar em "Andamento").

- [ ] **Step 1** (🤖, ou 👤 se o classificador barrar): `vc.js inspect verai-virid.vercel.app` → anotar o id atual como `DEPLOY_ANTERIOR`.
- [ ] **Step 2** (👤): subir. O `--cwd` fixa a pasta; nunca rodar da pasta `C:\projeto\VerAI`.

```bash
node "C:/Users/p017886/AppData/Local/npm-cache/_npx/69f9afb961c37556/node_modules/vercel/dist/vc.js" deploy --prod --cwd "C:/projeto/VerAI-release"
```
Expected: `Production: https://verai-….vercel.app` depois de ~3–5 min de build na Vercel.

- [ ] **Step 3** (🤖/👤): `vc.js inspect verai-virid.vercel.app` → id novo (`DEPLOY_NOVO`), estado `Ready`.

**Se o build falhar na Vercel:** produção não muda. Ler o log (`vc.js inspect <url do deploy> --logs`), corrigir no main e voltar para a Task 2 com nova release. As migrações já aplicadas não se repetem.

---

### Task 8: Agendador de volta e cargas

- [ ] **Step 1** (👤): `powershell -Command "Enable-ScheduledTask -TaskName 'VerAI - Sincronizar SharePoint' | Select-Object TaskName, State"` → `Ready`.
- [ ] **Step 2** (🤖): depois da próxima rodada, ler o fim de `logs/sincronizar-sharepoint.log`.
  Expected: `TUDO NO VERAI` e `codigo 0`. As linhas `data das telas: pulada`, `índice do assistente: pulado` e `fichas: pulado` **somem**, porque agora as três etapas rodam. Se fichas ou índice reclamarem de chave de IA, é D3/D5: o agendador lê `.env.production.local` + `.env.local`, e nenhum dos dois tem `AI_*` hoje.
- [ ] **Step 3** (👤, D5): relatório de reconciliação, que só lê.

Run: `npx dotenv -e .env.production.local -- npx tsx scripts/reconciliar-clientes.ts` (em `C:\projeto\VerAI`)
Expected: relatório por cliente. `--aplicar` só depois de o usuário ler.

- [ ] **Step 4:** pendentes até o Blob voltar (~24/10/2026), registrados em "Andamento":
  - `scripts/migrar-documentos-para-repositorio.ts`: baixa cada Documento para calcular o hash.
  - `scripts/migrar-sharepoint-lugar-certo.ts --apagar-copias --aplicar`: apaga as cópias antigas no Blob.

---

### Task 9: Teste em produção com o usuário

- [ ] **Step 1** (👤, 🤖 acompanhando `vc.js logs` se o classificador deixar): percorrer e marcar.
  - Login.
  - **Relatórios dos clientes:** a lista abre; depois da primeira rodada do agendador aparece "Documentos do SharePoint atualizados em …" em cinza.
  - **Ficha de um cliente:** cartões com os números; aba Contratos (histórico, PC/PA e TC/TA abrem a janela, SEI clicável); aba Documentos (arquivos do SharePoint abrem).
  - **ConfereAI:** escolher uma planilha → busca do contrato → gerar relatório. Tem que baixar DOCX e XLSX sem 504.
  - **Proposta Comercial:** Nova conversão com um PDF → abre convertida → "Conferir totais" roda.
  - **Assistente** (Ctrl+K): uma pergunta simples sobre um cliente responde com link.
- [ ] **Step 2:** o que **segue quebrado** (Blob, D6) e não conta como falha da subida: envio manual na aba Documentos, PDFs de relatório, PDF do faturamento, histórico do ConfereAI (a geração funciona, só não guarda) e envio de Documento para análise.
- [ ] **Step 3** (🤖, no dia seguinte): o cron das 6h respondeu 200 (log da Vercel ou `IndiceDocumento` atualizado).

---

### Task 10: Fechamento

- [ ] **Step 1** (👤, só se D4 = sim): GitHub igual à produção. O push dispara um build na Vercel do **mesmo** commit. Rodar no **Git Bash**, trocando `RELEASE` pelo hash anotado:

```bash
VERAI_LIBERAR_PUSH=1 git -C /c/projeto/VerAI push origin RELEASE:main
```
Depois, com o usuário: apagar `.git/hooks/pre-push` e tirar o aviso do topo de `.claude/commands/deploy.md`.

- [ ] **Step 2** (🤖): remover os worktrees `C:\projeto\VerAI-hotfix-confere-504`, `C:\projeto\VerAI-hotfix-proposta-r2` e `C:\projeto\VerAI-release` com `git worktree remove <pasta>`. Os branches ficam, como histórico.
- [ ] **Step 3** (🤖): docs, num commit só de docs com índice próprio:
  - planos com a produção marcada: `2026-09-23-sharepoint-lugar-certo.md` Task 14, `2026-09-24-sharepoint-automacao.md` Task 2, `2026-09-28-sharepoint-atualizado-em.md`, assistente (fases 1 e 2), `2026-09-25-confere-contrato-do-cadastro.md`, `2026-09-28-envio-proposta-r2.md`;
  - `CLAUDE.md` sem as frases de "produção roda hotfix" e "push travado".
- [ ] **Step 4** (🤖): memórias atualizadas: `confere-504-orcamento-tempo`, `vercel-blob-suspenso`, `sharepoint-lugar-certo`, `assistente-ia`, `relatorios-clientes-proximos-passos`, `repositorio-documentos-cliente` e `confere-contrato-do-cadastro`.
- [ ] **Step 5:** próximo plano: Blob → R2 do resto (D6). Pista: o servidor já lê e apaga `r2:`. Trocar o `putUpload` do `storage.ts` por gravação no R2 resolve de uma vez relatório, faturamento, histórico do ConfereAI e envio de Documento. Só o envio da aba Documentos precisa do link pré-assinado, com o mesmo desenho da proposta. Atenção: o `deleteUploadPrefix` lista no Blob e não tem par no R2.

---

### Volta (só se preciso, com o ok do usuário)

- **Código:** `vc.js rollback` (👤). No Hobby ele volta para o deploy de produção anterior, que é o `DEPLOY_ANTERIOR`. O banco fica migrado, e isso é compatível (ver "Por que nessa ordem").
- **Banco:** só se dado estragou. No Neon, restaurar a partir do branch `antes-main-…` (👤). Perde tudo o que foi gravado depois do backup: a sincronização regrava arquivos e contratos, mas edição feita à mão se perde.
