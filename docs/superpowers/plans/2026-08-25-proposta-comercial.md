# Proposta Comercial (Conversão SEI) — Revisão do módulo Documento SEI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename the existing "Documento SEI" module to "Proposta Comercial (Conversão SEI)", move it out of the "Relatórios" menu group into its own top-level group, drop its mandatory link to `Cliente`/`Usuario`, upgrade the PDF→Markdown heuristic to capture italic/underline/alignment and detect tables from the PDF's own vector borders (still with no AI), replace the read-only "Copiar tudo" final screen with a rendered preview plus a "Copiar formatado" button that copies real rich text (HTML) to the clipboard, and let a concluded conversion be reopened for editing.

**Architecture:** Renames the Prisma model `DocumentoSei` → `PropostaComercial` (drops `clienteId`/`uploadedById`), renames `/api/documentos-sei` → `/api/propostas-comerciais` and `/documentos-sei` → `/propostas-comerciais`, and splits the PDF-extraction heuristic (`src/lib/extracao/pdfMarkdown.ts`) into three focused modules: `pdfTracos.ts` (reads the PDF's own drawing operations to find straight stroked/filled segments — the raw material for both underline and table-border detection), `pdfTabelas.ts` (turns those segments into a table grid), and `pdfMarkdown.ts` itself (text-shape heuristics: bold/italic/underline application, title, list, paragraph joining, alignment, orchestration).

**Tech Stack:** Next.js 15 (App Router, `'use client'` pages), Prisma + PostgreSQL, Vercel Blob storage (`@vercel/blob`), `unpdf` (`extractTextItems` for text/font/position, `getResolvedPDFJS`/`getDocumentProxy` for the lower-level `page.getOperatorList()` used to read vector lines), `marked` for Markdown/HTML preview rendering, Jest + Testing Library for tests.

## Global Constraints

- No AI anywhere in the extraction/conversion step — every new detection (italic, underline, alignment, table-by-borders) is deterministic, driven only by font name/size, text position, and the PDF's own vector drawing operations.
- `PropostaComercial` has no relation to `Cliente` or `Usuario` — no client picker, no uploader tracking, no visibility restriction beyond being logged in.
- No new file-size limit, no OCR, no delete endpoint, no autosave-while-editing — same scope cuts as the original module.
- Once `conteudoMarkdown` is saved the record's `status` becomes (or stays) `'concluido'`, but the record is **not** read-only — `PATCH` always accepts a new `conteudoMarkdown`, and the detail page can toggle back into the editor via "Editar novamente" without changing the API contract.
- Follow existing code conventions: Portuguese identifiers/comments, `'use client'` pages fetching from route handlers, `BTN_PRIMARY`/`BTN_OUTLINE`/`INPUT_BASE` from `@/lib/ui`, `Badge` from `@/components/ui/badge`, `.card`/`.card-flush`/`.table-institucional`/`.skeleton` utility classes from `globals.css`.
- Every new pure function/module gets a Jest test using the project's existing mocking style (`jest.mock('unpdf', ...)`, plain object fixtures — no real PDF files in tests).

---

## Task 1: Prisma schema — rename `DocumentoSei` → `PropostaComercial`, drop cliente/usuário

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Produces: Prisma model `PropostaComercial` with fields `id, nomeArquivo, tamanhoBytes, caminhoOriginal, conteudoMarkdown, status, mensagemErro, createdAt` — no `clienteId`/`cliente`/`uploadedById`/`uploadedBy`. Client accessor: `prisma.propostaComercial`. Every later task that touches the database uses exactly these field names.

- [ ] **Step 1: Remove the old model's fields from `Usuario` and `Cliente`, and rename+shrink the model**

In `prisma/schema.prisma`, remove the line `documentosSei DocumentoSei[]` from both `Usuario` and `Cliente`:

```prisma
model Usuario {
  id         String   @id @default(cuid())
  nome       String
  email      String   @unique
  senhaHash  String
  role       String   // uploader | responsavel | admin
  createdAt  DateTime @default(now())
  documentos Documento[]
  acessos    AcessoDocumento[]
  clientesPermitidos Cliente[] @relation("UsuarioClientes")
}
```

```prisma
model Cliente {
  id                 String      @id @default(cuid())
  nome               String      @unique
  createdAt          DateTime    @default(now())
  usuariosPermitidos Usuario[]   @relation("UsuarioClientes")
  documentos         Documento[]
  analisesConsolidadas AnaliseConsolidada[]
  analisesEvolucao  AnaliseEvolucao[]
}
```

Replace the `model DocumentoSei { ... }` block with:

```prisma
model PropostaComercial {
  id               String    @id @default(cuid())
  nomeArquivo      String
  tamanhoBytes     Int
  caminhoOriginal  String
  conteudoMarkdown String?   @db.Text // null só quando status é "erro"
  status           String    @default("rascunho") // rascunho | concluido | erro
  mensagemErro     String?
  createdAt        DateTime  @default(now())
}
```

- [ ] **Step 2: Generate the Prisma client and create the dev migration**

Run:

```bash
npm run dev:db:up
npm run dev:migrate -- --name rename_documento_sei_para_proposta_comercial
```

Expected: a new folder under `prisma/migrations/` with the migration SQL, command ends without error. Because this migration both renames the model and drops columns in one step, Prisma will most likely emit it as `DROP TABLE "DocumentoSei"` + `CREATE TABLE "PropostaComercial"` rather than a clean `ALTER TABLE ... RENAME`, which is fine — any existing `DocumentoSei` rows in the dev database are expected to be lost (already decided as acceptable). This also regenerates `@prisma/client`, so `prisma.propostaComercial` and `Prisma.PropostaComercialWhereInput` become available.

- [ ] **Step 3: Verify the client picked up the new model**

Run: `npx tsc --noEmit -p .`
Expected: errors in the files that still reference `DocumentoSei`/`prisma.documentoSei` (Tasks 2–6, 11–13 fix these) — no error about `PropostaComercial` itself being invalid.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat: renomeia DocumentoSei para PropostaComercial, remove vinculo com cliente e usuario"
```

---

## Task 2: `visibilidade.ts` — remove the DocumentoSei-specific visibility rules

**Files:**
- Modify: `src/lib/visibilidade.ts`

**Interfaces:**
- Produces: no `documentosSeiVisiveisWhere`/`podeVerDocumentoSei` exports anymore — `PropostaComercial` has no visibility rule at all (any authenticated user can see/edit any record). Task 3's routes rely on `getAuthUser` alone.

- [ ] **Step 1: Remove the two functions and the now-unused import**

In `src/lib/visibilidade.ts`, change the top import back to:

```ts
import type { Documento, Prisma } from '@prisma/client'
```

Delete the two functions at the end of the file:

```ts
export async function documentosSeiVisiveisWhere(usuario: AuthUser): Promise<Prisma.DocumentoSeiWhereInput> {
  const idsClientes = await clienteIdsPermitidos(usuario)
  const restricaoCliente: Prisma.DocumentoSeiWhereInput =
    idsClientes === null ? {} : { clienteId: { in: idsClientes } }

  if (usuario.role === 'uploader') {
    return { AND: [restricaoCliente, { uploadedById: usuario.id }] }
  }
  return restricaoCliente
}

export async function podeVerDocumentoSei(usuario: AuthUser, documentoSei: DocumentoSei): Promise<boolean> {
  const idsClientes = await clienteIdsPermitidos(usuario)
  if (idsClientes !== null && !idsClientes.includes(documentoSei.clienteId)) return false

  if (usuario.role === 'uploader') return documentoSei.uploadedById === usuario.id
  return true
}
```

The file should end at `podeVerCliente` (the function right before these two).

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit -p .`
Expected: no errors from `visibilidade.ts` itself (errors from the still-unmigrated API routes in Task 3 are expected until that task is done).

- [ ] **Step 3: Commit**

```bash
git add src/lib/visibilidade.ts
git commit -m "refactor: remove regras de visibilidade de DocumentoSei (PropostaComercial nao tem vinculo)"
```

---

## Task 3: API routes — `/api/propostas-comerciais` (replaces `/api/documentos-sei`)

**Files:**
- Create: `src/app/api/propostas-comerciais/route.ts`
- Create: `src/app/api/propostas-comerciais/[id]/route.ts`
- Create: `src/app/api/propostas-comerciais/[id]/original/route.ts`
- Delete: `src/app/api/documentos-sei/route.ts`
- Delete: `src/app/api/documentos-sei/[id]/route.ts`
- Delete: `src/app/api/documentos-sei/[id]/original/route.ts`

**Interfaces:**
- Consumes: `getAuthUser` (`@/lib/auth`), `buildUploadPath`/`putUpload`/`getUpload` (`@/lib/storage`), `converterPdfParaMarkdown` (`@/lib/extracao/pdfMarkdown`, unchanged signature through Task 9).
- Produces: `GET /api/propostas-comerciais?status=` → array of `{ id, nomeArquivo, tamanhoBytes, status, mensagemErro, createdAt }`. `POST /api/propostas-comerciais` (multipart: `arquivo`) → created `PropostaComercial` (`status: 'rascunho'` or `'erro'`) — used by Task 6's upload page. `GET /api/propostas-comerciais/[id]` → full record including `conteudoMarkdown`. `PATCH /api/propostas-comerciais/[id]` (JSON `{ conteudoMarkdown }`) → sets `status: 'concluido'` and returns the updated record, **regardless of the current status** (no more "already concluded" rejection) — used by Task 12's page for both the first save and any later "Editar novamente" re-save. `GET /api/propostas-comerciais/[id]/original?modo=preview` → raw PDF bytes.

- [ ] **Step 1: Create the list/create route**

Create `src/app/api/propostas-comerciais/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { buildUploadPath, putUpload } from '@/lib/storage'
import { converterPdfParaMarkdown } from '@/lib/extracao/pdfMarkdown'

export async function GET(request: NextRequest) {
  const usuario = await getAuthUser(request)
  if (!usuario) {
    return NextResponse.json({ error: 'não autenticado' }, { status: 401 })
  }

  const status = request.nextUrl.searchParams.get('status')
  const filtros: Prisma.PropostaComercialWhereInput = {}
  if (status) filtros.status = status

  const propostas = await prisma.propostaComercial.findMany({
    where: filtros,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      nomeArquivo: true,
      tamanhoBytes: true,
      status: true,
      mensagemErro: true,
      createdAt: true,
    },
  })

  return NextResponse.json(propostas)
}

export async function POST(request: NextRequest) {
  const usuario = await getAuthUser(request)
  if (!usuario) {
    return NextResponse.json({ error: 'não autenticado' }, { status: 401 })
  }

  const formData = await request.formData().catch(() => null)
  const arquivo = formData?.get('arquivo')
  if (!(arquivo instanceof File)) {
    return NextResponse.json({ error: 'campo "arquivo" é obrigatório' }, { status: 400 })
  }
  if (!arquivo.name.toLowerCase().endsWith('.pdf')) {
    return NextResponse.json({ error: 'só é aceito arquivo PDF' }, { status: 400 })
  }

  const buffer = Buffer.from(await arquivo.arrayBuffer())

  const proposta = await prisma.propostaComercial.create({
    data: {
      nomeArquivo: arquivo.name,
      tamanhoBytes: buffer.length,
      caminhoOriginal: '',
      status: 'rascunho',
    },
  })

  const caminhoRelativo = buildUploadPath(proposta.id, 'pdf')
  const url = await putUpload(caminhoRelativo, buffer)

  let propostaFinal
  try {
    const markdown = await converterPdfParaMarkdown(buffer)
    if (!markdown.trim()) {
      throw new Error(
        'não foi possível extrair texto deste PDF — parece ser um PDF escaneado sem texto selecionável'
      )
    }
    propostaFinal = await prisma.propostaComercial.update({
      where: { id: proposta.id },
      data: { caminhoOriginal: url, conteudoMarkdown: markdown, status: 'rascunho' },
    })
  } catch (error) {
    propostaFinal = await prisma.propostaComercial.update({
      where: { id: proposta.id },
      data: {
        caminhoOriginal: url,
        status: 'erro',
        mensagemErro: error instanceof Error ? error.message : String(error),
      },
    })
  }

  return NextResponse.json(propostaFinal, { status: 201 })
}
```

- [ ] **Step 2: Create the detail/save route**

Create `src/app/api/propostas-comerciais/[id]/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const usuario = await getAuthUser(request)
  if (!usuario) {
    return NextResponse.json({ error: 'não autenticado' }, { status: 401 })
  }

  const { id } = await params
  const proposta = await prisma.propostaComercial.findUnique({ where: { id } })
  if (!proposta) {
    return NextResponse.json({ error: 'proposta comercial não encontrada' }, { status: 404 })
  }

  return NextResponse.json(proposta)
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const usuario = await getAuthUser(request)
  if (!usuario) {
    return NextResponse.json({ error: 'não autenticado' }, { status: 401 })
  }

  const { id } = await params
  const proposta = await prisma.propostaComercial.findUnique({ where: { id } })
  if (!proposta) {
    return NextResponse.json({ error: 'proposta comercial não encontrada' }, { status: 404 })
  }

  const body = await request.json().catch(() => null)
  const conteudoMarkdown = body?.conteudoMarkdown
  if (typeof conteudoMarkdown !== 'string' || !conteudoMarkdown.trim()) {
    return NextResponse.json({ error: '"conteudoMarkdown" é obrigatório' }, { status: 400 })
  }

  const propostaFinal = await prisma.propostaComercial.update({
    where: { id },
    data: { conteudoMarkdown, status: 'concluido' },
  })

  return NextResponse.json(propostaFinal)
}
```

- [ ] **Step 3: Create the original-PDF route**

Create `src/app/api/propostas-comerciais/[id]/original/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { getUpload } from '@/lib/storage'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const usuario = await getAuthUser(request)
  if (!usuario) {
    return NextResponse.json({ error: 'não autenticado' }, { status: 401 })
  }

  const { id } = await params
  const proposta = await prisma.propostaComercial.findUnique({ where: { id } })
  if (!proposta) {
    return NextResponse.json({ error: 'proposta comercial não encontrada' }, { status: 404 })
  }

  const modoPreview = request.nextUrl.searchParams.get('modo') === 'preview'
  const buffer = await getUpload(proposta.caminhoOriginal)

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${modoPreview ? 'inline' : 'attachment'}; filename="${proposta.nomeArquivo}"`,
    },
  })
}
```

- [ ] **Step 4: Delete the old routes**

```bash
git rm -r src/app/api/documentos-sei
```

- [ ] **Step 5: Verify it compiles**

Run: `npx tsc --noEmit -p .`
Expected: no errors from any `src/app/api/propostas-comerciais/**` or `src/app/api/documentos-sei/**` file (the latter no longer exists). Errors from `src/app/documentos-sei/**` pages/components are still expected until Tasks 5, 6, 11–13.

- [ ] **Step 6: Commit**

```bash
git add -A src/app/api/propostas-comerciais src/app/api/documentos-sei
git commit -m "feat: renomeia rotas de DocumentoSei para /api/propostas-comerciais, sem cliente/usuario"
```

---

## Task 4: Menu lateral — grupo próprio "Proposta Comercial (Conversão SEI)"

**Files:**
- Modify: `src/components/nav-bar.tsx`
- Modify: `src/components/nav-bar.test.tsx`

**Interfaces:**
- Produces: a new expandable menu group (same visual family as "Configuração") labeled "Proposta Comercial (Conversão SEI)", born open, containing one link "Histórico" → `/propostas-comerciais`. `RELATORIOS_SUBLINKS` loses its `Documento SEI` entry.

- [ ] **Step 1: Write the failing tests**

In `src/components/nav-bar.test.tsx`, replace this test:

```ts
  it('"Documento SEI" fica dentro do grupo "Relatórios dos clientes", ao lado de "Todos os documentos"', () => {
    render(<NavBar />)
    expect(screen.getByRole('link', { name: 'Documento SEI' })).toHaveAttribute('href', '/documentos-sei')
  })
```

with:

```ts
  it('"Proposta Comercial (Conversão SEI)" é um grupo próprio, fora de "Relatórios", aberto por padrão', () => {
    render(<NavBar />)
    const botao = screen.getByRole('button', { name: 'Proposta Comercial (Conversão SEI)' })
    expect(botao).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('link', { name: 'Histórico' })).toHaveAttribute('href', '/propostas-comerciais')
  })

  it('alterna o grupo "Proposta Comercial (Conversão SEI)" ao clicar, sem navegar', () => {
    render(<NavBar />)
    const botao = screen.getByRole('button', { name: 'Proposta Comercial (Conversão SEI)' })

    fireEvent.click(botao)
    expect(botao).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('link', { name: 'Histórico' })).not.toBeInTheDocument()

    fireEvent.click(botao)
    expect(botao).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('link', { name: 'Histórico' })).toBeInTheDocument()
  })
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest src/components/nav-bar.test.tsx -t "Proposta Comercial"`
Expected: FAIL — no button named "Proposta Comercial (Conversão SEI)" found.

- [ ] **Step 3: Remove the old sub-item and add the new group**

In `src/components/nav-bar.tsx`, change the `lucide-react` import list — remove nothing, add `History`:

```ts
import {
  FileText,
  Users,
  Bell,
  UserCog,
  Building2,
  BellRing,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Settings,
  ArrowLeftRight,
  ClipboardCopy,
  History,
  type LucideIcon,
} from 'lucide-react'
```

Change `RELATORIOS_SUBLINKS` back to just the one entry, and add the new group's constant right after it:

```ts
const RELATORIOS_LINK = { href: '/clientes', label: 'Relatórios dos clientes', icon: Building2 }
const RELATORIOS_SUBLINKS = [{ href: '/', label: 'Todos os documentos', icon: FileText }]

// "Proposta Comercial (Conversão SEI)" é outro módulo à parte, sem página
// própria de grupo (diferente de "Relatórios dos clientes") — o cabeçalho é
// só um botão que abre/fecha o único sub-item de hoje, "Histórico".
const PROPOSTA_COMERCIAL_SUBLINKS = [{ href: '/propostas-comerciais', label: 'Histórico', icon: History }]
```

Add state right after `relatoriosAberto`:

```ts
  // Nasce aberto pelo mesmo motivo que "Relatórios dos clientes": é a única
  // coisa dentro do grupo hoje, não faz sentido esconder por padrão.
  const [propostaComercialAberto, setPropostaComercialAberto] = useState(true)
```

Add a `useEffect` right after the one that reopens "Relatórios":

```ts
  useEffect(() => {
    if (PROPOSTA_COMERCIAL_SUBLINKS.some((link) => link.href === pathname)) {
      setPropostaComercialAberto(true)
    }
  }, [pathname])
```

Add a handler right after `alternarRelatorios`:

```ts
  function alternarPropostaComercial() {
    if (!expandida) {
      setExpandida(true)
      localStorage.setItem(NAV_EXPANDIDA_KEY, 'true')
      setPropostaComercialAberto(true)
      return
    }
    setPropostaComercialAberto((aberto) => !aberto)
  }
```

Finally, render the group right after the `{expandida && relatoriosAberto && (...)}` block that lists `RELATORIOS_SUBLINKS`, and before the `NOTIFICACOES_LINK`'s `<LinkMenu>`:

```tsx
        <button
          type="button"
          onClick={alternarPropostaComercial}
          aria-label="Proposta Comercial (Conversão SEI)"
          aria-expanded={propostaComercialAberto}
          className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium text-light-blue transition-colors hover:bg-white/[0.06] hover:text-white"
        >
          <span className="flex shrink-0 items-center justify-center">
            <ClipboardCopy className="size-3.5" strokeWidth={2.25} />
          </span>
          {expandida && (
            <>
              <span className="truncate whitespace-nowrap">Proposta Comercial (Conversão SEI)</span>
              <span className="ml-auto flex shrink-0 items-center justify-center">
                {propostaComercialAberto ? (
                  <ChevronUp className="size-3.5" strokeWidth={2.25} />
                ) : (
                  <ChevronDown className="size-3.5" strokeWidth={2.25} />
                )}
              </span>
            </>
          )}
        </button>

        {expandida && propostaComercialAberto && (
          <div className="flex flex-col gap-1 pl-4">
            {PROPOSTA_COMERCIAL_SUBLINKS.map((link) => (
              <LinkMenu
                key={link.href}
                href={link.href}
                label={link.label}
                icon={link.icon}
                ativo={pathname === link.href}
                expandida={expandida}
              />
            ))}
          </div>
        )}
```

Note this button uses `aria-label` equal to its own visible text — that's what makes `getByRole('button', { name: 'Proposta Comercial (Conversão SEI)' })` work in the test above, same pattern the existing `Configuração` button already uses.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest src/components/nav-bar.test.tsx`
Expected: PASS — every test in the file, including the two new ones.

- [ ] **Step 5: Commit**

```bash
git add src/components/nav-bar.tsx src/components/nav-bar.test.tsx
git commit -m "feat: Proposta Comercial vira grupo proprio no menu, fora de Relatorios"
```

---

## Task 5: Página de histórico — `/propostas-comerciais`

**Files:**
- Create: `src/app/propostas-comerciais/page.tsx`
- Delete: `src/app/documentos-sei/page.tsx`

**Interfaces:**
- Consumes: `GET /api/propostas-comerciais?status=` (Task 3).
- Produces: the `/propostas-comerciais` route — table of past conversions (Arquivo, Data, Status, Ações — no cliente/uploader columns), "Nova conversão" button to `/propostas-comerciais/novo` (Task 6), "Ver" link per row to `/propostas-comerciais/{id}` (Task 12).

- [ ] **Step 1: Create the page**

Create `src/app/propostas-comerciais/page.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, Eye, Inbox } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { BTN_PRIMARY } from '@/lib/ui'

interface PropostaComercial {
  id: string
  nomeArquivo: string
  status: string
  createdAt: string
}

const STATUS_BADGE: Record<string, 'success' | 'neutral' | 'critical'> = {
  concluido: 'success',
  rascunho: 'neutral',
  erro: 'critical',
}

const STATUS_LABEL: Record<string, string> = {
  concluido: 'Concluído',
  rascunho: 'Rascunho',
  erro: 'Erro',
}

export default function PropostasComerciaisPage() {
  const [propostas, setPropostas] = useState<PropostaComercial[]>([])
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    fetch('/api/propostas-comerciais')
      .then((r) => (r.ok ? r.json() : []))
      .then(setPropostas)
      .finally(() => setCarregando(false))
  }, [])

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-6 py-8 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <span className="text-xs font-semibold tracking-wide text-orange uppercase">Proposta Comercial</span>
          <h1 className="text-2xl font-bold text-navy">Proposta Comercial (Conversão SEI)</h1>
        </div>
        <Link href="/propostas-comerciais/novo" className={BTN_PRIMARY}>
          <Plus className="size-3.5" strokeWidth={2.25} />
          Nova conversão
        </Link>
      </div>

      <div className="card-flush">
        {carregando ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="skeleton h-10 w-full" />
            ))}
          </div>
        ) : propostas.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-10 text-center">
            <span className="flex size-11 items-center justify-center rounded-full bg-light-grey text-mid-grey">
              <Inbox className="size-5" strokeWidth={1.75} />
            </span>
            <p className="text-sm text-mid-grey">Nenhuma conversão ainda.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-institucional">
              <thead>
                <tr>
                  <th>Arquivo</th>
                  <th>Data</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {propostas.map((proposta) => (
                  <tr key={proposta.id}>
                    <td className="font-medium text-navy">{proposta.nomeArquivo}</td>
                    <td className="text-mid-grey">{new Date(proposta.createdAt).toLocaleString('pt-BR')}</td>
                    <td>
                      <Badge variant={STATUS_BADGE[proposta.status] ?? 'neutral'}>
                        {STATUS_LABEL[proposta.status] ?? proposta.status}
                      </Badge>
                    </td>
                    <td>
                      <Link
                        href={`/propostas-comerciais/${proposta.id}`}
                        className="flex items-center gap-1 text-sm font-medium text-navy transition-colors hover:text-orange hover:underline"
                      >
                        <Eye className="size-3.5" strokeWidth={2.25} />
                        Ver
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  )
}
```

(No dedicated test file — matches the existing convention where the analogous root `/` documents list page has none.)

- [ ] **Step 2: Delete the old page**

```bash
git rm src/app/documentos-sei/page.tsx
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit -p .`
Expected: no errors from `src/app/propostas-comerciais/page.tsx`.

- [ ] **Step 4: Commit**

```bash
git add -A src/app/propostas-comerciais/page.tsx src/app/documentos-sei/page.tsx
git commit -m "feat: pagina de historico de Proposta Comercial, sem coluna de cliente"
```

---

## Task 6: Página de upload — `/propostas-comerciais/novo`

**Files:**
- Create: `src/app/propostas-comerciais/novo/page.tsx`
- Delete: `src/app/documentos-sei/novo/page.tsx`

**Interfaces:**
- Consumes: `POST /api/propostas-comerciais` (Task 3).
- Produces: the `/propostas-comerciais/novo` route — a form with only a PDF file input (no client picker) that redirects to `/propostas-comerciais/{id}` on success.

- [ ] **Step 1: Create the page**

Create `src/app/propostas-comerciais/novo/page.tsx`:

```tsx
'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, UploadCloud } from 'lucide-react'
import { BTN_PRIMARY, INPUT_BASE } from '@/lib/ui'

export default function NovaPropostaComercialPage() {
  const router = useRouter()
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!arquivo) {
      setErro('Escolha um arquivo PDF.')
      return
    }

    setEnviando(true)
    setErro(null)

    const formData = new FormData()
    formData.set('arquivo', arquivo)

    const response = await fetch('/api/propostas-comerciais', { method: 'POST', body: formData })
    const resultado = await response.json().catch(() => null)

    if (!response.ok) {
      setEnviando(false)
      setErro(resultado?.error ?? 'Falha ao enviar o PDF.')
      return
    }

    router.push(`/propostas-comerciais/${resultado.id}`)
  }

  return (
    <main className="mx-auto max-w-2xl space-y-6 px-6 py-8 lg:px-8">
      <div className="space-y-1">
        <span className="text-xs font-semibold tracking-wide text-orange uppercase">Proposta Comercial</span>
        <h1 className="text-2xl font-bold text-navy">Nova conversão</h1>
      </div>

      <form onSubmit={handleSubmit} className="card space-y-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium text-mid-grey">Proposta em PDF</span>
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
            className={INPUT_BASE}
          />
        </label>

        {erro && (
          <p className="flex items-center gap-2 rounded-lg bg-red-crit-light p-3 text-sm text-red-crit">
            <AlertCircle className="size-4 shrink-0" strokeWidth={2.25} />
            {erro}
          </p>
        )}

        <button type="submit" disabled={enviando} className={BTN_PRIMARY}>
          <UploadCloud className="size-3.5" strokeWidth={2.25} />
          {enviando ? 'Enviando...' : 'Enviar'}
        </button>
      </form>
    </main>
  )
}
```

(No dedicated test file, matching the original module's convention for this same page.)

- [ ] **Step 2: Delete the old page**

```bash
git rm src/app/documentos-sei/novo/page.tsx
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit -p .`
Expected: no errors from `src/app/propostas-comerciais/novo/page.tsx`.

- [ ] **Step 4: Commit**

```bash
git add -A src/app/propostas-comerciais/novo/page.tsx src/app/documentos-sei/novo/page.tsx
git commit -m "feat: pagina de upload de Proposta Comercial, sem seletor de cliente"
```

---

## Task 7: `pdfMarkdown.ts` — itálico, e exportar os tipos/funções compartilhados

**Files:**
- Modify: `src/lib/extracao/pdfMarkdown.ts`
- Modify: `src/lib/extracao/pdfMarkdown.test.ts`

**Interfaces:**
- Produces: `export interface ItemLinha { texto, x, width, negrito, italico }`, `export interface Linha { itens: ItemLinha[], fontSizeMedio }` (both still missing `y`/`pagina`/`sublinhado` — added in Task 9), `export function formatarTexto(item: ItemLinha): string`, `export function montarTabelaMarkdown(linhas: string[][]): string`. Task 9 (`pdfTabelas.ts` + the rest of the wiring) imports `Linha`, `ItemLinha`, `formatarTexto`, `montarTabelaMarkdown` from this file.

- [ ] **Step 1: Write the failing tests**

In `src/lib/extracao/pdfMarkdown.test.ts`, add these two tests right after the "envolve trecho com fonte em negrito" test:

```ts
  it('envolve trecho em itálico com *...*', async () => {
    ;(extractTextItems as jest.Mock).mockResolvedValue({
      totalPages: 1,
      items: [[item({ str: 'Termo em itálico', x: 0, fontFamily: 'Helvetica-Oblique', hasEOL: true })]],
    })

    const resultado = await converterPdfParaMarkdown(Buffer.from(''))

    expect(resultado).toBe('*Termo em itálico*')
  })

  it('combina negrito e itálico em ***...*** quando os dois batem no mesmo trecho', async () => {
    ;(extractTextItems as jest.Mock).mockResolvedValue({
      totalPages: 1,
      items: [[item({ str: 'Muito importante', x: 0, fontFamily: 'Helvetica-BoldOblique', hasEOL: true })]],
    })

    const resultado = await converterPdfParaMarkdown(Buffer.from(''))

    expect(resultado).toBe('***Muito importante***')
  })
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest src/lib/extracao/pdfMarkdown.test.ts -t "itálico"`
Expected: FAIL — result still equals plain text (no `*` wrapping).

- [ ] **Step 3: Add italic detection and the shared `formatarTexto` helper**

In `src/lib/extracao/pdfMarkdown.ts`, change the two interfaces (add `export` and the `italico` field):

```ts
export interface ItemLinha {
  texto: string
  x: number
  width: number
  negrito: boolean
  italico: boolean
}

export interface Linha {
  itens: ItemLinha[]
  fontSizeMedio: number
}
```

In `construirLinha`, add italic detection next to the existing bold detection:

```ts
function construirLinha(itensBrutos: StructuredTextItem[]): Linha {
  const itens: ItemLinha[] = itensBrutos
    .filter((item) => item.str.trim().length > 0)
    .map((item) => ({
      texto: item.str,
      x: item.x,
      width: item.width,
      negrito: /bold|negrito/i.test(item.fontFamily),
      italico: /italic|oblique|itálico/i.test(item.fontFamily),
    }))
  const fontSizeMedio =
    itensBrutos.reduce((soma, item) => soma + item.fontSize, 0) / (itensBrutos.length || 1)
  return { itens, fontSizeMedio }
}
```

Add the shared formatting helper right after the `Linha`/`ItemLinha` interfaces:

```ts
/** Aplica negrito/itálico (Markdown) a um trecho de texto — fonte única desse
 *  formato, reaproveitada tanto pra parágrafo comum quanto pra célula de
 *  tabela (posição ou borda). */
export function formatarTexto(item: ItemLinha): string {
  if (item.negrito && item.italico) return `***${item.texto}***`
  if (item.negrito) return `**${item.texto}**`
  if (item.italico) return `*${item.texto}*`
  return item.texto
}
```

Replace the two places that inline the old negrito-only ternary with calls to `formatarTexto`:

In `linhaParaColunas`:

```ts
function linhaParaColunas(linha: Linha, anchors: number[]): string[] {
  const celulas: string[] = anchors.map(() => '')
  for (const item of linha.itens) {
    let indiceColuna = 0
    for (let j = anchors.length - 1; j >= 0; j--) {
      if (item.x >= anchors[j] - 1) {
        indiceColuna = j
        break
      }
    }
    const texto = formatarTexto(item)
    celulas[indiceColuna] = celulas[indiceColuna] ? `${celulas[indiceColuna]} ${texto}` : texto
  }
  return celulas
}
```

In `extrairTextoLinha`:

```ts
function extrairTextoLinha(linha: Linha): string {
  return linha.itens.map((item) => formatarTexto(item)).join(' ').trim()
}
```

Finally, add `export` to `montarTabelaMarkdown` (no other change to its body):

```ts
export function montarTabelaMarkdown(linhas: string[][]): string {
  const [cabecalho, ...resto] = linhas
  const separador = cabecalho.map(() => '---')
  return [cabecalho, separador, ...resto].map((linha) => `| ${linha.join(' | ')} |`).join('\n')
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest src/lib/extracao/pdfMarkdown.test.ts`
Expected: PASS — every test in the file, including the two new ones (existing bold/title/list/table/rodapé tests keep passing unchanged since none of their `item()` fixtures use an italic-looking `fontFamily`).

- [ ] **Step 5: Commit**

```bash
git add src/lib/extracao/pdfMarkdown.ts src/lib/extracao/pdfMarkdown.test.ts
git commit -m "feat: detecta italico na conversao de PDF pra Markdown"
```

---

## Task 8: `pdfTracos.ts` — segmentos retos (linhas/bordas) desenhados no PDF

**Files:**
- Create: `src/lib/extracao/pdfTracos.ts`
- Test: `src/lib/extracao/pdfTracos.test.ts`

**Interfaces:**
- Consumes: `getResolvedPDFJS`, `getDocumentProxy` (`unpdf`).
- Produces: `export interface SegmentoReto { x1: number; y1: number; x2: number; y2: number }` and `export async function extrairSegmentosRetosPorPagina(pdf: Awaited<ReturnType<typeof getDocumentProxy>>, totalPaginas: number): Promise<SegmentoReto[][]>` — an array with one entry per page (index 0 = first page), each holding the page's horizontal/vertical stroked or thin-filled segments in the same coordinate space (origin bottom-left, Y growing upward) as `StructuredTextItem.x/y` from `extractTextItems`. Task 9 calls this from `converterPdfParaMarkdown`, and Task 9's own `pdfTabelas.ts` also consumes `SegmentoReto[]`.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/extracao/pdfTracos.test.ts`:

```ts
import { extrairSegmentosRetosPorPagina } from './pdfTracos'

// Códigos reais do pdf.js (conferidos com `OPS` de `getResolvedPDFJS()` numa
// instalação real do unpdf) — fixos aqui pro teste não depender do pacote.
// `var` (não `const`) + nome começando com "mock" porque `jest.mock` abaixo é
// hoisted pro topo do arquivo — com `const` o mock capturaria `undefined`.
var mockOps = {
  save: 10,
  restore: 11,
  transform: 12,
  stroke: 20,
  closeStroke: 21,
  fill: 22,
  eoFill: 23,
  fillStroke: 24,
  eoFillStroke: 25,
  closeFillStroke: 26,
  closeEOFillStroke: 27,
  constructPath: 91,
}

// Fábrica lê `mockOps` só quando chamada (não no `.mockResolvedValue` direto)
// — assim pega o valor já atribuído, mesmo com a atribuição vindo "depois"
// do `jest.mock` hoisted.
jest.mock('unpdf', () => ({
  getResolvedPDFJS: jest.fn(() => Promise.resolve({ OPS: mockOps })),
}))

function pdfFalso(fnArray: number[], argsArray: unknown[]) {
  return {
    getPage: jest.fn().mockResolvedValue({
      getOperatorList: jest.fn().mockResolvedValue({ fnArray, argsArray }),
    }),
  }
}

describe('extrairSegmentosRetosPorPagina', () => {
  it('extrai uma linha horizontal (moveTo + lineTo) já convertida pela matriz de transformação corrente', async () => {
    const caminho = new Float32Array([0, 100, 50, 1, 300, 50]) // moveTo(100,50) lineTo(300,50)
    const pdf = pdfFalso(
      [mockOps.transform, mockOps.constructPath],
      [
        [1, 0, 0, 1, 10, 20], // translada (10, 20)
        [mockOps.stroke, [caminho], new Float32Array([100, 50, 300, 50])],
      ]
    )

    const [segmentosPagina1] = await extrairSegmentosRetosPorPagina(pdf as never, 1)

    expect(segmentosPagina1).toEqual([{ x1: 110, y1: 70, x2: 310, y2: 70 }])
  })

  it('respeita save/restore ao acumular a matriz — transform dentro de save/restore não vaza pro traço seguinte', async () => {
    const caminho = new Float32Array([0, 0, 0, 1, 100, 0])
    const pdf = pdfFalso(
      [mockOps.save, mockOps.transform, mockOps.restore, mockOps.constructPath],
      [
        null,
        [1, 0, 0, 1, 1000, 1000],
        null,
        [mockOps.stroke, [caminho], new Float32Array([0, 0, 100, 0])],
      ]
    )

    const [segmentosPagina1] = await extrairSegmentosRetosPorPagina(pdf as never, 1)

    expect(segmentosPagina1).toEqual([{ x1: 0, y1: 0, x2: 100, y2: 0 }])
  })

  it('descarta segmento diagonal (não é reto horizontal nem vertical)', async () => {
    const caminho = new Float32Array([0, 0, 0, 1, 100, 100])
    const pdf = pdfFalso(
      [mockOps.constructPath],
      [[mockOps.stroke, [caminho], new Float32Array([0, 0, 100, 100])]]
    )

    const [segmentosPagina1] = await extrairSegmentosRetosPorPagina(pdf as never, 1)

    expect(segmentosPagina1).toEqual([])
  })

  it('ignora path preenchido não-fino (não é traço nem barra de sublinhado)', async () => {
    const caminho = new Float32Array([0, 0, 0, 1, 50, 0, 1, 50, 50, 1, 0, 50, 4])
    const pdf = pdfFalso(
      [mockOps.constructPath],
      [[mockOps.fill, [caminho], new Float32Array([0, 0, 50, 50])]]
    )

    const [segmentosPagina1] = await extrairSegmentosRetosPorPagina(pdf as never, 1)

    expect(segmentosPagina1).toEqual([])
  })

  it('trata um path preenchido bem fino (barra de sublinhado desenhada como retângulo) como traço aproveitável', async () => {
    // retângulo fino: moveTo(0,0) lineTo(100,0) lineTo(100,2) lineTo(0,2) closePath
    const caminho = new Float32Array([0, 0, 0, 1, 100, 0, 1, 100, 2, 1, 0, 2, 4])
    const pdf = pdfFalso(
      [mockOps.constructPath],
      [[mockOps.fill, [caminho], new Float32Array([0, 0, 100, 2])]]
    )

    const [segmentosPagina1] = await extrairSegmentosRetosPorPagina(pdf as never, 1)

    expect(segmentosPagina1).toContainEqual({ x1: 0, y1: 0, x2: 100, y2: 0 })
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest src/lib/extracao/pdfTracos.test.ts`
Expected: FAIL — `Cannot find module './pdfTracos'`.

- [ ] **Step 3: Implement `pdfTracos.ts`**

Create `src/lib/extracao/pdfTracos.ts`:

```ts
import { getDocumentProxy, getResolvedPDFJS } from 'unpdf'

type PdfDocumento = Awaited<ReturnType<typeof getDocumentProxy>>

/** Segmento reto (horizontal ou vertical) desenhado na página, em coordenadas
 *  nativas do PDF — mesma origem/orientação (canto inferior esquerdo, Y
 *  crescendo pra cima) que `StructuredTextItem.x/y` do `unpdf` já usa, então
 *  dá pra comparar posição de texto e de traço diretamente. */
export interface SegmentoReto {
  x1: number
  y1: number
  x2: number
  y2: number
}

type Matriz = [number, number, number, number, number, number]

const IDENTIDADE: Matriz = [1, 0, 0, 1, 0, 0]

/** Composição de matrizes afins 2D no mesmo formato `[a,b,c,d,e,f]` do
 *  `transform` do PDF/canvas (x' = a·x + c·y + e; y' = b·x + d·y + f) —
 *  equivalente a `ctx.transform(...)`: aplica `m2` primeiro, depois `m1`. */
function multiplicar(m1: Matriz, m2: Matriz): Matriz {
  return [
    m1[0] * m2[0] + m1[2] * m2[1],
    m1[1] * m2[0] + m1[3] * m2[1],
    m1[0] * m2[2] + m1[2] * m2[3],
    m1[1] * m2[2] + m1[3] * m2[3],
    m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
    m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
  ]
}

function aplicar(m: Matriz, x: number, y: number): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]
}

/** Tolerância (em pontos) pra considerar um segmento horizontal ou vertical
 *  "reto de verdade", mesmo com pequeno erro de arredondamento. */
const TOLERANCIA_RETO = 0.75

/** Abaixo dessa dimensão mínima (largura OU altura do bounding box do path),
 *  um path PREENCHIDO (sem traço) ainda conta como candidato a traço — é o
 *  jeito comum de desenhar uma barra de sublinhado ou uma borda de tabela sem
 *  usar `stroke`. */
const DIMENSAO_MAX_PREENCHIMENTO_FINO = 3

/** Códigos de sub-operação dentro do buffer de um `constructPath`, conforme o
 *  pdf.js empacota internamente: moveTo/lineTo/curveTo/quadraticCurveTo/closePath. */
const SUBOP_MOVE_TO = 0
const SUBOP_LINE_TO = 1
const SUBOP_CURVE_TO = 2
const SUBOP_QUADRATIC_CURVE_TO = 3
const SUBOP_CLOSE_PATH = 4

/**
 * Extrai, de cada página do PDF, os segmentos retos (horizontais/verticais)
 * desenhados com traço (linha) ou preenchimento fino (barra) — matéria-prima
 * pra detectar sublinhado (`pdfMarkdown.ts`) e bordas de tabela
 * (`pdfTabelas.ts`) sem depender só da posição do texto.
 *
 * Lê a lista de operações de desenho de cada página (`page.getOperatorList()`)
 * e reconstrói a posição real de cada traço acompanhando a matriz de
 * transformação corrente (`save`/`restore`/`transform`) — os pontos dentro de
 * um `constructPath` vêm em coordenadas locais (do momento em que o traço foi
 * desenhado), não já convertidas pra página.
 */
export async function extrairSegmentosRetosPorPagina(
  pdf: PdfDocumento,
  totalPaginas: number
): Promise<SegmentoReto[][]> {
  const pdfjs = await getResolvedPDFJS()
  const OPS = pdfjs.OPS
  const operacoesComTraco = new Set([
    OPS.stroke,
    OPS.closeStroke,
    OPS.fillStroke,
    OPS.eoFillStroke,
    OPS.closeFillStroke,
    OPS.closeEOFillStroke,
  ])

  const resultado: SegmentoReto[][] = []
  for (let numeroPagina = 1; numeroPagina <= totalPaginas; numeroPagina++) {
    const pagina = await pdf.getPage(numeroPagina)
    const operatorList = (await pagina.getOperatorList()) as {
      fnArray: number[]
      argsArray: unknown[]
    }
    resultado.push(extrairSegmentosDaPagina(operatorList, OPS, operacoesComTraco))
  }

  return resultado
}

function extrairSegmentosDaPagina(
  operatorList: { fnArray: number[]; argsArray: unknown[] },
  OPS: Record<string, number>,
  operacoesComTraco: Set<number>
): SegmentoReto[] {
  const segmentos: SegmentoReto[] = []
  const pilha: Matriz[] = []
  let atual: Matriz = IDENTIDADE

  for (let i = 0; i < operatorList.fnArray.length; i++) {
    const fn = operatorList.fnArray[i]

    if (fn === OPS.save) {
      pilha.push(atual)
    } else if (fn === OPS.restore) {
      atual = pilha.pop() ?? IDENTIDADE
    } else if (fn === OPS.transform) {
      const matrizAplicada = operatorList.argsArray[i] as Matriz
      atual = multiplicar(atual, matrizAplicada)
    } else if (fn === OPS.constructPath) {
      const [tipoPintura, buffers, minMax] = operatorList.argsArray[i] as [
        number,
        [Float32Array | null],
        Float32Array | null,
      ]
      const desenhaTraco = operacoesComTraco.has(tipoPintura)
      const ehPreenchimentoFino =
        !desenhaTraco &&
        minMax !== null &&
        Math.min(minMax[2] - minMax[0], minMax[3] - minMax[1]) <= DIMENSAO_MAX_PREENCHIMENTO_FINO
      if ((desenhaTraco || ehPreenchimentoFino) && buffers[0]) {
        segmentos.push(...decodificarCaminho(buffers[0], atual))
      }
    }
  }

  return segmentos
}

function decodificarCaminho(buffer: Float32Array, matriz: Matriz): SegmentoReto[] {
  const segmentos: SegmentoReto[] = []
  let i = 0
  let pontoAtual: [number, number] | null = null
  let inicioSubcaminho: [number, number] | null = null

  while (i < buffer.length) {
    const subop = buffer[i]
    i++

    if (subop === SUBOP_MOVE_TO) {
      pontoAtual = aplicar(matriz, buffer[i], buffer[i + 1])
      inicioSubcaminho = pontoAtual
      i += 2
    } else if (subop === SUBOP_LINE_TO) {
      const destino = aplicar(matriz, buffer[i], buffer[i + 1])
      if (pontoAtual) segmentos.push(...paraSegmentoReto(pontoAtual, destino))
      pontoAtual = destino
      i += 2
    } else if (subop === SUBOP_CURVE_TO) {
      const destino = aplicar(matriz, buffer[i + 4], buffer[i + 5])
      if (pontoAtual) segmentos.push(...paraSegmentoReto(pontoAtual, destino))
      pontoAtual = destino
      i += 6
    } else if (subop === SUBOP_QUADRATIC_CURVE_TO) {
      const destino = aplicar(matriz, buffer[i + 2], buffer[i + 3])
      if (pontoAtual) segmentos.push(...paraSegmentoReto(pontoAtual, destino))
      pontoAtual = destino
      i += 4
    } else if (subop === SUBOP_CLOSE_PATH) {
      if (pontoAtual && inicioSubcaminho) segmentos.push(...paraSegmentoReto(pontoAtual, inicioSubcaminho))
      pontoAtual = inicioSubcaminho
    } else {
      break // formato de buffer inesperado — para em vez de interpretar lixo
    }
  }

  return segmentos
}

/** Um trecho reto (moveTo→lineTo, ou o "salto" de uma curva degenerada usada
 *  como acabamento de linha) só vira segmento aproveitável se for horizontal
 *  ou vertical de verdade — diagonal não interessa pra sublinhado/tabela. */
function paraSegmentoReto(origem: [number, number], destino: [number, number]): SegmentoReto[] {
  const [x1, y1] = origem
  const [x2, y2] = destino
  if (Math.abs(y1 - y2) <= TOLERANCIA_RETO && Math.abs(x1 - x2) > TOLERANCIA_RETO) {
    const y = (y1 + y2) / 2
    return [{ x1: Math.min(x1, x2), y1: y, x2: Math.max(x1, x2), y2: y }]
  }
  if (Math.abs(x1 - x2) <= TOLERANCIA_RETO && Math.abs(y1 - y2) > TOLERANCIA_RETO) {
    const x = (x1 + x2) / 2
    return [{ x1: x, y1: Math.min(y1, y2), x2: x, y2: Math.max(y1, y2) }]
  }
  return []
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest src/lib/extracao/pdfTracos.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/extracao/pdfTracos.ts src/lib/extracao/pdfTracos.test.ts
git commit -m "feat: extrai segmentos retos (linhas/bordas) desenhados no PDF"
```

---

## Task 9: `pdfTabelas.ts` + ligar tudo em `pdfMarkdown.ts` (sublinhado, alinhamento, tabela por bordas)

This task both creates `pdfTabelas.ts` and wires it — together with `pdfTracos.ts` from Task 8 — into `pdfMarkdown.ts`. The two are done together because `pdfTabelas.ts` needs `Linha` to already carry `y`/`pagina` (added here) to be meaningfully testable, and that extension only makes sense alongside the rest of the wiring that uses it (underline, alignment) — splitting them would leave an intermediate state where neither file's tests fully compile.

**Files:**
- Create: `src/lib/extracao/pdfTabelas.ts`
- Test: `src/lib/extracao/pdfTabelas.test.ts`
- Modify: `src/lib/extracao/pdfMarkdown.ts`
- Modify: `src/lib/extracao/pdfMarkdown.test.ts`

**Interfaces:**
- Consumes (in `pdfTabelas.ts`): `Linha`, `ItemLinha`, `formatarTexto`, `montarTabelaMarkdown` (all from `./pdfMarkdown`, Tasks 7 and this one), `SegmentoReto` (from `./pdfTracos`, Task 8). Consumes (in `pdfMarkdown.ts`): `extrairSegmentosRetosPorPagina`, `type SegmentoReto` (Task 8); `construirGradeDaPagina`, `detectarTabelaPorBordas`, `type GradeDeTabela` (this task's own `pdfTabelas.ts`).
- Produces: `export interface GradeDeTabela { y: number[]; x: number[] }`, `export function construirGradeDaPagina(segmentos: SegmentoReto[]): GradeDeTabela | null`, `export function detectarTabelaPorBordas(linhas: Linha[], indiceInicial: number, grade: GradeDeTabela): { markdown: string; proximoIndice: number } | null` in `pdfTabelas.ts`. In `pdfMarkdown.ts`: `ItemLinha` gains `sublinhado: boolean`; `Linha` gains `y: number` and `pagina: number`. `converterPdfParaMarkdown`'s external signature (`(buffer: Buffer) => Promise<string>`) is unchanged — Task 3's routes need no changes.

- [ ] **Step 1: Write the failing tests — `pdfTabelas.test.ts` first**

Create `src/lib/extracao/pdfTabelas.test.ts`:

```ts
import { construirGradeDaPagina, detectarTabelaPorBordas, type GradeDeTabela } from './pdfTabelas'
import type { Linha } from './pdfMarkdown'

function segmento(x1: number, y1: number, x2: number, y2: number) {
  return { x1, y1, x2, y2 }
}

function linha(itens: Array<{ texto: string; x: number; width: number }>, y: number, pagina = 0): Linha {
  return {
    pagina,
    y,
    fontSizeMedio: 10,
    itens: itens.map((i) => ({
      texto: i.texto,
      x: i.x,
      width: i.width,
      negrito: false,
      italico: false,
      sublinhado: false,
    })),
  }
}

describe('construirGradeDaPagina', () => {
  it('monta a grade a partir de linhas horizontais e colunas verticais compridas o bastante', () => {
    const segmentos = [
      segmento(0, 100, 200, 100),
      segmento(0, 80, 200, 80),
      segmento(0, 60, 200, 60),
      segmento(0, 60, 0, 100),
      segmento(100, 60, 100, 100),
      segmento(200, 60, 200, 100),
    ]

    expect(construirGradeDaPagina(segmentos)).toEqual({ y: [100, 80, 60], x: [0, 100, 200] })
  })

  it('ignora traços curtos demais pra serem borda de tabela', () => {
    const segmentos = [segmento(0, 100, 5, 100), segmento(0, 80, 5, 80), segmento(0, 60, 3, 60)]

    expect(construirGradeDaPagina(segmentos)).toBeNull()
  })

  it('devolve null quando não há pelo menos 2 linhas e 2 colunas', () => {
    expect(construirGradeDaPagina([segmento(0, 100, 200, 100)])).toBeNull()
  })
})

describe('detectarTabelaPorBordas', () => {
  const grade: GradeDeTabela = { y: [100, 80, 60], x: [0, 100, 200] }

  it('encaixa o texto nas células da grade e monta a tabela Markdown', () => {
    const linhas: Linha[] = [
      linha(
        [
          { texto: 'Item', x: 10, width: 30 },
          { texto: 'Valor', x: 110, width: 30 },
        ],
        90
      ),
      linha(
        [
          { texto: 'Storage', x: 10, width: 40 },
          { texto: 'R$ 100', x: 110, width: 40 },
        ],
        70
      ),
    ]

    const resultado = detectarTabelaPorBordas(linhas, 0, grade)

    expect(resultado?.markdown).toBe('| Item | Valor |\n| --- | --- |\n| Storage | R$ 100 |')
    expect(resultado?.proximoIndice).toBe(2)
  })

  it('devolve null quando a linha inicial está fora da área vertical da grade', () => {
    const linhas: Linha[] = [linha([{ texto: 'Fora da tabela', x: 10, width: 50 }], 500)]

    expect(detectarTabelaPorBordas(linhas, 0, grade)).toBeNull()
  })

  it('para de consumir linhas ao trocar de página', () => {
    const linhas: Linha[] = [
      linha([{ texto: 'Item', x: 10, width: 30 }], 90, 0),
      linha([{ texto: 'Nova página, fora da tabela', x: 10, width: 100 }], 90, 1),
    ]

    const resultado = detectarTabelaPorBordas(linhas, 0, grade)

    expect(resultado?.proximoIndice).toBe(1)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest src/lib/extracao/pdfTabelas.test.ts`
Expected: FAIL — `Cannot find module './pdfTabelas'`.

- [ ] **Step 3: Implement `pdfTabelas.ts`**

Create `src/lib/extracao/pdfTabelas.ts`:

```ts
import type { Linha } from './pdfMarkdown'
import { formatarTexto, montarTabelaMarkdown } from './pdfMarkdown'
import type { SegmentoReto } from './pdfTracos'

/** Grade de bordas visuais de uma página: posições Y das linhas horizontais
 *  (limites de linha da tabela, ordenadas do topo pro fim — Y decrescente,
 *  já que o eixo Y do PDF cresce de baixo pra cima) e X das verticais
 *  (limites de coluna, da esquerda pra direita — X crescente). */
export interface GradeDeTabela {
  y: number[]
  x: number[]
}

const COMPRIMENTO_MIN_LINHA_GRADE = 20
const COMPRIMENTO_MIN_COLUNA_GRADE = 8
const TOLERANCIA_CLUSTER_GRADE = 1.5
const TOLERANCIA_DENTRO_DA_GRADE = 2

/** Agrupa valores próximos (dentro de `tolerancia`) numa única âncora — linhas
 *  de borda quase-coincidentes (erro de arredondamento do PDF) viram uma só. */
function clusterizar(valores: number[], tolerancia: number): number[] {
  const ordenados = [...valores].sort((a, b) => a - b)
  const grupos: number[] = []
  for (const valor of ordenados) {
    const ultimo = grupos[grupos.length - 1]
    if (ultimo === undefined || valor - ultimo > tolerancia) {
      grupos.push(valor)
    }
  }
  return grupos
}

/**
 * Monta a grade de linhas/colunas de bordas visuais de uma página, a partir
 * dos segmentos retos extraídos do PDF (`pdfTracos.ts`). Só considera
 * segmentos compridos o bastante pra serem borda de tabela (não sublinhado de
 * uma palavra, nem risco decorativo curto). Devolve `null` quando a página
 * não tem uma grade reconhecível (menos de 2 linhas ou 2 colunas) — quem
 * chama cai pro fallback de posição (`absorverTabelaPorPosicao`).
 *
 * Simplificação assumida: trata todas as bordas da página como uma única
 * grade. Uma página com mais de uma tabela com bordas pode, nesse caso,
 * juntar as duas numa só — caso raro, corrigido na edição manual.
 */
export function construirGradeDaPagina(segmentos: SegmentoReto[]): GradeDeTabela | null {
  const ysHorizontais = segmentos
    .filter((s) => s.y1 === s.y2 && s.x2 - s.x1 >= COMPRIMENTO_MIN_LINHA_GRADE)
    .map((s) => s.y1)
  const xsVerticais = segmentos
    .filter((s) => s.x1 === s.x2 && s.y2 - s.y1 >= COMPRIMENTO_MIN_COLUNA_GRADE)
    .map((s) => s.x1)

  const y = clusterizar(ysHorizontais, TOLERANCIA_CLUSTER_GRADE).sort((a, b) => b - a)
  const x = clusterizar(xsVerticais, TOLERANCIA_CLUSTER_GRADE)

  if (y.length < 2 || x.length < 2) return null
  return { y, x }
}

/** Índice da faixa (entre dois limites consecutivos, em qualquer ordem) onde
 *  `valor` cai — usado tanto pra linha (limites Y decrescentes) quanto coluna
 *  (limites X crescentes) da grade. */
function indiceDaFaixa(valor: number, limites: number[]): number | null {
  for (let i = 0; i < limites.length - 1; i++) {
    const min = Math.min(limites[i], limites[i + 1]) - TOLERANCIA_DENTRO_DA_GRADE
    const max = Math.max(limites[i], limites[i + 1]) + TOLERANCIA_DENTRO_DA_GRADE
    if (valor >= min && valor <= max) return i
  }
  return null
}

/**
 * Tenta montar uma tabela Markdown a partir das bordas visuais desenhadas no
 * PDF, em vez de só posição de texto — bem mais confiável quando a tabela tem
 * linhas/colunas desenhadas (a maioria das tabelas em proposta comercial).
 * Devolve `null` quando a linha em `indiceInicial` não está dentro da área da
 * grade.
 */
export function detectarTabelaPorBordas(
  linhas: Linha[],
  indiceInicial: number,
  grade: GradeDeTabela
): { markdown: string; proximoIndice: number } | null {
  const primeiraLinha = linhas[indiceInicial]
  const limiteSuperior = grade.y[0]
  const limiteInferior = grade.y[grade.y.length - 1]
  if (primeiraLinha.y > limiteSuperior + TOLERANCIA_DENTRO_DA_GRADE) return null
  if (primeiraLinha.y < limiteInferior - TOLERANCIA_DENTRO_DA_GRADE) return null

  const numLinhas = grade.y.length - 1
  const numColunas = grade.x.length - 1
  const celulas: string[][] = Array.from({ length: numLinhas }, () => Array(numColunas).fill(''))

  let j = indiceInicial
  let algumaCelulaPreenchida = false
  while (j < linhas.length) {
    const linha = linhas[j]
    if (linha.pagina !== primeiraLinha.pagina) break
    if (linha.y < limiteInferior - TOLERANCIA_DENTRO_DA_GRADE) break

    const indiceLinhaGrade = indiceDaFaixa(linha.y, grade.y)
    if (indiceLinhaGrade === null) {
      j++
      continue
    }

    for (const item of linha.itens) {
      const indiceColunaGrade = indiceDaFaixa(item.x, grade.x)
      if (indiceColunaGrade === null) continue
      const texto = formatarTexto(item)
      const atual = celulas[indiceLinhaGrade][indiceColunaGrade]
      celulas[indiceLinhaGrade][indiceColunaGrade] = atual ? `${atual} ${texto}` : texto
      algumaCelulaPreenchida = true
    }
    j++
  }

  if (!algumaCelulaPreenchida) return null
  return { markdown: montarTabelaMarkdown(celulas), proximoIndice: j }
}
```

This test file doesn't compile yet — `Linha`/`ItemLinha` from `pdfMarkdown.ts` don't have `y`/`pagina`/`sublinhado` until Step 4 below. Move straight on to Step 4 before running anything.

- [ ] **Step 4: Extend `pdfMarkdown.ts`'s interfaces and write its failing tests**

In `src/lib/extracao/pdfMarkdown.ts`, extend the two interfaces:

```ts
export interface ItemLinha {
  texto: string
  x: number
  width: number
  negrito: boolean
  italico: boolean
  sublinhado: boolean
}

export interface Linha {
  itens: ItemLinha[]
  fontSizeMedio: number
  y: number
  pagina: number
}
```

In `src/lib/extracao/pdfMarkdown.test.ts`, add `jest.mock('./pdfTracos', ...)` right after the existing `jest.mock('unpdf', ...)` block, and default its resolved value to "no segments on any page" so every pre-existing test keeps behaving exactly as before:

```ts
jest.mock('./pdfTracos', () => ({
  extrairSegmentosRetosPorPagina: jest.fn(),
}))

import { extrairSegmentosRetosPorPagina } from './pdfTracos'
```

Add this inside the `describe('converterPdfParaMarkdown', ...)` block, as its own `beforeEach`, right after the `describe(` line:

```ts
  beforeEach(() => {
    ;(extrairSegmentosRetosPorPagina as jest.Mock).mockResolvedValue([[]])
  })
```

Then add these new tests at the end of the same `describe` block (right before the final closing `})`):

```ts
  it('envolve em <u>...</u> um trecho com traço horizontal logo abaixo da linha de base', async () => {
    ;(extractTextItems as jest.Mock).mockResolvedValue({
      totalPages: 1,
      items: [[item({ str: 'Cláusula sublinhada', x: 0, y: 100, width: 120, hasEOL: true })]],
    })
    ;(extrairSegmentosRetosPorPagina as jest.Mock).mockResolvedValue([[{ x1: 0, y1: 98, x2: 120, y2: 98 }]])

    const resultado = await converterPdfParaMarkdown(Buffer.from(''))

    expect(resultado).toBe('<u>Cláusula sublinhada</u>')
  })

  it('não sublinha quando o traço abaixo não cobre boa parte da largura do trecho', async () => {
    ;(extractTextItems as jest.Mock).mockResolvedValue({
      totalPages: 1,
      items: [[item({ str: 'Texto normal', x: 0, y: 100, width: 120, hasEOL: true })]],
    })
    ;(extrairSegmentosRetosPorPagina as jest.Mock).mockResolvedValue([[{ x1: 0, y1: 98, x2: 20, y2: 98 }]])

    const resultado = await converterPdfParaMarkdown(Buffer.from(''))

    expect(resultado).toBe('Texto normal')
  })

  it('centraliza título curto quando a folga é parecida dos dois lados', async () => {
    ;(extractTextItems as jest.Mock).mockResolvedValue({
      totalPages: 1,
      items: [
        [item({ str: 'PROPOSTA COMERCIAL', x: 200, width: 195, fontSize: 20, hasEOL: true })],
        [
          item({
            str: 'Corpo do texto que define a margem esquerda e direita do documento inteiro aqui.',
            x: 40,
            width: 515,
            fontSize: 10,
            hasEOL: true,
          }),
        ],
      ],
    })

    const resultado = await converterPdfParaMarkdown(Buffer.from(''))

    expect(resultado).toBe(
      '<h1 align="center">PROPOSTA COMERCIAL</h1>\n\nCorpo do texto que define a margem esquerda e direita do documento inteiro aqui.'
    )
  })

  it('marca parágrafo de várias linhas como justificado quando todas as linhas menos a última tocam a margem direita', async () => {
    ;(extractTextItems as jest.Mock).mockResolvedValue({
      totalPages: 1,
      items: [
        [
          item({ str: 'Primeira linha que vai até a margem direita', x: 40, width: 515, hasEOL: true }),
          item({ str: 'Segunda linha que também toca a mesma margem', x: 40, width: 515, hasEOL: true }),
          item({ str: 'terceira e última linha, mais curta.', x: 40, width: 200, hasEOL: true }),
        ],
      ],
    })

    const resultado = await converterPdfParaMarkdown(Buffer.from(''))

    expect(resultado).toBe(
      '<p align="justify">Primeira linha que vai até a margem direita Segunda linha que também toca a mesma margem terceira e última linha, mais curta.</p>'
    )
  })

  it('reconstrói tabela a partir de bordas vetoriais desenhadas no PDF', async () => {
    ;(extractTextItems as jest.Mock).mockResolvedValue({
      totalPages: 1,
      items: [
        [
          item({ str: 'Item', x: 10, width: 30, y: 90, hasEOL: false }),
          item({ str: 'Valor', x: 110, width: 30, y: 90, hasEOL: true }),
          item({ str: 'Storage', x: 10, width: 40, y: 70, hasEOL: false }),
          item({ str: 'R$ 100', x: 110, width: 40, y: 70, hasEOL: true }),
        ],
      ],
    })
    ;(extrairSegmentosRetosPorPagina as jest.Mock).mockResolvedValue([
      [
        { x1: 0, y1: 100, x2: 200, y2: 100 },
        { x1: 0, y1: 80, x2: 200, y2: 80 },
        { x1: 0, y1: 60, x2: 200, y2: 60 },
        { x1: 0, y1: 60, x2: 0, y2: 100 },
        { x1: 100, y1: 60, x2: 100, y2: 100 },
        { x1: 200, y1: 60, x2: 200, y2: 100 },
      ],
    ])

    const resultado = await converterPdfParaMarkdown(Buffer.from(''))

    expect(resultado).toBe('| Item | Valor |\n| --- | --- |\n| Storage | R$ 100 |')
  })
```

- [ ] **Step 5: Run the tests to verify they fail**

Run: `npx jest src/lib/extracao/pdfMarkdown.test.ts`
Expected: FAIL — TypeScript errors first (interfaces now require `y`/`pagina`/`sublinhado` that the implementation doesn't produce yet), then, once Step 6 below is done, behavioral failures until fully wired.

- [ ] **Step 6: Wire segments, alignment margins, and border-table detection into `pdfMarkdown.ts`**

Replace the full contents of `src/lib/extracao/pdfMarkdown.ts` with:

```ts
import { extractTextItems, getDocumentProxy, type StructuredTextItem } from 'unpdf'
import { extrairSegmentosRetosPorPagina, type SegmentoReto } from './pdfTracos'
import { construirGradeDaPagina, detectarTabelaPorBordas, type GradeDeTabela } from './pdfTabelas'

/** Gap horizontal (em pontos) acima do qual duas células passam a ser consideradas
 *  colunas separadas de uma tabela, em vez de duas palavras na mesma frase. */
const LIMIAR_GAP_COLUNA = 24

/** Tolerância (em pontos) pra tratar duas âncoras de coluna próximas como a mesma
 *  coluna, ao unificar as colunas detectadas em linhas diferentes de uma tabela
 *  (ex: cabeçalho e linhas de dados raramente alinham exatamente). */
const TOLERANCIA_ANCORA_COLUNA = 10

/** Acima desse tamanho, mesmo uma linha com fonte maior que o corpo do texto não
 *  vira título — título de verdade é curto; frase longa com fonte um pouco maior
 *  é ruído de medição da extração, não uma seção nova. */
const LIMIAR_TAMANHO_TITULO = 80

/** Distância (em pontos) abaixo da linha de base do texto onde um traço de
 *  sublinhado costuma ser desenhado. */
const DISTANCIA_MIN_SUBLINHADO = 0.5
const DISTANCIA_MAX_SUBLINHADO = 4
/** Fração mínima da largura do trecho que o traço precisa cobrir pra contar
 *  como sublinhado (evita marcar por causa de um traço decorativo curto). */
const COBERTURA_MIN_SUBLINHADO = 0.7

/** Folga mínima (em pontos) dos dois lados, e tolerância de simetria entre
 *  elas, pra uma linha curta contar como centralizada. */
const FOLGA_MINIMA_CENTRALIZADO = 8
const TOLERANCIA_SIMETRIA_CENTRALIZADO = 12
/** Uma linha "centralizada" também precisa ser bem mais estreita que a
 *  largura útil do documento — senão qualquer linha de corpo comum, com
 *  folgas pequenas e parecidas por acaso, seria marcada como centralizada. */
const LARGURA_MAXIMA_CENTRALIZADO = 0.85

/** Tolerância (em pontos) pra considerar que o fim de uma linha "toca" a
 *  margem direita do documento — sinal de parágrafo justificado. */
const TOLERANCIA_MARGEM_JUSTIFICADO = 4

const REGEX_LISTA_NUMERADA = /^(\d+)[.)]\s+(.*)$/
const REGEX_LISTA_MARCADOR = /^[•\-*]\s+(.*)$/
const REGEX_RODAPE_PAGINA = /^page\s+\d+\s+of\s+\d+$/i
/** Fim de frase/parágrafo: pontuação final, opcionalmente seguida de aspas/parêntese. */
const REGEX_PONTUACAO_FINAL = /[.:;!?]["'”)\]]?$/

export interface ItemLinha {
  texto: string
  x: number
  width: number
  negrito: boolean
  italico: boolean
  sublinhado: boolean
}

export interface Linha {
  itens: ItemLinha[]
  fontSizeMedio: number
  y: number
  pagina: number
}

interface Margens {
  esquerda: number
  direita: number
}

/**
 * Converte o conteúdo de um PDF em Markdown, preservando negrito, itálico,
 * sublinhado, alinhamento, título, lista e tabela detectados a partir da
 * fonte, posição e traços vetoriais de cada página — sem usar IA. É uma
 * extração best-effort: negrito/itálico/título são confiáveis (comparação
 * direta de fonte/tamanho); tabela e sublinhado usam as bordas/traços
 * desenhados no PDF quando existem (mais confiável) e caem pra heurística de
 * posição de texto quando não. É esperado que a pessoa ajuste o resultado
 * manualmente antes de copiar.
 *
 * O `hasEOL` do unpdf marca fim de LINHA VISUAL (onde o PDF quebra a linha na
 * página), não fim de parágrafo — por isso linhas consecutivas são reunidas num
 * mesmo bloco até a última linha absorvida terminar em pontuação final (ou até
 * a próxima linha já começar um item de lista/título/tabela novo).
 */
export async function converterPdfParaMarkdown(buffer: Buffer): Promise<string> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer))
  const { items, totalPages } = await extractTextItems(pdf)
  const segmentosPorPagina = await extrairSegmentosRetosPorPagina(pdf, totalPages)

  const todasAsLinhas: Linha[] = []
  items.forEach((itensDaPagina, pagina) => {
    todasAsLinhas.push(...agruparEmLinhas(itensDaPagina, pagina, segmentosPorPagina[pagina] ?? []))
  })

  const linhasSemRodape = todasAsLinhas.filter((linha) => !ehRodapeDePagina(linha))
  if (linhasSemRodape.length === 0) return ''

  const tamanhoCorpo = calcularTamanhoCorpo(linhasSemRodape)
  const margens = calcularMargens(linhasSemRodape)
  const gradesPorPagina = new Map<number, GradeDeTabela>()
  segmentosPorPagina.forEach((segmentos, pagina) => {
    const grade = construirGradeDaPagina(segmentos)
    if (grade) gradesPorPagina.set(pagina, grade)
  })

  return montarMarkdown(linhasSemRodape, tamanhoCorpo, margens, gradesPorPagina)
}

function ehRodapeDePagina(linha: Linha): boolean {
  return REGEX_RODAPE_PAGINA.test(extrairTextoLinha(linha))
}

function agruparEmLinhas(itens: StructuredTextItem[], pagina: number, segmentosDaPagina: SegmentoReto[]): Linha[] {
  const linhas: Linha[] = []
  let atual: StructuredTextItem[] = []

  for (const item of itens) {
    if (item.str.trim().length === 0 && atual.length === 0) continue
    atual.push(item)
    if (item.hasEOL) {
      linhas.push(construirLinha(atual, pagina, segmentosDaPagina))
      atual = []
    }
  }
  if (atual.length > 0) linhas.push(construirLinha(atual, pagina, segmentosDaPagina))

  return linhas
}

function construirLinha(itensBrutos: StructuredTextItem[], pagina: number, segmentosDaPagina: SegmentoReto[]): Linha {
  const itensComTexto = itensBrutos.filter((item) => item.str.trim().length > 0)
  const y = itensComTexto[0]?.y ?? 0

  const itens: ItemLinha[] = itensComTexto.map((item) => ({
    texto: item.str,
    x: item.x,
    width: item.width,
    negrito: /bold|negrito/i.test(item.fontFamily),
    italico: /italic|oblique|itálico/i.test(item.fontFamily),
    sublinhado: temTracoDeSublinhado(item, y, segmentosDaPagina),
  }))
  const fontSizeMedio =
    itensBrutos.reduce((soma, item) => soma + item.fontSize, 0) / (itensBrutos.length || 1)
  return { itens, fontSizeMedio, y, pagina }
}

function temTracoDeSublinhado(item: StructuredTextItem, y: number, segmentosDaPagina: SegmentoReto[]): boolean {
  const inicio = item.x
  const fim = item.x + item.width
  return segmentosDaPagina.some((segmento) => {
    if (segmento.y1 !== segmento.y2) return false // só interessa traço horizontal
    const distancia = y - segmento.y1
    if (distancia < DISTANCIA_MIN_SUBLINHADO || distancia > DISTANCIA_MAX_SUBLINHADO) return false
    const sobreposicao = Math.min(fim, segmento.x2) - Math.max(inicio, segmento.x1)
    return sobreposicao >= (fim - inicio) * COBERTURA_MIN_SUBLINHADO
  })
}

/** Tamanho de fonte predominante do documento, usado como referência de "corpo do
 *  texto" pra decidir o que é título — a moda ponderada pela quantidade de caracteres. */
function calcularTamanhoCorpo(linhas: Linha[]): number {
  const contagem = new Map<number, number>()
  for (const linha of linhas) {
    const texto = linha.itens.map((item) => item.texto).join('')
    const arredondado = Math.round(linha.fontSizeMedio)
    contagem.set(arredondado, (contagem.get(arredondado) ?? 0) + texto.length)
  }

  let tamanhoMaisComum = 0
  let maiorContagem = 0
  for (const [tamanho, contagemCaracteres] of contagem) {
    if (contagemCaracteres > maiorContagem) {
      maiorContagem = contagemCaracteres
      tamanhoMaisComum = tamanho
    }
  }
  return tamanhoMaisComum || 12
}

/** Margens esquerda/direita "úteis" do documento — esquerda é a posição X
 *  mais à esquerda entre todas as linhas, direita é a posição X mais à
 *  direita — usadas como referência pra detectar linha centralizada e
 *  parágrafo justificado. */
function calcularMargens(linhas: Linha[]): Margens {
  let esquerda = Infinity
  let direita = -Infinity
  for (const linha of linhas) {
    if (linha.itens.length === 0) continue
    const primeiro = linha.itens[0]
    const ultimo = linha.itens[linha.itens.length - 1]
    esquerda = Math.min(esquerda, primeiro.x)
    direita = Math.max(direita, ultimo.x + ultimo.width)
  }
  return { esquerda: Number.isFinite(esquerda) ? esquerda : 0, direita: Number.isFinite(direita) ? direita : 0 }
}

function ehCentralizado(linha: Linha, margens: Margens): boolean {
  const larguraTotal = margens.direita - margens.esquerda
  if (larguraTotal <= 0 || linha.itens.length === 0) return false

  const primeiro = linha.itens[0]
  const ultimo = linha.itens[linha.itens.length - 1]
  const inicio = primeiro.x
  const fim = ultimo.x + ultimo.width
  const folgaEsquerda = inicio - margens.esquerda
  const folgaDireita = margens.direita - fim
  const larguraLinha = fim - inicio

  return (
    folgaEsquerda > FOLGA_MINIMA_CENTRALIZADO &&
    folgaDireita > FOLGA_MINIMA_CENTRALIZADO &&
    Math.abs(folgaEsquerda - folgaDireita) <= TOLERANCIA_SIMETRIA_CENTRALIZADO &&
    larguraLinha < larguraTotal * LARGURA_MAXIMA_CENTRALIZADO
  )
}

/** Justificado: parágrafo com 2+ linhas onde todas menos a última terminam
 *  bem perto da margem direita — texto comum alinhado à esquerda tem borda
 *  direita irregular (ragged-right); texto justificado, não. */
function ehJustificado(linhasDoBloco: Linha[], margens: Margens): boolean {
  if (margens.direita <= margens.esquerda) return false
  if (linhasDoBloco.length < 2) return false
  return linhasDoBloco.slice(0, -1).every((linha) => {
    if (linha.itens.length === 0) return false
    const ultimo = linha.itens[linha.itens.length - 1]
    const fim = ultimo.x + ultimo.width
    return margens.direita - fim <= TOLERANCIA_MARGEM_JUSTIFICADO
  })
}

function detectarColunas(linha: Linha): number[] | null {
  if (linha.itens.length < 2) return null

  const anchors = [linha.itens[0].x]
  for (let i = 1; i < linha.itens.length; i++) {
    const anterior = linha.itens[i - 1]
    const atual = linha.itens[i]
    const gap = atual.x - (anterior.x + anterior.width)
    if (gap > LIMIAR_GAP_COLUNA) {
      anchors.push(atual.x)
    }
  }
  return anchors.length >= 2 ? anchors : null
}

/** Adiciona uma âncora de coluna à lista, a não ser que já exista uma âncora bem
 *  próxima — evita duplicar colunas quase-iguais quando cabeçalho e linhas de
 *  dados de uma mesma tabela não alinham exatamente no eixo X. */
function incluirAncora(ancoras: number[], valor: number): void {
  if (!ancoras.some((ancora) => Math.abs(ancora - valor) <= TOLERANCIA_ANCORA_COLUNA)) {
    ancoras.push(valor)
  }
}

/** Aplica negrito/itálico/sublinhado a um trecho de texto — fonte única desse
 *  formato, reaproveitada tanto pra parágrafo comum quanto pra célula de
 *  tabela (posição ou borda). */
export function formatarTexto(item: ItemLinha): string {
  let texto = item.texto
  if (item.negrito && item.italico) texto = `***${texto}***`
  else if (item.negrito) texto = `**${texto}**`
  else if (item.italico) texto = `*${texto}*`
  if (item.sublinhado) texto = `<u>${texto}</u>`
  return texto
}

function linhaParaColunas(linha: Linha, anchors: number[]): string[] {
  const celulas: string[] = anchors.map(() => '')
  for (const item of linha.itens) {
    let indiceColuna = 0
    for (let j = anchors.length - 1; j >= 0; j--) {
      if (item.x >= anchors[j] - 1) {
        indiceColuna = j
        break
      }
    }
    const texto = formatarTexto(item)
    celulas[indiceColuna] = celulas[indiceColuna] ? `${celulas[indiceColuna]} ${texto}` : texto
  }
  return celulas
}

export function montarTabelaMarkdown(linhas: string[][]): string {
  const [cabecalho, ...resto] = linhas
  const separador = cabecalho.map(() => '---')
  return [cabecalho, separador, ...resto].map((linha) => `| ${linha.join(' | ')} |`).join('\n')
}

function extrairTextoLinha(linha: Linha): string {
  return linha.itens.map((item) => formatarTexto(item)).join(' ').trim()
}

function terminaComPontuacaoFinal(texto: string): boolean {
  return REGEX_PONTUACAO_FINAL.test(texto.trim())
}

function ehMarcadorDeLista(texto: string): boolean {
  return REGEX_LISTA_NUMERADA.test(texto) || REGEX_LISTA_MARCADOR.test(texto)
}

/** Título de verdade é curto (ver `LIMIAR_TAMANHO_TITULO`) — frase longa com fonte
 *  um pouco maior é ruído de medição da extração, não uma seção nova do documento. */
function ehTitulo(linha: Linha, tamanhoCorpo: number): boolean {
  const texto = extrairTextoLinha(linha)
  if (texto.length === 0 || texto.length > LIMIAR_TAMANHO_TITULO) return false
  if (ehMarcadorDeLista(texto)) return false
  return linha.fontSizeMedio >= tamanhoCorpo * 1.15
}

function formatarTitulo(linha: Linha, tamanhoCorpo: number, margens: Margens): string {
  const texto = extrairTextoLinha(linha)
  const nivel = linha.fontSizeMedio >= tamanhoCorpo * 1.5 ? 1 : 2
  if (ehCentralizado(linha, margens)) {
    return `<h${nivel} align="center">${texto}</h${nivel}>`
  }
  return `${'#'.repeat(nivel)} ${texto}`
}

function formatarBlocoDeTexto(textos: string[], linhasDoBloco: Linha[], margens: Margens): string {
  const textoCompleto = textos.join(' ')

  const numerada = textoCompleto.match(REGEX_LISTA_NUMERADA)
  if (numerada) return `${numerada[1]}. ${numerada[2]}`

  const marcada = textoCompleto.match(REGEX_LISTA_MARCADOR)
  if (marcada) return `- ${marcada[1]}`

  if (linhasDoBloco.length === 1 && ehCentralizado(linhasDoBloco[0], margens)) {
    return `<p align="center">${textoCompleto}</p>`
  }
  if (linhasDoBloco.length >= 2 && ehJustificado(linhasDoBloco, margens)) {
    return `<p align="justify">${textoCompleto}</p>`
  }

  return textoCompleto
}

/** Reúne, a partir de `indiceInicial`, todas as linhas que ainda fazem parte do
 *  mesmo parágrafo/item de lista: continua absorvendo linhas seguintes enquanto
 *  o texto já absorvido não terminar em pontuação final e a próxima linha não for,
 *  ela mesma, o início de um marcador de lista, um título ou uma linha de tabela. */
function absorverBloco(
  linhas: Linha[],
  indiceInicial: number,
  tamanhoCorpo: number
): { textos: string[]; linhasConsumidas: Linha[]; proximoIndice: number } {
  const linhasConsumidas = [linhas[indiceInicial]]
  const textos = [extrairTextoLinha(linhas[indiceInicial])]
  let j = indiceInicial + 1

  while (j < linhas.length) {
    if (terminaComPontuacaoFinal(textos[textos.length - 1])) break

    const candidata = linhas[j]
    const textoCandidata = extrairTextoLinha(candidata)
    if (ehMarcadorDeLista(textoCandidata)) break
    if (ehTitulo(candidata, tamanhoCorpo)) break
    if (detectarColunas(candidata)) break

    textos.push(textoCandidata)
    linhasConsumidas.push(candidata)
    j++
  }

  return { textos, linhasConsumidas, proximoIndice: j }
}

/** Reúne, a partir de `indiceInicial`, uma sequência de linhas que parecem linhas
 *  de tabela por POSIÇÃO de texto (têm colunas detectáveis), unificando as âncoras
 *  de coluna de todas elas. Fallback usado só quando a página não tem uma grade de
 *  bordas visuais reconhecível (`detectarTabelaPorBordas` devolveu `null`). */
function absorverTabelaPorPosicao(
  linhas: Linha[],
  indiceInicial: number
): { markdown: string; proximoIndice: number } | null {
  const ancorasIniciais = detectarColunas(linhas[indiceInicial])
  if (!ancorasIniciais) return null

  const linhasDaTabela = [linhas[indiceInicial]]
  const ancorasUnificadas = [...ancorasIniciais]
  let j = indiceInicial + 1

  while (j < linhas.length) {
    const ancorasCandidata = detectarColunas(linhas[j])
    if (!ancorasCandidata) break
    linhasDaTabela.push(linhas[j])
    for (const ancora of ancorasCandidata) incluirAncora(ancorasUnificadas, ancora)
    j++
  }

  if (linhasDaTabela.length < 2) return null

  ancorasUnificadas.sort((a, b) => a - b)
  const linhasFormatadas = linhasDaTabela.map((linha) => linhaParaColunas(linha, ancorasUnificadas))
  return { markdown: montarTabelaMarkdown(linhasFormatadas), proximoIndice: j }
}

function montarMarkdown(
  linhas: Linha[],
  tamanhoCorpo: number,
  margens: Margens,
  gradesPorPagina: Map<number, GradeDeTabela>
): string {
  const blocos: string[] = []
  let i = 0

  while (i < linhas.length) {
    const grade = gradesPorPagina.get(linhas[i].pagina)
    const tabelaPorBordas = grade ? detectarTabelaPorBordas(linhas, i, grade) : null
    if (tabelaPorBordas) {
      blocos.push(tabelaPorBordas.markdown)
      i = tabelaPorBordas.proximoIndice
      continue
    }

    const tabelaPorPosicao = absorverTabelaPorPosicao(linhas, i)
    if (tabelaPorPosicao) {
      blocos.push(tabelaPorPosicao.markdown)
      i = tabelaPorPosicao.proximoIndice
      continue
    }

    if (ehTitulo(linhas[i], tamanhoCorpo)) {
      blocos.push(formatarTitulo(linhas[i], tamanhoCorpo, margens))
      i++
      continue
    }

    const { textos, linhasConsumidas, proximoIndice } = absorverBloco(linhas, i, tamanhoCorpo)
    blocos.push(formatarBlocoDeTexto(textos, linhasConsumidas, margens))
    i = proximoIndice
  }

  return blocos.filter((bloco) => bloco.length > 0).join('\n\n')
}
```

- [ ] **Step 7: Run the `pdfMarkdown.test.ts` and `pdfTabelas.test.ts` suites to verify they now pass**

Run: `npx jest src/lib/extracao/pdfMarkdown.test.ts src/lib/extracao/pdfTabelas.test.ts`
Expected: PASS — every test in both files (17 total: 12 pre-existing + italic/combo from Task 7 + underline/centered/justified/border-table from this task in `pdfMarkdown.test.ts`; 6 in `pdfTabelas.test.ts`, now compiling clean since `Linha`/`ItemLinha` have the fields this task's fixtures use).

- [ ] **Step 8: Verify the whole project still compiles**

Run: `npx tsc --noEmit -p .`
Expected: no errors from any `src/lib/extracao/**` file. Errors from `src/app/documentos-sei/**` are still expected until Tasks 10–12.

- [ ] **Step 9: Commit**

```bash
git add src/lib/extracao/pdfMarkdown.ts src/lib/extracao/pdfMarkdown.test.ts src/lib/extracao/pdfTabelas.ts src/lib/extracao/pdfTabelas.test.ts
git commit -m "feat: liga sublinhado, alinhamento e tabela por bordas na conversao de PDF"
```

---

## Task 10: Componente editor — mover pra `propostas-comerciais`, sem cliente

**Files:**
- Create: `src/app/propostas-comerciais/[id]/editor-markdown.tsx`
- Create: `src/app/propostas-comerciais/[id]/editor-markdown.test.tsx`
- Delete: `src/app/documentos-sei/[id]/editor-markdown.tsx`
- Delete: `src/app/documentos-sei/[id]/editor-markdown.test.tsx`

**Interfaces:**
- Produces: `EditorMarkdown({ propostaId, conteudoInicial, onSalvar }: EditorMarkdownProps)` where `EditorMarkdownProps = { propostaId: string; conteudoInicial: string; onSalvar: (markdown: string) => Promise<void> }` — same shape as before, `documentoId` renamed to `propostaId`. Task 12's page renders this when `status === 'rascunho'` or during "Editar novamente".

- [ ] **Step 1: Create the test file**

Create `src/app/propostas-comerciais/[id]/editor-markdown.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { EditorMarkdown } from './editor-markdown'

describe('EditorMarkdown', () => {
  it('mostra o markdown inicial no textarea e permite editar', () => {
    render(<EditorMarkdown propostaId="prop1" conteudoInicial="# Título" onSalvar={jest.fn()} />)
    const textarea = screen.getByLabelText('Markdown') as HTMLTextAreaElement
    expect(textarea.value).toBe('# Título')

    fireEvent.change(textarea, { target: { value: '# Título editado' } })
    expect(textarea.value).toBe('# Título editado')
  })

  it('abre e fecha o modal do PDF original', () => {
    render(<EditorMarkdown propostaId="prop1" conteudoInicial="texto" onSalvar={jest.fn()} />)

    expect(screen.queryByTitle('PDF original')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Ver PDF original' }))
    const iframe = screen.getByTitle('PDF original')
    expect(iframe).toHaveAttribute('src', '/api/propostas-comerciais/prop1/original?modo=preview')

    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }))
    expect(screen.queryByTitle('PDF original')).not.toBeInTheDocument()
  })

  it('chama onSalvar com o markdown atual ao clicar em Salvar', () => {
    const onSalvar = jest.fn().mockResolvedValue(undefined)
    render(<EditorMarkdown propostaId="prop1" conteudoInicial="conteúdo original" onSalvar={onSalvar} />)

    fireEvent.change(screen.getByLabelText('Markdown'), { target: { value: 'conteúdo editado' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))

    expect(onSalvar).toHaveBeenCalledWith('conteúdo editado')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest "src/app/propostas-comerciais/[id]/editor-markdown.test.tsx"`
Expected: FAIL — `Cannot find module './editor-markdown'`.

- [ ] **Step 3: Create the component**

Create `src/app/propostas-comerciais/[id]/editor-markdown.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { marked } from 'marked'
import { FileText, X } from 'lucide-react'
import { BTN_PRIMARY, BTN_OUTLINE } from '@/lib/ui'

export interface EditorMarkdownProps {
  propostaId: string
  conteudoInicial: string
  onSalvar: (markdown: string) => Promise<void>
}

export function EditorMarkdown({ propostaId, conteudoInicial, onSalvar }: EditorMarkdownProps) {
  const [markdown, setMarkdown] = useState(conteudoInicial)
  const [modalAberto, setModalAberto] = useState(false)
  const [salvando, setSalvando] = useState(false)

  async function handleSalvar() {
    setSalvando(true)
    await onSalvar(markdown)
    setSalvando(false)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-mid-grey">Ajuste o Markdown gerado a partir do PDF antes de salvar.</p>
        <div className="flex gap-2">
          <button type="button" onClick={() => setModalAberto(true)} className={BTN_OUTLINE}>
            <FileText className="size-3.5" strokeWidth={2.25} />
            Ver PDF original
          </button>
          <button type="button" onClick={handleSalvar} disabled={salvando} className={BTN_PRIMARY}>
            {salvando ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <textarea
          aria-label="Markdown"
          value={markdown}
          onChange={(e) => setMarkdown(e.target.value)}
          className="h-[60vh] w-full rounded-lg border border-border-grey p-3 font-mono text-sm outline-none focus:border-orange"
        />
        <div
          aria-label="Preview"
          className="h-[60vh] overflow-auto rounded-lg border border-border-grey p-3 text-sm"
          dangerouslySetInnerHTML={{ __html: marked.parse(markdown) as string }}
        />
      </div>

      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/50 p-4 backdrop-blur-sm">
          <div className="flex h-[85vh] w-full max-w-4xl flex-col gap-3 rounded-2xl bg-white p-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-navy">PDF original</h2>
              <button type="button" onClick={() => setModalAberto(false)} aria-label="Fechar">
                <X className="size-4" strokeWidth={2.25} />
              </button>
            </div>
            <iframe
              src={`/api/propostas-comerciais/${propostaId}/original?modo=preview`}
              className="h-full w-full rounded-lg border border-border-grey"
              title="PDF original"
            />
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Delete the old files**

```bash
git rm src/app/documentos-sei/[id]/editor-markdown.tsx src/app/documentos-sei/[id]/editor-markdown.test.tsx
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx jest "src/app/propostas-comerciais/[id]/editor-markdown.test.tsx"`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add -A src/app/propostas-comerciais/[id]/editor-markdown.tsx src/app/propostas-comerciais/[id]/editor-markdown.test.tsx src/app/documentos-sei/[id]/editor-markdown.tsx src/app/documentos-sei/[id]/editor-markdown.test.tsx
git commit -m "feat: move editor de Markdown pra propostas-comerciais"
```

---

## Task 11: Componente final — `PropostaFinal` (preview + copiar formatado + editar novamente)

**Files:**
- Create: `src/app/propostas-comerciais/[id]/proposta-final.tsx`
- Create: `src/app/propostas-comerciais/[id]/proposta-final.test.tsx`
- Delete: `src/app/documentos-sei/[id]/markdown-final.tsx`
- Delete: `src/app/documentos-sei/[id]/markdown-final.test.tsx`

**Interfaces:**
- Produces: `PropostaFinal({ conteudoMarkdown, onEditarNovamente }: PropostaFinalProps)` where `PropostaFinalProps = { conteudoMarkdown: string; onEditarNovamente: () => void }`. Task 12's page renders this when `status === 'concluido'` and not in edit mode.

- [ ] **Step 1: Write the failing tests**

Create `src/app/propostas-comerciais/[id]/proposta-final.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { PropostaFinal } from './proposta-final'

class ClipboardItemFalso {
  constructor(public items: Record<string, Blob>) {}
}

describe('PropostaFinal', () => {
  beforeEach(() => {
    ;(global as unknown as { ClipboardItem: typeof ClipboardItemFalso }).ClipboardItem = ClipboardItemFalso
    Object.assign(navigator, { clipboard: { write: jest.fn().mockResolvedValue(undefined) } })
  })

  it('mostra o preview renderizado do markdown', () => {
    render(<PropostaFinal conteudoMarkdown="# Proposta" onEditarNovamente={jest.fn()} />)
    expect(screen.getByRole('heading', { name: 'Proposta' })).toBeInTheDocument()
  })

  it('copia o conteúdo formatado (HTML + texto simples) pro clipboard e mostra "Copiado!" temporariamente', async () => {
    jest.useFakeTimers()
    render(<PropostaFinal conteudoMarkdown="# Proposta" onEditarNovamente={jest.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: /Copiar formatado/ }))

    await waitFor(() => expect(navigator.clipboard.write).toHaveBeenCalled())
    const itemCopiado = (navigator.clipboard.write as jest.Mock).mock.calls[0][0][0] as ClipboardItemFalso
    expect(itemCopiado.items['text/html']).toBeInstanceOf(Blob)
    expect(itemCopiado.items['text/plain']).toBeInstanceOf(Blob)
    expect(await screen.findByRole('button', { name: /Copiado!/ })).toBeInTheDocument()

    act(() => {
      jest.advanceTimersByTime(2000)
    })
    expect(screen.getByRole('button', { name: /Copiar formatado/ })).toBeInTheDocument()

    jest.useRealTimers()
  })

  it('chama onEditarNovamente ao clicar em "Editar novamente"', () => {
    const onEditarNovamente = jest.fn()
    render(<PropostaFinal conteudoMarkdown="# Proposta" onEditarNovamente={onEditarNovamente} />)

    fireEvent.click(screen.getByRole('button', { name: 'Editar novamente' }))

    expect(onEditarNovamente).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest "src/app/propostas-comerciais/[id]/proposta-final.test.tsx"`
Expected: FAIL — `Cannot find module './proposta-final'`.

- [ ] **Step 3: Implement the component**

Create `src/app/propostas-comerciais/[id]/proposta-final.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { marked } from 'marked'
import { ClipboardCopy, ClipboardCheck, Pencil } from 'lucide-react'
import { BTN_PRIMARY, BTN_OUTLINE } from '@/lib/ui'

export interface PropostaFinalProps {
  conteudoMarkdown: string
  onEditarNovamente: () => void
}

export function PropostaFinal({ conteudoMarkdown, onEditarNovamente }: PropostaFinalProps) {
  const [copiado, setCopiado] = useState(false)

  async function handleCopiarFormatado() {
    const html = marked.parse(conteudoMarkdown) as string
    const textoSimples = new DOMParser().parseFromString(html, 'text/html').body.textContent ?? conteudoMarkdown

    await navigator.clipboard.write([
      new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([textoSimples], { type: 'text/plain' }),
      }),
    ])
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onEditarNovamente} className={BTN_OUTLINE}>
          <Pencil className="size-3.5" strokeWidth={2.25} />
          Editar novamente
        </button>
        <button type="button" onClick={handleCopiarFormatado} className={BTN_PRIMARY}>
          {copiado ? (
            <>
              <ClipboardCheck className="size-3.5" strokeWidth={2.25} />
              Copiado!
            </>
          ) : (
            <>
              <ClipboardCopy className="size-3.5" strokeWidth={2.25} />
              Copiar formatado
            </>
          )}
        </button>
      </div>
      <div
        className="max-h-[70vh] overflow-auto rounded-lg border border-border-grey bg-white p-4 text-sm"
        dangerouslySetInnerHTML={{ __html: marked.parse(conteudoMarkdown) as string }}
      />
    </div>
  )
}
```

- [ ] **Step 4: Delete the old files**

```bash
git rm src/app/documentos-sei/[id]/markdown-final.tsx src/app/documentos-sei/[id]/markdown-final.test.tsx
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx jest "src/app/propostas-comerciais/[id]/proposta-final.test.tsx"`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add -A src/app/propostas-comerciais/[id]/proposta-final.tsx src/app/propostas-comerciais/[id]/proposta-final.test.tsx src/app/documentos-sei/[id]/markdown-final.tsx src/app/documentos-sei/[id]/markdown-final.test.tsx
git commit -m "feat: tela final vira preview renderizado com botao Copiar formatado"
```

---

## Task 12: Página de detalhe — `/propostas-comerciais/[id]` (editor + final + reabertura)

**Files:**
- Create: `src/app/propostas-comerciais/[id]/page.tsx`
- Delete: `src/app/documentos-sei/[id]/page.tsx`

**Interfaces:**
- Consumes: `GET /api/propostas-comerciais/[id]` (Task 3), `PATCH /api/propostas-comerciais/[id]` (Task 3), `EditorMarkdown` (Task 10), `PropostaFinal` (Task 11).
- Produces: the `/propostas-comerciais/[id]` route — fetches the record; shows `EditorMarkdown` when `status === 'rascunho'` OR (`status === 'concluido'` AND local "editar novamente" mode is on); shows `PropostaFinal` when `status === 'concluido'` and not in edit mode; shows the error message when `status === 'erro'`. This is the route every other task's links/redirects point to.

- [ ] **Step 1: Implement the page**

Create `src/app/propostas-comerciais/[id]/page.tsx`:

```tsx
'use client'

import { use, useEffect, useState } from 'react'
import { Loader2, AlertCircle } from 'lucide-react'
import { EditorMarkdown } from './editor-markdown'
import { PropostaFinal } from './proposta-final'

interface PropostaComercialDetalhe {
  id: string
  nomeArquivo: string
  status: 'rascunho' | 'concluido' | 'erro'
  mensagemErro: string | null
  conteudoMarkdown: string | null
}

export default function PropostaComercialDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [proposta, setProposta] = useState<PropostaComercialDetalhe | null>(null)
  const [modoEdicao, setModoEdicao] = useState(false)

  async function carregar() {
    const response = await fetch(`/api/propostas-comerciais/${id}`)
    if (response.ok) setProposta(await response.json())
  }

  useEffect(() => {
    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function handleSalvar(markdown: string) {
    const response = await fetch(`/api/propostas-comerciais/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conteudoMarkdown: markdown }),
    })
    if (response.ok) {
      await carregar()
      setModoEdicao(false)
    }
  }

  if (!proposta) {
    return (
      <main className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
        <p className="flex items-center gap-2 text-sm text-mid-grey">
          <Loader2 className="size-4 animate-spin" strokeWidth={2.25} />
          Carregando...
        </p>
      </main>
    )
  }

  const mostrarEditor = proposta.status === 'rascunho' || (proposta.status === 'concluido' && modoEdicao)
  const mostrarFinal = proposta.status === 'concluido' && !modoEdicao

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-6 py-8 lg:px-8">
      <div>
        <h1 className="text-xl font-bold text-navy">{proposta.nomeArquivo}</h1>
      </div>

      {proposta.status === 'erro' && (
        <p className="flex items-center gap-2 rounded-lg bg-red-crit-light p-3 text-sm text-red-crit">
          <AlertCircle className="size-4 shrink-0" strokeWidth={2.25} />
          {proposta.mensagemErro}
        </p>
      )}

      {mostrarEditor && (
        <EditorMarkdown propostaId={proposta.id} conteudoInicial={proposta.conteudoMarkdown ?? ''} onSalvar={handleSalvar} />
      )}

      {mostrarFinal && (
        <PropostaFinal conteudoMarkdown={proposta.conteudoMarkdown ?? ''} onEditarNovamente={() => setModoEdicao(true)} />
      )}
    </main>
  )
}
```

(No dedicated test file for this wiring page — matches the existing convention where `src/app/documentos/[id]/page.tsx`, which plays the same "fetch + branch into sub-components" role, also has none. The branching logic is simple prop-passing; the real behavior is already covered by Tasks 10/11's component tests.)

- [ ] **Step 2: Delete the old page**

```bash
git rm src/app/documentos-sei/[id]/page.tsx
```

- [ ] **Step 3: Verify the whole project compiles**

Run: `npx tsc --noEmit -p .`
Expected: no errors anywhere — `src/app/documentos-sei/` no longer exists at all at this point.

- [ ] **Step 4: Run the full test suite**

Run: `npm test`
Expected: PASS — every test file in the project.

- [ ] **Step 5: Commit**

```bash
git add -A src/app/propostas-comerciais/[id]/page.tsx src/app/documentos-sei
git commit -m "feat: pagina de detalhe de Proposta Comercial, com editar novamente"
```

---

## Manual smoke test (after Task 12)

Not automated — run once by hand to confirm the end-to-end flow works against a real dev database:

1. `npm run dev:db:up && npm run dev:seed && npm run dev`
2. Log in, open the menu — "Proposta Comercial (Conversão SEI)" should show as its own group (not inside "Relatórios"), open by default, with "Histórico" inside. Click it → lands on an empty `/propostas-comerciais` list.
3. Click "Nova conversão" — the form should have only a PDF file field (no client picker). Pick a real PDF that has at least: a bold word, an italic word, an underlined phrase, a centered title, a justified paragraph, and a bordered table. Submit.
4. Should redirect to `/propostas-comerciais/{id}` showing the split editor (Markdown left, rendered preview right) — confirm the preview shows real bold/italic/underline, a centered heading, and the table rendered as an actual table (not misaligned text). Click "Ver PDF original" and confirm the modal shows the real PDF.
5. Adjust the Markdown if needed, click "Salvar" — should switch in place to the read-only-looking final view: rendered preview + "Copiar formatado" + "Editar novamente" (no more raw Markdown box, no more "Copiar tudo").
6. Click "Copiar formatado", then paste into a rich-text field (e.g. a Word document, an email body, or SEI itself if available) — bold/heading/table/underline should appear as real formatting, not literal `**`/`#`/`|` characters.
7. Click "Editar novamente" — should switch back to the editor in place (no page reload, no new URL). Change something, click "Salvar" again — should return to the final view with the new content.
8. Go back to `/propostas-comerciais` — the row should show "Concluído"; click "Ver" again — should land directly on the final view, not the editor.
