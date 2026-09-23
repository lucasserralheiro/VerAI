# Repositório de documentos do cliente — Fase 1 (fundação + aba) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A aba Documentos da ficha do cliente vira o repositório de arquivos do cliente — upload de qualquer arquivo com categoria (+ contrato/competência opcionais), lista com filtros, painel com pré-visualização e "onde é usado", entrega autenticada com auditoria — sobre um model `ArquivoCliente` que as fases 2–4 vão referenciar.

**Architecture:** Spec: `docs/superpowers/specs/2026-09-23-repositorio-documentos-cliente-design.md` (ler §3.2–3.5 e §3.7 antes de começar). Model `ArquivoCliente` + `AcessoArquivo` no Prisma; serviço puro/servidor em `src/lib/arquivos/`; upload direto do navegador ao Vercel Blob (token em `/api/arquivos/upload-token`, caminho temporário) e registro servidor-a-servidor (hash SHA-256, deduplicação por cliente, cópia para o caminho final); entrega só por `/api/arquivos/[id]`. Os `Documento` existentes ganham um `ArquivoCliente` apontando para o mesmo blob, por script.

**Tech Stack:** Next.js 15 (App Router), React 19, Prisma 6/Postgres, `@vercel/blob` 2.x (`handleUpload`/`upload`), zod 4, Jest + Testing Library.

## Global Constraints

- Permissão: ler, enviar, classificar e remover arquivo exige `getAuthUser` + `podeVerCliente(usuario, clienteId)` — usar `exigirUsuario`/`exigirAcessoCliente`/`verificarAcessoCliente` de `src/lib/relatorios-clientes/acesso.ts`. Respostas: 401 `{ error: 'não autenticado' }`, 403 `{ error: 'acesso negado' }`, 404 `{ error: 'arquivo não encontrado' }` / `{ error: 'cliente não encontrado' }`, 400 `{ error: '<mensagem>' }`, 409 `{ error: 'arquivo em uso', usos }`.
- `urlBlob` **nunca** sai em resposta JSON. Toda entrega de conteúdo passa por `GET /api/arquivos/[id]`, que grava `AcessoArquivo`.
- Nenhum arquivo passa pelo corpo de uma requisição do VerAI: o navegador sobe direto ao Blob sob o prefixo `tmp-arquivos/`; o servidor só aceita URL temporária validada por `urlTemporariaValida`.
- Sem duplicado dentro do cliente: mesmo `sha256` no mesmo cliente (não removido) = mesmo registro (índice único parcial no banco + checagem no serviço).
- Remoção é lógica (`removidoEm`) e só quando `usosDosArquivos` vem vazio; o blob nunca é apagado nesta fase.
- Categoria da sugestão por nome: `PC_…` → `PROPOSTA_COMERCIAL`, `PA_…` → `PROPOSTA_ADITIVO`, `TC_…` → `TERMO_CONTRATO`, `TA_…` → `TERMO_ADITIVO`, planilha (`xlsx`/`xls`/`csv`) com "medi"/"levant" no nome → `MEDICAO`, resto → `OUTRO`. Sempre confirmada pelo usuário.
- Textos de UI e mensagens em português. Exclusão pede confirmação inline ("Remover? Sim / Não"), nunca `window.confirm`.
- Classes de `src/lib/ui.ts` (`BTN_PRIMARY`, `BTN_OUTLINE`, `BTN_OUTLINE_SM`, `INPUT_BASE`, `LINK_DANGER`), `card`/`card-flush`, `table-institucional`, ícones `lucide-react`.
- Cada commit com `npx jest` e `npx tsc --noEmit` verdes; mensagem em português terminando com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. **Nunca `git add -A`/`git add .`** — há trabalho de outra sessão no working tree; adicionar só os arquivos da task.
- Não mexer em `src/app/confere/**`, `src/app/api/historico-contrato/**`, `src/app/api/faturamentos/**` nem nos campos `*PdfUrl` — são das fases 2–3.

---

### Task 1: Schema — `ArquivoCliente`, `AcessoArquivo`, `Documento.arquivoId`

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260924100000_repositorio_arquivos_cliente/migration.sql`

**Interfaces:**
- Produces: models `ArquivoCliente`, `AcessoArquivo`; enums `CategoriaArquivo`, `OrigemArquivo`; `Documento.arquivoId String?` + relação `arquivo`. Prisma Client: `prisma.arquivoCliente`, `prisma.acessoArquivo`, tipos `CategoriaArquivo`, `OrigemArquivo` de `@prisma/client`.

- [ ] **Step 0: Pré-condição — nada de outra sessão pendente em `prisma/`**

Run: `git status --short prisma/`
Expected: saída vazia. Se aparecer qualquer linha (ex.: `M prisma/schema.prisma`, `?? prisma/migrations/2026092314…`), **PARE** e pergunte ao usuário: essas mudanças são de outra sessão e precisam ser commitadas por ela antes — senão o commit desta task leva o trabalho dela junto, e a migração nova fica fora de ordem.

- [ ] **Step 1: Acrescentar os enums e models ao fim de `prisma/schema.prisma`**

```prisma
// ---------------------------------------------------------------------------
// Repositório de documentos do cliente — ver
// docs/superpowers/specs/2026-09-23-repositorio-documentos-cliente-design.md.
// `ArquivoCliente` é o ÚNICO lugar onde arquivo de cliente existe: quem usa o
// arquivo (histórico do contrato, faturamento, ConfereAI, proposta, Documento)
// guarda a referência (`...ArquivoId`), nunca uma URL própria nem uma cópia.
// Unicidade de (clienteId, sha256) entre os NÃO removidos é um índice único
// parcial criado à mão na migração 20260924100000 — o Prisma não expressa
// `WHERE "removidoEm" IS NULL`.
// ---------------------------------------------------------------------------

enum CategoriaArquivo {
  PROPOSTA_COMERCIAL
  PROPOSTA_ADITIVO
  TERMO_CONTRATO
  TERMO_ADITIVO
  MEDICAO
  FATURA_NF
  PLANILHA
  OFICIO_SEI
  RELATORIO_GERADO
  OUTRO
}

enum OrigemArquivo {
  upload
  gerado
  migrado
}

model ArquivoCliente {
  id             String           @id
  clienteId      String
  cliente        Cliente          @relation(fields: [clienteId], references: [id])
  contratoId     String?
  contrato       Contrato?        @relation(fields: [contratoId], references: [id])
  competenciaAno Int?
  competenciaMes Int?
  categoria      CategoriaArquivo
  nome           String
  extensao       String
  contentType    String
  tamanhoBytes   Int
  sha256         String
  // Nunca vai pro navegador — a entrega é sempre por /api/arquivos/[id].
  urlBlob        String
  origem         OrigemArquivo
  enviadoPorId   String?
  enviadoPor     Usuario?         @relation("ArquivosEnviados", fields: [enviadoPorId], references: [id])
  createdAt      DateTime         @default(now())
  removidoEm     DateTime?
  documentos     Documento[]
  acessos        AcessoArquivo[]

  @@index([clienteId, createdAt])
  @@index([clienteId, categoria])
  @@index([contratoId])
}

model AcessoArquivo {
  id        String         @id @default(cuid())
  arquivoId String
  arquivo   ArquivoCliente @relation(fields: [arquivoId], references: [id])
  usuarioId String
  usuario   Usuario        @relation("AcessosArquivo", fields: [usuarioId], references: [id])
  acao      String // visualizou | baixou
  createdAt DateTime       @default(now())

  @@index([arquivoId])
}
```

- [ ] **Step 2: Acrescentar as relações de volta nos models existentes**

Em `model Usuario`, depois de `clientesPermitidos`:
```prisma
  arquivosEnviados   ArquivoCliente[]  @relation("ArquivosEnviados")
  acessosArquivo     AcessoArquivo[]   @relation("AcessosArquivo")
```
Em `model Cliente`, depois de `solicitacoes`:
```prisma
  arquivos             ArquivoCliente[]
```
Em `model Contrato`, depois de `termosConfirmacao`:
```prisma
  arquivos          ArquivoCliente[]
```
Em `model Documento`, depois de `competenciaMes`:
```prisma
  // Registro no repositório do cliente (mesmo blob de `caminhoOriginal`) — preenchido pelo
  // script scripts/migrar-documentos-para-repositorio.ts. O fluxo antigo continua lendo
  // `caminhoOriginal`.
  arquivoId            String?
  arquivo              ArquivoCliente?      @relation(fields: [arquivoId], references: [id])
```

- [ ] **Step 3: Validar o schema**

Run: `npx prisma validate`
Expected: `The schema at prisma/schema.prisma is valid 🚀`

- [ ] **Step 4: Gerar a migração contra o banco local**

Docker Desktop precisa estar de pé (`docker start verai-postgres`).

Run:
```bash
mkdir -p prisma/migrations/20260924100000_repositorio_arquivos_cliente
npx dotenv -e .env.development -- bash -c 'npx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --script' > prisma/migrations/20260924100000_repositorio_arquivos_cliente/migration.sql
```
Expected: o arquivo contém `CREATE TYPE "CategoriaArquivo"`, `CREATE TYPE "OrigemArquivo"`, `CREATE TABLE "ArquivoCliente"`, `CREATE TABLE "AcessoArquivo"`, `ALTER TABLE "Documento" ADD COLUMN "arquivoId"` e as FKs — **e nada mais**. Se aparecer qualquer outra tabela/coluna, o banco local está atrasado em relação a migrações existentes: rode `npx dotenv -e .env.development -- npx prisma migrate deploy` antes e gere de novo.

- [ ] **Step 5: Acrescentar o índice único parcial ao fim do `migration.sql`**

```sql
-- Mesmo conteúdo no mesmo cliente é um registro só (spec §3.4 regra 1). Parcial: um arquivo
-- removido (lógico) não impede reenviar o mesmo conteúdo.
CREATE UNIQUE INDEX "ArquivoCliente_clienteId_sha256_ativo_key"
  ON "ArquivoCliente" ("clienteId", "sha256")
  WHERE "removidoEm" IS NULL;
```

- [ ] **Step 6: Aplicar no banco local e regerar o client**

Run: `npx dotenv -e .env.development -- npx prisma migrate deploy && npx prisma generate`
Expected: `Applying migration 20260924100000_repositorio_arquivos_cliente` e `Generated Prisma Client`.

- [ ] **Step 7: Verificar**

Run: `npx tsc --noEmit && npx jest`
Expected: sem erro de tipo; testes passando.

- [ ] **Step 8: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260924100000_repositorio_arquivos_cliente/migration.sql
git commit -m "feat(prisma): ArquivoCliente, AcessoArquivo e Documento.arquivoId (repositório, Fase 1, Task 1)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Helpers puros — categorias, tipos de arquivo e caminhos

**Files:**
- Create: `src/lib/arquivos/tipos.ts`, `src/lib/arquivos/tipos.test.ts`
- Create: `src/lib/arquivos/caminhos.ts`, `src/lib/arquivos/caminhos.test.ts`

**Interfaces:**
- Consumes: `CategoriaArquivo` de `@prisma/client` (Task 1).
- Produces (`tipos.ts`): `CATEGORIAS: ReadonlyArray<{ valor: CategoriaArquivo; rotulo: string }>`, `rotuloCategoria(c: CategoriaArquivo): string`, `extensaoDe(nome: string): string`, `contentTypeDe(nome: string): string`, `sugerirCategoria(nome: string): CategoriaArquivo`, `categoriaDoDocumento(tipo: string): CategoriaArquivo`, `formatarTamanho(bytes: number): string`.
- Produces (`caminhos.ts`): `PREFIXO_TEMPORARIO = 'tmp-arquivos/'`, `TAMANHO_MAXIMO_ARQUIVO_BYTES = 50 * 1024 * 1024`, `nomeSeguro(nome: string): string`, `caminhoTemporario(nome: string): string`, `caminhoFinalArquivo(clienteId: string, arquivoId: string, nome: string): string`, `urlTemporariaValida(url: unknown): boolean`.

`tipos.ts` e `caminhos.ts` são usados no navegador também — **não** importar `@/lib/prisma`, `node:crypto` nem nada de servidor. Importar `CategoriaArquivo` só como `import type`.

- [ ] **Step 1: Testes falhando**

`src/lib/arquivos/tipos.test.ts`:
```ts
import { categoriaDoDocumento, contentTypeDe, extensaoDe, formatarTamanho, rotuloCategoria, sugerirCategoria } from './tipos'

describe('sugerirCategoria', () => {
  it.each([
    ['PC_SMS_211014_136_v4.0.pdf', 'PROPOSTA_COMERCIAL'],
    ['pa-sme-aditivo-2.pdf', 'PROPOSTA_ADITIVO'],
    ['TC 012-2020.pdf', 'TERMO_CONTRATO'],
    ['ta_003_2024.pdf', 'TERMO_ADITIVO'],
    ['Medição agosto 2026.xlsx', 'MEDICAO'],
    ['levantamento_08.XLSX', 'MEDICAO'],
    ['levantamento.pdf', 'OUTRO'],
    ['pcsms.pdf', 'OUTRO'],
    ['planilha de preços.xlsx', 'OUTRO'],
    ['foto.jpg', 'OUTRO'],
  ])('%s → %s', (nome, esperado) => {
    expect(sugerirCategoria(nome)).toBe(esperado)
  })
})

describe('categoriaDoDocumento', () => {
  it.each([
    ['xlsx', 'PLANILHA'],
    ['csv', 'PLANILHA'],
    ['pdf', 'OUTRO'],
    ['docx', 'OUTRO'],
  ])('%s → %s', (tipo, esperado) => {
    expect(categoriaDoDocumento(tipo)).toBe(esperado)
  })
})

describe('extensaoDe / contentTypeDe', () => {
  it('extensão em minúsculas, vazia sem ponto', () => {
    expect(extensaoDe('Relatório.Final.PDF')).toBe('pdf')
    expect(extensaoDe('LEIAME')).toBe('')
  })

  it('content type conhecido ou octet-stream', () => {
    expect(contentTypeDe('a.pdf')).toBe('application/pdf')
    expect(contentTypeDe('a.xlsx')).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    expect(contentTypeDe('a.docx')).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    expect(contentTypeDe('a.xyz')).toBe('application/octet-stream')
  })
})

describe('rotuloCategoria / formatarTamanho', () => {
  it('rótulo em português', () => {
    expect(rotuloCategoria('PROPOSTA_COMERCIAL')).toBe('Proposta comercial')
    expect(rotuloCategoria('OFICIO_SEI')).toBe('Ofício / SEI')
  })

  it('tamanho legível', () => {
    expect(formatarTamanho(512)).toBe('512 B')
    expect(formatarTamanho(2048)).toBe('2 KB')
    expect(formatarTamanho(5 * 1024 * 1024)).toBe('5.0 MB')
  })
})
```

`src/lib/arquivos/caminhos.test.ts`:
```ts
import { caminhoFinalArquivo, caminhoTemporario, nomeSeguro, PREFIXO_TEMPORARIO, urlTemporariaValida } from './caminhos'

describe('nomeSeguro', () => {
  it('tira acento e troca o que não é letra/número/ponto/hífen por _', () => {
    expect(nomeSeguro('Medição agosto/2026 (final).xlsx')).toBe('Medicao_agosto_2026_final_.xlsx')
  })

  it('limita a 120 caracteres preservando a extensão', () => {
    const nome = `${'a'.repeat(200)}.pdf`
    expect(nomeSeguro(nome)).toHaveLength(120)
    expect(nomeSeguro(nome).endsWith('.pdf')).toBe(true)
  })
})

describe('caminhos', () => {
  it('temporário fica sob o prefixo', () => {
    expect(caminhoTemporario('x.pdf').startsWith(PREFIXO_TEMPORARIO)).toBe(true)
    expect(caminhoTemporario('x.pdf').endsWith('-x.pdf')).toBe(true)
  })

  it('final é por cliente e por arquivo', () => {
    expect(caminhoFinalArquivo('c1', 'a1', 'PC 01.pdf')).toBe('clientes/c1/a1/PC_01.pdf')
  })
})

describe('urlTemporariaValida', () => {
  const base = 'https://abc123.public.blob.vercel-storage.com'

  it('aceita URL https do Blob sob o prefixo temporário', () => {
    expect(urlTemporariaValida(`${base}/tmp-arquivos/uuid-x-AbCd.pdf`)).toBe(true)
  })

  it.each([
    `${base}/clientes/c1/a1/x.pdf`,
    'https://evil.example.com/tmp-arquivos/x.pdf',
    'http://abc123.public.blob.vercel-storage.com/tmp-arquivos/x.pdf',
    'not a url',
    42,
    null,
  ])('rejeita %p', (url) => {
    expect(urlTemporariaValida(url)).toBe(false)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx jest src/lib/arquivos`
Expected: FAIL — `Cannot find module './tipos'` / `'./caminhos'`.

- [ ] **Step 3: Implementar**

`src/lib/arquivos/tipos.ts`:
```ts
import type { CategoriaArquivo } from '@prisma/client'

// Regras de apresentação e classificação dos arquivos do repositório do cliente. Roda no navegador
// e no servidor — nada de import de servidor aqui.

export const CATEGORIAS: ReadonlyArray<{ valor: CategoriaArquivo; rotulo: string }> = [
  { valor: 'PROPOSTA_COMERCIAL', rotulo: 'Proposta comercial' },
  { valor: 'PROPOSTA_ADITIVO', rotulo: 'Proposta de aditivo' },
  { valor: 'TERMO_CONTRATO', rotulo: 'Termo de contrato' },
  { valor: 'TERMO_ADITIVO', rotulo: 'Termo aditivo' },
  { valor: 'MEDICAO', rotulo: 'Medição' },
  { valor: 'FATURA_NF', rotulo: 'Fatura / nota fiscal' },
  { valor: 'PLANILHA', rotulo: 'Planilha' },
  { valor: 'OFICIO_SEI', rotulo: 'Ofício / SEI' },
  { valor: 'RELATORIO_GERADO', rotulo: 'Relatório gerado' },
  { valor: 'OUTRO', rotulo: 'Outro' },
]

export function rotuloCategoria(categoria: CategoriaArquivo): string {
  return CATEGORIAS.find((c) => c.valor === categoria)?.rotulo ?? categoria
}

export function extensaoDe(nome: string): string {
  const partes = nome.split('.')
  return partes.length > 1 ? partes.pop()!.toLowerCase() : ''
}

const CONTENT_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xls: 'application/vnd.ms-excel',
  csv: 'text/csv',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  doc: 'application/msword',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  txt: 'text/plain',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  zip: 'application/zip',
}

export function contentTypeDe(nome: string): string {
  return CONTENT_TYPES[extensaoDe(nome)] ?? 'application/octet-stream'
}

const PLANILHA = new Set(['xlsx', 'xls', 'csv'])

/** Sugestão pelo nome (spec §3.5) — o usuário sempre confirma. Prefixo PC/PA/TC/TA precisa de
 *  separador depois (`PC_`, `pa-`, `TC `), senão "pcsms.pdf" viraria proposta. */
export function sugerirCategoria(nome: string): CategoriaArquivo {
  const base = nome.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const prefixo = /^(pc|pa|tc|ta)[_\-\s]/.exec(base)?.[1]
  if (prefixo === 'pc') return 'PROPOSTA_COMERCIAL'
  if (prefixo === 'pa') return 'PROPOSTA_ADITIVO'
  if (prefixo === 'tc') return 'TERMO_CONTRATO'
  if (prefixo === 'ta') return 'TERMO_ADITIVO'
  if (PLANILHA.has(extensaoDe(nome)) && /medi|levant/.test(base)) return 'MEDICAO'
  return 'OUTRO'
}

/** Categoria dos `Documento` antigos na migração (spec §3.7): planilha ou outro. */
export function categoriaDoDocumento(tipo: string): CategoriaArquivo {
  return PLANILHA.has(tipo.toLowerCase()) ? 'PLANILHA' : 'OUTRO'
}

export function formatarTamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
```

`src/lib/arquivos/caminhos.ts`:
```ts
// Caminhos no Vercel Blob do repositório do cliente. Roda no navegador e no servidor.

export const PREFIXO_TEMPORARIO = 'tmp-arquivos/'
export const TAMANHO_MAXIMO_ARQUIVO_BYTES = 50 * 1024 * 1024

const LIMITE_NOME = 120

/** Nome utilizável em caminho de blob: sem acento, só `[A-Za-z0-9._-]`, até 120 caracteres com a
 *  extensão preservada. */
export function nomeSeguro(nome: string): string {
  const limpo = nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9.\-]+/g, '_')
  if (limpo.length <= LIMITE_NOME) return limpo
  const ponto = limpo.lastIndexOf('.')
  const extensao = ponto > 0 ? limpo.slice(ponto) : ''
  return limpo.slice(0, LIMITE_NOME - extensao.length) + extensao
}

export function caminhoTemporario(nome: string): string {
  return `${PREFIXO_TEMPORARIO}${crypto.randomUUID()}-${nomeSeguro(nome)}`
}

export function caminhoFinalArquivo(clienteId: string, arquivoId: string, nome: string): string {
  return `clientes/${clienteId}/${arquivoId}/${nomeSeguro(nome)}`
}

/** O servidor só baixa (e registra) o que veio do upload direto: https, host do Vercel Blob, sob o
 *  prefixo temporário. Qualquer outra URL seria o servidor buscando endereço arbitrário. */
export function urlTemporariaValida(url: unknown): boolean {
  if (typeof url !== 'string') return false
  try {
    const u = new URL(url)
    return (
      u.protocol === 'https:' &&
      u.hostname.endsWith('.public.blob.vercel-storage.com') &&
      u.pathname.startsWith(`/${PREFIXO_TEMPORARIO}`)
    )
  } catch {
    return false
  }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx jest src/lib/arquivos`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/arquivos/tipos.ts src/lib/arquivos/tipos.test.ts src/lib/arquivos/caminhos.ts src/lib/arquivos/caminhos.test.ts
git commit -m "feat(arquivos): categorias, tipos e caminhos do repositório do cliente (Fase 1, Task 2)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Serviço do servidor — registrar, usos e serialização

**Files:**
- Create: `src/lib/arquivos/servico.ts`, `src/lib/arquivos/servico.test.ts`

**Interfaces:**
- Consumes: `caminhoFinalArquivo` (Task 2), `contentTypeDe`, `extensaoDe` (Task 2); `getUpload`, `putUpload`, `deleteUpload` de `src/lib/storage.ts`; `formatarCompetencia`, `nomeCompetencia` de `src/lib/competencia.ts`.
- Produces:
  - `sha256Hex(buffer: Buffer): string`
  - `SELECT_ARQUIVO` (Prisma select sem `urlBlob`) e `type ArquivoSelecionado`
  - `interface UsoArquivo { tipo: 'analise-documento'; rotulo: string; href: string }`
  - `interface DadosRegistro { clienteId: string; urlTemporaria: string; nome: string; categoria: CategoriaArquivo; contratoId: string | null; competenciaAno: number | null; competenciaMes: number | null; enviadoPorId: string }`
  - `registrarArquivo(dados: DadosRegistro): Promise<{ arquivo: ArquivoSelecionado; duplicado: boolean }>`
  - `usosDosArquivos(ids: string[]): Promise<Map<string, UsoArquivo[]>>`
  - `serializarArquivo(arquivo: ArquivoSelecionado, usos: UsoArquivo[]): ArquivoSelecionado & { usos: UsoArquivo[] }`

- [ ] **Step 1: Teste falhando**

`src/lib/arquivos/servico.test.ts`:
```ts
/** @jest-environment node */
import { Prisma } from '@prisma/client'

jest.mock('@/lib/prisma', () => ({
  prisma: {
    arquivoCliente: { findFirst: jest.fn(), create: jest.fn() },
    documento: { findMany: jest.fn() },
  },
}))
jest.mock('@/lib/storage', () => ({
  getUpload: jest.fn(),
  putUpload: jest.fn(),
  deleteUpload: jest.fn(),
}))

import { prisma } from '@/lib/prisma'
import { deleteUpload, getUpload, putUpload } from '@/lib/storage'
import { registrarArquivo, sha256Hex, usosDosArquivos } from './servico'

const conteudo = Buffer.from('conteúdo do pdf')
const hash = sha256Hex(conteudo)
const tmp = 'https://x.public.blob.vercel-storage.com/tmp-arquivos/u-PC_01.pdf'
const dados = {
  clienteId: 'c1',
  urlTemporaria: tmp,
  nome: 'PC 01.pdf',
  categoria: 'PROPOSTA_COMERCIAL' as const,
  contratoId: 'k1',
  competenciaAno: null,
  competenciaMes: null,
  enviadoPorId: 'u1',
}

beforeEach(() => {
  jest.clearAllMocks()
  ;(getUpload as jest.Mock).mockResolvedValue(conteudo)
  ;(putUpload as jest.Mock).mockResolvedValue('https://x.public.blob.vercel-storage.com/clientes/c1/id/PC_01.pdf')
  ;(deleteUpload as jest.Mock).mockResolvedValue(undefined)
  ;(prisma.arquivoCliente.findFirst as jest.Mock).mockResolvedValue(null)
  ;(prisma.arquivoCliente.create as jest.Mock).mockImplementation(({ data }) => ({ id: data.id, nome: data.nome }))
})

describe('sha256Hex', () => {
  it('hex de 64 caracteres', () => {
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
  })
})

describe('registrarArquivo', () => {
  it('arquivo novo: copia pro caminho final, grava com hash e apaga o temporário', async () => {
    const { arquivo, duplicado } = await registrarArquivo(dados)

    expect(duplicado).toBe(false)
    const { data } = (prisma.arquivoCliente.create as jest.Mock).mock.calls[0][0]
    expect(putUpload).toHaveBeenCalledWith(`clientes/c1/${data.id}/PC_01.pdf`, conteudo, 'application/pdf')
    expect(data).toMatchObject({
      clienteId: 'c1',
      contratoId: 'k1',
      categoria: 'PROPOSTA_COMERCIAL',
      nome: 'PC 01.pdf',
      extensao: 'pdf',
      contentType: 'application/pdf',
      tamanhoBytes: conteudo.length,
      sha256: hash,
      origem: 'upload',
      enviadoPorId: 'u1',
      urlBlob: 'https://x.public.blob.vercel-storage.com/clientes/c1/id/PC_01.pdf',
    })
    expect(arquivo.id).toBe(data.id)
    expect(deleteUpload).toHaveBeenCalledWith(tmp)
  })

  it('mesmo conteúdo já no cliente: devolve o existente, não grava nada e apaga o temporário', async () => {
    ;(prisma.arquivoCliente.findFirst as jest.Mock).mockResolvedValue({ id: 'a-existente' })

    const resultado = await registrarArquivo(dados)

    expect(resultado).toEqual({ arquivo: { id: 'a-existente' }, duplicado: true })
    expect(prisma.arquivoCliente.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { clienteId: 'c1', sha256: hash, removidoEm: null } })
    )
    expect(putUpload).not.toHaveBeenCalled()
    expect(prisma.arquivoCliente.create).not.toHaveBeenCalled()
    expect(deleteUpload).toHaveBeenCalledWith(tmp)
  })

  it('corrida (P2002 no índice único): devolve o que o outro gravou', async () => {
    ;(prisma.arquivoCliente.findFirst as jest.Mock).mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'a-outro' })
    ;(prisma.arquivoCliente.create as jest.Mock).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('unique', { code: 'P2002', clientVersion: 'x' })
    )

    expect(await registrarArquivo(dados)).toEqual({ arquivo: { id: 'a-outro' }, duplicado: true })
  })

  it('falha em apagar o temporário não derruba o registro', async () => {
    ;(deleteUpload as jest.Mock).mockRejectedValue(new Error('blob fora'))
    await expect(registrarArquivo(dados)).resolves.toMatchObject({ duplicado: false })
  })
})

describe('usosDosArquivos', () => {
  it('Documento antigo vira "Análise por IA" com link pra competência', async () => {
    ;(prisma.documento.findMany as jest.Mock).mockResolvedValue([
      { arquivoId: 'a1', clienteId: 'c1', competenciaAno: 2026, competenciaMes: 6 },
    ])

    const usos = await usosDosArquivos(['a1', 'a2'])

    expect(prisma.documento.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { arquivoId: { in: ['a1', 'a2'] } } })
    )
    expect(usos.get('a1')).toEqual([
      { tipo: 'analise-documento', rotulo: 'Análise por IA · Junho/2026', href: '/clientes/c1/2026-06' },
    ])
    expect(usos.get('a2')).toEqual([])
  })

  it('lista vazia não consulta o banco', async () => {
    expect((await usosDosArquivos([])).size).toBe(0)
    expect(prisma.documento.findMany).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx jest src/lib/arquivos/servico.test.ts`
Expected: FAIL — `Cannot find module './servico'`.

- [ ] **Step 3: Implementar**

`src/lib/arquivos/servico.ts`:
```ts
import { createHash, randomUUID } from 'node:crypto'
import { Prisma, type CategoriaArquivo } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { deleteUpload, getUpload, putUpload } from '@/lib/storage'
import { formatarCompetencia, nomeCompetencia } from '@/lib/competencia'
import { caminhoFinalArquivo } from './caminhos'
import { contentTypeDe, extensaoDe } from './tipos'

// Serviço do repositório de documentos do cliente (spec
// docs/superpowers/specs/2026-09-23-repositorio-documentos-cliente-design.md). Só servidor.

export function sha256Hex(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex')
}

/** Tudo que a tela precisa — **sem `urlBlob`**, que nunca sai do servidor (spec §3.4 regra 3). */
export const SELECT_ARQUIVO = {
  id: true,
  clienteId: true,
  contratoId: true,
  competenciaAno: true,
  competenciaMes: true,
  categoria: true,
  nome: true,
  extensao: true,
  contentType: true,
  tamanhoBytes: true,
  sha256: true,
  origem: true,
  createdAt: true,
  enviadoPor: { select: { nome: true } },
  contrato: { select: { id: true, numeroTermo: true } },
} satisfies Prisma.ArquivoClienteSelect

export type ArquivoSelecionado = Prisma.ArquivoClienteGetPayload<{ select: typeof SELECT_ARQUIVO }>

export interface UsoArquivo {
  tipo: 'analise-documento'
  rotulo: string
  href: string
}

export interface DadosRegistro {
  clienteId: string
  urlTemporaria: string
  nome: string
  categoria: CategoriaArquivo
  contratoId: string | null
  competenciaAno: number | null
  competenciaMes: number | null
  enviadoPorId: string
}

function existente(clienteId: string, sha256: string) {
  return prisma.arquivoCliente.findFirst({ where: { clienteId, sha256, removidoEm: null }, select: SELECT_ARQUIVO })
}

/** Registra um arquivo que o navegador subiu direto pro Blob (caminho temporário): baixa servidor a
 *  servidor, calcula o hash, e — se o cliente ainda não tem esse conteúdo — copia pro caminho final e
 *  grava. O temporário é apagado nos dois casos (best-effort: o `validUntil` do token limpa o resto). */
export async function registrarArquivo(dados: DadosRegistro): Promise<{ arquivo: ArquivoSelecionado; duplicado: boolean }> {
  const buffer = await getUpload(dados.urlTemporaria)
  const sha256 = sha256Hex(buffer)
  const apagarTemporario = () => deleteUpload(dados.urlTemporaria).catch(() => {})

  const jaExiste = await existente(dados.clienteId, sha256)
  if (jaExiste) {
    await apagarTemporario()
    return { arquivo: jaExiste, duplicado: true }
  }

  const id = randomUUID()
  const contentType = contentTypeDe(dados.nome)
  const urlBlob = await putUpload(caminhoFinalArquivo(dados.clienteId, id, dados.nome), buffer, contentType)
  try {
    const arquivo = await prisma.arquivoCliente.create({
      data: {
        id,
        clienteId: dados.clienteId,
        contratoId: dados.contratoId,
        competenciaAno: dados.competenciaAno,
        competenciaMes: dados.competenciaMes,
        categoria: dados.categoria,
        nome: dados.nome,
        extensao: extensaoDe(dados.nome),
        contentType,
        tamanhoBytes: buffer.length,
        sha256,
        urlBlob,
        origem: 'upload',
        enviadoPorId: dados.enviadoPorId,
      },
      select: SELECT_ARQUIVO,
    })
    await apagarTemporario()
    return { arquivo, duplicado: false }
  } catch (erro) {
    // Dois envios do mesmo conteúdo ao mesmo tempo: o índice único parcial barra o segundo.
    if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === 'P2002') {
      const doOutro = await existente(dados.clienteId, sha256)
      if (doOutro) {
        await apagarTemporario()
        return { arquivo: doOutro, duplicado: true }
      }
    }
    throw erro
  }
}

/** Onde cada arquivo é usado. Fase 1 só conhece `Documento` (análise por IA antiga); as fases 2–4
 *  acrescentam aqui histórico do contrato, faturamento, ConfereAI e proposta comercial. */
export async function usosDosArquivos(ids: string[]): Promise<Map<string, UsoArquivo[]>> {
  const usos = new Map<string, UsoArquivo[]>(ids.map((id) => [id, []]))
  if (ids.length === 0) return usos

  const documentos = await prisma.documento.findMany({
    where: { arquivoId: { in: ids } },
    select: { arquivoId: true, clienteId: true, competenciaAno: true, competenciaMes: true },
  })
  for (const doc of documentos) {
    usos.get(doc.arquivoId!)?.push({
      tipo: 'analise-documento',
      rotulo: `Análise por IA · ${nomeCompetencia(doc.competenciaAno, doc.competenciaMes)}`,
      href: `/clientes/${doc.clienteId}/${formatarCompetencia(doc.competenciaAno, doc.competenciaMes)}`,
    })
  }
  return usos
}

export function serializarArquivo(arquivo: ArquivoSelecionado, usos: UsoArquivo[]) {
  return { ...arquivo, usos }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx jest src/lib/arquivos/servico.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/arquivos/servico.ts src/lib/arquivos/servico.test.ts
git commit -m "feat(arquivos): registrar com hash e deduplicação, usos de um arquivo (Fase 1, Task 3)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Rotas de envio — token de upload, lista e registro por cliente, checagem de duplicado

**Files:**
- Create: `src/app/api/arquivos/upload-token/route.ts` (+ `route.test.ts`)
- Create: `src/app/api/clientes/[clienteId]/arquivos/esquema.ts`
- Create: `src/app/api/clientes/[clienteId]/arquivos/route.ts` (+ `route.test.ts`)
- Create: `src/app/api/clientes/[clienteId]/arquivos/existe/route.ts` (+ `route.test.ts`)

**Interfaces:**
- Consumes: `PREFIXO_TEMPORARIO`, `TAMANHO_MAXIMO_ARQUIVO_BYTES`, `urlTemporariaValida` (Task 2); `registrarArquivo`, `usosDosArquivos`, `serializarArquivo`, `SELECT_ARQUIVO` (Task 3); `exigirUsuario`, `exigirAcessoCliente` (`src/lib/relatorios-clientes/acesso.ts`); `lerCorpo`, `textoObrigatorio`, `textoOpcional`, `inteiroEntre` (`src/lib/relatorios-clientes/validacao.ts`); `contratoForaDoCliente` (`src/app/api/contratos/carregar.ts`).
- Produces (HTTP):
  - `POST /api/arquivos/upload-token` — protocolo `handleUpload` do `@vercel/blob/client`; só aceita `pathname` sob `tmp-arquivos/`.
  - `GET /api/clientes/[clienteId]/arquivos` → `{ arquivos: Array<ArquivoSelecionado & { usos: UsoArquivo[] }>, resumo: { total: number, bytes: number } }` (não removidos, mais recentes primeiro).
  - `POST /api/clientes/[clienteId]/arquivos` corpo `{ urlTemporaria, nome, categoria, contratoId?, competenciaAno?, competenciaMes? }` → 201 `{ arquivo, duplicado: false }` ou 200 `{ arquivo, duplicado: true }`.
  - `GET /api/clientes/[clienteId]/arquivos/existe?sha256=<64 hex>` → `{ arquivo: (ArquivoSelecionado & { usos }) | null }`.
  - `esquema.ts`: `esquemaRegistro`, `esquemaEdicao` (usado na Task 5), `ROTULOS_ARQUIVO`.

- [ ] **Step 1: Testes falhando**

`src/app/api/arquivos/upload-token/route.test.ts`:
```ts
/** @jest-environment node */
import { NextRequest } from 'next/server'

jest.mock('@/lib/auth', () => ({ ...jest.requireActual('@/lib/auth'), getAuthUser: jest.fn() }))
jest.mock('@vercel/blob/client', () => ({ handleUpload: jest.fn() }))

import { getAuthUser } from '@/lib/auth'
import { handleUpload } from '@vercel/blob/client'
import { POST } from './route'

const requisicao = () =>
  new NextRequest('http://localhost/api/arquivos/upload-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'blob.generate-client-token', payload: {} }),
  })

beforeEach(() => {
  jest.clearAllMocks()
  ;(getAuthUser as jest.Mock).mockResolvedValue({ id: 'u1', role: 'admin' })
  ;(handleUpload as jest.Mock).mockResolvedValue({ type: 'blob.generate-client-token', clientToken: 't' })
})

describe('POST /api/arquivos/upload-token', () => {
  it('401 sem usuário, sem gerar token', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(null)
    expect((await POST(requisicao())).status).toBe(401)
    expect(handleUpload).not.toHaveBeenCalled()
  })

  it('devolve o que o handleUpload devolve', async () => {
    await expect((await POST(requisicao())).json()).resolves.toEqual({ type: 'blob.generate-client-token', clientToken: 't' })
  })

  it('token só pra caminho temporário, com teto de 50 MB e validade de 1h', async () => {
    await POST(requisicao())
    const { onBeforeGenerateToken } = (handleUpload as jest.Mock).mock.calls[0][0]

    await expect(onBeforeGenerateToken('clientes/c1/x.pdf')).rejects.toThrow('caminho de upload inválido')
    const opcoes = await onBeforeGenerateToken('tmp-arquivos/u-x.pdf')
    expect(opcoes).toMatchObject({ addRandomSuffix: true, maximumSizeInBytes: 50 * 1024 * 1024 })
    expect(opcoes.validUntil).toBeGreaterThan(Date.now() + 59 * 60 * 1000)
  })

  it('erro do handleUpload vira 400', async () => {
    ;(handleUpload as jest.Mock).mockRejectedValue(new Error('caminho de upload inválido'))
    const resposta = await POST(requisicao())
    expect(resposta.status).toBe(400)
    await expect(resposta.json()).resolves.toEqual({ error: 'caminho de upload inválido' })
  })
})
```

`src/app/api/clientes/[clienteId]/arquivos/route.test.ts`:
```ts
/** @jest-environment node */
import { NextRequest } from 'next/server'

jest.mock('@/lib/auth', () => ({ ...jest.requireActual('@/lib/auth'), getAuthUser: jest.fn() }))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    cliente: { findUnique: jest.fn() },
    contrato: { findUnique: jest.fn() },
    arquivoCliente: { findMany: jest.fn(), aggregate: jest.fn() },
    usuario: { findUnique: jest.fn() },
  },
}))
jest.mock('@/lib/arquivos/servico', () => ({
  ...jest.requireActual('@/lib/arquivos/servico'),
  registrarArquivo: jest.fn(),
  usosDosArquivos: jest.fn(),
}))

import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { registrarArquivo, usosDosArquivos } from '@/lib/arquivos/servico'
import { GET, POST } from './route'

const admin = { id: 'u1', nome: 'Admin', email: 'a@x', role: 'admin' as const }
const comum = { id: 'u2', nome: 'Comum', email: 'c@x', role: 'responsavel' as const }
const contexto = (clienteId = 'c1') => ({ params: Promise.resolve({ clienteId }) })
const base = 'http://localhost/api/clientes/c1/arquivos'
const tmp = 'https://x.public.blob.vercel-storage.com/tmp-arquivos/u-PC_01.pdf'
const post = (corpo: unknown) =>
  new NextRequest(base, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) })

beforeEach(() => {
  jest.clearAllMocks()
  ;(getAuthUser as jest.Mock).mockResolvedValue(admin)
  ;(prisma.usuario.findUnique as jest.Mock).mockResolvedValue({ clientesPermitidos: [{ id: 'c1' }] })
  ;(prisma.cliente.findUnique as jest.Mock).mockResolvedValue({ id: 'c1' })
  ;(prisma.contrato.findUnique as jest.Mock).mockResolvedValue({ clienteId: 'c1' })
  ;(prisma.arquivoCliente.findMany as jest.Mock).mockResolvedValue([])
  ;(prisma.arquivoCliente.aggregate as jest.Mock).mockResolvedValue({ _count: { _all: 0 }, _sum: { tamanhoBytes: null } })
  ;(usosDosArquivos as jest.Mock).mockResolvedValue(new Map())
  ;(registrarArquivo as jest.Mock).mockResolvedValue({ arquivo: { id: 'a1' }, duplicado: false })
})

describe('GET /api/clientes/[clienteId]/arquivos', () => {
  it('401 sem usuário', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(null)
    expect((await GET(new NextRequest(base), contexto())).status).toBe(401)
  })

  it('403 sem acesso ao cliente', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(comum)
    expect((await GET(new NextRequest(base), contexto('c9'))).status).toBe(403)
  })

  it('404 cliente inexistente', async () => {
    ;(prisma.cliente.findUnique as jest.Mock).mockResolvedValue(null)
    expect((await GET(new NextRequest(base), contexto())).status).toBe(404)
  })

  it('lista os não removidos, mais recentes primeiro, com usos e resumo', async () => {
    ;(prisma.arquivoCliente.findMany as jest.Mock).mockResolvedValue([{ id: 'a1', nome: 'x.pdf' }])
    ;(usosDosArquivos as jest.Mock).mockResolvedValue(new Map([['a1', [{ tipo: 'analise-documento', rotulo: 'r', href: 'h' }]]]))
    ;(prisma.arquivoCliente.aggregate as jest.Mock).mockResolvedValue({ _count: { _all: 1 }, _sum: { tamanhoBytes: 2048 } })

    const corpo = await (await GET(new NextRequest(base), contexto())).json()

    expect(prisma.arquivoCliente.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { clienteId: 'c1', removidoEm: null }, orderBy: { createdAt: 'desc' } })
    )
    const select = (prisma.arquivoCliente.findMany as jest.Mock).mock.calls[0][0].select
    expect(select.urlBlob).toBeUndefined()
    expect(corpo).toEqual({
      arquivos: [{ id: 'a1', nome: 'x.pdf', usos: [{ tipo: 'analise-documento', rotulo: 'r', href: 'h' }] }],
      resumo: { total: 1, bytes: 2048 },
    })
  })
})

describe('POST /api/clientes/[clienteId]/arquivos', () => {
  const valido = { urlTemporaria: tmp, nome: 'PC 01.pdf', categoria: 'PROPOSTA_COMERCIAL', contratoId: 'k1' }

  it('401 sem usuário', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(null)
    expect((await POST(post(valido), contexto())).status).toBe(401)
  })

  it('403 sem acesso', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(comum)
    expect((await POST(post(valido), contexto('c9'))).status).toBe(403)
  })

  it.each([
    [{ ...valido, urlTemporaria: 'https://evil.example.com/tmp-arquivos/x.pdf' }, 'Arquivo: upload inválido'],
    [{ ...valido, categoria: 'QUALQUER' }, 'Categoria: categoria inválida'],
    [{ ...valido, nome: '  ' }, 'Nome: campo obrigatório'],
    [{ ...valido, competenciaAno: 2026 }, 'Competência: informe mês e ano juntos'],
    [{ ...valido, competenciaAno: 2026, competenciaMes: 13 }, 'Mês: deve ser um número inteiro entre 1 e 12'],
  ])('400 com corpo inválido (%#)', async (corpo, mensagem) => {
    const resposta = await POST(post(corpo), contexto())
    expect(resposta.status).toBe(400)
    await expect(resposta.json()).resolves.toEqual({ error: mensagem })
    expect(registrarArquivo).not.toHaveBeenCalled()
  })

  it('400 quando o contrato é de outro cliente', async () => {
    ;(prisma.contrato.findUnique as jest.Mock).mockResolvedValue({ clienteId: 'c2' })
    const resposta = await POST(post(valido), contexto())
    expect(resposta.status).toBe(400)
    await expect(resposta.json()).resolves.toEqual({ error: 'Contrato: não pertence a este cliente' })
  })

  it('201 registra com o usuário como autor', async () => {
    const resposta = await POST(post({ ...valido, competenciaAno: '2026', competenciaMes: '8' }), contexto())

    expect(resposta.status).toBe(201)
    expect(registrarArquivo).toHaveBeenCalledWith({
      clienteId: 'c1',
      urlTemporaria: tmp,
      nome: 'PC 01.pdf',
      categoria: 'PROPOSTA_COMERCIAL',
      contratoId: 'k1',
      competenciaAno: 2026,
      competenciaMes: 8,
      enviadoPorId: 'u1',
    })
    await expect(resposta.json()).resolves.toEqual({ arquivo: { id: 'a1', usos: [] }, duplicado: false })
  })

  it('200 quando o conteúdo já estava no cliente', async () => {
    ;(registrarArquivo as jest.Mock).mockResolvedValue({ arquivo: { id: 'a-velho' }, duplicado: true })
    const resposta = await POST(post({ ...valido, contratoId: '' }), contexto())
    expect(resposta.status).toBe(200)
    expect((registrarArquivo as jest.Mock).mock.calls[0][0].contratoId).toBeNull()
    await expect(resposta.json()).resolves.toMatchObject({ duplicado: true })
  })
})
```

`src/app/api/clientes/[clienteId]/arquivos/existe/route.test.ts`:
```ts
/** @jest-environment node */
import { NextRequest } from 'next/server'

jest.mock('@/lib/auth', () => ({ ...jest.requireActual('@/lib/auth'), getAuthUser: jest.fn() }))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    arquivoCliente: { findFirst: jest.fn() },
    documento: { findMany: jest.fn() },
    usuario: { findUnique: jest.fn() },
  },
}))

import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { GET } from './route'

const hash = 'a'.repeat(64)
const get = (query: string, clienteId = 'c1') =>
  GET(new NextRequest(`http://localhost/api/clientes/${clienteId}/arquivos/existe${query}`), {
    params: Promise.resolve({ clienteId }),
  })

beforeEach(() => {
  jest.clearAllMocks()
  ;(getAuthUser as jest.Mock).mockResolvedValue({ id: 'u1', role: 'admin' })
  ;(prisma.arquivoCliente.findFirst as jest.Mock).mockResolvedValue(null)
  ;(prisma.documento.findMany as jest.Mock).mockResolvedValue([])
})

describe('GET /api/clientes/[clienteId]/arquivos/existe', () => {
  it('401 sem usuário', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(null)
    expect((await get(`?sha256=${hash}`)).status).toBe(401)
  })

  it.each(['', '?sha256=abc', `?sha256=${'g'.repeat(64)}`])('400 com hash inválido (%s)', async (query) => {
    expect((await get(query)).status).toBe(400)
  })

  it('null quando o cliente não tem o conteúdo', async () => {
    await expect((await get(`?sha256=${hash.toUpperCase()}`)).json()).resolves.toEqual({ arquivo: null })
    expect(prisma.arquivoCliente.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { clienteId: 'c1', sha256: hash, removidoEm: null } })
    )
  })

  it('devolve o existente com usos', async () => {
    ;(prisma.arquivoCliente.findFirst as jest.Mock).mockResolvedValue({ id: 'a1', nome: 'PC 01.pdf' })
    await expect((await get(`?sha256=${hash}`)).json()).resolves.toEqual({ arquivo: { id: 'a1', nome: 'PC 01.pdf', usos: [] } })
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx jest src/app/api/arquivos src/app/api/clientes/\\[clienteId\\]/arquivos`
Expected: FAIL — módulos `./route` inexistentes.

- [ ] **Step 3: Implementar**

`src/app/api/arquivos/upload-token/route.ts`:
```ts
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { NextRequest, NextResponse } from 'next/server'
import { exigirUsuario } from '@/lib/relatorios-clientes/acesso'
import { PREFIXO_TEMPORARIO, TAMANHO_MAXIMO_ARQUIVO_BYTES } from '@/lib/arquivos/caminhos'

/**
 * Token pro NAVEGADOR subir um arquivo do repositório direto pro Vercel Blob, sem passar pelo corpo
 * de nenhuma requisição do VerAI (função serverless recusa corpo acima de 4,5 MB). Mesmo padrão de
 * /api/propostas-comerciais/upload-token. O arquivo cai num caminho TEMPORÁRIO; quem registra no
 * repositório (e copia pro caminho final) é POST /api/clientes/[clienteId]/arquivos.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const autenticado = await exigirUsuario(request)
  if ('erro' in autenticado) return autenticado.erro

  const body = (await request.json()) as HandleUploadBody
  try {
    const resposta = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        if (!pathname.startsWith(PREFIXO_TEMPORARIO)) throw new Error('caminho de upload inválido')
        return {
          // Qualquer tipo de arquivo entra no repositório; o content type de verdade é decidido no
          // registro, pela extensão.
          allowedContentTypes: ['application/*', 'text/*', 'image/*'],
          addRandomSuffix: true,
          maximumSizeInBytes: TAMANHO_MAXIMO_ARQUIVO_BYTES,
          validUntil: Date.now() + 60 * 60 * 1000,
        }
      },
    })
    return NextResponse.json(resposta)
  } catch (erro) {
    return NextResponse.json({ error: erro instanceof Error ? erro.message : String(erro) }, { status: 400 })
  }
}
```

`src/app/api/clientes/[clienteId]/arquivos/esquema.ts`:
```ts
import { CategoriaArquivo } from '@prisma/client'
import { z } from 'zod'
import { inteiroEntre, textoObrigatorio, textoOpcional } from '@/lib/relatorios-clientes/validacao'
import { urlTemporariaValida } from '@/lib/arquivos/caminhos'

const categoria = z.enum(CategoriaArquivo, { error: 'categoria inválida' })

const competenciaJunta = (dados: { competenciaAno?: number | null; competenciaMes?: number | null }) =>
  (dados.competenciaAno == null) === (dados.competenciaMes == null)

const COMPETENCIA_JUNTA = { message: 'informe mês e ano juntos', path: ['competencia'] }

/** POST: registro de um arquivo que o navegador acabou de subir pro caminho temporário. */
export const esquemaRegistro = z
  .object({
    urlTemporaria: z.string().refine(urlTemporariaValida, 'upload inválido'),
    nome: textoObrigatorio,
    categoria,
    contratoId: textoOpcional,
    competenciaAno: inteiroEntre(2000, 2100).nullable().optional(),
    competenciaMes: inteiroEntre(1, 12).nullable().optional(),
  })
  .refine(competenciaJunta, COMPETENCIA_JUNTA)

/** PATCH /api/arquivos/[id]: reclassificação. Campo ausente não muda. */
export const esquemaEdicao = z
  .object({
    categoria: categoria.optional(),
    contratoId: textoOpcional,
    competenciaAno: inteiroEntre(2000, 2100).nullable().optional(),
    competenciaMes: inteiroEntre(1, 12).nullable().optional(),
  })
  .refine(competenciaJunta, COMPETENCIA_JUNTA)

export const ROTULOS_ARQUIVO = {
  urlTemporaria: 'Arquivo',
  nome: 'Nome',
  categoria: 'Categoria',
  contratoId: 'Contrato',
  competenciaAno: 'Ano',
  competenciaMes: 'Mês',
  competencia: 'Competência',
}
```

> Nota: `textoObrigatorio` com `'  '` produz a mensagem "campo obrigatório" (padrão do projeto). Se o teste acusar outra redação, ajuste **a asserção do teste** para a mensagem real de `textoObrigatorio`, não o helper.

`src/app/api/clientes/[clienteId]/arquivos/route.ts`:
```ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { exigirAcessoCliente } from '@/lib/relatorios-clientes/acesso'
import { lerCorpo } from '@/lib/relatorios-clientes/validacao'
import { contratoForaDoCliente } from '@/app/api/contratos/carregar'
import { SELECT_ARQUIVO, registrarArquivo, serializarArquivo, usosDosArquivos } from '@/lib/arquivos/servico'
import { ROTULOS_ARQUIVO, esquemaRegistro } from './esquema'

type Contexto = { params: Promise<{ clienteId: string }> }

async function clienteExiste(clienteId: string) {
  return (await prisma.cliente.findUnique({ where: { id: clienteId }, select: { id: true } })) !== null
}

const clienteNaoEncontrado = () => NextResponse.json({ error: 'cliente não encontrado' }, { status: 404 })

/** Repositório do cliente: todos os arquivos não removidos (a tela filtra), com onde cada um é usado. */
export async function GET(request: NextRequest, { params }: Contexto) {
  const { clienteId } = await params
  const acesso = await exigirAcessoCliente(request, clienteId)
  if ('erro' in acesso) return acesso.erro
  if (!(await clienteExiste(clienteId))) return clienteNaoEncontrado()

  const where = { clienteId, removidoEm: null }
  const [arquivos, agregado] = await Promise.all([
    prisma.arquivoCliente.findMany({ where, orderBy: { createdAt: 'desc' }, select: SELECT_ARQUIVO }),
    prisma.arquivoCliente.aggregate({ where, _count: { _all: true }, _sum: { tamanhoBytes: true } }),
  ])
  const usos = await usosDosArquivos(arquivos.map((a) => a.id))

  return NextResponse.json({
    arquivos: arquivos.map((a) => serializarArquivo(a, usos.get(a.id) ?? [])),
    resumo: { total: agregado._count._all, bytes: agregado._sum.tamanhoBytes ?? 0 },
  })
}

export async function POST(request: NextRequest, { params }: Contexto) {
  const { clienteId } = await params
  const acesso = await exigirAcessoCliente(request, clienteId)
  if ('erro' in acesso) return acesso.erro
  if (!(await clienteExiste(clienteId))) return clienteNaoEncontrado()

  const corpo = await lerCorpo(request, esquemaRegistro, ROTULOS_ARQUIVO)
  if ('erro' in corpo) return corpo.erro
  const dados = corpo.dados

  if (dados.contratoId) {
    const contratoInvalido = await contratoForaDoCliente(dados.contratoId, clienteId)
    if (contratoInvalido) return contratoInvalido
  }

  const { arquivo, duplicado } = await registrarArquivo({
    clienteId,
    urlTemporaria: dados.urlTemporaria,
    nome: dados.nome,
    categoria: dados.categoria,
    contratoId: dados.contratoId ?? null,
    competenciaAno: dados.competenciaAno ?? null,
    competenciaMes: dados.competenciaMes ?? null,
    enviadoPorId: acesso.usuario.id,
  })
  const usos = await usosDosArquivos([arquivo.id])
  return NextResponse.json(
    { arquivo: serializarArquivo(arquivo, usos.get(arquivo.id) ?? []), duplicado },
    { status: duplicado ? 200 : 201 }
  )
}
```

> O teste do POST mocka `usosDosArquivos` com `new Map()` e espera `usos: []` — o `?? []` cobre isso.

`src/app/api/clientes/[clienteId]/arquivos/existe/route.ts`:
```ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { exigirAcessoCliente } from '@/lib/relatorios-clientes/acesso'
import { SELECT_ARQUIVO, serializarArquivo, usosDosArquivos } from '@/lib/arquivos/servico'

type Contexto = { params: Promise<{ clienteId: string }> }

/** O navegador calcula o SHA-256 antes de subir e pergunta aqui — arquivo que o cliente já tem nem
 *  chega a ser enviado. Não substitui a checagem do registro (o servidor recalcula o hash lá). */
export async function GET(request: NextRequest, { params }: Contexto) {
  const { clienteId } = await params
  const acesso = await exigirAcessoCliente(request, clienteId)
  if ('erro' in acesso) return acesso.erro

  const sha256 = request.nextUrl.searchParams.get('sha256')?.toLowerCase() ?? ''
  if (!/^[0-9a-f]{64}$/.test(sha256)) return NextResponse.json({ error: 'sha256 inválido' }, { status: 400 })

  const arquivo = await prisma.arquivoCliente.findFirst({
    where: { clienteId, sha256, removidoEm: null },
    select: SELECT_ARQUIVO,
  })
  if (!arquivo) return NextResponse.json({ arquivo: null })
  const usos = await usosDosArquivos([arquivo.id])
  return NextResponse.json({ arquivo: serializarArquivo(arquivo, usos.get(arquivo.id) ?? []) })
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx jest src/app/api/arquivos src/app/api/clientes/\\[clienteId\\]/arquivos`
Expected: PASS. (Se a mensagem de `textoObrigatorio` ou `inteiroEntre` divergir, ajuste só a asserção — ver nota do Step 3.)

- [ ] **Step 5: Commit**

```bash
git add src/app/api/arquivos/upload-token "src/app/api/clientes/[clienteId]/arquivos"
git commit -m "feat(arquivos): token de upload direto, lista, registro e checagem de duplicado (Fase 1, Task 4)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Rotas do arquivo — entrega autenticada, reclassificação e remoção

**Files:**
- Create: `src/app/api/arquivos/carregar.ts`
- Create: `src/app/api/arquivos/[id]/route.ts` (+ `route.test.ts`)

**Interfaces:**
- Consumes: `exigirUsuario`, `verificarAcessoCliente`; `getUpload`; `SELECT_ARQUIVO`, `serializarArquivo`, `usosDosArquivos` (Task 3); `esquemaEdicao`, `ROTULOS_ARQUIVO` (Task 4); `contratoForaDoCliente`.
- Produces (HTTP):
  - `GET /api/arquivos/[id]` — conteúdo; `?modo=inline` → `Content-Disposition: inline` + `AcessoArquivo.acao = 'visualizou'`; sem modo → `attachment` + `'baixou'`.
  - `PATCH /api/arquivos/[id]` corpo `{ categoria?, contratoId?, competenciaAno?, competenciaMes? }` → arquivo serializado com usos.
  - `DELETE /api/arquivos/[id]` → 200 `{ ok: true }` ou 409 `{ error: 'arquivo em uso', usos }`.
  - `carregarArquivoComAcesso(request, id)` → `{ usuario, arquivo: { id, clienteId, nome, contentType, urlBlob } } | { erro: NextResponse }` (401 → 404 → 403).

- [ ] **Step 1: Teste falhando**

`src/app/api/arquivos/[id]/route.test.ts`:
```ts
/** @jest-environment node */
import { NextRequest } from 'next/server'

jest.mock('@/lib/auth', () => ({ ...jest.requireActual('@/lib/auth'), getAuthUser: jest.fn() }))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    arquivoCliente: { findFirst: jest.fn(), update: jest.fn() },
    acessoArquivo: { create: jest.fn() },
    contrato: { findUnique: jest.fn() },
    documento: { findMany: jest.fn() },
    usuario: { findUnique: jest.fn() },
  },
}))
jest.mock('@/lib/storage', () => ({ getUpload: jest.fn() }))

import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getUpload } from '@/lib/storage'
import { DELETE, GET, PATCH } from './route'

const admin = { id: 'u1', nome: 'Admin', email: 'a@x', role: 'admin' as const }
const comum = { id: 'u2', nome: 'Comum', email: 'c@x', role: 'responsavel' as const }
const contexto = { params: Promise.resolve({ id: 'a1' }) }
const url = 'http://localhost/api/arquivos/a1'
const registro = {
  id: 'a1',
  clienteId: 'c1',
  nome: 'Medição agosto.xlsx',
  contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  urlBlob: 'https://x.public.blob.vercel-storage.com/clientes/c1/a1/Medicao_agosto.xlsx',
}
const patch = (corpo: unknown) =>
  new NextRequest(url, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) })

beforeEach(() => {
  jest.clearAllMocks()
  ;(getAuthUser as jest.Mock).mockResolvedValue(admin)
  ;(prisma.usuario.findUnique as jest.Mock).mockResolvedValue({ clientesPermitidos: [{ id: 'c9' }] })
  ;(prisma.arquivoCliente.findFirst as jest.Mock).mockResolvedValue(registro)
  ;(prisma.arquivoCliente.update as jest.Mock).mockResolvedValue({ id: 'a1', categoria: 'MEDICAO' })
  ;(prisma.contrato.findUnique as jest.Mock).mockResolvedValue({ clienteId: 'c1' })
  ;(prisma.documento.findMany as jest.Mock).mockResolvedValue([])
  ;(getUpload as jest.Mock).mockResolvedValue(Buffer.from('xlsx'))
})

describe('acesso (vale pros três métodos)', () => {
  it('401 sem usuário', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(null)
    expect((await GET(new NextRequest(url), contexto)).status).toBe(401)
  })

  it('404 inexistente ou removido', async () => {
    ;(prisma.arquivoCliente.findFirst as jest.Mock).mockResolvedValue(null)
    const resposta = await GET(new NextRequest(url), contexto)
    expect(resposta.status).toBe(404)
    expect(prisma.arquivoCliente.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'a1', removidoEm: null } })
    )
  })

  it('403 arquivo de cliente que o usuário não vê', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(comum)
    expect((await DELETE(new NextRequest(url, { method: 'DELETE' }), contexto)).status).toBe(403)
  })
})

describe('GET /api/arquivos/[id]', () => {
  it('download: attachment com nome UTF-8 e acesso "baixou"', async () => {
    const resposta = await GET(new NextRequest(url), contexto)

    expect(resposta.status).toBe(200)
    expect(getUpload).toHaveBeenCalledWith(registro.urlBlob)
    expect(resposta.headers.get('Content-Type')).toBe(registro.contentType)
    expect(resposta.headers.get('Content-Disposition')).toBe(
      `attachment; filename*=UTF-8''${encodeURIComponent('Medição agosto.xlsx')}`
    )
    expect(prisma.acessoArquivo.create).toHaveBeenCalledWith({ data: { arquivoId: 'a1', usuarioId: 'u1', acao: 'baixou' } })
    expect(Buffer.from(await resposta.arrayBuffer()).toString()).toBe('xlsx')
  })

  it('?modo=inline: inline e acesso "visualizou"', async () => {
    const resposta = await GET(new NextRequest(`${url}?modo=inline`), contexto)
    expect(resposta.headers.get('Content-Disposition')).toMatch(/^inline; /)
    expect(prisma.acessoArquivo.create).toHaveBeenCalledWith({ data: { arquivoId: 'a1', usuarioId: 'u1', acao: 'visualizou' } })
  })
})

describe('PATCH /api/arquivos/[id]', () => {
  it('400 categoria inválida', async () => {
    expect((await PATCH(patch({ categoria: 'X' }), contexto)).status).toBe(400)
  })

  it('400 contrato de outro cliente', async () => {
    ;(prisma.contrato.findUnique as jest.Mock).mockResolvedValue({ clienteId: 'c2' })
    expect((await PATCH(patch({ contratoId: 'k2' }), contexto)).status).toBe(400)
  })

  it('atualiza só o que veio e devolve com usos', async () => {
    const resposta = await PATCH(patch({ categoria: 'MEDICAO', competenciaAno: 2026, competenciaMes: 8 }), contexto)

    expect(resposta.status).toBe(200)
    expect(prisma.arquivoCliente.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'a1' }, data: { categoria: 'MEDICAO', competenciaAno: 2026, competenciaMes: 8 } })
    )
    await expect(resposta.json()).resolves.toEqual({ id: 'a1', categoria: 'MEDICAO', usos: [] })
  })

  it('contratoId "" desvincula', async () => {
    await PATCH(patch({ contratoId: '' }), contexto)
    expect((prisma.arquivoCliente.update as jest.Mock).mock.calls[0][0].data).toEqual({ contratoId: null })
  })
})

describe('DELETE /api/arquivos/[id]', () => {
  it('409 com a lista de usos quando o arquivo está em uso — e não remove', async () => {
    ;(prisma.documento.findMany as jest.Mock).mockResolvedValue([
      { arquivoId: 'a1', clienteId: 'c1', competenciaAno: 2026, competenciaMes: 6 },
    ])
    const resposta = await DELETE(new NextRequest(url, { method: 'DELETE' }), contexto)

    expect(resposta.status).toBe(409)
    await expect(resposta.json()).resolves.toEqual({
      error: 'arquivo em uso',
      usos: [{ tipo: 'analise-documento', rotulo: 'Análise por IA · Junho/2026', href: '/clientes/c1/2026-06' }],
    })
    expect(prisma.arquivoCliente.update).not.toHaveBeenCalled()
  })

  it('sem uso: remoção lógica', async () => {
    const resposta = await DELETE(new NextRequest(url, { method: 'DELETE' }), contexto)
    expect(resposta.status).toBe(200)
    expect(prisma.arquivoCliente.update).toHaveBeenCalledWith({ where: { id: 'a1' }, data: { removidoEm: expect.any(Date) } })
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx jest "src/app/api/arquivos/\\[id\\]"`
Expected: FAIL — `Cannot find module './route'`.

- [ ] **Step 3: Implementar**

`src/app/api/arquivos/carregar.ts`:
```ts
import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { exigirUsuario, verificarAcessoCliente } from '@/lib/relatorios-clientes/acesso'

export const ARQUIVO_NAO_ENCONTRADO = 'arquivo não encontrado'

/** Autentica, acha o arquivo (não removido) e checa acesso pelo cliente dele (401 → 404 → 403). */
export async function carregarArquivoComAcesso(request: NextRequest, id: string) {
  const autenticado = await exigirUsuario(request)
  if ('erro' in autenticado) return autenticado

  const arquivo = await prisma.arquivoCliente.findFirst({
    where: { id, removidoEm: null },
    select: { id: true, clienteId: true, nome: true, contentType: true, urlBlob: true },
  })
  if (!arquivo) return { erro: NextResponse.json({ error: ARQUIVO_NAO_ENCONTRADO }, { status: 404 }) }

  const negado = await verificarAcessoCliente(autenticado.usuario, arquivo.clienteId)
  return negado ? { erro: negado } : { usuario: autenticado.usuario, arquivo }
}
```

`src/app/api/arquivos/[id]/route.ts`:
```ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUpload } from '@/lib/storage'
import { lerCorpo } from '@/lib/relatorios-clientes/validacao'
import { contratoForaDoCliente } from '@/app/api/contratos/carregar'
import { SELECT_ARQUIVO, serializarArquivo, usosDosArquivos } from '@/lib/arquivos/servico'
import { ROTULOS_ARQUIVO, esquemaEdicao } from '@/app/api/clientes/[clienteId]/arquivos/esquema'
import { carregarArquivoComAcesso } from '../carregar'

type Contexto = { params: Promise<{ id: string }> }

/** Única porta de saída do conteúdo de um arquivo do repositório: a URL do Blob nunca vai pro
 *  navegador. `?modo=inline` é a pré-visualização do painel. */
export async function GET(request: NextRequest, { params }: Contexto) {
  const { id } = await params
  const carregado = await carregarArquivoComAcesso(request, id)
  if ('erro' in carregado) return carregado.erro
  const { usuario, arquivo } = carregado

  const inline = request.nextUrl.searchParams.get('modo') === 'inline'
  const conteudo = await getUpload(arquivo.urlBlob)
  await prisma.acessoArquivo.create({
    data: { arquivoId: arquivo.id, usuarioId: usuario.id, acao: inline ? 'visualizou' : 'baixou' },
  })

  return new NextResponse(new Uint8Array(conteudo), {
    headers: {
      'Content-Type': arquivo.contentType,
      'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(arquivo.nome)}`,
    },
  })
}

export async function PATCH(request: NextRequest, { params }: Contexto) {
  const { id } = await params
  const carregado = await carregarArquivoComAcesso(request, id)
  if ('erro' in carregado) return carregado.erro

  const corpo = await lerCorpo(request, esquemaEdicao, ROTULOS_ARQUIVO)
  if ('erro' in corpo) return corpo.erro

  if (corpo.dados.contratoId) {
    const contratoInvalido = await contratoForaDoCliente(corpo.dados.contratoId, carregado.arquivo.clienteId)
    if (contratoInvalido) return contratoInvalido
  }

  // Só o que veio no corpo (undefined = não mexe). `textoOpcional` já trocou '' por null.
  const data = Object.fromEntries(Object.entries(corpo.dados).filter(([, valor]) => valor !== undefined))
  const arquivo = await prisma.arquivoCliente.update({ where: { id }, data, select: SELECT_ARQUIVO })
  const usos = await usosDosArquivos([id])
  return NextResponse.json(serializarArquivo(arquivo, usos.get(id) ?? []))
}

/** Remoção lógica, e só quando nada usa o arquivo (spec §3.4 regra 2). O blob fica. */
export async function DELETE(request: NextRequest, { params }: Contexto) {
  const { id } = await params
  const carregado = await carregarArquivoComAcesso(request, id)
  if ('erro' in carregado) return carregado.erro

  const usos = (await usosDosArquivos([id])).get(id) ?? []
  if (usos.length > 0) return NextResponse.json({ error: 'arquivo em uso', usos }, { status: 409 })

  await prisma.arquivoCliente.update({ where: { id }, data: { removidoEm: new Date() } })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx jest "src/app/api/arquivos"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/arquivos/carregar.ts "src/app/api/arquivos/[id]"
git commit -m "feat(arquivos): entrega autenticada com auditoria, reclassificação e remoção lógica (Fase 1, Task 5)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Aba Documentos — lista, filtros e painel do arquivo

**Files:**
- Create: `src/app/clientes/[id]/abas/documentos/tipos.ts`
- Create: `src/app/clientes/[id]/abas/documentos/lista-arquivos.tsx`
- Create: `src/app/clientes/[id]/abas/documentos/painel-arquivo.tsx`
- Modify (reescrever): `src/app/clientes/[id]/abas/aba-documentos.tsx`
- Modify (reescrever): `src/app/clientes/[id]/abas/aba-documentos.test.tsx`
- Modify se quebrar: `src/app/clientes/[id]/page.test.tsx` (só seletor/fetch mock, não asserção de outras abas)

**Interfaces:**
- Consumes: `GET /api/clientes/[clienteId]/arquivos` (Task 4), `PATCH`/`DELETE`/`GET /api/arquivos/[id]` (Task 5), `GET /api/clientes/[clienteId]/contratos` (existente: array com `id`, `numeroTermo`); `CATEGORIAS`, `rotuloCategoria`, `formatarTamanho` (Task 2); `formatarData` (`src/lib/relatorios-clientes/formatacao.ts`); `nomeCompetencia` (`src/lib/competencia.ts`).
- Produces: `AbaDocumentos({ clienteId })` (mesma assinatura de hoje — `abas.tsx` não muda); em `documentos/tipos.ts`: `interface ArquivoRepositorio`, `interface OpcaoContrato { id: string; numeroTermo: string | null }`, `interface UsoArquivo`; `ListaArquivos`, `PainelArquivo`. A Task 7 acrescenta `EnvioArquivos` e o liga aqui.

- [ ] **Step 1: Teste falhando (substitui o teste antigo inteiro)**

`src/app/clientes/[id]/abas/aba-documentos.test.tsx`:
```tsx
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { AbaDocumentos } from './aba-documentos'

jest.mock('./documentos/envio-arquivos', () => ({ EnvioArquivos: () => null }), { virtual: true })

const PROPOSTA = {
  id: 'a1',
  clienteId: 'c1',
  contratoId: 'k1',
  competenciaAno: null,
  competenciaMes: null,
  categoria: 'PROPOSTA_COMERCIAL',
  nome: 'PC_SMS_012.pdf',
  extensao: 'pdf',
  contentType: 'application/pdf',
  tamanhoBytes: 2048,
  sha256: 'a'.repeat(64),
  origem: 'upload',
  createdAt: '2026-09-20T12:00:00.000Z',
  enviadoPor: { nome: 'Ana' },
  contrato: { id: 'k1', numeroTermo: 'TC 012/2020' },
  usos: [],
}
const MEDICAO = {
  ...PROPOSTA,
  id: 'a2',
  contratoId: null,
  contrato: null,
  categoria: 'MEDICAO',
  nome: 'medicao-junho.xlsx',
  extensao: 'xlsx',
  competenciaAno: 2026,
  competenciaMes: 6,
  usos: [{ tipo: 'analise-documento', rotulo: 'Análise por IA · Junho/2026', href: '/clientes/c1/2026-06' }],
}

function resposta(ok: boolean, corpo: unknown) {
  return Promise.resolve({ ok, json: () => Promise.resolve(corpo) }) as unknown as Promise<Response>
}

function mockApi() {
  // Lista mutável: o DELETE tira o arquivo, e o recarregamento da aba já não o devolve.
  let lista = [PROPOSTA, MEDICAO]
  global.fetch = jest.fn((url: RequestInfo | URL, init?: RequestInit) => {
    const u = String(url)
    const metodo = init?.method ?? 'GET'
    if (u === '/api/clientes/c1/arquivos')
      return resposta(true, { arquivos: lista, resumo: { total: lista.length, bytes: lista.length * 2048 } })
    if (u === '/api/clientes/c1/contratos') return resposta(true, [{ id: 'k1', numeroTermo: 'TC 012/2020' }])
    if (u === '/api/arquivos/a1' && metodo === 'DELETE') {
      lista = lista.filter((a) => a.id !== 'a1')
      return resposta(true, { ok: true })
    }
    if (u === '/api/arquivos/a1' && metodo === 'PATCH') return resposta(true, { ...PROPOSTA, categoria: 'TERMO_CONTRATO' })
    return resposta(false, { error: 'inesperado' })
  }) as jest.Mock
}

describe('AbaDocumentos', () => {
  beforeEach(mockApi)

  it('lista os arquivos do cliente com resumo, categoria, contrato e competência', async () => {
    render(<AbaDocumentos clienteId="c1" />)

    expect(await screen.findByText('PC_SMS_012.pdf')).toBeInTheDocument()
    expect(screen.getByText('2 arquivos · 4 KB')).toBeInTheDocument()
    const linha = screen.getByText('medicao-junho.xlsx').closest('tr')!
    expect(within(linha).getByText('Medição')).toBeInTheDocument()
    expect(within(linha).getByText('Junho/2026')).toBeInTheDocument()
    expect(within(screen.getByText('PC_SMS_012.pdf').closest('tr')!).getByText('TC 012/2020')).toBeInTheDocument()
  })

  it('filtra por categoria e por busca de nome', async () => {
    render(<AbaDocumentos clienteId="c1" />)
    await screen.findByText('PC_SMS_012.pdf')

    fireEvent.change(screen.getByLabelText('Filtrar por categoria'), { target: { value: 'MEDICAO' } })
    expect(screen.queryByText('PC_SMS_012.pdf')).not.toBeInTheDocument()
    expect(screen.getByText('medicao-junho.xlsx')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Filtrar por categoria'), { target: { value: '' } })
    fireEvent.change(screen.getByLabelText('Filtrar por competência'), { target: { value: '2026-06' } })
    expect(screen.queryByText('PC_SMS_012.pdf')).not.toBeInTheDocument()
    expect(screen.getByText('medicao-junho.xlsx')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Filtrar por competência'), { target: { value: '' } })
    fireEvent.change(screen.getByLabelText('Buscar por nome'), { target: { value: 'sms' } })
    expect(screen.getByText('PC_SMS_012.pdf')).toBeInTheDocument()
    expect(screen.queryByText('medicao-junho.xlsx')).not.toBeInTheDocument()
  })

  it('painel: pré-visualiza PDF, mostra onde é usado e bloqueia remover arquivo em uso', async () => {
    render(<AbaDocumentos clienteId="c1" />)
    fireEvent.click(await screen.findByText('medicao-junho.xlsx'))

    const painel = screen.getByRole('complementary', { name: 'medicao-junho.xlsx' })
    expect(within(painel).getByRole('link', { name: 'Análise por IA · Junho/2026' })).toHaveAttribute('href', '/clientes/c1/2026-06')
    expect(within(painel).getByRole('button', { name: 'Remover' })).toBeDisabled()
    expect(within(painel).getByRole('link', { name: 'Baixar' })).toHaveAttribute('href', '/api/arquivos/a2')

    fireEvent.click(screen.getByText('PC_SMS_012.pdf'))
    const painelPdf = screen.getByRole('complementary', { name: 'PC_SMS_012.pdf' })
    expect(within(painelPdf).getByTitle('Pré-visualização de PC_SMS_012.pdf')).toHaveAttribute(
      'src',
      '/api/arquivos/a1?modo=inline'
    )
  })

  it('remove arquivo sem uso após confirmação inline', async () => {
    render(<AbaDocumentos clienteId="c1" />)
    fireEvent.click(await screen.findByText('PC_SMS_012.pdf'))
    const painel = screen.getByRole('complementary', { name: 'PC_SMS_012.pdf' })

    fireEvent.click(within(painel).getByRole('button', { name: 'Remover' }))
    fireEvent.click(within(painel).getByRole('button', { name: 'Sim' }))

    await waitFor(() => expect(screen.queryByText('PC_SMS_012.pdf')).not.toBeInTheDocument())
    expect(global.fetch).toHaveBeenCalledWith('/api/arquivos/a1', { method: 'DELETE' })
  })

  it('reclassifica pelo painel', async () => {
    render(<AbaDocumentos clienteId="c1" />)
    fireEvent.click(await screen.findByText('PC_SMS_012.pdf'))
    const painel = screen.getByRole('complementary', { name: 'PC_SMS_012.pdf' })

    fireEvent.change(within(painel).getByLabelText('Categoria'), { target: { value: 'TERMO_CONTRATO' } })
    fireEvent.click(within(painel).getByRole('button', { name: 'Salvar classificação' }))

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/arquivos/a1',
        expect.objectContaining({ method: 'PATCH' })
      )
    )
    const corpo = JSON.parse(((global.fetch as jest.Mock).mock.calls.find(([, i]) => i?.method === 'PATCH')![1] as RequestInit).body as string)
    expect(corpo).toEqual({ categoria: 'TERMO_CONTRATO', contratoId: 'k1', competenciaAno: null, competenciaMes: null })
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx jest "src/app/clientes/\\[id\\]/abas/aba-documentos"`
Expected: FAIL (o componente antigo mostra "Competências").

- [ ] **Step 3: Implementar**

`src/app/clientes/[id]/abas/documentos/tipos.ts`:
```ts
import type { CategoriaArquivo } from '@prisma/client'

export interface UsoArquivo {
  tipo: string
  rotulo: string
  href: string
}

/** Forma que GET /api/clientes/[clienteId]/arquivos devolve (sem `urlBlob`). */
export interface ArquivoRepositorio {
  id: string
  clienteId: string
  contratoId: string | null
  competenciaAno: number | null
  competenciaMes: number | null
  categoria: CategoriaArquivo
  nome: string
  extensao: string
  contentType: string
  tamanhoBytes: number
  sha256: string
  origem: 'upload' | 'gerado' | 'migrado'
  createdAt: string
  enviadoPor: { nome: string } | null
  contrato: { id: string; numeroTermo: string | null } | null
  usos: UsoArquivo[]
}

export interface OpcaoContrato {
  id: string
  numeroTermo: string | null
}
```

`src/app/clientes/[id]/abas/documentos/lista-arquivos.tsx`:
```tsx
'use client'

import { useState } from 'react'
import { FileSpreadsheet, FileText, File as FileIcon, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { INPUT_BASE } from '@/lib/ui'
import { CATEGORIAS, formatarTamanho, rotuloCategoria } from '@/lib/arquivos/tipos'
import { formatarData } from '@/lib/relatorios-clientes/formatacao'
import { nomeCompetencia } from '@/lib/competencia'
import type { ArquivoRepositorio, OpcaoContrato } from './tipos'

function IconeArquivo({ extensao }: { extensao: string }) {
  if (['xlsx', 'xls', 'csv'].includes(extensao)) return <FileSpreadsheet className="size-4 shrink-0 text-green-ok" strokeWidth={2} />
  if (extensao === 'pdf') return <FileText className="size-4 shrink-0 text-red-crit" strokeWidth={2} />
  return <FileIcon className="size-4 shrink-0 text-mid-grey" strokeWidth={2} />
}

export function competenciaDoArquivo(arquivo: Pick<ArquivoRepositorio, 'competenciaAno' | 'competenciaMes'>) {
  return arquivo.competenciaAno && arquivo.competenciaMes ? nomeCompetencia(arquivo.competenciaAno, arquivo.competenciaMes) : '—'
}

export function ListaArquivos({
  arquivos,
  contratos,
  selecionadoId,
  aoSelecionar,
}: {
  arquivos: ArquivoRepositorio[]
  contratos: OpcaoContrato[]
  selecionadoId: string | null
  aoSelecionar: (arquivo: ArquivoRepositorio) => void
}) {
  const [categoria, setCategoria] = useState('')
  const [contratoId, setContratoId] = useState('')
  const [tipo, setTipo] = useState('')
  const [competencia, setCompetencia] = useState('') // AAAA-MM do <input type="month">
  const [busca, setBusca] = useState('')

  const tipos = [...new Set(arquivos.map((a) => a.extensao).filter(Boolean))].sort()
  const termo = busca.trim().toLowerCase()
  const [anoFiltro, mesFiltro] = competencia ? competencia.split('-').map(Number) : [null, null]
  const visiveis = arquivos.filter(
    (a) =>
      (!categoria || a.categoria === categoria) &&
      (!contratoId || a.contratoId === contratoId) &&
      (!tipo || a.extensao === tipo) &&
      (!competencia || (a.competenciaAno === anoFiltro && a.competenciaMes === mesFiltro)) &&
      (!termo || a.nome.toLowerCase().includes(termo))
  )

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-mid-grey" strokeWidth={2.25} />
          <input
            aria-label="Buscar por nome"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome"
            className={cn(INPUT_BASE, 'w-56 pl-8')}
          />
        </label>
        <select aria-label="Filtrar por categoria" value={categoria} onChange={(e) => setCategoria(e.target.value)} className={cn(INPUT_BASE, 'w-48')}>
          <option value="">Todas as categorias</option>
          {CATEGORIAS.map((c) => (
            <option key={c.valor} value={c.valor}>
              {c.rotulo}
            </option>
          ))}
        </select>
        <select aria-label="Filtrar por contrato" value={contratoId} onChange={(e) => setContratoId(e.target.value)} className={cn(INPUT_BASE, 'w-44')}>
          <option value="">Todos os contratos</option>
          {contratos.map((c) => (
            <option key={c.id} value={c.id}>
              {c.numeroTermo ?? '(sem número)'}
            </option>
          ))}
        </select>
        <select aria-label="Filtrar por tipo" value={tipo} onChange={(e) => setTipo(e.target.value)} className={cn(INPUT_BASE, 'w-28')}>
          <option value="">Todos os tipos</option>
          {tipos.map((t) => (
            <option key={t} value={t}>
              {t.toUpperCase()}
            </option>
          ))}
        </select>
        <input
          type="month"
          aria-label="Filtrar por competência"
          value={competencia}
          onChange={(e) => setCompetencia(e.target.value)}
          className={cn(INPUT_BASE, 'w-40')}
        />
      </div>

      {visiveis.length === 0 ? (
        <div className="card-flush p-10 text-center text-sm text-mid-grey">
          {arquivos.length === 0 ? 'Nenhum arquivo neste cliente ainda.' : 'Nenhum arquivo com esses filtros.'}
        </div>
      ) : (
        <div className="card-flush overflow-x-auto">
          <table className="table-institucional">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Categoria</th>
                <th>Contrato</th>
                <th>Competência</th>
                <th>Tamanho</th>
                <th>Enviado</th>
                <th>Usado em</th>
              </tr>
            </thead>
            <tbody>
              {visiveis.map((a) => (
                <tr
                  key={a.id}
                  onClick={() => aoSelecionar(a)}
                  aria-selected={a.id === selecionadoId}
                  className={cn('cursor-pointer', a.id === selecionadoId && 'bg-orange/[0.06]')}
                >
                  <td>
                    <span className="flex items-center gap-2 font-medium text-navy">
                      <IconeArquivo extensao={a.extensao} />
                      <span className="truncate">{a.nome}</span>
                    </span>
                  </td>
                  <td className="whitespace-nowrap">{rotuloCategoria(a.categoria)}</td>
                  <td className="font-mono text-xs whitespace-nowrap">{a.contrato?.numeroTermo ?? '—'}</td>
                  <td className="whitespace-nowrap">{competenciaDoArquivo(a)}</td>
                  <td className="font-mono text-xs whitespace-nowrap">{formatarTamanho(a.tamanhoBytes)}</td>
                  <td className="text-xs whitespace-nowrap text-mid-grey">
                    {a.enviadoPor?.nome ?? (a.origem === 'migrado' ? 'migrado' : '—')} · {formatarData(a.createdAt)}
                  </td>
                  <td className="font-mono text-xs">{a.usos.length || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
```

`src/app/clientes/[id]/abas/documentos/painel-arquivo.tsx`:
```tsx
'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { AlertCircle, Download, X } from 'lucide-react'
import { BTN_OUTLINE, BTN_OUTLINE_SM, BTN_PRIMARY, INPUT_BASE, LINK_DANGER } from '@/lib/ui'
import { CATEGORIAS, formatarTamanho } from '@/lib/arquivos/tipos'
import type { ArquivoRepositorio, OpcaoContrato } from './tipos'

function mesAno(arquivo: ArquivoRepositorio) {
  return arquivo.competenciaAno && arquivo.competenciaMes
    ? `${arquivo.competenciaAno}-${String(arquivo.competenciaMes).padStart(2, '0')}`
    : ''
}

export function PainelArquivo({
  arquivo,
  contratos,
  aoAtualizar,
  aoRemover,
  aoFechar,
}: {
  arquivo: ArquivoRepositorio
  contratos: OpcaoContrato[]
  aoAtualizar: (arquivo: ArquivoRepositorio) => void
  aoRemover: (id: string) => void
  aoFechar: () => void
}) {
  const [categoria, setCategoria] = useState(arquivo.categoria)
  const [contratoId, setContratoId] = useState(arquivo.contratoId ?? '')
  const [competencia, setCompetencia] = useState(mesAno(arquivo))
  const [confirmando, setConfirmando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const emUso = arquivo.usos.length > 0

  async function salvar(event: FormEvent) {
    event.preventDefault()
    setErro(null)
    const [ano, mes] = competencia ? competencia.split('-').map(Number) : [null, null]
    const response = await fetch(`/api/arquivos/${arquivo.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categoria, contratoId, competenciaAno: ano, competenciaMes: mes }),
    }).catch(() => null)
    const corpo = await response?.json().catch(() => null)
    if (!response?.ok) return setErro(corpo?.error ?? 'Falha ao salvar a classificação.')
    aoAtualizar(corpo)
  }

  async function remover() {
    setErro(null)
    const response = await fetch(`/api/arquivos/${arquivo.id}`, { method: 'DELETE' }).catch(() => null)
    if (!response?.ok) {
      const corpo = await response?.json().catch(() => null)
      setConfirmando(false)
      return setErro(corpo?.error ?? 'Falha ao remover o arquivo.')
    }
    aoRemover(arquivo.id)
  }

  return (
    <aside aria-label={arquivo.nome} className="card space-y-4 self-start lg:sticky lg:top-6">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-navy">{arquivo.nome}</h3>
          <p className="text-xs text-mid-grey">
            {arquivo.extensao.toUpperCase() || 'arquivo'} · {formatarTamanho(arquivo.tamanhoBytes)}
          </p>
        </div>
        <button type="button" onClick={aoFechar} aria-label="Fechar painel" className="text-mid-grey hover:text-navy">
          <X className="size-4" strokeWidth={2.25} />
        </button>
      </div>

      {arquivo.extensao === 'pdf' && (
        <iframe
          title={`Pré-visualização de ${arquivo.nome}`}
          src={`/api/arquivos/${arquivo.id}?modo=inline`}
          className="h-80 w-full rounded-lg border border-border-grey"
        />
      )}

      <form onSubmit={salvar} className="space-y-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium text-mid-grey">Categoria</span>
          <select value={categoria} onChange={(e) => setCategoria(e.target.value as typeof categoria)} className={INPUT_BASE}>
            {CATEGORIAS.map((c) => (
              <option key={c.valor} value={c.valor}>
                {c.rotulo}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium text-mid-grey">Contrato</span>
          <select value={contratoId} onChange={(e) => setContratoId(e.target.value)} className={INPUT_BASE}>
            <option value="">Nenhum</option>
            {contratos.map((c) => (
              <option key={c.id} value={c.id}>
                {c.numeroTermo ?? '(sem número)'}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium text-mid-grey">Competência</span>
          <input type="month" value={competencia} onChange={(e) => setCompetencia(e.target.value)} className={INPUT_BASE} />
        </label>
        <button type="submit" className={BTN_OUTLINE_SM}>
          Salvar classificação
        </button>
      </form>

      <div className="space-y-1.5">
        <h4 className="text-xs font-semibold tracking-wide text-mid-grey uppercase">Onde é usado</h4>
        {emUso ? (
          <ul className="space-y-1 text-sm">
            {arquivo.usos.map((uso) => (
              <li key={uso.href}>
                <Link href={uso.href} className="text-navy hover:text-orange hover:underline">
                  {uso.rotulo}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-mid-grey">Em nenhum lugar ainda.</p>
        )}
      </div>

      {erro && (
        <p className="flex items-center gap-1.5 rounded-lg bg-red-crit-light px-3 py-2 text-sm text-red-crit">
          <AlertCircle className="size-4 shrink-0" strokeWidth={2.25} />
          {erro}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-border-grey pt-3">
        <a href={`/api/arquivos/${arquivo.id}`} className={BTN_PRIMARY}>
          <Download className="size-3.5" strokeWidth={2.25} />
          Baixar
        </a>
        {confirmando ? (
          <span className="flex items-center gap-2 text-sm">
            Remover?
            <button type="button" onClick={remover} className={LINK_DANGER}>
              Sim
            </button>
            <button type="button" onClick={() => setConfirmando(false)} className={BTN_OUTLINE_SM}>
              Não
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmando(true)}
            disabled={emUso}
            title={emUso ? 'Em uso — remova o vínculo antes' : undefined}
            className={BTN_OUTLINE}
          >
            Remover
          </button>
        )}
      </div>
      {emUso && <p className="text-xs text-mid-grey">Não dá para remover: o arquivo está em uso nos lugares acima.</p>}
    </aside>
  )
}
```

`src/app/clientes/[id]/abas/aba-documentos.tsx` (substitui o arquivo inteiro):
```tsx
'use client'

// Aba "Documentos" da ficha do cliente: o repositório de arquivos do cliente
// (docs/superpowers/specs/2026-09-23-repositorio-documentos-cliente-design.md §3.5). O fluxo antigo
// de competência + análise por IA saiu da ficha, mas as páginas /clientes/[id]/[competencia]
// continuam existindo — o painel do arquivo leva até elas pelo "onde é usado".

import { useCallback, useEffect, useState } from 'react'
import { AlertCircle, Loader2 } from 'lucide-react'
import { formatarTamanho } from '@/lib/arquivos/tipos'
import { ListaArquivos } from './documentos/lista-arquivos'
import { PainelArquivo } from './documentos/painel-arquivo'
import type { ArquivoRepositorio, OpcaoContrato } from './documentos/tipos'

export function AbaDocumentos({ clienteId }: { clienteId: string }) {
  const [arquivos, setArquivos] = useState<ArquivoRepositorio[]>([])
  const [resumo, setResumo] = useState({ total: 0, bytes: 0 })
  const [contratos, setContratos] = useState<OpcaoContrato[]>([])
  const [selecionado, setSelecionado] = useState<ArquivoRepositorio | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    const response = await fetch(`/api/clientes/${clienteId}/arquivos`).catch(() => null)
    const corpo = await response?.json().catch(() => null)
    if (!response?.ok) {
      setErro(corpo?.error ?? 'Falha ao carregar os documentos.')
    } else {
      setArquivos(corpo.arquivos)
      setResumo(corpo.resumo)
      setErro(null)
    }
    setCarregando(false)
  }, [clienteId])

  useEffect(() => {
    carregar()
    fetch(`/api/clientes/${clienteId}/contratos`)
      .then(async (response) => (response.ok ? setContratos(await response.json()) : undefined))
      .catch(() => {})
  }, [carregar, clienteId])

  if (carregando) {
    return (
      <p className="flex items-center gap-2 text-sm text-mid-grey">
        <Loader2 className="size-4 animate-spin" strokeWidth={2.25} />
        Carregando...
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[0.95rem] font-semibold text-navy">Documentos do cliente</h2>
          <p className="text-xs text-mid-grey">
            {resumo.total} arquivo{resumo.total === 1 ? '' : 's'} · {formatarTamanho(resumo.bytes)}
          </p>
        </div>
      </div>

      {erro && (
        <p className="flex items-center gap-1.5 rounded-xl bg-red-crit-light p-4 text-sm text-red-crit">
          <AlertCircle className="size-4 shrink-0" strokeWidth={2.25} />
          {erro}
        </p>
      )}

      <div className={selecionado ? 'grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]' : undefined}>
        <ListaArquivos
          arquivos={arquivos}
          contratos={contratos}
          selecionadoId={selecionado?.id ?? null}
          aoSelecionar={setSelecionado}
        />
        {selecionado && (
          <PainelArquivo
            key={selecionado.id}
            arquivo={selecionado}
            contratos={contratos}
            aoFechar={() => setSelecionado(null)}
            aoAtualizar={(atualizado) => {
              setArquivos((lista) => lista.map((a) => (a.id === atualizado.id ? atualizado : a)))
              setSelecionado(atualizado)
            }}
            aoRemover={(id) => {
              setSelecionado(null)
              carregar()
              setArquivos((lista) => lista.filter((a) => a.id !== id))
            }}
          />
        )}
      </div>
    </div>
  )
}
```

> O mock `jest.mock('./documentos/envio-arquivos', …, { virtual: true })` no teste existe porque a Task 7 vai importar `EnvioArquivos` aqui; nesta task o import ainda não existe e o mock virtual é inofensivo.

- [ ] **Step 4: Rodar e ver passar; conferir a ficha**

Run: `npx jest "src/app/clientes/\\[id\\]"`
Expected: PASS. Se `src/app/clientes/[id]/page.test.tsx` quebrar por causa do fetch da aba Documentos (URL `/api/clientes/c1/arquivos` não mockada), acrescente essa URL ao mock daquele teste devolvendo `{ arquivos: [], resumo: { total: 0, bytes: 0 } }` — sem mudar asserções.

- [ ] **Step 5: Commit**

```bash
git add "src/app/clientes/[id]/abas/aba-documentos.tsx" "src/app/clientes/[id]/abas/aba-documentos.test.tsx" "src/app/clientes/[id]/abas/documentos"
# e src/app/clientes/[id]/page.test.tsx se foi ajustado
git commit -m "feat(clientes): aba Documentos vira repositório — lista, filtros e painel do arquivo (Fase 1, Task 6)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Envio de arquivos na aba — hash no navegador, upload direto, classificação

**Files:**
- Create: `src/lib/arquivos/hash-navegador.ts`
- Create: `src/app/clientes/[id]/abas/documentos/envio-arquivos.tsx` (+ `envio-arquivos.test.tsx`)
- Modify: `src/app/clientes/[id]/abas/aba-documentos.tsx` (botão "Enviar arquivos" + `EnvioArquivos`)

**Interfaces:**
- Consumes: `POST /api/arquivos/upload-token`, `GET /api/clientes/[clienteId]/arquivos/existe`, `POST /api/clientes/[clienteId]/arquivos` (Task 4); `caminhoTemporario` (Task 2); `CATEGORIAS`, `sugerirCategoria` (Task 2); `MultiFileDropzone`, `ArquivoProposta` (`src/components/multi-file-dropzone.tsx`); `upload` de `@vercel/blob/client`.
- Produces: `sha256DoArquivo(file: File): Promise<string>`; `EnvioArquivos({ clienteId, contratos, aoConcluir, aoCancelar })` onde `aoConcluir(): void` é chamado quando todos os arquivos terminaram (enviados ou já existentes).

- [ ] **Step 1: Teste falhando**

`src/app/clientes/[id]/abas/documentos/envio-arquivos.test.tsx`:
```tsx
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { EnvioArquivos } from './envio-arquivos'

jest.mock('@vercel/blob/client', () => ({ upload: jest.fn() }))
jest.mock('@/lib/arquivos/hash-navegador', () => ({ sha256DoArquivo: jest.fn() }))

import { upload } from '@vercel/blob/client'
import { sha256DoArquivo } from '@/lib/arquivos/hash-navegador'

const TMP = 'https://x.public.blob.vercel-storage.com/tmp-arquivos/u-PC_SMS_012-abc.pdf'

function resposta(ok: boolean, corpo: unknown) {
  return Promise.resolve({ ok, json: () => Promise.resolve(corpo) }) as unknown as Promise<Response>
}

function selecionar(container: HTMLElement, ...arquivos: File[]) {
  const input = container.querySelector('input[type="file"]') as HTMLInputElement
  fireEvent.change(input, { target: { files: arquivos } })
}

beforeEach(() => {
  jest.clearAllMocks()
  ;(sha256DoArquivo as jest.Mock).mockImplementation(async (file: File) => (file.name.startsWith('PC') ? 'a'.repeat(64) : 'b'.repeat(64)))
  ;(upload as jest.Mock).mockResolvedValue({ url: TMP })
  global.fetch = jest.fn((url: RequestInfo | URL, init?: RequestInit) => {
    const u = String(url)
    if (u === `/api/clientes/c1/arquivos/existe?sha256=${'a'.repeat(64)}`) return resposta(true, { arquivo: null })
    if (u === `/api/clientes/c1/arquivos/existe?sha256=${'b'.repeat(64)}`)
      return resposta(true, { arquivo: { id: 'a-velho', nome: 'medicao antiga.xlsx' } })
    if (u === '/api/clientes/c1/arquivos' && init?.method === 'POST') return resposta(true, { arquivo: { id: 'a1' }, duplicado: false })
    return resposta(false, { error: 'inesperado' })
  }) as jest.Mock
})

describe('EnvioArquivos', () => {
  it('sugere a categoria pelo nome e deixa trocar', () => {
    const { container } = render(<EnvioArquivos clienteId="c1" contratos={[]} aoConcluir={jest.fn()} aoCancelar={jest.fn()} />)
    selecionar(container, new File(['x'], 'PC_SMS_012.pdf'))

    const linha = screen.getByRole('group', { name: 'PC_SMS_012.pdf' })
    expect(within(linha).getByLabelText('Categoria')).toHaveValue('PROPOSTA_COMERCIAL')
  })

  it('arquivo novo: upload direto no caminho temporário e registro com a classificação', async () => {
    const aoConcluir = jest.fn()
    const { container } = render(
      <EnvioArquivos clienteId="c1" contratos={[{ id: 'k1', numeroTermo: 'TC 012/2020' }]} aoConcluir={aoConcluir} aoCancelar={jest.fn()} />
    )
    selecionar(container, new File(['x'], 'PC_SMS_012.pdf'))
    const linha = screen.getByRole('group', { name: 'PC_SMS_012.pdf' })
    fireEvent.change(within(linha).getByLabelText('Contrato'), { target: { value: 'k1' } })
    fireEvent.change(within(linha).getByLabelText('Competência'), { target: { value: '2026-08' } })

    fireEvent.click(screen.getByRole('button', { name: 'Enviar 1 arquivo' }))

    await waitFor(() => expect(aoConcluir).toHaveBeenCalled())
    const [caminho, , opcoes] = (upload as jest.Mock).mock.calls[0]
    expect(caminho).toMatch(/^tmp-arquivos\/.+-PC_SMS_012\.pdf$/)
    expect(opcoes).toMatchObject({ access: 'public', handleUploadUrl: '/api/arquivos/upload-token' })
    const post = (global.fetch as jest.Mock).mock.calls.find(([, i]) => i?.method === 'POST')!
    expect(JSON.parse(post[1].body)).toEqual({
      urlTemporaria: TMP,
      nome: 'PC_SMS_012.pdf',
      categoria: 'PROPOSTA_COMERCIAL',
      contratoId: 'k1',
      competenciaAno: 2026,
      competenciaMes: 8,
    })
  })

  it('arquivo que o cliente já tem: não sobe e avisa', async () => {
    const aoConcluir = jest.fn()
    const { container } = render(<EnvioArquivos clienteId="c1" contratos={[]} aoConcluir={aoConcluir} aoCancelar={jest.fn()} />)
    selecionar(container, new File(['y'], 'medicao-junho.xlsx'))

    fireEvent.click(screen.getByRole('button', { name: 'Enviar 1 arquivo' }))

    expect(await screen.findByText('já está no repositório como “medicao antiga.xlsx”')).toBeInTheDocument()
    expect(upload).not.toHaveBeenCalled()
    expect(aoConcluir).toHaveBeenCalled()
  })

  it('falha no envio de um arquivo mostra o erro na linha e não conclui', async () => {
    ;(upload as jest.Mock).mockRejectedValue(new Error('rede caiu'))
    const aoConcluir = jest.fn()
    const { container } = render(<EnvioArquivos clienteId="c1" contratos={[]} aoConcluir={aoConcluir} aoCancelar={jest.fn()} />)
    selecionar(container, new File(['x'], 'PC_SMS_012.pdf'))

    fireEvent.click(screen.getByRole('button', { name: 'Enviar 1 arquivo' }))

    expect(await screen.findByText('rede caiu')).toBeInTheDocument()
    expect(aoConcluir).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx jest "src/app/clientes/\\[id\\]/abas/documentos/envio-arquivos"`
Expected: FAIL — `Cannot find module './envio-arquivos'`.

- [ ] **Step 3: Implementar**

`src/lib/arquivos/hash-navegador.ts`:
```ts
/** SHA-256 (hex) de um arquivo, no navegador — pra perguntar ao servidor se o cliente já tem esse
 *  conteúdo antes de subir. O servidor recalcula no registro; isto é só atalho. */
export async function sha256DoArquivo(file: File): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer())
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}
```

`src/app/clientes/[id]/abas/documentos/envio-arquivos.tsx`:
```tsx
'use client'

import { useState } from 'react'
import { upload } from '@vercel/blob/client'
import { AlertCircle, Check, Loader2 } from 'lucide-react'
import type { CategoriaArquivo } from '@prisma/client'
import { BTN_OUTLINE, BTN_PRIMARY, INPUT_BASE } from '@/lib/ui'
import { CATEGORIAS, sugerirCategoria } from '@/lib/arquivos/tipos'
import { caminhoTemporario } from '@/lib/arquivos/caminhos'
import { sha256DoArquivo } from '@/lib/arquivos/hash-navegador'
import { MultiFileDropzone, type ArquivoProposta } from '@/components/multi-file-dropzone'
import type { OpcaoContrato } from './tipos'

type Situacao =
  | { tipo: 'pendente' }
  | { tipo: 'enviando' }
  | { tipo: 'enviado' }
  | { tipo: 'existente'; nome: string }
  | { tipo: 'erro'; mensagem: string }

interface Classificacao {
  categoria: CategoriaArquivo
  contratoId: string
  competencia: string // AAAA-MM do <input type="month">, '' = sem competência
}

async function enviarUm(clienteId: string, file: File, c: Classificacao): Promise<Situacao> {
  const sha256 = await sha256DoArquivo(file)
  const existe = await fetch(`/api/clientes/${clienteId}/arquivos/existe?sha256=${sha256}`).then((r) => r.json())
  if (existe?.arquivo) return { tipo: 'existente', nome: existe.arquivo.nome }

  const blob = await upload(caminhoTemporario(file.name), file, {
    access: 'public',
    handleUploadUrl: '/api/arquivos/upload-token',
  })
  const [ano, mes] = c.competencia ? c.competencia.split('-').map(Number) : [null, null]
  const response = await fetch(`/api/clientes/${clienteId}/arquivos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      urlTemporaria: blob.url,
      nome: file.name,
      categoria: c.categoria,
      contratoId: c.contratoId,
      competenciaAno: ano,
      competenciaMes: mes,
    }),
  })
  const corpo = await response.json().catch(() => null)
  if (!response.ok) return { tipo: 'erro', mensagem: corpo?.error ?? 'Falha ao registrar o arquivo.' }
  return corpo.duplicado ? { tipo: 'existente', nome: corpo.arquivo.nome } : { tipo: 'enviado' }
}

export function EnvioArquivos({
  clienteId,
  contratos,
  aoConcluir,
  aoCancelar,
}: {
  clienteId: string
  contratos: OpcaoContrato[]
  aoConcluir: () => void
  aoCancelar: () => void
}) {
  const [arquivos, setArquivos] = useState<ArquivoProposta[]>([])
  const [classificacao, setClassificacao] = useState<Record<string, Classificacao>>({})
  const [situacao, setSituacao] = useState<Record<string, Situacao>>({})
  const [enviando, setEnviando] = useState(false)

  function aoMudarArquivos(novos: ArquivoProposta[]) {
    setArquivos(novos)
    setClassificacao((atual) => {
      const proximo: Record<string, Classificacao> = {}
      for (const { id, file } of novos) {
        proximo[id] = atual[id] ?? { categoria: sugerirCategoria(file.name), contratoId: '', competencia: '' }
      }
      return proximo
    })
  }

  function classificar(id: string, campo: keyof Classificacao, valor: string) {
    setClassificacao((atual) => ({ ...atual, [id]: { ...atual[id], [campo]: valor } }))
  }

  async function enviar() {
    setEnviando(true)
    let todosOk = true
    for (const { id, file } of arquivos) {
      if (situacao[id]?.tipo === 'enviado' || situacao[id]?.tipo === 'existente') continue
      setSituacao((atual) => ({ ...atual, [id]: { tipo: 'enviando' } }))
      const resultado = await enviarUm(clienteId, file, classificacao[id]).catch(
        (erro): Situacao => ({ tipo: 'erro', mensagem: erro instanceof Error ? erro.message : 'Falha no envio.' })
      )
      if (resultado.tipo === 'erro') todosOk = false
      setSituacao((atual) => ({ ...atual, [id]: resultado }))
    }
    setEnviando(false)
    if (todosOk) aoConcluir()
  }

  return (
    <div className="card space-y-4">
      <MultiFileDropzone
        arquivos={arquivos}
        onChange={aoMudarArquivos}
        accept=""
        tipoLabel="Qualquer arquivo — PDF, Excel, Word, imagem..."
        tamanhoMaximoMb={50}
        disabled={enviando}
      />

      {arquivos.map(({ id, file }) => {
        const c = classificacao[id]
        const s = situacao[id] ?? { tipo: 'pendente' }
        return (
          <fieldset key={id} role="group" aria-label={file.name} className="grid gap-2 rounded-lg border border-border-grey p-3 sm:grid-cols-4">
            <legend className="sr-only">{file.name}</legend>
            <p className="truncate text-sm font-medium text-navy sm:col-span-4">{file.name}</p>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs font-medium text-mid-grey">Categoria</span>
              <select value={c.categoria} onChange={(e) => classificar(id, 'categoria', e.target.value)} className={INPUT_BASE} disabled={enviando}>
                {CATEGORIAS.map((cat) => (
                  <option key={cat.valor} value={cat.valor}>
                    {cat.rotulo}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs font-medium text-mid-grey">Contrato</span>
              <select value={c.contratoId} onChange={(e) => classificar(id, 'contratoId', e.target.value)} className={INPUT_BASE} disabled={enviando}>
                <option value="">Nenhum</option>
                {contratos.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.numeroTermo ?? '(sem número)'}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs font-medium text-mid-grey">Competência</span>
              <input type="month" value={c.competencia} onChange={(e) => classificar(id, 'competencia', e.target.value)} className={INPUT_BASE} disabled={enviando} />
            </label>
            <div className="flex items-end text-sm">
              {s.tipo === 'enviando' && (
                <span className="flex items-center gap-1.5 text-mid-grey">
                  <Loader2 className="size-4 animate-spin" strokeWidth={2.25} /> Enviando...
                </span>
              )}
              {s.tipo === 'enviado' && (
                <span className="flex items-center gap-1.5 text-green-ok">
                  <Check className="size-4" strokeWidth={2.5} /> Enviado
                </span>
              )}
              {s.tipo === 'existente' && <span className="text-orange-dark">já está no repositório como “{s.nome}”</span>}
              {s.tipo === 'erro' && (
                <span className="flex items-center gap-1.5 text-red-crit">
                  <AlertCircle className="size-4 shrink-0" strokeWidth={2.25} />
                  {s.mensagem}
                </span>
              )}
            </div>
          </fieldset>
        )
      })}

      <div className="flex gap-2">
        <button type="button" onClick={enviar} disabled={enviando || arquivos.length === 0} className={BTN_PRIMARY}>
          {`Enviar ${arquivos.length} arquivo${arquivos.length === 1 ? '' : 's'}`}
        </button>
        <button type="button" onClick={aoCancelar} disabled={enviando} className={BTN_OUTLINE}>
          Cancelar
        </button>
      </div>
    </div>
  )
}
```

> `MultiFileDropzone` com `accept=""` aceita qualquer arquivo. O texto "já está no repositório como “X”" usa aspas curvas — o teste procura exatamente isso.

Em `src/app/clientes/[id]/abas/aba-documentos.tsx`, acrescentar:
```tsx
// imports
import { Upload } from 'lucide-react'
import { BTN_PRIMARY } from '@/lib/ui'
import { EnvioArquivos } from './documentos/envio-arquivos'

// estado
const [enviando, setEnviando] = useState(false)

// no cabeçalho, ao lado do resumo:
{!enviando && (
  <button type="button" onClick={() => setEnviando(true)} className={BTN_PRIMARY}>
    <Upload className="size-3.5" strokeWidth={2.25} />
    Enviar arquivos
  </button>
)}

// logo abaixo do cabeçalho:
{enviando && (
  <EnvioArquivos
    clienteId={clienteId}
    contratos={contratos}
    aoCancelar={() => setEnviando(false)}
    aoConcluir={() => {
      setEnviando(false)
      carregar()
    }}
  />
)}
```
(Juntar ao import existente de `lucide-react` e de `@/lib/ui`, sem duplicar linhas de import.)

E acrescentar ao `aba-documentos.test.tsx` (o mock virtual da Task 6 continua valendo, então `EnvioArquivos` renderiza `null`):
```tsx
  it('"Enviar arquivos" abre o envio', async () => {
    render(<AbaDocumentos clienteId="c1" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Enviar arquivos' }))
    expect(screen.queryByRole('button', { name: 'Enviar arquivos' })).not.toBeInTheDocument()
  })
```
e **remover** o `{ virtual: true }` do `jest.mock('./documentos/envio-arquivos', …)` — agora o módulo existe.

- [ ] **Step 4: Rodar e ver passar**

Run: `npx jest "src/app/clientes/\\[id\\]" src/lib/arquivos`
Expected: PASS.

- [ ] **Step 5: Smoke test no navegador (dev local)**

Com Docker de pé: `npx dotenv -e .env.development -- npx next dev --turbopack -p 3055`, logar pelo dev-login, abrir `/clientes/<id>?aba=documentos`, enviar um PDF > 5 MB e uma planilha; conferir: aparecem na lista, a categoria sugerida bate, reenviar o mesmo PDF mostra "já está no repositório", o painel pré-visualiza o PDF, "Baixar" baixa com o nome certo, e `select acao, count(*) from "AcessoArquivo" group by 1` no banco local mostra `visualizou`/`baixou`. **Precisa de `BLOB_READ_WRITE_TOKEN` no `.env.development`** — sem ele o upload falha; nesse caso registre no relatório que o smoke do upload ficou pendente, não finja que passou.

- [ ] **Step 6: Commit**

```bash
git add src/lib/arquivos/hash-navegador.ts "src/app/clientes/[id]/abas/documentos/envio-arquivos.tsx" "src/app/clientes/[id]/abas/documentos/envio-arquivos.test.tsx" "src/app/clientes/[id]/abas/aba-documentos.tsx" "src/app/clientes/[id]/abas/aba-documentos.test.tsx"
git commit -m "feat(clientes): envio de arquivos no repositório — hash, upload direto e classificação (Fase 1, Task 7)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Migração dos `Documento` existentes + documentação

**Files:**
- Create: `src/lib/arquivos/migracao-documentos.ts` (+ `migracao-documentos.test.ts`)
- Create: `scripts/migrar-documentos-para-repositorio.ts`
- Modify: `CLAUDE.md` (seção nova "Repositório de documentos do cliente")
- Modify: `docs/superpowers/specs/2026-09-23-repositorio-documentos-cliente-design.md` (Status: Fase 1 concluída)

**Interfaces:**
- Consumes: `categoriaDoDocumento`, `contentTypeDe`, `extensaoDe` (Task 2); `sha256Hex` (Task 3); `getUpload`.
- Produces: `migrarDocumentos(prisma: PrismaClient, opcoes: { aplicar: boolean; baixar?: (url: string) => Promise<Buffer> }): Promise<{ total: number; criados: number; reaproveitados: number; falhas: Array<{ documentoId: string; motivo: string }> }>`.

- [ ] **Step 1: Teste falhando**

`src/lib/arquivos/migracao-documentos.test.ts`:
```ts
/** @jest-environment node */
import { migrarDocumentos } from './migracao-documentos'
import { sha256Hex } from './servico'

jest.mock('@/lib/prisma', () => ({ prisma: {} }))

const doc = (id: string, conteudo: string, extra: Record<string, unknown> = {}) => ({
  id,
  clienteId: 'c1',
  nomeArquivo: `${id}.xlsx`,
  tipo: 'xlsx',
  caminhoOriginal: `https://x.public.blob.vercel-storage.com/2026/06/${id}/original.xlsx`,
  tamanhoBytes: conteudo.length,
  uploadedById: 'u1',
  competenciaAno: 2026,
  competenciaMes: 6,
  createdAt: new Date('2026-06-10T12:00:00Z'),
  conteudo,
  ...extra,
})

function prismaFalso(documentos: ReturnType<typeof doc>[]) {
  const arquivos: Array<Record<string, unknown>> = []
  return {
    arquivos,
    documento: {
      findMany: jest.fn().mockResolvedValue(documentos),
      update: jest.fn().mockResolvedValue({}),
    },
    arquivoCliente: {
      findFirst: jest.fn(({ where }) => arquivos.find((a) => a.clienteId === where.clienteId && a.sha256 === where.sha256) ?? null),
      create: jest.fn(({ data }) => {
        arquivos.push(data)
        return data
      }),
    },
  }
}

describe('migrarDocumentos', () => {
  it('sem --aplicar só conta, não grava nada', async () => {
    const documentos = [doc('d1', 'A')]
    const prisma = prismaFalso(documentos)
    const baixar = jest.fn(async (url: string) => Buffer.from(documentos.find((d) => url.includes(d.id))!.conteudo))

    const resultado = await migrarDocumentos(prisma as never, { aplicar: false, baixar })

    expect(resultado).toEqual({ total: 1, criados: 1, reaproveitados: 0, falhas: [] })
    expect(prisma.arquivoCliente.create).not.toHaveBeenCalled()
    expect(prisma.documento.update).not.toHaveBeenCalled()
  })

  it('com --aplicar cria apontando pro MESMO blob, e conteúdo repetido reaproveita', async () => {
    const documentos = [doc('d1', 'A'), doc('d2', 'A'), doc('d3', 'B', { tipo: 'pdf', nomeArquivo: 'd3.pdf' })]
    const prisma = prismaFalso(documentos)
    const baixar = jest.fn(async (url: string) => Buffer.from(documentos.find((d) => url.includes(d.id))!.conteudo))

    const resultado = await migrarDocumentos(prisma as never, { aplicar: true, baixar })

    expect(resultado).toEqual({ total: 3, criados: 2, reaproveitados: 1, falhas: [] })
    expect(prisma.documento.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { arquivoId: null } }))
    expect(prisma.arquivos[0]).toMatchObject({
      clienteId: 'c1',
      categoria: 'PLANILHA',
      nome: 'd1.xlsx',
      extensao: 'xlsx',
      urlBlob: documentos[0].caminhoOriginal,
      sha256: sha256Hex(Buffer.from('A')),
      origem: 'migrado',
      enviadoPorId: 'u1',
      competenciaAno: 2026,
      competenciaMes: 6,
      createdAt: documentos[0].createdAt,
    })
    expect(prisma.arquivos[1]).toMatchObject({ categoria: 'OUTRO', contentType: 'application/pdf' })
    const idDoA = prisma.arquivos[0].id
    expect(prisma.documento.update).toHaveBeenCalledWith({ where: { id: 'd1' }, data: { arquivoId: idDoA } })
    expect(prisma.documento.update).toHaveBeenCalledWith({ where: { id: 'd2' }, data: { arquivoId: idDoA } })
  })

  it('blob que não baixa vira falha e não interrompe os outros', async () => {
    const documentos = [doc('d1', 'A'), doc('d2', 'B')]
    const prisma = prismaFalso(documentos)
    const baixar = jest.fn(async (url: string) => {
      if (url.includes('d1')) throw new Error('404')
      return Buffer.from('B')
    })

    const resultado = await migrarDocumentos(prisma as never, { aplicar: true, baixar })

    expect(resultado).toEqual({ total: 2, criados: 1, reaproveitados: 0, falhas: [{ documentoId: 'd1', motivo: '404' }] })
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx jest src/lib/arquivos/migracao-documentos.test.ts`
Expected: FAIL — `Cannot find module './migracao-documentos'`.

- [ ] **Step 3: Implementar**

`src/lib/arquivos/migracao-documentos.ts`:
```ts
import { randomUUID } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'
import { getUpload } from '@/lib/storage'
import { sha256Hex } from './servico'
import { categoriaDoDocumento, contentTypeDe, extensaoDe } from './tipos'

export interface ResultadoMigracao {
  total: number
  criados: number
  reaproveitados: number
  falhas: Array<{ documentoId: string; motivo: string }>
}

/** Cada `Documento` sem `arquivoId` ganha um `ArquivoCliente` com a MESMA URL do blob (nada é
 *  copiado — spec §3.7). Conteúdo repetido no mesmo cliente aponta pro mesmo registro. Idempotente:
 *  só olha documentos ainda sem `arquivoId`. Sem `aplicar`, só conta o que faria. */
export async function migrarDocumentos(
  prisma: PrismaClient,
  { aplicar, baixar = getUpload }: { aplicar: boolean; baixar?: (url: string) => Promise<Buffer> }
): Promise<ResultadoMigracao> {
  const documentos = await prisma.documento.findMany({
    where: { arquivoId: null },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      clienteId: true,
      nomeArquivo: true,
      tipo: true,
      caminhoOriginal: true,
      uploadedById: true,
      competenciaAno: true,
      competenciaMes: true,
      createdAt: true,
    },
  })

  const resultado: ResultadoMigracao = { total: documentos.length, criados: 0, reaproveitados: 0, falhas: [] }
  // No modo "só listar" nada é gravado, então o reaproveitamento é simulado aqui.
  const vistos = new Set<string>()

  for (const doc of documentos) {
    let sha256: string
    let tamanho: number
    try {
      const conteudo = await baixar(doc.caminhoOriginal)
      sha256 = sha256Hex(conteudo)
      tamanho = conteudo.length
    } catch (erro) {
      resultado.falhas.push({ documentoId: doc.id, motivo: erro instanceof Error ? erro.message : String(erro) })
      continue
    }

    const chave = `${doc.clienteId}:${sha256}`
    const existente = aplicar
      ? await prisma.arquivoCliente.findFirst({ where: { clienteId: doc.clienteId, sha256, removidoEm: null }, select: { id: true } })
      : vistos.has(chave)
        ? { id: '(simulado)' }
        : null
    vistos.add(chave)

    if (existente) {
      resultado.reaproveitados++
      if (aplicar) await prisma.documento.update({ where: { id: doc.id }, data: { arquivoId: existente.id } })
      continue
    }

    resultado.criados++
    if (!aplicar) continue
    const arquivo = await prisma.arquivoCliente.create({
      data: {
        id: randomUUID(),
        clienteId: doc.clienteId,
        competenciaAno: doc.competenciaAno,
        competenciaMes: doc.competenciaMes,
        categoria: categoriaDoDocumento(doc.tipo),
        nome: doc.nomeArquivo,
        extensao: extensaoDe(doc.nomeArquivo) || doc.tipo,
        contentType: contentTypeDe(doc.nomeArquivo),
        tamanhoBytes: tamanho,
        sha256,
        urlBlob: doc.caminhoOriginal,
        origem: 'migrado',
        enviadoPorId: doc.uploadedById,
        createdAt: doc.createdAt,
      },
      select: { id: true },
    })
    await prisma.documento.update({ where: { id: doc.id }, data: { arquivoId: arquivo.id } })
  }

  return resultado
}
```

> O teste do modo "só listar" com dois documentos de mesmo conteúdo não existe de propósito; o `vistos` cobre esse caso para a contagem sair igual à do `--aplicar`.

`scripts/migrar-documentos-para-repositorio.ts`:
```ts
/**
 * Leva os `Documento` (upload por competência) para o repositório de documentos do cliente
 * (docs/superpowers/specs/2026-09-23-repositorio-documentos-cliente-design.md §3.7).
 *
 *   npx dotenv -e .env.development -- npx tsx scripts/migrar-documentos-para-repositorio.ts            # só conta
 *   npx dotenv -e .env.development -- npx tsx scripts/migrar-documentos-para-repositorio.ts --aplicar  # grava
 *
 * Não copia blob: o `ArquivoCliente` aponta para a mesma URL do `Documento`. Idempotente.
 */
import { PrismaClient } from '@prisma/client'
import { config } from 'dotenv'
import { migrarDocumentos } from '../src/lib/arquivos/migracao-documentos'

if (!process.env.DATABASE_URL) config({ path: '.env.local' })

const prisma = new PrismaClient()

async function main() {
  const aplicar = process.argv.includes('--aplicar')
  const r = await migrarDocumentos(prisma, { aplicar })
  console.log(`${aplicar ? 'APLICADO' : 'SÓ LISTAGEM (use --aplicar para gravar)'}`)
  console.log(`documentos sem arquivo: ${r.total} · criados: ${r.criados} · reaproveitados: ${r.reaproveitados} · falhas: ${r.falhas.length}`)
  for (const falha of r.falhas) console.log(`  falha ${falha.documentoId}: ${falha.motivo}`)
}

main()
  .catch((erro) => {
    console.error(erro)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
```

> Se `tsx` não resolver o alias `@/` dentro de `src/lib/arquivos/*` quando rodado pelo script, troque os imports `@/lib/storage` e `@/lib/competencia` desses arquivos por caminhos relativos (`../storage`, `../competencia`) — o `scripts/reconciliar-clientes.ts` já importa `src/lib/relatorios-clientes/*` por caminho relativo; siga o que funcionar lá.

- [ ] **Step 4: Rodar e ver passar**

Run: `npx jest src/lib/arquivos`
Expected: PASS.

- [ ] **Step 5: Rodar o script no banco local**

Run: `npx dotenv -e .env.development -- npx tsx scripts/migrar-documentos-para-repositorio.ts`
Expected: `SÓ LISTAGEM` e a contagem (no banco local de 23/09: 4 documentos, do cliente SMDET).
Depois: `npx dotenv -e .env.development -- npx tsx scripts/migrar-documentos-para-repositorio.ts --aplicar` e rodar de novo sem `--aplicar` — a segunda listagem deve mostrar `documentos sem arquivo: 0` (idempotência). Registrar os números no relatório da task. **Não rodar em produção** — isso exige autorização do usuário.

- [ ] **Step 6: Documentação**

Em `CLAUDE.md`, acrescentar ao fim:
```markdown
## Repositório de documentos do cliente

**Arquivo de cliente existe num lugar só: `ArquivoCliente`** (aba Documentos da ficha,
`src/app/clientes/[id]/abas/aba-documentos.tsx`; serviço em `src/lib/arquivos/`). Quem usa um
arquivo guarda `...ArquivoId` — nunca URL própria nem cópia do blob. Upload sempre direto ao Blob
(`/api/arquivos/upload-token`, caminho `tmp-arquivos/`) e registro servidor a servidor
(`registrarArquivo`: hash SHA-256, sem duplicado no cliente); entrega sempre por
`/api/arquivos/[id]` (checa `podeVerCliente`, grava `AcessoArquivo`) — `urlBlob` nunca vai pro
navegador. Remoção é lógica e bloqueada enquanto `usosDosArquivos` achar uso; módulo novo que
referencia arquivo **acrescenta sua fonte em `usosDosArquivos`**. Design e fases:
`docs/superpowers/specs/2026-09-23-repositorio-documentos-cliente-design.md`.
```

No spec, trocar a linha de **Status** por:
```markdown
**Status**: Desenho aprovado com o usuário em 23/09/2026. **Fase 1 concluída** (plano
`docs/superpowers/plans/2026-09-24-repositorio-documentos-fase-1.md`); fases 2–4 não iniciadas.
```

- [ ] **Step 7: Verificação final**

Run: `npx tsc --noEmit && npx jest`
Expected: tudo verde.

- [ ] **Step 8: Commit**

```bash
git add src/lib/arquivos/migracao-documentos.ts src/lib/arquivos/migracao-documentos.test.ts scripts/migrar-documentos-para-repositorio.ts CLAUDE.md docs/superpowers/specs/2026-09-23-repositorio-documentos-cliente-design.md docs/superpowers/plans/2026-09-24-repositorio-documentos-fase-1.md
git commit -m "feat(arquivos): migração dos Documento para o repositório + docs (Fase 1, Task 8)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

> `CLAUDE.md` pode ter mudanças de outra sessão no working tree. Antes do `git add CLAUDE.md`, rode `git diff CLAUDE.md`: se houver hunks que não são desta task, use `git add -p CLAUDE.md` e adicione só a seção nova.
