# Sincronização SharePoint "ContratosReceita" → repositório do cliente — Implementation Plan

**Goal:** trazer (e manter atualizados) os termos da biblioteca ContratosReceita pro `ArquivoCliente`,
via pasta sincronizada pelo OneDrive + script agendado no Windows.

**Architecture:** spec `docs/superpowers/specs/2026-09-24-sincronizacao-sharepoint-contratos-design.md`
(ler §4 e §5). Regras puras em `src/lib/arquivos/sharepoint/regras.ts` (testadas sem banco); orquestração
em `src/lib/arquivos/sharepoint/sincronizar.ts` recebendo `prisma`, fonte (lista/lê arquivos) e storage
injetáveis — mesmo desenho de `migracao-documentos.ts`; script fino em `scripts/sincronizar-sharepoint.ts`.

## Global Constraints

- Conferir a migração: se aparecer `DROP INDEX "ArquivoCliente_clienteId_sha256_ativo_key"`, remover a linha.
- Nunca criar cliente; nunca apagar blob de arquivo que já foi registrado; remoção sempre lógica e só sem uso.
- Outra sessão commita na mesma árvore: adicionar só os arquivos da task, nunca `git add -A`.

### Task 1: Migração — `OrigemArquivo.sharepoint` + `ArquivoSharepoint` ✅
- `prisma/schema.prisma`, `prisma/migrations/20260924150000_sincronizacao_sharepoint/migration.sql`
- Aba Documentos mostra "SharePoint" como origem (`lista-arquivos.tsx`)

### Task 2: Regras puras ✅
- `src/lib/arquivos/sharepoint/regras.ts` + `regras.test.ts`: `normalizarChave`, `deveIgnorar`,
  `resolverCliente` (sigla → mapa → null), `pastaContratoDe`, `mudouPorMetadado`.

### Task 3: Orquestração ✅
- `src/lib/arquivos/sharepoint/sincronizar.ts` + `sincronizar.test.ts`: presentes primeiro, ausentes
  depois (spec §4 itens 5–8), relatório `ResultadoSincronizacao`, modo simulação sem gravar.

### Task 4: Script + agendador ✅
- `scripts/sincronizar-sharepoint.ts` (`--aplicar`, `--incluir-work`, `--pasta=`), fonte = sistema de arquivos.
- `scripts/sharepoint-clientes.json` (mapa pasta → sigla / `null` pra ignorar).
- `scripts/sincronizar-sharepoint.bat` (Agendador de Tarefas; grava `logs/sincronizar-sharepoint.log`).

### Task 5: Primeira carga (usuário)
- [ ] `npx dotenv -e .env.production.local -- npx prisma migrate deploy`
- [ ] Rodar sem `--aplicar`, conferir pastas sem cliente, completar `sharepoint-clientes.json`
- [ ] Rodar com `--aplicar`; criar a tarefa no Agendador

### Task 6: Importação no fluxo de cliente ✅
- Migração `20260924160000_chave_sharepoint_contrato` (`chaveSharepoint` em Contrato e HistoricoContrato)
- `src/lib/importacao-sharepoint/estrutura.ts`, `texto.ts`, `pdf-texto.ts`, `importar.ts` (+ testes)
- `scripts/importar-sharepoint-contratos.ts`; `sharepoint-clientes.json` ganhou `pastas` e `nomes`; .bat roda importar + sincronizar
- [ ] Usuário: `migrate deploy`, rodar sem `--aplicar`, conferir, rodar com `--aplicar`

### Próximo (fora deste plano)
- OCR dos ~28% de termos escaneados (datas/valor hoje ficam pra preencher na tela).
- Sugerir vínculo arquivo → linha do histórico pelo `pastaContrato` + nome do termo.
- Trocar a fonte por Microsoft Graph (delta) quando a TI liberar `Sites.Selected`.
