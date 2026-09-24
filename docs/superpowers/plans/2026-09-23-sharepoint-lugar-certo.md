# SharePoint → VerAI: tudo no lugar certo, sempre — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** a aba Documentos de cada cliente tem sempre todos os arquivos da pasta dele no SharePoint, e a aba Contratos recebe cada pasta de termo na linha certa do histórico — mover, renomear ou trocar arquivo no SharePoint nunca duplica nem deixa PDF velho.

**Architecture:** spec `docs/superpowers/specs/2026-09-23-sharepoint-lugar-certo-design.md` (ler inteiro antes da Task 1). Uma execução só (`scripts/sincronizar-sharepoint.ts`) faz: clientes → arquivos no repositório (`ArquivoCliente` + estado `ArquivoSharepoint`) → estrutura dos termos que mudaram → contrato e linha por identidade estável (`identidade.ts`) → colunas PC/PA–TC/TA **por referência** ao `ArquivoCliente` → ausentes → conferência. Regras puras testadas sem banco; orquestração recebe `prisma`, fonte e storage injetáveis (mesmo desenho de hoje).

**Tech Stack:** Next.js 15 (App Router), TypeScript, Prisma 6/Postgres, Jest, Vercel Blob, `tsx` para scripts.

## Andamento (24/09/2026)

- ✅ Tasks 0–12 concluídas na `main` (b86fde9 base, b868ea7, 0aa53f0, 357dfe2, 44a9c81, 5a472b6, 67cb0db,
  7445422, f624fc9, e93934d, 07aa23b, 92b8313, 565e452) + ajuste da migração 4e9931d.
- ⏸ Task 13 parada no Step 2: o **Vercel Blob estourou o limite do plano Hobby (1 GB)** — 980 MB, dos
  quais 849 MB são as cópias que o importador antigo gravou a partir do dev em 23/09; toda leitura pública
  devolve 403 e toda gravação falha ("Storage quota exceeded for Hobby plan"). Feito em dev: migração dos
  dados aplicada (SUB-ITP e SMIT TC 52 fundidos, idempotente) e listagem da sincronização com a amostra
  (277 arquivos, 1 contrato novo, 17 linhas novas — aditivos que o importador antigo perdeu quando o Blob
  lotou —, 218 PDFs ligados, 0 falhas). Gravação depende da decisão do usuário sobre o armazenamento.
- Desvios do plano, descobertos na execução: (1) cópia de linha vinda do SharePoint não é baixada — a
  sincronização religa ao original (`--incluir-sharepoint` para sobras); a trava só exige anexos à mão;
  (2) fusão de linhas reconhece o PDF pelo nome da cópia e trata contrato inicial como único por contrato;
  (3) Task 3 Step 7 (chave da lista de usos no painel) já estava feito em 13ac5f5.
- ✅ Depois do R2 (24/09): biblioteca inteira em dev, conferência 1.171/1.171 (spec §10.2); auditoria
  automática das contas a cada execução, fusão da cópia do SharePoint no contrato do legado (etapa 2b da
  migração) e régua da leitura (`scripts/regua-sharepoint.ts`) — spec §10.3. Falta a Task 14 (produção,
  com OK do usuário a cada passo) e a Task 15 (limpeza).
- Base já vinha com 19 suítes de teste falhando (maioria `el.showModal is not a function` no jsdom);
  nenhuma falha nova. Lista em `falhas-base` da sessão; `sincronizar.test.ts` voltou a passar.

## Global Constraints

- Spec manda: `docs/superpowers/specs/2026-09-23-sharepoint-lugar-certo-design.md`. Onde este plano e o spec divergirem, pare e pergunte.
- Migração nova com carimbo **maior** que o último em `prisma/migrations` (hoje `20260924160000`) — o repositório está adiantado em relação ao relógio. Conferir o SQL gerado: se aparecer `DROP INDEX "ArquivoCliente_clienteId_sha256_ativo_key"`, **remover a linha** (índice único parcial criado à mão).
- Outras sessões commitam na `main`: `git add` só os arquivos da task, **nunca** `git add -A` / `git commit -a`.
- Nenhum script grava sem `--aplicar`.
- Cliente só nasce de **pasta de cliente** (`garantirClientes`); publicação do DOC nunca cria cliente.
- `urlBlob` nunca vai para o navegador; PDF é servido por `/api/arquivos/[id]`.
- Testes: `npx jest <caminho>`. Tipos: `npx tsc --noEmit -p .` **sem erro novo**. Base de 23/09 (antes deste plano): 7 erros em `src/app/api/clientes/[clienteId]/faturamentos/route.ts`, `src/app/clientes/[id]/abas/documentos/lista-arquivos.tsx`, `src/app/clientes/[id]/contratos/[contratoId]/page.test.tsx` (2), `src/lib/arquivos/sharepoint/sincronizar.test.ts`, `src/lib/assistente/ferramentas/comum.test.ts` (2). As Tasks 1 e 9 eliminam os de `lista-arquivos.tsx` e `sincronizar.test.ts`.
- Dev e produção usam o **mesmo** Vercel Blob (o token vem de `.env.local`): em dev a sincronização roda só com `--clientes=` (Task 13). A biblioteca inteira (1,15 GB) sobe só em produção (Task 14).
- Comentários, nomes e mensagens em português, no estilo dos arquivos vizinhos.

---

### Task 0: Pré-requisito — base da sincronização commitada

O código atual da sincronização (`src/lib/arquivos/sharepoint/`, `src/lib/importacao-sharepoint/`, `scripts/*sharepoint*`, migrações `20260924120000`–`20260924160000`, `prisma/schema.prisma`) está **no disco sem commit**, junto com trabalho de consistência de contratos de outra sessão. Este plano altera esses arquivos; sem a base commitada, cada commit daqui levaria o trabalho alheio junto.

**Files:** nenhum.

- [ ] **Step 1: Conferir se a base está commitada**

Run:
```bash
git status --short -- prisma src/lib/arquivos/sharepoint src/lib/importacao-sharepoint scripts/sincronizar-sharepoint.ts scripts/sincronizar-sharepoint.bat scripts/importar-sharepoint-contratos.ts scripts/sharepoint-clientes.json src/lib/relatorios-clientes src/app/api/historico-contrato src/app/api/contratos
```
Expected: saída vazia. **Se aparecer qualquer linha, PARE** e peça ao usuário que a sessão dona (as sessões `verai-*` abertas) commite o trabalho dela, ou que ele autorize explicitamente commitar essa base como `chore: base da sincronização SharePoint e consistência de contratos (trabalho da sessão anterior)`. Não siga para a Task 1 com esses caminhos sujos.

- [ ] **Step 2: Linha de base de testes e tipos**

Run: `npx jest src/lib/arquivos src/lib/importacao-sharepoint src/lib/relatorios-clientes src/app/api/historico-contrato src/app/api/contratos`
Expected: tudo passando (anote o total).

Run: `npx tsc --noEmit -p . 2>&1 | grep -E "^(src|scripts)" | sed -E 's/\(.*//' | sort | uniq -c`
Expected: exatamente os 7 erros listados em Global Constraints.

- [ ] **Step 3: Banco de dev em dia**

Run: `npx dotenv -e .env.development -- npx prisma migrate status`
Expected: `Database schema is up to date!`

---

### Task 1: Migração — referências do histórico, local do arquivo no SharePoint, categoria "Publicação no DOC"

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260924170000_sharepoint_lugar_certo/migration.sql`
- Modify: `src/lib/arquivos/tipos.ts` (lista `CATEGORIAS`)
- Modify: `src/app/clientes/[id]/abas/documentos/tipos.ts` (`origem`)
- Test: `src/lib/arquivos/tipos.test.ts`

**Interfaces:**
- Produces (Prisma): `CategoriaArquivo.PUBLICACAO_DOC`; `ArquivoSharepoint.contratoId/contrato`, `historicoId/historico`; `HistoricoContrato.propostaArquivoId/propostaArquivo` (relação `"PropostaDaLinha"`), `propostaDoSharepoint: Boolean`, `termoArquivoId/termoArquivo` (`"TermoDaLinha"`), `termoDoSharepoint: Boolean`, `arquivosSharepoint`; `Contrato.arquivosSharepoint`; `ArquivoCliente.linhasComoProposta`, `linhasComoTermo`.
- Produces (TS): `rotuloCategoria('PUBLICACAO_DOC') === 'Publicação no DOC'`; `ArquivoRepositorio.origem` aceita `'sharepoint'`.

- [ ] **Step 1: Teste do rótulo novo (falhando)**

Em `src/lib/arquivos/tipos.test.ts`, acrescente (o arquivo já importa de `./tipos`; se não importar `rotuloCategoria`, inclua no import):

```ts
describe('categoria de publicação do DOC', () => {
  it('tem rótulo próprio', () => {
    expect(rotuloCategoria('PUBLICACAO_DOC')).toBe('Publicação no DOC')
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx jest src/lib/arquivos/tipos.test.ts`
Expected: FAIL — `Expected: "Publicação no DOC" Received: "PUBLICACAO_DOC"`.

- [ ] **Step 3: Schema**

Em `prisma/schema.prisma`:

`enum CategoriaArquivo` — inclua `PUBLICACAO_DOC` depois de `OFICIO_SEI`:
```prisma
  OFICIO_SEI
  PUBLICACAO_DOC
  RELATORIO_GERADO
```

`model ArquivoCliente` — depois de `sharepoint     ArquivoSharepoint[]`:
```prisma
  linhasComoProposta HistoricoContrato[] @relation("PropostaDaLinha")
  linhasComoTermo    HistoricoContrato[] @relation("TermoDaLinha")
```

`model Contrato` — junto das outras listas (`historico`, `itens`...):
```prisma
  arquivosSharepoint ArquivoSharepoint[]
```

`model HistoricoContrato` — depois de `chaveSharepoint String? @unique` (mantenha as colunas `*PdfUrl/*PdfNome` por enquanto; saem na Task 15):
```prisma
  // Colunas PC/PA e TC/TA por REFERÊNCIA ao repositório do cliente (spec
  // docs/superpowers/specs/2026-09-23-sharepoint-lugar-certo-design.md §3.4). `*DoSharepoint`: a coluna
  // foi preenchida pela sincronização e acompanha o SharePoint; `false` = anexada à mão, nunca trocada.
  propostaArquivoId    String?
  propostaArquivo      ArquivoCliente?     @relation("PropostaDaLinha", fields: [propostaArquivoId], references: [id], onDelete: SetNull)
  propostaDoSharepoint Boolean             @default(false)
  termoArquivoId       String?
  termoArquivo         ArquivoCliente?     @relation("TermoDaLinha", fields: [termoArquivoId], references: [id], onDelete: SetNull)
  termoDoSharepoint    Boolean             @default(false)
  arquivosSharepoint   ArquivoSharepoint[]
```
e, no fim do model, junto de `@@index([contratoId])`:
```prisma
  @@index([propostaArquivoId])
  @@index([termoArquivoId])
```

`model ArquivoSharepoint` — depois de `removidoNaOrigemEm DateTime?`:
```prisma
  // Onde o arquivo cai no fluxo de cliente (spec lugar-certo §3.3). `null` = sem contrato (publicação
  // do DOC, arquivo solto na pasta do cliente). `pastaContrato` fica só até a Task 15.
  contratoId  String?
  contrato    Contrato?          @relation(fields: [contratoId], references: [id], onDelete: SetNull)
  historicoId String?
  historico   HistoricoContrato? @relation(fields: [historicoId], references: [id], onDelete: SetNull)
```
e junto de `@@index([arquivoId])`:
```prisma
  @@index([contratoId])
  @@index([historicoId])
```

- [ ] **Step 4: Gerar a migração e conferir**

Run:
```bash
npx dotenv -e .env.development -- npx prisma migrate dev --create-only --name sharepoint_lugar_certo
```
O Prisma cria a pasta com o carimbo do relógio (`20260923…`), que ficaria **antes** das migrações existentes. Renomeie a pasta para `prisma/migrations/20260924170000_sharepoint_lugar_certo` (a data tem que ser maior que `20260924160000`).

Abra `migration.sql`. Deve conter, e só isso (a ordem pode variar):
```sql
ALTER TYPE "CategoriaArquivo" ADD VALUE 'PUBLICACAO_DOC';
ALTER TABLE "ArquivoSharepoint" ADD COLUMN "contratoId" TEXT, ADD COLUMN "historicoId" TEXT;
ALTER TABLE "HistoricoContrato" ADD COLUMN "propostaArquivoId" TEXT, ADD COLUMN "propostaDoSharepoint" BOOLEAN NOT NULL DEFAULT false, ADD COLUMN "termoArquivoId" TEXT, ADD COLUMN "termoDoSharepoint" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "HistoricoContrato_propostaArquivoId_idx" ON "HistoricoContrato"("propostaArquivoId");
CREATE INDEX "HistoricoContrato_termoArquivoId_idx" ON "HistoricoContrato"("termoArquivoId");
CREATE INDEX "ArquivoSharepoint_contratoId_idx" ON "ArquivoSharepoint"("contratoId");
CREATE INDEX "ArquivoSharepoint_historicoId_idx" ON "ArquivoSharepoint"("historicoId");
ALTER TABLE "HistoricoContrato" ADD CONSTRAINT "HistoricoContrato_propostaArquivoId_fkey" FOREIGN KEY ("propostaArquivoId") REFERENCES "ArquivoCliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "HistoricoContrato" ADD CONSTRAINT "HistoricoContrato_termoArquivoId_fkey" FOREIGN KEY ("termoArquivoId") REFERENCES "ArquivoCliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ArquivoSharepoint" ADD CONSTRAINT "ArquivoSharepoint_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "Contrato"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ArquivoSharepoint" ADD CONSTRAINT "ArquivoSharepoint_historicoId_fkey" FOREIGN KEY ("historicoId") REFERENCES "HistoricoContrato"("id") ON DELETE SET NULL ON UPDATE CASCADE;
```
Se aparecer `DROP INDEX "ArquivoCliente_clienteId_sha256_ativo_key"`, **apague a linha**. Qualquer outra coisa a mais (DROP/ALTER de tabela que não é destas): pare e investigue — é schema de outra sessão fora de sincronia.

Run: `npx dotenv -e .env.development -- npx prisma migrate dev`
Expected: aplica `20260924170000_sharepoint_lugar_certo` e regenera o client.

- [ ] **Step 5: Rótulo e tipo da tela**

Em `src/lib/arquivos/tipos.ts`, em `CATEGORIAS`, depois de `OFICIO_SEI`:
```ts
  { valor: 'PUBLICACAO_DOC', rotulo: 'Publicação no DOC' },
```

Em `src/app/clientes/[id]/abas/documentos/tipos.ts`:
```ts
  origem: 'upload' | 'gerado' | 'migrado' | 'sharepoint'
```

- [ ] **Step 6: Testes e tipos**

Run: `npx jest src/lib/arquivos/tipos.test.ts` → PASS.
Run: `npx tsc --noEmit -p .` → o erro de `lista-arquivos.tsx` sumiu; nenhum novo.

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260924170000_sharepoint_lugar_certo/migration.sql src/lib/arquivos/tipos.ts src/lib/arquivos/tipos.test.ts "src/app/clientes/[id]/abas/documentos/tipos.ts"
git commit -m "feat(sharepoint): colunas PC/PA–TC/TA por referência, local do arquivo no SharePoint e categoria Publicação no DOC (migração)"
```

---

### Task 2: Regras puras — aceitar tudo, publicação pela sigla no nome, categoria pelo papel, nomes tortos

**Files:**
- Modify: `src/lib/arquivos/sharepoint/regras.ts`
- Modify: `src/lib/arquivos/sharepoint/regras.test.ts`
- Modify: `src/lib/importacao-sharepoint/estrutura.ts`
- Modify: `src/lib/importacao-sharepoint/estrutura.test.ts`
- Modify: `src/lib/arquivos/sharepoint/sincronizar.ts` (só as duas chamadas de `motivoIgnorar`/`pastaContratoDe` — reescrito de verdade na Task 9)

**Interfaces:**
- Produces (`regras.ts`):
  - `siglaDaPasta(pasta: string, mapa: MapaPastas): string | null` — sigla normalizada; `null` = pasta ignorada no mapa.
  - `resolverCliente(pasta, clientes, mapa): ResolucaoCliente` (mesmo comportamento de hoje).
  - `motivoIgnorar(segmentos: string[], tamanhoBytes: number): string | null` — **sem** o 3º parâmetro.
  - `siglaNoNome(nome: string): string | null`
  - `clienteDoArquivo(segmentos, clientes, mapa, rotearPeloNome: string[]): { resolucao: ResolucaoCliente; roteadoPeloNome: boolean; rotulo: string }`
  - `type PapelArquivo = 'termo' | 'proposta' | 'outro'`
  - `categoriaSharepoint(nome: string, contexto: { papel: PapelArquivo; inicial: boolean; publicacao: boolean }): CategoriaArquivo`
  - Removido: `pastaContratoDe`.
- Produces (`estrutura.ts`):
  - `papelDoArquivo(nome: string): PapelArquivo` (exportado)
  - `TermoPasta.arquivos: string[]` — **todos** os caminhos da pasta do termo, inclusive `WORK/`.
  - `montarEstrutura(caminhos: string[], siglaDaPastaCliente?: (pasta: string) => string): ContratoPasta[]` — chave do contrato = `${sigla}|${número} ${ano}`.

- [ ] **Step 1: Testes novos de `regras.ts` (falhando)**

Em `src/lib/arquivos/sharepoint/regras.test.ts`:
1. Troque o import por:
```ts
import {
  categoriaSharepoint,
  clienteDoArquivo,
  motivoIgnorar,
  mudouPorMetadado,
  normalizarChave,
  resolverCliente,
  siglaDaPasta,
  siglaNoNome,
} from './regras'
```
2. Apague os blocos `describe('motivoIgnorar', …)` e `describe('pastaContratoDe', …)`.
3. Acrescente:

```ts
describe('siglaDaPasta', () => {
  it('pasta que é a sigla, pasta do mapa e pasta ignorada', () => {
    expect(siglaDaPasta('sms', {})).toBe('SMS')
    expect(siglaDaPasta('SUB-ITAM PAULISTA', { 'SUB-ITAM PAULISTA': 'SUB-ITP' })).toBe('SUB-ITP')
    expect(siglaDaPasta('1. PUBLICAÇÕES NO DOC', { '1. PUBLICACOES NO DOC': null })).toBeNull()
  })
})

describe('motivoIgnorar — entra tudo que é documento', () => {
  const pasta = ['SMSUB', 'TC 36-SMSUB-COGEL-2022 - GeoInfra', '1) TC 36 - Contrato Inicial']
  it('WORK, planilha, .html e extensão desconhecida entram', () => {
    expect(motivoIgnorar([...pasta, 'WORK', 'Mem_Calc.xlsx'], 10)).toBeNull()
    expect(motivoIgnorar([...pasta, 'PA-SMT-250806-092 v7.1.html'], 10)).toBeNull()
    expect(motivoIgnorar([...pasta, 'email.msg'], 10)).toBeNull()
  })
  it('fica fora só lixo técnico e o que não cabe', () => {
    expect(motivoIgnorar(['.849C9593-D756-4E56-8D6E-42412F2A707B'], 10)).toBe('arquivo solto na raiz')
    expect(motivoIgnorar([...pasta, '~$_(SMS_Sustentação)_230906-103 - v1.0.docx'], 10)).toBe('oculto ou temporário')
    expect(motivoIgnorar([...pasta, '.oculto'], 10)).toBe('oculto ou temporário')
    expect(motivoIgnorar([...pasta, 'desktop.ini'], 10)).toBe('arquivo de sistema')
    expect(motivoIgnorar([...pasta, 'Thumbs.db'], 10)).toBe('arquivo de sistema')
    expect(motivoIgnorar([...pasta, 'a.pdf'], 0)).toBe('arquivo vazio')
    expect(motivoIgnorar([...pasta, 'a.pdf'], 51 * 1024 * 1024)).toBe('acima de 50 MB')
  })
})

describe('siglaNoNome', () => {
  it.each([
    ['2026.09.17 - SIURB - Sust. de TIC - Despacho.pdf', 'SIURB'],
    ['-2026.09.18 - SMDHC - Com. Dados SD-WAN - Despacho.pdf', 'SMDHC'],
    ['2026.09.14 - SMSUB - Com. Dados SSD-WAN  - Despacho.pdf', 'SMSUB'],
    ['2026.09.17 - SUB-ST - LINC. - eXTRATO.pdf', 'SUB-ST'],
  ])('%s → %s', (nome, sigla) => expect(siglaNoNome(nome)).toBe(sigla))
  it('nome sem o padrão data - sigla - assunto', () => expect(siglaNoNome('despacho.pdf')).toBeNull())
})

describe('clienteDoArquivo', () => {
  const roteadas = ['1. PUBLICAÇÕES NO DOC']
  it('pasta de roteamento: cliente pela sigla no nome', () => {
    const r = clienteDoArquivo(['1. PUBLICAÇÕES NO DOC', '2026.09.17 - SMS - Arbitragem - Despacho.pdf'], clientes, {}, roteadas)
    expect(r).toEqual({ resolucao: { tipo: 'cliente', clienteId: 'c-sms', nome: 'Secretaria da Saúde' }, roteadoPeloNome: true, rotulo: '1. PUBLICAÇÕES NO DOC → SMS' })
  })
  it('sigla do nome que não é cliente não cria nada', () => {
    const r = clienteDoArquivo(['1. PUBLICAÇÕES NO DOC', '2026.09.17 - SUB-ST - LINC. - eXTRATO.pdf'], clientes, {}, roteadas)
    expect(r.resolucao).toEqual({ tipo: 'sem-cliente' })
    expect(r.rotulo).toBe('1. PUBLICAÇÕES NO DOC → SUB-ST')
  })
  it('pasta comum: cliente pela primeira pasta', () => {
    expect(clienteDoArquivo(['SMS', 'TC 1', 'a.pdf'], clientes, {}, roteadas)).toMatchObject({ roteadoPeloNome: false, rotulo: 'SMS' })
  })
})

describe('categoriaSharepoint', () => {
  it('pelo papel na pasta do termo', () => {
    expect(categoriaSharepoint('TC 1-2023.pdf', { papel: 'termo', inicial: true, publicacao: false })).toBe('TERMO_CONTRATO')
    expect(categoriaSharepoint('SF TA 02 ao TC 37-2019.pdf', { papel: 'termo', inicial: false, publicacao: false })).toBe('TERMO_ADITIVO')
    expect(categoriaSharepoint('Proposta PC-SF-220901-112.pdf', { papel: 'proposta', inicial: true, publicacao: false })).toBe('PROPOSTA_COMERCIAL')
    expect(categoriaSharepoint('PA-SF-220814-106 v3.0.pdf', { papel: 'proposta', inicial: false, publicacao: false })).toBe('PROPOSTA_ADITIVO')
  })
  it('publicação do DOC — pela pasta ou pelo nome', () => {
    expect(categoriaSharepoint('2026.09.17 - SMS - Arbitragem - Despacho.pdf', { papel: 'outro', inicial: false, publicacao: true })).toBe('PUBLICACAO_DOC')
    expect(categoriaSharepoint('DOC 2022-12-16 - SMSUB - Despacho.pdf', { papel: 'outro', inicial: true, publicacao: false })).toBe('PUBLICACAO_DOC')
  })
  it('demais: sugestão pelo nome; planilha sem padrão vira PLANILHA', () => {
    expect(categoriaSharepoint('SMSUB_Levantamento_TC 36.xlsx', { papel: 'outro', inicial: false, publicacao: false })).toBe('MEDICAO')
    expect(categoriaSharepoint('Mem_Calc. (SMSUB_Acesso à Rede) v1.2.xlsx', { papel: 'outro', inicial: false, publicacao: false })).toBe('PLANILHA')
    expect(categoriaSharepoint('ORDEM DE INÍCIO N° 002.pdf', { papel: 'outro', inicial: true, publicacao: false })).toBe('OUTRO')
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx jest src/lib/arquivos/sharepoint/regras.test.ts`
Expected: FAIL — `siglaDaPasta`/`siglaNoNome`/`clienteDoArquivo`/`categoriaSharepoint` não exportados.

- [ ] **Step 3: Implementar em `regras.ts`**

Troque o cabeçalho de imports por:
```ts
import type { CategoriaArquivo } from '@prisma/client'
import { TAMANHO_MAXIMO_ARQUIVO_BYTES } from '../caminhos'
import { extensaoDe, sugerirCategoria } from '../tipos'
```

Troque o comentário do topo por:
```ts
// Regras puras da sincronização com a biblioteca ContratosReceita (specs
// docs/superpowers/specs/2026-09-24-sincronizacao-sharepoint-contratos-design.md §4 e
// docs/superpowers/specs/2026-09-23-sharepoint-lugar-certo-design.md §3.1). Sem banco, sem sistema de
// arquivos — tudo aqui é testável isolado.
```

Troque `resolverCliente` por:
```ts
/** Sigla (normalizada) a que a pasta do cliente corresponde: mapa explícito primeiro, senão a própria
 *  pasta. `null` = pasta ignorada de propósito no mapa. */
export function siglaDaPasta(pasta: string, mapa: MapaPastas): string | null {
  const chave = normalizarChave(pasta)
  const entrada = Object.entries(mapa).find(([k]) => normalizarChave(k) === chave)
  if (entrada) return entrada[1] === null ? null : normalizarChave(entrada[1])
  return chave
}

/** Cliente da primeira pasta: pela sigla (pasta ou mapa). Nunca por nome do cliente — mesma regra do
 *  importador GRC-1. */
export function resolverCliente(pasta: string, clientes: ClientePorSigla, mapa: MapaPastas): ResolucaoCliente {
  const sigla = siglaDaPasta(pasta, mapa)
  if (sigla === null) return { tipo: 'ignorar' }
  const cliente = clientes.get(sigla)
  return cliente ? { tipo: 'cliente', clienteId: cliente.id, nome: cliente.nome } : { tipo: 'sem-cliente' }
}
```

Troque `motivoIgnorar` por:
```ts
const ARQUIVOS_DE_SISTEMA = new Set(['DESKTOP.INI', 'THUMBS.DB'])

/** Por que um arquivo fica de fora, ou `null` se entra. Entra TODO documento — inclusive `WORK/` e
 *  extensão desconhecida (spec lugar-certo §3.1); fora só lixo técnico e o que não cabe no Blob.
 *  `segmentos` = caminho relativo quebrado em pastas, último = nome do arquivo. */
export function motivoIgnorar(segmentos: string[], tamanhoBytes: number): string | null {
  if (segmentos.length < 2) return 'arquivo solto na raiz'
  if (segmentos.some((s) => s.startsWith('.') || s.startsWith('~$'))) return 'oculto ou temporário'
  if (ARQUIVOS_DE_SISTEMA.has(segmentos[segmentos.length - 1].toUpperCase())) return 'arquivo de sistema'
  if (tamanhoBytes === 0) return 'arquivo vazio'
  if (tamanhoBytes > TAMANHO_MAXIMO_ARQUIVO_BYTES) return 'acima de 50 MB'
  return null
}

/** Sigla do cliente no nome de uma publicação do DOC — o trecho entre o 1º e o 2º " - ":
 *  "2026.09.17 - SIURB - Sust. de TIC - Despacho.pdf" → "SIURB". */
export function siglaNoNome(nome: string): string | null {
  const partes = nome.split(/\s+-\s+/)
  if (partes.length < 3) return null
  return partes[1].trim() || null
}

/** Cliente de um arquivo. Pasta listada em `rotearPeloNome` (ex.: "1. PUBLICAÇÕES NO DOC") não é
 *  cliente: cada arquivo vai para a sigla do próprio nome. `rotulo` identifica a origem no relatório
 *  de "sem cliente". */
export function clienteDoArquivo(
  segmentos: string[],
  clientes: ClientePorSigla,
  mapa: MapaPastas,
  rotearPeloNome: string[]
): { resolucao: ResolucaoCliente; roteadoPeloNome: boolean; rotulo: string } {
  const pasta = segmentos[0]
  if (rotearPeloNome.some((p) => normalizarChave(p) === normalizarChave(pasta))) {
    const sigla = siglaNoNome(segmentos[segmentos.length - 1])
    return {
      resolucao: sigla ? resolverCliente(sigla, clientes, mapa) : { tipo: 'sem-cliente' },
      roteadoPeloNome: true,
      rotulo: `${pasta} → ${sigla ?? '(sem sigla no nome)'}`,
    }
  }
  return { resolucao: resolverCliente(pasta, clientes, mapa), roteadoPeloNome: false, rotulo: pasta }
}

export type PapelArquivo = 'termo' | 'proposta' | 'outro'

const PLANILHA = new Set(['xlsx', 'xls', 'csv'])

/** Categoria na criação do `ArquivoCliente` vindo do SharePoint (spec lugar-certo §3.1). Só vale na
 *  criação — reclassificação feita na tela não é desfeita. */
export function categoriaSharepoint(
  nome: string,
  contexto: { papel: PapelArquivo; inicial: boolean; publicacao: boolean }
): CategoriaArquivo {
  if (contexto.publicacao || /^DOC\s/i.test(nome)) return 'PUBLICACAO_DOC'
  if (contexto.papel === 'termo') return contexto.inicial ? 'TERMO_CONTRATO' : 'TERMO_ADITIVO'
  if (contexto.papel === 'proposta') return contexto.inicial ? 'PROPOSTA_COMERCIAL' : 'PROPOSTA_ADITIVO'
  const sugerida = sugerirCategoria(nome)
  if (sugerida === 'OUTRO' && PLANILHA.has(extensaoDe(nome))) return 'PLANILHA'
  return sugerida
}
```

Apague a função `pastaContratoDe` inteira. `mudouPorMetadado` e `normalizarChave` ficam como estão.

- [ ] **Step 4: Ajuste mínimo em `sincronizar.ts` (compila até a Task 9)**

Em `src/lib/arquivos/sharepoint/sincronizar.ts`:
- no import de `./regras`, tire `pastaContratoDe`;
- troque `motivoIgnorar(segmentos, arquivo.tamanhoBytes, incluirWork)` por `motivoIgnorar(segmentos, arquivo.tamanhoBytes)`;
- troque `pastaContrato: pastaContratoDe(segmentos),` por `pastaContrato: null,`.

- [ ] **Step 5: Rodar `regras` e ver passar**

Run: `npx jest src/lib/arquivos/sharepoint/regras.test.ts`
Expected: PASS.

- [ ] **Step 6: Testes novos de `estrutura.ts` (falhando)**

Em `src/lib/importacao-sharepoint/estrutura.test.ts`:
1. Import: `import { chaveDoNome, classificarTermo, montarEstrutura, papelDoArquivo } from './estrutura'`
2. No teste `'contrato → termos, com PDF de termo e de proposta separados e WORK de fora'`, troque o nome para `'contrato → termos, com PDF de termo e de proposta separados; WORK entra nos arquivos do termo'` e a última linha por:
```ts
    expect(c.termos[1].termoPdf).toMatch(/assinado\.pdf$/)
    expect(c.termos[1].outros).toEqual(['ADESAMPA/TC 073-2019 - Acesso a Rede/2) TC 073-2019 - TA 01-2020 - acréscimo/WORK/Mem_Calc.xlsx'])
    expect(c.termos[1].arquivos).toHaveLength(2)
```
3. Acrescente:

```ts
describe('nomes tortos da pasta real', () => {
  it('espaço e hífen dobrados (SPURBANISMO)', () => {
    expect(chaveDoNome('TC  010--SP-URB-2026 - Eleição Grupo Gestão Operação Urbana Água Branca')).toEqual({ numero: '10', ano: '2026' })
  })
})

describe('papelDoArquivo', () => {
  it.each([
    ['TC 073-2019- ADESAMPA (assinado SEI).pdf', 'termo'],
    ['SF TA 02 ao TC 37-2019.pdf', 'termo'],
    ['TA125-2023 ao TC 312_2021.pdf', 'termo'],
    ['TC004-SMPED-2020 - TA 001-2020.pdf', 'termo'],
    ['PC-ADESAMPA-191007-139 v1.0.pdf', 'proposta'],
    ['Proposta PC-SF-220901-112 v1.0.pdf', 'proposta'],
    ['DOC 21-03-2024 - SMIT - TC 19-SMIT-2021 - Rescisão Amigável.pdf', 'outro'],
    ['TC 004-2020 - ORDEM DE INICIO DE SERVIÇO.pdf', 'outro'],
    ['TC 005- TCM - CONFIDENCIALIDADE - Assinado.pdf', 'outro'],
    ['Mem_Calc.xlsx', 'outro'],
  ])('%s → %s', (nome, papel) => expect(papelDoArquivo(nome)).toBe(papel))
})

describe('montarEstrutura — chave pela sigla do cliente', () => {
  const sigla = (pasta: string) => (pasta === 'SUB-ITAM PAULISTA' ? 'SUB-ITP' : pasta.toUpperCase())
  const e = montarEstrutura(
    [
      'SUB-ITP/TC 001-SUB-IT-2026 - Office 365/1) TC 001-SUB-IT-2026 - Contrato inicial/TC 001-SUB-IT-2026.pdf',
      'SUB-ITAM PAULISTA/1) TC 001-SUB-IT-2026 - Contrato Inicial/TC 001-SUB-IT-2026.pdf',
    ],
    sigla
  )
  it('duas pastas do mesmo cliente caem no mesmo contrato', () => {
    expect(e.map((c) => c.chave)).toEqual(['SUB-ITP|1 2026'])
    expect(e[0].termos).toHaveLength(2)
  })
})
```

- [ ] **Step 7: Rodar e ver falhar**

Run: `npx jest src/lib/importacao-sharepoint/estrutura.test.ts`
Expected: FAIL — `papelDoArquivo` não exportado; `chaveDoNome('TC  010--SP-URB…')` devolve `null`; chave `SUB-ITAM PAULISTA|1 2026` separada.

- [ ] **Step 8: Implementar em `estrutura.ts`**

1. Import: troque a primeira linha por
```ts
import { motivoIgnorar, normalizarChave, type PapelArquivo } from '@/lib/arquivos/sharepoint/regras'
```
2. Em `TermoPasta`, depois de `outros: string[]`:
```ts
  /** Todos os arquivos da pasta do termo, inclusive `WORK/` — é o que a aba Documentos liga a este termo. */
  arquivos: string[]
```
3. Em `ContratoPasta`, troque o comentário de `chave` por:
```ts
  /** `${sigla do cliente}|${número normalizado} ${ano}` — ex. "ADESAMPA|73 2019", "SUB-ITP|1 2026". Duas
   *  pastas do mesmo cliente caem no mesmo contrato (spec lugar-certo §3.3). */
```
4. Logo depois de `const GRUPO = …`, acrescente:
```ts
/** Nome de pasta feito à mão: espaço e hífen repetidos ("TC  010--SP-URB-2026") viram um só. */
function limparNome(nome: string): string {
  return nome.replace(/\s+/g, ' ').replace(/-{2,}/g, '-')
}
```
5. Na primeira linha do corpo de `chaveDoNome`, `numeroTermoDe`, `descricaoDe` e `classificarTermo`, troque `nome.replace(PREFIXO_ORDEM, '')` / `nomePasta.replace(PREFIXO_ORDEM, '')` por `limparNome(nome).replace(PREFIXO_ORDEM, '')` / `limparNome(nomePasta).replace(PREFIXO_ORDEM, '')`. Em `classificarTermo` a linha `const ordem = PREFIXO_ORDEM.exec(nomePasta)` continua usando o nome original.
6. Troque `function papelDoArquivo` inteira por:
```ts
/** PDF do termo (TC/TA/TAP/TRA, "termo", "assinado") e PDF da proposta (PC/PA). Publicação do DOC,
 *  ordem de início e termo de confidencialidade citam o TC no nome, mas não são o termo. */
export function papelDoArquivo(nome: string): PapelArquivo {
  if (!/\.pdf$/i.test(nome)) return 'outro'
  const base = nome.normalize('NFD').replace(/[̀-ͯ]/g, '')
  if (/^DOC\s|ordem de inicio|confidencialidade/i.test(base)) return 'outro'
  if (/^(PC|PA)[\s_\-.]/i.test(base) || /\bproposta\b/i.test(base)) return 'proposta'
  if (/^(TC|TAP|TRA|TA|\d+\s*[ºo°]?\s*TA)\b/i.test(base) || /\btermo\b|assinad|aditamento|apostil/i.test(base)) return 'termo'
  // "SF TA 02 ao TC 37-2019.pdf", "TA125-2023 ao TC 312_2021.pdf", "TC004-SMPED-2020 - TA 001-2020.pdf"
  if (/\bT(?:AP|RA|A|C)\s*\d/i.test(base) || /^T(?:AP|RA|A|C)\d/i.test(base)) return 'termo'
  return 'outro'
}
```
7. Troque a assinatura e o começo de `montarEstrutura` por:
```ts
export function montarEstrutura(caminhos: string[], siglaDaPastaCliente: (pasta: string) => string = normalizarChave): ContratoPasta[] {
  const contratos = new Map<string, ContratoPasta>()
  const arquivosPorTermo = new Map<string, string[]>()

  for (const caminho of caminhos) {
    const segmentos = caminho.split('/')
    if (motivoIgnorar(segmentos, 1)) continue
```
8. Troque `const chaveContrato = \`${pastaCliente}|${chave.numero} ${chave.ano}\`` por:
```ts
    const chaveContrato = `${siglaDaPastaCliente(pastaCliente)}|${chave.numero} ${chave.ano}`
```
9. Troque o bloco final do laço
```ts
    if (!pastasAll.some((p) => normalizarChave(p) === 'WORK')) {
      arquivosPorTermo.set(chaveTermo, [...(arquivosPorTermo.get(chaveTermo) ?? []), caminho])
    }
```
por
```ts
    arquivosPorTermo.set(chaveTermo, [...(arquivosPorTermo.get(chaveTermo) ?? []), caminho])
```
e, no push do termo novo, inclua `arquivos: []` (`{ chave: chaveTermo, pasta: caminhoTermo, ...classe, termoPdf: null, propostaPdf: null, outros: [], arquivos: [] }`).
10. No laço final (`for (const contrato of contratos.values())`), troque o corpo do `for (const termo …)` por:
```ts
      const arquivos = arquivosPorTermo.get(termo.chave) ?? []
      const nome = (c: string) => c.split('/').pop()!
      // Rascunho (WORK/) nunca é o termo nem a proposta da linha — mas entra nos arquivos do termo.
      const candidatos = arquivos.filter((a) => !a.split('/').some((s) => normalizarChave(s) === 'WORK'))
      termo.termoPdf = escolherTermo(candidatos.filter((a) => papelDoArquivo(nome(a)) === 'termo'))
      termo.propostaPdf = escolherTermo(candidatos.filter((a) => papelDoArquivo(nome(a)) === 'proposta'))
      termo.outros = arquivos.filter((a) => a !== termo.termoPdf && a !== termo.propostaPdf)
      termo.arquivos = arquivos
```
11. Tire o parâmetro `incluirWork` de onde restar (a assinatura antiga era `montarEstrutura(caminhos, incluirWork = false)`).

- [ ] **Step 9: Rodar e ver passar**

Run: `npx jest src/lib/importacao-sharepoint src/lib/arquivos/sharepoint/regras.test.ts`
Expected: PASS. (`sincronizar.test.ts` pode falhar no teste que espera `pastaContrato` — é reescrito na Task 9; rode `npx jest src/lib/arquivos/sharepoint/sincronizar.test.ts` e confirme que a única falha é essa.)

- [ ] **Step 10: Medir contra a pasta real (sem gravar nada)**

Crie `%TEMP%` scratch `medir-estrutura.ts` fora do repositório (ex.: no scratchpad da sessão) com:
```ts
import { readdirSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'
import { montarEstrutura } from '<repo>/src/lib/importacao-sharepoint/estrutura'
import { motivoIgnorar } from '<repo>/src/lib/arquivos/sharepoint/regras'

const raiz = path.join(homedir(), 'rede.sp', 'rede.sp - ContratosReceita')
const todos: string[] = []
const andar = (rel: string[]) => {
  for (const e of readdirSync(path.join(raiz, ...rel), { withFileTypes: true })) {
    const p = [...rel, e.name]
    if (e.isDirectory()) andar(p)
    else if (!motivoIgnorar(p, statSync(path.join(raiz, ...p)).size)) todos.push(p.join('/').normalize('NFC'))
  }
}
andar([])
const contratos = montarEstrutura(todos.filter((c) => !c.startsWith('1. PUBLICA')), (p) => (p === 'SUB-ITAM PAULISTA' ? 'SUB-ITP' : p === 'SGM - CASA CIVIL' ? 'SGM' : p.toUpperCase()))
const noLugar = new Set(contratos.flatMap((c) => c.termos.flatMap((t) => t.arquivos)))
console.log({ validos: todos.length, contratos: contratos.length, noLugar: noLugar.size, fora: todos.filter((c) => !noLugar.has(c) && !c.startsWith('1. PUBLICA')) })
```
(troque `<repo>` pelo caminho absoluto `C:/projeto/VerAI`). Run: `npx tsx <scratch>/medir-estrutura.ts`.
Expected: `fora: []` (os 2 da SPURBANISMO e os 46 do `WORK/` agora têm lugar) e `contratos` = 230 (um a menos que antes: SUB-ITP fundido).

- [ ] **Step 11: Commit**

```bash
git add src/lib/arquivos/sharepoint/regras.ts src/lib/arquivos/sharepoint/regras.test.ts src/lib/importacao-sharepoint/estrutura.ts src/lib/importacao-sharepoint/estrutura.test.ts src/lib/arquivos/sharepoint/sincronizar.ts
git commit -m "feat(sharepoint): aceita todo documento (WORK incluso), publicação do DOC pela sigla no nome, categoria pelo papel e contrato pela sigla do cliente"
```

---

### Task 3: `registrarConteudo` e os usos novos (`historico-contrato`, `sharepoint`)

**Files:**
- Create: `src/lib/arquivos/registrar-conteudo.ts`
- Create: `src/lib/arquivos/registrar-conteudo.test.ts`
- Modify: `src/lib/arquivos/tipos.ts` (`UsoArquivo`)
- Modify: `src/lib/arquivos/servico.ts` (`usosDosArquivos`)
- Create: `src/lib/arquivos/usos.test.ts`
- Modify: `src/app/clientes/[id]/abas/documentos/painel-arquivo.tsx` (chave da lista de usos)

**Interfaces:**
- Produces:
  - `registrarConteudo(db: Pick<PrismaClient, 'arquivoCliente'>, dados: ConteudoParaRegistrar, opcoes?: { gravarBlob?: (caminho: string, conteudo: Buffer, contentType: string) => Promise<string> }): Promise<{ id: string; novo: boolean }>`
  - `ConteudoParaRegistrar { clienteId: string; nome: string; conteudo: Buffer; categoria: CategoriaArquivo; origem: OrigemArquivo; enviadoPorId: string | null; sha256?: string }`
  - `UsoArquivo.tipo: 'analise-documento' | 'historico-contrato' | 'sharepoint'`; `UsoArquivo.daSincronizacao?: boolean` (uso criado pela sincronização — não segura o arquivo quando ele sai do SharePoint).

- [ ] **Step 1: Teste de `registrarConteudo` (falhando)**

`src/lib/arquivos/registrar-conteudo.test.ts`:
```ts
/** @jest-environment node */
jest.mock('@/lib/prisma', () => ({ prisma: {} }))
jest.mock('@/lib/storage', () => ({ putUpload: jest.fn(), deleteUpload: jest.fn(async () => {}), getUpload: jest.fn() }))

import { Prisma, type PrismaClient } from '@prisma/client'
import { deleteUpload } from '@/lib/storage'
import { registrarConteudo } from './registrar-conteudo'
import { sha256Hex } from './servico'

const conteudo = Buffer.from('%PDF termo')
const dados = { clienteId: 'c1', nome: 'TC 1-2023.pdf', conteudo, categoria: 'TERMO_CONTRATO' as const, origem: 'sharepoint' as const, enviadoPorId: null }

function db(existente: { id: string } | null = null) {
  return { arquivoCliente: { findFirst: jest.fn(async () => existente), create: jest.fn(async () => ({})) } }
}

it('mesmo conteúdo no mesmo cliente devolve o registro que já existe, sem subir nada', async () => {
  const banco = db({ id: 'a1' })
  const gravarBlob = jest.fn()
  expect(await registrarConteudo(banco as unknown as PrismaClient, dados, { gravarBlob })).toEqual({ id: 'a1', novo: false })
  expect(banco.arquivoCliente.findFirst).toHaveBeenCalledWith({ where: { clienteId: 'c1', sha256: sha256Hex(conteudo), removidoEm: null }, select: { id: true } })
  expect(gravarBlob).not.toHaveBeenCalled()
})

it('conteúdo novo sobe pro caminho final e grava com origem e categoria', async () => {
  const banco = db()
  const gravarBlob = jest.fn(async () => 'https://blob/final')
  const r = await registrarConteudo(banco as unknown as PrismaClient, dados, { gravarBlob })
  expect(r.novo).toBe(true)
  expect(gravarBlob.mock.calls[0][0]).toMatch(new RegExp(`^clientes/c1/${r.id}/TC_1-2023\\.pdf$`))
  expect(banco.arquivoCliente.create.mock.calls[0][0].data).toMatchObject({
    id: r.id, clienteId: 'c1', categoria: 'TERMO_CONTRATO', nome: 'TC 1-2023.pdf', extensao: 'pdf',
    contentType: 'application/pdf', tamanhoBytes: conteudo.length, sha256: sha256Hex(conteudo), urlBlob: 'https://blob/final',
    origem: 'sharepoint', enviadoPorId: null,
  })
})

it('corrida com outro envio do mesmo conteúdo: apaga o blob e devolve o do outro', async () => {
  const banco = db()
  banco.arquivoCliente.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'a-outro' })
  banco.arquivoCliente.create.mockRejectedValue(new Prisma.PrismaClientKnownRequestError('único', { code: 'P2002', clientVersion: 'x' }))
  const r = await registrarConteudo(banco as unknown as PrismaClient, dados, { gravarBlob: async () => 'https://blob/final' })
  expect(r).toEqual({ id: 'a-outro', novo: false })
  expect(deleteUpload).toHaveBeenCalledWith('https://blob/final')
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx jest src/lib/arquivos/registrar-conteudo.test.ts`
Expected: FAIL — `Cannot find module './registrar-conteudo'`.

- [ ] **Step 3: Implementar `registrar-conteudo.ts`**

```ts
import { randomUUID } from 'node:crypto'
import { Prisma, type CategoriaArquivo, type OrigemArquivo, type PrismaClient } from '@prisma/client'
import { deleteUpload, putUpload } from '@/lib/storage'
import { caminhoFinalArquivo } from './caminhos'
import { sha256Hex } from './servico'
import { contentTypeDe, extensaoDe } from './tipos'

// Registro de um conteúdo que o SERVIDOR já tem em memória — sincronização com o SharePoint, anexo da
// linha do histórico, migração das cópias antigas. Mesma regra do `registrarArquivo` (upload da tela):
// mesmo hash no mesmo cliente = mesmo registro (spec do repositório §3.4.1). Recebe o banco por
// parâmetro porque roda também em scripts, com o PrismaClient deles.

export interface ConteudoParaRegistrar {
  clienteId: string
  nome: string
  conteudo: Buffer
  categoria: CategoriaArquivo
  origem: OrigemArquivo
  enviadoPorId: string | null
  /** Já calculado por quem chama (evita ler o buffer de novo). */
  sha256?: string
}

export async function registrarConteudo(
  db: Pick<PrismaClient, 'arquivoCliente'>,
  dados: ConteudoParaRegistrar,
  opcoes: { gravarBlob?: (caminho: string, conteudo: Buffer, contentType: string) => Promise<string> } = {}
): Promise<{ id: string; novo: boolean }> {
  const gravarBlob = opcoes.gravarBlob ?? putUpload
  const sha256 = dados.sha256 ?? sha256Hex(dados.conteudo)
  const buscar = () => db.arquivoCliente.findFirst({ where: { clienteId: dados.clienteId, sha256, removidoEm: null }, select: { id: true } })

  const existente = await buscar()
  if (existente) return { id: existente.id, novo: false }

  const id = randomUUID()
  const contentType = contentTypeDe(dados.nome)
  const urlBlob = await gravarBlob(caminhoFinalArquivo(dados.clienteId, id, dados.nome), dados.conteudo, contentType)
  try {
    await db.arquivoCliente.create({
      data: {
        id,
        clienteId: dados.clienteId,
        categoria: dados.categoria,
        nome: dados.nome,
        extensao: extensaoDe(dados.nome),
        contentType,
        tamanhoBytes: dados.conteudo.length,
        sha256,
        urlBlob,
        origem: dados.origem,
        enviadoPorId: dados.enviadoPorId,
      },
    })
    return { id, novo: true }
  } catch (erro) {
    // O blob recém-gravado nunca foi referenciado: apaga (best-effort), como em registrarArquivo.
    await deleteUpload(urlBlob).catch(() => {})
    // Mesmo conteúdo gravado por outro caminho ao mesmo tempo: índice único parcial (clienteId, sha256).
    if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === 'P2002') {
      const outro = await buscar()
      if (outro) return { id: outro.id, novo: false }
    }
    throw erro
  }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx jest src/lib/arquivos/registrar-conteudo.test.ts` → PASS.

- [ ] **Step 5: Teste dos usos novos (falhando)**

`src/lib/arquivos/usos.test.ts`:
```ts
/** @jest-environment node */
jest.mock('@/lib/prisma', () => ({
  prisma: {
    documento: { findMany: jest.fn(async () => []) },
    historicoContrato: { findMany: jest.fn() },
    arquivoSharepoint: { findMany: jest.fn() },
  },
}))

import { prisma } from '@/lib/prisma'
import { usosDosArquivos } from './servico'

const contrato = { id: 'k1', numeroTermo: 'TC 211/2022', clienteId: 'c1' }

it('coluna PC/PA–TC/TA da linha e lugar no SharePoint viram usos com contrato', async () => {
  ;(prisma.historicoContrato.findMany as jest.Mock).mockResolvedValue([
    { id: 'h1', tipo: 'ADITIVO', numero: 'TA 01', propostaArquivoId: null, termoArquivoId: 'a1', propostaDoSharepoint: false, termoDoSharepoint: true, contrato },
  ])
  ;(prisma.arquivoSharepoint.findMany as jest.Mock).mockResolvedValue([
    { arquivoId: 'a1', caminho: 'SMSUB/TC 211/2) TA 01/TA 01.pdf', contrato, arquivo: { clienteId: 'c1' } },
    { arquivoId: 'a2', caminho: '1. PUBLICAÇÕES NO DOC/2026.09.14 - SMSUB - Despacho.pdf', contrato: null, arquivo: { clienteId: 'c1' } },
  ])
  const usos = await usosDosArquivos(['a1', 'a2'])
  expect(usos.get('a1')).toEqual([
    {
      tipo: 'historico-contrato',
      rotulo: 'Contrato TC 211/2022 · TC/TA de TA 01',
      href: '/clientes/c1/contratos/k1',
      contrato: { id: 'k1', numeroTermo: 'TC 211/2022' },
      competencia: null,
      daSincronizacao: true,
    },
    {
      tipo: 'sharepoint',
      rotulo: 'SharePoint · SMSUB/TC 211/2) TA 01/TA 01.pdf',
      href: '/clientes/c1/contratos/k1',
      contrato: { id: 'k1', numeroTermo: 'TC 211/2022' },
      competencia: null,
      daSincronizacao: true,
    },
  ])
  expect(usos.get('a2')).toEqual([
    {
      tipo: 'sharepoint',
      rotulo: 'SharePoint · 1. PUBLICAÇÕES NO DOC/2026.09.14 - SMSUB - Despacho.pdf',
      href: '/clientes/c1',
      contrato: null,
      competencia: null,
      daSincronizacao: true,
    },
  ])
  expect((prisma.arquivoSharepoint.findMany as jest.Mock).mock.calls[0][0].where).toEqual({ arquivoId: { in: ['a1', 'a2'] }, removidoNaOrigemEm: null })
})
```

- [ ] **Step 6: Rodar e ver falhar**

Run: `npx jest src/lib/arquivos/usos.test.ts`
Expected: FAIL — `usos.get('a1')` vem `[]`.

- [ ] **Step 7: Implementar**

Em `src/lib/arquivos/tipos.ts`, troque a interface `UsoArquivo` por:
```ts
/** Um lugar onde o arquivo é usado. Contrato e competência do arquivo são SEMPRE derivados daqui
 *  (spec do repositório §7.1) — o `ArquivoCliente` não guarda nenhum dos dois. */
export interface UsoArquivo {
  tipo: 'analise-documento' | 'historico-contrato' | 'sharepoint'
  rotulo: string
  href: string
  /** Contrato a que este uso liga o arquivo; `null` quando o uso não é de contrato. */
  contrato: { id: string; numeroTermo: string | null } | null
  /** Competência deste uso; `null` quando não se aplica. */
  competencia: { ano: number; mes: number } | null
  /** Uso criado pela sincronização com o SharePoint (o lugar do arquivo lá, ou a coluna PC/PA–TC/TA
   *  preenchida por ela). Não segura o arquivo quando ele sai do SharePoint (spec lugar-certo §3.1). */
  daSincronizacao?: boolean
}
```

Em `src/lib/arquivos/servico.ts`, troque `usosDosArquivos` inteira por:
```ts
function rotuloDaLinha(linha: { tipo: string; numero: string | null }): string {
  return linha.tipo === 'CONTRATO' ? 'contrato inicial' : (linha.numero ?? linha.tipo.toLowerCase())
}

/** Onde cada arquivo é usado: análise por IA (`Documento`), coluna PC/PA–TC/TA de linha do histórico
 *  e lugar na biblioteca do SharePoint. Faturamento, ConfereAI e proposta comercial entram nas
 *  próximas fases do repositório. */
export async function usosDosArquivos(ids: string[]): Promise<Map<string, UsoArquivo[]>> {
  const usos = new Map<string, UsoArquivo[]>(ids.map((id) => [id, []]))
  if (ids.length === 0) return usos

  const [documentos, linhas, locais] = await Promise.all([
    prisma.documento.findMany({
      where: { arquivoId: { in: ids } },
      select: { arquivoId: true, clienteId: true, competenciaAno: true, competenciaMes: true },
    }),
    prisma.historicoContrato.findMany({
      where: { OR: [{ propostaArquivoId: { in: ids } }, { termoArquivoId: { in: ids } }] },
      select: {
        id: true,
        tipo: true,
        numero: true,
        propostaArquivoId: true,
        termoArquivoId: true,
        propostaDoSharepoint: true,
        termoDoSharepoint: true,
        contrato: { select: { id: true, numeroTermo: true, clienteId: true } },
      },
    }),
    prisma.arquivoSharepoint.findMany({
      where: { arquivoId: { in: ids }, removidoNaOrigemEm: null },
      select: {
        arquivoId: true,
        caminho: true,
        contrato: { select: { id: true, numeroTermo: true, clienteId: true } },
        arquivo: { select: { clienteId: true } },
      },
    }),
  ])

  for (const doc of documentos) {
    usos.get(doc.arquivoId!)?.push({
      tipo: 'analise-documento',
      rotulo: `Análise por IA · ${nomeCompetencia(doc.competenciaAno, doc.competenciaMes)}`,
      href: `/clientes/${doc.clienteId}/${formatarCompetencia(doc.competenciaAno, doc.competenciaMes)}`,
      contrato: null,
      competencia: { ano: doc.competenciaAno, mes: doc.competenciaMes },
    })
  }
  for (const linha of linhas) {
    const colunas = [
      ['PC/PA', linha.propostaArquivoId, linha.propostaDoSharepoint],
      ['TC/TA', linha.termoArquivoId, linha.termoDoSharepoint],
    ] as const
    for (const [rotulo, arquivoId, daSincronizacao] of colunas) {
      if (!arquivoId) continue
      usos.get(arquivoId)?.push({
        tipo: 'historico-contrato',
        rotulo: `Contrato ${linha.contrato.numeroTermo ?? 'sem nº'} · ${rotulo} de ${rotuloDaLinha(linha)}`,
        href: `/clientes/${linha.contrato.clienteId}/contratos/${linha.contrato.id}`,
        contrato: { id: linha.contrato.id, numeroTermo: linha.contrato.numeroTermo },
        competencia: null,
        daSincronizacao,
      })
    }
  }
  for (const local of locais) {
    usos.get(local.arquivoId!)?.push({
      tipo: 'sharepoint',
      rotulo: `SharePoint · ${local.caminho}`,
      href: local.contrato
        ? `/clientes/${local.contrato.clienteId}/contratos/${local.contrato.id}`
        : `/clientes/${local.arquivo!.clienteId}`,
      contrato: local.contrato ? { id: local.contrato.id, numeroTermo: local.contrato.numeroTermo } : null,
      competencia: null,
      daSincronizacao: true,
    })
  }
  return usos
}
```

Em `src/app/clientes/[id]/abas/documentos/painel-arquivo.tsx`, na lista de usos troque `<li key={uso.href}>` por `<li key={`${uso.tipo}:${uso.rotulo}`}>` (dois lugares no SharePoint sem contrato teriam o mesmo `href`).

- [ ] **Step 8: Rodar e ver passar**

Run: `npx jest src/lib/arquivos "src/app/clientes/[id]/abas"`
Expected: PASS. Se algum teste existente de `usosDosArquivos` quebrar porque o mock de `@/lib/prisma` não tem `historicoContrato`/`arquivoSharepoint`, acrescente ao mock `historicoContrato: { findMany: jest.fn(async () => []) }` e `arquivoSharepoint: { findMany: jest.fn(async () => []) }`.

- [ ] **Step 9: Commit**

```bash
git add src/lib/arquivos/registrar-conteudo.ts src/lib/arquivos/registrar-conteudo.test.ts src/lib/arquivos/tipos.ts src/lib/arquivos/servico.ts src/lib/arquivos/usos.test.ts "src/app/clientes/[id]/abas/documentos/painel-arquivo.tsx"
git commit -m "feat(arquivos): registrarConteudo no servidor e usos de linha do histórico e do SharePoint"
```
(Inclua também qualquer teste existente que você teve de ajustar no Step 8.)

---

### Task 4: Colunas PC/PA–TC/TA por referência — leitura

A API e os leitores passam a ler `propostaArquivo`/`termoArquivo`. Para a tela nada muda de forma: continuam chegando `propostaPdfUrl/Nome` e `termoPdfUrl/Nome`, calculados — a URL agora é `/api/arquivos/<id>?modo=inline`.

**Files:**
- Create: `src/lib/relatorios-clientes/anexos-historico.ts`
- Create: `src/lib/relatorios-clientes/anexos-historico.test.ts`
- Modify: `src/app/api/contratos/esquema.ts` (`SELECT_HISTORICO`, `serializarHistorico`)
- Modify: `src/lib/relatorios-clientes/contratos-consolidados.ts`
- Modify: `src/lib/assistente/indexacao/fontes.ts`
- Modify (fixtures): testes que quebrarem — ver Step 6

**Interfaces:**
- Produces (`anexos-historico.ts`):
  - `type ColunaAnexo = 'proposta' | 'termo'`
  - `COLUNAS_ANEXO: { proposta: { arquivoId: 'propostaArquivoId'; doSharepoint: 'propostaDoSharepoint'; rotulo: 'PC/PA' }; termo: { arquivoId: 'termoArquivoId'; doSharepoint: 'termoDoSharepoint'; rotulo: 'TC/TA' } }`
  - `SELECAO_ANEXOS` (select Prisma: `propostaArquivo {id,nome}`, `termoArquivo {id,nome}`, `propostaDoSharepoint`, `termoDoSharepoint`)
  - `urlDoArquivo(arquivoId: string): string`
  - `anexosDaLinha(linha): { propostaPdfUrl, propostaPdfNome, propostaArquivoId, propostaDoSharepoint, termoPdfUrl, termoPdfNome, termoArquivoId, termoDoSharepoint }`
  - `categoriaDaColuna(coluna: ColunaAnexo, tipoLinha: string): CategoriaArquivo`
  - `dadosDaColuna(coluna: ColunaAnexo, arquivoId: string | null, doSharepoint: boolean)` → `{ propostaArquivoId, propostaDoSharepoint }` ou `{ termoArquivoId, termoDoSharepoint }` — **use sempre isto** no `data` do Prisma (chave calculada `[coluna.arquivoId]` com valores de tipos diferentes não passa no tipo do Prisma).

- [ ] **Step 1: Teste (falhando)**

`src/lib/relatorios-clientes/anexos-historico.test.ts`:
```ts
import { anexosDaLinha, categoriaDaColuna, dadosDaColuna, urlDoArquivo } from './anexos-historico'

it('dados do Prisma de uma coluna', () => {
  expect(dadosDaColuna('proposta', 'a1', true)).toEqual({ propostaArquivoId: 'a1', propostaDoSharepoint: true })
  expect(dadosDaColuna('termo', null, false)).toEqual({ termoArquivoId: null, termoDoSharepoint: false })
})

it('monta a forma que a tela já conhece a partir das referências', () => {
  expect(
    anexosDaLinha({ propostaArquivo: { id: 'a1', nome: 'PA-01.pdf' }, termoArquivo: null, propostaDoSharepoint: true, termoDoSharepoint: false })
  ).toEqual({
    propostaPdfUrl: '/api/arquivos/a1?modo=inline',
    propostaPdfNome: 'PA-01.pdf',
    propostaArquivoId: 'a1',
    propostaDoSharepoint: true,
    termoPdfUrl: null,
    termoPdfNome: null,
    termoArquivoId: null,
    termoDoSharepoint: false,
  })
  expect(urlDoArquivo('x')).toBe('/api/arquivos/x?modo=inline')
})

it('categoria do anexo pela coluna e pelo tipo da linha', () => {
  expect(categoriaDaColuna('proposta', 'CONTRATO')).toBe('PROPOSTA_COMERCIAL')
  expect(categoriaDaColuna('proposta', 'ADITIVO')).toBe('PROPOSTA_ADITIVO')
  expect(categoriaDaColuna('termo', 'CONTRATO')).toBe('TERMO_CONTRATO')
  expect(categoriaDaColuna('termo', 'PRORROGACAO')).toBe('TERMO_ADITIVO')
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx jest src/lib/relatorios-clientes/anexos-historico.test.ts` → FAIL (módulo não existe).

- [ ] **Step 3: Implementar `anexos-historico.ts`**

```ts
import type { CategoriaArquivo, Prisma } from '@prisma/client'

// Colunas PC/PA (proposta) e TC/TA (termo) da linha do histórico apontam para o repositório do cliente
// (spec docs/superpowers/specs/2026-09-23-sharepoint-lugar-certo-design.md §3.4). Para a tela e os
// relatórios a forma continua `propostaPdfUrl/Nome` e `termoPdfUrl/Nome` — só que a URL é a rota
// autenticada do repositório (a do Blob nunca vai ao navegador).

export type ColunaAnexo = 'proposta' | 'termo'

export const COLUNAS_ANEXO = {
  proposta: { arquivoId: 'propostaArquivoId', doSharepoint: 'propostaDoSharepoint', rotulo: 'PC/PA' },
  termo: { arquivoId: 'termoArquivoId', doSharepoint: 'termoDoSharepoint', rotulo: 'TC/TA' },
} as const

export const SELECAO_ANEXOS = {
  propostaArquivo: { select: { id: true, nome: true } },
  termoArquivo: { select: { id: true, nome: true } },
  propostaDoSharepoint: true,
  termoDoSharepoint: true,
} satisfies Prisma.HistoricoContratoSelect

export function urlDoArquivo(arquivoId: string): string {
  return `/api/arquivos/${arquivoId}?modo=inline`
}

interface ComAnexos {
  propostaArquivo: { id: string; nome: string } | null
  termoArquivo: { id: string; nome: string } | null
  propostaDoSharepoint: boolean
  termoDoSharepoint: boolean
}

export function anexosDaLinha(linha: ComAnexos) {
  return {
    propostaPdfUrl: linha.propostaArquivo ? urlDoArquivo(linha.propostaArquivo.id) : null,
    propostaPdfNome: linha.propostaArquivo?.nome ?? null,
    propostaArquivoId: linha.propostaArquivo?.id ?? null,
    propostaDoSharepoint: linha.propostaDoSharepoint,
    termoPdfUrl: linha.termoArquivo ? urlDoArquivo(linha.termoArquivo.id) : null,
    termoPdfNome: linha.termoArquivo?.nome ?? null,
    termoArquivoId: linha.termoArquivo?.id ?? null,
    termoDoSharepoint: linha.termoDoSharepoint,
  }
}

/** O que o arquivo É, quando ele entra no repositório pela coluna da linha. */
export function categoriaDaColuna(coluna: ColunaAnexo, tipoLinha: string): CategoriaArquivo {
  const inicial = tipoLinha === 'CONTRATO'
  if (coluna === 'proposta') return inicial ? 'PROPOSTA_COMERCIAL' : 'PROPOSTA_ADITIVO'
  return inicial ? 'TERMO_CONTRATO' : 'TERMO_ADITIVO'
}

/** `data` do Prisma para gravar (ou soltar, com `null`) uma coluna. Objeto explícito por coluna: chave
 *  calculada com valores de tipos diferentes não passa no tipo do Prisma. */
export function dadosDaColuna(coluna: ColunaAnexo, arquivoId: string | null, doSharepoint: boolean) {
  return coluna === 'proposta'
    ? { propostaArquivoId: arquivoId, propostaDoSharepoint: doSharepoint }
    : { termoArquivoId: arquivoId, termoDoSharepoint: doSharepoint }
}
```

- [ ] **Step 4: API do contrato (`esquema.ts`)**

Em `src/app/api/contratos/esquema.ts`:
- import: `import { SELECAO_ANEXOS, anexosDaLinha } from '@/lib/relatorios-clientes/anexos-historico'`
- em `SELECT_HISTORICO`, troque as quatro linhas `propostaPdfUrl/propostaPdfNome/termoPdfUrl/termoPdfNome: true` por `...SELECAO_ANEXOS,`
- troque `serializarHistorico` por:
```ts
export function serializarHistorico(linha: HistoricoSelecionado) {
  const { propostaArquivo, termoArquivo, propostaDoSharepoint, termoDoSharepoint, ...resto } = linha
  return {
    ...resto,
    valor: linha.valor?.toString() ?? null,
    ...anexosDaLinha({ propostaArquivo, termoArquivo, propostaDoSharepoint, termoDoSharepoint }),
  }
}
```

- [ ] **Step 5: Consolidado e índice do assistente**

`src/lib/relatorios-clientes/contratos-consolidados.ts`:
- import: `import { SELECAO_ANEXOS, anexosDaLinha } from './anexos-historico'`
- no `prisma.historicoContrato.findMany` do `Promise.all`, troque as quatro linhas `…PdfUrl/…PdfNome: true` por `...SELECAO_ANEXOS,`
- renomeie o primeiro elemento desestruturado do `Promise.all` de `linhasHistorico` para `linhasBrutas` e, logo depois do `await Promise.all([...])`, acrescente:
```ts
  // A forma que `resumirHistorico` conhece (url/nome), calculada da referência ao repositório.
  const linhasHistorico = linhasBrutas.map((linha) => ({ ...linha, ...anexosDaLinha(linha) }))
```

`src/lib/assistente/indexacao/fontes.ts` — troque o `findMany` do histórico e o laço dele por:
```ts
    prisma.historicoContrato.findMany({
      where: {
        OR: [{ propostaArquivoId: { not: null } }, { termoArquivoId: { not: null } }],
        ...(clienteId ? { contrato: { clienteId } } : {}),
      },
      select: {
        id: true,
        contratoId: true,
        contrato: { select: { clienteId: true } },
        // Servidor lendo o blob pra indexar — `urlBlob` não sai daqui.
        propostaArquivo: { select: { urlBlob: true, nome: true } },
        termoArquivo: { select: { urlBlob: true, nome: true } },
      },
    }),
```
e
```ts
  for (const h of historicos) {
    const base = { origemId: h.id, tipo: 'pdf', clienteId: h.contrato.clienteId, contratoId: h.contratoId, textoPronto: null }
    if (h.propostaArquivo) {
      fontes.push({ ...base, origem: 'HISTORICO_PROPOSTA', url: h.propostaArquivo.urlBlob, nomeArquivo: h.propostaArquivo.nome })
    }
    if (h.termoArquivo) {
      fontes.push({ ...base, origem: 'HISTORICO_TERMO', url: h.termoArquivo.urlBlob, nomeArquivo: h.termoArquivo.nome })
    }
  }
```

- [ ] **Step 6: Rodar e corrigir fixtures**

Run: `npx jest src/lib/relatorios-clientes src/lib/assistente src/app/api/contratos src/app/api/historico-contrato src/app/api/clientes "src/app/clientes"`

Nos testes que falharem **só por fixture** (mocks do Prisma que devolvem linhas com `propostaPdfUrl`/`termoPdfUrl`), aplique a regra:
- linha mockada com `propostaPdfUrl: 'X', propostaPdfNome: 'N'` → `propostaArquivo: { id: 'arq-proposta', nome: 'N' }, propostaDoSharepoint: false` (sem URL: `propostaArquivo: null, propostaDoSharepoint: false`); o mesmo para `termo…`;
- no `fontes.test.ts`: `propostaArquivo: { urlBlob: 'X', nome: 'N' }`;
- valor esperado de URL `'X'` na resposta → `'/api/arquivos/arq-proposta?modo=inline'`.
Não altere o que o teste afirma além disso. Testes das rotas `pdf`, `copiar` e `pdfs-existentes` são reescritos na Task 5 — ignore as falhas deles aqui.

Expected ao fim: só as rotas `src/app/api/historico-contrato/[id]/pdf/**` e `pdfs-existentes` falhando.

- [ ] **Step 7: Tipos**

Run: `npx tsc --noEmit -p .` — erros novos só nos três arquivos de rota da Task 5 (`pdf/[tipo]/route.ts`, `copiar/route.ts`, `pdfs-existentes/route.ts`), que ainda leem as colunas antigas via `SELECAO_PDFS`. Nenhum outro.

- [ ] **Step 8: Commit**

```bash
git add src/lib/relatorios-clientes/anexos-historico.ts src/lib/relatorios-clientes/anexos-historico.test.ts src/app/api/contratos/esquema.ts src/lib/relatorios-clientes/contratos-consolidados.ts src/lib/assistente/indexacao/fontes.ts
git commit -m "feat(historico): PC/PA e TC/TA lidos por referência ao repositório (forma da API mantida)"
```
(Acrescente os testes cujas fixtures você ajustou.)

---

### Task 5: Colunas PC/PA–TC/TA por referência — escrita (anexar, escolher, remover) e aviso na tela

**Files:**
- Modify: `src/app/api/historico-contrato/carregar.ts`
- Modify: `src/app/api/historico-contrato/[id]/pdf/[tipo]/route.ts` (+ `route.test.ts` reescrito)
- Modify: `src/app/api/historico-contrato/[id]/pdf/[tipo]/copiar/route.ts` (+ `route.test.ts` reescrito)
- Modify: `src/app/api/historico-contrato/[id]/pdfs-existentes/route.ts` (+ `route.test.ts` reescrito)
- Modify: `src/lib/relatorios-clientes/pdfs-existentes.ts`
- Modify: `src/app/clientes/[id]/contratos/[contratoId]/secao-historico.tsx`

**Interfaces:**
- Consumes: `registrarConteudo` (Task 3); `COLUNAS_ANEXO`, `SELECAO_ANEXOS`, `anexosDaLinha`, `categoriaDaColuna`, `urlDoArquivo` (Task 4).
- Produces: `carregarHistoricoComAcesso` devolve `{ linha: { id, tipo, numero, proposta, contrato: { clienteId } }, usuario }`. `OrigemPdf = { origem: 'proposta-comercial'; arquivoId } | { origem: 'repositorio'; arquivoId }`. Some `COLUNAS_PDF` e `SELECAO_PDFS`.

- [ ] **Step 1: Carregador devolve usuário e tipo**

Em `src/app/api/historico-contrato/carregar.ts`, troque o `select` e o retorno:
```ts
  const linha = await prisma.historicoContrato.findUnique({
    where: { id },
    select: { id: true, tipo: true, numero: true, proposta: true, contrato: { select: { clienteId: true } } },
  })
  if (!linha) return { erro: NextResponse.json({ error: HISTORICO_NAO_ENCONTRADO }, { status: 404 }) }

  const negado = await verificarAcessoCliente(autenticado.usuario, linha.contrato.clienteId)
  return negado ? { erro: negado } : { linha, usuario: autenticado.usuario }
```

- [ ] **Step 2: Teste novo da rota de anexo (falhando)**

Substitua `src/app/api/historico-contrato/[id]/pdf/[tipo]/route.test.ts` por:
```ts
/** @jest-environment node */
import { NextRequest } from 'next/server'

jest.mock('@/lib/auth', () => ({ ...jest.requireActual('@/lib/auth'), getAuthUser: jest.fn() }))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    historicoContrato: { findUnique: jest.fn(), update: jest.fn() },
    usuario: { findUnique: jest.fn() },
    arquivoCliente: {},
  },
}))
jest.mock('@/lib/arquivos/registrar-conteudo', () => ({ registrarConteudo: jest.fn() }))
jest.mock('@/lib/storage', () => ({ ...jest.requireActual('@/lib/storage'), putUpload: jest.fn(), deleteUpload: jest.fn() }))

import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { registrarConteudo } from '@/lib/arquivos/registrar-conteudo'
import { deleteUpload, putUpload } from '@/lib/storage'
import { DELETE, POST } from './route'

const admin = { id: 'u1', nome: 'Admin', email: 'a@x', role: 'admin' as const }
const contexto = (tipo: string) => ({ params: Promise.resolve({ id: 'h1', tipo }) })
const pdf = () => new File(['%PDF-1.4'], 'PA-01.pdf', { type: 'application/pdf' })
function requisicao(arquivo?: File) {
  const corpo = new FormData()
  if (arquivo) corpo.append('arquivo', arquivo)
  return new NextRequest('http://localhost/api/historico-contrato/h1/pdf/proposta', { method: 'POST', body: corpo })
}
const linhaComAnexo = { propostaArquivo: { id: 'a1', nome: 'PA-01.pdf' }, termoArquivo: null, propostaDoSharepoint: false, termoDoSharepoint: false }

beforeEach(() => {
  jest.clearAllMocks()
  ;(getAuthUser as jest.Mock).mockResolvedValue(admin)
  ;(prisma.historicoContrato.findUnique as jest.Mock).mockResolvedValue({ id: 'h1', tipo: 'ADITIVO', contrato: { clienteId: 'c1' } })
})

describe('POST', () => {
  it('404 para tipo desconhecido e para linha que não existe', async () => {
    expect((await POST(requisicao(pdf()), contexto('outro'))).status).toBe(404)
    ;(prisma.historicoContrato.findUnique as jest.Mock).mockResolvedValue(null)
    expect((await POST(requisicao(pdf()), contexto('proposta'))).status).toBe(404)
  })

  it('400 sem arquivo e para não-PDF', async () => {
    expect((await POST(requisicao(), contexto('proposta'))).status).toBe(400)
    expect((await POST(requisicao(new File(['oi'], 'nota.txt', { type: 'text/plain' })), contexto('proposta'))).status).toBe(400)
    expect(registrarConteudo).not.toHaveBeenCalled()
  })

  it('registra no repositório do cliente e a linha passa a apontar pra ele (anexo à mão)', async () => {
    ;(registrarConteudo as jest.Mock).mockResolvedValue({ id: 'a1', novo: true })
    ;(prisma.historicoContrato.update as jest.Mock).mockResolvedValue(linhaComAnexo)
    const resposta = await POST(requisicao(pdf()), contexto('proposta'))
    expect(resposta.status).toBe(200)
    expect((registrarConteudo as jest.Mock).mock.calls[0][1]).toMatchObject({
      clienteId: 'c1', nome: 'PA-01.pdf', categoria: 'PROPOSTA_ADITIVO', origem: 'upload', enviadoPorId: 'u1',
    })
    expect((prisma.historicoContrato.update as jest.Mock).mock.calls[0][0]).toMatchObject({
      where: { id: 'h1' },
      data: { propostaArquivoId: 'a1', propostaDoSharepoint: false },
    })
    expect(await resposta.json()).toMatchObject({ propostaPdfUrl: '/api/arquivos/a1?modo=inline', propostaPdfNome: 'PA-01.pdf' })
    expect(putUpload).not.toHaveBeenCalled()
  })
})

describe('DELETE', () => {
  it('solta a referência e não apaga arquivo nenhum', async () => {
    ;(prisma.historicoContrato.findUnique as jest.Mock)
      .mockResolvedValueOnce({ id: 'h1', tipo: 'ADITIVO', contrato: { clienteId: 'c1' } })
      .mockResolvedValueOnce({ propostaArquivoId: 'a1' })
    ;(prisma.historicoContrato.update as jest.Mock).mockResolvedValue({ ...linhaComAnexo, propostaArquivo: null })
    const resposta = await DELETE(new NextRequest('http://localhost/x', { method: 'DELETE' }), contexto('proposta'))
    expect(resposta.status).toBe(200)
    expect((prisma.historicoContrato.update as jest.Mock).mock.calls[0][0].data).toEqual({ propostaArquivoId: null, propostaDoSharepoint: false })
    expect(deleteUpload).not.toHaveBeenCalled()
  })

  it('404 quando a coluna está vazia', async () => {
    ;(prisma.historicoContrato.findUnique as jest.Mock)
      .mockResolvedValueOnce({ id: 'h1', tipo: 'ADITIVO', contrato: { clienteId: 'c1' } })
      .mockResolvedValueOnce({ propostaArquivoId: null })
    expect((await DELETE(new NextRequest('http://localhost/x', { method: 'DELETE' }), contexto('proposta'))).status).toBe(404)
  })
})
```
Se `exigirUsuario` precisar de `prisma.usuario.findUnique` resolvido (veja o teste antigo), acrescente `;(prisma.usuario.findUnique as jest.Mock).mockResolvedValue(admin)` no `beforeEach`.

- [ ] **Step 3: Rodar e ver falhar**

Run: `npx jest "src/app/api/historico-contrato/\[id\]/pdf/\[tipo\]/route.test.ts"`
Expected: FAIL — a rota ainda usa `putUpload` e as colunas de URL.

- [ ] **Step 4: Implementar a rota de anexo**

Substitua `src/app/api/historico-contrato/[id]/pdf/[tipo]/route.ts` por:
```ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { registrarConteudo } from '@/lib/arquivos/registrar-conteudo'
import { SELECAO_ANEXOS, anexosDaLinha, categoriaDaColuna, dadosDaColuna } from '@/lib/relatorios-clientes/anexos-historico'
import { TAMANHO_MAXIMO_PDF_BYTES, tipoPdfValido as tipoValido } from '@/lib/relatorios-clientes/pdfs-existentes'
import { carregarHistoricoComAcesso } from '../../../carregar'

type Contexto = { params: Promise<{ id: string; tipo: string }> }

/** Anexa (ou substitui) o PDF de proposta/termo de uma linha do histórico: o arquivo entra no
 *  repositório do cliente (dedup por conteúdo) e a linha guarda a referência. Anexo feito aqui é
 *  "à mão" — a sincronização com o SharePoint nunca o troca (spec lugar-certo §3.4). */
export async function POST(request: NextRequest, { params }: Contexto) {
  const { id, tipo } = await params
  if (!tipoValido(tipo)) return NextResponse.json({ error: 'tipo de anexo inválido' }, { status: 404 })

  const carregado = await carregarHistoricoComAcesso(request, id)
  if ('erro' in carregado) return carregado.erro

  const formData = await request.formData().catch(() => null)
  const arquivo = formData?.get('arquivo')
  if (!(arquivo instanceof File)) {
    return NextResponse.json({ error: 'campo "arquivo" é obrigatório' }, { status: 400 })
  }
  if (!arquivo.name.toLowerCase().endsWith('.pdf') && arquivo.type !== 'application/pdf') {
    return NextResponse.json({ error: 'o arquivo precisa ser um PDF' }, { status: 400 })
  }
  if (arquivo.size > TAMANHO_MAXIMO_PDF_BYTES) {
    return NextResponse.json({ error: 'o PDF não pode passar de 15 MB' }, { status: 400 })
  }

  const { id: arquivoId } = await registrarConteudo(prisma, {
    clienteId: carregado.linha.contrato.clienteId,
    nome: arquivo.name,
    conteudo: Buffer.from(await arquivo.arrayBuffer()),
    categoria: categoriaDaColuna(tipo, carregado.linha.tipo),
    origem: 'upload',
    enviadoPorId: carregado.usuario.id,
  })

  const linha = await prisma.historicoContrato.update({
    where: { id },
    data: dadosDaColuna(tipo, arquivoId, false),
    select: SELECAO_ANEXOS,
  })
  return NextResponse.json(anexosDaLinha(linha))
}

/** Solta o PDF da linha. O arquivo continua no repositório do cliente (pode estar em outros lugares). */
export async function DELETE(request: NextRequest, { params }: Contexto) {
  const { id, tipo } = await params
  if (!tipoValido(tipo)) return NextResponse.json({ error: 'tipo de anexo inválido' }, { status: 404 })

  const carregado = await carregarHistoricoComAcesso(request, id)
  if ('erro' in carregado) return carregado.erro

  const atual = await prisma.historicoContrato.findUnique({ where: { id }, select: { propostaArquivoId: true, termoArquivoId: true } })
  if (!(tipo === 'proposta' ? atual?.propostaArquivoId : atual?.termoArquivoId)) {
    return NextResponse.json({ error: 'esta linha não tem PDF anexado' }, { status: 404 })
  }

  const linha = await prisma.historicoContrato.update({
    where: { id },
    data: dadosDaColuna(tipo, null, false),
    select: SELECAO_ANEXOS,
  })
  return NextResponse.json(anexosDaLinha(linha))
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npx jest "src/app/api/historico-contrato/\[id\]/pdf/\[tipo\]/route.test.ts"` → PASS.

- [ ] **Step 6: `pdfs-existentes.ts` — origem `repositorio`**

Em `src/lib/relatorios-clientes/pdfs-existentes.ts`:
- troque o comentário do topo por:
```ts
/**
 * PDFs que JÁ estão no sistema e podem ser usados nas colunas PC/PA e TC/TA do histórico do contrato
 * (em vez de subir de novo do computador). Duas fontes:
 *  - `repositorio`: PDFs do repositório do cliente (aba Documentos) — a linha passa a apontar pro mesmo
 *    arquivo, sem cópia;
 *  - `proposta-comercial`: PDFs da tela "Propostas comerciais" — ao ser escolhido, entra no repositório
 *    do cliente e a linha aponta pra ele.
 */
```
- apague `COLUNAS_PDF` e `SELECAO_PDFS`;
- troque `OrigemPdf` por:
```ts
export type OrigemPdf = { origem: 'proposta-comercial'; arquivoId: string } | { origem: 'repositorio'; arquivoId: string }
```
- `TipoPdfHistorico` continua importado para `tipoPdfValido`.

- [ ] **Step 7: Teste novo de `pdfs-existentes` (falhando)**

Substitua `src/app/api/historico-contrato/[id]/pdfs-existentes/route.test.ts` por:
```ts
/** @jest-environment node */
import { NextRequest } from 'next/server'

jest.mock('@/lib/auth', () => ({ ...jest.requireActual('@/lib/auth'), getAuthUser: jest.fn() }))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    historicoContrato: { findUnique: jest.fn() },
    usuario: { findUnique: jest.fn() },
    propostaComercialArquivo: { findMany: jest.fn() },
    arquivoCliente: { findMany: jest.fn() },
  },
}))

import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { GET } from './route'

const admin = { id: 'u1', nome: 'Admin', email: 'a@x', role: 'admin' as const }
const contexto = { params: Promise.resolve({ id: 'h1' }) }
const req = (tipo: string) => new NextRequest(`http://localhost/api/historico-contrato/h1/pdfs-existentes?tipo=${tipo}`)

beforeEach(() => {
  jest.clearAllMocks()
  ;(getAuthUser as jest.Mock).mockResolvedValue(admin)
  ;(prisma.historicoContrato.findUnique as jest.Mock).mockResolvedValue({ id: 'h1', tipo: 'ADITIVO', numero: 'TA 01', proposta: 'PA-SF-220814-106', contrato: { clienteId: 'c1' } })
  ;(prisma.propostaComercialArquivo.findMany as jest.Mock).mockResolvedValue([
    { id: 'p1', propostaId: 'pp1', nomeArquivo: 'outra.pdf', tamanhoBytes: 10, createdAt: new Date('2026-09-01T00:00:00Z') },
  ])
  ;(prisma.arquivoCliente.findMany as jest.Mock).mockResolvedValue([
    { id: 'a1', nome: 'PA-SF-220814-106 v3.0.pdf', tamanhoBytes: 20, categoria: 'PROPOSTA_ADITIVO', origem: 'sharepoint', createdAt: new Date('2026-09-02T00:00:00Z') },
  ])
})

it('400 para tipo inválido', async () => {
  expect((await GET(req('x'), contexto)).status).toBe(400)
})

it('lista PDFs do repositório do cliente e da tela de propostas, sugeridos primeiro', async () => {
  const corpo = await (await GET(req('proposta'), contexto)).json()
  expect((prisma.arquivoCliente.findMany as jest.Mock).mock.calls[0][0].where).toEqual({ clienteId: 'c1', removidoEm: null, contentType: 'application/pdf' })
  expect(corpo.referencia).toBe('PA-SF-220814-106')
  expect(corpo.itens[0]).toMatchObject({
    chave: 'repositorio:a1',
    nome: 'PA-SF-220814-106 v3.0.pdf',
    detalhe: 'Proposta de aditivo · SharePoint',
    verUrl: '/api/arquivos/a1?modo=inline',
    sugerido: true,
    origem: { origem: 'repositorio', arquivoId: 'a1' },
  })
  expect(corpo.itens[1]).toMatchObject({ chave: 'proposta-comercial:p1', sugerido: false })
})
```

- [ ] **Step 8: Rodar e ver falhar**

Run: `npx jest "src/app/api/historico-contrato/\[id\]/pdfs-existentes"` → FAIL.

- [ ] **Step 9: Implementar `pdfs-existentes/route.ts`**

Substitua o arquivo por:
```ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { rotuloCategoria } from '@/lib/arquivos/tipos'
import { formatarData } from '@/lib/relatorios-clientes/formatacao'
import { urlDoArquivo } from '@/lib/relatorios-clientes/anexos-historico'
import { nomeCombina, ordenarSugeridosPrimeiro, tipoPdfValido, type PdfExistente } from '@/lib/relatorios-clientes/pdfs-existentes'
import { carregarHistoricoComAcesso } from '../../carregar'

type Contexto = { params: Promise<{ id: string }> }

const LIMITE = 500

/**
 * PDFs que já estão no sistema e podem ser usados na coluna PC/PA (`?tipo=proposta`) ou TC/TA
 * (`?tipo=termo`) desta linha do histórico: os do repositório do cliente da linha (o acesso é checado
 * por esse cliente, então nada de outro cliente aparece) e os da tela "Propostas comerciais".
 * Os que combinam com o texto da linha (proposta / nº do termo) vêm marcados como `sugerido` e primeiro.
 */
export async function GET(request: NextRequest, { params }: Contexto) {
  const { id } = await params
  const tipo = request.nextUrl.searchParams.get('tipo')
  if (!tipoPdfValido(tipo)) return NextResponse.json({ error: 'tipo de anexo inválido' }, { status: 400 })

  const carregado = await carregarHistoricoComAcesso(request, id)
  if ('erro' in carregado) return carregado.erro
  const { linha } = carregado
  const referencia = tipo === 'proposta' ? linha.proposta : linha.numero

  const [doRepositorio, daTelaDePropostas] = await Promise.all([
    prisma.arquivoCliente.findMany({
      where: { clienteId: linha.contrato.clienteId, removidoEm: null, contentType: 'application/pdf' },
      orderBy: { createdAt: 'desc' },
      take: LIMITE,
      select: { id: true, nome: true, tamanhoBytes: true, categoria: true, origem: true, createdAt: true },
    }),
    prisma.propostaComercialArquivo.findMany({
      where: { tipo: 'pdf' },
      orderBy: { createdAt: 'desc' },
      take: LIMITE,
      select: { id: true, propostaId: true, nomeArquivo: true, tamanhoBytes: true, createdAt: true },
    }),
  ])

  const itens: PdfExistente[] = [
    ...doRepositorio.map((arquivo) => ({
      chave: `repositorio:${arquivo.id}`,
      nome: arquivo.nome,
      detalhe: `${rotuloCategoria(arquivo.categoria)} · ${arquivo.origem === 'sharepoint' ? 'SharePoint' : `enviado em ${formatarData(arquivo.createdAt.toISOString())}`}`,
      tamanhoBytes: arquivo.tamanhoBytes,
      verUrl: urlDoArquivo(arquivo.id),
      sugerido: nomeCombina(referencia, arquivo.nome),
      origem: { origem: 'repositorio' as const, arquivoId: arquivo.id },
    })),
    ...daTelaDePropostas.map((arquivo) => ({
      chave: `proposta-comercial:${arquivo.id}`,
      nome: arquivo.nomeArquivo,
      detalhe: `Propostas comerciais · enviado em ${formatarData(arquivo.createdAt.toISOString())}`,
      tamanhoBytes: arquivo.tamanhoBytes,
      verUrl: `/api/propostas-comerciais/${arquivo.propostaId}/arquivos/${arquivo.id}?modo=preview`,
      sugerido: nomeCombina(referencia, arquivo.nomeArquivo),
      origem: { origem: 'proposta-comercial' as const, arquivoId: arquivo.id },
    })),
  ]

  return NextResponse.json({ referencia, itens: ordenarSugeridosPrimeiro(itens) })
}
```

- [ ] **Step 10: Rodar e ver passar**

Run: `npx jest "src/app/api/historico-contrato/\[id\]/pdfs-existentes"` → PASS.

- [ ] **Step 11: Teste novo de `copiar` (falhando)**

Substitua `src/app/api/historico-contrato/[id]/pdf/[tipo]/copiar/route.test.ts` por:
```ts
/** @jest-environment node */
import { NextRequest } from 'next/server'

jest.mock('@/lib/auth', () => ({ ...jest.requireActual('@/lib/auth'), getAuthUser: jest.fn() }))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    historicoContrato: { findUnique: jest.fn(), update: jest.fn() },
    usuario: { findUnique: jest.fn() },
    propostaComercialArquivo: { findFirst: jest.fn() },
    arquivoCliente: { findFirst: jest.fn() },
  },
}))
jest.mock('@/lib/arquivos/registrar-conteudo', () => ({ registrarConteudo: jest.fn() }))
jest.mock('@/lib/storage', () => ({ ...jest.requireActual('@/lib/storage'), getUpload: jest.fn(), putUpload: jest.fn() }))

import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { registrarConteudo } from '@/lib/arquivos/registrar-conteudo'
import { getUpload, putUpload } from '@/lib/storage'
import { POST } from './route'

const admin = { id: 'u1', nome: 'Admin', email: 'a@x', role: 'admin' as const }
const contexto = { params: Promise.resolve({ id: 'h1', tipo: 'termo' }) }
const req = (corpo: unknown) => new NextRequest('http://localhost/x', { method: 'POST', body: JSON.stringify(corpo) })
const depois = { propostaArquivo: null, termoArquivo: { id: 'a9', nome: 'TA 01.pdf' }, propostaDoSharepoint: false, termoDoSharepoint: false }

beforeEach(() => {
  jest.clearAllMocks()
  ;(getAuthUser as jest.Mock).mockResolvedValue(admin)
  ;(prisma.historicoContrato.findUnique as jest.Mock).mockResolvedValue({ id: 'h1', tipo: 'ADITIVO', contrato: { clienteId: 'c1' } })
  ;(prisma.historicoContrato.update as jest.Mock).mockResolvedValue(depois)
})

it('do repositório: aponta pro mesmo arquivo, sem cópia', async () => {
  ;(prisma.arquivoCliente.findFirst as jest.Mock).mockResolvedValue({ id: 'a9' })
  const resposta = await POST(req({ origem: 'repositorio', arquivoId: 'a9' }), contexto)
  expect(resposta.status).toBe(200)
  expect((prisma.arquivoCliente.findFirst as jest.Mock).mock.calls[0][0].where).toEqual({ id: 'a9', clienteId: 'c1', removidoEm: null, contentType: 'application/pdf' })
  expect((prisma.historicoContrato.update as jest.Mock).mock.calls[0][0].data).toEqual({ termoArquivoId: 'a9', termoDoSharepoint: false })
  expect(getUpload).not.toHaveBeenCalled()
  expect(putUpload).not.toHaveBeenCalled()
})

it('do repositório de outro cliente: 404', async () => {
  ;(prisma.arquivoCliente.findFirst as jest.Mock).mockResolvedValue(null)
  expect((await POST(req({ origem: 'repositorio', arquivoId: 'a9' }), contexto)).status).toBe(404)
})

it('da tela de propostas: registra no repositório do cliente e aponta', async () => {
  ;(prisma.propostaComercialArquivo.findFirst as jest.Mock).mockResolvedValue({ caminhoOriginal: 'https://blob/p1.pdf', nomeArquivo: 'TA 01.pdf' })
  ;(getUpload as jest.Mock).mockResolvedValue(Buffer.from('%PDF'))
  ;(registrarConteudo as jest.Mock).mockResolvedValue({ id: 'a9', novo: true })
  const resposta = await POST(req({ origem: 'proposta-comercial', arquivoId: 'p1' }), contexto)
  expect(resposta.status).toBe(200)
  expect((registrarConteudo as jest.Mock).mock.calls[0][1]).toMatchObject({ clienteId: 'c1', nome: 'TA 01.pdf', categoria: 'TERMO_ADITIVO', origem: 'upload', enviadoPorId: 'u1' })
  expect(await resposta.json()).toMatchObject({ termoPdfUrl: '/api/arquivos/a9?modo=inline' })
})

it('origem desconhecida: 400', async () => {
  expect((await POST(req({ origem: 'historico', linhaId: 'h2', coluna: 'termo' }), contexto)).status).toBe(400)
})
```

- [ ] **Step 12: Rodar e ver falhar**

Run: `npx jest "src/app/api/historico-contrato/\[id\]/pdf/\[tipo\]/copiar"` → FAIL.

- [ ] **Step 13: Implementar `copiar/route.ts`**

Substitua o arquivo por:
```ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUpload } from '@/lib/storage'
import { registrarConteudo } from '@/lib/arquivos/registrar-conteudo'
import { SELECAO_ANEXOS, anexosDaLinha, categoriaDaColuna, dadosDaColuna } from '@/lib/relatorios-clientes/anexos-historico'
import { TAMANHO_MAXIMO_PDF_BYTES, tipoPdfValido } from '@/lib/relatorios-clientes/pdfs-existentes'
import { carregarHistoricoComAcesso } from '../../../../carregar'

type Contexto = { params: Promise<{ id: string; tipo: string }> }

/** Corpo da requisição (mesmo formato de `OrigemPdf`, mas tolerante: vem de fora, nada é garantido). */
type CorpoEscolha = { origem?: unknown; arquivoId?: unknown }

/** Usa um PDF que já está no sistema como PC/PA ou TC/TA desta linha. Do repositório: a linha aponta
 *  pro mesmo arquivo. Da tela de propostas: o PDF entra no repositório do cliente e a linha aponta pra
 *  ele. Nos dois casos é anexo "à mão" — a sincronização com o SharePoint não o troca. */
export async function POST(request: NextRequest, { params }: Contexto) {
  const { id, tipo } = await params
  if (!tipoPdfValido(tipo)) return NextResponse.json({ error: 'tipo de anexo inválido' }, { status: 404 })

  const carregado = await carregarHistoricoComAcesso(request, id)
  if ('erro' in carregado) return carregado.erro
  const clienteId = carregado.linha.contrato.clienteId

  const corpo = (await request.json().catch(() => null)) as CorpoEscolha | null
  if (typeof corpo?.arquivoId !== 'string') {
    return NextResponse.json({ error: 'informe a origem do PDF (repositorio ou proposta-comercial)' }, { status: 400 })
  }

  let arquivoId: string
  if (corpo.origem === 'repositorio') {
    const doCliente = await prisma.arquivoCliente.findFirst({
      where: { id: corpo.arquivoId, clienteId, removidoEm: null, contentType: 'application/pdf' },
      select: { id: true },
    })
    if (!doCliente) return NextResponse.json({ error: 'PDF de origem não encontrado' }, { status: 404 })
    arquivoId = doCliente.id
  } else if (corpo.origem === 'proposta-comercial') {
    const origem = await prisma.propostaComercialArquivo.findFirst({
      where: { id: corpo.arquivoId, tipo: 'pdf' },
      select: { caminhoOriginal: true, nomeArquivo: true },
    })
    if (!origem) return NextResponse.json({ error: 'PDF de origem não encontrado' }, { status: 404 })
    let conteudo: Buffer
    try {
      conteudo = await getUpload(origem.caminhoOriginal)
    } catch {
      return NextResponse.json({ error: 'não consegui ler o PDF de origem no armazenamento' }, { status: 502 })
    }
    if (conteudo.length > TAMANHO_MAXIMO_PDF_BYTES) {
      return NextResponse.json({ error: 'o PDF não pode passar de 15 MB' }, { status: 400 })
    }
    arquivoId = (
      await registrarConteudo(prisma, {
        clienteId,
        nome: origem.nomeArquivo,
        conteudo,
        categoria: categoriaDaColuna(tipo, carregado.linha.tipo),
        origem: 'upload',
        enviadoPorId: carregado.usuario.id,
      })
    ).id
  } else {
    return NextResponse.json({ error: 'informe a origem do PDF (repositorio ou proposta-comercial)' }, { status: 400 })
  }

  const linha = await prisma.historicoContrato.update({
    where: { id },
    data: dadosDaColuna(tipo, arquivoId, false),
    select: SELECAO_ANEXOS,
  })
  return NextResponse.json(anexosDaLinha(linha))
}
```

- [ ] **Step 14: Rodar e ver passar**

Run: `npx jest src/app/api/historico-contrato` → PASS.

- [ ] **Step 15: Tela — download e aviso "vem do SharePoint"**

Em `src/app/clientes/[id]/contratos/[contratoId]/secao-historico.tsx`:
1. No tipo `LinhaHistorico`, depois de `termoPdfNome?: string | null`:
```ts
  /** Coluna preenchida pela sincronização com o SharePoint (volta se removida aqui). */
  propostaDoSharepoint?: boolean
  termoDoSharepoint?: boolean
```
2. Em `CampoTexto`, inclua `'propostaDoSharepoint' | 'termoDoSharepoint'` na lista do `Exclude`.
3. Em `ModalPdf`, troque
```ts
  // O Vercel Blob serve `?download=1` como anexo — o atributo `download` não vale entre origens.
  const urlDownload = url ? `${url}${url.includes('?') ? '&' : '?'}download=1` : '#'
```
por
```ts
  // /api/arquivos/[id] sem `?modo=inline` responde como anexo (download).
  const urlDownload = url ? url.replace(/\?modo=inline$/, '') : '#'
  const doSharepoint = linha ? (tipo === 'proposta' ? linha.propostaDoSharepoint : linha.termoDoSharepoint) : false
```
4. Logo depois do `<iframe … />`, acrescente:
```tsx
          {doSharepoint && (
            <p className="bg-light-grey px-5 py-2 text-xs text-mid-grey">
              Este PDF vem do SharePoint e é atualizado sozinho. Removido aqui, ele volta na próxima sincronização —
              para trocar de vez, anexe outro PDF (anexo feito à mão não é substituído).
            </p>
          )}
```

Run: `npx jest "src/app/clientes/\[id\]/contratos"` → PASS (ajuste fixtures só se o teste montar `LinhaHistorico` sem os campos novos — são opcionais, não deve precisar).

- [ ] **Step 16: Tipos**

Run: `npx tsc --noEmit -p .` → nenhum erro além da base.

- [ ] **Step 17: Commit**

```bash
git add src/app/api/historico-contrato src/lib/relatorios-clientes/pdfs-existentes.ts "src/app/clientes/[id]/contratos/[contratoId]/secao-historico.tsx"
git commit -m "feat(historico): anexar, escolher e remover PDF da linha por referência ao repositório; aviso de PDF vindo do SharePoint"
```

---

### Task 6: Migração das cópias antigas para referência

**Files:**
- Create: `src/lib/importacao-sharepoint/migracao-anexos.ts`
- Create: `src/lib/importacao-sharepoint/migracao-anexos.test.ts`

**Interfaces:**
- Consumes: `registrarConteudo` (Task 3), `COLUNAS_ANEXO`, `categoriaDaColuna` (Task 4).
- Produces:
  - `migrarAnexosParaReferencia(db: PrismaClient, opcoes: { aplicar: boolean; baixar?: (url: string) => Promise<Buffer>; gravarBlob?: (c: string, b: Buffer, t: string) => Promise<string> }): Promise<ResultadoMigracaoAnexos>`
  - `ResultadoMigracaoAnexos { referenciados: number; novosNoRepositorio: number; reaproveitados: number; falhas: Array<{ linhaId: string; coluna: 'proposta' | 'termo'; motivo: string }> }`
  - `apagarCopiasMigradas(db: PrismaClient, opcoes: { aplicar: boolean; apagarBlob?: (url: string) => Promise<void> }): Promise<{ apagadas: number }>` — lança erro se ainda houver linha com URL e sem referência.

- [ ] **Step 1: Teste (falhando)**

`src/lib/importacao-sharepoint/migracao-anexos.test.ts`:
```ts
/** @jest-environment node */
jest.mock('@/lib/prisma', () => ({ prisma: {} }))
jest.mock('@/lib/arquivos/registrar-conteudo', () => ({ registrarConteudo: jest.fn() }))
jest.mock('@/lib/storage', () => ({ putUpload: jest.fn(), deleteUpload: jest.fn(), getUpload: jest.fn() }))

import type { PrismaClient } from '@prisma/client'
import { registrarConteudo } from '@/lib/arquivos/registrar-conteudo'
import { apagarCopiasMigradas, migrarAnexosParaReferencia } from './migracao-anexos'

const linha = (extra: object) => ({
  id: 'h1', tipo: 'CONTRATO', chaveSharepoint: 'SMS|1 2023|SMS/TC 1/1) Inicial',
  propostaPdfUrl: null, propostaPdfNome: null, propostaArquivoId: null,
  termoPdfUrl: 'https://blob/historico-contrato/h1/termo.pdf', termoPdfNome: 'TC 1-2023.pdf', termoArquivoId: null,
  contrato: { clienteId: 'c1' },
  ...extra,
})

function db(linhas: object[], pendentes = 0) {
  return {
    historicoContrato: {
      findMany: jest.fn(async () => linhas),
      update: jest.fn(async () => ({})),
      count: jest.fn(async () => pendentes),
    },
  }
}

beforeEach(() => jest.clearAllMocks())

it('baixa a cópia, registra no repositório do cliente e grava a referência (linha do SharePoint → acompanha o SharePoint)', async () => {
  const banco = db([linha({})])
  ;(registrarConteudo as jest.Mock).mockResolvedValue({ id: 'a1', novo: true })
  const baixar = jest.fn(async () => Buffer.from('%PDF'))
  const r = await migrarAnexosParaReferencia(banco as unknown as PrismaClient, { aplicar: true, baixar })
  expect(baixar).toHaveBeenCalledWith('https://blob/historico-contrato/h1/termo.pdf')
  expect((registrarConteudo as jest.Mock).mock.calls[0][1]).toMatchObject({ clienteId: 'c1', nome: 'TC 1-2023.pdf', categoria: 'TERMO_CONTRATO', origem: 'migrado', enviadoPorId: null })
  expect(banco.historicoContrato.update).toHaveBeenCalledWith({ where: { id: 'h1' }, data: { termoArquivoId: 'a1', termoDoSharepoint: true } })
  expect(r).toEqual({ referenciados: 1, novosNoRepositorio: 1, reaproveitados: 0, falhas: [] })
})

it('linha sem chave do SharePoint é anexo à mão', async () => {
  const banco = db([linha({ chaveSharepoint: null })])
  ;(registrarConteudo as jest.Mock).mockResolvedValue({ id: 'a1', novo: false })
  await migrarAnexosParaReferencia(banco as unknown as PrismaClient, { aplicar: true, baixar: async () => Buffer.from('x') })
  expect(banco.historicoContrato.update.mock.calls[0][0].data).toEqual({ termoArquivoId: 'a1', termoDoSharepoint: false })
})

it('sem --aplicar só conta; falha de download vai pro relatório', async () => {
  const banco = db([linha({}), linha({ id: 'h2' })])
  const baixar = jest.fn().mockResolvedValueOnce(Buffer.from('x')).mockRejectedValueOnce(new Error('404'))
  const r = await migrarAnexosParaReferencia(banco as unknown as PrismaClient, { aplicar: false, baixar })
  expect(r.referenciados).toBe(1)
  expect(r.falhas).toEqual([{ linhaId: 'h2', coluna: 'termo', motivo: '404' }])
  expect(registrarConteudo).not.toHaveBeenCalled()
  expect(banco.historicoContrato.update).not.toHaveBeenCalled()
})

it('apagar cópias: recusa enquanto houver linha sem referência', async () => {
  await expect(apagarCopiasMigradas(db([], 2) as unknown as PrismaClient, { aplicar: true })).rejects.toThrow(/2 linha/)
})

it('apagar cópias: apaga o blob antigo e limpa as colunas de URL', async () => {
  const banco = db([linha({ termoArquivoId: 'a1' })])
  const apagarBlob = jest.fn(async () => {})
  expect(await apagarCopiasMigradas(banco as unknown as PrismaClient, { aplicar: true, apagarBlob })).toEqual({ apagadas: 1 })
  expect(apagarBlob).toHaveBeenCalledWith('https://blob/historico-contrato/h1/termo.pdf')
  expect(banco.historicoContrato.update).toHaveBeenCalledWith({ where: { id: 'h1' }, data: { termoPdfUrl: null, termoPdfNome: null } })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx jest src/lib/importacao-sharepoint/migracao-anexos.test.ts` → FAIL (módulo não existe).

- [ ] **Step 3: Implementar**

`src/lib/importacao-sharepoint/migracao-anexos.ts`:
```ts
import type { PrismaClient } from '@prisma/client'
import { deleteUpload, getUpload } from '@/lib/storage'
import { registrarConteudo } from '@/lib/arquivos/registrar-conteudo'
import { COLUNAS_ANEXO, categoriaDaColuna, dadosDaColuna, type ColunaAnexo } from '@/lib/relatorios-clientes/anexos-historico'

// Migração das cópias de PDF nas linhas do histórico (`*PdfUrl`) para referência ao repositório do
// cliente (spec docs/superpowers/specs/2026-09-23-sharepoint-lugar-certo-design.md §6.3). Duas etapas,
// porque o código antigo lê as URLs até o deploy do novo:
//   1. `migrarAnexosParaReferencia`: preenche `*ArquivoId` (não apaga nada) — roda ANTES do deploy;
//   2. `apagarCopiasMigradas`: apaga os blobs das cópias e limpa as URLs — roda DEPOIS do deploy.

const COLUNAS_URL = {
  proposta: { url: 'propostaPdfUrl', nome: 'propostaPdfNome' },
  termo: { url: 'termoPdfUrl', nome: 'termoPdfNome' },
} as const

const SEM_REFERENCIA = {
  OR: [
    { propostaPdfUrl: { not: null }, propostaArquivoId: null },
    { termoPdfUrl: { not: null }, termoArquivoId: null },
  ],
}

export interface ResultadoMigracaoAnexos {
  referenciados: number
  novosNoRepositorio: number
  reaproveitados: number
  falhas: Array<{ linhaId: string; coluna: ColunaAnexo; motivo: string }>
}

export async function migrarAnexosParaReferencia(
  db: PrismaClient,
  opcoes: { aplicar: boolean; baixar?: (url: string) => Promise<Buffer>; gravarBlob?: (c: string, b: Buffer, t: string) => Promise<string> }
): Promise<ResultadoMigracaoAnexos> {
  const baixar = opcoes.baixar ?? getUpload
  const r: ResultadoMigracaoAnexos = { referenciados: 0, novosNoRepositorio: 0, reaproveitados: 0, falhas: [] }
  const linhas = await db.historicoContrato.findMany({
    where: SEM_REFERENCIA,
    select: {
      id: true, tipo: true, chaveSharepoint: true,
      propostaPdfUrl: true, propostaPdfNome: true, propostaArquivoId: true,
      termoPdfUrl: true, termoPdfNome: true, termoArquivoId: true,
      contrato: { select: { clienteId: true } },
    },
  })

  for (const linha of linhas) {
    for (const coluna of ['proposta', 'termo'] as const) {
      const url = linha[COLUNAS_URL[coluna].url]
      if (!url || linha[COLUNAS_ANEXO[coluna].arquivoId]) continue
      try {
        const conteudo = await baixar(url)
        if (!opcoes.aplicar) {
          r.referenciados++
          continue
        }
        const { id, novo } = await registrarConteudo(
          db,
          {
            clienteId: linha.contrato.clienteId,
            nome: linha[COLUNAS_URL[coluna].nome] ?? `${COLUNAS_ANEXO[coluna].rotulo.replace('/', '-')}.pdf`,
            conteudo,
            categoria: categoriaDaColuna(coluna, linha.tipo),
            origem: 'migrado',
            enviadoPorId: null,
          },
          { gravarBlob: opcoes.gravarBlob }
        )
        if (novo) r.novosNoRepositorio++
        else r.reaproveitados++
        // Linha criada pela importação do SharePoint → a coluna acompanha o SharePoint; senão foi à mão.
        await db.historicoContrato.update({ where: { id: linha.id }, data: dadosDaColuna(coluna, id, linha.chaveSharepoint !== null) })
        r.referenciados++
      } catch (erro) {
        r.falhas.push({ linhaId: linha.id, coluna, motivo: erro instanceof Error ? erro.message : String(erro) })
      }
    }
  }
  return r
}

export async function apagarCopiasMigradas(
  db: PrismaClient,
  opcoes: { aplicar: boolean; apagarBlob?: (url: string) => Promise<void> }
): Promise<{ apagadas: number }> {
  const apagarBlob = opcoes.apagarBlob ?? deleteUpload
  const pendentes = await db.historicoContrato.count({ where: SEM_REFERENCIA })
  if (pendentes > 0) throw new Error(`${pendentes} linha(s) ainda com cópia e sem referência — rode a migração sem --apagar-copias primeiro`)

  const linhas = await db.historicoContrato.findMany({
    where: { OR: [{ propostaPdfUrl: { not: null } }, { termoPdfUrl: { not: null } }] },
    select: { id: true, propostaPdfUrl: true, termoPdfUrl: true },
  })
  let apagadas = 0
  for (const linha of linhas) {
    for (const coluna of ['proposta', 'termo'] as const) {
      const url = linha[COLUNAS_URL[coluna].url]
      if (!url) continue
      apagadas++
      if (!opcoes.aplicar) continue
      await apagarBlob(url).catch(() => {})
      await db.historicoContrato.update({
        where: { id: linha.id },
        data: coluna === 'proposta' ? { propostaPdfUrl: null, propostaPdfNome: null } : { termoPdfUrl: null, termoPdfNome: null },
      })
    }
  }
  return { apagadas }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx jest src/lib/importacao-sharepoint/migracao-anexos.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/importacao-sharepoint/migracao-anexos.ts src/lib/importacao-sharepoint/migracao-anexos.test.ts
git commit -m "feat(sharepoint): migração das cópias de PDF do histórico para referência ao repositório"
```

---

### Task 7: Identidade estável do termo (regra pura)

**Files:**
- Create: `src/lib/importacao-sharepoint/identidade.ts`
- Create: `src/lib/importacao-sharepoint/identidade.test.ts`

**Interfaces:**
- Produces:
  - `PastaDeTermo { pasta: string; tipo: TipoTermo; numero: string | null; arquivos: string[]; hashes: string[] }`
  - `GrupoDeTermo { pastas: PastaDeTermo[]; tipo: TipoTermo; numero: string | null }`
  - `LinhaConhecida { id: string; tipo: string; numero: string | null; caminhos: string[]; pastaAntiga: string | null; hashes: string[] }`
  - `chaveDoTermo(tipo: string, numero: string | null): string | null`
  - `agruparTermos(pastas: PastaDeTermo[]): { grupos: GrupoDeTermo[]; avisos: string[] }`
  - `resolverLinhas(grupos: GrupoDeTermo[], linhas: LinhaConhecida[]): Array<string | null>` (mesma ordem de `grupos`; `null` = linha nova)

- [ ] **Step 1: Teste (falhando)**

`src/lib/importacao-sharepoint/identidade.test.ts`:
```ts
import { agruparTermos, chaveDoTermo, resolverLinhas, type LinhaConhecida, type PastaDeTermo } from './identidade'

const pasta = (p: Partial<PastaDeTermo> & Pick<PastaDeTermo, 'pasta'>): PastaDeTermo => ({ tipo: 'ADITIVO', numero: null, arquivos: [`${p.pasta}/x.pdf`], hashes: [], ...p })
const linha = (l: Partial<LinhaConhecida> & Pick<LinhaConhecida, 'id'>): LinhaConhecida => ({ tipo: 'ADITIVO', numero: null, caminhos: [], pastaAntiga: null, hashes: [], ...l })
const resolver = (pastas: PastaDeTermo[], linhas: LinhaConhecida[]) => resolverLinhas(agruparTermos(pastas).grupos, linhas)

describe('chaveDoTermo', () => {
  it('contrato inicial é único; aditivo pelo número tolerante; sem número ou XX não tem chave', () => {
    expect(chaveDoTermo('CONTRATO', null)).toBe('CONTRATO')
    expect(chaveDoTermo('ADITIVO', 'TA 01')).toBe(chaveDoTermo('PRORROGACAO', 'TA 001'))
    expect(chaveDoTermo('ADITIVO', 'TA XX')).toBeNull()
    expect(chaveDoTermo('RESCISAO', null)).toBeNull()
  })
})

describe('agruparTermos', () => {
  it('mesma pasta em dois lugares com o mesmo PDF é um termo só (SMIT TC 52)', () => {
    const { grupos, avisos } = agruparTermos([
      pasta({ pasta: 'SMIT/Contratos Finalizados/TC 12/2) TA XX/1) TC 52 - Contrato Inicial', tipo: 'CONTRATO', hashes: ['h52'] }),
      pasta({ pasta: 'SMIT/TC 52/1) TC 52 - Contrato inicial', tipo: 'CONTRATO', hashes: ['h52', 'hpc'] }),
    ])
    expect(grupos).toHaveLength(1)
    expect(avisos).toEqual([])
  })
  it('mesmo número sem arquivo em comum: separados e com aviso (SMDHC com dois "TA 001")', () => {
    const { grupos, avisos } = agruparTermos([
      pasta({ pasta: 'SMDHC/TC 1/2) TA 001 - Transf titularidade', numero: 'TA 001', hashes: ['a'] }),
      pasta({ pasta: 'SMDHC/TC 1/5) TA 001 - Reajuste', numero: 'TA 001', hashes: ['b'] }),
    ])
    expect(grupos).toHaveLength(2)
    expect(avisos).toHaveLength(1)
  })
})

describe('resolverLinhas', () => {
  it('passo 2: mesmo caminho de arquivo já ligado à linha', () => {
    expect(resolver([pasta({ pasta: 'P/TA 01', numero: 'TA 01', arquivos: ['P/TA 01/novo.pdf', 'P/TA 01/a.pdf'] })], [linha({ id: 'L1', numero: 'TA 01', caminhos: ['P/TA 01/a.pdf'] })])).toEqual(['L1'])
  })
  it('passo 2: pasta gravada na chave antiga do importador', () => {
    expect(resolver([pasta({ pasta: 'P/3) TA XX - Redução', numero: 'TA XX' })], [linha({ id: 'L1', numero: 'TA XX', pastaAntiga: 'P/3) TA XX - Redução' })])).toEqual(['L1'])
  })
  it('passo 3: contrato movido para "Contratos Finalizados" — casa por tipo e número', () => {
    const r = resolver(
      [
        pasta({ pasta: 'X/Contratos Finalizados/TC 1/1) Inicial', tipo: 'CONTRATO' }),
        pasta({ pasta: 'X/Contratos Finalizados/TC 1/2) TA 01 - 12m', tipo: 'PRORROGACAO', numero: 'TA 01' }),
      ],
      [linha({ id: 'LC', tipo: 'CONTRATO' }), linha({ id: 'L1', tipo: 'ADITIVO', numero: 'TA 1' })]
    )
    expect(r).toEqual(['LC', 'L1'])
  })
  it('passo 4: "TA XX" renomeada para "TA 03" — casa pelo conteúdo', () => {
    expect(resolver([pasta({ pasta: 'P/4) TA 03 - Redução', numero: 'TA 03', hashes: ['h'] })], [linha({ id: 'LX', numero: 'TA XX', hashes: ['h'] })])).toEqual(['LX'])
  })
  it('PA repetido em TA 02 e TA 03: o número vem antes do conteúdo, TA 03 vira linha nova', () => {
    const r = resolver(
      [
        pasta({ pasta: 'P/3) TA 02', numero: 'TA 02', arquivos: ['P/3) TA 02/PA.pdf'], hashes: ['pa'] }),
        pasta({ pasta: 'P/4) TA 03', numero: 'TA 03', arquivos: ['P/4) TA 03/PA.pdf'], hashes: ['pa'] }),
      ],
      [linha({ id: 'L2', numero: 'TA 02', caminhos: ['P/3) TA 02/PA.pdf'], hashes: ['pa'] })]
    )
    expect(r).toEqual(['L2', null])
  })
  it('número que casa com duas linhas livres não resolve (fica nova — nunca chuta)', () => {
    expect(resolver([pasta({ pasta: 'P/TA 01', numero: 'TA 01' })], [linha({ id: 'A', numero: 'TA 01' }), linha({ id: 'B', numero: 'TA 1' })])).toEqual([null])
  })
  it('prospecção nunca é reivindicada', () => {
    expect(resolver([pasta({ pasta: 'P/TA 01', numero: 'TA 01' })], [linha({ id: 'P', tipo: 'PROSPECCAO', numero: 'TA 01' })])).toEqual([null])
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx jest src/lib/importacao-sharepoint/identidade.test.ts` → FAIL (módulo não existe).

- [ ] **Step 3: Implementar**

`src/lib/importacao-sharepoint/identidade.ts`:
```ts
import { chaveExata } from '@/lib/relatorios-clientes/vincular-itens'
import type { TipoTermo } from './estrutura'

// Qual linha do histórico é cada pasta de termo do SharePoint — sem depender do caminho da pasta
// (spec docs/superpowers/specs/2026-09-23-sharepoint-lugar-certo-design.md §3.3). Mover o contrato para
// "Contratos Finalizados", mudar o rótulo, renomear "TA XX" para "TA 03" ou ter a mesma pasta em dois
// lugares nunca pode criar linha duplicada. Regra pura: sem banco.

export interface PastaDeTermo {
  /** Caminho da pasta do termo (ou `<pasta do contrato>#inicial`). */
  pasta: string
  tipo: TipoTermo
  numero: string | null
  /** Caminhos dos arquivos da pasta, inclusive WORK/. */
  arquivos: string[]
  /** SHA-256 desses arquivos. */
  hashes: string[]
}

export interface GrupoDeTermo {
  pastas: PastaDeTermo[]
  tipo: TipoTermo
  numero: string | null
}

export interface LinhaConhecida {
  id: string
  tipo: string
  numero: string | null
  /** Caminhos de arquivo do SharePoint já ligados à linha (estado da sincronização). */
  caminhos: string[]
  /** Pasta gravada em `chaveSharepoint` pelo importador antigo (`<contrato>|<pasta>`). */
  pastaAntiga: string | null
  /** Conteúdos já ligados à linha (estado da sincronização + colunas PC/PA–TC/TA). */
  hashes: string[]
}

/** Contrato inicial é um só por contrato; os demais pelo número tolerante. Sem número (ou "XX") não
 *  tem chave — só se acha por caminho ou conteúdo. */
export function chaveDoTermo(tipo: string, numero: string | null): string | null {
  if (tipo === 'CONTRATO') return 'CONTRATO'
  if (!numero || /\bXX\b/i.test(numero)) return null
  const chave = chaveExata(numero)
  return chave ? `T:${chave}` : null
}

function algumEmComum(a: string[], b: string[]): boolean {
  const conjunto = new Set(a)
  return b.some((item) => conjunto.has(item))
}

/** Passo 1: pastas com a mesma chave são o mesmo termo só se dividem ao menos um arquivo por conteúdo. */
export function agruparTermos(pastas: PastaDeTermo[]): { grupos: GrupoDeTermo[]; avisos: string[] } {
  const grupos: GrupoDeTermo[] = []
  const avisos: string[] = []
  for (const pasta of pastas) {
    const chave = chaveDoTermo(pasta.tipo, pasta.numero)
    if (chave !== null) {
      const mesmaChave = grupos.filter((g) => chaveDoTermo(g.tipo, g.numero) === chave)
      const junto = mesmaChave.find((g) => algumEmComum(g.pastas.flatMap((p) => p.hashes), pasta.hashes))
      if (junto) {
        junto.pastas.push(pasta)
        continue
      }
      if (mesmaChave.length > 0) {
        avisos.push(`duas pastas com o mesmo termo (${pasta.numero ?? 'contrato inicial'}) e nenhum arquivo em comum — ${pasta.pasta} fica como linha separada, revise`)
      }
    }
    grupos.push({ pastas: [pasta], tipo: pasta.tipo, numero: pasta.numero })
  }
  return { grupos, avisos }
}

/** Passos 2–5, em rodadas sobre todos os grupos: mesmo caminho → mesmo tipo e número → mesmo conteúdo
 *  → linha nova. Só casa quando o candidato é ÚNICO entre as linhas ainda não reivindicadas. */
export function resolverLinhas(grupos: GrupoDeTermo[], linhas: LinhaConhecida[]): Array<string | null> {
  const resultado: Array<string | null> = grupos.map(() => null)
  const reivindicadas = new Set<string>()
  const livres = linhas.filter((l) => l.tipo !== 'PROSPECCAO')

  function rodada(criterio: (grupo: GrupoDeTermo, linha: LinhaConhecida) => boolean) {
    grupos.forEach((grupo, i) => {
      if (resultado[i] !== null) return
      const candidatas = livres.filter((l) => !reivindicadas.has(l.id) && criterio(grupo, l))
      if (candidatas.length !== 1) return
      resultado[i] = candidatas[0].id
      reivindicadas.add(candidatas[0].id)
    })
  }

  // 2) Mesmo caminho: algum arquivo da pasta já aponta pra linha, ou a chave antiga guarda a pasta.
  rodada((g, l) => {
    const pastas = new Set(g.pastas.map((p) => p.pasta))
    return algumEmComum(l.caminhos, g.pastas.flatMap((p) => p.arquivos)) || (l.pastaAntiga !== null && pastas.has(l.pastaAntiga))
  })
  // 3) Mesmo tipo e número.
  rodada((g, l) => {
    const chave = chaveDoTermo(g.tipo, g.numero)
    if (chave === null) return false
    return chave === 'CONTRATO' ? l.tipo === 'CONTRATO' : l.tipo !== 'CONTRATO' && chaveDoTermo(l.tipo, l.numero) === chave
  })
  // 4) Mesmo conteúdo (depois do número: o mesmo PA aparece repetido em TA 02 e TA 03).
  rodada((g, l) => algumEmComum(l.hashes, g.pastas.flatMap((p) => p.hashes)))

  return resultado
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx jest src/lib/importacao-sharepoint/identidade.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/importacao-sharepoint/identidade.ts src/lib/importacao-sharepoint/identidade.test.ts
git commit -m "feat(sharepoint): identidade estável do termo — caminho, número e conteúdo, nunca duplica"
```

---

### Task 8: Importação no fluxo de cliente v2 (clientes separados, linhas pela identidade, colunas por referência)

**Files:**
- Create: `src/lib/importacao-sharepoint/clientes.ts`
- Create: `src/lib/importacao-sharepoint/clientes.test.ts`
- Modify: `src/lib/importacao-sharepoint/importar.ts` (reescrito)
- Create: `src/lib/importacao-sharepoint/importar.test.ts`

**Interfaces:**
- Consumes: `siglaDaPasta`, `normalizarChave`, `ClientePorSigla`, `MapaPastas` (Task 2); `agruparTermos`, `resolverLinhas`, `LinhaConhecida` (Task 7); `COLUNAS_ANEXO` (Task 4).
- Produces:
  - `garantirClientes(db: Pick<PrismaClient, 'cliente'>, p: { aplicar: boolean; pastas: string[]; mapa: MapaPastas; nomes: Record<string, string> }): Promise<ResultadoClientes>`; `ResultadoClientes { clientes: ClientePorSigla; criados: string[]; renomeados: string[]; semNomeOficial: string[] }`
  - `TermoLido extends TermoPasta { campos: CamposTermo | null; hashes: string[] }`, `ContratoLido extends Omit<ContratoPasta, 'termos'> { termos: TermoLido[] }`
  - `OpcoesImportacao { aplicar: boolean; contratos: ContratoLido[]; clientes: ClientePorSigla; arquivoIdPorCaminho: Map<string, string> }`
  - `ResultadoImportacao { contratosCriados; contratosCompletados; linhasCriadas; linhasCompletadas; anexosLigados: number; avisos: string[]; contratoPorCaminho: Map<string, string>; linhaPorCaminho: Map<string, string> }`
  - `importarContratos(db: PrismaClient, opcoes: OpcoesImportacao): Promise<ResultadoImportacao>`

- [ ] **Step 1: Teste de `garantirClientes` (falhando)**

`src/lib/importacao-sharepoint/clientes.test.ts`:
```ts
import type { PrismaClient } from '@prisma/client'
import { garantirClientes } from './clientes'

function db() {
  return {
    cliente: {
      findMany: jest.fn(async () => [
        { id: 'c-sms', nome: 'SMS', siglaLegado: 'SMS' },
        { id: 'c-sgm', nome: 'Secretaria de Governo', siglaLegado: 'SGM' },
      ]),
      create: jest.fn(async ({ data }: any) => ({ id: `novo-${data.siglaLegado}` })),
      update: jest.fn(),
    },
  }
}

it('cria o cliente que falta pela sigla (mapa vale), corrige nome que é só a sigla e ignora pasta nula', async () => {
  const banco = db()
  const r = await garantirClientes(banco as unknown as PrismaClient, {
    aplicar: true,
    pastas: ['SMS', 'SGM - CASA CIVIL', 'SUB-ITAM PAULISTA', 'IGNORAR'],
    mapa: { 'SGM - CASA CIVIL': 'SGM', 'SUB-ITAM PAULISTA': 'SUB-ITP', IGNORAR: null },
    nomes: { SMS: 'Secretaria Municipal da Saúde', 'SUB-ITP': 'Subprefeitura Itaim Paulista' },
  })
  expect(r.criados).toEqual(['SUB-ITP — Subprefeitura Itaim Paulista'])
  expect(banco.cliente.create).toHaveBeenCalledWith({ data: { nome: 'Subprefeitura Itaim Paulista', siglaLegado: 'SUB-ITP' }, select: { id: true } })
  expect(r.clientes.get('SUB-ITP')).toEqual({ id: 'novo-SUB-ITP', nome: 'Subprefeitura Itaim Paulista' })
  expect(r.renomeados).toEqual(['SMS → Secretaria Municipal da Saúde'])
  expect(r.clientes.has('IGNORAR')).toBe(false)
})

it('sem --aplicar não grava e devolve id simulado', async () => {
  const banco = db()
  const r = await garantirClientes(banco as unknown as PrismaClient, { aplicar: false, pastas: ['SPTURIS'], mapa: {}, nomes: {} })
  expect(r.clientes.get('SPTURIS')?.id).toBe('simulado:SPTURIS')
  expect(r.semNomeOficial).toEqual(['SPTURIS'])
  expect(banco.cliente.create).not.toHaveBeenCalled()
})
```

- [ ] **Step 2: Rodar, ver falhar, implementar `clientes.ts`, ver passar**

Run: `npx jest src/lib/importacao-sharepoint/clientes.test.ts` → FAIL (módulo não existe).

`src/lib/importacao-sharepoint/clientes.ts`:
```ts
import type { PrismaClient } from '@prisma/client'
import { normalizarChave, siglaDaPasta, type ClientePorSigla, type MapaPastas } from '@/lib/arquivos/sharepoint/regras'

// Cliente de cada pasta da biblioteca ContratosReceita (spec 2026-09-24 §8.3, mantida pela spec
// lugar-certo): pela sigla — a própria pasta ou o mapa `pastas` de scripts/sharepoint-clientes.json.
// Cria o que falta com o nome oficial de `nomes`; corrige cliente cujo nome é só a sigla. Nunca casa
// por nome, e é o ÚNICO lugar da sincronização que cria cliente.

export interface ResultadoClientes {
  clientes: ClientePorSigla
  criados: string[]
  renomeados: string[]
  semNomeOficial: string[]
}

export async function garantirClientes(
  db: Pick<PrismaClient, 'cliente'>,
  p: { aplicar: boolean; pastas: string[]; mapa: MapaPastas; nomes: Record<string, string> }
): Promise<ResultadoClientes> {
  const existentes = await db.cliente.findMany({ where: { siglaLegado: { not: null } }, select: { id: true, nome: true, siglaLegado: true } })
  const clientes: ClientePorSigla = new Map(existentes.map((c) => [normalizarChave(c.siglaLegado!), { id: c.id, nome: c.nome }]))
  const nomesPorSigla = new Map(Object.entries(p.nomes).map(([s, n]) => [normalizarChave(s), n]))
  const r: ResultadoClientes = { clientes, criados: [], renomeados: [], semNomeOficial: [] }

  for (const pasta of [...new Set(p.pastas)].sort()) {
    const sigla = siglaDaPasta(pasta, p.mapa)
    if (sigla === null || clientes.has(sigla)) continue
    const nome = nomesPorSigla.get(sigla)
    if (!nome) r.semNomeOficial.push(sigla)
    r.criados.push(`${sigla} — ${nome ?? sigla}`)
    const id = p.aplicar
      ? (await db.cliente.create({ data: { nome: nome ?? sigla, siglaLegado: sigla }, select: { id: true } })).id
      : `simulado:${sigla}`
    clientes.set(sigla, { id, nome: nome ?? sigla })
  }

  for (const c of existentes) {
    const sigla = normalizarChave(c.siglaLegado!)
    const oficial = nomesPorSigla.get(sigla)
    if (oficial && normalizarChave(c.nome) === sigla) {
      r.renomeados.push(`${c.nome} → ${oficial}`)
      if (p.aplicar) await db.cliente.update({ where: { id: c.id }, data: { nome: oficial } })
    }
  }
  return r
}
```
Run: `npx jest src/lib/importacao-sharepoint/clientes.test.ts` → PASS.

- [ ] **Step 3: Teste da importação v2 (falhando)**

`src/lib/importacao-sharepoint/importar.test.ts`:
```ts
/** @jest-environment node */
jest.mock('@/lib/prisma', () => ({ prisma: {} }))
jest.mock('@/lib/relatorios-clientes/vincular-itens', () => ({
  ...jest.requireActual('@/lib/relatorios-clientes/vincular-itens'),
  vincularItensOrfaos: jest.fn(async () => ({ vinculados: 0, ambiguos: 0, semCorrespondencia: 0 })),
}))

import type { PrismaClient } from '@prisma/client'
import { importarContratos, type ContratoLido, type TermoLido } from './importar'

const clientes = new Map([['SMSUB', { id: 'c1', nome: 'Subprefeituras' }]])

function termo(t: Partial<TermoLido> & Pick<TermoLido, 'pasta'>): TermoLido {
  return {
    chave: `SMSUB|211 2022|${t.pasta}`, ordem: 1, tipo: 'CONTRATO', numero: null, rotulo: '', meses: null, aviso: null,
    termoPdf: null, propostaPdf: null, outros: [], arquivos: [], campos: null, hashes: [], ...t,
  }
}

function contrato(termos: TermoLido[], extra: Partial<ContratoLido> = {}): ContratoLido {
  return { chave: 'SMSUB|211 2022', pastaCliente: 'SMSUB', numeroTermo: 'TC 211/2022', descricao: 'Acesso à Rede', finalizado: false, pastas: [], termos, ...extra }
}

function db(estado: { contrato?: any; linhas?: any[] } = {}) {
  let n = 0
  return {
    contrato: {
      findUnique: jest.fn(async () => estado.contrato ?? null),
      findMany: jest.fn(async () => []),
      create: jest.fn(async () => ({ id: 'k-novo' })),
      update: jest.fn(),
    },
    historicoContrato: {
      findMany: jest.fn(async () => estado.linhas ?? []),
      create: jest.fn(async () => ({ id: `h-novo-${++n}` })),
      update: jest.fn(),
    },
  }
}

const linhaDb = (l: object) => ({
  id: 'h1', tipo: 'CONTRATO', numero: 'TC 211/2022', data: null, valor: null, objeto: null, proposta: null, situacao: null,
  dataInicio: null, dataVencimento: null, chaveSharepoint: null,
  propostaArquivoId: null, propostaDoSharepoint: false, termoArquivoId: null, termoDoSharepoint: false,
  propostaArquivo: null, termoArquivo: null, arquivosSharepoint: [], ...l,
})

const inicial = 'SMSUB/TC 211/1) TC 211-SMSUB-COGEL-2022'
const arquivos = new Map([
  [`${inicial}/TC 211.pdf`, 'a-termo'],
  [`${inicial}/PC-SMSUB.pdf`, 'a-pc'],
  [`${inicial}/WORK/Mem_Calc.xlsx`, 'a-work'],
])
const termoInicial = termo({
  pasta: inicial,
  termoPdf: `${inicial}/TC 211.pdf`,
  propostaPdf: `${inicial}/PC-SMSUB.pdf`,
  arquivos: [...arquivos.keys()],
  hashes: ['h-termo', 'h-pc', 'h-work'],
})

it('contrato novo: cria contrato e linha, liga PC/PA e TC/TA por referência (do SharePoint) e diz onde cada arquivo caiu', async () => {
  const banco = db()
  const r = await importarContratos(banco as unknown as PrismaClient, { aplicar: true, contratos: [contrato([termoInicial])], clientes, arquivoIdPorCaminho: arquivos })
  expect(r).toMatchObject({ contratosCriados: 1, linhasCriadas: 1, anexosLigados: 2 })
  expect(banco.historicoContrato.update).toHaveBeenCalledWith({ where: { id: 'h-novo-1' }, data: { propostaArquivoId: 'a-pc', propostaDoSharepoint: true } })
  expect(banco.historicoContrato.update).toHaveBeenCalledWith({ where: { id: 'h-novo-1' }, data: { termoArquivoId: 'a-termo', termoDoSharepoint: true } })
  expect(r.linhaPorCaminho.get(`${inicial}/WORK/Mem_Calc.xlsx`)).toBe('h-novo-1')
  expect(r.contratoPorCaminho.get(`${inicial}/WORK/Mem_Calc.xlsx`)).toBe('k-novo')
})

it('termo já conhecido: não cria linha; PDF trocado no SharePoint troca a coluna do SharePoint', async () => {
  const banco = db({
    contrato: { id: 'k1', chaveSharepoint: 'SMSUB|211 2022', situacao: null },
    linhas: [linhaDb({ termoArquivoId: 'a-velho', termoDoSharepoint: true, arquivosSharepoint: [{ caminho: `${inicial}/PC-SMSUB.pdf`, sha256: 'h-pc' }] })],
  })
  const r = await importarContratos(banco as unknown as PrismaClient, { aplicar: true, contratos: [contrato([termoInicial])], clientes, arquivoIdPorCaminho: arquivos })
  expect(r.linhasCriadas).toBe(0)
  expect(banco.historicoContrato.update).toHaveBeenCalledWith({ where: { id: 'h1' }, data: { termoArquivoId: 'a-termo', termoDoSharepoint: true } })
})

it('coluna anexada à mão nunca é trocada — vira aviso', async () => {
  const banco = db({
    contrato: { id: 'k1', chaveSharepoint: 'SMSUB|211 2022', situacao: null },
    linhas: [linhaDb({ termoArquivoId: 'a-mao', termoDoSharepoint: false })],
  })
  const r = await importarContratos(banco as unknown as PrismaClient, { aplicar: true, contratos: [contrato([termoInicial])], clientes, arquivoIdPorCaminho: arquivos })
  expect(banco.historicoContrato.update).not.toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ termoArquivoId: 'a-termo' }) }))
  expect(r.avisos.join('\n')).toMatch(/anexado à mão/)
})

it('marcadores da própria importação ("TA XX", "Em elaboração") são trocados quando o termo fica pronto', async () => {
  const pastaTa = 'SMSUB/TC 211/3) TC 211 - TA 03 - Redução'
  const banco = db({
    contrato: { id: 'k1', chaveSharepoint: 'SMSUB|211 2022', situacao: null },
    linhas: [linhaDb({ id: 'hx', tipo: 'ADITIVO', numero: 'TA XX', situacao: 'Em elaboração', termoArquivo: null, arquivosSharepoint: [{ caminho: 'SMSUB/TC 211/3) TC 211 - TA XX - Redução/PA.pdf', sha256: 'h-pa' }] })],
  })
  const ta = termo({
    pasta: pastaTa, tipo: 'ADITIVO', numero: 'TA 03', chave: `SMSUB|211 2022|${pastaTa}`,
    arquivos: [`${pastaTa}/PA.pdf`, `${pastaTa}/TA 03 assinado.pdf`], hashes: ['h-pa', 'h-ta'],
    campos: { numeroDocumento: null, seiCliente: null, seiProdam: null, contratante: null, objeto: null, valor: null, assinaturaEm: new Date('2026-09-01T12:00:00Z'), inicio: null, fim: null, meses: null, inicioNaAssinatura: false, prorrogaVigencia: false, semTexto: false },
  })
  await importarContratos(banco as unknown as PrismaClient, { aplicar: true, contratos: [contrato([ta])], clientes, arquivoIdPorCaminho: new Map() })
  const data = (banco.historicoContrato.update as jest.Mock).mock.calls[0][0].data
  expect(data).toMatchObject({ numero: 'TA 03', situacao: null })
})
```

- [ ] **Step 4: Rodar e ver falhar**

Run: `npx jest src/lib/importacao-sharepoint/importar.test.ts`
Expected: FAIL (assinatura antiga de `importarContratos`, sem `clientes`/`arquivoIdPorCaminho`).

- [ ] **Step 5: Reescrever `importar.ts`**

Substitua o arquivo inteiro por:
```ts
import type { Prisma, PrismaClient, TipoHistoricoContrato } from '@prisma/client'
import type { ClientePorSigla } from '@/lib/arquivos/sharepoint/regras'
import { COLUNAS_ANEXO, dadosDaColuna } from '@/lib/relatorios-clientes/anexos-historico'
import { chaveNumerica, vincularItensOrfaos } from '@/lib/relatorios-clientes/vincular-itens'
import type { ContratoPasta, TermoPasta } from './estrutura'
import { agruparTermos, resolverLinhas, type LinhaConhecida } from './identidade'
import { somarMeses, type CamposTermo } from './texto'

// Aplica a árvore lida do SharePoint no fluxo de cliente: Contrato → linhas do histórico (contrato
// inicial, aditivos, prorrogações, rescisão), com PC/PA e TC/TA POR REFERÊNCIA ao repositório do
// cliente. Specs: 2026-09-24-sincronizacao-sharepoint-contratos-design.md §8 e
// 2026-09-23-sharepoint-lugar-certo-design.md §3.2–3.4. Chamado pela sincronização
// (src/lib/arquivos/sharepoint/sincronizar.ts), só para os contratos que mudaram.
//
// Regras que não se negociam:
//   - NÃO sobrescreve campo preenchido (digitado ou do legado) — só os marcadores que a própria
//     importação grava ("TA XX", "Em elaboração") contam como vazios;
//   - linha certa pela identidade estável (identidade.ts) — mover/renomear pasta nunca duplica;
//   - coluna PC/PA–TC/TA preenchida pelo SharePoint acompanha o SharePoint; anexada à mão, nunca.

export interface TermoLido extends TermoPasta {
  campos: CamposTermo | null
  /** SHA-256 dos arquivos da pasta (os que foram lidos com sucesso). */
  hashes: string[]
}

export interface ContratoLido extends Omit<ContratoPasta, 'termos'> {
  termos: TermoLido[]
}

export interface OpcoesImportacao {
  aplicar: boolean
  contratos: ContratoLido[]
  clientes: ClientePorSigla
  /** Caminho de cada arquivo presente → `ArquivoCliente` (depois da etapa de arquivos). */
  arquivoIdPorCaminho: Map<string, string>
}

export interface ResultadoImportacao {
  contratosCriados: number
  contratosCompletados: number
  linhasCriadas: number
  linhasCompletadas: number
  anexosLigados: number
  avisos: string[]
  /** Onde cada arquivo caiu — a sincronização grava em `ArquivoSharepoint.contratoId/historicoId`. */
  contratoPorCaminho: Map<string, string>
  linhaPorCaminho: Map<string, string>
}

type Db = PrismaClient

const SELECAO_LINHA = {
  id: true,
  tipo: true,
  numero: true,
  data: true,
  valor: true,
  objeto: true,
  proposta: true,
  situacao: true,
  dataInicio: true,
  dataVencimento: true,
  chaveSharepoint: true,
  propostaArquivoId: true,
  propostaDoSharepoint: true,
  termoArquivoId: true,
  termoDoSharepoint: true,
  propostaArquivo: { select: { sha256: true } },
  termoArquivo: { select: { sha256: true } },
  arquivosSharepoint: { select: { caminho: true, sha256: true } },
} satisfies Prisma.HistoricoContratoSelect

type LinhaAtual = Prisma.HistoricoContratoGetPayload<{ select: typeof SELECAO_LINHA }>

const EM_ELABORACAO = 'Em elaboração'

function nomeSemExtensao(caminho: string | null): string | null {
  if (!caminho) return null
  return caminho.split('/').pop()!.replace(/\.[^.]+$/, '')
}

function umDiaDepois(d: Date): Date {
  return new Date(d.getTime() + 24 * 60 * 60 * 1000)
}

/** Valor que a própria importação grava enquanto o termo não está pronto — conta como vazio. */
function ehMarcador(campo: string, valor: unknown): boolean {
  if (campo === 'numero') return typeof valor === 'string' && /\bXX\b/i.test(valor)
  if (campo === 'situacao') return valor === EM_ELABORACAO
  return false
}

function mesmoValor(a: unknown, b: unknown): boolean {
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime()
  return a !== null && a !== undefined && String(a) === String(b)
}

/** Só os campos vazios (ou com marcador) recebem o valor novo, e só valor novo não-nulo. */
function soOsVazios<T extends Record<string, unknown>>(atual: Record<string, unknown>, novo: T): Partial<T> {
  const saida: Partial<T> = {}
  for (const [campo, valor] of Object.entries(novo)) {
    if (valor === null || valor === undefined) continue
    const antes = atual[campo]
    const vazio = antes === null || antes === undefined || antes === '' || ehMarcador(campo, antes)
    if (vazio && !mesmoValor(antes, valor)) (saida as Record<string, unknown>)[campo] = valor
  }
  return saida
}

/** Tipo final da linha: aditivo "sem rótulo" cujo texto prorroga a vigência vira prorrogação. */
function tipoDaLinha(termo: TermoLido): TipoHistoricoContrato {
  if (termo.tipo === 'ADITIVO' && !/\bTAP\b/i.test(termo.numero ?? '') && termo.campos?.prorrogaVigencia && (termo.campos.meses || termo.campos.fim)) {
    return 'PRORROGACAO'
  }
  return termo.tipo
}

function linhaConhecida(l: LinhaAtual): LinhaConhecida {
  return {
    id: l.id,
    tipo: l.tipo,
    numero: l.numero,
    caminhos: l.arquivosSharepoint.map((a) => a.caminho),
    // `chaveSharepoint` = `<sigla ou pasta>|<nº ano>|<pasta do termo>` (a pasta não tem "|": o Windows não deixa).
    pastaAntiga: l.chaveSharepoint ? l.chaveSharepoint.split('|').slice(2).join('|') || null : null,
    hashes: [...l.arquivosSharepoint.map((a) => a.sha256), l.propostaArquivo?.sha256, l.termoArquivo?.sha256].filter((h): h is string => !!h),
  }
}

export async function importarContratos(prisma: Db, opcoes: OpcoesImportacao): Promise<ResultadoImportacao> {
  const r: ResultadoImportacao = {
    contratosCriados: 0,
    contratosCompletados: 0,
    linhasCriadas: 0,
    linhasCompletadas: 0,
    anexosLigados: 0,
    avisos: [],
    contratoPorCaminho: new Map(),
    linhaPorCaminho: new Map(),
  }
  for (const contrato of opcoes.contratos) {
    const cliente = opcoes.clientes.get(contrato.chave.split('|')[0])
    if (!cliente) continue
    try {
      await importarContrato(prisma, contrato, cliente.id, opcoes, r)
    } catch (erro) {
      r.avisos.push(`${contrato.chave}: ${erro instanceof Error ? erro.message : String(erro)}`)
    }
  }
  return r
}

async function importarContrato(prisma: Db, contrato: ContratoLido, clienteId: string, ctx: OpcoesImportacao, r: ResultadoImportacao) {
  const inicial = contrato.termos.find((t) => t.tipo === 'CONTRATO' && t.campos && !t.campos.semTexto) ?? contrato.termos.find((t) => t.tipo === 'CONTRATO')
  const k = inicial?.campos ?? null
  const qualquer = (campo: 'seiCliente' | 'seiProdam') => k?.[campo] ?? contrato.termos.find((t) => t.campos?.[campo])?.campos?.[campo] ?? null

  const inicioContrato = k?.inicio ?? (k?.inicioNaAssinatura ? k.assinaturaEm : null)
  const mesesContrato = k?.meses ?? inicial?.meses ?? null
  const fimContrato = k?.fim ?? (inicioContrato && mesesContrato ? somarMeses(inicioContrato, mesesContrato) : null)
  const rescindido = contrato.termos.some((t) => t.tipo === 'RESCISAO' && t.aviso !== 'nao-efetivado')

  const dadosContrato = {
    numeroTermo: contrato.numeroTermo,
    descricao: contrato.descricao,
    seiCliente: qualquer('seiCliente'),
    seiProdam: qualquer('seiProdam'),
    dataInicio: inicioContrato,
    dataVencimento: fimContrato,
    situacao: contrato.finalizado ? 'Finalizado' : rescindido ? 'Rescindido' : null,
  }

  // Contrato: pela identidade (sigla|nº ano); na primeira vez, pelo número tolerante — só se único.
  let existente = await prisma.contrato.findUnique({ where: { chaveSharepoint: contrato.chave } })
  if (!existente) {
    const [numero, ano] = contrato.chave.split('|')[1].split(' ')
    const alvo = numero === 'sn' ? null : `${numero} ${ano}`
    if (alvo) {
      const candidatos = (await prisma.contrato.findMany({ where: { clienteId, chaveSharepoint: null } })).filter(
        (c) => chaveNumerica(c.numeroTermo) === alvo
      )
      if (candidatos.length === 1) existente = candidatos[0]
      else if (candidatos.length > 1) r.avisos.push(`${contrato.chave}: ${candidatos.length} contratos com o mesmo número no cliente — criado à parte, revise`)
    }
  }

  let contratoId: string
  if (existente) {
    if (contrato.finalizado && existente.situacao && !/finaliz|encerr|rescind/i.test(existente.situacao)) {
      r.avisos.push(`${contrato.chave}: está em "Contratos Finalizados" no SharePoint, mas a situação no VerAI é "${existente.situacao}" — mantida`)
    }
    const completar = soOsVazios(existente, dadosContrato)
    if (Object.keys(completar).length > 0 || !existente.chaveSharepoint) {
      r.contratosCompletados++
      if (ctx.aplicar) await prisma.contrato.update({ where: { id: existente.id }, data: { ...completar, chaveSharepoint: contrato.chave } })
    }
    contratoId = existente.id
  } else {
    r.contratosCriados++
    contratoId = ctx.aplicar
      ? (await prisma.contrato.create({ data: { clienteId, ...dadosContrato, chaveSharepoint: contrato.chave }, select: { id: true } })).id
      : `simulado:${contrato.chave}`
  }

  const linhas: LinhaAtual[] = existente ? await prisma.historicoContrato.findMany({ where: { contratoId }, select: SELECAO_LINHA }) : []
  const { grupos, avisos } = agruparTermos(
    contrato.termos.map((t) => ({ pasta: t.pasta, tipo: t.tipo, numero: t.numero, arquivos: t.arquivos, hashes: t.hashes }))
  )
  r.avisos.push(...avisos.map((a) => `${contrato.chave}: ${a}`))
  const alvos = resolverLinhas(grupos, linhas.map(linhaConhecida))

  let vencimentoAnterior: Date | null = fimContrato

  for (const [i, grupo] of grupos.entries()) {
    const termos = grupo.pastas.map((p) => contrato.termos.find((t) => t.pasta === p.pasta)!)
    const termo = termos.find((t) => t.termoPdf) ?? termos[0]
    const c = termo.campos
    const tipo = tipoDaLinha(termo)
    const naoValeu = termo.aviso === 'nao-efetivado'
    const assinatura = naoValeu ? null : (c?.assinaturaEm ?? null)
    const meses = c?.meses ?? termo.meses

    let inicio: Date | null = null
    let fim: Date | null = null
    if (tipo === 'CONTRATO') {
      inicio = inicioContrato
      fim = fimContrato
    } else if (tipo === 'PRORROGACAO') {
      inicio = c?.inicio ?? (vencimentoAnterior ? umDiaDepois(vencimentoAnterior) : null)
      fim = c?.fim ?? (inicio && meses ? somarMeses(inicio, meses) : null)
    } else if (tipo === 'ADITIVO') {
      fim = c?.fim ?? null
    }

    const dados = {
      tipo,
      numero: tipo === 'CONTRATO' ? contrato.numeroTermo : termo.numero,
      data: assinatura,
      valor: tipo === 'RESCISAO' ? null : (c?.valor ?? null),
      objeto: tipo === 'CONTRATO' ? (c?.objeto ?? contrato.descricao) : termo.rotulo || null,
      proposta: nomeSemExtensao(termo.propostaPdf),
      situacao: naoValeu ? 'Cancelado (não efetivado)' : termo.aviso === 'sem-numero' && !assinatura ? EM_ELABORACAO : null,
      dataInicio: inicio,
      dataVencimento: fim,
    }

    const linha = alvos[i] ? linhas.find((l) => l.id === alvos[i]) : undefined
    let linhaId: string
    if (linha) {
      const completar: Record<string, unknown> = soOsVazios(linha, { ...dados, tipo: undefined })
      // "Em elaboração" era marcador: o termo ficou pronto (tem número e/ou assinatura) → sai.
      if (linha.situacao === EM_ELABORACAO && dados.situacao === null) completar.situacao = null
      if (Object.keys(completar).length > 0 || !linha.chaveSharepoint) {
        r.linhasCompletadas++
        if (ctx.aplicar) {
          await prisma.historicoContrato.update({ where: { id: linha.id }, data: { ...completar, chaveSharepoint: linha.chaveSharepoint ?? termo.chave } })
        }
      }
      linhaId = linha.id
    } else {
      r.linhasCriadas++
      linhaId = ctx.aplicar
        ? (
            await prisma.historicoContrato.create({
              data: { contratoId, ...dados, observacao: `Importado do SharePoint: ${termo.pasta}`, chaveSharepoint: termo.chave },
              select: { id: true },
            })
          ).id
        : `simulado:${termo.chave}`
    }

    // Colunas PC/PA e TC/TA: referência ao arquivo do repositório (spec lugar-certo §3.4).
    for (const coluna of ['proposta', 'termo'] as const) {
      const caminho = coluna === 'termo' ? termo.termoPdf : termo.propostaPdf
      if (!caminho) continue
      const arquivoId = ctx.arquivoIdPorCaminho.get(caminho)
      if (!arquivoId) continue // falhou na etapa de arquivos — tenta de novo na próxima execução
      const col = COLUNAS_ANEXO[coluna]
      const atual = linha ? linha[col.arquivoId] : null
      const doSharepoint = linha ? linha[col.doSharepoint] : false
      if (atual === arquivoId) continue
      if (atual && !doSharepoint) {
        r.avisos.push(`${caminho}: a linha já tem ${col.rotulo} anexado à mão — mantido (o do SharePoint está na aba Documentos)`)
        continue
      }
      r.anexosLigados++
      if (ctx.aplicar) await prisma.historicoContrato.update({ where: { id: linhaId }, data: dadosDaColuna(coluna, arquivoId, true) })
    }

    for (const t of termos) {
      for (const caminho of t.arquivos) {
        r.linhaPorCaminho.set(caminho, linhaId)
        r.contratoPorCaminho.set(caminho, contratoId)
      }
    }

    if (fim && (tipo === 'CONTRATO' || assinatura) && (!vencimentoAnterior || fim > vencimentoAnterior)) vencimentoAnterior = fim
    if (termo.campos?.semTexto && termo.termoPdf) r.avisos.push(`${termo.termoPdf}: PDF escaneado (sem texto) — datas e valor ficam pra preencher na tela`)
  }

  if (ctx.aplicar && !existente) await vincularItensOrfaos(prisma, { contratoId })
}
```

- [ ] **Step 6: Rodar e ver passar**

Run: `npx jest src/lib/importacao-sharepoint`
Expected: PASS em `importar.test.ts`, `clientes.test.ts`, `identidade.test.ts`, `estrutura.test.ts`, `texto.test.ts`, `migracao-anexos.test.ts`.

Nota: `scripts/importar-sharepoint-contratos.ts` deixa de compilar aqui (usa a assinatura antiga) — ele é apagado na Task 12. Não o corrija.

- [ ] **Step 7: Commit**

```bash
git add src/lib/importacao-sharepoint/clientes.ts src/lib/importacao-sharepoint/clientes.test.ts src/lib/importacao-sharepoint/importar.ts src/lib/importacao-sharepoint/importar.test.ts
git commit -m "feat(sharepoint): importação no fluxo de cliente pela identidade estável, com PC/PA–TC/TA por referência"
```

---

### Task 9: Sincronização v2 — uma passada só, tudo no lugar, conferência

**Files:**
- Create: `src/lib/arquivos/sharepoint/conferencia.ts`
- Create: `src/lib/arquivos/sharepoint/conferencia.test.ts`
- Modify: `src/lib/arquivos/sharepoint/sincronizar.ts` (reescrito)
- Modify: `src/lib/arquivos/sharepoint/sincronizar.test.ts` (reescrito)

**Interfaces:**
- Consumes: Tasks 2, 3, 4, 8.
- Produces:
  - `conferir(esperados: Map<string, string>, gravados: Set<string>): LinhaConferencia[]` — `esperados`: caminho → rótulo do cliente; `LinhaConferencia { cliente: string; noSharepoint: number; noVerai: number; faltando: string[] }`.
  - `pendenciasDeMigracao(db: PrismaClient): Promise<string[]>`
  - `sincronizarSharepoint(db: PrismaClient, opcoes: OpcoesSincronizacao): Promise<ResultadoSincronizacao>` com
    - `OpcoesSincronizacao { aplicar; fonte: FonteArquivos; mapa?; nomes?; rotearPeloNome?: string[]; clientes?: string[]; relerTudo?: boolean; lerCampos?: (conteudo: Buffer, tipo: TipoTermo) => Promise<CamposTermo>; gravarBlob?; buscarUsos?; importar?: typeof importarContratos; agora?: Date }`
    - `ResultadoSincronizacao { listados; novos; reaproveitados; conteudoTrocado; inalterados; ignorados; semCliente; sumiramDaOrigem; anexosSoltos; removidos; mantidosEmUso; falhas; remocaoSuspensa; clientes: { criados; renomeados; semNomeOficial }; contratos: { contratosCriados; contratosCompletados; linhasCriadas; linhasCompletadas; anexosLigados; avisos; processados }; conferencia: LinhaConferencia[] | null }`

- [ ] **Step 1: Teste da conferência (falhando)**

`src/lib/arquivos/sharepoint/conferencia.test.ts`:
```ts
import { conferir } from './conferencia'

it('por cliente: quantos no SharePoint, quantos no VerAI e quais faltam', () => {
  const esperados = new Map([
    ['SMS/TC 1/a.pdf', 'Saúde'],
    ['SMS/TC 1/b.pdf', 'Saúde'],
    ['SGM/TC 2/c.pdf', 'Governo'],
  ])
  expect(conferir(esperados, new Set(['SMS/TC 1/a.pdf', 'SGM/TC 2/c.pdf']))).toEqual([
    { cliente: 'Governo', noSharepoint: 1, noVerai: 1, faltando: [] },
    { cliente: 'Saúde', noSharepoint: 2, noVerai: 1, faltando: ['SMS/TC 1/b.pdf'] },
  ])
})
```
Run: `npx jest src/lib/arquivos/sharepoint/conferencia.test.ts` → FAIL.

- [ ] **Step 2: Implementar `conferencia.ts` e ver passar**

```ts
// Conferência de cada execução (spec lugar-certo §3.5 item 5): por cliente, os CAMINHOS válidos da
// biblioteca × os caminhos com estado ativo e arquivo ativo no VerAI. Por caminho, não por arquivo —
// o dedup junta dois caminhos com o mesmo conteúdo num arquivo só.

export interface LinhaConferencia {
  cliente: string
  noSharepoint: number
  noVerai: number
  faltando: string[]
}

export function conferir(esperados: Map<string, string>, gravados: Set<string>): LinhaConferencia[] {
  const porCliente = new Map<string, LinhaConferencia>()
  for (const [caminho, cliente] of esperados) {
    const linha = porCliente.get(cliente) ?? { cliente, noSharepoint: 0, noVerai: 0, faltando: [] }
    linha.noSharepoint++
    if (gravados.has(caminho)) linha.noVerai++
    else linha.faltando.push(caminho)
    porCliente.set(cliente, linha)
  }
  return [...porCliente.values()].sort((a, b) => a.cliente.localeCompare(b.cliente, 'pt-BR'))
}
```
Run: `npx jest src/lib/arquivos/sharepoint/conferencia.test.ts` → PASS.

- [ ] **Step 3: Testes da sincronização v2 (falhando)**

Substitua `src/lib/arquivos/sharepoint/sincronizar.test.ts` por:
```ts
/** @jest-environment node */
jest.mock('@/lib/prisma', () => ({ prisma: {} }))
jest.mock('@/lib/storage', () => ({ putUpload: jest.fn(), deleteUpload: jest.fn(async () => {}), getUpload: jest.fn() }))

import type { PrismaClient } from '@prisma/client'
import { sha256Hex, type UsoArquivo } from '../servico'
import { sincronizarSharepoint, type ArquivoFonte } from './sincronizar'

const data = new Date('2026-09-24T10:00:00Z')
const pdfA = Buffer.from('termo A')
const pdfB = Buffer.from('termo B')

function fonte(arquivos: Record<string, Buffer>) {
  const lista: ArquivoFonte[] = Object.entries(arquivos).map(([caminho, c]) => ({ caminho, tamanhoBytes: c.length, modificadoEm: data }))
  return { listar: async () => lista, ler: jest.fn(async (caminho: string) => arquivos[caminho]) }
}

function prismaFake(estados: any[] = [], arquivosCliente: any[] = []) {
  let n = 0
  return {
    cliente: {
      findMany: jest.fn(async () => [{ id: 'c-sms', nome: 'Saúde', siglaLegado: 'SMS' }]),
      create: jest.fn(async ({ data }: any) => ({ id: `c-${data.siglaLegado}` })),
      update: jest.fn(),
    },
    contrato: { findMany: jest.fn(async () => []) },
    historicoContrato: { count: jest.fn(async () => 0), updateMany: jest.fn(async () => ({ count: 0 })) },
    arquivoSharepoint: {
      findMany: jest.fn(async (args: any) => (args?.where ? estados.filter((e) => e.removidoNaOrigemEm === null).map((e) => ({ caminho: e.caminho })) : estados)),
      upsert: jest.fn(),
      update: jest.fn(),
    },
    arquivoCliente: {
      findFirst: jest.fn(async ({ where }: any) => arquivosCliente.find((a) => a.sha256 === where.sha256) ?? null),
      findMany: jest.fn(async ({ where }: any) => arquivosCliente.filter((a) => where.id.in.includes(a.id))),
      create: jest.fn(async () => ({ id: `a-${++n}` })),
      update: jest.fn(),
    },
  }
}

const semUsos = async (ids: string[]) => new Map<string, UsoArquivo[]>(ids.map((id) => [id, []]))
const importarVazio = jest.fn(async () => ({
  contratosCriados: 0, contratosCompletados: 0, linhasCriadas: 0, linhasCompletadas: 0, anexosLigados: 0, avisos: [],
  contratoPorCaminho: new Map<string, string>(), linhaPorCaminho: new Map<string, string>(),
}))
const base = { buscarUsos: semUsos, importar: importarVazio }

beforeEach(() => jest.clearAllMocks())

it('recusa rodar com migração pendente', async () => {
  const prisma = prismaFake()
  prisma.historicoContrato.count.mockResolvedValue(3)
  await expect(sincronizarSharepoint(prisma as unknown as PrismaClient, { aplicar: true, fonte: fonte({}), ...base })).rejects.toThrow(/migrar-sharepoint-lugar-certo/)
})

it('WORK e categoria pelo papel: termo do contrato inicial é TERMO_CONTRATO, memória de cálculo é PLANILHA', async () => {
  const prisma = prismaFake()
  const r = await sincronizarSharepoint(prisma as unknown as PrismaClient, {
    aplicar: true,
    gravarBlob: async () => 'https://blob/x',
    fonte: fonte({ 'SMS/TC 1-2023 - X/1) Inicial/TC 1-2023.pdf': pdfA, 'SMS/TC 1-2023 - X/1) Inicial/WORK/Mem_Calc v1.xlsx': pdfB }),
    ...base,
  })
  expect(r.novos).toBe(2)
  const criados = prisma.arquivoCliente.create.mock.calls.map((c: any) => c[0].data)
  expect(criados.find((d: any) => d.nome === 'TC 1-2023.pdf')).toMatchObject({ categoria: 'TERMO_CONTRATO', origem: 'sharepoint', sha256: sha256Hex(pdfA) })
  expect(criados.find((d: any) => d.nome === 'Mem_Calc v1.xlsx')).toMatchObject({ categoria: 'PLANILHA' })
})

it('publicação do DOC vai pro cliente da sigla no nome; sigla sem cliente vai pro relatório', async () => {
  const prisma = prismaFake()
  const r = await sincronizarSharepoint(prisma as unknown as PrismaClient, {
    aplicar: true,
    gravarBlob: async () => 'https://blob/x',
    rotearPeloNome: ['1. PUBLICAÇÕES NO DOC'],
    fonte: fonte({
      '1. PUBLICAÇÕES NO DOC/2026.09.17 - SMS - Arbitragem - Despacho.pdf': pdfA,
      '1. PUBLICAÇÕES NO DOC/2026.09.17 - SUB-ST - LINC. - eXTRATO.pdf': pdfB,
    }),
    ...base,
  })
  expect(prisma.arquivoCliente.create.mock.calls[0][0].data).toMatchObject({ clienteId: 'c-sms', categoria: 'PUBLICACAO_DOC' })
  expect(r.semCliente).toEqual({ '1. PUBLICAÇÕES NO DOC → SUB-ST': 1 })
  expect(prisma.cliente.create).not.toHaveBeenCalled()
})

it('grava onde cada arquivo caiu (contrato e linha) para os contratos processados', async () => {
  const prisma = prismaFake()
  const caminho = 'SMS/TC 1-2023 - X/1) Inicial/TC 1-2023.pdf'
  const importar = jest.fn(async () => ({
    ...(await importarVazio()),
    contratoPorCaminho: new Map([[caminho, 'k1']]),
    linhaPorCaminho: new Map([[caminho, 'h1']]),
  }))
  await sincronizarSharepoint(prisma as unknown as PrismaClient, { aplicar: true, gravarBlob: async () => 'u', fonte: fonte({ [caminho]: pdfA }), buscarUsos: semUsos, importar })
  expect(importar.mock.calls[0][1].contratos[0].termos[0]).toMatchObject({ termoPdf: caminho, hashes: [sha256Hex(pdfA)] })
  expect(prisma.arquivoSharepoint.update).toHaveBeenCalledWith({ where: { caminho }, data: { contratoId: 'k1', historicoId: 'h1' } })
})

it('sem mudança nenhuma não relê arquivo nem processa contrato', async () => {
  const caminho = 'SMS/TC 1-2023/1) Inicial/a.pdf'
  const estado = { id: 'e1', caminho, tamanhoBytes: pdfA.length, modificadoEm: data, sha256: sha256Hex(pdfA), arquivoId: 'a1', historicoId: 'h1', removidoNaOrigemEm: null, arquivo: { clienteId: 'c-sms' } }
  const prisma = prismaFake([estado])
  const f = fonte({ [caminho]: pdfA })
  const r = await sincronizarSharepoint(prisma as unknown as PrismaClient, { aplicar: true, fonte: f, ...base })
  expect(r.inalterados).toBe(1)
  expect(f.ler).not.toHaveBeenCalled()
  expect(importarVazio.mock.calls[0][1].contratos).toEqual([])
})

it('arquivo movido de pasta: mesmo arquivo, nada removido, contrato reprocessado', async () => {
  // "TC 1-2023" (com ano): sem número + ano a pasta não vira contrato na estrutura.
  const estado = { id: 'e1', caminho: 'SMS/TC 1-2023/1) Inicial/a.pdf', tamanhoBytes: 1, modificadoEm: data, sha256: sha256Hex(pdfA), arquivoId: 'a1', historicoId: 'h1', removidoNaOrigemEm: null, arquivo: { clienteId: 'c-sms' } }
  const prisma = prismaFake([estado], [{ id: 'a1', sha256: sha256Hex(pdfA), origem: 'sharepoint' }])
  const r = await sincronizarSharepoint(prisma as unknown as PrismaClient, {
    aplicar: true,
    fonte: fonte({ 'SMS/Contratos Finalizados/TC 1-2023/1) Inicial/a.pdf': pdfA }),
    ...base,
  })
  expect(r).toMatchObject({ reaproveitados: 1, sumiramDaOrigem: 1, removidos: 0 })
  expect(prisma.arquivoCliente.update).not.toHaveBeenCalled()
  expect(importarVazio.mock.calls[0][1].contratos).toHaveLength(1)
})

it('apagado no SharePoint: solta a coluna do SharePoint e remove; uso do VerAI segura, uso da sincronização não', async () => {
  const estados = [
    { id: 'e1', caminho: 'SMS/TC 1/a.pdf', tamanhoBytes: 1, modificadoEm: data, sha256: 'x', arquivoId: 'a1', historicoId: null, removidoNaOrigemEm: null, arquivo: { clienteId: 'c-sms' } },
    { id: 'e2', caminho: 'SMS/TC 1/b.pdf', tamanhoBytes: 1, modificadoEm: data, sha256: 'y', arquivoId: 'a2', historicoId: null, removidoNaOrigemEm: null, arquivo: { clienteId: 'c-sms' } },
    { id: 'e3', caminho: 'SMS/TC 1/c.pdf', tamanhoBytes: pdfB.length, modificadoEm: data, sha256: sha256Hex(pdfB), arquivoId: 'a3', historicoId: null, removidoNaOrigemEm: null, arquivo: { clienteId: 'c-sms' } },
  ]
  const prisma = prismaFake(estados, [
    { id: 'a1', sha256: 'x', origem: 'sharepoint' },
    { id: 'a2', sha256: 'y', origem: 'migrado' },
  ])
  const usos = async () =>
    new Map<string, UsoArquivo[]>([
      ['a1', [{ tipo: 'historico-contrato', rotulo: 'TC/TA', href: '/', contrato: null, competencia: null, daSincronizacao: true }]],
      ['a2', [{ tipo: 'analise-documento', rotulo: 'Análise', href: '/', contrato: null, competencia: null }]],
    ])
  const r = await sincronizarSharepoint(prisma as unknown as PrismaClient, {
    aplicar: true,
    fonte: fonte({ 'SMS/TC 1/c.pdf': pdfB, 'SMS/TC 1/d.pdf': pdfA }),
    gravarBlob: async () => 'u',
    buscarUsos: usos,
    importar: importarVazio,
  })
  expect(prisma.historicoContrato.updateMany).toHaveBeenCalledWith({
    where: { termoArquivoId: { in: ['a1', 'a2'] }, termoDoSharepoint: true },
    data: { termoArquivoId: null, termoDoSharepoint: false },
  })
  expect(r.removidos).toBe(1)
  expect(r.mantidosEmUso).toEqual([{ arquivoId: 'a2', motivo: 'Análise' }])
  expect(prisma.arquivoCliente.update).toHaveBeenCalledWith({ where: { id: 'a1' }, data: { removidoEm: expect.any(Date) } })
})

it('--clientes restringe listagem E remoção ao cliente escolhido', async () => {
  const estados = [
    { id: 'e1', caminho: 'SGM/TC 9/a.pdf', tamanhoBytes: 1, modificadoEm: data, sha256: 'x', arquivoId: 'a1', historicoId: null, removidoNaOrigemEm: null, arquivo: { clienteId: 'c-sgm' } },
  ]
  const prisma = prismaFake(estados)
  const r = await sincronizarSharepoint(prisma as unknown as PrismaClient, {
    aplicar: true,
    clientes: ['SMS'],
    gravarBlob: async () => 'u',
    fonte: fonte({ 'SMS/TC 1/1) Inicial/a.pdf': pdfA, 'SGM/TC 2/b.pdf': pdfB }),
    ...base,
  })
  expect(r.novos).toBe(1)
  expect(r.sumiramDaOrigem).toBe(0)
  expect(prisma.arquivoSharepoint.update).not.toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'e1' } }))
})

it('suspende remoção quando a pasta volta quase vazia', async () => {
  const estados = Array.from({ length: 10 }, (_, i) => ({
    id: `e${i}`, caminho: `SMS/TC 1/${i}.pdf`, tamanhoBytes: 1, modificadoEm: data, sha256: `h${i}`, arquivoId: `a${i}`, historicoId: null, removidoNaOrigemEm: null, arquivo: { clienteId: 'c-sms' },
  }))
  const prisma = prismaFake(estados)
  const r = await sincronizarSharepoint(prisma as unknown as PrismaClient, { aplicar: true, fonte: fonte({}), ...base })
  expect(r.remocaoSuspensa).not.toBeNull()
  expect(r.sumiramDaOrigem).toBe(0)
})

it('sem --aplicar não grava nada', async () => {
  const prisma = prismaFake()
  const r = await sincronizarSharepoint(prisma as unknown as PrismaClient, {
    aplicar: false,
    fonte: fonte({ 'SMS/TC 1/a.pdf': pdfA, 'SMS/TC 2/a-copia.pdf': pdfA, 'SPTURIS/TC 9/b.pdf': pdfB }),
    ...base,
  })
  expect(r).toMatchObject({ novos: 2, reaproveitados: 1, conferencia: null })
  expect(r.clientes.criados).toEqual(['SPTURIS — SPTURIS'])
  expect(prisma.cliente.create).not.toHaveBeenCalled()
  expect(prisma.arquivoCliente.create).not.toHaveBeenCalled()
  expect(prisma.arquivoSharepoint.upsert).not.toHaveBeenCalled()
})
```

Run: `npx jest src/lib/arquivos/sharepoint/sincronizar.test.ts` → FAIL.

- [ ] **Step 4: Reescrever `sincronizar.ts`**

Substitua o arquivo inteiro por:
```ts
import type { PrismaClient } from '@prisma/client'
import { garantirClientes } from '@/lib/importacao-sharepoint/clientes'
import { montarEstrutura, type ContratoPasta, type TermoPasta, type TipoTermo } from '@/lib/importacao-sharepoint/estrutura'
import { importarContratos, type ContratoLido, type TermoLido } from '@/lib/importacao-sharepoint/importar'
import type { CamposTermo } from '@/lib/importacao-sharepoint/texto'
import { registrarConteudo } from '../registrar-conteudo'
import { sha256Hex, usosDosArquivos, type UsoArquivo } from '../servico'
import { conferir, type LinhaConferencia } from './conferencia'
import {
  categoriaSharepoint,
  clienteDoArquivo,
  motivoIgnorar,
  mudouPorMetadado,
  normalizarChave,
  siglaDaPasta,
  type MapaPastas,
  type PapelArquivo,
} from './regras'

// Sincronização da biblioteca ContratosReceita → VerAI, numa passada só (spec
// docs/superpowers/specs/2026-09-23-sharepoint-lugar-certo-design.md §3.5):
//   1. listagem  2. clientes  3. estrutura (só nomes)  4. arquivos → repositório e estado
//   5. termos que mudaram  6. contratos e linhas (importar.ts)  7. onde cada arquivo caiu
//   8. ausentes (colunas do SharePoint soltas, remoção lógica)  9. conferência.
// A FONTE é injetada: hoje a pasta sincronizada pelo OneDrive (scripts/sincronizar-sharepoint.ts),
// amanhã o Microsoft Graph — o resto não muda.

export interface ArquivoFonte {
  /** Relativo à raiz da biblioteca, separado por "/". */
  caminho: string
  tamanhoBytes: number
  modificadoEm: Date
}

export interface FonteArquivos {
  listar(): Promise<ArquivoFonte[]>
  ler(caminho: string): Promise<Buffer>
}

export interface OpcoesSincronizacao {
  aplicar: boolean
  fonte: FonteArquivos
  mapa?: MapaPastas
  nomes?: Record<string, string>
  /** Pastas que não são cliente: cada arquivo vai para a sigla do próprio nome (publicações do DOC). */
  rotearPeloNome?: string[]
  /** Só estes clientes (siglas): listagem E remoção restritas a eles. Para testar sem a biblioteca inteira. */
  clientes?: string[]
  /** Processa todos os contratos (em vez de só os que mudaram). */
  relerTudo?: boolean
  /** Lê os campos do PDF do termo; sem ela os contratos entram só com a estrutura. */
  lerCampos?: (conteudo: Buffer, tipo: TipoTermo) => Promise<CamposTermo>
  gravarBlob?: (caminho: string, conteudo: Buffer, contentType: string) => Promise<string>
  buscarUsos?: (ids: string[]) => Promise<Map<string, UsoArquivo[]>>
  importar?: typeof importarContratos
  agora?: Date
}

export interface ResultadoSincronizacao {
  listados: number
  novos: number
  reaproveitados: number
  conteudoTrocado: number
  inalterados: number
  ignorados: Record<string, number>
  semCliente: Record<string, number>
  sumiramDaOrigem: number
  anexosSoltos: number
  removidos: number
  mantidosEmUso: Array<{ arquivoId: string; motivo: string }>
  falhas: Array<{ caminho: string; motivo: string }>
  remocaoSuspensa: string | null
  clientes: { criados: string[]; renomeados: string[]; semNomeOficial: string[] }
  contratos: {
    processados: number
    contratosCriados: number
    contratosCompletados: number
    linhasCriadas: number
    linhasCompletadas: number
    anexosLigados: number
    avisos: string[]
  }
  /** `null` sem `--aplicar` (não há o que conferir no banco). */
  conferencia: LinhaConferencia[] | null
}

interface ItemListado extends ArquivoFonte {
  segmentos: string[]
  clienteId: string
  rotuloCliente: string
  publicacao: boolean
}

/** Abaixo disso a listagem é tratada como falha da fonte (OneDrive pausado, pasta desmontada) e nada
 *  sai — melhor não apagar do que apagar tudo por engano. */
const FRACAO_MINIMA_LISTADA = 0.5

const pastaDe = (caminho: string) => caminho.slice(0, caminho.lastIndexOf('/'))

/** A sincronização nova só roda depois de scripts/migrar-sharepoint-lugar-certo.ts (spec §6). */
export async function pendenciasDeMigracao(prisma: PrismaClient): Promise<string[]> {
  const pendencias: string[] = []
  const anexos = await prisma.historicoContrato.count({
    where: { OR: [{ propostaPdfUrl: { not: null }, propostaArquivoId: null }, { termoPdfUrl: { not: null }, termoArquivoId: null }] },
  })
  if (anexos > 0) pendencias.push(`${anexos} linha(s) do histórico com PDF copiado ainda sem referência ao repositório`)
  const contratos = await prisma.contrato.findMany({
    where: { chaveSharepoint: { not: null } },
    select: { chaveSharepoint: true, cliente: { select: { siglaLegado: true } } },
  })
  const antigos = contratos.filter((c) => c.chaveSharepoint!.split('|')[0] !== normalizarChave(c.cliente.siglaLegado ?? ''))
  if (antigos.length > 0) pendencias.push(`${antigos.length} contrato(s) com a chave antiga (pasta em vez de sigla)`)
  return pendencias
}

export async function sincronizarSharepoint(prisma: PrismaClient, opcoes: OpcoesSincronizacao): Promise<ResultadoSincronizacao> {
  const { aplicar, fonte, mapa = {}, nomes = {}, rotearPeloNome = [], relerTudo = false } = opcoes
  const buscarUsos = opcoes.buscarUsos ?? usosDosArquivos
  const importar = opcoes.importar ?? importarContratos
  const agora = opcoes.agora ?? new Date()

  const pendencias = await pendenciasDeMigracao(prisma)
  if (pendencias.length > 0) {
    throw new Error(`rode scripts/migrar-sharepoint-lugar-certo.ts --aplicar antes: ${pendencias.join('; ')}`)
  }

  const r: ResultadoSincronizacao = {
    listados: 0,
    novos: 0,
    reaproveitados: 0,
    conteudoTrocado: 0,
    inalterados: 0,
    ignorados: {},
    semCliente: {},
    sumiramDaOrigem: 0,
    anexosSoltos: 0,
    removidos: 0,
    mantidosEmUso: [],
    falhas: [],
    remocaoSuspensa: null,
    clientes: { criados: [], renomeados: [], semNomeOficial: [] },
    contratos: { processados: 0, contratosCriados: 0, contratosCompletados: 0, linhasCriadas: 0, linhasCompletadas: 0, anexosLigados: 0, avisos: [] },
    conferencia: null,
  }
  const contar = (grupo: Record<string, number>, chave: string) => (grupo[chave] = (grupo[chave] ?? 0) + 1)

  // 1) Listagem; fora só o que não é documento.
  const arquivos = (await fonte.listar()).map((a) => ({ ...a, caminho: a.caminho.normalize('NFC') }))
  arquivos.sort((a, b) => a.caminho.localeCompare(b.caminho))
  r.listados = arquivos.length
  const listados = new Set(arquivos.map((a) => a.caminho))
  const validos = arquivos.filter((a) => {
    const motivo = motivoIgnorar(a.caminho.split('/'), a.tamanhoBytes)
    if (motivo) contar(r.ignorados, motivo)
    return !motivo
  })

  // 2) Clientes: cria os das pastas de cliente que faltam; depois resolve o cliente de cada arquivo.
  const filtro = opcoes.clientes ? new Set(opcoes.clientes.map(normalizarChave)) : null
  const roteada = (pasta: string) => rotearPeloNome.some((p) => normalizarChave(p) === normalizarChave(pasta))
  const pastasCliente = [...new Set(validos.map((a) => a.caminho.split('/')[0]))].filter(
    (p) => !roteada(p) && (!filtro || filtro.has(siglaDaPasta(p, mapa) ?? ''))
  )
  const rc = await garantirClientes(prisma, { aplicar, pastas: pastasCliente, mapa, nomes })
  r.clientes = { criados: rc.criados, renomeados: rc.renomeados, semNomeOficial: rc.semNomeOficial }
  const idsFiltro = filtro ? new Set([...filtro].map((s) => rc.clientes.get(s)?.id).filter((id): id is string => !!id)) : null

  const itens: ItemListado[] = []
  for (const a of validos) {
    const segmentos = a.caminho.split('/')
    const { resolucao, roteadoPeloNome, rotulo } = clienteDoArquivo(segmentos, rc.clientes, mapa, rotearPeloNome)
    if (resolucao.tipo === 'ignorar') {
      contar(r.ignorados, 'pasta ignorada no mapa')
      continue
    }
    if (resolucao.tipo === 'sem-cliente') {
      if (!filtro) contar(r.semCliente, rotulo)
      continue
    }
    if (idsFiltro && !idsFiltro.has(resolucao.clienteId)) continue
    itens.push({ ...a, segmentos, clienteId: resolucao.clienteId, rotuloCliente: resolucao.nome, publicacao: roteadoPeloNome })
  }

  // 3) Estrutura (só nomes): papel de cada arquivo e a que termo ele pertence.
  const estrutura = montarEstrutura(
    itens.filter((i) => !i.publicacao).map((i) => i.caminho),
    (pasta) => siglaDaPasta(pasta, mapa) ?? normalizarChave(pasta)
  )
  const lugarDe = new Map<string, { contrato: ContratoPasta; termo: TermoPasta }>()
  for (const contrato of estrutura) for (const termo of contrato.termos) for (const c of termo.arquivos) lugarDe.set(c, { contrato, termo })

  // 4) Arquivos → repositório e estado.
  const estados = new Map(
    (await prisma.arquivoSharepoint.findMany({ include: { arquivo: { select: { clienteId: true } } } })).map((e) => [e.caminho, e])
  )
  const noEscopo = (e: { arquivo: { clienteId: string } | null }) => !idsFiltro || (e.arquivo !== null && e.arquivo !== undefined && idsFiltro.has(e.arquivo.clienteId))
  const ativo = new Map<string, { arquivoId: string | null; ativo: boolean }>(
    [...estados.values()].map((e) => [e.caminho, { arquivoId: e.arquivoId, ativo: e.removidoNaOrigemEm === null }])
  )
  const arquivoIdPorCaminho = new Map<string, string>()
  const hashPorCaminho = new Map<string, string>()
  const mudaram = new Set<string>()
  const candidatosRemocao = new Set<string>()
  const simulados = new Map<string, string>()

  for (const item of itens) {
    const estado = estados.get(item.caminho)
    const estadoAtivo = estado !== undefined && estado.removidoNaOrigemEm === null && estado.arquivoId !== null
    if (estadoAtivo && !mudouPorMetadado(estado, item)) {
      r.inalterados++
      arquivoIdPorCaminho.set(item.caminho, estado.arquivoId!)
      hashPorCaminho.set(item.caminho, estado.sha256)
      continue
    }
    try {
      const conteudo = await fonte.ler(item.caminho)
      const sha256 = sha256Hex(conteudo)
      hashPorCaminho.set(item.caminho, sha256)

      if (estadoAtivo && estado.sha256 === sha256) {
        // Só a data mudou (OneDrive regravou, alguém abriu e salvou igual).
        r.inalterados++
        arquivoIdPorCaminho.set(item.caminho, estado.arquivoId!)
        if (aplicar) {
          await prisma.arquivoSharepoint.update({ where: { id: estado.id }, data: { tamanhoBytes: conteudo.length, modificadoEm: item.modificadoEm, vistoEm: agora } })
        }
        continue
      }

      const nome = item.segmentos[item.segmentos.length - 1]
      const lugar = lugarDe.get(item.caminho)
      const papel: PapelArquivo = !lugar ? 'outro' : lugar.termo.termoPdf === item.caminho ? 'termo' : lugar.termo.propostaPdf === item.caminho ? 'proposta' : 'outro'
      const categoria = categoriaSharepoint(nome, { papel, inicial: lugar?.termo.tipo === 'CONTRATO', publicacao: item.publicacao })

      let arquivoId: string
      if (aplicar) {
        const registrado = await registrarConteudo(
          prisma,
          { clienteId: item.clienteId, nome, conteudo, sha256, categoria, origem: 'sharepoint', enviadoPorId: null },
          { gravarBlob: opcoes.gravarBlob }
        )
        if (registrado.novo) r.novos++
        else r.reaproveitados++
        arquivoId = registrado.id
      } else {
        arquivoId = await simularRegistro(prisma, item.clienteId, sha256, simulados, (novo) => (novo ? r.novos++ : r.reaproveitados++))
      }

      mudaram.add(item.caminho)
      arquivoIdPorCaminho.set(item.caminho, arquivoId)
      if (estadoAtivo) {
        r.conteudoTrocado++
        if (estado.arquivoId !== arquivoId) candidatosRemocao.add(estado.arquivoId!)
      }
      ativo.set(item.caminho, { arquivoId, ativo: true })

      if (aplicar) {
        const dados = { tamanhoBytes: conteudo.length, modificadoEm: item.modificadoEm, sha256, arquivoId, vistoEm: agora, removidoNaOrigemEm: null }
        await prisma.arquivoSharepoint.upsert({ where: { caminho: item.caminho }, create: { caminho: item.caminho, ...dados }, update: dados })
      }
    } catch (erro) {
      // Falha não é "sumiu": o estado fica como está e a próxima execução tenta de novo.
      r.falhas.push({ caminho: item.caminho, motivo: erro instanceof Error ? erro.message : String(erro) })
    }
  }

  // 5) Termos que mudaram: arquivo novo/trocado/movido, arquivo que sumiu da mesma pasta, ou arquivo
  //    que ainda não caiu em linha nenhuma.
  const ausentes = [...estados.values()].filter((e) => e.removidoNaOrigemEm === null && !listados.has(e.caminho) && noEscopo(e))
  const pastasComAusente = new Set(ausentes.map((e) => pastaDe(e.caminho)))
  const jaNoLugar = new Set([...estados.values()].filter((e) => e.historicoId !== null && e.removidoNaOrigemEm === null).map((e) => e.caminho))
  const processar = estrutura.filter(
    (c) => relerTudo || c.termos.some((t) => t.arquivos.some((a) => mudaram.has(a) || !jaNoLugar.has(a) || pastasComAusente.has(pastaDe(a))))
  )

  // 6) Contratos e linhas (campos lidos do PDF do termo de cada termo dos contratos processados).
  const contratosLidos: ContratoLido[] = []
  for (const contrato of processar) {
    const termos: TermoLido[] = []
    for (const termo of contrato.termos) {
      let campos: CamposTermo | null = null
      if (termo.termoPdf && opcoes.lerCampos && arquivoIdPorCaminho.has(termo.termoPdf)) {
        try {
          campos = await opcoes.lerCampos(await fonte.ler(termo.termoPdf), termo.tipo)
        } catch (erro) {
          r.contratos.avisos.push(`não li ${termo.termoPdf}: ${erro instanceof Error ? erro.message : String(erro)}`)
        }
      }
      termos.push({ ...termo, campos, hashes: termo.arquivos.map((a) => hashPorCaminho.get(a)).filter((h): h is string => !!h) })
    }
    contratosLidos.push({ ...contrato, termos })
  }
  const ri = await importar(prisma, { aplicar, contratos: contratosLidos, clientes: rc.clientes, arquivoIdPorCaminho })
  r.contratos = {
    processados: contratosLidos.length,
    contratosCriados: ri.contratosCriados,
    contratosCompletados: ri.contratosCompletados,
    linhasCriadas: ri.linhasCriadas,
    linhasCompletadas: ri.linhasCompletadas,
    anexosLigados: ri.anexosLigados,
    avisos: [...r.contratos.avisos, ...ri.avisos],
  }

  // 7) Onde cada arquivo caiu — só dos contratos processados (os outros não mudaram).
  if (aplicar) {
    for (const contrato of processar) {
      for (const termo of contrato.termos) {
        for (const caminho of termo.arquivos) {
          if (!arquivoIdPorCaminho.has(caminho)) continue // falhou: não tem estado novo
          await prisma.arquivoSharepoint.update({
            where: { caminho },
            data: { contratoId: ri.contratoPorCaminho.get(caminho) ?? null, historicoId: ri.linhaPorCaminho.get(caminho) ?? null },
          })
        }
      }
    }
  }

  // 8) Ausentes — com a trava contra listagem vazia.
  const ativosNoEscopo = [...estados.values()].filter((e) => e.removidoNaOrigemEm === null && noEscopo(e)).length
  if (ativosNoEscopo > 0 && itens.length < ativosNoEscopo * FRACAO_MINIMA_LISTADA) {
    r.remocaoSuspensa = `a pasta listou ${itens.length} arquivos e o estado tem ${ativosNoEscopo} ativos — remoção suspensa (OneDrive pausado ou pasta fora do ar?)`
  } else {
    for (const estado of ausentes) {
      r.sumiramDaOrigem++
      ativo.set(estado.caminho, { arquivoId: estado.arquivoId, ativo: false })
      if (estado.arquivoId) candidatosRemocao.add(estado.arquivoId)
      if (aplicar) await prisma.arquivoSharepoint.update({ where: { id: estado.id }, data: { removidoNaOrigemEm: agora } })
    }
  }

  const referenciados = new Set([...ativo.values()].filter((m) => m.ativo && m.arquivoId).map((m) => m.arquivoId!))
  const soltos = [...candidatosRemocao].filter((id) => !referenciados.has(id))
  if (soltos.length > 0) {
    // 8a) Coluna PC/PA–TC/TA do SharePoint apontando pra arquivo que não está mais na biblioteca: esvazia.
    //     (Objetos explícitos por coluna — chave calculada não passa no tipo do Prisma.)
    const soltar = [
      { where: { propostaArquivoId: { in: soltos }, propostaDoSharepoint: true }, data: { propostaArquivoId: null, propostaDoSharepoint: false } },
      { where: { termoArquivoId: { in: soltos }, termoDoSharepoint: true }, data: { termoArquivoId: null, termoDoSharepoint: false } },
    ]
    for (const { where, data } of soltar) {
      r.anexosSoltos += aplicar ? (await prisma.historicoContrato.updateMany({ where, data })).count : await prisma.historicoContrato.count({ where })
    }
    // 8b) Remoção lógica: só o que veio do SharePoint (ou das cópias migradas) e que nada do VerAI usa.
    const candidatos = await prisma.arquivoCliente.findMany({
      where: { id: { in: soltos }, origem: { in: ['sharepoint', 'migrado'] }, removidoEm: null },
      select: { id: true },
    })
    const usos = await buscarUsos(candidatos.map((a) => a.id))
    for (const { id } of candidatos) {
      const doVerai = (usos.get(id) ?? []).filter((u) => !u.daSincronizacao)
      if (doVerai.length > 0) {
        r.mantidosEmUso.push({ arquivoId: id, motivo: doVerai.map((u) => u.rotulo).join('; ') })
        continue
      }
      r.removidos++
      if (aplicar) await prisma.arquivoCliente.update({ where: { id }, data: { removidoEm: agora } })
    }
  }

  // 9) Conferência: a pasta contra o que ficou gravado.
  if (aplicar) {
    const gravados = await prisma.arquivoSharepoint.findMany({
      where: { removidoNaOrigemEm: null, arquivo: { removidoEm: null } },
      select: { caminho: true },
    })
    r.conferencia = conferir(new Map(itens.map((i) => [i.caminho, i.rotuloCliente])), new Set(gravados.map((g) => g.caminho)))
  }
  return r
}

/** Modo listagem: prevê se seria arquivo novo ou reaproveitado, sem gravar. */
async function simularRegistro(
  prisma: PrismaClient,
  clienteId: string,
  sha256: string,
  simulados: Map<string, string>,
  contar: (novo: boolean) => void
): Promise<string> {
  const existente = await prisma.arquivoCliente.findFirst({ where: { clienteId, sha256, removidoEm: null }, select: { id: true } })
  if (existente) {
    contar(false)
    return existente.id
  }
  const chave = `${clienteId}:${sha256}`
  const simulado = simulados.get(chave)
  contar(!simulado)
  if (simulado) return simulado
  const id = `simulado:${chave}`
  simulados.set(chave, id)
  return id
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npx jest src/lib/arquivos src/lib/importacao-sharepoint`
Expected: PASS.

Run: `npx tsc --noEmit -p .` → nenhum erro novo; o de `sincronizar.test.ts` sumiu. Erros em `scripts/importar-sharepoint-contratos.ts` e `scripts/sincronizar-sharepoint.ts` são esperados (Task 12) — confira que são **só** nesses dois scripts.

- [ ] **Step 6: Commit**

```bash
git add src/lib/arquivos/sharepoint/sincronizar.ts src/lib/arquivos/sharepoint/sincronizar.test.ts src/lib/arquivos/sharepoint/conferencia.ts src/lib/arquivos/sharepoint/conferencia.test.ts
git commit -m "feat(sharepoint): sincronização numa passada — arquivos, contratos que mudaram, colunas por referência, ausentes e conferência"
```

---

### Task 10: Migração das chaves de contrato e dos duplicados + script de migração

**Files:**
- Create: `src/lib/importacao-sharepoint/migracao-chaves.ts`
- Create: `src/lib/importacao-sharepoint/migracao-chaves.test.ts`
- Create: `scripts/migrar-sharepoint-lugar-certo.ts`

**Interfaces:**
- Consumes: `normalizarChave` (Task 2), `chaveDoTermo` (Task 7), `migrarAnexosParaReferencia`/`apagarCopiasMigradas` (Task 6).
- Produces:
  - `migrarChavesDeContrato(db: PrismaClient, opcoes: { aplicar: boolean }): Promise<{ renomeados: number; fundidos: string[]; revisar: string[] }>`
  - `fundirLinhasDuplicadas(db: PrismaClient, opcoes: { aplicar: boolean }): Promise<{ fundidas: string[]; revisar: string[] }>`

- [ ] **Step 1: Teste (falhando)**

`src/lib/importacao-sharepoint/migracao-chaves.test.ts`:
```ts
import type { PrismaClient } from '@prisma/client'
import { fundirLinhasDuplicadas, migrarChavesDeContrato } from './migracao-chaves'

const contrato = (c: object) => ({
  id: 'k1', chaveSharepoint: 'SUB-ITP|1 2026', createdAt: new Date('2026-09-23T10:00:00Z'),
  numeroTermo: 'TC 001/SUB/IT/2026', descricao: null, seiCliente: null, seiProdam: null, dataInicio: null, dataVencimento: null, situacao: null,
  cliente: { siglaLegado: 'SUB-ITP' }, _count: { itens: 0, faturamentos: 0, termosConfirmacao: 0 }, ...c,
})

function db(contratos: object[], linhas: object[] = []) {
  const banco: any = {
    contrato: { findMany: jest.fn(async () => contratos), update: jest.fn(), delete: jest.fn() },
    historicoContrato: { findMany: jest.fn(async () => linhas), updateMany: jest.fn(), update: jest.fn(), delete: jest.fn() },
    arquivoSharepoint: { updateMany: jest.fn() },
    $transaction: jest.fn(async (ops: unknown[]) => ops),
  }
  return banco
}

it('chave pela sigla; duas pastas do mesmo cliente → funde no que já tem a chave nova', async () => {
  const banco = db([
    contrato({ id: 'k1', chaveSharepoint: 'SUB-ITP|1 2026' }),
    contrato({ id: 'k2', chaveSharepoint: 'SUB-ITAM PAULISTA|1 2026', descricao: 'Office 365' }),
  ])
  const r = await migrarChavesDeContrato(banco as unknown as PrismaClient, { aplicar: true })
  expect(r.fundidos).toEqual(['SUB-ITAM PAULISTA|1 2026 → SUB-ITP|1 2026'])
  expect(banco.contrato.update).toHaveBeenCalledWith({ where: { id: 'k1' }, data: { descricao: 'Office 365' } })
  expect(banco.historicoContrato.updateMany).toHaveBeenCalledWith({ where: { contratoId: 'k2' }, data: { contratoId: 'k1' } })
  expect(banco.contrato.delete).toHaveBeenCalledWith({ where: { id: 'k2' } })
})

it('só renomeia a chave quando não há colisão', async () => {
  const banco = db([contrato({ id: 'k3', chaveSharepoint: 'SGM - CASA CIVIL|8 2026', cliente: { siglaLegado: 'SGM' } })])
  const r = await migrarChavesDeContrato(banco as unknown as PrismaClient, { aplicar: true })
  expect(r.renomeados).toBe(1)
  expect(banco.contrato.update).toHaveBeenCalledWith({ where: { id: 'k3' }, data: { chaveSharepoint: 'SGM|8 2026' } })
})

it('duplicado com item, faturamento ou termo não é fundido — vai pra revisão', async () => {
  const banco = db([
    contrato({ id: 'k1' }),
    contrato({ id: 'k2', chaveSharepoint: 'SUB-ITAM PAULISTA|1 2026', _count: { itens: 2, faturamentos: 0, termosConfirmacao: 0 } }),
  ])
  const r = await migrarChavesDeContrato(banco as unknown as PrismaClient, { aplicar: true })
  expect(r.revisar).toHaveLength(1)
  expect(banco.contrato.delete).not.toHaveBeenCalled()
})

const linha = (l: object) => ({
  id: 'h1', contratoId: 'k1', tipo: 'CONTRATO', createdAt: new Date(), chaveSharepoint: 'x',
  numero: 'TC 52/SMIT/2024', data: null, valor: null, objeto: null, proposta: null, situacao: null, dataInicio: null, dataVencimento: null, dataEnvio: null, observacao: null,
  propostaArquivoId: null, termoArquivoId: 'a52', propostaDoSharepoint: false, termoDoSharepoint: true, ...l,
})

it('linhas do mesmo termo com o mesmo PDF: funde na mais completa (SMIT TC 52)', async () => {
  const banco = db([], [linha({ id: 'h1' }), linha({ id: 'h2', valor: '100.00', propostaArquivoId: 'apc' })])
  const r = await fundirLinhasDuplicadas(banco as unknown as PrismaClient, { aplicar: true })
  expect(r.fundidas).toHaveLength(1)
  expect(banco.arquivoSharepoint.updateMany).toHaveBeenCalledWith({ where: { historicoId: 'h1' }, data: { historicoId: 'h2' } })
  expect(banco.historicoContrato.delete).toHaveBeenCalledWith({ where: { id: 'h1' } })
})

it('mesmo número com PDF diferente não funde (SMDHC "TA 001" ×2)', async () => {
  const banco = db([], [linha({ id: 'h1', tipo: 'ADITIVO', numero: 'TA 001', termoArquivoId: 'a' }), linha({ id: 'h2', tipo: 'ADITIVO', numero: 'TA 001', termoArquivoId: 'b' })])
  expect((await fundirLinhasDuplicadas(banco as unknown as PrismaClient, { aplicar: true })).fundidas).toEqual([])
})
```

Run: `npx jest src/lib/importacao-sharepoint/migracao-chaves.test.ts` → FAIL.

- [ ] **Step 2: Implementar `migracao-chaves.ts`**

```ts
import type { PrismaClient } from '@prisma/client'
import { normalizarChave } from '@/lib/arquivos/sharepoint/regras'
import { chaveDoTermo } from './identidade'

// Migração da identidade do importador antigo (spec docs/superpowers/specs/2026-09-23-sharepoint-lugar-certo-design.md
// §6.1–6.2): chave do contrato passa de `<pasta do cliente>|nº ano` para `<sigla>|nº ano`, e o que a
// chave antiga duplicou (SUB-ITP em duas pastas; SMIT TC 52 em dois lugares) é fundido — só quando é
// seguro. O resto vai para revisão manual. Roda depois da migração das cópias (migracao-anexos.ts):
// a fusão de linhas compara os PDFs por referência.

const CAMPOS_CONTRATO = ['numeroTermo', 'descricao', 'seiCliente', 'seiProdam', 'dataInicio', 'dataVencimento', 'situacao'] as const
const CAMPOS_LINHA = [
  'numero', 'data', 'valor', 'objeto', 'proposta', 'situacao', 'dataInicio', 'dataVencimento', 'dataEnvio', 'observacao',
  'propostaArquivoId', 'termoArquivoId',
] as const

const vazio = (v: unknown) => v === null || v === undefined || v === ''

function completarVazios<C extends string>(campos: readonly C[], fica: Record<string, unknown>, sai: Record<string, unknown>): Partial<Record<C, unknown>> {
  const saida: Partial<Record<C, unknown>> = {}
  for (const campo of campos) if (vazio(fica[campo]) && !vazio(sai[campo])) saida[campo] = sai[campo]
  return saida
}

export async function migrarChavesDeContrato(db: PrismaClient, opcoes: { aplicar: boolean }) {
  const r = { renomeados: 0, fundidos: [] as string[], revisar: [] as string[] }
  const contratos = await db.contrato.findMany({
    where: { chaveSharepoint: { not: null } },
    select: {
      id: true, chaveSharepoint: true, createdAt: true,
      numeroTermo: true, descricao: true, seiCliente: true, seiProdam: true, dataInicio: true, dataVencimento: true, situacao: true,
      cliente: { select: { siglaLegado: true } },
      _count: { select: { itens: true, faturamentos: true, termosConfirmacao: true } },
    },
    orderBy: { createdAt: 'asc' },
  })

  const porChave = new Map<string, typeof contratos>()
  for (const c of contratos) {
    const nova = `${normalizarChave(c.cliente.siglaLegado ?? '')}|${c.chaveSharepoint!.split('|').slice(1).join('|')}`
    porChave.set(nova, [...(porChave.get(nova) ?? []), c])
  }

  for (const [nova, grupo] of porChave) {
    const fica = grupo.find((c) => c.chaveSharepoint === nova) ?? grupo[0]
    for (const sai of grupo) {
      if (sai === fica) continue
      const soDaImportacao = sai._count.itens === 0 && sai._count.faturamentos === 0 && sai._count.termosConfirmacao === 0
      if (!soDaImportacao) {
        r.revisar.push(`${sai.chaveSharepoint} e ${fica.chaveSharepoint} são o mesmo contrato, mas ${sai.chaveSharepoint} tem itens, faturamentos ou termos — junte à mão`)
        continue
      }
      r.fundidos.push(`${sai.chaveSharepoint} → ${nova}`)
      if (!opcoes.aplicar) continue
      try {
        const completar = completarVazios(CAMPOS_CONTRATO, fica, sai)
        await db.$transaction([
          ...(Object.keys(completar).length > 0 ? [db.contrato.update({ where: { id: fica.id }, data: completar })] : []),
          db.historicoContrato.updateMany({ where: { contratoId: sai.id }, data: { contratoId: fica.id } }),
          db.arquivoSharepoint.updateMany({ where: { contratoId: sai.id }, data: { contratoId: fica.id } }),
          db.contrato.delete({ where: { id: sai.id } }),
        ])
      } catch (erro) {
        r.revisar.push(`${sai.chaveSharepoint}: não consegui fundir (${erro instanceof Error ? erro.message : String(erro)})`)
      }
    }
    if (fica.chaveSharepoint !== nova) {
      r.renomeados++
      if (opcoes.aplicar) await db.contrato.update({ where: { id: fica.id }, data: { chaveSharepoint: nova } })
    }
  }
  return r
}

export async function fundirLinhasDuplicadas(db: PrismaClient, opcoes: { aplicar: boolean }) {
  const r = { fundidas: [] as string[], revisar: [] as string[] }
  const linhas = await db.historicoContrato.findMany({
    where: { chaveSharepoint: { not: null } },
    select: {
      id: true, contratoId: true, tipo: true, createdAt: true, chaveSharepoint: true,
      numero: true, data: true, valor: true, objeto: true, proposta: true, situacao: true, dataInicio: true, dataVencimento: true, dataEnvio: true, observacao: true,
      propostaArquivoId: true, termoArquivoId: true, propostaDoSharepoint: true, termoDoSharepoint: true,
    },
    orderBy: { createdAt: 'asc' },
  })

  const grupos = new Map<string, typeof linhas>()
  for (const l of linhas) {
    const chave = chaveDoTermo(l.tipo, l.numero)
    if (!chave) continue
    const k = `${l.contratoId}|${chave}`
    grupos.set(k, [...(grupos.get(k) ?? []), l])
  }

  const preenchidos = (l: Record<string, unknown>) => CAMPOS_LINHA.filter((c) => !vazio(l[c])).length
  for (const grupo of grupos.values()) {
    if (grupo.length < 2) continue
    const [fica, ...resto] = [...grupo].sort((a, b) => preenchidos(b) - preenchidos(a))
    for (const sai of resto) {
      const mesmoPdf =
        (sai.termoArquivoId !== null && sai.termoArquivoId === fica.termoArquivoId) ||
        (sai.propostaArquivoId !== null && sai.propostaArquivoId === fica.propostaArquivoId)
      if (!mesmoPdf) continue // mesmo número e conteúdo diferente: são termos diferentes
      r.fundidas.push(`${sai.chaveSharepoint} → ${fica.chaveSharepoint}`)
      if (!opcoes.aplicar) continue
      try {
        const completar = completarVazios(CAMPOS_LINHA, fica, sai)
        await db.$transaction([
          ...(Object.keys(completar).length > 0 ? [db.historicoContrato.update({ where: { id: fica.id }, data: completar })] : []),
          db.arquivoSharepoint.updateMany({ where: { historicoId: sai.id }, data: { historicoId: fica.id } }),
          db.historicoContrato.delete({ where: { id: sai.id } }),
        ])
      } catch (erro) {
        r.revisar.push(`${sai.chaveSharepoint}: não consegui fundir (${erro instanceof Error ? erro.message : String(erro)})`)
      }
    }
  }
  return r
}
```
Run: `npx jest src/lib/importacao-sharepoint/migracao-chaves.test.ts` → PASS.

- [ ] **Step 3: Script de migração**

`scripts/migrar-sharepoint-lugar-certo.ts`:
```ts
/**
 * Prepara o banco para a sincronização "tudo no lugar certo" (spec
 * docs/superpowers/specs/2026-09-23-sharepoint-lugar-certo-design.md §6). Idempotente.
 *
 *   npx dotenv -e .env.development -- npx tsx scripts/migrar-sharepoint-lugar-certo.ts            # só lista
 *   npx dotenv -e .env.development -- npx tsx scripts/migrar-sharepoint-lugar-certo.ts --aplicar  # grava
 *   ... --apagar-copias [--aplicar]   # DEPOIS do deploy do código novo: apaga os blobs das cópias antigas
 *
 * Ordem: 1) cópias de PDF do histórico → referência ao repositório; 2) chave dos contratos pela sigla
 * (funde o que a chave antiga duplicou); 3) linhas duplicadas com o mesmo PDF.
 */
import { PrismaClient } from '@prisma/client'
import { config } from 'dotenv'
import { apagarCopiasMigradas, migrarAnexosParaReferencia } from '../src/lib/importacao-sharepoint/migracao-anexos'
import { fundirLinhasDuplicadas, migrarChavesDeContrato } from '../src/lib/importacao-sharepoint/migracao-chaves'

// .env.local completa o que faltar (ex.: BLOB_READ_WRITE_TOKEN) sem sobrescrever o que o dotenv -e já trouxe.
config({ path: '.env.local' })

const prisma = new PrismaClient()

async function main() {
  const aplicar = process.argv.includes('--aplicar')
  const modo = aplicar ? 'APLICADO' : 'SÓ LISTAGEM (use --aplicar para gravar)'

  if (process.argv.includes('--apagar-copias')) {
    const r = await apagarCopiasMigradas(prisma, { aplicar })
    console.log(`${modo} · cópias antigas de PDF do histórico ${aplicar ? 'apagadas' : 'a apagar'}: ${r.apagadas}`)
    return
  }

  const anexos = await migrarAnexosParaReferencia(prisma, { aplicar })
  console.log(`${modo}`)
  console.log(`1) anexos → referência: ${anexos.referenciados} (novos no repositório ${anexos.novosNoRepositorio}, já existiam ${anexos.reaproveitados}), falhas ${anexos.falhas.length}`)
  for (const f of anexos.falhas) console.log(`   falha linha ${f.linhaId} (${f.coluna}): ${f.motivo}`)

  const chaves = await migrarChavesDeContrato(prisma, { aplicar })
  console.log(`2) contratos: chave renomeada ${chaves.renomeados}, fundidos ${chaves.fundidos.length}, para revisar ${chaves.revisar.length}`)
  for (const f of chaves.fundidos) console.log(`   fundido ${f}`)
  for (const f of chaves.revisar) console.log(`   REVISAR ${f}`)

  const linhas = await fundirLinhasDuplicadas(prisma, { aplicar })
  console.log(`3) linhas duplicadas fundidas: ${linhas.fundidas.length}, para revisar ${linhas.revisar.length}`)
  for (const f of linhas.fundidas) console.log(`   fundida ${f}`)
  for (const f of linhas.revisar) console.log(`   REVISAR ${f}`)
  if (!aplicar) console.log('(na listagem a etapa 3 não enxerga os PDFs da etapa 1 — o número real aparece com --aplicar)')
}

main()
  .catch((erro) => {
    console.error(erro instanceof Error ? erro.message : erro)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/importacao-sharepoint/migracao-chaves.ts src/lib/importacao-sharepoint/migracao-chaves.test.ts scripts/migrar-sharepoint-lugar-certo.ts
git commit -m "feat(sharepoint): migração da chave de contrato pela sigla e fusão segura dos duplicados"
```

---

### Task 11: Aba Documentos — marca "fora do SharePoint"

**Files:**
- Modify: `src/app/clientes/[id]/abas/documentos/derivados.ts` (+ `derivados.test.ts`)
- Modify: `src/app/clientes/[id]/abas/documentos/lista-arquivos.tsx`

**Interfaces:**
- Produces: `foraDoSharepoint(arquivo: Pick<ArquivoRepositorio, 'origem' | 'usos'>): boolean`

- [ ] **Step 1: Teste (falhando)**

Em `src/app/clientes/[id]/abas/documentos/derivados.test.ts`, inclua `foraDoSharepoint` no import de `./derivados` e acrescente:
```ts
describe('foraDoSharepoint', () => {
  const lugar = { tipo: 'sharepoint' as const, rotulo: 'SharePoint · SMS/a.pdf', href: '/clientes/c1', contrato: null, competencia: null, daSincronizacao: true }
  it('veio do SharePoint e não está mais lá', () => {
    expect(foraDoSharepoint({ origem: 'sharepoint', usos: [] })).toBe(true)
    expect(foraDoSharepoint({ origem: 'sharepoint', usos: [lugar] })).toBe(false)
    expect(foraDoSharepoint({ origem: 'upload', usos: [] })).toBe(false)
  })
})
```
Run: `npx jest "src/app/clientes/\[id\]/abas/documentos/derivados"` → FAIL.

- [ ] **Step 2: Implementar**

Em `derivados.ts`, acrescente:
```ts
/** Arquivo que veio do SharePoint e saiu de lá, mas ficou porque algo do VerAI ainda o usa
 *  (spec lugar-certo §3.1). */
export function foraDoSharepoint(arquivo: Pick<ArquivoRepositorio, 'origem' | 'usos'>): boolean {
  return arquivo.origem === 'sharepoint' && !arquivo.usos.some((u) => u.tipo === 'sharepoint')
}
```

Em `lista-arquivos.tsx`, importe `foraDoSharepoint` de `./derivados` e troque
```tsx
                      <span className="truncate">{a.nome}</span>
```
por
```tsx
                      <span className="truncate">{a.nome}</span>
                      {foraDoSharepoint(a) && (
                        <span className="shrink-0 rounded bg-light-grey px-1.5 py-0.5 text-[0.65rem] font-medium text-mid-grey">
                          fora do SharePoint
                        </span>
                      )}
```

- [ ] **Step 3: Rodar e ver passar**

Run: `npx jest "src/app/clientes/\[id\]/abas"` → PASS.

- [ ] **Step 4: Commit**

```bash
git add "src/app/clientes/[id]/abas/documentos/derivados.ts" "src/app/clientes/[id]/abas/documentos/derivados.test.ts" "src/app/clientes/[id]/abas/documentos/lista-arquivos.tsx"
git commit -m "feat(documentos): marca arquivo que saiu do SharePoint mas segue em uso"
```

---

### Task 12: Script único, agendador, configuração e documentação

**Files:**
- Modify: `scripts/sincronizar-sharepoint.ts` (reescrito)
- Modify: `scripts/sincronizar-sharepoint.bat`
- Modify: `scripts/sharepoint-clientes.json`
- Delete: `scripts/importar-sharepoint-contratos.ts`
- Modify: `CLAUDE.md` (seção "Sincronização com o SharePoint (ContratosReceita)")
- Modify: `docs/superpowers/specs/2026-09-24-sincronizacao-sharepoint-contratos-design.md` (nota no topo)
- Modify: `docs/superpowers/specs/2026-09-23-sharepoint-lugar-certo-design.md` (status)

- [ ] **Step 1: `scripts/sincronizar-sharepoint.ts`**

Substitua o arquivo por:
```ts
/**
 * Mantém o VerAI igual à biblioteca "ContratosReceita" do SharePoint (pasta sincronizada pelo
 * OneDrive): todos os arquivos na aba Documentos do cliente e cada pasta de termo na linha certa do
 * histórico do contrato. Spec: docs/superpowers/specs/2026-09-23-sharepoint-lugar-certo-design.md
 *
 *   npx dotenv -e .env.production.local -- npx tsx scripts/sincronizar-sharepoint.ts            # só lista
 *   npx dotenv -e .env.production.local -- npx tsx scripts/sincronizar-sharepoint.ts --aplicar  # grava
 *
 * Opções: --pasta="C:\...\rede.sp - ContratosReceita" (padrão: ~/rede.sp/rede.sp - ContratosReceita ou
 * SHAREPOINT_PASTA), --clientes=SMS,SGM (só esses — listagem e remoção), --reler-tudo (reprocessa todos
 * os contratos). Configuração: scripts/sharepoint-clientes.json. Antes da primeira vez:
 * scripts/migrar-sharepoint-lugar-certo.ts. Idempotente; o agendador roda scripts/sincronizar-sharepoint.bat.
 */
import { existsSync, mkdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { readdir, readFile, stat } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import path from 'node:path'
import { PrismaClient } from '@prisma/client'
import { config } from 'dotenv'
import { sincronizarSharepoint, type ArquivoFonte, type FonteArquivos } from '../src/lib/arquivos/sharepoint/sincronizar'
import { textoDoPdf } from '../src/lib/importacao-sharepoint/pdf-texto'
import { extrairCampos } from '../src/lib/importacao-sharepoint/texto'

// .env.local completa o que faltar (ex.: BLOB_READ_WRITE_TOKEN) sem sobrescrever o que o dotenv -e já trouxe.
config({ path: '.env.local' })

const prisma = new PrismaClient()

function argumento(nome: string): string | undefined {
  const achado = process.argv.find((a) => a.startsWith(`--${nome}=`))
  return achado?.slice(nome.length + 3).replace(/^"|"$/g, '')
}

function fonteDaPasta(raiz: string): FonteArquivos {
  return {
    async listar() {
      const saida: ArquivoFonte[] = []
      async function andar(relativo: string[]) {
        const entradas = await readdir(path.join(raiz, ...relativo), { withFileTypes: true })
        for (const e of entradas) {
          const proximo = [...relativo, e.name]
          if (e.isDirectory()) {
            await andar(proximo)
          } else if (e.isFile()) {
            // stat não baixa o conteúdo (Arquivos On-Demand) — só a leitura baixa.
            const s = await stat(path.join(raiz, ...proximo))
            saida.push({ caminho: proximo.join('/'), tamanhoBytes: s.size, modificadoEm: s.mtime })
          }
        }
      }
      await andar([])
      return saida
    },
    ler(caminho) {
      return readFile(path.join(raiz, ...caminho.split('/')))
    },
  }
}

/** Duas execuções ao mesmo tempo (agendador + manual) gravariam o mesmo arquivo duas vezes. */
function travar(): () => void {
  const trava = path.join(tmpdir(), 'verai-sincronizar-sharepoint.lock')
  if (existsSync(trava) && Date.now() - statSync(trava).mtimeMs < 2 * 60 * 60 * 1000) {
    throw new Error(`outra execução em andamento (${trava}); apague o arquivo se tiver certeza que não há`)
  }
  writeFileSync(trava, String(process.pid))
  return () => {
    try {
      unlinkSync(trava)
    } catch {}
  }
}

async function main() {
  const aplicar = process.argv.includes('--aplicar')
  const relerTudo = process.argv.includes('--reler-tudo')
  const clientes = argumento('clientes')?.split(',').map((s) => s.trim()).filter(Boolean)
  const raiz = argumento('pasta') ?? process.env.SHAREPOINT_PASTA ?? path.join(homedir(), 'rede.sp', 'rede.sp - ContratosReceita')
  if (!existsSync(raiz)) throw new Error(`pasta não encontrada: ${raiz}`)

  const arquivoConfig = path.join(__dirname, 'sharepoint-clientes.json')
  const configuracao = existsSync(arquivoConfig) ? JSON.parse(readFileSync(arquivoConfig, 'utf8')) : {}

  const destravar = travar()
  try {
    const inicio = Date.now()
    const r = await sincronizarSharepoint(prisma, {
      aplicar,
      relerTudo,
      clientes,
      fonte: fonteDaPasta(raiz),
      mapa: configuracao.pastas ?? {},
      nomes: configuracao.nomes ?? {},
      rotearPeloNome: configuracao.rotearPeloNome ?? [],
      lerCampos: async (conteudo, tipo) => extrairCampos(await textoDoPdf(conteudo), tipo),
    })
    const segundos = Math.round((Date.now() - inicio) / 1000)

    console.log(`\n${new Date().toLocaleString('pt-BR')} · ${aplicar ? 'APLICADO' : 'SÓ LISTAGEM (use --aplicar para gravar)'} · ${segundos}s`)
    console.log(`pasta: ${raiz}${clientes ? ` · só ${clientes.join(', ')}` : ''}`)
    console.log(
      `arquivos: listados ${r.listados} · novos ${r.novos} · já existiam ${r.reaproveitados} · conteúdo trocado ${r.conteudoTrocado} · ` +
        `inalterados ${r.inalterados} · sumiram ${r.sumiramDaOrigem} · removidos ${r.removidos} · falhas ${r.falhas.length}`
    )
    const c = r.contratos
    console.log(
      `contratos: processados ${c.processados} · novos ${c.contratosCriados} · completados ${c.contratosCompletados} · ` +
        `linhas novas ${c.linhasCriadas} · linhas completadas ${c.linhasCompletadas} · PDFs ligados ${c.anexosLigados} · PDFs soltos ${r.anexosSoltos}`
    )
    for (const x of r.clientes.criados) console.log(`  + cliente ${x}`)
    for (const x of r.clientes.renomeados) console.log(`  ~ cliente ${x}`)
    if (r.clientes.semNomeOficial.length) console.log(`  sem nome oficial (complete "nomes"): ${r.clientes.semNomeOficial.join(', ')}`)
    for (const [motivo, n] of Object.entries(r.ignorados)) console.log(`  ignorados (${motivo}): ${n}`)
    const semCliente = Object.entries(r.semCliente)
    if (semCliente.length > 0) {
      console.log('\nSem cliente (mapeie em scripts/sharepoint-clientes.json → "pastas"):')
      for (const [origem, n] of semCliente) console.log(`  "${origem}": ${n} arquivo(s)`)
    }
    const escaneados = c.avisos.filter((a) => a.includes('escaneado')).length
    for (const a of c.avisos.filter((x) => !x.includes('escaneado'))) console.log(`  ! ${a}`)
    if (escaneados) console.log(`  ${escaneados} PDF(s) escaneados sem texto — datas/valor ficam pra preencher na tela`)
    for (const m of r.mantidosEmUso) console.log(`  mantido (em uso no VerAI) ${m.arquivoId}: ${m.motivo}`)
    for (const f of r.falhas) console.log(`  falha ${f.caminho}: ${f.motivo}`)
    if (r.remocaoSuspensa) console.log(`\nATENÇÃO: ${r.remocaoSuspensa}`)

    if (r.conferencia) {
      const divergentes = r.conferencia.filter((l) => l.faltando.length > 0)
      const total = r.conferencia.reduce((s, l) => s + l.noSharepoint, 0)
      console.log(`\nConferência: ${total} arquivo(s) no SharePoint · ${divergentes.length === 0 ? 'TUDO NO VERAI' : `DIVERGÊNCIA em ${divergentes.length} cliente(s)`}`)
      for (const l of divergentes) {
        console.log(`  DIVERGÊNCIA ${l.cliente}: SharePoint ${l.noSharepoint} · VerAI ${l.noVerai}`)
        for (const f of l.faltando.slice(0, 20)) console.log(`    falta ${f}`)
      }
      if (divergentes.length > 0) process.exitCode = 2
    }

    mkdirSync('logs', { recursive: true })
    writeFileSync('logs/sharepoint-sincronizacao.json', JSON.stringify({ quando: new Date(), aplicar, resultado: r }, null, 1))
  } finally {
    destravar()
  }
}

main()
  .catch((erro) => {
    console.error(erro instanceof Error ? erro.message : erro)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
```

- [ ] **Step 2: `.bat`, configuração, script antigo**

`scripts/sincronizar-sharepoint.bat` — troque as duas linhas `call npx …` e o comentário acima delas por:
```bat
REM Uma passada só: clientes, arquivos (aba Documentos), contratos/histórico que mudaram, conferência.
call npx dotenv -e %ENV_FILE% -- npx tsx scripts\sincronizar-sharepoint.ts --aplicar >> logs\sincronizar-sharepoint.log 2>&1
```

`scripts/sharepoint-clientes.json`:
- troque `_comentario` por: `"Usado por sincronizar-sharepoint.ts. 'pastas': pasta da biblioteca ContratosReceita -> siglaLegado do cliente (null = ignorar a pasta; pasta com o nome igual à sigla não precisa estar aqui). 'rotearPeloNome': pastas que não são cliente — cada arquivo vai para a sigla do próprio nome ('2026.09.17 - SIURB - ...'). 'nomes': sigla -> nome oficial, usado pra criar cliente novo e corrigir cliente cujo nome é só a sigla. Ver docs/superpowers/specs/2026-09-23-sharepoint-lugar-certo-design.md."`
- em `pastas`, apague a linha `"1. PUBLICAÇÕES NO DOC": null,`;
- acrescente depois de `pastas`: `"rotearPeloNome": ["1. PUBLICAÇÕES NO DOC"],`.

Run: `git rm scripts/importar-sharepoint-contratos.ts`

- [ ] **Step 3: Tipos e testes**

Run: `npx tsc --noEmit -p .` → só os 5 erros restantes da base (faturamentos/route.ts, page.test.tsx ×2, comum.test.ts ×2).
Run: `npx jest` → tudo passando.

- [ ] **Step 4: Documentação**

`CLAUDE.md` — substitua a seção `## Sincronização com o SharePoint (ContratosReceita)` inteira por:
```markdown
## Sincronização com o SharePoint (ContratosReceita)

A biblioteca ContratosReceita (lida pela pasta do OneDrive no PC do Lucas) é a **fonte** de duas
coisas, numa passada só de `scripts/sincronizar-sharepoint.ts` (Agendador de Tarefas,
`scripts/sincronizar-sharepoint.bat`): (1) a aba **Documentos** de cada cliente tem **todos** os
arquivos da pasta dele — `WORK/` incluída, qualquer extensão; publicação da pasta
`1. PUBLICAÇÕES NO DOC` vai pro cliente da sigla no nome (`rotearPeloNome`); (2) a aba **Contratos**
recebe cada pasta de termo na linha certa do histórico. Cliente só nasce de pasta de cliente
(`garantirClientes`, pela sigla ou `scripts/sharepoint-clientes.json`), nunca por nome.

Regras que não se negociam (spec `docs/superpowers/specs/2026-09-23-sharepoint-lugar-certo-design.md`):
- **Identidade estável** (`src/lib/importacao-sharepoint/identidade.ts`): contrato = `sigla|nº ano`;
  termo → linha por mesmo caminho → tipo+número → conteúdo. Mover pra "Contratos Finalizados",
  renomear `TA XX`→`TA 03` ou pasta repetida **nunca** duplica. Não volte a usar caminho como chave.
- **PC/PA e TC/TA por referência** (`propostaArquivoId`/`termoArquivoId`): a coluna preenchida pelo
  SharePoint (`*DoSharepoint`) acompanha o SharePoint; a anexada à mão nunca é trocada. A API devolve
  `*PdfUrl` calculado (`anexosDaLinha`), apontando pra `/api/arquivos/[id]`.
- Campo do termo só preenche o que está vazio (marcadores `TA XX`/`Em elaboração` contam como vazios).
- Sumiu do SharePoint: coluna do SharePoint esvazia e o arquivo sai (remoção lógica), a não ser que
  algo do VerAI o use (análise, anexo à mão) — aí fica marcado "fora do SharePoint".
- Cada execução termina com **conferência** por cliente (caminhos no SharePoint × no VerAI);
  divergência sai no log e o script termina com código 2.
- Nada grava sem `--aplicar`; `--clientes=` restringe listagem **e** remoção (use em dev: dev e
  produção dividem o mesmo Vercel Blob).
```

No topo de `docs/superpowers/specs/2026-09-24-sincronizacao-sharepoint-contratos-design.md`, logo abaixo do título, acrescente:
```markdown
> **Revisto em 23/09/2026** por `docs/superpowers/specs/2026-09-23-sharepoint-lugar-certo-design.md`
> (aba Documentos completa, identidade estável, PC/PA–TC/TA por referência, uma execução só). Onde
> conflitarem, vale o novo.
```

Em `docs/superpowers/specs/2026-09-23-sharepoint-lugar-certo-design.md`, troque o status para `implementado em dev (Tasks 1–12); produção pendente (Task 14)`.

- [ ] **Step 5: Commit**

```bash
git add scripts/sincronizar-sharepoint.ts scripts/sincronizar-sharepoint.bat scripts/sharepoint-clientes.json CLAUDE.md docs/superpowers/specs/2026-09-24-sincronizacao-sharepoint-contratos-design.md docs/superpowers/specs/2026-09-23-sharepoint-lugar-certo-design.md
git commit -m "feat(sharepoint): script único com conferência; publicações do DOC roteadas pela sigla; docs"
```
(`git rm` do Step 2 já deixou a remoção do script antigo no índice — confira com `git status` que ela entrou neste commit.)

---

### Task 13: Execução em dev — migração, sincronização por amostra e cenários de mudança

Sem código novo; é a verificação de ponta a ponta. **Não rode a biblioteca inteira em dev** (Blob compartilhado com produção).

- [ ] **Step 1: Migração dos dados de dev**

Run: `npx dotenv -e .env.development -- npx tsx scripts/migrar-sharepoint-lugar-certo.ts`
Expected: `anexos → referência: 790` (455 TC/TA + 335 PC/PA do importador em 23/09 — o número exato pode variar), `falhas 0`; `fundidos 1` (`SUB-ITAM PAULISTA|1 2026 → SUB-ITP|1 2026`); `REVISAR` vazio.

Run: `npx dotenv -e .env.development -- npx tsx scripts/migrar-sharepoint-lugar-certo.ts --aplicar`
Expected: mesmos números; etapa 3 funde a linha duplicada do TC 52/2024 da SMIT (e a que a fusão do SUB-ITP trouxe).

Run: `npx dotenv -e .env.development -- npx tsx scripts/migrar-sharepoint-lugar-certo.ts --aplicar`
Expected (idempotência): tudo 0.

Run: `npx dotenv -e .env.development -- npx tsx scripts/migrar-sharepoint-lugar-certo.ts --apagar-copias --aplicar`
Expected: `cópias antigas … apagadas: 790` (o mesmo número da etapa 1).

- [ ] **Step 2: Sincronização por amostra (listagem, depois gravação)**

Amostra que cobre os casos difíceis: `SMSUB` (WORK), `SMIT` (finalizados, contrato aninhado), `SUB-ITP` (duas pastas), `SPURBANISMO` (nome torto), `SMDHC` (dois "TA 001"; publicação do DOC).

Run: `npx dotenv -e .env.development -- npx tsx scripts/sincronizar-sharepoint.ts --clientes=SMSUB,SMIT,SUB-ITP,SPURBANISMO,SMDHC`
Expected: `linhas novas` pequeno (só termos que o importador antigo não tinha), `contratos novos 0`, nenhum `sem cliente` dos 5, avisos só de PDF escaneado e do SMDHC "TA 001".

Run o mesmo com `--aplicar`.
Expected: termina com `Conferência: … TUDO NO VERAI` e código de saída 0.

Run o mesmo com `--aplicar` de novo.
Expected (idempotência): `novos 0 · conteúdo trocado 0 · sumiram 0`, `contratos: processados 0`, conferência sem divergência.

- [ ] **Step 3: Conferir na tela**

Run o app (skill `run`, ou `npm run dev` com `.env.development`) e, logado como admin:
- ficha da **SMSUB** → aba Documentos: arquivos do `WORK/` presentes, com contrato preenchido; filtro por contrato funciona; painel mostra "SharePoint · <caminho>".
- ficha da **SMSUB** → Contratos → TC 211/2022 → histórico: PC/PA e TC/TA abrem no visualizador (URL `/api/arquivos/...`), com o aviso "vem do SharePoint".
- **SUB-ITP**: um contrato TC 001/2026 só, uma linha "contrato inicial".
- **SMIT** TC 52/2024: uma linha "contrato inicial".

- [ ] **Step 4: Cenários de mudança numa cópia (sem tocar no SharePoint)**

Crie uma cópia só da SMSUB: `robocopy "%USERPROFILE%\rede.sp\rede.sp - ContratosReceita\SMSUB" "<scratch>\biblioteca\SMSUB" /E` (a pasta `<scratch>\biblioteca` faz o papel da raiz).

Na cópia:
1. mova `SMSUB\TC 211-SMSUB-COGEL-2022 - Acesso à Rede Corporativa` para dentro de `SMSUB\Contratos finalizados\`;
2. renomeie uma pasta de termo trocando o rótulo (ex.: `… - TA 01 - Acréscimo` → `… - TA 01 - Acréscimo de recursos`);
3. apague um PDF de dentro de um `WORK\`.

Run: `npx dotenv -e .env.development -- npx tsx scripts/sincronizar-sharepoint.ts --pasta="<scratch>\biblioteca" --clientes=SMSUB --aplicar`
Expected: `novos 0` · `já existiam` = arquivos movidos · `sumiram` = movidos + 1 · `removidos 1` · `linhas novas 0` · conferência sem divergência. Na tela, o TC 211/2022 mantém as mesmas linhas (nenhuma duplicada) e o PDF apagado sumiu da aba Documentos.

Volte ao estado real: Run o Step 2 (`--aplicar`, pasta real, mesmos clientes). Expected: conferência sem divergência, `linhas novas 0`.

- [ ] **Step 5: Registrar**

Anote os números dos Steps 1–4 no fim do spec (`## 10. Execução em dev (23/09/2026)`), marque as Tasks 1–13 como concluídas neste plano e faça commit só desses dois arquivos:
```bash
git add docs/superpowers/specs/2026-09-23-sharepoint-lugar-certo-design.md docs/superpowers/plans/2026-09-23-sharepoint-lugar-certo.md
git commit -m "docs(sharepoint): execução em dev do lugar certo — números e cenários"
```

---

### Task 14: Produção e agendador (com o usuário)

Cada passo aqui mexe em produção ou em configuração persistente do Windows: **peça confirmação explícita ao usuário antes de cada um**.

- [ ] **Step 1: Pré-condições (usuário)**
  - Limite do Vercel Blob no plano comporta +1,15 GB (a primeira carga sobe a biblioteca inteira; as cópias antigas do importador saem no Step 4).
  - Pasta `rede.sp - ContratosReceita` marcada como **"Sempre manter neste dispositivo"** (botão direito no Explorer).
  - Deploy do código de consistência de contratos e da base da sincronização (Task 0) já em produção — as migrações `20260924120000`–`160000` vão junto.

- [ ] **Step 2: Migração de schema em produção**

Run: `npx dotenv -e .env.production.local -- npx prisma migrate deploy`
Expected: aplica as pendentes, incluindo `20260924170000_sharepoint_lugar_certo`.

- [ ] **Step 3: Dados — listagem, conferência, aplicação (antes do deploy do código novo)**

Run: `npx dotenv -e .env.production.local -- npx tsx scripts/migrar-sharepoint-lugar-certo.ts` → mostre o relatório ao usuário; `REVISAR` precisa estar vazio ou explicado.
Com o ok dele: `… --aplicar`.

- [ ] **Step 4: Deploy do código novo e limpeza das cópias**

Deploy (skill `deploy`). Depois: `npx dotenv -e .env.production.local -- npx tsx scripts/migrar-sharepoint-lugar-certo.ts --apagar-copias --aplicar`.

- [ ] **Step 5: Primeira sincronização completa**

Run: `npx dotenv -e .env.production.local -- npx tsx scripts/sincronizar-sharepoint.ts` (listagem) → mostre ao usuário: `sem cliente` (esperado: só `1. PUBLICAÇÕES NO DOC → SUB-ST`), clientes a criar, total de novos.
Com o ok dele: `… --aplicar`. Expected: `Conferência: ~1.120 arquivo(s) no SharePoint · TUDO NO VERAI`.
Rode de novo com `--aplicar`: `novos 0`, `processados 0`.

- [ ] **Step 6: Agendador (configuração persistente — confirmar antes)**

Com o ok do usuário (detalhes no plano `docs/superpowers/plans/2026-09-24-sharepoint-automacao.md` — lá a
tarefa já foi instalada em 24/09, a pedido do usuário):
```bash
powershell -ExecutionPolicy Bypass -File scripts\agendador-sharepoint.ps1 -Instalar
```
Confira: `powershell -ExecutionPolicy Bypass -File scripts\agendador-sharepoint.ps1 -Estado` e, após 30 min, a última execução com `TUDO NO VERAI` e `codigo 0`.

- [ ] **Step 7: Registrar**

Status do spec → `em produção`; seção `## 11. Produção` com data e números; commit só dos docs.

---

### Task 15: Limpeza — colunas antigas (só depois da Task 14)

Só com produção migrada (Task 14 Step 4 concluído). Remove o que ficou por compatibilidade.

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<carimbo maior que o último>_remove_colunas_pdf_historico/migration.sql`
- Modify: `src/lib/arquivos/sharepoint/sincronizar.ts` (`pendenciasDeMigracao` perde a checagem de anexos)
- Modify: `src/lib/importacao-sharepoint/migracao-anexos.ts` → apagar (e o teste), e as etapas 1 e `--apagar-copias` de `scripts/migrar-sharepoint-lugar-certo.ts`

- [ ] **Step 1:** Em `HistoricoContrato`, apague `propostaPdfUrl`, `propostaPdfNome`, `termoPdfUrl`, `termoPdfNome` (e o comentário delas); em `ArquivoSharepoint`, apague `pastaContrato`. Gere a migração (`--create-only`), renomeie a pasta com carimbo maior que o último, confira que só há `ALTER TABLE … DROP COLUMN` dessas cinco colunas (e remova um eventual `DROP INDEX "ArquivoCliente_clienteId_sha256_ativo_key"`), aplique em dev.
- [ ] **Step 2:** `pendenciasDeMigracao` fica só com a checagem de chave de contrato; ajuste o teste "recusa rodar com migração pendente" para usar `contrato.findMany` devolvendo `[{ chaveSharepoint: 'PASTA X|1 2020', cliente: { siglaLegado: 'SMS' } }]`.
- [ ] **Step 3:** Apague `migracao-anexos.ts` e o teste; no script de migração, tire a etapa 1 e o `--apagar-copias`.
- [ ] **Step 4:** `npx jest` e `npx tsc --noEmit -p .` limpos (só a base). `grep -rn "PdfUrl" src --include=*.ts --include=*.tsx` deve mostrar só os campos **calculados** (`anexosDaLinha`, `secao-historico.tsx`, `resumo-historico.ts`, fixtures de teste).
- [ ] **Step 5:** Commit; aplicar a migração em produção com o usuário (`migrate deploy`) junto do próximo deploy.

---

## Parte 2 — arquivos do SharePoint vão para o Cloudflare R2 (decisão de 24/09/2026, spec §11)

Substitui, para arquivos com `origem = sharepoint`, o "sobe para o Vercel Blob" das Tasks 3 e 9.
(Uma primeira versão desta parte previa só link para o SharePoint; o usuário trocou para R2 porque o PDF
precisa abrir dentro do VerAI.) Mesmas Global Constraints; nenhuma dependência nova (o `package.json`
tem mudanças de outra sessão).

### Task 16: Cliente R2 (SigV4 com node:crypto)
- `src/lib/r2.ts`: `configR2(env)` (as 4 variáveis `R2_*`; `null` se faltar), `assinarSigV4(...)` puro,
  `putR2(chave, conteudo, contentType): Promise<string>` (devolve `r2:<chave>`), `getR2(chave): Promise<Response>`,
  `deleteR2(chave)` (404 conta como apagado).
- Teste da assinatura com o exemplo oficial da AWS (GET Object, examplebucket, 20130524) e das URLs
  (segmento com espaço/acento codificado uma vez).

### Task 17: `storage.ts` entende `r2:`
- `getUpload`/`deleteUpload` por prefixo; novo `abrirUpload(url): Promise<Response>` (streaming) usado por
  `GET /api/arquivos/[id]`; `versaoDoBlob` do índice do assistente trata `r2:` como imutável (a chave
  tem o id do arquivo). Testes.
- `.env.example` documenta as 4 variáveis.

### Task 18: Sincronização grava no R2
- `sincronizarSharepoint`: `gravarBlob` padrão = `putR2`; com `--aplicar` e sem `configR2()` → erro claro
  antes de começar. Testes.

### Task 19: Execução em dev
- Sincronização: amostra (`--clientes=SMSUB,SMIT,SUB-ITP,SPURBANISMO,SMDHC`) listagem → `--aplicar` →
  conferência "TUDO NO VERAI" → repetir (idempotência); depois a biblioteca inteira.
- Cenários numa cópia (Task 13 Step 4) e conferência na tela: PDF abrindo dentro do VerAI (aba
  Documentos e histórico do contrato).
- Registrar números no spec §10. Depois: Task 14 (produção, com o usuário — as 4 variáveis `R2_*` na Vercel).
