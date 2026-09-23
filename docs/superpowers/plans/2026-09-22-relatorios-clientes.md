# Relatórios dos clientes — migração do GRC-1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking. **A passada de detalhamento das Tasks 3–8 foi feita em
> 22/09/2026 — decisões com o usuário na seção "Decisões da passada de detalhamento" (depois da
> Task 2). Cada task lista arquivos, rotas, validação e testes; o código fica com o implementador,
> seguindo as "Convenções técnicas".**

**Goal:** Migrar o sistema legado GRC-1 (Access, `ControleGEN-1.accdb`) inteiro para dentro do
VerAI — cadastro completo (não só consulta) de clientes, fornecedores, contratos, faturamento e
demandas — para permitir a descontinuação do Access.

**Architecture:** Ver `docs/superpowers/specs/2026-09-22-relatorios-clientes-design.md` — resumo:
12 models Prisma novos (mapeamento completo no design doc §4), um script de importação que lê o
`.accdb` (PowerShell + OleDb no Windows — ver Task 2) e faz upsert idempotente (por `legacyId`), e uma tela por domínio dentro do
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
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` (as Tasks 1–2 usaram
  `Claude Sonnet 5`).
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

**Status:** Concluída, com concerns. Fix round 1 aplicado (22/09/2026): decisão do usuário de
importar todas as linhas de `T_ItensContrato` mesmo sem vínculo confiável de contrato —
`ItemContrato.contratoId` virou opcional + `contratoTextoLegado` novo (migração
`20260922143856_item_contrato_contrato_opcional`), aplicada no Postgres local. Rodado de novo
contra a cópia de teste: `T_ItensContrato` lidas=879, importadas=879, puladas=0 (0 delas com
`contratoId` resolvido — confirma o achado original de que não há chave de junção nos dados reais);
idempotente (rodado duas vezes, saída idêntica). `npx jest`: 507 passed, 7 skipped, 0 failed (68
suites). Relatório completo (incl. "Fix round 1"):
`.superpowers/sdd/2026-09-22-relatorios-clientes/task-2-report.md`. Ver também design doc §3.6
(revisão 22/09/2026) para a consequência no cálculo de saldo do contrato.

**Files:**
- Create: `scripts/importar-grc1.ts`
- Modify: `prisma/schema.prisma` (fix round 1 — `ItemContrato.contratoId` opcional)
- Add: `prisma/migrations/20260922143856_item_contrato_contrato_opcional/`

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

## Decisões da passada de detalhamento (22/09/2026, com o usuário)

Tomadas antes de detalhar as Tasks 3–8 — valem para todas elas (registradas também no design doc
§3.8):

- **Exclusão só nos subitens**: responsável, CO, termo de confirmação, linha de histórico do
  contrato, item de contrato, nota fiscal, trâmite. Cabeçalhos (cliente, fornecedor, contrato,
  faturamento, demanda, solicitação) só criar/editar — nenhuma rota `DELETE` para eles.
- **Validação mínima**: obrigatórios óbvios (listados em cada task), valores numéricos ≥ 0, datas
  válidas (`AAAA-MM-DD`), mês 1–12. SEI, nº de termo e demais códigos são **texto livre** (os dados
  importados têm formatos variados). Texto vazio/só espaço vira `null`.
- **Navegação**: tudo sob o grupo "Relatórios dos clientes". Sub-itens: Todos os documentos (já
  existe), Fornecedores, Demandas, Solicitações, Relatórios (`/relatorios` — as consultas
  cross-cliente). Contratos e Faturamento vivem **dentro da ficha do cliente** (`/clientes/[id]`),
  como abas — layout de referência: `docs/superpowers/specs/2026-09-22-relatorios-clientes-mockup.html` (abas
  Contratos · Faturamento · Fornecedores · Demandas · Responsáveis, mais a aba Documentos com o
  conteúdo que a página já tem hoje).
- **Permissão** (decisão do controller, sem pergunta — segue o que já existe): ler e escrever
  qualquer registro ligado a um cliente exige `getAuthUser` + `podeVerCliente(usuario, clienteId)`
  (`src/lib/visibilidade.ts`); listas cross-cliente filtram por `clientesVisiveisWhere`.
  `Fornecedor` e `ContratoOperacionalizacao` não pertencem a cliente: exigem só autenticação.
  Respostas: 401 `{ error: 'não autenticado' }`, 403 `{ error: 'acesso negado' }`, 404
  `{ error: '<coisa> não encontrado(a)' }`, 400 `{ error: '<mensagem do campo>' }`.
- **Saldo** (§3.6): calculado sob demanda na leitura (agregação no Prisma), sem campo cacheado.
- **Colunas do Access sem destino**: onde a task precisa de um campo que o relatório da Task 2
  listou como "sem coluna dedicada no schema", a própria task adiciona o campo no schema
  (migração nova, gerada com `prisma migrate diff` + `prisma migrate deploy` no banco LOCAL de
  `.env.development`, como na Task 1) e atualiza o mapeamento em `scripts/importar-grc1.ts`. Nome
  real da coluna vem de uma consulta ao `.accdb` de teste pela `queryAccess()` do script — nunca
  chutado.

## Convenções técnicas (todas as Tasks 3–8)

- API: rotas REST em `src/app/api/...`, padrão de `src/app/api/clientes/[clienteId]/route.ts`
  (`params: Promise<...>`, `NextResponse.json`). Corpo validado com **zod** (já no projeto).
  `Decimal` sai no JSON como string (`.toString()`), datas como ISO.
- Helpers compartilhados (criados na Task 3, usados pelas seguintes) em
  `src/lib/relatorios-clientes/`:
  - `validacao.ts` — pré-processadores zod: `textoOpcional` (trim, `''`→`null`), `textoObrigatorio`
    (trim, mínimo 1), `decimalOpcional` / `decimalObrigatorio` (aceita `"1.234,56"`, `"1234.56"`,
    número; rejeita negativo; devolve string normalizada `"1234.56"`), `dataOpcional`
    (`AAAA-MM-DD` → `Date` UTC, `''`→`null`, rejeita data inválida como `2026-02-30`),
    `booleanoOpcional`; e `lerCorpo(request, schema)` que devolve `{ dados } | { erro: NextResponse }`
    com a primeira mensagem do zod em português.
  - `acesso.ts` — `exigirUsuario(request)` e `exigirAcessoCliente(request, clienteId)` que devolvem
    `{ usuario } | { erro: NextResponse }` (401/403).
  - `formatacao.ts` — `formatarMoeda(valor: string | number | null)` (`R$ 1.234,56`, `—` p/ null),
    `formatarData(iso | null)` (`dd/mm/aaaa`, `—`).
- UI: client components com `fetch` nativo, classes de `src/lib/ui.ts` (`BTN_PRIMARY`,
  `BTN_OUTLINE`, `INPUT_BASE`, `LINK_DANGER`...), `card`, ícones `lucide-react`, cabeçalho com
  breadcrumb no padrão de `src/app/clientes/[id]/page.tsx`. Formulário de criar/editar abre inline
  ou em painel na própria página — sem biblioteca de modal nova. Exclusão pede confirmação inline
  ("Excluir? Sim / Não"), **nunca `window.confirm`**.
- Testes (TDD — teste falhando antes do código): cada rota nova ganha `route.test.ts`
  (`@jest-environment node`, `getAuthUser` e `@/lib/prisma` mockados, no padrão de
  `src/app/api/auth/me/route.test.ts`) cobrindo 401, 403, 400 de validação, 404 e o caminho feliz;
  cada helper puro ganha teste unitário; cada página/componente novo ganha um teste de
  Testing Library cobrindo render com dados + o fluxo principal de criar (fetch mockado).
- Commit por task (pode ser mais de um), mensagem em português, terminando com
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. `npx jest` e `npx tsc --noEmit`
  verdes antes de cada commit.

---

### Task 3: Base compartilhada + ficha do cliente com abas + Responsáveis

**Status:** Concluída (commits `5d01667` e `edf2a85` — fix round 1: decimal ambíguo como "1.500" é rejeitado). Review de subagente limpa.

**Files:**
- Create: `src/lib/relatorios-clientes/{validacao,acesso,formatacao}.ts` (+ `.test.ts` de cada)
- Modify: `src/app/api/clientes/[clienteId]/route.ts` (+ test) — GET devolve também
  `siglaLegado, endereco, numero, bairro`; novo `PATCH`
- Create: `src/app/api/clientes/[clienteId]/responsaveis/route.ts` (GET, POST) + test
- Create: `src/app/api/responsaveis/[id]/route.ts` (PATCH, DELETE) + test
- Modify: `src/app/api/clientes/route.ts` — lista devolve também `siglaLegado`
- Modify: `src/app/clientes/[id]/page.tsx` (+ test) — vira ficha com abas
- Create: `src/app/clientes/[id]/abas/{aba-documentos,aba-responsaveis}.tsx` (+ tests)
- Modify: `src/app/clientes/lista-clientes.tsx` (+ test) — mostra a sigla

**Interfaces produzidas (usadas pelas Tasks 4–8):** os três helpers acima; o componente de abas da
ficha com a prop/const `ABAS` (`documentos`, `contratos`, `faturamento`, `fornecedores`,
`demandas`, `responsaveis`), aba ativa em `?aba=` na URL (default `contratos` quando existir
conteúdo, senão `documentos` — nesta task, default `documentos`), e um placeholder
"Em construção" para as abas que as Tasks 4–7 vão preencher (cada uma troca o placeholder pelo
componente `aba-<nome>.tsx` dela).

- [x] **Step 1:** Helpers com testes (validação: casos `"1.234,56"`→`"1234.56"`, `-1`→erro,
      `"2026-02-30"`→erro, `"  "`→`null`; acesso: 401 sem usuário, 403 sem permissão, ok com admin;
      formatação: `1234.5`→`R$ 1.234,50`, `null`→`—`, `"2026-09-22T00:00:00.000Z"`→`22/09/2026`).
- [x] **Step 2:** `PATCH /api/clientes/[clienteId]` — campos `nome` (obrigatório), `siglaLegado`,
      `endereco`, `numero`, `bairro` (opcionais). Sigla normalizada em maiúsculas; colisão de
      `nome` ou `siglaLegado` (`P2002`) → 409 `{ error: 'já existe cliente com esse nome/sigla' }`.
- [x] **Step 3:** Responsáveis — `GET/POST /api/clientes/[clienteId]/responsaveis` (ordenado por
      nome; `nome` obrigatório; `area, email, telefone, celular` opcionais; e-mail, se vier, validado
      como e-mail), `PATCH/DELETE /api/responsaveis/[id]` (checa acesso pelo `clienteId` do registro).
- [x] **Step 4:** Ficha do cliente: cabeçalho com sigla (badge), nome, endereço
      (`endereco, numero — bairro`) e botão "Editar cliente" (form inline com os 5 campos).
      Abas conforme o mockup. Aba **Documentos** = o conteúdo atual da página (competências +
      nova competência), movido sem mudança de comportamento — os testes existentes de
      `src/app/clientes/[id]/page.test.tsx` continuam passando (ajustar só seletor, não asserção).
      Aba **Responsáveis** = cartões como no mockup + criar/editar/excluir.
- [x] **Step 5:** Lista `/clientes` mostra a sigla ao lado do nome.
- [x] **Step 6:** Commit.

---

### Task 4: Fornecedores — cadastro, CO e termos de confirmação

**Status:** Concluída (commits `d4b7975`, `445b485`, `e43bc9c` e o commit das telas). Colunas
acrescentadas (migração `20260922170000_fornecedor_co_termo_colunas_legado`, aplicada no Postgres
local): `Fornecedor.acordo/numeroAcordo/dataAssinatura/sei`, `ContratoOperacionalizacao.sei`,
`TermoConfirmacao.numero/valor/vigenciaFim/sei` e `data` → `vigenciaInicio` (RENAME). No Access,
`Valor` e `Contrato Receita` do termo são **texto**: o que não parseia vai pra `observacao`.
Ficou de fora: `T_TermoConfirmação.[Nº CO]` (inteiro sem uso claro; `ContratoDespesa` já liga o
CO). Reimport: T_Fornecedor 4/4, T_CO 1/1, T_TermoConfirmação 0 (vazia na cópia de teste).
Novos helpers compartilhados: `respostaErroPrisma` (P2025→404, P2003→400) e `lerCorpo(..., rotulos)`
(rótulo em português na mensagem de erro). "Fornecedores" entrou como sub-item do menu.
**Pendência pra Task 5:** o formulário de termo (`src/components/relatorios-clientes/secao-termos.tsx`)
mostra o contrato ligado, mas ainda não tem seletor de contrato — depende da listagem
`GET /api/clientes/[clienteId]/contratos` da Task 5; a API do termo já valida `contratoId`.

**Decisão de tela:** CO (`ContratoOperacionalizacao`) vive na ficha do fornecedor. Termo de
confirmação (ponte fornecedor ↔ cliente/contrato) aparece nos dois lados: ficha do fornecedor e aba
"Fornecedores" da ficha do cliente — mesma API.

**Files:**
- Modify (se precisar): `prisma/schema.prisma` + migração nova + `scripts/importar-grc1.ts` —
  conferir as colunas reais de `T_Fornecedor`, `T_CO_Operacionalização` e `T_TermoConfirmação` no
  `.accdb` de teste; o mockup pede no termo **nº do TC, valor, vigência (início–fim) e processo
  SEI** — acrescentar em `TermoConfirmacao` os que a origem tem (`numero String?`,
  `valor Decimal? @db.Decimal(14,2)`, `vigenciaInicio/vigenciaFim DateTime?`, `sei String?`) e
  mapear no import. Idem para qualquer coluna de `T_Fornecedor`/CO que hoje é descartada. Registrar
  no relatório o que foi acrescentado e o que ficou de fora.
- Create: `src/app/api/fornecedores/route.ts` (GET com `?q=` por razão social/CNPJ, POST),
  `src/app/api/fornecedores/[id]/route.ts` (GET com COs e termos, PATCH),
  `src/app/api/fornecedores/[id]/cos/route.ts` (POST), `src/app/api/cos/[id]/route.ts` (PATCH,
  DELETE), `src/app/api/termos-confirmacao/route.ts` (GET `?clienteId=` ou `?fornecedorId=`, POST),
  `src/app/api/termos-confirmacao/[id]/route.ts` (PATCH, DELETE) — todos com test
- Create: `src/app/fornecedores/page.tsx` (lista + busca + "Novo fornecedor"),
  `src/app/fornecedores/[id]/page.tsx` (cabeçalho editável, lista de CO, lista de termos) + tests
- Create: `src/app/clientes/[id]/abas/aba-fornecedores.tsx` (+ test) — tabela do mockup
  (Fornecedor, Nº do TC, Contrato ligado, Valor, Vigência, Processo SEI) + "Novo termo de confirmação"

**Validação:** fornecedor — `razaoSocial` obrigatório. CO — `fornecedorId` da URL; `dataFim` ≥
`dataInicio` quando ambas vierem. Termo — `fornecedorId` e `clienteId` obrigatórios; `contratoId`
opcional mas, se vier, tem que ser um `Contrato` **do mesmo cliente** (400 senão); acesso checado
pelo `clienteId`.

- [x] **Step 1:** Levantar colunas no `.accdb`, schema + migração + import (se houver campo novo);
      rodar o import de novo no banco local e registrar contagens.
- [x] **Step 2:** Rotas de fornecedor e CO com testes.
- [x] **Step 3:** Rotas de termo com testes (incluindo contrato de outro cliente → 400).
- [x] **Step 4:** Páginas `/fornecedores`, `/fornecedores/[id]` e aba Fornecedores do cliente.
- [x] **Step 5:** Commit.

---

### Task 5: Contratos — cabeçalho, histórico, itens e saldo

**Status:** Concluída (commits `e2c5221`, `aad5087`, `72c3702` e o commit das telas). Colunas
acrescentadas (migração `20260922200000_contrato_historico_colunas_legado`, aplicada no Postgres
local): `Contrato.descricao/dataInicio/dataVencimento/vigente/linkSei` (`Término` do Access é o
vencimento; `Link SEI` é hiperlink do Access, gravado sem os `#`) e
`HistoricoContrato.objeto/proposta/situacao/dataInicio/dataVencimento/dataEnvio` (situação e proposta
deixaram de ir concatenadas em `observacao`). Ficou de fora: os objetos OLE (Documento, Contrato,
PublicaçãoDOM, Minuta, DocProposta, TA — Word embutido) e, em `T_ItensContrato`, Contr/Rev/Plan/Item,
Classe, Anexo, vigência do item, Cod Prod e Unid. Reimport: T_ContratoReceita 37/42 (5 de cliente fora
dos 6), T_Propostas 64/187 (121 sem contrato resolvido, 2 sem tipo). Saldo agregado no banco
(`saldosDosContratos`: groupBy dos itens + SQL das notas fiscais via faturamento) — conferido no
Postgres local contra soma direta (R$ 66.558.200,95 no TC 142/2021). **Atenção:** o saldo só faz
sentido com TODOS os itens do contrato vinculados; com vínculo parcial ele fica negativo (a barra fica
vermelha acima de 100%). O seletor de contrato no termo de confirmação (pendência da Task 4) entrou
aqui. A aba padrão da ficha continua `documentos` (minor da Task 3, não tratado).

**Files:**
- Modify: `prisma/schema.prisma` + migração + `scripts/importar-grc1.ts` — conferir colunas reais de
  `T_ContratoReceita`: o mockup e a consulta "Acompanhamento de vencimento" precisam de
  **descrição/objeto** e **data de vencimento (fim de vigência)** do contrato — acrescentar
  `descricao String?` e `dataVencimento DateTime?` em `Contrato` (e o que mais a origem tiver de
  valor/vigência) e mapear. Se a origem **não** tiver vencimento no cabeçalho, `dataVencimento`
  fica editável na tela e o import deixa `null` — registrar no relatório.
- Create: `src/lib/relatorios-clientes/saldo.ts` (+ test) —
  `calcularSaldo({ valorItens, faturado })` → `{ valorItens, faturado, saldo, percentualFaturado }`
  (strings decimais; `percentualFaturado` `null` quando `valorItens` = 0).
- Create: `src/lib/relatorios-clientes/vencimento.ts` (+ test) —
  `situacaoVencimento(dataVencimento: Date | null, hoje: Date)` →
  `{ nivel: 'vencido' | 'critico' | 'atencao' | 'ok' | 'sem-data', dias: number | null }` com
  limites: `< 0` vencido, `≤ 30` crítico, `≤ 90` atenção, senão ok.
- Create: `src/app/api/clientes/[clienteId]/contratos/route.ts` (GET lista com `saldo` e
  `situacaoVencimento` de cada contrato; POST),
  `src/app/api/contratos/[id]/route.ts` (GET com histórico ordenado por data, itens e saldo; PATCH),
  `src/app/api/contratos/[id]/historico/route.ts` (POST),
  `src/app/api/historico-contrato/[id]/route.ts` (PATCH, DELETE),
  `src/app/api/contratos/[id]/itens/route.ts` (POST),
  `src/app/api/itens-contrato/route.ts` (GET `?semContrato=1&q=` — itens importados sem vínculo,
  busca por `contratoTextoLegado`/`descricao`, só admin ou usuário que vê algum cliente),
  `src/app/api/itens-contrato/[id]/route.ts` (PATCH — inclusive `contratoId`, pra reconciliação;
  DELETE) — todos com test
- Create: `src/app/clientes/[id]/abas/aba-contratos.tsx` (+ test) — tabela do mockup (Nº do termo,
  Descrição, SEI cliente, Situação, Vencimento com semáforo, Valor dos itens, % faturado) + "Novo
  contrato"; clicar na linha abre o detalhe
- Create: `src/app/clientes/[id]/contratos/[contratoId]/page.tsx` (+ test) — cabeçalho editável;
  **histórico** como linha do tempo única (tipo em badge — Contrato/Aditivo/Prorrogação/Rescisão/
  Prospecção —, nº, data, valor, observação) com criar/editar/excluir; **itens** em tabela com
  criar/editar/excluir; **saldo** num cartão; botão "Vincular itens importados" que busca na rota
  `?semContrato=1` e seta `contratoId`.

**Saldo** = soma de `ItemContrato.valorTotal` (itens com `contratoId` = este contrato) − soma de
`NotaFiscal.valor` dos `Faturamento` deste contrato. Como quase todos os itens importados vieram
sem vínculo (design doc §3.6, revisão da Task 2), o cartão de saldo mostra aviso explícito quando o
contrato não tem item nenhum: "Sem itens vinculados — saldo não calculável. Vincule os itens
importados ou cadastre os itens do contrato." (nunca mostra saldo negativo enganoso nesse caso:
`saldo` = `null` quando `valorItens` = 0).

**Validação:** contrato — `clienteId` da URL; `numeroTermo` obrigatório na criação/edição pela tela
(o import aceita nulo). Histórico — `tipo` obrigatório (enum `TipoHistoricoContrato`). Item —
`valorTotal` obrigatório ≥ 0; se `quantidade` e `valorUnitario` vierem e `valorTotal` não, calcula
`quantidade × valorUnitario`. `contratoId` num PATCH de item tem que existir e o usuário tem que ver
o cliente dele.

- [x] **Step 1:** Colunas do `.accdb`, schema + migração + import; reimportar e registrar contagens.
- [x] **Step 2:** `saldo.ts` e `vencimento.ts` com testes.
- [x] **Step 3:** Rotas de contrato/histórico/itens com testes.
- [x] **Step 4:** Aba Contratos e página de detalhe do contrato (com vinculação de itens). Incluir o
      seletor de contrato no formulário de termo de confirmação (pendência da Task 4).
- [x] **Step 5:** Commit.

---

### Task 6: Faturamento — faturamento mensal e notas fiscais

**Status:** Concluída (commits `2a96c52`, `11ecc14` e o commit das telas). Colunas acrescentadas
(migração `20260922220000_faturamento_nota_colunas_legado`, aplicada no Postgres local):
`Faturamento.sei/complementar/observacao/unidadeDestino/enviadoCliente/enviadoGfp` e
`NotaFiscal.servico/quantidade/complementar`. **Desvio do plano:** no Access o "Serviço" é coluna
da nota fiscal, não do faturamento — ficou em `NotaFiscal.servico`, e a tela do faturamento mostra
os serviços distintos das notas dele (não há `Faturamento.servico`). Ficou de fora: `Mês_Fat`
(data redundante com Mês/Ano). A origem não tem nº da nota fiscal: `numero` fica nulo no import
(editável na tela). Reimport: T_Faturamentos 601/635 (28 contrato não resolvido, 6 cliente),
T_NotaFiscal 85/158 (73 com faturamento não resolvido). Valor exibido = `Faturamento.valor` ou soma
das notas — conferido contra soma direta no Postgres local (R$ 4.823.713,15, TC 142/2021, 01/2023).
Novo validador compartilhado `inteiroEntre(min, max)`; a regra "contrato do mesmo cliente" foi
movida para `src/app/api/contratos/carregar.ts` (termo e faturamento usam a mesma).

**Files:**
- Modify: `prisma/schema.prisma` + migração + `scripts/importar-grc1.ts` — o relatório da Task 2
  lista `OBS`, `SEI` e `UnidadeDestino` de `T_Faturamentos` sem destino, e o mockup/plano pedem
  **SEI do faturamento, serviço, unidade destino, enviado ao cliente, enviado à GFP**: acrescentar
  em `Faturamento` o que a origem tiver (`sei String?`, `servico String?`, `unidadeDestino String?`,
  `enviadoCliente Boolean?`, `enviadoGfp Boolean?`, `observacao String?`) e mapear.
- Create: `src/app/api/clientes/[clienteId]/faturamentos/route.ts` (GET com filtros `?ano=&mes=&
  contratoId=`, cada linha com `valorNotas` = soma das notas; POST),
  `src/app/api/faturamentos/[id]/route.ts` (GET com notas; PATCH),
  `src/app/api/faturamentos/[id]/notas/route.ts` (POST),
  `src/app/api/notas-fiscais/[id]/route.ts` (PATCH, DELETE) — todos com test
- Create: `src/app/clientes/[id]/abas/aba-faturamento.tsx` (+ test) — tabela do mockup (Contrato,
  Competência `MM/AAAA`, SEI, Serviço, Valor, Enviado cliente, Enviado GFP) com filtro de
  competência e contrato + "Novo faturamento"
- Create: `src/app/clientes/[id]/faturamentos/[faturamentoId]/page.tsx` (+ test) — cabeçalho
  editável + subform de notas fiscais (nº, valor, data de emissão) com criar/editar/excluir

**Valor exibido** do faturamento = `Faturamento.valor` se preenchido, senão a soma das notas (o
import deixa `valor` nulo — a origem não tem essa coluna).

**Validação:** faturamento — `contratoId` obrigatório e do mesmo cliente (400 senão),
`competenciaAno` (2000–2100) e `competenciaMes` (1–12) obrigatórios na tela. Nota — `valor`
obrigatório ≥ 0.

- [x] **Step 1:** Colunas do `.accdb`, schema + migração + import; reimportar e registrar contagens.
- [x] **Step 2:** Rotas com testes.
- [x] **Step 3:** Aba Faturamento e página do faturamento.
- [x] **Step 4:** Commit.

---

### Task 7: Demandas (com trâmite) e Solicitações

**Status:** Concluída (commits `3d62ce5`, `33e7f66` e o commit das telas). Colunas acrescentadas
(migração `20260922230000_demanda_tramite_solicitacao_colunas_legado`, aplicada no Postgres local):
`Demanda.tipoAssunto/documento/sei/notaImportacao`,
`TramiteDemanda.responsavelAtual/dataRetorno/comApresentacao/assinado` e
`Solicitacao.numero/dataFinal/comVisita/observacao` — tipo de assunto, responsável atual e nº do
chamado deixaram de ir concatenados em outro campo. **Decisão do usuário (22/09/2026):** 109 das 136
demandas do GRC-1 não têm cliente válido (60 com cliente vazio, 49 com ID apagado de `T_Cliente`) e
entram na **SMS**, com `Demanda.notaImportacao` registrando a atribuição. A tela de demandas tem o
filtro "Só com cliente atribuído no import" e a demanda mostra um aviso; trocar o cliente pelo
"Editar demanda" limpa a nota. Já se vê no dado real que parte delas não é da SMS (ex.: 5 com
"SMTUR" no texto). Reimport: T_Documento 136/136 (antes 27), T_Trâmite 338/369 (antes 71; 31 sem
demanda), T_Solicitação 107/112 (5 de secretaria fora dos 6 clientes). Sugestões (`<datalist>`) vêm
dos valores já existentes no banco, os mais usados primeiro. Todas as abas da ficha do cliente estão
prontas — o placeholder "Em construção" foi removido. Demandas e Solicitações entraram no menu
aqui (a Task 8 fica com "Relatórios").

**Files:**
- Modify: `prisma/schema.prisma` + migração + `scripts/importar-grc1.ts` — relatório da Task 2
  lista `Documento`/`SEI` de `T_Documento` e `DataRetorno`/`ComApresentação`/`Assinado` de
  `T_Trâmite` sem destino: acrescentar `Demanda.documento`, `Demanda.sei`,
  `TramiteDemanda.dataRetorno`, `TramiteDemanda.comApresentacao`, `TramiteDemanda.assinado` (tipos
  conforme a origem) e mapear.
- Create: `src/app/api/demandas/route.ts` (GET cross-cliente filtrado por `clientesVisiveisWhere`,
  filtros `?clienteId=&situacao=&q=`, cada linha com a posição do último trâmite e a data dele;
  POST), `src/app/api/demandas/[id]/route.ts` (GET com trâmites; PATCH),
  `src/app/api/demandas/[id]/tramites/route.ts` (POST),
  `src/app/api/tramites-demanda/[id]/route.ts` (PATCH, DELETE),
  `src/app/api/solicitacoes/route.ts` (GET com filtros `?clienteId=&situacao=`; POST),
  `src/app/api/solicitacoes/[id]/route.ts` (PATCH) — todos com test
- Create: `src/app/demandas/page.tsx` (lista cross-cliente com filtros + "Nova demanda"),
  `src/app/demandas/[id]/page.tsx` (cabeçalho editável + trâmite em linha do tempo com
  criar/editar/excluir), `src/app/solicitacoes/page.tsx` (lista + criar/editar inline) + tests
- Create: `src/app/clientes/[id]/abas/aba-demandas.tsx` (+ test) — tabela do mockup (Assunto, Tipo,
  Responsável, Posição atual, Desde, Status) só das demandas do cliente, + "Nova demanda"

**Validação:** demanda — `clienteId` e `assunto` obrigatórios. Trâmite — `data` obrigatória.
Solicitação — `clienteId` e `descricao` obrigatórios. `situacao`, `tipo`, `posicao`, `acao`
continuam texto livre, mas a tela oferece sugestões (`<datalist>`) com os valores distintos já
existentes no banco (rota GET devolve `sugestoes` junto) — resolve o minor deferido da Task 1
sobre valores enum-like sem documentação.

- [x] **Step 1:** Colunas do `.accdb`, schema + migração + import; reimportar e registrar contagens.
- [x] **Step 2:** Rotas com testes.
- [x] **Step 3:** Páginas `/demandas`, `/demandas/[id]`, `/solicitacoes` e aba Demandas do cliente.
- [x] **Step 4:** Commit.

---

### Task 8: Relatórios cross-cliente, indicadores da ficha e navegação

**Status:** Concluída em 23/09/2026 (commits `04625e0`, `01c4490`, `b6f6f3a`; inline, smoke test com dados reais no banco local OK). Desvios do texto abaixo, todos registrados no design doc §3.9: a regra de "ativo" ficou em `src/lib/relatorios-clientes/regras.ts` (junto de `demandaAberta` e `competenciaValida`), não em `vencimento.ts`, e ganhou `finaliz`/`conclu` — os valores reais são "Finalizado"/"Concluído"; o status do faturamento inclui também encerrados que tenham faturamento no mês; "Fornecedores", "Demandas" e "Solicitações" já estavam no menu desde a Task 7, aqui entrou só "Relatórios" + item ativo nas sub-rotas (com `aria-current`). Com os dados atuais, valor contratado sai R$ 0 (itens sem vínculo) e o faturado do último mês também (notas fiscais só até mar/2026).

**Files:**
- Create: `src/app/api/relatorios/vencimentos/route.ts` (contratos de todos os clientes visíveis
  com `situacaoVencimento`, ordenados pelos que vencem primeiro),
  `src/app/api/relatorios/valor-total/route.ts` (por cliente: nº de contratos, soma de itens,
  faturado, saldo), `src/app/api/relatorios/seis/route.ts` (SEIs de contrato e de faturamento por
  cliente, filtro `?clienteId=`), `src/app/api/relatorios/status-faturamento/route.ts` (`?ano=&mes=`:
  para cada contrato ativo, se tem faturamento na competência, valor, enviado cliente/GFP) — todos
  com test, todos filtrados por `clientesVisiveisWhere`
- Create: `src/app/relatorios/page.tsx` (+ test) — quatro abas: Vencimento (semáforo por cor, mesmo
  `vencimento.ts`), Valor total por cliente, SEIs por cliente, Status do faturamento do mês
- Create: `src/app/api/clientes/[clienteId]/indicadores/route.ts` (+ test) e os 4 cartões do topo da
  ficha do cliente (mockup): Contratos ativos (+ quantos vencem em 30 dias), Valor contratado,
  Faturado no último mês com faturamento, Demandas abertas (+ quantas há mais de 30 dias)
- Modify: `src/components/nav-bar.tsx` (+ `nav-bar.test.tsx`) — `RELATORIOS_SUBLINKS` ganha
  Fornecedores (`/fornecedores`), Demandas (`/demandas`), Solicitações (`/solicitacoes`),
  Relatórios (`/relatorios`), mantendo "Todos os documentos"; item ativo também em sub-rotas
  (`/fornecedores/[id]`, `/demandas/[id]`); conferir que aparecem com `MENU_SIMPLIFICADO = true`.

"Contrato ativo" = `situacao` não contém "encerr"/"rescind"/"cancel" (case-insensitive) e
vencimento não passou — regra num helper testado em `vencimento.ts`.

- [x] **Step 1:** Rotas de relatório e indicadores com testes.
- [x] **Step 2:** Página `/relatorios` e cartões da ficha.
- [x] **Step 3:** Navegação + testes.
- [x] **Step 4:** Commit.

---

### Task 9: Atualizar os docs deste plano

**Status:** Concluída em 23/09/2026 — plano e design doc (§3.9) atualizados até a Task 8.

- [x] Marcar cada task como concluída neste arquivo conforme for terminando
- [x] Registrar no design doc qualquer decisão nova tomada durante a implementação que não estava
      prevista (ex.: mecanismo final de leitura do `.accdb`, se ItensContrato tem exclusão)
