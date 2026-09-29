# Biblioteca "Documentos" + Tabela de preços — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O agendador do SharePoint passa a trazer também a biblioteca "Documentos" (a cada 30 min, para o R2), e a tela **Tabela de preços** — subitem de "Relatórios dos clientes" — mostra os 315 serviços da tabela oficial, pesquisáveis e conferidos com o PDF publicado.

**Architecture:** Uma etapa nova no fim de `scripts/sincronizar-sharepoint.ts` (`etapaDaBiblioteca`) lista `~/rede.sp/rede.sp - Documentos`, grava cada arquivo novo/mudado no R2 pelo `sha256` (`ArquivoBiblioteca`), faz a conferência e chama um **leitor por área**. O leitor da área `TABELA_PRECOS` lê a planilha "Memória de Cálculo" (itens), confere cada preço no PDF oficial e no informativo, e grava `TabelaPrecos`/`ItemTabelaPrecos`. A tela e a ferramenta do assistente só consultam.

**Tech Stack:** Prisma 6/Postgres, Next.js 15 (route handlers + página `'use client'`), React 19, Tailwind 4, Jest + Testing Library, `exceljs` (planilha), `unpdf` (texto do PDF), Cloudflare R2 (`src/lib/r2.ts`), lucide-react.

## Andamento

- (preencher ao executar: tarefa, commit, o que foi conferido)

## Global Constraints

- Specs: `docs/superpowers/specs/2026-09-29-biblioteca-documentos-prodam-design.md` e `docs/superpowers/specs/2026-09-29-tabela-de-precos-design.md`. Divergiu, pare e pergunte.
- **A pasta `C:\projeto\VerAI` é a que o Agendador do Windows roda contra PRODUÇÃO a cada 30 min** (`scripts/sincronizar-sharepoint.bat` com `.env.production.local`), com o cliente Prisma gerado aqui:
  - **só tabelas novas** — nenhuma coluna nova em model que já existe;
  - `scripts/sincronizar-sharepoint.ts` só é tocado na Task 4, num Edit único, com o código novo já testado em arquivos próprios;
  - a etapa nova tem guarda pela migração (`MIGRACAO_DA_BIBLIOTECA`) e nunca derruba a passada dos contratos.
- Migração escrita à mão. **Nunca** `prisma migrate diff`/`migrate dev` com o banco de dev (`localhost:5433/verai`) como shadow — ele é apagado. Conferência do SQL só com banco descartável (Task 1).
- Aplicar migração no dev: `npx dotenv -e .env.development -- npx prisma migrate deploy`, depois `npx prisma generate`. Produção (migração + deploy) só com ok do usuário, passo a passo — fora deste plano.
- Dev e produção dividem o bucket do R2: chave pelo conteúdo (`biblioteca-documentos/<sha256>.<ext>`), **nunca apagar** do R2.
- **Commit com índice próprio** — outras sessões commitam na `main` no mesmo checkout e o índice é compartilhado. Nunca `git add -A`/`commit -a`. Para cada commit, com `ARQS` = lista dos arquivos da tarefa e `MSG` = mensagem:

```bash
IDX="$TEMP/idx-biblioteca" && rm -f "$IDX" && PAI=$(git rev-parse refs/heads/main) \
 && export GIT_INDEX_FILE="$IDX" && git read-tree $PAI \
 && for f in $ARQS; do git update-index --add --cacheinfo 100644,$(git hash-object -w --path="$f" "$f"),"$f" || exit 1; done \
 && NOVO=$(git commit-tree $(git write-tree) -p $PAI -m "$MSG" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>") \
 && unset GIT_INDEX_FILE && git update-ref refs/heads/main $NOVO $PAI && git reset -q -- $ARQS && git log --oneline -1
```

- Testes: `npx jest <arquivos>`; tipos: `npx tsc --noEmit`. A base já tinha suítes falhando por `showModal` no jsdom — não são deste trabalho; compare com o `main` antes de mexer.
- Textos, comentários e nomes em português, no estilo dos arquivos vizinhos. Valor em dinheiro nunca passa por `float` na gravação: string decimal com 2 casas.
- Números esperados com os arquivos reais (29/09/2026): **315 serviços** (A 7, B 4, C 51, E 158, H 95); conferência = **308 conferem** (300 com preço + 8 "sob demanda"), **7 alterados pelo informativo** (3 TID com preço novo, 3 SPdf novos, 1 ELEIÇÃO de volta), **0 fora do PDF, 0 divergem**. Biblioteca: 904 arquivos (897 PDFs de links, 5 da tabela, 1 calendário, 1 planilha de contratos).

---

### Task 1: Banco — tabelas novas

**Files:**
- Modify: `prisma/schema.prisma` (models novos logo depois de `AtualizacaoSharepoint`)
- Create: `prisma/migrations/20260929100000_biblioteca_documentos/migration.sql`

**Interfaces:**
- Produces: `prisma.arquivoBiblioteca`, `prisma.atualizacaoBiblioteca`, `prisma.tabelaPrecos`, `prisma.itemTabelaPrecos` com os campos abaixo; nome da migração `20260929100000_biblioteca_documentos`.

- [ ] **Step 1: Models** — acrescentar em `prisma/schema.prisma`, depois do model `AtualizacaoSharepoint`:

```prisma
// Biblioteca "Documentos" do SharePoint (spec docs/superpowers/specs/2026-09-29-biblioteca-documentos-prodam-design.md):
// um registro por arquivo da pasta sincronizada pelo OneDrive (~/rede.sp/rede.sp - Documentos). Não é
// ArquivoCliente: preço e calendário são de todos; o dono de um relatório de links é o contrato lido de
// dentro dele. Só tabelas novas — o agendador roda contra produção com o cliente gerado nesta pasta.
model ArquivoBiblioteca {
  id                 String    @id @default(cuid())
  biblioteca         String
  // Relativo à raiz da biblioteca, separado por "/".
  caminho            String
  // TABELA_PRECOS | LINKS_MPLS | CALENDARIO | PLANILHA_CONTRATOS | OUTRO (src/lib/biblioteca/areas.ts)
  area               String
  nome               String
  extensao           String
  contentType        String
  tamanhoBytes       Int
  sha256             String
  // `r2:biblioteca-documentos/<sha256>.<ext>` — nunca vai ao navegador (entrega: /api/biblioteca/[id]).
  chave              String
  modificadoEm       DateTime
  vistoEm            DateTime
  removidoNaOrigemEm DateTime?
  leituraStatus      String?
  leituraMensagem    String?
  lidoEm             DateTime?
  createdAt          DateTime  @default(now())

  @@unique([biblioteca, caminho])
  @@index([biblioteca, area])
}

// "Atualizado em …" das telas da biblioteca Documentos: uma linha por passada completa (mesma regra de
// AtualizacaoSharepoint). Tabela à parte para não mexer no model que o agendador já usa em produção.
model AtualizacaoBiblioteca {
  id          String   @id @default(cuid())
  biblioteca  String
  iniciadaEm  DateTime
  concluidaEm DateTime @default(now())
  arquivos    Int

  @@index([biblioteca, iniciadaEm])
}

// Tabela de preços dos serviços da PRODAM, uma linha por versão ("2026 v3.0") — spec
// docs/superpowers/specs/2026-09-29-tabela-de-precos-design.md. Os arquivo*Id apontam para
// ArquivoBiblioteca (sem FK: o arquivo nunca é apagado, só marcado como removido na origem).
model TabelaPrecos {
  id                   String             @id @default(cuid())
  versao               String             @unique
  ano                  Int
  numero               String
  // ano*10000 + maior*100 + menor: a vigente é a de maior ordem.
  ordem                Int
  publicadaEm          DateTime?
  arquivoPlanilhaId    String?
  arquivoPdfId         String?
  arquivoPublicacaoId  String?
  arquivoInformativoId String?
  totalItens           Int
  divergencias         Int
  lidaEm               DateTime
  itens                ItemTabelaPrecos[]
}

model ItemTabelaPrecos {
  id          String       @id @default(cuid())
  tabelaId    String
  tabela      TabelaPrecos @relation(fields: [tabelaId], references: [id], onDelete: Cascade)
  // Ordem da planilha (a mesma do PDF) — a tela mostra nessa ordem.
  posicao     Int
  grupo       String
  // Caminho das seções: "C - SOLUÇÕES DE SERVIÇOS DE COMUNICAÇÃO > C7. SD-WAN > C7.1. …"
  secoes      String
  codigo      String
  descricao   String
  unidade     String
  preco       Decimal?     @db.Decimal(14, 2)
  sobDemanda  Boolean      @default(false)
  // Texto da célula quando não é número nem "SOB DEMANDA".
  precoTexto  String?
  // confere | diverge | fora-do-pdf | alterado-pelo-informativo | sem-pdf
  conferencia String
  precoNoPdf  Decimal?     @db.Decimal(14, 2)

  @@unique([tabelaId, codigo])
}
```

- [ ] **Step 2: Migração** — `prisma/migrations/20260929100000_biblioteca_documentos/migration.sql`:

```sql
-- Biblioteca "Documentos" do SharePoint + tabela de preços (specs 2026-09-29-biblioteca-documentos-prodam e
-- 2026-09-29-tabela-de-precos). Só tabelas novas: o agendador roda contra produção com o cliente gerado
-- na pasta do projeto.
CREATE TABLE "ArquivoBiblioteca" (
    "id" TEXT NOT NULL,
    "biblioteca" TEXT NOT NULL,
    "caminho" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "extensao" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "tamanhoBytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "modificadoEm" TIMESTAMP(3) NOT NULL,
    "vistoEm" TIMESTAMP(3) NOT NULL,
    "removidoNaOrigemEm" TIMESTAMP(3),
    "leituraStatus" TEXT,
    "leituraMensagem" TEXT,
    "lidoEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ArquivoBiblioteca_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ArquivoBiblioteca_biblioteca_caminho_key" ON "ArquivoBiblioteca"("biblioteca", "caminho");
CREATE INDEX "ArquivoBiblioteca_biblioteca_area_idx" ON "ArquivoBiblioteca"("biblioteca", "area");

CREATE TABLE "AtualizacaoBiblioteca" (
    "id" TEXT NOT NULL,
    "biblioteca" TEXT NOT NULL,
    "iniciadaEm" TIMESTAMP(3) NOT NULL,
    "concluidaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "arquivos" INTEGER NOT NULL,
    CONSTRAINT "AtualizacaoBiblioteca_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AtualizacaoBiblioteca_biblioteca_iniciadaEm_idx" ON "AtualizacaoBiblioteca"("biblioteca", "iniciadaEm");

CREATE TABLE "TabelaPrecos" (
    "id" TEXT NOT NULL,
    "versao" TEXT NOT NULL,
    "ano" INTEGER NOT NULL,
    "numero" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "publicadaEm" TIMESTAMP(3),
    "arquivoPlanilhaId" TEXT,
    "arquivoPdfId" TEXT,
    "arquivoPublicacaoId" TEXT,
    "arquivoInformativoId" TEXT,
    "totalItens" INTEGER NOT NULL,
    "divergencias" INTEGER NOT NULL,
    "lidaEm" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TabelaPrecos_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TabelaPrecos_versao_key" ON "TabelaPrecos"("versao");

CREATE TABLE "ItemTabelaPrecos" (
    "id" TEXT NOT NULL,
    "tabelaId" TEXT NOT NULL,
    "posicao" INTEGER NOT NULL,
    "grupo" TEXT NOT NULL,
    "secoes" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "unidade" TEXT NOT NULL,
    "preco" DECIMAL(14,2),
    "sobDemanda" BOOLEAN NOT NULL DEFAULT false,
    "precoTexto" TEXT,
    "conferencia" TEXT NOT NULL,
    "precoNoPdf" DECIMAL(14,2),
    CONSTRAINT "ItemTabelaPrecos_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ItemTabelaPrecos_tabelaId_codigo_key" ON "ItemTabelaPrecos"("tabelaId", "codigo");
ALTER TABLE "ItemTabelaPrecos" ADD CONSTRAINT "ItemTabelaPrecos_tabelaId_fkey" FOREIGN KEY ("tabelaId") REFERENCES "TabelaPrecos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

- [ ] **Step 3: Validar o schema** — `npx prisma validate` → "The schema at prisma/schema.prisma is valid".

- [ ] **Step 4: Conferir o SQL contra o schema num banco DESCARTÁVEL** (nunca o `verai`):

```bash
docker exec verai-postgres createdb -U verai_user verai_shadow_biblioteca
# <senha> = a do DATABASE_URL do .env.development
npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma \
  --shadow-database-url "postgresql://verai_user:<senha>@localhost:5433/verai_shadow_biblioteca" --script
docker exec verai-postgres dropdb -U verai_user verai_shadow_biblioteca
```

Expected: nenhuma linha sobre `ArquivoBiblioteca`, `AtualizacaoBiblioteca`, `TabelaPrecos` ou `ItemTabelaPrecos`. A única diferença aceitável é o `DROP INDEX "ArquivoCliente_clienteId_sha256_ativo_key"` (índice parcial criado à mão — CLAUDE.md). Qualquer outra linha: corrigir o SQL e repetir.

- [ ] **Step 5: Aplicar no dev e gerar o cliente**

```bash
npx dotenv -e .env.development -- npx prisma migrate deploy
npx prisma generate
```

Expected: "Applying migration `20260929100000_biblioteca_documentos`" e "Generated Prisma Client". Se o `generate` reclamar de DLL presa, pare o `next dev` que estiver rodando e repita.

- [ ] **Step 6: Commit** — `ARQS="prisma/schema.prisma prisma/migrations/20260929100000_biblioteca_documentos/migration.sql"`, `MSG="feat(biblioteca): tabelas da biblioteca Documentos e da tabela de preços"`. Se `prisma/schema.prisma` tiver mudança não commitada de outra sessão (`git diff prisma/schema.prisma` mostra mais que os models acima), monte o blob a partir do `HEAD` + só estes models (`git show HEAD:prisma/schema.prisma > $TEMP/schema.prisma`, acrescente os models, `git hash-object -w --path=prisma/schema.prisma $TEMP/schema.prisma`).

---

### Task 2: Áreas da biblioteca (regras puras)

**Files:**
- Create: `src/lib/biblioteca/areas.ts`
- Create: `src/lib/biblioteca/leitores.ts`
- Test: `src/lib/biblioteca/areas.test.ts`

**Interfaces:**
- Produces:
  - `AREAS_BIBLIOTECA`, `type AreaBiblioteca = 'TABELA_PRECOS' | 'LINKS_MPLS' | 'CALENDARIO' | 'PLANILHA_CONTRATOS' | 'OUTRO'`, `ehArea(s: string): s is AreaBiblioteca`
  - `BIBLIOTECA_DOCUMENTOS = 'DOCUMENTOS'`
  - `areaDoCaminho(caminho: string): AreaBiblioteca`
  - `chaveR2Biblioteca(sha256: string, extensao: string): string`
  - (extensão e tipo do conteúdo **já existem**: `extensaoDe(nome)` e `contentTypeDe(nome)` em `@/lib/arquivos/tipos` — não duplicar)
  - `podeVerArea(role: string, area: string): boolean`
  - `interface ArquivoDaArea { id; caminho; nome; extensao; sha256; modificadoEm: Date }`, `interface EntradaLeitor { prisma: PrismaClient; todos: ArquivoDaArea[]; mudados: string[]; ler(a: ArquivoDaArea): Promise<Buffer> }`, `type LeitorDeArea = (e: EntradaLeitor) => Promise<string>`

- [ ] **Step 1: Teste falhando** — `src/lib/biblioteca/areas.test.ts`:

```ts
import { areaDoCaminho, chaveR2Biblioteca, ehArea, podeVerArea } from './areas'

describe('areaDoCaminho', () => {
  it.each([
    ['TABELA DE PREÇOS PRODAM-SP/Tabela de Preços PRODAM-SP 2026 v3.0.pdf', 'TABELA_PRECOS'],
    ['tabela de precos prodam-sp/x.xlsx', 'TABELA_PRECOS'],
    ['FATURAMENTO SERVIÇOS PRODAM/Links MPLS - Relatórios para Faturamento/2026/a.pdf', 'LINKS_MPLS'],
    ['CALENDÁRIO FATURAMENTO/Calendário de Faturamento PRODAM 2026.pdf', 'CALENDARIO'],
    ['PLANILHA DE CONTRATOS DE RECEITA PRODAM/2026.01 - Contratos Receita.xlsx', 'PLANILHA_CONTRATOS'],
    ['OUTRA PASTA/qualquer.pdf', 'OUTRO'],
  ])('%s → %s', (caminho, area) => {
    expect(areaDoCaminho(caminho)).toBe(area)
  })
})

it('chave do R2 pelo conteúdo — dev e produção dividem o bucket', () => {
  expect(chaveR2Biblioteca('ab12', 'pdf')).toBe('biblioteca-documentos/ab12.pdf')
  expect(chaveR2Biblioteca('ab12', '')).toBe('biblioteca-documentos/ab12')
})

it('permissão por área: preços e calendário para todos, o resto só admin', () => {
  expect(podeVerArea('uploader', 'TABELA_PRECOS')).toBe(true)
  expect(podeVerArea('responsavel', 'CALENDARIO')).toBe(true)
  expect(podeVerArea('responsavel', 'LINKS_MPLS')).toBe(false)
  expect(podeVerArea('uploader', 'PLANILHA_CONTRATOS')).toBe(false)
  expect(podeVerArea('admin', 'OUTRO')).toBe(true)
})

it('ehArea', () => {
  expect(ehArea('TABELA_PRECOS')).toBe(true)
  expect(ehArea('tabela_precos')).toBe(false)
})
```

- [ ] **Step 2: Rodar e ver falhar** — `npx jest src/lib/biblioteca/areas.test.ts` → FAIL "Cannot find module './areas'".

- [ ] **Step 3: Implementar** — `src/lib/biblioteca/areas.ts`:

```ts
// Áreas da biblioteca "Documentos" do SharePoint (spec
// docs/superpowers/specs/2026-09-29-biblioteca-documentos-prodam-design.md §5.3): a área sai do primeiro
// nível do caminho e decide o leitor e quem pode abrir o arquivo.

export const AREAS_BIBLIOTECA = ['TABELA_PRECOS', 'LINKS_MPLS', 'CALENDARIO', 'PLANILHA_CONTRATOS', 'OUTRO'] as const
export type AreaBiblioteca = (typeof AREAS_BIBLIOTECA)[number]

export const BIBLIOTECA_DOCUMENTOS = 'DOCUMENTOS'

export function ehArea(texto: string): texto is AreaBiblioteca {
  return (AREAS_BIBLIOTECA as readonly string[]).includes(texto)
}

const semAcento = (texto: string) => texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()

/** Tolerante a caixa e acento; pasta desconhecida é `OUTRO` (guarda o arquivo, não lê). */
export function areaDoCaminho(caminho: string): AreaBiblioteca {
  const pasta = semAcento(caminho.split('/')[0] ?? '')
  if (/TABELA\s+DE\s+PRECOS/.test(pasta)) return 'TABELA_PRECOS'
  if (/FATURAMENTO\s+SERVICOS/.test(pasta)) return 'LINKS_MPLS'
  if (/CALENDARIO/.test(pasta)) return 'CALENDARIO'
  if (/PLANILHA\s+DE\s+CONTRATOS/.test(pasta)) return 'PLANILHA_CONTRATOS'
  return 'OUTRO'
}

/** Pelo conteúdo: arquivo repetido não duplica e dev/produção (mesmo bucket) não colidem. */
export function chaveR2Biblioteca(sha256: string, extensao: string): string {
  return `biblioteca-documentos/${sha256}${extensao ? `.${extensao}` : ''}`
}

/** Preço e calendário são de todos. Links dependem do contrato lido (entrega dos links); até lá, só admin. */
const AREAS_PUBLICAS: readonly string[] = ['TABELA_PRECOS', 'CALENDARIO']

export function podeVerArea(role: string, area: string): boolean {
  return role === 'admin' || AREAS_PUBLICAS.includes(area)
}
```

`src/lib/biblioteca/leitores.ts`:

```ts
import type { PrismaClient } from '@prisma/client'

// Contrato dos leitores por área (spec 2026-09-29-biblioteca-documentos-prodam §5.3): chamado uma vez
// por área quando algum arquivo dela entrou, mudou ou saiu. Grava os próprios dados e devolve a linha do
// log. Idempotente.

export interface ArquivoDaArea {
  id: string
  caminho: string
  nome: string
  extensao: string
  sha256: string
  modificadoEm: Date
}

export interface EntradaLeitor {
  prisma: PrismaClient
  /** Todos os arquivos ativos da área. */
  todos: ArquivoDaArea[]
  /** Ids dos arquivos que entraram ou mudaram nesta passada (de qualquer área). */
  mudados: string[]
  ler(arquivo: ArquivoDaArea): Promise<Buffer>
}

export type LeitorDeArea = (entrada: EntradaLeitor) => Promise<string>
```

- [ ] **Step 4: Rodar e ver passar** — `npx jest src/lib/biblioteca/areas.test.ts` → PASS.

- [ ] **Step 5: Commit** — `ARQS="src/lib/biblioteca/areas.ts src/lib/biblioteca/leitores.ts src/lib/biblioteca/areas.test.ts"`, `MSG="feat(biblioteca): áreas da biblioteca Documentos e contrato dos leitores"`.

---

### Task 3: Sincronização da biblioteca

**Files:**
- Create: `src/lib/biblioteca/sincronizar.ts`
- Test: `src/lib/biblioteca/sincronizar.test.ts`

**Interfaces:**
- Consumes: Task 2 (`areaDoCaminho`, `chaveR2Biblioteca`, `BIBLIOTECA_DOCUMENTOS`, `LeitorDeArea`, `ArquivoDaArea`); `extensaoDe(nome)`/`contentTypeDe(nome)` de `@/lib/arquivos/tipos`; `FonteArquivos` de `@/lib/arquivos/sharepoint/sincronizar`; `motivoIgnorar` de `@/lib/arquivos/sharepoint/regras`; `sha256Hex` de `@/lib/arquivos/servico`; `putR2` de `@/lib/r2`.
- Produces: `sincronizarBiblioteca(prisma, opcoes: OpcoesBiblioteca): Promise<ResultadoBiblioteca>`; `interface ConferenciaArea { area; noSharepoint; noVerai; faltando: string[] }`; `interface ResultadoBiblioteca { listados; ignorados; novos; mudados; iguais; removidos; falhas: {caminho; motivo}[]; leituras: string[]; conferencia: ConferenciaArea[] | null; remocaoSuspensa: string | null }`; `interface OpcoesBiblioteca { aplicar; fonte; leitores?; relerAreas?; gravar?; agora? }`.

- [ ] **Step 1: Teste falhando** — `src/lib/biblioteca/sincronizar.test.ts`:

```ts
/** @jest-environment node */
jest.mock('@/lib/prisma', () => ({ prisma: {} }))
// `servico` importa o storage (Vercel Blob) — mesmo mock do teste da sincronização da ContratosReceita.
jest.mock('@/lib/storage', () => ({ putUpload: jest.fn(), deleteUpload: jest.fn(async () => {}), getUpload: jest.fn() }))

import type { PrismaClient } from '@prisma/client'
import { sha256Hex } from '@/lib/arquivos/servico'
import { sincronizarBiblioteca } from './sincronizar'

/* eslint-disable @typescript-eslint/no-explicit-any */

const quando = new Date('2026-09-29T10:00:00Z')
const agora = new Date('2026-09-29T13:00:00Z')
const TABELA = 'TABELA DE PREÇOS PRODAM-SP/Tabela 2026 v3.0.pdf'
const LINK = 'FATURAMENTO SERVIÇOS PRODAM/Links MPLS/2026/2026.09/Links Solução/CGM 09-2026.pdf'

function fonte(arquivos: Record<string, Buffer>, data = quando) {
  return {
    listar: async () => Object.entries(arquivos).map(([caminho, c]) => ({ caminho, tamanhoBytes: c.length, modificadoEm: data })),
    ler: jest.fn(async (caminho: string) => arquivos[caminho]),
  }
}

function prismaFake(inicial: any[] = []) {
  const linhas = inicial.map((l) => ({ removidoNaOrigemEm: null, ...l }))
  let n = 0
  const casa = (l: any, where: any = {}) =>
    Object.entries(where).every(([k, v]: [string, any]) =>
      v && typeof v === 'object' && 'in' in v ? v.in.includes(l[k]) : v === null ? l[k] == null : l[k] === v
    )
  return {
    linhas,
    arquivoBiblioteca: {
      findMany: jest.fn(async ({ where }: any = {}) => linhas.filter((l) => casa(l, where))),
      create: jest.fn(async ({ data }: any) => {
        const l = { id: `ab-${++n}`, removidoNaOrigemEm: null, ...data }
        linhas.push(l)
        return l
      }),
      update: jest.fn(async ({ where, data }: any) => Object.assign(linhas.find((l) => l.id === where.id), data)),
      updateMany: jest.fn(async ({ where, data }: any) => {
        const alvo = linhas.filter((l) => casa(l, where))
        alvo.forEach((l) => Object.assign(l, data))
        return { count: alvo.length }
      }),
    },
  }
}

const registrado = (caminho: string, conteudo: Buffer, extra: any = {}) => ({
  id: `r-${caminho.length}`,
  biblioteca: 'DOCUMENTOS',
  caminho,
  area: caminho.startsWith('TABELA') ? 'TABELA_PRECOS' : 'LINKS_MPLS',
  nome: caminho.slice(caminho.lastIndexOf('/') + 1),
  extensao: 'pdf',
  tamanhoBytes: conteudo.length,
  sha256: sha256Hex(conteudo),
  modificadoEm: quando,
  ...extra,
})

const gravar = jest.fn(async (chave: string) => `r2:${chave}`)
const rodar = (prisma: any, opcoes: any) =>
  sincronizarBiblioteca(prisma as unknown as PrismaClient, { gravar, agora, ...opcoes })

beforeEach(() => jest.clearAllMocks())

it('só listagem: conta o que entraria e não grava nada', async () => {
  const prisma = prismaFake()
  const r = await rodar(prisma, { aplicar: false, fonte: fonte({ [TABELA]: Buffer.from('a') }) })
  expect(r).toMatchObject({ listados: 1, novos: 1, conferencia: null })
  expect(gravar).not.toHaveBeenCalled()
  expect(prisma.arquivoBiblioteca.create).not.toHaveBeenCalled()
})

it('arquivo novo: grava no R2 pelo conteúdo, registra com a área e confere', async () => {
  const prisma = prismaFake()
  const conteudo = Buffer.from('tabela')
  const r = await rodar(prisma, { aplicar: true, fonte: fonte({ [TABELA]: conteudo }) })
  expect(gravar).toHaveBeenCalledWith(`biblioteca-documentos/${sha256Hex(conteudo)}.pdf`, conteudo, 'application/pdf')
  expect(prisma.linhas[0]).toMatchObject({ biblioteca: 'DOCUMENTOS', caminho: TABELA, area: 'TABELA_PRECOS', chave: `r2:biblioteca-documentos/${sha256Hex(conteudo)}.pdf` })
  expect(r.novos).toBe(1)
  expect(r.conferencia).toEqual([{ area: 'TABELA_PRECOS', noSharepoint: 1, noVerai: 1, faltando: [] }])
})

it('mesmo tamanho e data: não lê o arquivo (não baixa do OneDrive) e só marca como visto', async () => {
  const conteudo = Buffer.from('igual')
  const prisma = prismaFake([registrado(TABELA, conteudo)])
  const f = fonte({ [TABELA]: conteudo })
  const r = await rodar(prisma, { aplicar: true, fonte: f })
  expect(f.ler).not.toHaveBeenCalled()
  expect(r.iguais).toBe(1)
  expect(prisma.linhas[0].vistoEm).toEqual(agora)
})

it('data mudou e conteúdo não: atualiza a data sem gravar no R2', async () => {
  const conteudo = Buffer.from('igual')
  const prisma = prismaFake([registrado(TABELA, conteudo)])
  const r = await rodar(prisma, { aplicar: true, fonte: fonte({ [TABELA]: conteudo }, new Date('2026-09-29T11:00:00Z')) })
  expect(gravar).not.toHaveBeenCalled()
  expect(r).toMatchObject({ iguais: 1, mudados: 0 })
})

it('conteúdo mudou: grava de novo e o leitor da área recebe o arquivo como mudado', async () => {
  const prisma = prismaFake([registrado(TABELA, Buffer.from('v1'))])
  const leitor = jest.fn(async () => 'tabela: lida')
  const r = await rodar(prisma, {
    aplicar: true,
    fonte: fonte({ [TABELA]: Buffer.from('v2 maior') }),
    leitores: { TABELA_PRECOS: leitor },
  })
  expect(r.mudados).toBe(1)
  expect(leitor).toHaveBeenCalledWith(expect.objectContaining({ mudados: [prisma.linhas[0].id], todos: [expect.objectContaining({ caminho: TABELA })] }))
  expect(r.leituras).toEqual(['tabela: lida'])
})

it('sumiu da pasta: remoção lógica e o leitor da área roda', async () => {
  const prisma = prismaFake([registrado(TABELA, Buffer.from('a')), registrado(LINK, Buffer.from('b'))])
  const leitor = jest.fn(async () => 'tabela: nada')
  const r = await rodar(prisma, { aplicar: true, fonte: fonte({ [LINK]: Buffer.from('b') }), leitores: { TABELA_PRECOS: leitor } })
  expect(r.removidos).toBe(1)
  expect(prisma.linhas.find((l) => l.caminho === TABELA).removidoNaOrigemEm).toEqual(agora)
  expect(leitor).toHaveBeenCalled()
})

it('listagem curta (menos da metade): remoção suspensa, nada sai', async () => {
  const prisma = prismaFake([registrado(TABELA, Buffer.from('a')), registrado(LINK, Buffer.from('b')), registrado('CALENDÁRIO FATURAMENTO/c.pdf', Buffer.from('c'))])
  const r = await rodar(prisma, { aplicar: true, fonte: fonte({ [LINK]: Buffer.from('b') }) })
  expect(r.remocaoSuspensa).toMatch(/remoção suspensa/)
  expect(r.removidos).toBe(0)
  expect(prisma.linhas.every((l) => l.removidoNaOrigemEm === null)).toBe(true)
})

it('falha ao gravar um arquivo não para os outros e aparece na conferência', async () => {
  const prisma = prismaFake()
  const gravarFalhando = jest.fn(async (chave: string, conteudo: Buffer) => {
    if (conteudo.toString() === 'ruim') throw new Error('R2 fora')
    return `r2:${chave}`
  })
  const r = await sincronizarBiblioteca(prisma as any, {
    aplicar: true,
    agora,
    gravar: gravarFalhando,
    fonte: fonte({ [TABELA]: Buffer.from('ruim'), [LINK]: Buffer.from('bom') }),
  })
  expect(r.falhas).toEqual([{ caminho: TABELA, motivo: 'R2 fora' }])
  expect(r.conferencia).toContainEqual({ area: 'TABELA_PRECOS', noSharepoint: 1, noVerai: 0, faltando: [TABELA] })
})

it('leitor que lança vira linha do log, o resto segue', async () => {
  const prisma = prismaFake()
  const r = await rodar(prisma, {
    aplicar: true,
    fonte: fonte({ [TABELA]: Buffer.from('a') }),
    leitores: { TABELA_PRECOS: async () => { throw new Error('planilha quebrada') } },
  })
  expect(r.leituras).toEqual(['TABELA_PRECOS: leitura falhou — planilha quebrada'])
  expect(r.conferencia?.[0].faltando).toEqual([])
})

it('--reler: o leitor roda mesmo sem nada mudado', async () => {
  const conteudo = Buffer.from('igual')
  const prisma = prismaFake([registrado(TABELA, conteudo)])
  const leitor = jest.fn(async () => 'relido')
  await rodar(prisma, { aplicar: true, fonte: fonte({ [TABELA]: conteudo }), leitores: { TABELA_PRECOS: leitor }, relerAreas: ['TABELA_PRECOS'] })
  expect(leitor).toHaveBeenCalledWith(expect.objectContaining({ mudados: [] }))
})

it('arquivo temporário do Office e desktop.ini ficam de fora', async () => {
  const prisma = prismaFake()
  const r = await rodar(prisma, {
    aplicar: true,
    fonte: fonte({ [TABELA]: Buffer.from('a'), 'TABELA DE PREÇOS PRODAM-SP/~$Memória.xlsx': Buffer.from('t'), 'TABELA DE PREÇOS PRODAM-SP/desktop.ini': Buffer.from('d') }),
  })
  expect(r).toMatchObject({ listados: 1, ignorados: 2 })
})
```

- [ ] **Step 2: Rodar e ver falhar** — `npx jest src/lib/biblioteca/sincronizar.test.ts` → FAIL "Cannot find module './sincronizar'".

- [ ] **Step 3: Implementar** — `src/lib/biblioteca/sincronizar.ts`:

```ts
import type { PrismaClient } from '@prisma/client'
import { putR2 } from '@/lib/r2'
import { sha256Hex } from '@/lib/arquivos/servico'
import { contentTypeDe, extensaoDe } from '@/lib/arquivos/tipos'
import { motivoIgnorar } from '@/lib/arquivos/sharepoint/regras'
import type { FonteArquivos } from '@/lib/arquivos/sharepoint/sincronizar'
import { areaDoCaminho, BIBLIOTECA_DOCUMENTOS, chaveR2Biblioteca, type AreaBiblioteca } from './areas'
import type { ArquivoDaArea, LeitorDeArea } from './leitores'

// Biblioteca "Documentos" do SharePoint → VerAI (spec
// docs/superpowers/specs/2026-09-29-biblioteca-documentos-prodam-design.md §5): listagem, arquivo
// novo/mudado para o R2 pelo conteúdo, remoção lógica, leitor por área e conferência. A fonte é
// injetada, como na ContratosReceita.

export interface ConferenciaArea {
  area: AreaBiblioteca
  noSharepoint: number
  noVerai: number
  faltando: string[]
}

export interface ResultadoBiblioteca {
  listados: number
  ignorados: number
  novos: number
  mudados: number
  iguais: number
  removidos: number
  falhas: { caminho: string; motivo: string }[]
  leituras: string[]
  /** `null` em só listagem. */
  conferencia: ConferenciaArea[] | null
  remocaoSuspensa: string | null
}

export interface OpcoesBiblioteca {
  aplicar: boolean
  fonte: FonteArquivos
  leitores?: Partial<Record<AreaBiblioteca, LeitorDeArea>>
  /** Áreas cujo leitor roda mesmo sem mudança (`--reler=`). */
  relerAreas?: AreaBiblioteca[]
  /** Padrão: Cloudflare R2. Devolve o endereço guardado em `chave`. */
  gravar?: (chave: string, conteudo: Buffer, contentType: string) => Promise<string>
  agora?: Date
}

/** Abaixo disso a listagem é falha da fonte (OneDrive pausado) — melhor não remover nada. */
const FRACAO_MINIMA_LISTADA = 0.5

const nomeDe = (caminho: string) => caminho.slice(caminho.lastIndexOf('/') + 1)
const mensagem = (erro: unknown) => (erro instanceof Error ? erro.message : String(erro)).slice(0, 500)

export async function sincronizarBiblioteca(prisma: PrismaClient, opcoes: OpcoesBiblioteca): Promise<ResultadoBiblioteca> {
  const { aplicar, fonte, leitores = {}, relerAreas = [] } = opcoes
  const gravar = opcoes.gravar ?? putR2
  const agora = opcoes.agora ?? new Date()
  const r: ResultadoBiblioteca = {
    listados: 0, ignorados: 0, novos: 0, mudados: 0, iguais: 0, removidos: 0,
    falhas: [], leituras: [], conferencia: null, remocaoSuspensa: null,
  }

  const lista = (await fonte.listar()).filter((a) => {
    const ignorar = motivoIgnorar(a.caminho.split('/'), a.tamanhoBytes)
    if (ignorar) r.ignorados++
    return !ignorar
  })
  r.listados = lista.length

  const estado = await prisma.arquivoBiblioteca.findMany({ where: { biblioteca: BIBLIOTECA_DOCUMENTOS } })
  const porCaminho = new Map(estado.map((e) => [e.caminho, e]))
  const tocadas = new Set<AreaBiblioteca>(relerAreas)
  const mudados: string[] = []
  const iguais: string[] = []

  for (const a of lista) {
    const e = porCaminho.get(a.caminho)
    const ativo = e && !e.removidoNaOrigemEm ? e : null
    // Mesmo tamanho e data: nem lê (ler baixa o arquivo do OneDrive).
    if (ativo && ativo.tamanhoBytes === a.tamanhoBytes && ativo.modificadoEm.getTime() === a.modificadoEm.getTime()) {
      r.iguais++
      iguais.push(ativo.id)
      continue
    }
    if (!aplicar) {
      if (ativo) r.mudados++
      else r.novos++
      continue
    }
    try {
      const conteudo = await fonte.ler(a.caminho)
      const sha256 = sha256Hex(conteudo)
      if (ativo && ativo.sha256 === sha256) {
        await prisma.arquivoBiblioteca.update({ where: { id: ativo.id }, data: { tamanhoBytes: a.tamanhoBytes, modificadoEm: a.modificadoEm, vistoEm: agora } })
        r.iguais++
        continue
      }
      const nome = nomeDe(a.caminho)
      const extensao = extensaoDe(nome)
      const contentType = contentTypeDe(nome)
      const area = areaDoCaminho(a.caminho)
      const chave = await gravar(chaveR2Biblioteca(sha256, extensao), conteudo, contentType)
      const dados = {
        area, nome, extensao, contentType, tamanhoBytes: a.tamanhoBytes, sha256, chave,
        modificadoEm: a.modificadoEm, vistoEm: agora, removidoNaOrigemEm: null,
        leituraStatus: null, leituraMensagem: null, lidoEm: null,
      }
      const salvo = e
        ? await prisma.arquivoBiblioteca.update({ where: { id: e.id }, data: dados })
        : await prisma.arquivoBiblioteca.create({ data: { biblioteca: BIBLIOTECA_DOCUMENTOS, caminho: a.caminho, ...dados } })
      if (ativo) r.mudados++
      else r.novos++
      mudados.push(salvo.id)
      tocadas.add(area)
    } catch (erro) {
      r.falhas.push({ caminho: a.caminho, motivo: mensagem(erro) })
    }
  }

  const naPasta = new Set(lista.map((a) => a.caminho))
  const ativos = estado.filter((e) => !e.removidoNaOrigemEm)
  const sumiram = ativos.filter((e) => !naPasta.has(e.caminho))
  if (ativos.length > 0 && lista.length < ativos.length * FRACAO_MINIMA_LISTADA) {
    r.remocaoSuspensa = `listagem com ${lista.length} arquivo(s) contra ${ativos.length} registrados — remoção suspensa (OneDrive pausado?)`
  } else {
    r.removidos = sumiram.length
    if (aplicar && sumiram.length > 0) {
      await prisma.arquivoBiblioteca.updateMany({ where: { id: { in: sumiram.map((e) => e.id) } }, data: { removidoNaOrigemEm: agora } })
      for (const e of sumiram) tocadas.add(areaDoCaminho(e.caminho))
    }
  }
  if (!aplicar) return r

  if (iguais.length > 0) await prisma.arquivoBiblioteca.updateMany({ where: { id: { in: iguais } }, data: { vistoEm: agora } })

  for (const area of tocadas) {
    const leitor = leitores[area]
    if (!leitor) continue
    try {
      const todos: ArquivoDaArea[] = await prisma.arquivoBiblioteca.findMany({
        where: { biblioteca: BIBLIOTECA_DOCUMENTOS, area, removidoNaOrigemEm: null },
        select: { id: true, caminho: true, nome: true, extensao: true, sha256: true, modificadoEm: true },
      })
      r.leituras.push(await leitor({ prisma, todos, mudados, ler: (arquivo) => fonte.ler(arquivo.caminho) }))
    } catch (erro) {
      r.leituras.push(`${area}: leitura falhou — ${mensagem(erro)}`)
    }
  }

  const gravados = await prisma.arquivoBiblioteca.findMany({
    where: { biblioteca: BIBLIOTECA_DOCUMENTOS, removidoNaOrigemEm: null },
    select: { caminho: true },
  })
  const noVerai = new Set(gravados.map((g) => g.caminho))
  const porArea = new Map<AreaBiblioteca, ConferenciaArea>()
  for (const a of lista) {
    const area = areaDoCaminho(a.caminho)
    const linha = porArea.get(area) ?? { area, noSharepoint: 0, noVerai: 0, faltando: [] }
    linha.noSharepoint++
    if (noVerai.has(a.caminho)) linha.noVerai++
    else linha.faltando.push(a.caminho)
    porArea.set(area, linha)
  }
  r.conferencia = [...porArea.values()]
  return r
}
```

- [ ] **Step 4: Rodar e ver passar** — `npx jest src/lib/biblioteca/sincronizar.test.ts` → PASS (11 testes). `npx tsc --noEmit` sem erro nos arquivos novos.

- [ ] **Step 5: Commit** — `ARQS="src/lib/biblioteca/sincronizar.ts src/lib/biblioteca/sincronizar.test.ts"`, `MSG="feat(biblioteca): sincronização da biblioteca Documentos para o R2"`.

---

### Task 4: Etapa no agendador

**Files:**
- Create: `src/lib/migracao-aplicada.ts`
- Create: `src/lib/biblioteca/registro-leitores.ts`
- Create: `src/lib/biblioteca/etapa.ts`
- Test: `src/lib/biblioteca/etapa.test.ts`
- Modify: `src/lib/arquivos/sharepoint/fonte-pasta.ts` (+ `pastaPadraoDosDocumentos`)
- Modify: `scripts/sincronizar-sharepoint.ts` (um Edit só, depois de `registrarAtualizacao` e antes do bloco do índice; e o cabeçalho)

**Interfaces:**
- Consumes: `sincronizarBiblioteca`, `ResultadoBiblioteca` (Task 3); `fonteDaPasta`.
- Produces: `migracaoAplicada(prisma, nome): Promise<boolean>`; `LEITORES: Partial<Record<AreaBiblioteca, LeitorDeArea>>` (vazio aqui; a Task 8 acrescenta a tabela); `MIGRACAO_DA_BIBLIOTECA = '20260929100000_biblioteca_documentos'`; `motivoIncompletaBiblioteca(r, aplicar): string | null`; `etapaDaBiblioteca(prisma, { aplicar, raiz, relerAreas? }, deps?): Promise<{ linhas: string[]; problema: boolean }>`; `pastaPadraoDosDocumentos(): string`.

- [ ] **Step 1: Teste falhando** — `src/lib/biblioteca/etapa.test.ts`:

```ts
/** @jest-environment node */
jest.mock('@/lib/prisma', () => ({ prisma: {} }))
jest.mock('@/lib/storage', () => ({ putUpload: jest.fn(), deleteUpload: jest.fn(async () => {}), getUpload: jest.fn() }))

import type { PrismaClient } from '@prisma/client'
import { etapaDaBiblioteca, MIGRACAO_DA_BIBLIOTECA, motivoIncompletaBiblioteca } from './etapa'
import type { ResultadoBiblioteca } from './sincronizar'

/* eslint-disable @typescript-eslint/no-explicit-any */

const completa = (extra: Partial<ResultadoBiblioteca> = {}): ResultadoBiblioteca => ({
  listados: 904, ignorados: 0, novos: 0, mudados: 1, iguais: 903, removidos: 0, falhas: [],
  leituras: ['tabela de preços 2026 v3.0: 315 serviços'],
  conferencia: [{ area: 'TABELA_PRECOS', noSharepoint: 5, noVerai: 5, faltando: [] }],
  remocaoSuspensa: null,
  ...extra,
})

function deps(r: ResultadoBiblioteca | Error, extra: any = {}) {
  return {
    existe: () => true,
    bancoPronto: async () => true,
    fonte: () => ({ listar: async () => [], ler: async () => Buffer.from('') }),
    sincronizar: jest.fn(async () => { if (r instanceof Error) throw r; return r }),
    agora: () => new Date('2026-09-29T13:00:00Z'),
    ...extra,
  }
}
const prisma = () => ({ atualizacaoBiblioteca: { create: jest.fn() } })

it('motivoIncompletaBiblioteca', () => {
  expect(motivoIncompletaBiblioteca(completa(), true)).toBeNull()
  expect(motivoIncompletaBiblioteca(completa(), false)).toBe('só listagem')
  expect(motivoIncompletaBiblioteca(completa({ conferencia: [{ area: 'OUTRO', noSharepoint: 1, noVerai: 0, faltando: ['x'] }] }), true)).toBe('conferência com divergência')
  expect(motivoIncompletaBiblioteca(completa({ remocaoSuspensa: 'curta' }), true)).toBe('remoção suspensa')
  expect(motivoIncompletaBiblioteca(completa({ falhas: [{ caminho: 'a', motivo: 'b' }] }), true)).toBe('1 arquivo(s) com falha')
})

it('pasta que não existe neste PC: pula sem problema', async () => {
  const p = prisma()
  const r = await etapaDaBiblioteca(p as any, { aplicar: true, raiz: 'C:/nao/existe' }, deps(completa(), { existe: () => false }))
  expect(r).toEqual({ linhas: ['biblioteca Documentos: pasta não encontrada (C:/nao/existe) — pulada'], problema: false })
})

it('banco sem a migração (produção num deploy antigo): pula e não mexe no código de saída', async () => {
  const d = deps(completa(), { bancoPronto: async () => false })
  const r = await etapaDaBiblioteca(prisma() as any, { aplicar: true, raiz: 'x' }, d)
  expect(r).toEqual({ linhas: [`biblioteca Documentos: pulada — migração ${MIGRACAO_DA_BIBLIOTECA} não aplicada neste banco`], problema: false })
  expect(d.sincronizar).not.toHaveBeenCalled()
})

it('passada completa grava a data das telas', async () => {
  const p = prisma()
  const r = await etapaDaBiblioteca(p as any, { aplicar: true, raiz: 'x' }, deps(completa()))
  expect(p.atualizacaoBiblioteca.create).toHaveBeenCalledWith({ data: { biblioteca: 'DOCUMENTOS', iniciadaEm: new Date('2026-09-29T13:00:00Z'), arquivos: 904 } })
  expect(r.problema).toBe(false)
  expect(r.linhas.join('\n')).toMatch(/904 arquivo\(s\)[\s\S]*tabela de preços 2026 v3\.0[\s\S]*TUDO NO VERAI[\s\S]*data das telas: atualizada/)
})

it('divergência: problema (código 2) e sem data', async () => {
  const p = prisma()
  const r = await etapaDaBiblioteca(p as any, { aplicar: true, raiz: 'x' }, deps(completa({ conferencia: [{ area: 'LINKS_MPLS', noSharepoint: 2, noVerai: 1, faltando: ['L/a.pdf'] }] })))
  expect(r.problema).toBe(true)
  expect(p.atualizacaoBiblioteca.create).not.toHaveBeenCalled()
  expect(r.linhas.join('\n')).toMatch(/DIVERGÊNCIA em LINKS_MPLS[\s\S]*falta L\/a\.pdf/)
})

it('erro inesperado vira linha do log e problema', async () => {
  const r = await etapaDaBiblioteca(prisma() as any, { aplicar: true, raiz: 'x' }, deps(new Error('R2 fora')))
  expect(r).toEqual({ linhas: ['biblioteca Documentos: falhou — R2 fora (a próxima rodada tenta de novo)'], problema: true })
})

it('só listagem: não grava data e não é problema', async () => {
  const p = prisma()
  const r = await etapaDaBiblioteca(p as any, { aplicar: false, raiz: 'x' }, deps(completa({ conferencia: null })))
  expect(p.atualizacaoBiblioteca.create).not.toHaveBeenCalled()
  expect(r.problema).toBe(false)
})
```

- [ ] **Step 2: Rodar e ver falhar** — `npx jest src/lib/biblioteca/etapa.test.ts` → FAIL "Cannot find module './etapa'".

- [ ] **Step 3: Implementar**

`src/lib/migracao-aplicada.ts`:

```ts
import type { PrismaClient } from '@prisma/client'

/** O agendador do SharePoint roda o código da pasta contra PRODUÇÃO, que pode estar num deploy sem a
 *  migração: cada etapa nova confere antes de tocar nas tabelas dela. */
export async function migracaoAplicada(prisma: PrismaClient, nome: string): Promise<boolean> {
  const linhas = await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT count(*) AS n FROM "_prisma_migrations" WHERE migration_name = ${nome} AND finished_at IS NOT NULL`
  return Number(linhas[0]?.n ?? 0) > 0
}
```

`src/lib/biblioteca/registro-leitores.ts`:

```ts
import type { AreaBiblioteca } from './areas'
import type { LeitorDeArea } from './leitores'

/** Leitor de cada área da biblioteca Documentos. Área sem leitor: o arquivo só é guardado. */
export const LEITORES: Partial<Record<AreaBiblioteca, LeitorDeArea>> = {}
```

`src/lib/biblioteca/etapa.ts`:

```ts
import { existsSync } from 'node:fs'
import type { PrismaClient } from '@prisma/client'
import { fonteDaPasta } from '@/lib/arquivos/sharepoint/fonte-pasta'
import { migracaoAplicada } from '@/lib/migracao-aplicada'
import { BIBLIOTECA_DOCUMENTOS, type AreaBiblioteca } from './areas'
import { LEITORES } from './registro-leitores'
import { sincronizarBiblioteca, type ResultadoBiblioteca } from './sincronizar'

// Etapa da biblioteca "Documentos" no scripts/sincronizar-sharepoint.ts (spec
// docs/superpowers/specs/2026-09-29-biblioteca-documentos-prodam-design.md §5.1–5.4). Isolada: nunca lança
// e nunca desfaz a passada dos contratos; `problema` vira código de saída 2 no script.

export const MIGRACAO_DA_BIBLIOTECA = '20260929100000_biblioteca_documentos'

/** Mesma regra de "passada completa" da ContratosReceita; `null` = vale para a data das telas. */
export function motivoIncompletaBiblioteca(r: ResultadoBiblioteca, aplicar: boolean): string | null {
  if (!aplicar) return 'só listagem'
  if (!r.conferencia) return 'sem conferência'
  if (r.conferencia.some((l) => l.faltando.length > 0)) return 'conferência com divergência'
  if (r.remocaoSuspensa) return 'remoção suspensa'
  if (r.falhas.length > 0) return `${r.falhas.length} arquivo(s) com falha`
  return null
}

export interface DepsEtapa {
  existe: (caminho: string) => boolean
  bancoPronto: () => Promise<boolean>
  fonte: typeof fonteDaPasta
  sincronizar: typeof sincronizarBiblioteca
  agora: () => Date
}

export async function etapaDaBiblioteca(
  prisma: PrismaClient,
  opcoes: { aplicar: boolean; raiz: string; relerAreas?: AreaBiblioteca[] },
  deps: DepsEtapa = {
    existe: existsSync,
    bancoPronto: () => migracaoAplicada(prisma, MIGRACAO_DA_BIBLIOTECA),
    fonte: fonteDaPasta,
    sincronizar: sincronizarBiblioteca,
    agora: () => new Date(),
  }
): Promise<{ linhas: string[]; problema: boolean }> {
  const iniciadaEm = deps.agora()
  if (!deps.existe(opcoes.raiz)) return { linhas: [`biblioteca Documentos: pasta não encontrada (${opcoes.raiz}) — pulada`], problema: false }
  try {
    if (!(await deps.bancoPronto())) {
      return { linhas: [`biblioteca Documentos: pulada — migração ${MIGRACAO_DA_BIBLIOTECA} não aplicada neste banco`], problema: false }
    }
    const r = await deps.sincronizar(prisma, { aplicar: opcoes.aplicar, fonte: deps.fonte(opcoes.raiz), leitores: LEITORES, relerAreas: opcoes.relerAreas })
    const linhas = [
      `biblioteca Documentos: ${r.listados} arquivo(s) · novos ${r.novos} · mudados ${r.mudados} · iguais ${r.iguais} · removidos ${r.removidos}${r.ignorados ? ` · ignorados ${r.ignorados}` : ''}`,
    ]
    for (const f of r.falhas) linhas.push(`  falha ${f.caminho}: ${f.motivo}`)
    if (r.remocaoSuspensa) linhas.push(`  ATENÇÃO: ${r.remocaoSuspensa}`)
    for (const l of r.leituras) linhas.push(`  ${l}`)
    const divergentes = r.conferencia?.filter((l) => l.faltando.length > 0) ?? []
    if (r.conferencia) {
      linhas.push(`  conferência: ${divergentes.length === 0 ? 'TUDO NO VERAI' : `DIVERGÊNCIA em ${divergentes.map((l) => l.area).join(', ')}`}`)
      for (const l of divergentes) for (const f of l.faltando.slice(0, 20)) linhas.push(`    falta ${f}`)
    }
    const motivo = motivoIncompletaBiblioteca(r, opcoes.aplicar)
    if (!motivo) {
      await prisma.atualizacaoBiblioteca.create({ data: { biblioteca: BIBLIOTECA_DOCUMENTOS, iniciadaEm, arquivos: r.listados } })
      linhas.push('  data das telas: atualizada')
    } else if (opcoes.aplicar) {
      linhas.push(`  data das telas: não atualizada — ${motivo}`)
    }
    return { linhas, problema: opcoes.aplicar && divergentes.length > 0 }
  } catch (erro) {
    return { linhas: [`biblioteca Documentos: falhou — ${erro instanceof Error ? erro.message : String(erro)} (a próxima rodada tenta de novo)`], problema: true }
  }
}
```

Em `src/lib/arquivos/sharepoint/fonte-pasta.ts`, logo depois de `pastaPadraoDaBiblioteca`:

```ts
/** Onde o OneDrive sincroniza a biblioteca "Documentos" (tabela de preços, links, calendário, planilha). */
export function pastaPadraoDosDocumentos(): string {
  return process.env.SHAREPOINT_PASTA_DOCUMENTOS ?? path.join(homedir(), 'rede.sp', 'rede.sp - Documentos')
}
```

- [ ] **Step 4: Rodar e ver passar** — `npx jest src/lib/biblioteca/etapa.test.ts` → PASS.

- [ ] **Step 5: Ligar no script (um Edit só)** — em `scripts/sincronizar-sharepoint.ts`:
  - imports: `import { etapaDaBiblioteca } from '../src/lib/biblioteca/etapa'`, `import { AREAS_BIBLIOTECA, ehArea } from '../src/lib/biblioteca/areas'` e `pastaPadraoDosDocumentos` no import de `fonte-pasta`;
  - no cabeçalho, acrescentar às opções: `--pasta-documentos="C:\...\rede.sp - Documentos"` (padrão `~/rede.sp/rede.sp - Documentos` ou `SHAREPOINT_PASTA_DOCUMENTOS`), `--sem-documentos`, `--reler=TABELA_PRECOS` (relê a área mesmo sem mudança);
  - logo depois da linha do `registrarAtualizacao` e antes de `if (aplicar) {` do índice:

```ts
    // Biblioteca "Documentos" — tabela de preços, links, calendário, planilha de contratos (spec
    // 2026-09-29-biblioteca-documentos-prodam). Pulada com --clientes (teste parcial) e --sem-documentos.
    if (!clientes && !process.argv.includes('--sem-documentos')) {
      const relerAreas = argumento('reler')?.split(',').map((s) => s.trim().toUpperCase()).filter(ehArea)
      if (argumento('reler') && !relerAreas?.length) throw new Error(`--reler aceita: ${AREAS_BIBLIOTECA.join(', ')}`)
      const documentos = await etapaDaBiblioteca(prisma, {
        aplicar,
        raiz: argumento('pasta-documentos') ?? pastaPadraoDosDocumentos(),
        relerAreas,
      })
      console.log(`\n${documentos.linhas.join('\n')}`)
      if (documentos.problema && !process.exitCode) process.exitCode = 2
    }
```

- [ ] **Step 6: Conferir sem gravar** — `npx dotenv -e .env.development -- npx tsx scripts/sincronizar-sharepoint.ts` (só listagem, contra o dev). Expected no fim: `biblioteca Documentos: 904 arquivo(s) · novos 904 · mudados 0 · iguais 0 · removidos 0` (o número exato é o da pasta no dia). Nada é gravado.

- [ ] **Step 7: Commit** — `ARQS="src/lib/migracao-aplicada.ts src/lib/biblioteca/registro-leitores.ts src/lib/biblioteca/etapa.ts src/lib/biblioteca/etapa.test.ts src/lib/arquivos/sharepoint/fonte-pasta.ts scripts/sincronizar-sharepoint.ts"`, `MSG="feat(biblioteca): etapa da biblioteca Documentos no agendador do SharePoint"`.

---

### Task 5: Entrega do arquivo e "Atualizado em"

**Files:**
- Create: `src/app/api/biblioteca/[id]/route.ts` + `route.test.ts`
- Create: `src/app/api/biblioteca/atualizacao/route.ts` + `route.test.ts`
- Modify: `src/components/sharepoint/atualizacao-sharepoint.tsx` (prop `url`)
- Modify: `src/components/sharepoint/atualizacao-sharepoint.test.tsx` (um caso novo)

**Interfaces:**
- Consumes: `podeVerArea` (Task 2); `abrirUpload` de `@/lib/storage`; `getAuthUser`.
- Produces: `GET /api/biblioteca/[id]` (inline; `?baixar=1` = anexo); `GET /api/biblioteca/atualizacao` → `{ atualizadoEm: string | null }`; `<AtualizacaoSharepoint url="/api/biblioteca/atualizacao" />`.

- [ ] **Step 1: Testes falhando**

`src/app/api/biblioteca/[id]/route.test.ts`:

```ts
/** @jest-environment node */
import { NextRequest } from 'next/server'

jest.mock('@/lib/auth', () => ({ ...jest.requireActual('@/lib/auth'), getAuthUser: jest.fn() }))
jest.mock('@/lib/prisma', () => ({ prisma: { arquivoBiblioteca: { findUnique: jest.fn() } } }))
jest.mock('@/lib/storage', () => ({ abrirUpload: jest.fn() }))

import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { abrirUpload } from '@/lib/storage'
import { GET } from './route'

const usuario = (role: string) => ({ id: 'u1', nome: 'A', email: 'a@x', role })
const pedido = (q = '') => new NextRequest(`http://localhost/api/biblioteca/ab1${q}`)
const ctx = { params: Promise.resolve({ id: 'ab1' }) }
const arquivo = (area: string) => ({ area, nome: 'Tabela de Preços 2026 v3.0.pdf', contentType: 'application/pdf', chave: 'r2:biblioteca-documentos/x.pdf' })

beforeEach(() => {
  jest.clearAllMocks()
  ;(abrirUpload as jest.Mock).mockResolvedValue(new Response('PDF', { headers: { 'content-length': '3' } }))
})

it('401 sem usuário', async () => {
  ;(getAuthUser as jest.Mock).mockResolvedValue(null)
  expect((await GET(pedido(), ctx)).status).toBe(401)
})

it('tabela de preços abre para qualquer usuário, inline, sem expor a chave do R2', async () => {
  ;(getAuthUser as jest.Mock).mockResolvedValue(usuario('uploader'))
  ;(prisma.arquivoBiblioteca.findUnique as jest.Mock).mockResolvedValue(arquivo('TABELA_PRECOS'))
  const r = await GET(pedido(), ctx)
  expect(r.status).toBe(200)
  expect(r.headers.get('content-disposition')).toMatch(/^inline; filename="Tabela de Precos 2026 v3.0.pdf"; filename\*=UTF-8''Tabela%20de%20Pre%C3%A7os/)
  expect(r.headers.get('content-type')).toBe('application/pdf')
  expect(await r.text()).toBe('PDF')
  expect(abrirUpload).toHaveBeenCalledWith('r2:biblioteca-documentos/x.pdf')
})

it('?baixar=1 vira anexo', async () => {
  ;(getAuthUser as jest.Mock).mockResolvedValue(usuario('uploader'))
  ;(prisma.arquivoBiblioteca.findUnique as jest.Mock).mockResolvedValue(arquivo('TABELA_PRECOS'))
  expect((await GET(pedido('?baixar=1'), ctx)).headers.get('content-disposition')).toMatch(/^attachment;/)
})

it('área restrita: 404 para quem não é admin (não revela que existe), 200 para admin', async () => {
  ;(prisma.arquivoBiblioteca.findUnique as jest.Mock).mockResolvedValue(arquivo('LINKS_MPLS'))
  ;(getAuthUser as jest.Mock).mockResolvedValue(usuario('responsavel'))
  expect((await GET(pedido(), ctx)).status).toBe(404)
  ;(getAuthUser as jest.Mock).mockResolvedValue(usuario('admin'))
  expect((await GET(pedido(), ctx)).status).toBe(200)
})

it('404 quando não existe; 502 quando o storage falha', async () => {
  ;(getAuthUser as jest.Mock).mockResolvedValue(usuario('admin'))
  ;(prisma.arquivoBiblioteca.findUnique as jest.Mock).mockResolvedValue(null)
  expect((await GET(pedido(), ctx)).status).toBe(404)
  ;(prisma.arquivoBiblioteca.findUnique as jest.Mock).mockResolvedValue(arquivo('CALENDARIO'))
  ;(abrirUpload as jest.Mock).mockResolvedValue(new Response('x', { status: 500 }))
  expect((await GET(pedido(), ctx)).status).toBe(502)
})
```

`src/app/api/biblioteca/atualizacao/route.test.ts`:

```ts
/** @jest-environment node */
import { NextRequest } from 'next/server'

jest.mock('@/lib/auth', () => ({ ...jest.requireActual('@/lib/auth'), getAuthUser: jest.fn() }))
jest.mock('@/lib/prisma', () => ({ prisma: { atualizacaoBiblioteca: { findFirst: jest.fn() } } }))

import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { GET } from './route'

const pedido = () => new NextRequest('http://localhost/api/biblioteca/atualizacao')

it('401 sem usuário', async () => {
  ;(getAuthUser as jest.Mock).mockResolvedValue(null)
  expect((await GET(pedido())).status).toBe(401)
})

it('a passada completa mais recente da biblioteca Documentos', async () => {
  ;(getAuthUser as jest.Mock).mockResolvedValue({ id: 'u1', nome: 'A', email: 'a@x', role: 'uploader' })
  ;(prisma.atualizacaoBiblioteca.findFirst as jest.Mock).mockResolvedValue({ iniciadaEm: new Date('2026-09-29T13:30:00.000Z') })
  await expect((await GET(pedido())).json()).resolves.toEqual({ atualizadoEm: '2026-09-29T13:30:00.000Z' })
  expect(prisma.atualizacaoBiblioteca.findFirst).toHaveBeenCalledWith({
    where: { biblioteca: 'DOCUMENTOS' },
    orderBy: { iniciadaEm: 'desc' },
    select: { iniciadaEm: true },
  })
})
```

Em `src/components/sharepoint/atualizacao-sharepoint.test.tsx`, dentro do `describe('AtualizacaoSharepoint')` (usa o `responder` que o arquivo já tem):

```tsx
  it('busca na URL recebida — as telas da biblioteca Documentos usam a delas', async () => {
    responder(true, { atualizadoEm: null })
    render(<AtualizacaoSharepoint url="/api/biblioteca/atualizacao" />)
    expect(global.fetch).toHaveBeenCalledWith('/api/biblioteca/atualizacao')
    expect(await screen.findByText('Ainda não sincronizado com o SharePoint')).toBeInTheDocument()
  })
```

- [ ] **Step 2: Rodar e ver falhar** — `npx jest src/app/api/biblioteca src/components/sharepoint/atualizacao-sharepoint.test.tsx` → FAIL (rotas não existem; prop ignorada).

- [ ] **Step 3: Implementar**

`src/app/api/biblioteca/[id]/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { abrirUpload } from '@/lib/storage'
import { podeVerArea } from '@/lib/biblioteca/areas'

type Contexto = { params: Promise<{ id: string }> }

/** Nome só com ASCII para o `filename=` de navegador velho (o `filename*` leva o nome certo). */
const nomeAscii = (nome: string) => nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x20-\x7e]|["\\]/g, '_')

/** Única saída do conteúdo de um arquivo da biblioteca Documentos (spec 2026-09-29-biblioteca-documentos-prodam
 *  §7): a chave do R2 nunca vai ao navegador. Área que o usuário não pode ver responde 404, como se não
 *  existisse. Sempre por streaming. */
export async function GET(request: NextRequest, { params }: Contexto) {
  const usuario = await getAuthUser(request)
  if (!usuario) return NextResponse.json({ error: 'não autenticado' }, { status: 401 })

  const { id } = await params
  const arquivo = await prisma.arquivoBiblioteca.findUnique({ where: { id }, select: { area: true, nome: true, contentType: true, chave: true } })
  if (!arquivo || !podeVerArea(usuario.role, arquivo.area)) return NextResponse.json({ error: 'não encontrado' }, { status: 404 })

  const res = await abrirUpload(arquivo.chave).catch(() => null)
  if (!res?.ok || !res.body) return NextResponse.json({ error: 'não foi possível ler o arquivo agora — tente de novo' }, { status: 502 })

  const modo = request.nextUrl.searchParams.get('baixar') === '1' ? 'attachment' : 'inline'
  const headers = new Headers({
    'Content-Type': arquivo.contentType,
    'Content-Disposition': `${modo}; filename="${nomeAscii(arquivo.nome)}"; filename*=UTF-8''${encodeURIComponent(arquivo.nome)}`,
    'X-Content-Type-Options': 'nosniff',
  })
  const tamanho = res.headers.get('content-length')
  if (tamanho) headers.set('Content-Length', tamanho)
  return new NextResponse(res.body, { headers })
}
```

`src/app/api/biblioteca/atualizacao/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { BIBLIOTECA_DOCUMENTOS } from '@/lib/biblioteca/areas'

// "Atualizado em …" das telas da biblioteca Documentos (spec 2026-09-29-biblioteca-documentos-prodam §5.4).
export async function GET(request: NextRequest) {
  const usuario = await getAuthUser(request)
  if (!usuario) return NextResponse.json({ error: 'não autenticado' }, { status: 401 })
  const ultima = await prisma.atualizacaoBiblioteca.findFirst({
    where: { biblioteca: BIBLIOTECA_DOCUMENTOS },
    orderBy: { iniciadaEm: 'desc' },
    select: { iniciadaEm: true },
  })
  return NextResponse.json({ atualizadoEm: ultima?.iniciadaEm.toISOString() ?? null })
}
```

Em `src/components/sharepoint/atualizacao-sharepoint.tsx`: assinatura `export function AtualizacaoSharepoint({ className = '', url = '/api/sharepoint/atualizacao' }: { className?: string; url?: string })`, `fetch(url)` no lugar da URL fixa e `[url]` como dependência do `useEffect`. Atualizar o comentário do topo: "…e das telas da biblioteca Documentos (`url="/api/biblioteca/atualizacao"`)".

- [ ] **Step 4: Rodar e ver passar** — `npx jest src/app/api/biblioteca src/components/sharepoint` → PASS.

- [ ] **Step 5: Commit** — `ARQS="src/app/api/biblioteca/[id]/route.ts src/app/api/biblioteca/[id]/route.test.ts src/app/api/biblioteca/atualizacao/route.ts src/app/api/biblioteca/atualizacao/route.test.ts src/components/sharepoint/atualizacao-sharepoint.tsx src/components/sharepoint/atualizacao-sharepoint.test.tsx"`, `MSG="feat(biblioteca): entrega do arquivo por permissão de área e data da última passada"`.

---

### Task 6: Tabela — versão dos arquivos e leitura da planilha

**Files:**
- Create: `src/lib/tabela-precos/tipos.ts`
- Create: `src/lib/tabela-precos/versao.ts` + `versao.test.ts`
- Create: `src/lib/tabela-precos/planilha.ts` + `planilha.test.ts`

**Interfaces:**
- Produces:
  - `tipos.ts` (sem import de servidor — vai ao navegador): `type Conferencia = 'confere' | 'diverge' | 'fora-do-pdf' | 'alterado-pelo-informativo' | 'sem-pdf'`; `ItemSerializado { codigo; grupo; secoes; descricao; unidade; preco: string | null; sobDemanda: boolean; precoTexto: string | null; conferencia: Conferencia; precoNoPdf: string | null }`; `TabelaSerializada { versao; publicadaEm: string | null; totalItens; divergencias; lidaEm: string; vigente: boolean; arquivos: { planilha: string | null; pdf: string | null; publicacao: string | null; informativo: string | null } }`; `VersaoResumo { versao; publicadaEm: string | null; totalItens; vigente }`; `PrecoMudou { codigo; descricao; antes: string | null; depois: string | null; percentual: number | null }`; `Diferencas { novos: ItemSerializado[]; retirados: ItemSerializado[]; precoMudou: PrecoMudou[] }`.
  - `versao.ts`: `type PapelArquivo = 'planilha' | 'pdf' | 'publicacao' | 'informativo'`; `VersaoTabela { versao: string; ano: number; numero: string; ordem: number }`; `versaoDoNome(nome): VersaoTabela | null`; `numeroDoInformativo(nome): string | null`; `papelDoArquivo(nome): PapelArquivo | null`; `dataDoNome(nome): Date | null`.
  - `planilha.ts`: `ItemLido { grupo; secoes; codigo; descricao; unidade; preco: string | null; sobDemanda: boolean; precoTexto: string | null }`; `lerPlanilhaDePrecos(conteudo: Buffer): Promise<{ aba: string; itens: ItemLido[]; repetidos: string[] } | { erro: string }>`.

- [ ] **Step 1: Testes falhando**

`src/lib/tabela-precos/versao.test.ts`:

```ts
import { dataDoNome, numeroDoInformativo, papelDoArquivo, versaoDoNome } from './versao'

it('versão do nome dos arquivos reais', () => {
  expect(versaoDoNome('Memória de Cálculo 2026 v3.0.xlsx')).toEqual({ versao: '2026 v3.0', ano: 2026, numero: '3.0', ordem: 20260300 })
  expect(versaoDoNome('Tabela de Preços PRODAM-SP 2026 v3.0.pdf')?.versao).toBe('2026 v3.0')
  expect(versaoDoNome('Tabela 2027 v1.pdf')?.versao).toBe('2027 v1.0')
  expect(versaoDoNome('Publicação DOC 21.09.2026.pdf')).toBeNull()
  expect(versaoDoNome('2026 v3.1')!.ordem).toBeGreaterThan(versaoDoNome('2026 v3.0')!.ordem)
  expect(versaoDoNome('2027 v1.0')!.ordem).toBeGreaterThan(versaoDoNome('2026 v9.9')!.ordem)
})

it('o informativo só traz o número da versão', () => {
  expect(numeroDoInformativo('INFORMATIVO Alterações Tabela de Preços v3.0.pdf')).toBe('3.0')
})

it.each([
  ['Memória de Cálculo 2026 v3.0.xlsx', 'planilha'],
  ['Tabela de Preços PRODAM-SP 2026 v3.0.pdf', 'pdf'],
  ['Publicação DOC 21.09.2026.pdf', 'publicacao'],
  ['Publicação + Tabela (DOC 21.09.2026).pdf', 'publicacao'],
  ['INFORMATIVO Alterações Tabela de Preços v3.0.pdf', 'informativo'],
  ['Rascunho.docx', null],
])('papel de %s', (nome, papel) => {
  expect(papelDoArquivo(nome)).toBe(papel)
})

it('data do nome (DOC 21.09.2026)', () => {
  expect(dataDoNome('Publicação DOC 21.09.2026.pdf')).toEqual(new Date(Date.UTC(2026, 8, 21)))
  expect(dataDoNome('sem data.pdf')).toBeNull()
})
```

`src/lib/tabela-precos/planilha.test.ts`:

```ts
/** @jest-environment node */
import ExcelJS from 'exceljs'
import { lerPlanilhaDePrecos } from './planilha'

const CAB = ['GRUPO', 'CÓDIGO', 'DESCRIÇÃO', 'UNIDADE', 'PREÇO UNITÁRIO (R$)', 'QTDE', 'PERÍODO (MÊS)', 'TOTAL (R$)']

async function planilha(linhas: (string | number | null)[][], aba = 'Tabela de Preços 2026 v3'): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet(aba)
  for (const l of linhas) ws.addRow(l)
  return Buffer.from(await wb.xlsx.writeBuffer())
}

it('lê itens, seções em hierarquia e preço como string de 2 casas', async () => {
  const r = await lerPlanilhaDePrecos(
    await planilha([
      ['TABELA DE PREÇOS SERVIÇOS PRODAM-SP 2026 v3.0'],
      ['Vigência a partir da publicação'],
      CAB,
      ['A - SISTEMAS DE INFORMAÇÃO'],
      ['A', '10.050.00065.00', 'ANALISTA DE INFORMAÇÃO (COMPLEXIDADE 1)', 'HORA/HOMEM', 269],
      ['C - SOLUÇÕES DE SERVIÇOS DE COMUNICAÇÃO'],
      ['C3. WIFI GERENCIADO'],
      ['C', '12.055.00013.00', 'INSTALAÇÃO DE PONTO', 'AP', 1234.5],
      ['C7. SD-WAN'],
      ['C7.1. SERVIÇO DE COMUNICAÇÃO DE DADOS – SD-WAN (INSTALAÇÃO)'],
      ['C', '12.070.00001.00', 'INSTALAÇÃO SD-WAN', 'UNIDADE', 369.41],
    ])
  )
  if ('erro' in r) throw new Error(r.erro)
  expect(r.aba).toBe('Tabela de Preços 2026 v3')
  expect(r.itens).toEqual([
    { grupo: 'A', secoes: 'A - SISTEMAS DE INFORMAÇÃO', codigo: '10.050.00065.00', descricao: 'ANALISTA DE INFORMAÇÃO (COMPLEXIDADE 1)', unidade: 'HORA/HOMEM', preco: '269.00', sobDemanda: false, precoTexto: null },
    { grupo: 'C', secoes: 'C - SOLUÇÕES DE SERVIÇOS DE COMUNICAÇÃO > C3. WIFI GERENCIADO', codigo: '12.055.00013.00', descricao: 'INSTALAÇÃO DE PONTO', unidade: 'AP', preco: '1234.50', sobDemanda: false, precoTexto: null },
    { grupo: 'C', secoes: 'C - SOLUÇÕES DE SERVIÇOS DE COMUNICAÇÃO > C7. SD-WAN > C7.1. SERVIÇO DE COMUNICAÇÃO DE DADOS – SD-WAN (INSTALAÇÃO)', codigo: '12.070.00001.00', descricao: 'INSTALAÇÃO SD-WAN', unidade: 'UNIDADE', preco: '369.41', sobDemanda: false, precoTexto: null },
  ])
})

it('"SOB DEMANDA" e texto estranho no preço', async () => {
  const r = await lerPlanilhaDePrecos(
    await planilha([CAB, ['A - SISTEMAS'], ['A', '10.050.00070.00', 'ADICIONAL', 'HORA/HOMEM', 'SOB DEMANDA'], ['A', '10.050.00099.00', 'OUTRO', 'UN', 'A CONSULTAR']])
  )
  if ('erro' in r) throw new Error(r.erro)
  expect(r.itens[0]).toMatchObject({ preco: null, sobDemanda: true, precoTexto: null })
  expect(r.itens[1]).toMatchObject({ preco: null, sobDemanda: false, precoTexto: 'A CONSULTAR' })
})

it('acha a aba pelo cabeçalho, não pelo nome; código repetido fica de fora e é avisado', async () => {
  const wb = new ExcelJS.Workbook()
  wb.addWorksheet('Capa').addRow(['nada aqui'])
  const ws = wb.addWorksheet('Qualquer nome')
  for (const l of [CAB, ['A', '10.050.00065.00', 'X', 'UN', 1], ['A', '10.050.00065.00', 'X de novo', 'UN', 2]]) ws.addRow(l)
  const r = await lerPlanilhaDePrecos(Buffer.from(await wb.xlsx.writeBuffer()))
  if ('erro' in r) throw new Error(r.erro)
  expect(r.aba).toBe('Qualquer nome')
  expect(r.itens).toHaveLength(1)
  expect(r.repetidos).toEqual(['10.050.00065.00'])
})

it('sem o cabeçalho: erro explicando o que faltou', async () => {
  const r = await lerPlanilhaDePrecos(await planilha([['CÓDIGO', 'DESCRIÇÃO'], ['1', '2']]))
  expect(r).toEqual({ erro: 'nenhuma aba com o cabeçalho GRUPO / CÓDIGO / DESCRIÇÃO / UNIDADE / PREÇO UNITÁRIO' })
})
```

- [ ] **Step 2: Rodar e ver falhar** — `npx jest src/lib/tabela-precos` → FAIL (módulos não existem).

- [ ] **Step 3: Implementar**

`src/lib/tabela-precos/tipos.ts`:

```ts
// Tipos da tabela de preços que vão ao navegador (spec docs/superpowers/specs/2026-09-29-tabela-de-precos-design.md).
// Sem import de servidor.

export type Conferencia = 'confere' | 'diverge' | 'fora-do-pdf' | 'alterado-pelo-informativo' | 'sem-pdf'

export interface ItemSerializado {
  codigo: string
  grupo: string
  secoes: string
  descricao: string
  unidade: string
  /** String decimal ("269" ou "269.00"); `null` em "sob demanda" ou preço não lido. */
  preco: string | null
  sobDemanda: boolean
  precoTexto: string | null
  conferencia: Conferencia
  precoNoPdf: string | null
}

export interface TabelaSerializada {
  versao: string
  publicadaEm: string | null
  totalItens: number
  divergencias: number
  lidaEm: string
  vigente: boolean
  /** Ids de ArquivoBiblioteca — abrem em /api/biblioteca/[id]. */
  arquivos: { planilha: string | null; pdf: string | null; publicacao: string | null; informativo: string | null }
}

export interface VersaoResumo {
  versao: string
  publicadaEm: string | null
  totalItens: number
  vigente: boolean
}

export interface PrecoMudou {
  codigo: string
  descricao: string
  antes: string | null
  depois: string | null
  /** Variação em % com uma casa; `null` quando um dos lados não é número. */
  percentual: number | null
}

export interface Diferencas {
  novos: ItemSerializado[]
  retirados: ItemSerializado[]
  precoMudou: PrecoMudou[]
}
```

`src/lib/tabela-precos/versao.ts`:

```ts
// Qual versão e qual papel cada arquivo da pasta TABELA DE PREÇOS PRODAM-SP tem, pelo nome (spec
// 2026-09-29-tabela-de-precos §4.1).

export type PapelArquivo = 'planilha' | 'pdf' | 'publicacao' | 'informativo'

export interface VersaoTabela {
  /** "2026 v3.0" */
  versao: string
  ano: number
  numero: string
  /** ano*10000 + maior*100 + menor — a vigente é a de maior ordem. */
  ordem: number
}

export function versaoDoNome(nome: string): VersaoTabela | null {
  const m = /(\d{4})\s*v(\d+)(?:\.(\d+))?/i.exec(nome)
  if (!m) return null
  const ano = Number(m[1])
  const maior = Number(m[2])
  const menor = Number(m[3] ?? 0)
  return { versao: `${ano} v${maior}.${menor}`, ano, numero: `${maior}.${menor}`, ordem: ano * 10000 + maior * 100 + menor }
}

/** "INFORMATIVO Alterações Tabela de Preços v3.0.pdf" → "3.0" (o informativo não traz o ano no nome). */
export function numeroDoInformativo(nome: string): string | null {
  const m = /v(\d+)(?:\.(\d+))?/i.exec(nome)
  return m ? `${Number(m[1])}.${Number(m[2] ?? 0)}` : null
}

const simples = (nome: string) => nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

export function papelDoArquivo(nome: string): PapelArquivo | null {
  const n = simples(nome)
  if (/^memoria de calculo.*\.xlsx$/.test(n)) return 'planilha'
  if (/^informativo.*\.pdf$/.test(n)) return 'informativo'
  if (/^publicacao.*\.pdf$/.test(n)) return 'publicacao'
  if (/^tabela de precos.*\.pdf$/.test(n)) return 'pdf'
  return null
}

/** "Publicação DOC 21.09.2026.pdf" → 21/09/2026 (UTC, meia-noite). */
export function dataDoNome(nome: string): Date | null {
  const m = /(\d{2})\.(\d{2})\.(\d{4})/.exec(nome)
  if (!m) return null
  const data = new Date(Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1])))
  return data.getUTCDate() === Number(m[1]) ? data : null
}
```

`src/lib/tabela-precos/planilha.ts`:

```ts
import ExcelJS from 'exceljs'

// Itens da "Memória de Cálculo <ano> v<n>.xlsx" (spec 2026-09-29-tabela-de-precos §4.2–4.3). A aba é achada
// pelo cabeçalho, não pelo nome (muda a cada versão). Preço vira string decimal de 2 casas, sem float na
// gravação.

export interface ItemLido {
  grupo: string
  secoes: string
  codigo: string
  descricao: string
  unidade: string
  preco: string | null
  sobDemanda: boolean
  precoTexto: string | null
}

const CODIGO = /^\d{2}\.\d{3}\.\d{5}\.\d{2}$/
const COLUNAS = { grupo: 'GRUPO', codigo: 'CODIGO', descricao: 'DESCRICAO', unidade: 'UNIDADE', preco: 'PRECO UNITARIO' } as const
type Coluna = keyof typeof COLUNAS

const normal = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/\s+/g, ' ').trim()

function texto(valor: ExcelJS.CellValue): string {
  if (valor === null || valor === undefined) return ''
  if (valor instanceof Date) return valor.toISOString()
  if (typeof valor === 'object') {
    if ('richText' in valor) return valor.richText.map((r) => r.text).join('')
    if ('result' in valor) return valor.result === null || valor.result === undefined ? '' : String(valor.result)
    if ('text' in valor) return String(valor.text)
    return ''
  }
  return String(valor)
}

function numero(valor: ExcelJS.CellValue): number | null {
  if (typeof valor === 'number') return valor
  if (valor && typeof valor === 'object' && 'result' in valor && typeof valor.result === 'number') return valor.result
  return null
}

function acharCabecalho(ws: ExcelJS.Worksheet): { linha: number; col: Record<Coluna, number> } | null {
  for (let l = 1; l <= Math.min(ws.rowCount, 30); l++) {
    const row = ws.getRow(l)
    const col: Partial<Record<Coluna, number>> = {}
    for (let c = 1; c <= ws.columnCount; c++) {
      const t = normal(texto(row.getCell(c).value))
      for (const [chave, rotulo] of Object.entries(COLUNAS) as [Coluna, string][]) {
        if (col[chave] === undefined && t.startsWith(rotulo)) col[chave] = c
      }
    }
    if ((Object.keys(COLUNAS) as Coluna[]).every((k) => col[k] !== undefined)) return { linha: l, col: col as Record<Coluna, number> }
  }
  return null
}

/** "A - SISTEMAS…" → 0; "C3. WIFI…" → 1; "C7.1. SERVIÇO…" → 2; outra coisa → null (não é seção). */
function nivelDaSecao(titulo: string): number | null {
  if (/^[A-Z]\s*-\s+\S/.test(titulo)) return 0
  const m = /^[A-Z](\d+(?:\.\d+)*)\.?\s/.exec(titulo)
  return m ? m[1].split('.').length : null
}

export async function lerPlanilhaDePrecos(conteudo: Buffer): Promise<{ aba: string; itens: ItemLido[]; repetidos: string[] } | { erro: string }> {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(conteudo)
  for (const ws of wb.worksheets) {
    const cab = acharCabecalho(ws)
    if (!cab) continue
    const { col } = cab
    const itens: ItemLido[] = []
    const vistos = new Set<string>()
    const repetidos: string[] = []
    const secoes: string[] = []
    for (let l = cab.linha + 1; l <= ws.rowCount; l++) {
      const row = ws.getRow(l)
      const codigo = texto(row.getCell(col.codigo).value).trim()
      if (!CODIGO.test(codigo)) {
        const titulo = texto(row.getCell(col.grupo).value).trim()
        const nivel = titulo ? nivelDaSecao(titulo) : null
        if (nivel !== null) {
          secoes.length = nivel
          secoes[nivel] = titulo
        }
        continue
      }
      if (vistos.has(codigo)) {
        repetidos.push(codigo)
        continue
      }
      vistos.add(codigo)
      const bruto = row.getCell(col.preco).value
      const n = numero(bruto)
      const precoBruto = texto(bruto).trim()
      const sobDemanda = n === null && /SOB\s+DEMANDA/i.test(precoBruto)
      itens.push({
        grupo: texto(row.getCell(col.grupo).value).trim() || (secoes[0]?.[0] ?? ''),
        secoes: secoes.filter(Boolean).join(' > '),
        codigo,
        descricao: texto(row.getCell(col.descricao).value).replace(/\s+/g, ' ').trim(),
        unidade: texto(row.getCell(col.unidade).value).trim(),
        preco: n === null ? null : (Math.round(n * 100) / 100).toFixed(2),
        sobDemanda,
        precoTexto: n === null && !sobDemanda && precoBruto ? precoBruto : null,
      })
    }
    return { aba: ws.name, itens, repetidos }
  }
  return { erro: 'nenhuma aba com o cabeçalho GRUPO / CÓDIGO / DESCRIÇÃO / UNIDADE / PREÇO UNITÁRIO' }
}
```

- [ ] **Step 4: Rodar e ver passar** — `npx jest src/lib/tabela-precos` → PASS.

- [ ] **Step 5: Conferir com a planilha real** (só leitura):

```bash
npx tsx -e "import('./src/lib/tabela-precos/planilha').then(async ({ lerPlanilhaDePrecos }) => { const fs = await import('node:fs'); const r = await lerPlanilhaDePrecos(fs.readFileSync(process.env.USERPROFILE + '/rede.sp/rede.sp - Documentos/TABELA DE PREÇOS PRODAM-SP/Memória de Cálculo 2026 v3.0.xlsx')); if ('erro' in r) throw new Error(r.erro); const g: Record<string, number> = {}; for (const i of r.itens) g[i.grupo] = (g[i.grupo] ?? 0) + 1; console.log(r.aba, r.itens.length, g, r.itens.filter((i) => i.sobDemanda).length, r.repetidos) })"
```

Expected: `Tabela de Preços 2026 v3 315 { A: 7, B: 4, C: 51, E: 158, H: 95 } 8 []`.

- [ ] **Step 6: Commit** — `ARQS="src/lib/tabela-precos/tipos.ts src/lib/tabela-precos/versao.ts src/lib/tabela-precos/versao.test.ts src/lib/tabela-precos/planilha.ts src/lib/tabela-precos/planilha.test.ts"`, `MSG="feat(tabela-precos): versão dos arquivos e leitura da memória de cálculo"`.

---

### Task 7: Tabela — PDF oficial, informativo e conferência

**Files:**
- Create: `src/lib/tabela-precos/pdf.ts` + `pdf.test.ts`
- Create: `src/lib/tabela-precos/conferencia.ts` + `conferencia.test.ts`

**Interfaces:**
- Consumes: `ItemLido` (Task 6), `Conferencia` (Task 6).
- Produces: `textoCorrido(conteudo: Buffer): Promise<string>`; `PrecoNoPdf { preco: string | null; sobDemanda: boolean }`; `precosNoPdf(texto): Map<string, PrecoNoPdf>`; `Informativo { versao: string | null; publicadaEm: Date | null; alteracoes: { tipo: 'preco' | 'novo' | 'retorno'; nome: string }[]; codigos: string[] }`; `lerInformativo(texto): Informativo`; `ItemConferido = ItemLido & { conferencia: Conferencia; precoNoPdf: string | null }`; `conferirItens(itens, precos: Map<string, PrecoNoPdf> | null, informativo: Informativo | null): ItemConferido[]`; `resumoDaConferencia(itens): Record<Conferencia, number>`.

- [ ] **Step 1: Testes falhando** (textos copiados do PDF e do informativo reais, 29/09)

`src/lib/tabela-precos/pdf.test.ts`:

```ts
import { lerInformativo, precosNoPdf } from './pdf'

const TRECHO =
  'A - SISTEMAS DE INFORMAÇÃO CÓDIGO DESCRIÇÃO UNIDADE PREÇO UNITÁRIO (R$) ' +
  '10.050.00065.00 ANALISTA DE INFORMAÇÃO (COMPLEXIDADE 1) HORA/HOMEM 269,00 ' +
  '10.050.00070.00 ANALISTA DE INFORMAÇÃO - ADICIONAL DE SOBREAVISO - 1/3 SOBRE/HORA HORA/HOMEM SOB DEMANDA ' +
  '12.055.00009.00 DISPONIBILIZAÇÃO DE PONTO DE ACESSO WIRELESS - PÚBLICO E CORPORATIVO (PARA CONTRATAÇÕES A PARTIR DE 10.000 AP/CLIENTE/MÊS) AP/MÊS 367,83 ' +
  '14.045.00023.00 VIRTUALIZAÇÃO DE DADOS FAIXA A - CPU TIME 1 A 120 MINUTOS E LOTE DE REGISTROS 1 A 34.000 LOTES PACOTE/MÊS 3.494,93 ' +
  '15.085.00011.00 PLATAFORMA - PDTI - PLANO G ASSINATURA/MÊS 30.063,91 OBSERVAÇÕES (1) UNIDADE DE SERVIÇOS EM NUVEM (USN) 42.696,00'

it('preço é o PRIMEIRO valor em R$ depois do código — nem número da descrição, nem o que vem nas observações', () => {
  const p = precosNoPdf(TRECHO)
  expect(p.get('10.050.00065.00')).toEqual({ preco: '269.00', sobDemanda: false })
  expect(p.get('10.050.00070.00')).toEqual({ preco: null, sobDemanda: true })
  expect(p.get('12.055.00009.00')).toEqual({ preco: '367.83', sobDemanda: false })
  expect(p.get('14.045.00023.00')).toEqual({ preco: '3494.93', sobDemanda: false })
  expect(p.get('15.085.00011.00')).toEqual({ preco: '30063.91', sobDemanda: false })
})

const INFORMATIVO =
  'Tabela de Preços dos Serviços PRODAM Última Versão publicada: 2026 v3.0 Publicação no Diário Oficial: 21/09/2026 ' +
  'Este informativo apresenta alterações ocorridas após a última versão publicada no Diário Oficial. ' +
  'ALTERAÇÃO DE PREÇOS — TID Produto com alteração de preço após a publicação da versão 2026 v3.0. ' +
  'NOVO PRODUTO — SPdf Novo produto incluído após a publicação da versão 2026 v3.0. ' +
  'RETORNO DE ITEM — ELEIÇÃO Item15.062.00008.00 - ELEIÇÃO – DISPONIBILIZAÇÃO DE INFRAESTRUTURA SISTEMA DE VOTAÇÃO Item retornado após exclusão indevida. ' +
  'Informativo Interno Considere a Tabela publicada em conjunto com este informativo até a próxima atualização no Diário Oficial.'

it('informativo: versão, data da publicação, o que mudou e códigos citados (mesmo colados em "Item")', () => {
  expect(lerInformativo(INFORMATIVO)).toEqual({
    versao: '2026 v3.0',
    publicadaEm: new Date(Date.UTC(2026, 8, 21)),
    alteracoes: [
      { tipo: 'preco', nome: 'TID' },
      { tipo: 'novo', nome: 'SPdf' },
      { tipo: 'retorno', nome: 'ELEIÇÃO' },
    ],
    codigos: ['15.062.00008.00'],
  })
})
```

`src/lib/tabela-precos/conferencia.test.ts`:

```ts
import { conferirItens, resumoDaConferencia } from './conferencia'
import type { ItemLido } from './planilha'
import type { Informativo, PrecoNoPdf } from './pdf'

const item = (codigo: string, descricao: string, preco: string | null, extra: Partial<ItemLido> = {}): ItemLido => ({
  grupo: 'E', secoes: 'E - DATA CENTER', codigo, descricao, unidade: 'UN', preco, sobDemanda: false, precoTexto: null, ...extra,
})
const pdf = (pares: [string, string | null, boolean?][]) =>
  new Map<string, PrecoNoPdf>(pares.map(([c, p, s]) => [c, { preco: p, sobDemanda: !!s }]))
const informativo: Informativo = {
  versao: '2026 v3.0',
  publicadaEm: null,
  alteracoes: [{ tipo: 'preco', nome: 'TID' }, { tipo: 'novo', nome: 'SPdf' }],
  codigos: ['15.062.00008.00'],
}

it('confere, diverge, fora do PDF, sob demanda', () => {
  const r = conferirItens(
    [
      item('10.050.00065.00', 'ANALISTA', '269.00'),
      item('11.051.00012.00', 'CONSULTORIA', '369.41'),
      item('99.999.00001.00', 'SÓ NA PLANILHA', '1.00'),
      item('10.050.00070.00', 'ADICIONAL', null, { sobDemanda: true }),
    ],
    pdf([['10.050.00065.00', '269.00'], ['11.051.00012.00', '370.00'], ['10.050.00070.00', null, true]]),
    null
  )
  expect(r.map((i) => [i.codigo, i.conferencia, i.precoNoPdf])).toEqual([
    ['10.050.00065.00', 'confere', '269.00'],
    ['11.051.00012.00', 'diverge', '370.00'],
    ['99.999.00001.00', 'fora-do-pdf', null],
    ['10.050.00070.00', 'confere', null],
  ])
})

it('o informativo explica a diferença: pelo nome do produto (palavra inteira) ou pelo código', () => {
  const r = conferirItens(
    [
      item('14.052.00001.00', 'TID CORPORATIVO ATÉ 4000', '4.09'),
      item('15.075.00032.00', 'SPdf - PLANO BRONZE ATÉ 400 DOCUMENTOS/MÊS', '100.00'),
      item('15.062.00008.00', 'ELEIÇÃO - DISPONIBILIZAÇÃO DE INFRAESTRUTURA', '5.00'),
      item('14.000.00001.00', 'SERVIÇO NO SENTIDO AMPLO', '9.99'),
    ],
    pdf([['14.052.00001.00', '0.50'], ['14.000.00001.00', '1.00']]),
    informativo
  )
  expect(r.map((i) => i.conferencia)).toEqual(['alterado-pelo-informativo', 'alterado-pelo-informativo', 'alterado-pelo-informativo', 'diverge'])
})

it('sem PDF oficial: nada é conferido', () => {
  expect(conferirItens([item('10.050.00065.00', 'A', '1.00')], null, null)[0].conferencia).toBe('sem-pdf')
})

it('resumo por tipo', () => {
  const r = conferirItens([item('1', 'A', '1.00'), item('2', 'B', '2.00')], pdf([['1', '1.00']]), null)
  expect(resumoDaConferencia(r)).toEqual({ confere: 1, diverge: 0, 'fora-do-pdf': 1, 'alterado-pelo-informativo': 0, 'sem-pdf': 0 })
})
```

- [ ] **Step 2: Rodar e ver falhar** — `npx jest src/lib/tabela-precos/pdf.test.ts src/lib/tabela-precos/conferencia.test.ts` → FAIL.

- [ ] **Step 3: Implementar**

`src/lib/tabela-precos/pdf.ts`:

```ts
import { getDocumentProxy } from 'unpdf'

// Texto do PDF oficial da tabela e do informativo (spec 2026-09-29-tabela-de-precos §4.4). O PDF é a
// referência publicada no DOC; a planilha é a fonte estruturada que ele confere.

/** Todas as páginas, espaços normalizados. */
export async function textoCorrido(conteudo: Buffer): Promise<string> {
  const pdf = await getDocumentProxy(new Uint8Array(conteudo))
  const partes: string[] = []
  for (let p = 1; p <= pdf.numPages; p++) {
    const c = await (await pdf.getPage(p)).getTextContent()
    partes.push(c.items.map((i) => ('str' in i ? i.str : '')).join(' '))
  }
  await pdf.cleanup?.()
  return partes.join(' ').replace(/\s+/g, ' ').trim()
}

const CODIGO_SERVICO = /(?<!\d)\d{2}\.\d{3}\.\d{5}\.\d{2}(?!\d)/g
const PRECO = /(?<![\d.,])(\d{1,3}(?:\.\d{3})*,\d{2})(?!\d)/
const decimal = (brasileiro: string) => brasileiro.replace(/\./g, '').replace(',', '.')

export interface PrecoNoPdf {
  preco: string | null
  sobDemanda: boolean
}

/** Código → preço: o trecho vai do código até o próximo código; vale o PRIMEIRO valor em R$ (ou "SOB
 *  DEMANDA", o que vier antes). Número de descrição ("10.000 AP") não tem centavos e não casa; o que vem
 *  depois (observações da seção) fica depois do primeiro preço. Primeiro código repetido vence. */
export function precosNoPdf(texto: string): Map<string, PrecoNoPdf> {
  const t = texto.replace(/\s+/g, ' ')
  const achados = [...t.matchAll(CODIGO_SERVICO)]
  const mapa = new Map<string, PrecoNoPdf>()
  achados.forEach((m, i) => {
    if (mapa.has(m[0])) return
    const inicio = m.index! + m[0].length
    const trecho = t.slice(inicio, i + 1 < achados.length ? achados[i + 1].index : t.length)
    const preco = PRECO.exec(trecho)
    const sob = /SOB\s+DEMANDA/i.exec(trecho)
    const sobDemanda = !!sob && (!preco || sob.index < preco.index)
    mapa.set(m[0], { preco: sobDemanda || !preco ? null : decimal(preco[1]), sobDemanda })
  })
  return mapa
}

export interface Informativo {
  versao: string | null
  publicadaEm: Date | null
  alteracoes: { tipo: 'preco' | 'novo' | 'retorno'; nome: string }[]
  codigos: string[]
}

const TIPO_ALTERACAO: Record<string, 'preco' | 'novo' | 'retorno'> = { ALTERACAO: 'preco', NOVO: 'novo', RETORNO: 'retorno' }

export function lerInformativo(texto: string): Informativo {
  const t = texto.replace(/\s+/g, ' ')
  const versao = /[ÚU]ltima Vers[ãa]o publicada:\s*(\d{4})\s*v(\d+(?:\.\d+)?)/i.exec(t)
  const data = /Publica[çc][ãa]o no Di[áa]rio Oficial:\s*(\d{2})\/(\d{2})\/(\d{4})/i.exec(t)
  const alteracoes = [...t.matchAll(/(ALTERA[ÇC][ÃA]O DE PRE[ÇC]OS|NOVO PRODUTO|RETORNO DE ITEM)\s*[—–-]\s*(\S+)/gi)].map((m) => ({
    tipo: TIPO_ALTERACAO[m[1].normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().split(' ')[0]],
    nome: m[2],
  }))
  return {
    versao: versao ? `${versao[1]} v${versao[2]}` : null,
    publicadaEm: data ? new Date(Date.UTC(Number(data[3]), Number(data[2]) - 1, Number(data[1]))) : null,
    alteracoes,
    codigos: [...new Set([...t.matchAll(CODIGO_SERVICO)].map((m) => m[0]))],
  }
}
```

`src/lib/tabela-precos/conferencia.ts`:

```ts
import type { Conferencia } from './tipos'
import type { ItemLido } from './planilha'
import type { Informativo, PrecoNoPdf } from './pdf'

// Cada item da planilha contra o PDF publicado (spec 2026-09-29-tabela-de-precos §4.4). Nunca escolhe um
// preço em silêncio: o que não bate fica marcado e a tela mostra os dois.

export type ItemConferido = ItemLido & { conferencia: Conferencia; precoNoPdf: string | null }

const centavos = (valor: string) => Math.round(Number(valor) * 100)
const normal = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()
const escapar = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function citadoNoInformativo(item: ItemLido, informativo: Informativo | null): boolean {
  if (!informativo) return false
  if (informativo.codigos.includes(item.codigo)) return true
  const descricao = normal(item.descricao)
  return informativo.alteracoes.some(({ nome }) => new RegExp(`(^|[^A-Z0-9])${escapar(normal(nome))}([^A-Z0-9]|$)`).test(descricao))
}

export function conferirItens(itens: ItemLido[], precos: Map<string, PrecoNoPdf> | null, informativo: Informativo | null): ItemConferido[] {
  return itens.map((item) => {
    if (!precos) return { ...item, conferencia: 'sem-pdf', precoNoPdf: null }
    const noPdf = precos.get(item.codigo)
    const citado = citadoNoInformativo(item, informativo)
    if (!noPdf) return { ...item, conferencia: citado ? 'alterado-pelo-informativo' : 'fora-do-pdf', precoNoPdf: null }
    const iguais = item.sobDemanda
      ? noPdf.sobDemanda
      : !noPdf.sobDemanda && item.preco !== null && noPdf.preco !== null && centavos(item.preco) === centavos(noPdf.preco)
    return {
      ...item,
      conferencia: iguais ? 'confere' : citado ? 'alterado-pelo-informativo' : 'diverge',
      precoNoPdf: noPdf.preco,
    }
  })
}

export function resumoDaConferencia(itens: ItemConferido[]): Record<Conferencia, number> {
  const resumo: Record<Conferencia, number> = { confere: 0, diverge: 0, 'fora-do-pdf': 0, 'alterado-pelo-informativo': 0, 'sem-pdf': 0 }
  for (const i of itens) resumo[i.conferencia]++
  return resumo
}
```

- [ ] **Step 4: Rodar e ver passar** — `npx jest src/lib/tabela-precos` → PASS.

- [ ] **Step 5: Commit** — `ARQS="src/lib/tabela-precos/pdf.ts src/lib/tabela-precos/pdf.test.ts src/lib/tabela-precos/conferencia.ts src/lib/tabela-precos/conferencia.test.ts"`, `MSG="feat(tabela-precos): conferência da planilha com o PDF publicado e o informativo"`.

---

### Task 8: Tabela — leitor da área e carga no dev

**Files:**
- Create: `src/lib/tabela-precos/leitor.ts` + `leitor.test.ts`
- Modify: `src/lib/biblioteca/registro-leitores.ts` (`TABELA_PRECOS: lerTabelaDePrecos`)

**Interfaces:**
- Consumes: Tasks 2, 6 e 7.
- Produces: `ConjuntoDaVersao { versao: VersaoTabela; planilha: ArquivoDaArea; pdf?; publicacao?; informativo? }`; `agruparPorVersao(todos: ArquivoDaArea[]): ConjuntoDaVersao[]` (mais nova primeiro); `criarLeitorDaTabela(deps: { lerPlanilha: typeof lerPlanilhaDePrecos; textoDoPdf: (b: Buffer) => Promise<string>; agora: () => Date }): LeitorDeArea`; `lerTabelaDePrecos: LeitorDeArea`. Linha do log: `tabela de preços <versão>: <n> serviços · conferem <a> · alterados pelo informativo <b> · fora do PDF <c> · divergem <d>`.

- [ ] **Step 1: Teste falhando** — `src/lib/tabela-precos/leitor.test.ts`:

```ts
/** @jest-environment node */
jest.mock('@/lib/prisma', () => ({ prisma: {} }))

import type { ArquivoDaArea } from '@/lib/biblioteca/leitores'
import { agruparPorVersao, criarLeitorDaTabela } from './leitor'

/* eslint-disable @typescript-eslint/no-explicit-any */

const arq = (id: string, nome: string): ArquivoDaArea => ({ id, nome, caminho: `TABELA DE PREÇOS PRODAM-SP/${nome}`, extensao: nome.split('.').pop()!, sha256: id, modificadoEm: new Date() })
const PASTA = [
  arq('p', 'Memória de Cálculo 2026 v3.0.xlsx'),
  arq('t', 'Tabela de Preços PRODAM-SP 2026 v3.0.pdf'),
  arq('pub', 'Publicação DOC 21.09.2026.pdf'),
  arq('pubt', 'Publicação + Tabela (DOC 21.09.2026).pdf'),
  arq('i', 'INFORMATIVO Alterações Tabela de Preços v3.0.pdf'),
]

it('agrupa por versão: publicação sem "Tabela" no nome e informativo pelo número', () => {
  const [c, ...resto] = agruparPorVersao([...PASTA, arq('p2', 'Memória de Cálculo 2025 v7.0.xlsx')])
  expect(c.versao.versao).toBe('2026 v3.0')
  expect([c.planilha.id, c.pdf?.id, c.publicacao?.id, c.informativo?.id]).toEqual(['p', 't', 'pub', 'i'])
  expect(resto.map((x) => x.versao.versao)).toEqual(['2025 v7.0'])
  expect(resto[0].publicacao).toBeUndefined()
})

function prismaFake() {
  const tx = {
    tabelaPrecos: { upsert: jest.fn(async () => ({ id: 'tab1' })) },
    itemTabelaPrecos: { deleteMany: jest.fn(), createMany: jest.fn() },
  }
  return {
    tx,
    $transaction: jest.fn(async (fn: any) => fn(tx)),
    arquivoBiblioteca: { updateMany: jest.fn() },
  }
}

const lerPlanilha = jest.fn(async () => ({
  aba: 'Tabela',
  repetidos: [],
  itens: [
    { grupo: 'A', secoes: 'A - SISTEMAS', codigo: '10.050.00065.00', descricao: 'ANALISTA', unidade: 'HORA/HOMEM', preco: '269.00', sobDemanda: false, precoTexto: null },
    { grupo: 'E', secoes: 'E - DATA CENTER', codigo: '14.052.00001.00', descricao: 'TID CORPORATIVO', unidade: 'DOC', preco: '4.09', sobDemanda: false, precoTexto: null },
  ],
}))
const textoDoPdf = jest.fn(async (b: Buffer) =>
  b.toString() === 'pdf-tabela'
    ? '10.050.00065.00 ANALISTA HORA/HOMEM 269,00 14.052.00001.00 TID CORPORATIVO DOC 0,50'
    : 'Última Versão publicada: 2026 v3.0 Publicação no Diário Oficial: 21/09/2026 ALTERAÇÃO DE PREÇOS — TID Produto'
)
const ler = async (a: ArquivoDaArea) => Buffer.from(a.id === 't' ? 'pdf-tabela' : a.id === 'i' ? 'pdf-informativo' : 'xlsx')
const agora = () => new Date('2026-09-29T13:00:00Z')

it('grava a versão com os itens conferidos e devolve a linha do log', async () => {
  const prisma = prismaFake()
  const linha = await criarLeitorDaTabela({ lerPlanilha, textoDoPdf, agora })({ prisma: prisma as any, todos: PASTA, mudados: ['p'], ler })
  expect(linha).toBe('tabela de preços 2026 v3.0: 2 serviços · conferem 1 · alterados pelo informativo 1 · fora do PDF 0 · divergem 0')
  expect(prisma.tx.tabelaPrecos.upsert).toHaveBeenCalledWith(expect.objectContaining({
    where: { versao: '2026 v3.0' },
    update: expect.objectContaining({ ordem: 20260300, publicadaEm: new Date(Date.UTC(2026, 8, 21)), arquivoPlanilhaId: 'p', arquivoPdfId: 't', arquivoPublicacaoId: 'pub', arquivoInformativoId: 'i', totalItens: 2, divergencias: 0 }),
  }))
  expect(prisma.tx.itemTabelaPrecos.deleteMany).toHaveBeenCalledWith({ where: { tabelaId: 'tab1' } })
  expect(prisma.tx.itemTabelaPrecos.createMany).toHaveBeenCalledWith({ data: [
    expect.objectContaining({ tabelaId: 'tab1', posicao: 0, codigo: '10.050.00065.00', preco: '269.00', conferencia: 'confere', precoNoPdf: '269.00' }),
    expect.objectContaining({ tabelaId: 'tab1', posicao: 1, codigo: '14.052.00001.00', preco: '4.09', conferencia: 'alterado-pelo-informativo', precoNoPdf: '0.50' }),
  ] })
  expect(prisma.arquivoBiblioteca.updateMany).toHaveBeenCalledWith({ where: { id: { in: ['p', 't', 'pub', 'i'] } }, data: { leituraStatus: 'ok', leituraMensagem: null, lidoEm: agora() } })
})

it('sem planilha na pasta: avisa e não grava', async () => {
  const prisma = prismaFake()
  const linha = await criarLeitorDaTabela({ lerPlanilha, textoDoPdf, agora })({ prisma: prisma as any, todos: PASTA.slice(1), mudados: [], ler })
  expect(linha).toBe('tabela de preços: nenhuma "Memória de Cálculo <ano> v<n>.xlsx" na pasta — nada lido')
  expect(prisma.$transaction).not.toHaveBeenCalled()
})

it('planilha ilegível: marca o arquivo com erro e a versão anterior continua valendo', async () => {
  const prisma = prismaFake()
  const linha = await criarLeitorDaTabela({ lerPlanilha: async () => ({ erro: 'sem cabeçalho' }), textoDoPdf, agora })({ prisma: prisma as any, todos: PASTA, mudados: ['p'], ler })
  expect(linha).toBe('tabela de preços 2026 v3.0: planilha não lida — sem cabeçalho')
  expect(prisma.$transaction).not.toHaveBeenCalled()
  expect(prisma.arquivoBiblioteca.updateMany).toHaveBeenCalledWith({ where: { id: { in: ['p'] } }, data: { leituraStatus: 'erro', leituraMensagem: 'sem cabeçalho', lidoEm: agora() } })
})
```

- [ ] **Step 2: Rodar e ver falhar** — `npx jest src/lib/tabela-precos/leitor.test.ts` → FAIL.

- [ ] **Step 3: Implementar** — `src/lib/tabela-precos/leitor.ts`:

```ts
import type { PrismaClient } from '@prisma/client'
import type { ArquivoDaArea, LeitorDeArea } from '@/lib/biblioteca/leitores'
import { conferirItens, resumoDaConferencia } from './conferencia'
import { lerInformativo, precosNoPdf, textoCorrido } from './pdf'
import { lerPlanilhaDePrecos } from './planilha'
import { dataDoNome, numeroDoInformativo, papelDoArquivo, versaoDoNome, type VersaoTabela } from './versao'

// Leitor da área TABELA_PRECOS da biblioteca Documentos (spec 2026-09-29-tabela-de-precos §4–5): uma versão
// = planilha + PDF oficial + publicação + informativo. Relê todas as versões a cada mudança na pasta (são
// uma ou duas; é barato e fica sempre igual ao que está lá).

export interface ConjuntoDaVersao {
  versao: VersaoTabela
  planilha: ArquivoDaArea
  pdf?: ArquivoDaArea
  publicacao?: ArquivoDaArea
  informativo?: ArquivoDaArea
}

/** Mais nova primeiro. Só vira versão o que tem planilha (a fonte estruturada). */
export function agruparPorVersao(todos: ArquivoDaArea[]): ConjuntoDaVersao[] {
  const conjuntos = new Map<string, ConjuntoDaVersao>()
  for (const a of todos) {
    const v = papelDoArquivo(a.nome) === 'planilha' ? versaoDoNome(a.nome) : null
    if (v) conjuntos.set(v.versao, { versao: v, planilha: a })
  }
  const lista = [...conjuntos.values()].sort((x, y) => y.versao.ordem - x.versao.ordem)
  for (const a of todos) {
    const papel = papelDoArquivo(a.nome)
    if (papel === 'pdf') {
      const v = versaoDoNome(a.nome)
      const c = v ? conjuntos.get(v.versao) : undefined
      if (c) c.pdf = a
    } else if (papel === 'informativo') {
      const numero = numeroDoInformativo(a.nome)
      const c = lista.find((x) => x.versao.numero === numero)
      if (c) c.informativo = a
    }
  }
  // A publicação no DOC não traz a versão no nome: fica com a mais nova; a sem "Tabela" no nome ganha.
  const publicacoes = todos.filter((a) => papelDoArquivo(a.nome) === 'publicacao')
  if (lista[0] && publicacoes.length > 0) lista[0].publicacao = publicacoes.find((p) => !/tabela/i.test(p.nome)) ?? publicacoes[0]
  return lista
}

interface Deps {
  lerPlanilha: typeof lerPlanilhaDePrecos
  textoDoPdf: (conteudo: Buffer) => Promise<string>
  agora: () => Date
}

const arquivosDo = (c: ConjuntoDaVersao) => [c.planilha, c.pdf, c.publicacao, c.informativo].filter((a): a is ArquivoDaArea => !!a)

async function marcar(prisma: PrismaClient, arquivos: ArquivoDaArea[], status: 'ok' | 'erro', mensagem: string | null, agora: Date) {
  await prisma.arquivoBiblioteca.updateMany({
    where: { id: { in: arquivos.map((a) => a.id) } },
    data: { leituraStatus: status, leituraMensagem: mensagem, lidoEm: agora },
  })
}

async function lerVersao(prisma: PrismaClient, c: ConjuntoDaVersao, ler: (a: ArquivoDaArea) => Promise<Buffer>, deps: Deps): Promise<string> {
  const agora = deps.agora()
  const planilha = await deps.lerPlanilha(await ler(c.planilha))
  if ('erro' in planilha) {
    await marcar(prisma, [c.planilha], 'erro', planilha.erro, agora)
    return `tabela de preços ${c.versao.versao}: planilha não lida — ${planilha.erro}`
  }
  const precos = c.pdf ? precosNoPdf(await deps.textoDoPdf(await ler(c.pdf))) : null
  const informativo = c.informativo ? lerInformativo(await deps.textoDoPdf(await ler(c.informativo))) : null
  const itens = conferirItens(planilha.itens, precos, informativo)
  const resumo = resumoDaConferencia(itens)
  const dados = {
    ano: c.versao.ano,
    numero: c.versao.numero,
    ordem: c.versao.ordem,
    publicadaEm: informativo?.publicadaEm ?? (c.publicacao ? dataDoNome(c.publicacao.nome) : null),
    arquivoPlanilhaId: c.planilha.id,
    arquivoPdfId: c.pdf?.id ?? null,
    arquivoPublicacaoId: c.publicacao?.id ?? null,
    arquivoInformativoId: c.informativo?.id ?? null,
    totalItens: itens.length,
    divergencias: resumo.diverge,
    lidaEm: agora,
  }
  await prisma.$transaction(async (tx) => {
    const tabela = await tx.tabelaPrecos.upsert({ where: { versao: c.versao.versao }, create: { versao: c.versao.versao, ...dados }, update: dados })
    await tx.itemTabelaPrecos.deleteMany({ where: { tabelaId: tabela.id } })
    await tx.itemTabelaPrecos.createMany({
      data: itens.map((i, posicao) => ({
        tabelaId: tabela.id, posicao, grupo: i.grupo, secoes: i.secoes, codigo: i.codigo, descricao: i.descricao, unidade: i.unidade,
        preco: i.preco, sobDemanda: i.sobDemanda, precoTexto: i.precoTexto, conferencia: i.conferencia, precoNoPdf: i.precoNoPdf,
      })),
    })
  })
  await marcar(prisma, arquivosDo(c), 'ok', null, agora)
  const extra = [
    planilha.repetidos.length ? `códigos repetidos ignorados: ${planilha.repetidos.join(', ')}` : '',
    c.pdf ? '' : 'SEM PDF oficial para conferir',
  ].filter(Boolean)
  return `tabela de preços ${c.versao.versao}: ${itens.length} serviços · conferem ${resumo.confere} · alterados pelo informativo ${resumo['alterado-pelo-informativo']} · fora do PDF ${resumo['fora-do-pdf']} · divergem ${resumo.diverge}${extra.length ? ` · ${extra.join(' · ')}` : ''}`
}

export function criarLeitorDaTabela(deps: Deps): LeitorDeArea {
  return async ({ prisma, todos, ler }) => {
    const versoes = agruparPorVersao(todos)
    if (versoes.length === 0) return 'tabela de preços: nenhuma "Memória de Cálculo <ano> v<n>.xlsx" na pasta — nada lido'
    const linhas: string[] = []
    for (const c of versoes) {
      try {
        linhas.push(await lerVersao(prisma, c, ler, deps))
      } catch (erro) {
        const mensagem = (erro instanceof Error ? erro.message : String(erro)).slice(0, 500)
        await marcar(prisma, arquivosDo(c), 'erro', mensagem, deps.agora())
        linhas.push(`tabela de preços ${c.versao.versao}: falhou — ${mensagem}`)
      }
    }
    return linhas.join('\n  ')
  }
}

export const lerTabelaDePrecos: LeitorDeArea = criarLeitorDaTabela({ lerPlanilha: lerPlanilhaDePrecos, textoDoPdf: textoCorrido, agora: () => new Date() })
```

Em `src/lib/biblioteca/registro-leitores.ts`: `import { lerTabelaDePrecos } from '@/lib/tabela-precos/leitor'` e `export const LEITORES: Partial<Record<AreaBiblioteca, LeitorDeArea>> = { TABELA_PRECOS: lerTabelaDePrecos }`.

- [ ] **Step 4: Rodar e ver passar** — `npx jest src/lib/tabela-precos src/lib/biblioteca` → PASS; `npx tsc --noEmit` limpo.

- [ ] **Step 5: Carga real no dev** — primeira passada grava os 904 arquivos no R2 (demora: o OneDrive baixa cada um na hora):

```bash
npx dotenv -e .env.development -- npx tsx scripts/sincronizar-sharepoint.ts --aplicar
```

Expected no fim do log:
```
biblioteca Documentos: 904 arquivo(s) · novos 904 · mudados 0 · iguais 0 · removidos 0
  tabela de preços 2026 v3.0: 315 serviços · conferem 308 · alterados pelo informativo 7 · fora do PDF 0 · divergem 0
  conferência: TUDO NO VERAI
  data das telas: atualizada
```
Número de arquivos diferente do esperado é normal se a pasta mudou; **a linha da tabela tem de bater**. Se não bater, investigar (não ajustar número no olho). Rodar de novo: `iguais 904`, nenhuma leitura. `--reler=TABELA_PRECOS` relê sem baixar nada novo.

- [ ] **Step 6: Commit** — `ARQS="src/lib/tabela-precos/leitor.ts src/lib/tabela-precos/leitor.test.ts src/lib/biblioteca/registro-leitores.ts"`, `MSG="feat(tabela-precos): leitor da pasta da tabela de preços no agendador"`.

---

### Task 9: API da tabela de preços

**Files:**
- Create: `src/lib/tabela-precos/diferencas.ts` + `diferencas.test.ts`
- Create: `src/lib/tabela-precos/consultas.ts`
- Create: `src/app/api/tabela-precos/route.ts` + `route.test.ts`
- Create: `src/app/api/tabela-precos/versoes/route.ts`
- Create: `src/app/api/tabela-precos/diferencas/route.ts`

**Interfaces:**
- Consumes: tipos da Task 6.
- Produces: `diferencasEntreVersoes(antes: ItemSerializado[], depois: ItemSerializado[]): Diferencas`; `carregarTabela(versao?: string): Promise<{ tabela: TabelaSerializada; itens: ItemSerializado[] } | null>`; `listarVersoes(): Promise<VersaoResumo[]>`; rotas `GET /api/tabela-precos[?versao=]` → `{ tabela: TabelaSerializada | null, itens: ItemSerializado[] }`, `GET /api/tabela-precos/versoes` → `VersaoResumo[]`, `GET /api/tabela-precos/diferencas?de=&para=` → `Diferencas` (400 sem os dois, 404 versão inexistente).

- [ ] **Step 1: Testes falhando**

`src/lib/tabela-precos/diferencas.test.ts`:

```ts
import { diferencasEntreVersoes } from './diferencas'
import type { ItemSerializado } from './tipos'

const i = (codigo: string, preco: string | null, sobDemanda = false): ItemSerializado => ({
  codigo, grupo: 'A', secoes: 'A', descricao: `Serviço ${codigo}`, unidade: 'UN', preco, sobDemanda, precoTexto: null, conferencia: 'confere', precoNoPdf: preco,
})

it('novos, retirados e preço que mudou (com %) — "269" e "269.00" são o mesmo preço', () => {
  const d = diferencasEntreVersoes(
    [i('1', '100.00'), i('2', '269'), i('3', '50.00'), i('4', null, true)],
    [i('1', '110.00'), i('2', '269.00'), i('5', '10.00'), i('4', '80.00')]
  )
  expect(d.novos.map((x) => x.codigo)).toEqual(['5'])
  expect(d.retirados.map((x) => x.codigo)).toEqual(['3'])
  expect(d.precoMudou).toEqual([
    { codigo: '1', descricao: 'Serviço 1', antes: '100.00', depois: '110.00', percentual: 10 },
    { codigo: '4', descricao: 'Serviço 4', antes: null, depois: '80.00', percentual: null },
  ])
})
```

`src/app/api/tabela-precos/route.test.ts`:

```ts
/** @jest-environment node */
import { NextRequest } from 'next/server'

jest.mock('@/lib/auth', () => ({ ...jest.requireActual('@/lib/auth'), getAuthUser: jest.fn() }))
jest.mock('@/lib/tabela-precos/consultas', () => ({ carregarTabela: jest.fn(), listarVersoes: jest.fn() }))

import { getAuthUser } from '@/lib/auth'
import { carregarTabela } from '@/lib/tabela-precos/consultas'
import { GET } from './route'
import { GET as GETdiferencas } from './diferencas/route'

const logado = () => (getAuthUser as jest.Mock).mockResolvedValue({ id: 'u1', nome: 'A', email: 'a@x', role: 'uploader' })

it('401 sem usuário', async () => {
  ;(getAuthUser as jest.Mock).mockResolvedValue(null)
  expect((await GET(new NextRequest('http://localhost/api/tabela-precos'))).status).toBe(401)
})

it('vigente por padrão; ?versao= escolhe; sem tabela lida devolve tabela null', async () => {
  logado()
  ;(carregarTabela as jest.Mock).mockResolvedValueOnce({ tabela: { versao: '2026 v3.0' }, itens: [{ codigo: '1' }] })
  await expect((await GET(new NextRequest('http://localhost/api/tabela-precos'))).json()).resolves.toEqual({ tabela: { versao: '2026 v3.0' }, itens: [{ codigo: '1' }] })
  expect(carregarTabela).toHaveBeenLastCalledWith(undefined)
  ;(carregarTabela as jest.Mock).mockResolvedValueOnce(null)
  await expect((await GET(new NextRequest('http://localhost/api/tabela-precos?versao=2025%20v1.0'))).json()).resolves.toEqual({ tabela: null, itens: [] })
  expect(carregarTabela).toHaveBeenLastCalledWith('2025 v1.0')
})

it('diferenças: 400 sem as duas versões, 404 quando uma não existe', async () => {
  logado()
  expect((await GETdiferencas(new NextRequest('http://localhost/api/tabela-precos/diferencas?de=a'))).status).toBe(400)
  ;(carregarTabela as jest.Mock).mockResolvedValueOnce({ tabela: {}, itens: [] }).mockResolvedValueOnce(null)
  expect((await GETdiferencas(new NextRequest('http://localhost/api/tabela-precos/diferencas?de=a&para=b'))).status).toBe(404)
})
```

- [ ] **Step 2: Rodar e ver falhar** — `npx jest src/lib/tabela-precos/diferencas.test.ts src/app/api/tabela-precos` → FAIL.

- [ ] **Step 3: Implementar**

`src/lib/tabela-precos/diferencas.ts`:

```ts
import type { Diferencas, ItemSerializado, PrecoMudou } from './tipos'

// "O que mudou" entre duas versões da tabela (spec 2026-09-29-tabela-de-precos §6), por código.

const centavos = (valor: string | null) => (valor === null ? null : Math.round(Number(valor) * 100))

export function diferencasEntreVersoes(antes: ItemSerializado[], depois: ItemSerializado[]): Diferencas {
  const porCodigo = new Map(antes.map((i) => [i.codigo, i]))
  const codigosDepois = new Set(depois.map((i) => i.codigo))
  const precoMudou: PrecoMudou[] = []
  const novos: ItemSerializado[] = []
  for (const d of depois) {
    const a = porCodigo.get(d.codigo)
    if (!a) {
      novos.push(d)
      continue
    }
    const ca = a.sobDemanda ? null : centavos(a.preco)
    const cd = d.sobDemanda ? null : centavos(d.preco)
    if (ca === cd && a.sobDemanda === d.sobDemanda) continue
    precoMudou.push({
      codigo: d.codigo,
      descricao: d.descricao,
      antes: a.sobDemanda ? null : a.preco,
      depois: d.sobDemanda ? null : d.preco,
      percentual: ca && cd ? Math.round((cd / ca - 1) * 1000) / 10 : null,
    })
  }
  return { novos, retirados: antes.filter((a) => !codigosDepois.has(a.codigo)), precoMudou }
}
```

`src/lib/tabela-precos/consultas.ts`:

```ts
import type { ItemTabelaPrecos, TabelaPrecos } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import type { Conferencia, ItemSerializado, TabelaSerializada, VersaoResumo } from './tipos'

// Consultas da tabela de preços para as rotas e o assistente. A vigente é a de maior `ordem`.

function serializarTabela(t: TabelaPrecos, vigente: boolean): TabelaSerializada {
  return {
    versao: t.versao,
    publicadaEm: t.publicadaEm?.toISOString() ?? null,
    totalItens: t.totalItens,
    divergencias: t.divergencias,
    lidaEm: t.lidaEm.toISOString(),
    vigente,
    arquivos: { planilha: t.arquivoPlanilhaId, pdf: t.arquivoPdfId, publicacao: t.arquivoPublicacaoId, informativo: t.arquivoInformativoId },
  }
}

export function serializarItem(i: ItemTabelaPrecos): ItemSerializado {
  return {
    codigo: i.codigo,
    grupo: i.grupo,
    secoes: i.secoes,
    descricao: i.descricao,
    unidade: i.unidade,
    preco: i.preco?.toString() ?? null,
    sobDemanda: i.sobDemanda,
    precoTexto: i.precoTexto,
    conferencia: i.conferencia as Conferencia,
    precoNoPdf: i.precoNoPdf?.toString() ?? null,
  }
}

export async function carregarTabela(versao?: string): Promise<{ tabela: TabelaSerializada; itens: ItemSerializado[] } | null> {
  const [tabela, vigente] = await Promise.all([
    versao ? prisma.tabelaPrecos.findUnique({ where: { versao } }) : prisma.tabelaPrecos.findFirst({ orderBy: { ordem: 'desc' } }),
    prisma.tabelaPrecos.findFirst({ orderBy: { ordem: 'desc' }, select: { id: true } }),
  ])
  if (!tabela) return null
  const itens = await prisma.itemTabelaPrecos.findMany({ where: { tabelaId: tabela.id }, orderBy: { posicao: 'asc' } })
  return { tabela: serializarTabela(tabela, tabela.id === vigente?.id), itens: itens.map(serializarItem) }
}

export async function listarVersoes(): Promise<VersaoResumo[]> {
  const tabelas = await prisma.tabelaPrecos.findMany({ orderBy: { ordem: 'desc' }, select: { versao: true, publicadaEm: true, totalItens: true } })
  return tabelas.map((t, i) => ({ versao: t.versao, publicadaEm: t.publicadaEm?.toISOString() ?? null, totalItens: t.totalItens, vigente: i === 0 }))
}
```

`src/app/api/tabela-precos/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { carregarTabela } from '@/lib/tabela-precos/consultas'

// Tabela de preços (spec 2026-09-29-tabela-de-precos §7): pública para quem está logado — publicada no DOC.
// ~315 itens: busca e filtro são no navegador.
export async function GET(request: NextRequest) {
  const usuario = await getAuthUser(request)
  if (!usuario) return NextResponse.json({ error: 'não autenticado' }, { status: 401 })
  const versao = request.nextUrl.searchParams.get('versao') ?? undefined
  const carregada = await carregarTabela(versao)
  return NextResponse.json(carregada ?? { tabela: null, itens: [] })
}
```

`src/app/api/tabela-precos/versoes/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { listarVersoes } from '@/lib/tabela-precos/consultas'

export async function GET(request: NextRequest) {
  const usuario = await getAuthUser(request)
  if (!usuario) return NextResponse.json({ error: 'não autenticado' }, { status: 401 })
  return NextResponse.json(await listarVersoes())
}
```

`src/app/api/tabela-precos/diferencas/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { carregarTabela } from '@/lib/tabela-precos/consultas'
import { diferencasEntreVersoes } from '@/lib/tabela-precos/diferencas'

export async function GET(request: NextRequest) {
  const usuario = await getAuthUser(request)
  if (!usuario) return NextResponse.json({ error: 'não autenticado' }, { status: 401 })
  const de = request.nextUrl.searchParams.get('de')
  const para = request.nextUrl.searchParams.get('para')
  if (!de || !para) return NextResponse.json({ error: 'informe as versões ?de= e ?para=' }, { status: 400 })
  const [antes, depois] = [await carregarTabela(de), await carregarTabela(para)]
  if (!antes || !depois) return NextResponse.json({ error: 'versão não encontrada' }, { status: 404 })
  return NextResponse.json(diferencasEntreVersoes(antes.itens, depois.itens))
}
```

- [ ] **Step 4: Rodar e ver passar** — `npx jest src/lib/tabela-precos src/app/api/tabela-precos` → PASS; `npx tsc --noEmit`.

- [ ] **Step 5: Commit** — `ARQS="src/lib/tabela-precos/diferencas.ts src/lib/tabela-precos/diferencas.test.ts src/lib/tabela-precos/consultas.ts src/app/api/tabela-precos/route.ts src/app/api/tabela-precos/route.test.ts src/app/api/tabela-precos/versoes/route.ts src/app/api/tabela-precos/diferencas/route.ts"`, `MSG="feat(tabela-precos): API da tabela, das versões e do que mudou"`.

---

### Task 10: Tela "Tabela de preços" e menu

**Files:**
- Create: `src/lib/tabela-precos/busca.ts` + `busca.test.ts`
- Create: `src/app/tabela-de-precos/page.tsx`, `cartao-versao.tsx`, `lista-precos.tsx`, `o-que-mudou.tsx`
- Test: `src/app/tabela-de-precos/page.test.tsx`
- Modify: `src/components/nav-bar.tsx` (`RELATORIOS_SUBLINKS` + import `Tags`) e `src/components/nav-bar.test.tsx`

**Interfaces:**
- Consumes: rotas da Task 9, `<AtualizacaoSharepoint url>` (Task 5), `formatarMoeda`/`formatarData`, `INPUT_BASE`, `cn`.
- Produces: `normalizarBusca(t)`, `filtrarItens(itens, termo, grupo?)`, `gruposDosItens(itens): { grupo; rotulo; total }[]`, `agruparPorSecao(itens): { secao: string; itens }[]`, `trechosDestacados(texto, termo): { texto; destaque: boolean }[]`, `rotuloDoGrupo(secaoTopo): string`; página `/tabela-de-precos`.

- [ ] **Step 1: Testes falhando**

`src/lib/tabela-precos/busca.test.ts`:

```ts
import { agruparPorSecao, filtrarItens, gruposDosItens, rotuloDoGrupo, trechosDestacados } from './busca'

const itens = [
  { codigo: '10.050.00065.00', grupo: 'A', secoes: 'A - SISTEMAS DE INFORMAÇÃO', descricao: 'ANALISTA DE INFORMAÇÃO (COMPLEXIDADE 1)' },
  { codigo: '12.066.00015.00', grupo: 'C', secoes: 'C - SOLUÇÕES DE SERVIÇOS DE COMUNICAÇÃO > C5. COMUNICAÇÃO DE VOZ', descricao: 'GERENCIAMENTO DE RAMAIS (1 a 60 ramais)' },
  { codigo: '12.066.00016.00', grupo: 'C', secoes: 'C - SOLUÇÕES DE SERVIÇOS DE COMUNICAÇÃO > C5. COMUNICAÇÃO DE VOZ', descricao: 'GERENCIAMENTO DE RAMAIS (61 a 180 ramais)' },
]

it('busca sem acento e sem caixa, todas as palavras; código com ou sem pontos', () => {
  expect(filtrarItens(itens, 'informacao').map((i) => i.codigo)).toEqual(['10.050.00065.00'])
  expect(filtrarItens(itens, 'ramais 61').map((i) => i.codigo)).toEqual(['12.066.00016.00'])
  expect(filtrarItens(itens, '12.066').length).toBe(2)
  expect(filtrarItens(itens, '1206600015').map((i) => i.codigo)).toEqual(['12.066.00015.00'])
  expect(filtrarItens(itens, '', 'C').length).toBe(2)
  expect(filtrarItens(itens, 'ramais', 'A')).toEqual([])
})

it('grupos com rótulo e contagem, na ordem da tabela', () => {
  expect(gruposDosItens(itens)).toEqual([
    { grupo: 'A', rotulo: 'Sistemas de informação', total: 1 },
    { grupo: 'C', rotulo: 'Soluções de serviços de comunicação', total: 2 },
  ])
  expect(rotuloDoGrupo('E - DATA CENTER')).toBe('Data center')
})

it('seções em blocos consecutivos', () => {
  expect(agruparPorSecao(itens).map((b) => [b.secao, b.itens.length])).toEqual([
    ['A - SISTEMAS DE INFORMAÇÃO', 1],
    ['C - SOLUÇÕES DE SERVIÇOS DE COMUNICAÇÃO > C5. COMUNICAÇÃO DE VOZ', 2],
  ])
})

it('destaque das palavras achadas, sem perder o acento do original', () => {
  expect(trechosDestacados('ANALISTA DE INFORMAÇÃO', 'informacao')).toEqual([
    { texto: 'ANALISTA DE ', destaque: false },
    { texto: 'INFORMAÇÃO', destaque: true },
  ])
  expect(trechosDestacados('ABC', '')).toEqual([{ texto: 'ABC', destaque: false }])
})
```

`src/app/tabela-de-precos/page.test.tsx`:

```tsx
import { fireEvent, render, screen, within } from '@testing-library/react'
import TabelaDePrecosPage from './page'

const tabela = {
  versao: '2026 v3.0', publicadaEm: '2026-09-21T00:00:00.000Z', totalItens: 3, divergencias: 1, lidaEm: '2026-09-29T13:00:00.000Z', vigente: true,
  arquivos: { planilha: 'ap', pdf: 'at', publicacao: 'apub', informativo: 'ai' },
}
const item = (codigo: string, descricao: string, grupo: string, secoes: string, extra = {}) => ({
  codigo, descricao, grupo, secoes, unidade: 'HORA/HOMEM', preco: '269', sobDemanda: false, precoTexto: null, conferencia: 'confere', precoNoPdf: '269', ...extra,
})
const itens = [
  item('10.050.00065.00', 'ANALISTA DE INFORMAÇÃO (COMPLEXIDADE 1)', 'A', 'A - SISTEMAS DE INFORMAÇÃO'),
  item('10.050.00070.00', 'ANALISTA - ADICIONAL DE SOBREAVISO', 'A', 'A - SISTEMAS DE INFORMAÇÃO', { preco: null, sobDemanda: true, precoNoPdf: null }),
  item('11.051.00012.00', 'CONSULTORIA TÉCNICA', 'B', 'B - SERVIÇOS DE REDES E CONECTIVIDADES', { preco: '369.41', precoNoPdf: '370', conferencia: 'diverge' }),
]

beforeEach(() => {
  global.fetch = jest.fn((url: RequestInfo | URL) => {
    const u = String(url)
    const corpo = u === '/api/tabela-precos/versoes'
      ? [{ versao: '2026 v3.0', publicadaEm: tabela.publicadaEm, totalItens: 3, vigente: true }]
      : u.startsWith('/api/tabela-precos') ? { tabela, itens } : { atualizadoEm: null }
    return Promise.resolve({ ok: true, json: () => Promise.resolve(corpo) })
  }) as jest.Mock
  Object.assign(navigator, { clipboard: { writeText: jest.fn(() => Promise.resolve()) } })
})

it('mostra a versão, a publicação no DOC, o aviso do informativo e os serviços', async () => {
  render(<TabelaDePrecosPage />)
  expect(await screen.findByText('2026 v3.0')).toBeInTheDocument()
  expect(screen.getByText(/publicada no DOC em 21\/09\/2026/)).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /alterações depois da publicação/i })).toHaveAttribute('href', '/api/biblioteca/ai')
  expect(screen.getByRole('link', { name: 'Tabela oficial (PDF)' })).toHaveAttribute('href', '/api/biblioteca/at')
  expect(screen.getByText('R$ 269,00')).toBeInTheDocument()
  expect(screen.getByText('Sob demanda')).toBeInTheDocument()
})

it('busca sem acento e filtro por grupo', async () => {
  render(<TabelaDePrecosPage />)
  await screen.findByText('2026 v3.0')
  fireEvent.change(screen.getByRole('searchbox', { name: /buscar/i }), { target: { value: 'tecnica' } })
  expect(screen.queryByText(/ANALISTA DE/)).not.toBeInTheDocument()
  expect(screen.getByText('TÉCNICA')).toBeInTheDocument()
  fireEvent.change(screen.getByRole('searchbox', { name: /buscar/i }), { target: { value: '' } })
  fireEvent.click(screen.getByRole('button', { name: /Sistemas de informação/ }))
  expect(screen.queryByText('CONSULTORIA TÉCNICA')).not.toBeInTheDocument()
})

it('preço que diverge do PDF mostra os dois valores', async () => {
  render(<TabelaDePrecosPage />)
  const linha = (await screen.findByText('CONSULTORIA TÉCNICA')).closest('li')!
  expect(within(linha).getByText('R$ 369,41')).toBeInTheDocument()
  expect(within(linha).getByText(/PDF publicado: R\$ 370,00/)).toBeInTheDocument()
})

it('clique no código copia', async () => {
  render(<TabelaDePrecosPage />)
  fireEvent.click(await screen.findByRole('button', { name: /copiar código 10\.050\.00065\.00/i }))
  expect(navigator.clipboard.writeText).toHaveBeenCalledWith('10.050.00065.00')
  expect(await screen.findByText('copiado')).toBeInTheDocument()
})

it('sem tabela lida: explica em vez de lista vazia', async () => {
  ;(global.fetch as jest.Mock).mockImplementation((url: string) =>
    Promise.resolve({ ok: true, json: () => Promise.resolve(url === '/api/tabela-precos/versoes' ? [] : url.startsWith('/api/tabela-precos') ? { tabela: null, itens: [] } : { atualizadoEm: null }) })
  )
  render(<TabelaDePrecosPage />)
  expect(await screen.findByText(/ainda não foi lida da pasta do SharePoint/)).toBeInTheDocument()
})
```

Em `src/components/nav-bar.test.tsx`, junto do teste de "Todos os documentos" dentro do grupo:

```tsx
expect(screen.getByRole('link', { name: 'Tabela de preços' })).toHaveAttribute('href', '/tabela-de-precos')
```

- [ ] **Step 2: Rodar e ver falhar** — `npx jest src/lib/tabela-precos/busca.test.ts src/app/tabela-de-precos src/components/nav-bar.test.tsx` → FAIL.

- [ ] **Step 3: Implementar**

`src/lib/tabela-precos/busca.ts`:

```ts
// Busca, grupos e seções da tela da tabela de preços (roda no navegador — sem import de servidor).

interface ItemBuscavel {
  codigo: string
  grupo: string
  secoes: string
  descricao: string
}

export const normalizarBusca = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()

/** Todas as palavras na descrição (sem acento, sem caixa); só dígitos e pontos = busca por código. */
export function filtrarItens<T extends ItemBuscavel>(itens: T[], termo: string, grupo: string | null = null): T[] {
  const q = normalizarBusca(termo)
  const soCodigo = /^[\d.]+$/.test(q)
  const palavras = q ? q.split(' ') : []
  return itens.filter((i) => {
    if (grupo && i.grupo !== grupo) return false
    if (!q) return true
    if (soCodigo) return i.codigo.includes(q) || i.codigo.replace(/\./g, '').includes(q.replace(/\./g, ''))
    const alvo = normalizarBusca(`${i.codigo} ${i.descricao}`)
    return palavras.every((p) => alvo.includes(p))
  })
}

/** "A - SISTEMAS DE INFORMAÇÃO" → "Sistemas de informação". */
export function rotuloDoGrupo(secaoTopo: string): string {
  const nome = secaoTopo.replace(/^[A-Z]\s*-\s*/, '').trim().toLowerCase()
  return nome.charAt(0).toUpperCase() + nome.slice(1)
}

export function gruposDosItens<T extends ItemBuscavel>(itens: T[]): { grupo: string; rotulo: string; total: number }[] {
  const grupos = new Map<string, { grupo: string; rotulo: string; total: number }>()
  for (const i of itens) {
    const g = grupos.get(i.grupo) ?? { grupo: i.grupo, rotulo: rotuloDoGrupo(i.secoes.split(' > ')[0] ?? i.grupo), total: 0 }
    g.total++
    grupos.set(i.grupo, g)
  }
  return [...grupos.values()]
}

/** Blocos de itens seguidos com a mesma seção (a ordem vem da planilha, igual ao PDF). */
export function agruparPorSecao<T extends ItemBuscavel>(itens: T[]): { secao: string; itens: T[] }[] {
  const blocos: { secao: string; itens: T[] }[] = []
  for (const i of itens) {
    const ultimo = blocos[blocos.length - 1]
    if (ultimo && ultimo.secao === i.secoes) ultimo.itens.push(i)
    else blocos.push({ secao: i.secoes, itens: [i] })
  }
  return blocos
}

/** Pedaços do texto com as palavras da busca marcadas. Funciona porque tirar o acento de texto NFC não
 *  muda o tamanho: o índice no texto normalizado é o mesmo no original. */
export function trechosDestacados(texto: string, termo: string): { texto: string; destaque: boolean }[] {
  const palavras = normalizarBusca(termo).split(' ').filter((p) => p.length > 0)
  if (palavras.length === 0) return [{ texto, destaque: false }]
  const alvo = texto.normalize('NFC').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  const marca = new Array<boolean>(texto.length).fill(false)
  for (const p of palavras) {
    let i = alvo.indexOf(p)
    while (i >= 0) {
      for (let k = i; k < i + p.length; k++) marca[k] = true
      i = alvo.indexOf(p, i + p.length)
    }
  }
  const pedacos: { texto: string; destaque: boolean }[] = []
  for (let k = 0; k < texto.length; k++) {
    const ultimo = pedacos[pedacos.length - 1]
    if (ultimo && ultimo.destaque === marca[k]) ultimo.texto += texto[k]
    else pedacos.push({ texto: texto[k], destaque: marca[k] })
  }
  return pedacos
}
```

`src/app/tabela-de-precos/cartao-versao.tsx`:

```tsx
'use client'

import { AlertCircle, FileSpreadsheet, FileText, Newspaper } from 'lucide-react'
import { formatarData } from '@/lib/relatorios-clientes/formatacao'
import type { TabelaSerializada, VersaoResumo } from '@/lib/tabela-precos/tipos'

const BOTAO = 'inline-flex items-center gap-1.5 rounded-xl border border-border-grey bg-white px-3 py-1.5 text-xs font-medium text-navy transition-colors hover:border-orange hover:text-orange'
const arquivo = (id: string) => `/api/biblioteca/${id}`

function textoDaConferencia(t: TabelaSerializada): string {
  if (!t.arquivos.pdf) return 'sem PDF oficial para conferir'
  return t.divergencias === 0 ? 'conferida com o PDF publicado' : `${t.divergencias} preço(s) diferente(s) do PDF publicado`
}

export function CartaoVersao({ tabela, versoes, onVersao }: { tabela: TabelaSerializada; versoes: VersaoResumo[]; onVersao: (versao: string) => void }) {
  return (
    <section className="space-y-3 rounded-2xl border border-border-grey bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="flex items-center gap-2 text-lg font-semibold text-navy">
            {tabela.versao}
            {tabela.vigente && <span className="rounded-full bg-navy/5 px-2 py-0.5 text-xs font-medium text-navy">vigente</span>}
          </p>
          <p className="text-sm text-mid-grey">
            {tabela.publicadaEm ? `publicada no DOC em ${formatarData(tabela.publicadaEm)}` : 'data de publicação não encontrada'} · {tabela.totalItens} serviços ·{' '}
            <span className={tabela.divergencias > 0 ? 'font-medium text-orange-dark' : ''}>{textoDaConferencia(tabela)}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {tabela.arquivos.pdf && <a className={BOTAO} href={arquivo(tabela.arquivos.pdf)} target="_blank" rel="noreferrer"><FileText className="size-3.5" />Tabela oficial (PDF)</a>}
          {tabela.arquivos.publicacao && <a className={BOTAO} href={arquivo(tabela.arquivos.publicacao)} target="_blank" rel="noreferrer"><Newspaper className="size-3.5" />Publicação no DOC</a>}
          {tabela.arquivos.planilha && <a className={BOTAO} href={`${arquivo(tabela.arquivos.planilha)}?baixar=1`}><FileSpreadsheet className="size-3.5" />Memória de cálculo</a>}
        </div>
      </div>
      {tabela.arquivos.informativo && (
        <a
          href={arquivo(tabela.arquivos.informativo)}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 rounded-xl border border-orange/30 bg-orange/5 px-3 py-2 text-sm text-orange-dark hover:bg-orange/10"
        >
          <AlertCircle className="size-4 shrink-0" />
          Há alterações depois da publicação (informativo interno) — confira antes de usar o preço
        </a>
      )}
      {versoes.length > 1 && (
        <label className="flex items-center gap-2 text-xs text-mid-grey">
          Versão
          <select className="rounded-lg border border-border-grey bg-white px-2 py-1 text-xs text-navy" value={tabela.versao} onChange={(e) => onVersao(e.target.value)}>
            {versoes.map((v) => (
              <option key={v.versao} value={v.versao}>{v.versao}{v.vigente ? ' (vigente)' : ''}</option>
            ))}
          </select>
        </label>
      )}
    </section>
  )
}
```

`src/app/tabela-de-precos/lista-precos.tsx`:

```tsx
'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { INPUT_BASE } from '@/lib/ui'
import { formatarMoeda } from '@/lib/relatorios-clientes/formatacao'
import { agruparPorSecao, filtrarItens, gruposDosItens, trechosDestacados } from '@/lib/tabela-precos/busca'
import type { ItemSerializado } from '@/lib/tabela-precos/tipos'

function Preco({ item }: { item: ItemSerializado }) {
  if (item.sobDemanda) return <span className="justify-self-start rounded-full bg-light-grey px-2 py-0.5 text-xs text-mid-grey md:justify-self-end">Sob demanda</span>
  if (item.preco === null) return <span className="text-xs text-orange-dark md:text-right">{item.precoTexto ?? 'preço não lido'}</span>
  return (
    <span className="flex flex-col md:items-end">
      <span className="flex items-center gap-1.5 font-mono text-sm font-semibold text-navy">
        {item.conferencia === 'diverge' && <AlertCircle className="size-3.5 text-orange-dark" aria-hidden="true" />}
        {formatarMoeda(item.preco)}
      </span>
      {item.conferencia === 'diverge' && <span className="text-[0.7rem] text-orange-dark">PDF publicado: {formatarMoeda(item.precoNoPdf)}</span>}
      {item.conferencia === 'alterado-pelo-informativo' && <span className="text-[0.7rem] text-orange-dark">alterado pelo informativo</span>}
    </span>
  )
}

export function ListaPrecos({ itens }: { itens: ItemSerializado[] }) {
  const [termo, setTermo] = useState('')
  const [grupo, setGrupo] = useState<string | null>(null)
  const [copiado, setCopiado] = useState<string | null>(null)
  const campo = useRef<HTMLInputElement>(null)

  // "/" leva à busca (quando não se está digitando em outro campo); Esc limpa.
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      const digitando = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement
      if (e.key === '/' && !digitando) {
        e.preventDefault()
        campo.current?.focus()
      }
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [])

  const grupos = useMemo(() => gruposDosItens(itens), [itens])
  const visiveis = useMemo(() => filtrarItens(itens, termo, grupo), [itens, termo, grupo])
  const blocos = useMemo(() => agruparPorSecao(visiveis), [visiveis])

  const copiar = async (codigo: string) => {
    await navigator.clipboard?.writeText(codigo)
    setCopiado(codigo)
    setTimeout(() => setCopiado((c) => (c === codigo ? null : c)), 1500)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="relative w-full max-w-md">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-mid-grey" />
          <input
            ref={campo}
            type="search"
            aria-label="Buscar por código ou descrição"
            placeholder="Buscar por código ou descrição  ( / )"
            className={cn(INPUT_BASE, 'w-full pl-9')}
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && setTermo('')}
          />
        </label>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por grupo">
          {grupos.map((g) => (
            <button
              key={g.grupo}
              type="button"
              aria-pressed={grupo === g.grupo}
              onClick={() => setGrupo((atual) => (atual === g.grupo ? null : g.grupo))}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                grupo === g.grupo ? 'border-orange bg-orange text-white' : 'border-border-grey bg-white text-navy hover:border-orange'
              )}
            >
              {g.rotulo} <span className="opacity-70">{g.total}</span>
            </button>
          ))}
        </div>
      </div>

      <p className="text-xs text-mid-grey" aria-live="polite">{visiveis.length} de {itens.length} serviços</p>

      {visiveis.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border-grey p-8 text-center text-sm text-mid-grey">
          Nenhum serviço com “{termo}”{grupo ? ' neste grupo' : ''}. Tente o código ou outra palavra.
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border-grey bg-white">
          <div className="hidden grid-cols-[10rem_1fr_9rem_10rem] gap-4 border-b border-border-grey bg-light-grey/60 px-4 py-2 text-[0.7rem] font-semibold tracking-wide text-mid-grey uppercase md:grid">
            <span>Código</span><span>Descrição</span><span className="text-right">Unidade</span><span className="text-right">Preço unitário</span>
          </div>
          {blocos.map((b, n) => (
            <section key={`${b.secao}-${n}`}>
              <h2 className="border-b border-border-grey bg-light-grey/30 px-4 py-2 text-xs font-semibold text-navy">{b.secao.split(' > ').join(' › ')}</h2>
              <ul>
                {b.itens.map((item) => (
                  <li key={item.codigo} className="grid grid-cols-1 gap-1 border-b border-border-grey/60 px-4 py-3 last:border-b-0 md:grid-cols-[10rem_1fr_9rem_10rem] md:items-center md:gap-4">
                    <button
                      type="button"
                      aria-label={`Copiar código ${item.codigo}`}
                      onClick={() => copiar(item.codigo)}
                      className="justify-self-start font-mono text-xs text-navy hover:text-orange"
                    >
                      {copiado === item.codigo ? 'copiado' : item.codigo}
                    </button>
                    <span className="text-sm text-foreground">
                      {trechosDestacados(item.descricao, termo).map((p, k) =>
                        p.destaque ? <mark key={k} className="rounded bg-orange/20 px-0.5 text-inherit">{p.texto}</mark> : <span key={k}>{p.texto}</span>
                      )}
                    </span>
                    <span className="text-xs text-mid-grey md:text-right">{item.unidade}</span>
                    <Preco item={item} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
```

`src/app/tabela-de-precos/o-que-mudou.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { formatarMoeda } from '@/lib/relatorios-clientes/formatacao'
import type { Diferencas } from '@/lib/tabela-precos/tipos'

export function OQueMudou({ de, para }: { de: string; para: string }) {
  const [d, setD] = useState<Diferencas | null | 'erro'>(null)
  useEffect(() => {
    let ativo = true
    setD(null)
    fetch(`/api/tabela-precos/diferencas?de=${encodeURIComponent(de)}&para=${encodeURIComponent(para)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((corpo) => ativo && setD(corpo))
      .catch(() => ativo && setD('erro'))
    return () => { ativo = false }
  }, [de, para])

  if (d === null) return <div className="h-40 animate-pulse rounded-2xl bg-light-grey" />
  if (d === 'erro') return <p className="text-sm text-orange-dark">Não foi possível comparar as versões agora.</p>
  return (
    <div className="space-y-6">
      <p className="text-sm text-mid-grey">De {de} para {para}: {d.precoMudou.length} preço(s) mudaram, {d.novos.length} serviço(s) novo(s), {d.retirados.length} retirado(s).</p>
      {d.precoMudou.length > 0 && (
        <ul className="divide-y divide-border-grey rounded-2xl border border-border-grey bg-white">
          {d.precoMudou.map((m) => (
            <li key={m.codigo} className="grid grid-cols-1 gap-1 px-4 py-3 md:grid-cols-[10rem_1fr_16rem] md:items-center">
              <span className="font-mono text-xs text-navy">{m.codigo}</span>
              <span className="text-sm">{m.descricao}</span>
              <span className="font-mono text-sm md:text-right">
                {m.antes ? formatarMoeda(m.antes) : 'sob demanda'} → {m.depois ? formatarMoeda(m.depois) : 'sob demanda'}
                {m.percentual !== null && <span className={m.percentual > 0 ? 'ml-2 text-orange-dark' : 'ml-2 text-emerald-700'}>{m.percentual > 0 ? '+' : ''}{m.percentual}%</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
      {[['Novos', d.novos], ['Retirados', d.retirados]].map(([titulo, lista]) =>
        (lista as Diferencas['novos']).length > 0 ? (
          <section key={titulo as string} className="space-y-2">
            <h3 className="text-sm font-semibold text-navy">{titulo as string}</h3>
            <ul className="divide-y divide-border-grey rounded-2xl border border-border-grey bg-white">
              {(lista as Diferencas['novos']).map((i) => (
                <li key={i.codigo} className="flex gap-4 px-4 py-2 text-sm"><span className="font-mono text-xs text-navy">{i.codigo}</span>{i.descricao}</li>
              ))}
            </ul>
          </section>
        ) : null
      )}
    </div>
  )
}
```

`src/app/tabela-de-precos/page.tsx`:

```tsx
'use client'

// Tabela de preços dos serviços da PRODAM (spec docs/superpowers/specs/2026-09-29-tabela-de-precos-design.md):
// lida da pasta TABELA DE PREÇOS PRODAM-SP do SharePoint pelo agendador; aqui só se consulta.

import { useEffect, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AtualizacaoSharepoint } from '@/components/sharepoint/atualizacao-sharepoint'
import type { ItemSerializado, TabelaSerializada, VersaoResumo } from '@/lib/tabela-precos/tipos'
import { CartaoVersao } from './cartao-versao'
import { ListaPrecos } from './lista-precos'
import { OQueMudou } from './o-que-mudou'

type Carga = { estado: 'carregando' } | { estado: 'erro' } | { estado: 'ok'; tabela: TabelaSerializada | null; itens: ItemSerializado[] }

export default function TabelaDePrecosPage() {
  const [versoes, setVersoes] = useState<VersaoResumo[]>([])
  const [versao, setVersao] = useState<string | null>(null)
  const [carga, setCarga] = useState<Carga>({ estado: 'carregando' })
  const [aba, setAba] = useState<'precos' | 'mudou'>('precos')

  useEffect(() => {
    fetch('/api/tabela-precos/versoes')
      .then((r) => (r.ok ? r.json() : []))
      .then((lista) => setVersoes(Array.isArray(lista) ? lista : []))
      .catch(() => setVersoes([]))
  }, [])

  useEffect(() => {
    let ativo = true
    setCarga({ estado: 'carregando' })
    fetch(versao ? `/api/tabela-precos?versao=${encodeURIComponent(versao)}` : '/api/tabela-precos')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((corpo) => ativo && setCarga({ estado: 'ok', tabela: corpo.tabela, itens: corpo.itens }))
      .catch(() => ativo && setCarga({ estado: 'erro' }))
    return () => { ativo = false }
  }, [versao])

  const atual = carga.estado === 'ok' ? carga.tabela : null
  const indice = atual ? versoes.findIndex((v) => v.versao === atual.versao) : -1
  const anterior = indice >= 0 ? versoes[indice + 1]?.versao ?? null : null

  return (
    <main className="mx-auto max-w-[110rem] space-y-6 px-6 py-8 lg:px-8">
      <div className="space-y-3">
        <nav className="flex items-center gap-1.5 text-xs font-medium text-mid-grey">
          <span>Relatórios dos clientes</span>
          <ChevronRight className="size-3" strokeWidth={2.5} />
          <span className="font-semibold text-navy">Tabela de preços</span>
        </nav>
        <div>
          <h1 className="text-[1.75rem] leading-tight font-semibold tracking-tight text-navy">Tabela de preços</h1>
          <p className="text-sm text-mid-grey">Preços dos serviços da PRODAM, pela tabela publicada no Diário Oficial</p>
          <AtualizacaoSharepoint url="/api/biblioteca/atualizacao" className="mt-1" />
        </div>
      </div>

      {carga.estado === 'carregando' && (
        <div className="space-y-3" aria-busy="true">
          <div className="h-24 animate-pulse rounded-2xl bg-light-grey" />
          <div className="h-96 animate-pulse rounded-2xl bg-light-grey" />
        </div>
      )}
      {carga.estado === 'erro' && <p className="text-sm text-orange-dark">Não foi possível carregar a tabela agora — tente de novo em instantes.</p>}
      {carga.estado === 'ok' && !carga.tabela && (
        <p className="rounded-2xl border border-dashed border-border-grey p-8 text-center text-sm text-mid-grey">
          A tabela de preços ainda não foi lida da pasta do SharePoint. Ela entra sozinha na próxima passada do agendador.
        </p>
      )}
      {carga.estado === 'ok' && carga.tabela && (
        <>
          <CartaoVersao tabela={carga.tabela} versoes={versoes} onVersao={setVersao} />
          <div role="tablist" className="flex gap-6 border-b border-border-grey">
            {([['precos', 'Preços'], ['mudou', 'O que mudou']] as const).map(([id, rotulo]) => {
              const desabilitada = id === 'mudou' && !anterior
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={aba === id}
                  disabled={desabilitada}
                  title={desabilitada ? 'Disponível a partir da próxima versão da tabela' : undefined}
                  onClick={() => setAba(id)}
                  className={cn('relative py-3 text-[0.8rem] transition-colors disabled:cursor-not-allowed disabled:opacity-40', aba === id ? 'font-semibold text-navy' : 'font-medium text-mid-grey hover:text-navy')}
                >
                  {rotulo}
                  <span className={cn('absolute inset-x-0 -bottom-px h-[2.5px] rounded-full bg-orange transition-transform', aba === id ? 'scale-x-100' : 'scale-x-0')} />
                </button>
              )
            })}
          </div>
          {aba === 'precos' || !anterior ? <ListaPrecos itens={carga.itens} /> : <OQueMudou de={anterior} para={carga.tabela.versao} />}
        </>
      )}
    </main>
  )
}
```

Em `src/components/nav-bar.tsx`: acrescentar `Tags` ao import do `lucide-react` e, no fim de `RELATORIOS_SUBLINKS`, `{ href: '/tabela-de-precos', label: 'Tabela de preços', icon: Tags },`. Atualizar o comentário do grupo: "…e, desde 29/09/2026, as telas da biblioteca Documentos do SharePoint (tabela de preços; depois links e calendário)".

- [ ] **Step 4: Rodar e ver passar** — `npx jest src/lib/tabela-precos src/app/tabela-de-precos src/components/nav-bar.test.tsx` → PASS; `npx tsc --noEmit`.

- [ ] **Step 5: Ver na tela** — `preview_start` com `{ name: "verai-dev" }`, login, `/tabela-de-precos`:
  - cartão "2026 v3.0 · publicada no DOC em 21/09/2026 · 315 serviços · conferida com o PDF publicado" e a faixa do informativo;
  - busca "virtualizacao" acha E1.6; "/" foca a busca; `Esc` limpa;
  - pílula "Data center 158"; itens TID mostram "alterado pelo informativo";
  - "Tabela oficial (PDF)" abre o PDF;
  - em 375 px (`resize_window` mobile) a lista vira cartões sem rolagem lateral; voltar para desktop;
  - `read_console_messages` sem erro. Screenshot para o usuário.

- [ ] **Step 6: Commit** — `ARQS="src/lib/tabela-precos/busca.ts src/lib/tabela-precos/busca.test.ts src/app/tabela-de-precos/page.tsx src/app/tabela-de-precos/cartao-versao.tsx src/app/tabela-de-precos/lista-precos.tsx src/app/tabela-de-precos/o-que-mudou.tsx src/app/tabela-de-precos/page.test.tsx src/components/nav-bar.tsx src/components/nav-bar.test.tsx"`, `MSG="feat(tabela-precos): tela da tabela de preços em Relatórios dos clientes"`.

---

### Task 11: Assistente consulta a tabela

**Files:**
- Create: `src/lib/assistente/ferramentas/precos.ts` + `precos.test.ts`
- Modify: `src/lib/assistente/ferramentas/index.ts` (import + registro) e `rotulos.ts`

**Interfaces:**
- Consumes: `carregarTabela` (Task 9), `filtrarItens` (Task 10), `definirFerramenta`, `esquemaLimite`, `moeda` de `./comum`.
- Produces: ferramenta `consultarTabelaDePrecos` (entrada `{ busca: string; limite?: number }`).

- [ ] **Step 1: Régua antes** — `npx dotenv -e .env.development -- npx tsx scripts/regua-assistente.ts --salvar`; anotar o arquivo gravado em `.superpowers/regua-assistente/`.

- [ ] **Step 2: Teste falhando** — `src/lib/assistente/ferramentas/precos.test.ts`:

```ts
/** @jest-environment node */
jest.mock('@/lib/prisma', () => ({ prisma: {} }))
jest.mock('@/lib/tabela-precos/consultas', () => ({ carregarTabela: jest.fn() }))

import { carregarTabela } from '@/lib/tabela-precos/consultas'
import { consultarTabelaDePrecos } from './precos'

const contexto = (role: 'uploader' | 'admin') => ({ usuario: { id: 'u', nome: 'U', email: 'u@x', role }, hoje: new Date('2026-09-29') })
const item = (codigo: string, descricao: string, extra = {}) => ({
  codigo, descricao, grupo: 'E', secoes: 'E - DATA CENTER', unidade: 'DOC/MÊS', preco: '4.09', sobDemanda: false, precoTexto: null, conferencia: 'confere', precoNoPdf: '4.09', ...extra,
})

beforeEach(() => {
  ;(carregarTabela as jest.Mock).mockResolvedValue({
    tabela: { versao: '2026 v3.0', publicadaEm: '2026-09-21T00:00:00.000Z' },
    itens: [
      item('14.052.00001.00', 'TID CORPORATIVO ATÉ 4000', { conferencia: 'alterado-pelo-informativo', precoNoPdf: '0.50' }),
      item('10.050.00070.00', 'ANALISTA - ADICIONAL', { preco: null, sobDemanda: true }),
    ],
  })
})

it('busca por palavra e devolve preço, versão e o aviso do informativo — tabela pública: não filtra por cliente', async () => {
  const r = (await consultarTabelaDePrecos.executar({ busca: 'tid', limite: 20 }, contexto('uploader'))) as any
  expect(r).toEqual({
    versao: '2026 v3.0',
    publicadaEm: '21/09/2026',
    total: 1,
    itens: [{ codigo: '14.052.00001.00', descricao: 'TID CORPORATIVO ATÉ 4000', unidade: 'DOC/MÊS', preco: 'R$ 4,09', aviso: 'preço alterado pelo informativo depois da publicação (PDF publicado: R$ 0,50)' }],
  })
})

it('sob demanda e tabela ainda não lida', async () => {
  const r = (await consultarTabelaDePrecos.executar({ busca: 'adicional', limite: 20 }, contexto('admin'))) as any
  expect(r.itens[0].preco).toBe('sob demanda')
  ;(carregarTabela as jest.Mock).mockResolvedValue(null)
  expect(await consultarTabelaDePrecos.executar({ busca: 'x1', limite: 20 }, contexto('admin'))).toEqual({ erro: 'a tabela de preços ainda não foi lida da pasta do SharePoint' })
})
```

- [ ] **Step 3: Rodar e ver falhar** — `npx jest src/lib/assistente/ferramentas/precos.test.ts` → FAIL.

- [ ] **Step 4: Implementar** — `src/lib/assistente/ferramentas/precos.ts`:

```ts
import { z } from 'zod'
import { formatarData } from '@/lib/relatorios-clientes/formatacao'
import { carregarTabela } from '@/lib/tabela-precos/consultas'
import { filtrarItens } from '@/lib/tabela-precos/busca'
import type { ItemSerializado } from '@/lib/tabela-precos/tipos'
import { definirFerramenta, esquemaLimite, moeda } from './comum'

// Tabela de preços oficial (spec 2026-09-29-tabela-de-precos §8). Pública (publicada no DOC): não filtra por
// cliente.

function aviso(i: ItemSerializado): string | undefined {
  if (i.conferencia === 'alterado-pelo-informativo') return `preço alterado pelo informativo depois da publicação${i.precoNoPdf ? ` (PDF publicado: ${moeda(i.precoNoPdf)})` : ''}`
  if (i.conferencia === 'diverge') return `a planilha difere do PDF publicado (PDF: ${moeda(i.precoNoPdf)})`
  return undefined
}

export const consultarTabelaDePrecos = definirFerramenta({
  descricao:
    'Tabela de preços oficial dos serviços da PRODAM (versão vigente, publicada no Diário Oficial): busca por código do serviço (NN.NNN.NNNNN.NN) ou por palavras da descrição; devolve código, descrição, unidade, preço unitário e aviso quando o preço mudou depois da publicação.',
  entrada: z.object({
    busca: z.string().min(2).describe('código do serviço ou palavras da descrição (ex.: "analista complexidade 3", "10.050.00067.00")'),
    limite: esquemaLimite,
  }),
  async executar({ busca, limite }) {
    const carregada = await carregarTabela()
    if (!carregada) return { erro: 'a tabela de preços ainda não foi lida da pasta do SharePoint' }
    const achados = filtrarItens(carregada.itens, busca).slice(0, limite)
    return {
      versao: carregada.tabela.versao,
      publicadaEm: carregada.tabela.publicadaEm ? formatarData(carregada.tabela.publicadaEm) : null,
      total: achados.length,
      itens: achados.map((i) => ({
        codigo: i.codigo,
        descricao: i.descricao,
        unidade: i.unidade,
        preco: i.sobDemanda ? 'sob demanda' : i.preco !== null ? moeda(i.preco) : (i.precoTexto ?? '—'),
        ...(aviso(i) ? { aviso: aviso(i) } : {}),
      })),
    }
  },
})
```

Em `ferramentas/index.ts`: `import { consultarTabelaDePrecos } from './precos'` e `consultarTabelaDePrecos,` no fim de `FERRAMENTAS`. Em `ferramentas/rotulos.ts`: `consultarTabelaDePrecos: 'Consultando a tabela de preços',`.

- [ ] **Step 5: Rodar e ver passar** — `npx jest src/lib/assistente/ferramentas` → PASS (inclui o teste de `index` que exige rótulo para toda ferramenta).

- [ ] **Step 6: Régua depois** — `npx dotenv -e .env.development -- npx tsx scripts/regua-assistente.ts --comparar=.superpowers/regua-assistente/<arquivo do Step 1>`. Esperado: catálogo com uma ferramenta a mais (entrada um pouco maior, em cache); nenhuma pergunta antiga piora. Registrar os números no "Andamento".

- [ ] **Step 7: Commit** — `ARQS="src/lib/assistente/ferramentas/precos.ts src/lib/assistente/ferramentas/precos.test.ts src/lib/assistente/ferramentas/index.ts src/lib/assistente/ferramentas/rotulos.ts"`, `MSG="feat(assistente): consulta à tabela de preços oficial"`.

---

### Task 12: Conferência final e documentação

**Files:**
- Modify: `CLAUDE.md` (seção nova "Biblioteca Documentos do SharePoint")
- Modify: este plano (seção "Andamento")

- [ ] **Step 1: Suítes e tipos** — `npx jest src/lib/biblioteca src/lib/tabela-precos src/app/api/biblioteca src/app/api/tabela-precos src/app/tabela-de-precos src/components/nav-bar.test.tsx src/components/sharepoint src/lib/assistente/ferramentas src/lib/arquivos/sharepoint` → tudo PASS; `npx tsc --noEmit` limpo.

- [ ] **Step 2: Passada de novo no dev** — `npx dotenv -e .env.development -- npx tsx scripts/sincronizar-sharepoint.ts --aplicar` → `biblioteca Documentos: … iguais <todos> …`, "TUDO NO VERAI", "data das telas: atualizada", **código de saída 0** (`echo $?`).

- [ ] **Step 3: Guarda contra produção sem migração** — conferir que a etapa se recusa a rodar num banco sem a migração, sem tocar em produção: `npx tsx -e "import('./src/lib/biblioteca/etapa').then(async ({ etapaDaBiblioteca }) => console.log((await etapaDaBiblioteca({} as never, { aplicar: true, raiz: '.' }, { existe: () => true, bancoPronto: async () => false, fonte: (() => null) as never, sincronizar: (async () => { throw new Error('não devia rodar') }) as never, agora: () => new Date() })).linhas))"` → `[ 'biblioteca Documentos: pulada — migração 20260929100000_biblioteca_documentos não aplicada neste banco' ]`.

- [ ] **Step 4: CLAUDE.md** — nova seção depois de "Sincronização com o SharePoint (ContratosReceita)":

```markdown
## Biblioteca "Documentos" do SharePoint (tabela de preços, links, calendário)

Segunda biblioteca do mesmo agendador (`rede.sp - Documentos`, spec
`docs/superpowers/specs/2026-09-29-biblioteca-documentos-prodam-design.md`): a etapa `etapaDaBiblioteca`
(`src/lib/biblioteca/`) roda no fim de `scripts/sincronizar-sharepoint.ts`, grava cada arquivo no R2 pelo
`sha256` (`ArquivoBiblioteca`, **não** `ArquivoCliente`), confere e chama o **leitor da área**
(`registro-leitores.ts`). Área nova = pasta nova em `areaDoCaminho` + leitor + permissão em `podeVerArea`.
Entrega sempre por `/api/biblioteca/[id]`. Guarda pela migração `MIGRACAO_DA_BIBLIOTECA`; `--reler=<AREA>`
relê uma área; `--sem-documentos` pula.

**Só tabelas novas aqui**: o agendador roda o código e o cliente Prisma desta pasta contra produção — coluna
nova em model que ele já usa quebra a sincronização até a migração subir.

**Tabela de preços** (`/tabela-de-precos`, spec `2026-09-29-tabela-de-precos-design.md`): itens da
"Memória de Cálculo <ano> v<n>.xlsx" (aba achada pelo cabeçalho), cada preço conferido com o PDF oficial
(`precosNoPdf`: primeiro valor em R$ depois do código) e com o informativo; diferença nunca é resolvida em
silêncio. Assistente: `consultarTabelaDePrecos`. Links MPLS e calendário: specs próprios, ainda a fazer.
```

- [ ] **Step 5: Andamento** — preencher a seção "Andamento" deste plano (tarefas, commits, números da carga real, régua do assistente, o que ficou para produção: migração no Neon + deploy com o ok do usuário).

- [ ] **Step 6: Commit** — `ARQS="CLAUDE.md docs/superpowers/plans/2026-09-29-biblioteca-documentos-e-tabela-de-precos.md"`, `MSG="docs(biblioteca): CLAUDE.md e andamento da biblioteca Documentos e da tabela de preços"`. Se `CLAUDE.md` tiver mudança de outra sessão, montar o blob do `HEAD` + só esta seção.
