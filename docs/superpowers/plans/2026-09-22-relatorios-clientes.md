# Relatórios dos clientes — migração do GRC-1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking. **Este plano está em grão de tarefa — a Task 1 já tem
> os campos definidos (ver design doc §4), mas as Tasks 3–8 (uma por domínio de CRUD) ainda
> precisam de uma passada de detalhamento — decidir validação de campo, formato de tela, e se tem
> exclusão — antes de virarem passo a passo com testes, como as tasks completas em
> `docs/superpowers/plans/2026-08-19-clientes-fundacao.md` fazem. Não pule essa passada.**

**Goal:** Migrar o sistema legado GRC-1 (Access, `ControleGEN-1.accdb`) inteiro para dentro do
VerAI — cadastro completo (não só consulta) de clientes, fornecedores, contratos, faturamento e
demandas — para permitir a descontinuação do Access.

**Architecture:** Ver `docs/superpowers/specs/2026-09-22-relatorios-clientes-design.md` — resumo:
12 models Prisma novos (mapeamento completo no design doc §4), um script de importação que lê o
`.accdb` via `mdbtools` e faz upsert idempotente (por `legacyId`), e uma tela por domínio dentro do
grupo de menu "Relatórios dos clientes" — cada uma com criar/editar, seguindo os padrões já usados
em `/admin/usuarios` e `/clientes` (rota REST + página client-component com fetch nativo — **não**
axios, o projeto não usa axios em lugar nenhum, ver `src/lib/confere/cliente.ts` como referência de
padrão de chamada HTTP server-side).

**Tech Stack:** Next.js 15 (App Router, Turbopack), React 19, Prisma 6/Postgres, Tailwind 4, Jest +
Testing Library.

## Global Constraints

- **Migração de corte único, não sincronização periódica** — ver design doc §3.2. O script de
  importação é idempotente (upsert por `legacyId`), pra suportar reimportações de ajuste antes do
  corte final, mas não é um job recorrente.
- **`Tipo` no histórico do contrato, não entidades separadas** — ver design doc §3.5.
- **Saldo calculado no nível de contrato** — ver design doc §3.6.
- Todo texto de UI/erro em português, seguindo o vocabulário já usado no projeto ("não
  autenticado", "acesso negado", etc.).
- Convenção de commit: `git commit -m "tipo: descrição"` em português, terminando com
  `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.
- Referência completa: `docs/superpowers/specs/2026-09-22-relatorios-clientes-design.md`.

---

### Task 1: Schema Prisma — os 12 models novos + extensão de `Cliente`

**Status:** Concluída (commit `74c3097`). Relatório completo:
`.superpowers/sdd/2026-09-22-relatorios-clientes/task-1-report.md`.

**Files:**
- Modify: `prisma/schema.prisma`
- Add: `prisma/migrations/20260922133255_relatorios_clientes_grc1/migration.sql`

**Interfaces:**
- Produces: `Cliente` estendido (+ `siglaLegado`, `endereco`, `numero`, `bairro`,
  `responsaveis`, `fornecedorTermos`, `contratos`, `faturamentos`, `demandas`, `solicitacoes`);
  models novos `ResponsavelCliente`, `Fornecedor`, `ContratoOperacionalizacao`,
  `TermoConfirmacao`, `Contrato`, `HistoricoContrato` (enum `TipoHistoricoContrato`),
  `ItemContrato`, `Faturamento`, `NotaFiscal`, `Demanda`, `TramiteDemanda`, `Solicitacao`.

- [x] **Step 1:** Escrever os 12 models no `schema.prisma`, seguindo o mapeamento campo a campo do
      design doc §4 — cada um com `legacyId Int? @unique` para a importação idempotente (§3.2 do
      design doc). Ressalva: design doc só tem lista de campos completa pra `Cliente`/
      `ResponsavelCliente`; pra `Fornecedor`, `ContratoOperacionalizacao`, `TermoConfirmacao` e
      `Contrato` (cabeçalho) os campos foram inferidos/inventados — lista completa no relatório da
      Task 1, risco já aceito pelo usuário.
- [x] **Step 2:** Gerar e rodar a migration. `prisma migrate dev` não funciona neste ambiente
      (não-interativo); contornado com `prisma migrate diff --from-url ... --script` +
      `prisma migrate deploy` (mesmo efeito, SQL conferido contra o schema antes de aplicar) —
      detalhe no relatório da Task 1.
- [x] **Step 3:** Commit isolado do schema/migration — `74c3097`.

---

### Task 2: Script de importação do `.accdb`

**Status:** Concluída, com concerns. Relatório completo:
`.superpowers/sdd/2026-09-22-relatorios-clientes/task-2-report.md`.

**Files:**
- Create: `scripts/importar-grc1.ts`

**Interfaces:**
- Consumes: caminho de um `.accdb` local (argumento de linha de comando)
- Produces: upsert idempotente em todos os 12 models da Task 1, na ordem que respeita as FKs
  (Cliente/Fornecedor primeiro → Contrato/ContratoOperacionalizacao → HistoricoContrato/
  ItemContrato/TermoConfirmacao/Faturamento/Demanda → NotaFiscal/TramiteDemanda)

- [x] **Step 1:** Mecanismo de leitura decidido: **não `mdbtools`** (a máquina que rodou esta
      task é Windows, sem `mdbtools`/`apt`, e sem toolchain de build nativo pra instalar algo como
      `node-odbc`). Rota escolhida, sem dependência nova nenhuma no `package.json`:
      `child_process.execFileSync('powershell.exe', ['-EncodedCommand', ...])` abrindo
      `System.Data.OleDb.OleDbConnection` (provider `Microsoft.ACE.OLEDB.16.0`, já registrado no
      Windows) e devolvendo o resultado via arquivo JSON temporário (não pelo stdout — os dois
      caminhos óbvios, script `.ps1` em disco e stdout capturado, quebram encoding de
      identificador/valor acentuado no PowerShell 5.1; detalhe completo no cabeçalho de
      `scripts/importar-grc1.ts` e no relatório da Task 2). Em outro ambiente (Linux, com
      `mdbtools`), o mecanismo de leitura precisaria ser reescrito — só a função `queryAccess()`
      muda, o resto do script (parsing/mapeamento/upsert) é agnóstico à origem.
- [x] **Step 2:** Uma função de import por tabela, na ordem de dependência de FK acima, cada uma
      fazendo upsert por `legacyId`.
- [x] **Step 3:** Rodado contra a cópia de teste do usuário. Números batem só parcialmente com os
      esperados aqui (a cópia de teste tem menos linhas que a produção nalgumas tabelas, e duas
      tabelas — `T_ItensContrato` e `T_Propostas` — têm um problema de integridade referencial nos
      dados que reduz bastante o quanto dá pra importar; **concern**, ver relatório completo da
      Task 2 antes de rodar contra o arquivo de produção.
- [x] **Step 4:** Commit.

---

### Task 3: Cliente — extensão + tela de Responsáveis

**Status:** Não iniciada. *(precisa de passada de detalhamento — ver nota no topo)*

- [ ] Adaptar `/clientes` e `/clientes/[id]` (já existentes) para os campos novos de `Cliente`
      (sigla, endereço) e a lista de `ResponsavelCliente`
- [ ] Cadastro (criar/editar) de responsável dentro da ficha do cliente
- [ ] Decidir: tem exclusão de responsável? (Access tem — confirmar se replica)

### Task 4: Fornecedores — cadastro completo

**Status:** Não iniciada. *(precisa de passada de detalhamento)*

- [ ] Rota + página `/fornecedores` — lista e cadastro de `Fornecedor`
- [ ] `ContratoOperacionalizacao` (CO) e `TermoConfirmacao` — dentro da ficha do fornecedor ou do
      contrato de cliente (`Contrato`)? Decidir na hora de desenhar a tela
- [ ] Validação de campos (formato de SEI, acordo) — a definir com o usuário

### Task 5: Contratos — Contrato, HistoricoContrato, ItemContrato

**Status:** Não iniciada. *(precisa de passada de detalhamento — é o domínio maior)*

- [ ] Cadastro de `Contrato` (cabeçalho) dentro da ficha do cliente (`/clientes/[id]`)
- [ ] Subtela/subform de `HistoricoContrato` — criar linha com `tipo` (Contrato/Aditivo/
      Prorrogação/Rescisão/Prospecção), mesmo padrão do "Histórico do Contrato" do Access (design
      doc §3.5)
- [ ] Cadastro de `ItemContrato`
- [ ] Cálculo e exibição do saldo (design doc §3.6): `ItemContrato.valorTotal` do contrato menos
      `NotaFiscal.valor` dos faturamentos ligados — decidir se é uma query sob demanda ou um campo
      calculado/cacheado
- [ ] Telas de consulta cross-cliente (vencimento com semáforo de urgência, valor total por
      cliente) — replicar o padrão visto em "Acompanhamento de vencimento - GEN-1" e "VALOR TOTAL
      DOS CONTRATOS DA GRC-1"

### Task 6: Faturamento — Faturamento, NotaFiscal

**Status:** Não iniciada. *(precisa de passada de detalhamento)*

- [ ] Cadastro de `Faturamento` (mês/ano, contrato, SEI, unidade destino, enviado cliente/GFP)
- [ ] Subform de `NotaFiscal` dentro do faturamento
- [ ] Tela de consulta "SEIs por cliente" / "Status Faturamento Mês" — replicar as visões já vistas
      no Access

### Task 7: Demandas — Demanda, TramiteDemanda, Solicitacao

**Status:** Não iniciada. *(precisa de passada de detalhamento)*

- [ ] Cadastro de `Demanda` + subform de `TramiteDemanda` (histórico de posição/ação)
- [ ] Cadastro de `Solicitacao` (chamados de TI)
- [ ] Decidir se esses dois ficam dentro de "Relatórios dos clientes" ou viram grupo próprio no
      menu — são sobre cliente indiretamente (Secretaria/Cliente), mas o conteúdo é operacional,
      não contratual

### Task 8: Navegação — sub-áreas do grupo "Relatórios dos clientes"

**Status:** Não iniciada. *(depende das Tasks 3–7 estarem com rota definida)*

- [ ] Confirmar com o usuário a proposta de rotas do design doc §3.7
- [ ] `src/components/nav-bar.tsx` — sub-itens do grupo "Relatórios dos clientes", mesmo padrão do
      sub-item "Histórico" em "ConfereAI"
- [ ] Testes de navegação atualizados

### Task 9: Atualizar os docs deste plano

**Status:** Contínua — fazer ao final de cada task acima.

- [ ] Marcar cada task como concluída neste arquivo conforme for terminando
- [ ] Registrar no design doc qualquer decisão nova tomada durante a implementação que não estava
      prevista (ex.: mecanismo final de leitura do `.accdb`, se ItensContrato tem exclusão)
