# Documento SEI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the "Documento SEI" module — upload a PDF proposal per client, convert it to Markdown preserving the PDF's visual structure (bold, headings, lists, tables) without AI, let the person edit it in a split Markdown/preview editor, save it, and copy the final Markdown with a one-click button.

**Architecture:** A new Prisma model (`DocumentoSei`) separate from the existing `Documento`/`Analise` pair, a deterministic PDF→Markdown heuristic built on `unpdf`'s `extractTextItems` (font + position per text run, no AI), three API routes mirroring the existing `Documento` route conventions, and three new pages under `/documentos-sei` reusing the project's existing UI primitives (`Badge`, `BTN_PRIMARY`, `.card`, `.table-institucional`).

**Tech Stack:** Next.js 15 (App Router, `'use client'` pages), Prisma + PostgreSQL, Vercel Blob storage (`@vercel/blob`), `unpdf` (already a dependency) for PDF text/font extraction, `marked` (new dependency) for Markdown preview rendering, Jest + Testing Library for tests.

## Global Constraints

- No AI in the extraction/conversion step — the heuristic is deterministic (font name/size/position only), even if tables come out imperfect in complex cases.
- No competência (month/year) field on `DocumentoSei` — it's a proposal, not a monthly report.
- No new file-size limit — same (lack of) limit as the existing `Documento` upload.
- No OCR — a PDF with no extractable text becomes `status: 'erro'`.
- Once `status: 'concluido'`, the record is read-only (no edit endpoint accepts changes to a concluded record).
- No delete endpoint and no autosave-while-editing for `DocumentoSei` — matches the spec's explicit scope cuts.
- Follow existing code conventions exactly: Portuguese identifiers/comments, `'use client'` pages fetching from route handlers, `BTN_PRIMARY`/`BTN_OUTLINE`/`INPUT_BASE` from `@/lib/ui`, `Badge` from `@/components/ui/badge`, `.card`/`.card-flush`/`.table-institucional`/`.skeleton` utility classes already defined in `globals.css`.

---

## Task 1: Prisma schema — `DocumentoSei` model + migration

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Produces: Prisma model `DocumentoSei` with fields `id, nomeArquivo, tamanhoBytes, caminhoOriginal, conteudoMarkdown, status, mensagemErro, uploadedById, clienteId, createdAt` and relations `uploadedBy: Usuario`, `cliente: Cliente`. Client accessor: `prisma.documentoSei`. Every later task that touches the database uses exactly these field names.

- [ ] **Step 1: Add the `DocumentoSei` model and inverse relations**

In `prisma/schema.prisma`, add `documentosSei DocumentoSei[]` to both `Usuario` and `Cliente`:

```prisma
model Usuario {
  id         String   @id @default(cuid())
  nome       String
  email      String   @unique
  senhaHash  String
  role       String   // uploader | responsavel | admin
  createdAt  DateTime @default(now())
  documentos Documento[]
  documentosSei DocumentoSei[]
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
  documentosSei      DocumentoSei[]
  analisesConsolidadas AnaliseConsolidada[]
  analisesEvolucao  AnaliseEvolucao[]
}
```

Then add the new model, right after `Documento`/`Analise`:

```prisma
model DocumentoSei {
  id               String    @id @default(cuid())
  nomeArquivo      String
  tamanhoBytes     Int
  caminhoOriginal  String
  conteudoMarkdown String?   @db.Text // null só quando status é "erro"
  status           String    @default("rascunho") // rascunho | concluido | erro
  mensagemErro     String?
  uploadedById     String
  uploadedBy       Usuario   @relation(fields: [uploadedById], references: [id])
  clienteId        String
  cliente          Cliente   @relation(fields: [clienteId], references: [id])
  createdAt        DateTime  @default(now())

  @@index([clienteId])
}
```

- [ ] **Step 2: Generate the Prisma client and create the dev migration**

Run (starts the dev database if it isn't already up — safe to run even if it's already running):

```bash
npm run dev:db:up
npm run dev:migrate -- --name add_documento_sei
```

Expected: a new folder appears under `prisma/migrations/` containing the migration SQL, and the command ends without error. This also regenerates the Prisma client (`@prisma/client`), so `prisma.documentoSei` and `Prisma.DocumentoSeiWhereInput` become available to TypeScript.

- [ ] **Step 3: Verify the client picked up the new model**

Run:

```bash
npx tsc --noEmit -p .
```

Expected: no errors related to `DocumentoSei` (there's nothing referencing it yet, so this just confirms the schema itself is valid and the client compiled).

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat: adiciona model DocumentoSei"
```

---

## Task 2: PDF → Markdown heuristic (sem IA)

**Files:**
- Create: `src/lib/extracao/pdfMarkdown.ts`
- Test: `src/lib/extracao/pdfMarkdown.test.ts`

**Interfaces:**
- Consumes: `extractTextItems`, `getDocumentProxy`, `type StructuredTextItem` from `unpdf` (already a project dependency — `StructuredTextItem` has `str, x, y, width, height, fontSize, fontFamily, dir, hasEOL`).
- Produces: `converterPdfParaMarkdown(buffer: Buffer): Promise<string>` — later tasks (Task 4) call this exact function with the uploaded PDF's `Buffer` and use the returned string as `conteudoMarkdown`. Returns `''` when no text could be extracted.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/extracao/pdfMarkdown.test.ts`:

```ts
import type { StructuredTextItem } from 'unpdf'

jest.mock('unpdf', () => ({
  getDocumentProxy: jest.fn().mockResolvedValue({}),
  extractTextItems: jest.fn(),
}))

import { extractTextItems } from 'unpdf'
import { converterPdfParaMarkdown } from './pdfMarkdown'

function item(overrides: Partial<StructuredTextItem>): StructuredTextItem {
  return {
    str: '',
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    fontSize: 12,
    fontFamily: 'Helvetica',
    dir: 'ltr',
    hasEOL: false,
    ...overrides,
  }
}

describe('converterPdfParaMarkdown', () => {
  it('envolve trecho com fonte em negrito em **...**', async () => {
    ;(extractTextItems as jest.Mock).mockResolvedValue({
      totalPages: 1,
      items: [[item({ str: 'Cláusula 1', x: 0, fontFamily: 'Helvetica-Bold', hasEOL: true })]],
    })

    const resultado = await converterPdfParaMarkdown(Buffer.from(''))

    expect(resultado).toBe('**Cláusula 1**')
  })

  it('detecta título por tamanho de fonte maior que o corpo do texto', async () => {
    ;(extractTextItems as jest.Mock).mockResolvedValue({
      totalPages: 1,
      items: [
        [
          item({ str: 'Proposta Comercial', x: 0, fontSize: 20, hasEOL: true }),
          item({ str: 'Corpo do texto normal.', x: 0, fontSize: 10, hasEOL: true }),
          item({ str: 'Mais uma linha de corpo.', x: 0, fontSize: 10, hasEOL: true }),
        ],
      ],
    })

    const resultado = await converterPdfParaMarkdown(Buffer.from(''))

    expect(resultado).toBe(
      '# Proposta Comercial\n\nCorpo do texto normal.\n\nMais uma linha de corpo.'
    )
  })

  it('reconhece lista com marcador e lista numerada', async () => {
    ;(extractTextItems as jest.Mock).mockResolvedValue({
      totalPages: 1,
      items: [
        [
          item({ str: '• Primeiro item', x: 0, hasEOL: true }),
          item({ str: '1. Segundo item', x: 0, hasEOL: true }),
        ],
      ],
    })

    const resultado = await converterPdfParaMarkdown(Buffer.from(''))

    expect(resultado).toBe('- Primeiro item\n\n1. Segundo item')
  })

  it('reconstrói tabela quando linhas consecutivas alinham em colunas', async () => {
    ;(extractTextItems as jest.Mock).mockResolvedValue({
      totalPages: 1,
      items: [
        [
          item({ str: 'Item', x: 0, width: 30, hasEOL: false }),
          item({ str: 'Valor', x: 100, width: 30, hasEOL: true }),
          item({ str: 'Storage', x: 0, width: 40, hasEOL: false }),
          item({ str: 'R$ 100', x: 100, width: 40, hasEOL: true }),
        ],
      ],
    })

    const resultado = await converterPdfParaMarkdown(Buffer.from(''))

    expect(resultado).toBe('| Item | Valor |\n| --- | --- |\n| Storage | R$ 100 |')
  })

  it('devolve string vazia quando não há texto extraído', async () => {
    ;(extractTextItems as jest.Mock).mockResolvedValue({ totalPages: 1, items: [[]] })

    const resultado = await converterPdfParaMarkdown(Buffer.from(''))

    expect(resultado).toBe('')
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest src/lib/extracao/pdfMarkdown.test.ts`
Expected: FAIL — `Cannot find module './pdfMarkdown'`.

- [ ] **Step 3: Implement `converterPdfParaMarkdown`**

Create `src/lib/extracao/pdfMarkdown.ts`:

```ts
import { extractTextItems, getDocumentProxy, type StructuredTextItem } from 'unpdf'

/** Gap horizontal (em pontos) acima do qual duas células passam a ser consideradas
 *  colunas separadas de uma tabela, em vez de duas palavras na mesma frase. */
const LIMIAR_GAP_COLUNA = 24

const REGEX_LISTA_NUMERADA = /^(\d+)[.)]\s+(.*)$/
const REGEX_LISTA_MARCADOR = /^[•\-*]\s+(.*)$/

interface ItemLinha {
  texto: string
  x: number
  width: number
  negrito: boolean
}

interface Linha {
  itens: ItemLinha[]
  fontSizeMedio: number
}

/**
 * Converte o conteúdo de um PDF em Markdown, preservando negrito, título, lista
 * e tabela detectados a partir da fonte e da posição de cada trecho de texto —
 * sem usar IA. É uma extração best-effort: negrito e título são confiáveis
 * (comparação direta de fonte/tamanho); tabela funciona bem em grades simples
 * e pode sair desalinhada em casos complexos. É esperado que a pessoa ajuste
 * o resultado manualmente antes de copiar.
 */
export async function converterPdfParaMarkdown(buffer: Buffer): Promise<string> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer))
  const { items } = await extractTextItems(pdf)

  const todasAsLinhas: Linha[] = []
  for (const itensDaPagina of items) {
    todasAsLinhas.push(...agruparEmLinhas(itensDaPagina))
  }

  if (todasAsLinhas.length === 0) return ''

  const tamanhoCorpo = calcularTamanhoCorpo(todasAsLinhas)
  return montarMarkdown(todasAsLinhas, tamanhoCorpo)
}

function agruparEmLinhas(itens: StructuredTextItem[]): Linha[] {
  const linhas: Linha[] = []
  let atual: StructuredTextItem[] = []

  for (const item of itens) {
    if (item.str.trim().length === 0 && atual.length === 0) continue
    atual.push(item)
    if (item.hasEOL) {
      linhas.push(construirLinha(atual))
      atual = []
    }
  }
  if (atual.length > 0) linhas.push(construirLinha(atual))

  return linhas
}

function construirLinha(itensBrutos: StructuredTextItem[]): Linha {
  const itens: ItemLinha[] = itensBrutos
    .filter((item) => item.str.trim().length > 0)
    .map((item) => ({
      texto: item.str,
      x: item.x,
      width: item.width,
      negrito: /bold|negrito/i.test(item.fontFamily),
    }))
  const fontSizeMedio =
    itensBrutos.reduce((soma, item) => soma + item.fontSize, 0) / (itensBrutos.length || 1)
  return { itens, fontSizeMedio }
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
    const texto = item.negrito ? `**${item.texto}**` : item.texto
    celulas[indiceColuna] = celulas[indiceColuna] ? `${celulas[indiceColuna]} ${texto}` : texto
  }
  return celulas
}

function montarTabelaMarkdown(linhas: string[][]): string {
  const [cabecalho, ...resto] = linhas
  const separador = cabecalho.map(() => '---')
  return [cabecalho, separador, ...resto].map((linha) => `| ${linha.join(' | ')} |`).join('\n')
}

function montarLinhaSimples(linha: Linha, tamanhoCorpo: number): string {
  const texto = linha.itens
    .map((item) => (item.negrito ? `**${item.texto}**` : item.texto))
    .join(' ')
    .trim()

  if (texto.length === 0) return ''

  const numerada = texto.match(REGEX_LISTA_NUMERADA)
  if (numerada) return `${numerada[1]}. ${numerada[2]}`

  const marcada = texto.match(REGEX_LISTA_MARCADOR)
  if (marcada) return `- ${marcada[1]}`

  if (linha.fontSizeMedio >= tamanhoCorpo * 1.5) return `# ${texto}`
  if (linha.fontSizeMedio >= tamanhoCorpo * 1.15) return `## ${texto}`

  return texto
}

function montarMarkdown(linhas: Linha[], tamanhoCorpo: number): string {
  const blocos: string[] = []
  let i = 0

  while (i < linhas.length) {
    const anchors = detectarColunas(linhas[i])

    if (anchors) {
      const bloco: string[][] = [linhaParaColunas(linhas[i], anchors)]
      let j = i + 1
      while (j < linhas.length) {
        const proximasColunas = detectarColunas(linhas[j])
        if (!proximasColunas || proximasColunas.length !== anchors.length) break
        bloco.push(linhaParaColunas(linhas[j], anchors))
        j++
      }
      if (bloco.length >= 2) {
        blocos.push(montarTabelaMarkdown(bloco))
        i = j
        continue
      }
    }

    blocos.push(montarLinhaSimples(linhas[i], tamanhoCorpo))
    i++
  }

  return blocos.filter((bloco) => bloco.length > 0).join('\n\n')
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest src/lib/extracao/pdfMarkdown.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/extracao/pdfMarkdown.ts src/lib/extracao/pdfMarkdown.test.ts
git commit -m "feat: heuristica de conversao de PDF para Markdown sem IA"
```

---

## Task 3: Visibilidade — `documentosSeiVisiveisWhere` / `podeVerDocumentoSei`

**Files:**
- Modify: `src/lib/visibilidade.ts`

**Interfaces:**
- Consumes: `AuthUser` (from `./auth`), `prisma` (from `./prisma`), Prisma-generated `DocumentoSei` type and `Prisma.DocumentoSeiWhereInput` (from `@prisma/client`, available after Task 1).
- Produces: `documentosSeiVisiveisWhere(usuario: AuthUser): Promise<Prisma.DocumentoSeiWhereInput>` and `podeVerDocumentoSei(usuario: AuthUser, documentoSei: DocumentoSei): Promise<boolean>` — Tasks 4, 5 and 6 import both directly from `@/lib/visibilidade`.

- [ ] **Step 1: Add the two functions**

In `src/lib/visibilidade.ts`, change the top import to also bring in `DocumentoSei`:

```ts
import type { Documento, DocumentoSei, Prisma } from '@prisma/client'
```

Then append, after `podeVerCliente` at the end of the file:

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

(No dedicated test file for this — the project has none for `visibilidade.ts` today, matching existing convention; it's exercised indirectly through the API route handlers in Tasks 4–6.)

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit -p .`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/visibilidade.ts
git commit -m "feat: regras de visibilidade de DocumentoSei"
```

---

## Task 4: API route — criar e listar (`/api/documentos-sei`)

**Files:**
- Create: `src/app/api/documentos-sei/route.ts`

**Interfaces:**
- Consumes: `getAuthUser` (`@/lib/auth`), `documentosSeiVisiveisWhere`, `podeVerCliente` (`@/lib/visibilidade`, `podeVerCliente` already existed pre-Task-3), `buildUploadPath`, `putUpload` (`@/lib/storage`), `converterPdfParaMarkdown` (`@/lib/extracao/pdfMarkdown`, from Task 2).
- Produces: `GET /api/documentos-sei?clienteId=&status=` → JSON array of `{ id, nomeArquivo, tamanhoBytes, status, mensagemErro, createdAt, uploadedById, uploadedBy: { nome }, cliente: { id, nome } }`. `POST /api/documentos-sei` (multipart: `clienteId`, `arquivo`) → JSON of the created `DocumentoSei` record (`status: 'rascunho'` or `'erro'`), used by Task 9's upload page to redirect to `/documentos-sei/{id}`.

- [ ] **Step 1: Implement the route**

Create `src/app/api/documentos-sei/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { documentosSeiVisiveisWhere, podeVerCliente } from '@/lib/visibilidade'
import { buildUploadPath, putUpload } from '@/lib/storage'
import { converterPdfParaMarkdown } from '@/lib/extracao/pdfMarkdown'

export async function GET(request: NextRequest) {
  const usuario = await getAuthUser(request)
  if (!usuario) {
    return NextResponse.json({ error: 'não autenticado' }, { status: 401 })
  }

  const params = request.nextUrl.searchParams
  const clienteId = params.get('clienteId')
  const status = params.get('status')

  const filtros: Prisma.DocumentoSeiWhereInput = {}
  if (clienteId) filtros.clienteId = clienteId
  if (status) filtros.status = status

  const documentosSei = await prisma.documentoSei.findMany({
    where: { AND: [await documentosSeiVisiveisWhere(usuario), filtros] },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      nomeArquivo: true,
      tamanhoBytes: true,
      status: true,
      mensagemErro: true,
      createdAt: true,
      uploadedById: true,
      uploadedBy: { select: { nome: true } },
      cliente: { select: { id: true, nome: true } },
    },
  })

  return NextResponse.json(documentosSei)
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

  const clienteId = formData?.get('clienteId')
  if (typeof clienteId !== 'string' || !clienteId) {
    return NextResponse.json({ error: '"clienteId" é obrigatório' }, { status: 400 })
  }

  const cliente = await prisma.cliente.findUnique({ where: { id: clienteId } })
  if (!cliente) {
    return NextResponse.json({ error: 'cliente não encontrado' }, { status: 404 })
  }

  const podeVer = await podeVerCliente(usuario, clienteId)
  if (!podeVer) {
    return NextResponse.json({ error: 'acesso negado a esse cliente' }, { status: 403 })
  }

  const buffer = Buffer.from(await arquivo.arrayBuffer())

  const documentoSei = await prisma.documentoSei.create({
    data: {
      nomeArquivo: arquivo.name,
      tamanhoBytes: buffer.length,
      caminhoOriginal: '',
      uploadedById: usuario.id,
      clienteId,
      status: 'rascunho',
    },
  })

  const caminhoRelativo = buildUploadPath(documentoSei.id, 'pdf')
  const url = await putUpload(caminhoRelativo, buffer)

  let documentoSeiFinal
  try {
    const markdown = await converterPdfParaMarkdown(buffer)
    if (!markdown.trim()) {
      throw new Error(
        'não foi possível extrair texto deste PDF — parece ser um PDF escaneado sem texto selecionável'
      )
    }
    documentoSeiFinal = await prisma.documentoSei.update({
      where: { id: documentoSei.id },
      data: { caminhoOriginal: url, conteudoMarkdown: markdown, status: 'rascunho' },
    })
  } catch (error) {
    documentoSeiFinal = await prisma.documentoSei.update({
      where: { id: documentoSei.id },
      data: {
        caminhoOriginal: url,
        status: 'erro',
        mensagemErro: error instanceof Error ? error.message : String(error),
      },
    })
  }

  return NextResponse.json(documentoSeiFinal, { status: 201 })
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit -p .`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/documentos-sei/route.ts
git commit -m "feat: rota de criacao e listagem de DocumentoSei"
```

---

## Task 5: API route — detalhe e salvar (`/api/documentos-sei/[id]`)

**Files:**
- Create: `src/app/api/documentos-sei/[id]/route.ts`

**Interfaces:**
- Consumes: `getAuthUser`, `podeVerDocumentoSei` (from Task 3).
- Produces: `GET /api/documentos-sei/[id]` → JSON of the full `DocumentoSei` record including `conteudoMarkdown`, `cliente: { id, nome }`, `uploadedBy: { nome }` — consumed by Task 12's detail page. `PATCH /api/documentos-sei/[id]` (JSON body `{ conteudoMarkdown: string }`) → sets `status: 'concluido'` and returns the updated record; rejects with 400 if the record is already `'concluido'`. Consumed by Task 10's editor via the `onSalvar` callback wired in Task 12.

- [ ] **Step 1: Implement the route**

Create `src/app/api/documentos-sei/[id]/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { podeVerDocumentoSei } from '@/lib/visibilidade'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const usuario = await getAuthUser(request)
  if (!usuario) {
    return NextResponse.json({ error: 'não autenticado' }, { status: 401 })
  }

  const { id } = await params
  const documentoSei = await prisma.documentoSei.findUnique({
    where: { id },
    include: {
      uploadedBy: { select: { nome: true } },
      cliente: { select: { id: true, nome: true } },
    },
  })
  if (!documentoSei) {
    return NextResponse.json({ error: 'documento SEI não encontrado' }, { status: 404 })
  }

  const podeVer = await podeVerDocumentoSei(usuario, documentoSei)
  if (!podeVer) {
    return NextResponse.json({ error: 'acesso negado' }, { status: 403 })
  }

  return NextResponse.json(documentoSei)
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const usuario = await getAuthUser(request)
  if (!usuario) {
    return NextResponse.json({ error: 'não autenticado' }, { status: 401 })
  }

  const { id } = await params
  const documentoSei = await prisma.documentoSei.findUnique({ where: { id } })
  if (!documentoSei) {
    return NextResponse.json({ error: 'documento SEI não encontrado' }, { status: 404 })
  }

  const podeVer = await podeVerDocumentoSei(usuario, documentoSei)
  if (!podeVer) {
    return NextResponse.json({ error: 'acesso negado' }, { status: 403 })
  }

  if (documentoSei.status === 'concluido') {
    return NextResponse.json({ error: 'documento já concluído não pode ser editado' }, { status: 400 })
  }

  const body = await request.json().catch(() => null)
  const conteudoMarkdown = body?.conteudoMarkdown
  if (typeof conteudoMarkdown !== 'string' || !conteudoMarkdown.trim()) {
    return NextResponse.json({ error: '"conteudoMarkdown" é obrigatório' }, { status: 400 })
  }

  const documentoSeiFinal = await prisma.documentoSei.update({
    where: { id },
    data: { conteudoMarkdown, status: 'concluido' },
  })

  return NextResponse.json(documentoSeiFinal)
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit -p .`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/documentos-sei/[id]/route.ts
git commit -m "feat: rota de detalhe e finalizacao de DocumentoSei"
```

---

## Task 6: API route — PDF original (`/api/documentos-sei/[id]/original`)

**Files:**
- Create: `src/app/api/documentos-sei/[id]/original/route.ts`

**Interfaces:**
- Consumes: `getAuthUser`, `podeVerDocumentoSei` (Task 3), `getUpload` (`@/lib/storage`).
- Produces: `GET /api/documentos-sei/[id]/original?modo=preview` → raw PDF bytes, `Content-Type: application/pdf`, `Content-Disposition: inline` when `modo=preview` else `attachment`. Consumed by Task 10's editor modal iframe (`src="/api/documentos-sei/{id}/original?modo=preview"`).

- [ ] **Step 1: Implement the route**

Create `src/app/api/documentos-sei/[id]/original/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { podeVerDocumentoSei } from '@/lib/visibilidade'
import { getUpload } from '@/lib/storage'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const usuario = await getAuthUser(request)
  if (!usuario) {
    return NextResponse.json({ error: 'não autenticado' }, { status: 401 })
  }

  const { id } = await params
  const documentoSei = await prisma.documentoSei.findUnique({ where: { id } })
  if (!documentoSei) {
    return NextResponse.json({ error: 'documento SEI não encontrado' }, { status: 404 })
  }

  const podeVer = await podeVerDocumentoSei(usuario, documentoSei)
  if (!podeVer) {
    return NextResponse.json({ error: 'acesso negado' }, { status: 403 })
  }

  const modoPreview = request.nextUrl.searchParams.get('modo') === 'preview'
  const buffer = await getUpload(documentoSei.caminhoOriginal)

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${modoPreview ? 'inline' : 'attachment'}; filename="${documentoSei.nomeArquivo}"`,
    },
  })
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit -p .`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/documentos-sei/[id]/original/route.ts
git commit -m "feat: rota de download/preview do PDF original de DocumentoSei"
```

---

## Task 7: Menu lateral — link "Documento SEI"

**Files:**
- Modify: `src/components/nav-bar.tsx`
- Modify: `src/components/nav-bar.test.tsx`

**Interfaces:**
- Produces: a link `Documento SEI` → `/documentos-sei` rendered inside the existing "Relatórios" group, alongside "Todos os documentos".

- [ ] **Step 1: Write the failing test**

In `src/components/nav-bar.test.tsx`, add this test right after the existing `'"Todos os documentos" fica dentro do grupo...'` test:

```ts
  it('"Documento SEI" fica dentro do grupo "Relatórios dos clientes", ao lado de "Todos os documentos"', () => {
    render(<NavBar />)
    expect(screen.getByRole('link', { name: 'Documento SEI' })).toHaveAttribute('href', '/documentos-sei')
  })
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/components/nav-bar.test.tsx -t "Documento SEI"`
Expected: FAIL — no link named "Documento SEI" found.

- [ ] **Step 3: Add the link**

In `src/components/nav-bar.tsx`, add `ClipboardCopy` to the `lucide-react` import list:

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
  type LucideIcon,
} from 'lucide-react'
```

Then change `RELATORIOS_SUBLINKS`:

```ts
const RELATORIOS_SUBLINKS = [
  { href: '/', label: 'Todos os documentos', icon: FileText },
  { href: '/documentos-sei', label: 'Documento SEI', icon: ClipboardCopy },
]
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest src/components/nav-bar.test.tsx`
Expected: PASS (all tests in the file, including the new one).

- [ ] **Step 5: Commit**

```bash
git add src/components/nav-bar.tsx src/components/nav-bar.test.tsx
git commit -m "feat: link Documento SEI no menu lateral"
```

---

## Task 8: Dependência `marked` para renderizar o preview

**Files:**
- Modify: `package.json` / `package-lock.json` (via `npm install`)

**Interfaces:**
- Produces: `marked` importable as `import { marked } from 'marked'`, used by Task 10 as `marked.parse(markdown) as string`.

- [ ] **Step 1: Install**

Run:

```bash
npm install marked
```

Expected: `package.json` gains a `marked` entry under `dependencies`, `package-lock.json` updates.

- [ ] **Step 2: Verify the import resolves**

Run:

```bash
node -e "const { marked } = require('marked'); console.log(marked.parse('**oi**'))"
```

Expected: prints `<p><strong>oi</strong></p>` (or similar wrapped HTML) with no error.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: adiciona marked para preview de Markdown"
```

---

## Task 9: Página de histórico — `/documentos-sei`

**Files:**
- Create: `src/app/documentos-sei/page.tsx`

**Interfaces:**
- Consumes: `GET /api/documentos-sei?clienteId=` (Task 4), `GET /api/clientes` (pre-existing).
- Produces: the `/documentos-sei` route — a table of past conversions with a client filter and a "Novo documento SEI" link to `/documentos-sei/novo` (Task 11) and a "Ver" link per row to `/documentos-sei/{id}` (Task 12).

- [ ] **Step 1: Implement the page**

Create `src/app/documentos-sei/page.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, Eye, Inbox } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { BTN_PRIMARY, INPUT_BASE } from '@/lib/ui'

interface DocumentoSei {
  id: string
  nomeArquivo: string
  status: string
  createdAt: string
  uploadedBy: { nome: string }
  cliente: { id: string; nome: string }
}

interface Cliente {
  id: string
  nome: string
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

export default function DocumentosSeiPage() {
  const [documentosSei, setDocumentosSei] = useState<DocumentoSei[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [clienteId, setClienteId] = useState('')
  const [carregando, setCarregando] = useState(true)

  async function carregar(clienteIdAtual: string) {
    setCarregando(true)
    const query = clienteIdAtual ? `?clienteId=${clienteIdAtual}` : ''
    const response = await fetch(`/api/documentos-sei${query}`)
    if (response.ok) setDocumentosSei(await response.json())
    setCarregando(false)
  }

  useEffect(() => {
    carregar('')
    fetch('/api/clientes')
      .then((r) => (r.ok ? r.json() : []))
      .then(setClientes)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleFiltrarCliente(novoClienteId: string) {
    setClienteId(novoClienteId)
    carregar(novoClienteId)
  }

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-6 py-8 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <span className="text-xs font-semibold tracking-wide text-orange uppercase">Relatórios</span>
          <h1 className="text-2xl font-bold text-navy">Documento SEI</h1>
        </div>
        <Link href="/documentos-sei/novo" className={BTN_PRIMARY}>
          <Plus className="size-3.5" strokeWidth={2.25} />
          Novo documento SEI
        </Link>
      </div>

      <label className="flex max-w-xs flex-col gap-1 text-sm">
        <span className="text-xs font-medium text-mid-grey">Cliente</span>
        <select value={clienteId} onChange={(e) => handleFiltrarCliente(e.target.value)} className={INPUT_BASE}>
          <option value="">Todos</option>
          {clientes.map((cliente) => (
            <option key={cliente.id} value={cliente.id}>
              {cliente.nome}
            </option>
          ))}
        </select>
      </label>

      <div className="card-flush">
        {carregando ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="skeleton h-10 w-full" />
            ))}
          </div>
        ) : documentosSei.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-10 text-center">
            <span className="flex size-11 items-center justify-center rounded-full bg-light-grey text-mid-grey">
              <Inbox className="size-5" strokeWidth={1.75} />
            </span>
            <p className="text-sm text-mid-grey">Nenhum documento SEI ainda.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-institucional">
              <thead>
                <tr>
                  <th>Arquivo</th>
                  <th>Cliente</th>
                  <th>Data</th>
                  <th>Quem subiu</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {documentosSei.map((doc) => (
                  <tr key={doc.id}>
                    <td className="font-medium text-navy">{doc.nomeArquivo}</td>
                    <td>{doc.cliente.nome}</td>
                    <td className="text-mid-grey">{new Date(doc.createdAt).toLocaleString('pt-BR')}</td>
                    <td className="text-mid-grey">{doc.uploadedBy.nome}</td>
                    <td>
                      <Badge variant={STATUS_BADGE[doc.status] ?? 'neutral'}>
                        {STATUS_LABEL[doc.status] ?? doc.status}
                      </Badge>
                    </td>
                    <td>
                      <Link
                        href={`/documentos-sei/${doc.id}`}
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

(No dedicated test file — matches the existing convention where the root `/` documents list page, `src/app/page.tsx`, also has no test file.)

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit -p .`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/documentos-sei/page.tsx
git commit -m "feat: pagina de historico do Documento SEI"
```

---

## Task 10: Página de upload — `/documentos-sei/novo`

**Files:**
- Create: `src/app/documentos-sei/novo/page.tsx`

**Interfaces:**
- Consumes: `POST /api/documentos-sei` (Task 4), `GET /api/clientes`.
- Produces: the `/documentos-sei/novo` route — a form (client select + PDF file input) that, on success, redirects to `/documentos-sei/{id}` (Task 12).

- [ ] **Step 1: Implement the page**

Create `src/app/documentos-sei/novo/page.tsx`:

```tsx
'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, UploadCloud } from 'lucide-react'
import { BTN_PRIMARY, INPUT_BASE } from '@/lib/ui'

interface Cliente {
  id: string
  nome: string
}

export default function NovoDocumentoSeiPage() {
  const router = useRouter()
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [clienteId, setClienteId] = useState('')
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/clientes')
      .then((r) => (r.ok ? r.json() : []))
      .then(setClientes)
  }, [])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!clienteId || !arquivo) {
      setErro('Escolha um cliente e um arquivo PDF.')
      return
    }

    setEnviando(true)
    setErro(null)

    const formData = new FormData()
    formData.set('clienteId', clienteId)
    formData.set('arquivo', arquivo)

    const response = await fetch('/api/documentos-sei', { method: 'POST', body: formData })
    const resultado = await response.json().catch(() => null)

    if (!response.ok) {
      setEnviando(false)
      setErro(resultado?.error ?? 'Falha ao enviar o PDF.')
      return
    }

    router.push(`/documentos-sei/${resultado.id}`)
  }

  return (
    <main className="mx-auto max-w-2xl space-y-6 px-6 py-8 lg:px-8">
      <div className="space-y-1">
        <span className="text-xs font-semibold tracking-wide text-orange uppercase">Relatórios</span>
        <h1 className="text-2xl font-bold text-navy">Novo documento SEI</h1>
      </div>

      <form onSubmit={handleSubmit} className="card space-y-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium text-mid-grey">Cliente</span>
          <select value={clienteId} onChange={(e) => setClienteId(e.target.value)} className={INPUT_BASE}>
            <option value="">Escolha um cliente</option>
            {clientes.map((cliente) => (
              <option key={cliente.id} value={cliente.id}>
                {cliente.nome}
              </option>
            ))}
          </select>
        </label>

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

(No dedicated test file — matches the existing convention: the analogous "upload dentro da competência" flow in `src/app/clientes/[id]/[competencia]/page.tsx` is covered by its page-level test, but a standalone one-purpose upload form like this one has no direct precedent to test in isolation beyond what Tasks 4's route already covers server-side.)

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit -p .`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/documentos-sei/novo/page.tsx
git commit -m "feat: pagina de upload do Documento SEI"
```

---

## Task 11: Componente editor — `EditorMarkdown`

**Files:**
- Create: `src/app/documentos-sei/[id]/editor-markdown.tsx`
- Test: `src/app/documentos-sei/[id]/editor-markdown.test.tsx`

**Interfaces:**
- Consumes: `marked` (Task 8).
- Produces: `EditorMarkdown({ documentoId, conteudoInicial, onSalvar }: EditorMarkdownProps)` where `EditorMarkdownProps = { documentoId: string; conteudoInicial: string; onSalvar: (markdown: string) => Promise<void> }`. Rendered by Task 12's page when `status === 'rascunho'`.

- [ ] **Step 1: Write the failing tests**

Create `src/app/documentos-sei/[id]/editor-markdown.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { EditorMarkdown } from './editor-markdown'

describe('EditorMarkdown', () => {
  it('mostra o markdown inicial no textarea e permite editar', () => {
    render(<EditorMarkdown documentoId="doc1" conteudoInicial="# Título" onSalvar={jest.fn()} />)
    const textarea = screen.getByLabelText('Markdown') as HTMLTextAreaElement
    expect(textarea.value).toBe('# Título')

    fireEvent.change(textarea, { target: { value: '# Título editado' } })
    expect(textarea.value).toBe('# Título editado')
  })

  it('abre e fecha o modal do PDF original', () => {
    render(<EditorMarkdown documentoId="doc1" conteudoInicial="texto" onSalvar={jest.fn()} />)

    expect(screen.queryByTitle('PDF original')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Ver PDF original' }))
    const iframe = screen.getByTitle('PDF original')
    expect(iframe).toHaveAttribute('src', '/api/documentos-sei/doc1/original?modo=preview')

    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }))
    expect(screen.queryByTitle('PDF original')).not.toBeInTheDocument()
  })

  it('chama onSalvar com o markdown atual ao clicar em Salvar', () => {
    const onSalvar = jest.fn().mockResolvedValue(undefined)
    render(<EditorMarkdown documentoId="doc1" conteudoInicial="conteúdo original" onSalvar={onSalvar} />)

    fireEvent.change(screen.getByLabelText('Markdown'), { target: { value: 'conteúdo editado' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))

    expect(onSalvar).toHaveBeenCalledWith('conteúdo editado')
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest "src/app/documentos-sei/[id]/editor-markdown.test.tsx"`
Expected: FAIL — `Cannot find module './editor-markdown'`.

- [ ] **Step 3: Implement the component**

Create `src/app/documentos-sei/[id]/editor-markdown.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { marked } from 'marked'
import { FileText, X } from 'lucide-react'
import { BTN_PRIMARY, BTN_OUTLINE } from '@/lib/ui'

export interface EditorMarkdownProps {
  documentoId: string
  conteudoInicial: string
  onSalvar: (markdown: string) => Promise<void>
}

export function EditorMarkdown({ documentoId, conteudoInicial, onSalvar }: EditorMarkdownProps) {
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
              src={`/api/documentos-sei/${documentoId}/original?modo=preview`}
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

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest "src/app/documentos-sei/[id]/editor-markdown.test.tsx"`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/documentos-sei/[id]/editor-markdown.tsx src/app/documentos-sei/[id]/editor-markdown.test.tsx
git commit -m "feat: componente editor de Markdown do Documento SEI"
```

---

## Task 12: Componente final — `MarkdownFinal` (copiar tudo)

**Files:**
- Create: `src/app/documentos-sei/[id]/markdown-final.tsx`
- Test: `src/app/documentos-sei/[id]/markdown-final.test.tsx`

**Interfaces:**
- Produces: `MarkdownFinal({ conteudoMarkdown }: MarkdownFinalProps)` where `MarkdownFinalProps = { conteudoMarkdown: string }`. Rendered by Task 13's page when `status === 'concluido'`.

- [ ] **Step 1: Write the failing tests**

Create `src/app/documentos-sei/[id]/markdown-final.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { MarkdownFinal } from './markdown-final'

describe('MarkdownFinal', () => {
  beforeEach(() => {
    Object.assign(navigator, { clipboard: { writeText: jest.fn().mockResolvedValue(undefined) } })
  })

  it('mostra o markdown final somente leitura', () => {
    render(<MarkdownFinal conteudoMarkdown="# Proposta" />)
    expect(screen.getByText('# Proposta')).toBeInTheDocument()
  })

  it('copia o markdown pro clipboard e mostra "Copiado!" temporariamente', async () => {
    jest.useFakeTimers()
    render(<MarkdownFinal conteudoMarkdown="# Proposta" />)

    fireEvent.click(screen.getByRole('button', { name: /Copiar tudo/ }))

    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith('# Proposta'))
    expect(await screen.findByRole('button', { name: /Copiado!/ })).toBeInTheDocument()

    act(() => {
      jest.advanceTimersByTime(2000)
    })
    expect(screen.getByRole('button', { name: /Copiar tudo/ })).toBeInTheDocument()

    jest.useRealTimers()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest "src/app/documentos-sei/[id]/markdown-final.test.tsx"`
Expected: FAIL — `Cannot find module './markdown-final'`.

- [ ] **Step 3: Implement the component**

Create `src/app/documentos-sei/[id]/markdown-final.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { ClipboardCopy, ClipboardCheck } from 'lucide-react'
import { BTN_PRIMARY } from '@/lib/ui'

export interface MarkdownFinalProps {
  conteudoMarkdown: string
}

export function MarkdownFinal({ conteudoMarkdown }: MarkdownFinalProps) {
  const [copiado, setCopiado] = useState(false)

  async function handleCopiar() {
    await navigator.clipboard.writeText(conteudoMarkdown)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button type="button" onClick={handleCopiar} className={BTN_PRIMARY}>
          {copiado ? (
            <>
              <ClipboardCheck className="size-3.5" strokeWidth={2.25} />
              Copiado!
            </>
          ) : (
            <>
              <ClipboardCopy className="size-3.5" strokeWidth={2.25} />
              Copiar tudo
            </>
          )}
        </button>
      </div>
      <pre className="max-h-[70vh] overflow-auto whitespace-pre-wrap rounded-lg border border-border-grey bg-light-grey p-4 text-sm">
        {conteudoMarkdown}
      </pre>
    </div>
  )
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest "src/app/documentos-sei/[id]/markdown-final.test.tsx"`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/documentos-sei/[id]/markdown-final.tsx src/app/documentos-sei/[id]/markdown-final.test.tsx
git commit -m "feat: componente de markdown final com botao copiar tudo"
```

---

## Task 13: Página de detalhe — `/documentos-sei/[id]`

**Files:**
- Create: `src/app/documentos-sei/[id]/page.tsx`

**Interfaces:**
- Consumes: `GET /api/documentos-sei/[id]` (Task 5), `PATCH /api/documentos-sei/[id]` (Task 5), `EditorMarkdown` (Task 11), `MarkdownFinal` (Task 12).
- Produces: the `/documentos-sei/[id]` route — fetches the record and renders `EditorMarkdown` when `status === 'rascunho'`, `MarkdownFinal` when `status === 'concluido'`, or the error message when `status === 'erro'`. This is the route every other task's links/redirects point to.

- [ ] **Step 1: Implement the page**

Create `src/app/documentos-sei/[id]/page.tsx`:

```tsx
'use client'

import { use, useEffect, useState } from 'react'
import { Loader2, AlertCircle } from 'lucide-react'
import { EditorMarkdown } from './editor-markdown'
import { MarkdownFinal } from './markdown-final'

interface DocumentoSeiDetalhe {
  id: string
  nomeArquivo: string
  status: 'rascunho' | 'concluido' | 'erro'
  mensagemErro: string | null
  conteudoMarkdown: string | null
  cliente: { nome: string }
  uploadedBy: { nome: string }
}

export default function DocumentoSeiDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [documentoSei, setDocumentoSei] = useState<DocumentoSeiDetalhe | null>(null)

  async function carregar() {
    const response = await fetch(`/api/documentos-sei/${id}`)
    if (response.ok) setDocumentoSei(await response.json())
  }

  useEffect(() => {
    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function handleSalvar(markdown: string) {
    const response = await fetch(`/api/documentos-sei/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conteudoMarkdown: markdown }),
    })
    if (response.ok) await carregar()
  }

  if (!documentoSei) {
    return (
      <main className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
        <p className="flex items-center gap-2 text-sm text-mid-grey">
          <Loader2 className="size-4 animate-spin" strokeWidth={2.25} />
          Carregando...
        </p>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-6 py-8 lg:px-8">
      <div>
        <h1 className="text-xl font-bold text-navy">{documentoSei.nomeArquivo}</h1>
        <p className="text-sm text-mid-grey">
          {documentoSei.cliente.nome} · enviado por {documentoSei.uploadedBy.nome}
        </p>
      </div>

      {documentoSei.status === 'erro' && (
        <p className="flex items-center gap-2 rounded-lg bg-red-crit-light p-3 text-sm text-red-crit">
          <AlertCircle className="size-4 shrink-0" strokeWidth={2.25} />
          {documentoSei.mensagemErro}
        </p>
      )}

      {documentoSei.status === 'rascunho' && (
        <EditorMarkdown
          documentoId={documentoSei.id}
          conteudoInicial={documentoSei.conteudoMarkdown ?? ''}
          onSalvar={handleSalvar}
        />
      )}

      {documentoSei.status === 'concluido' && (
        <MarkdownFinal conteudoMarkdown={documentoSei.conteudoMarkdown ?? ''} />
      )}
    </main>
  )
}
```

(No dedicated test file for this wiring page — matches the existing convention where `src/app/documentos/[id]/page.tsx`, which plays the same "fetch + branch into sub-components" role, also has none. The branching logic itself is simple prop-passing; the real behavior is already covered by Task 11/12's component tests.)

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit -p .`
Expected: no errors.

- [ ] **Step 3: Run the full test suite**

Run: `npm test`
Expected: PASS — every test file in the project, including all new ones from Tasks 2, 7, 11, 12.

- [ ] **Step 4: Commit**

```bash
git add src/app/documentos-sei/[id]/page.tsx
git commit -m "feat: pagina de detalhe do Documento SEI (editor + final)"
```

---

## Manual smoke test (after Task 13)

Not automated — run once by hand to confirm the end-to-end flow works against a real dev database:

1. `npm run dev:db:up && npm run dev:seed && npm run dev`
2. Log in, open the menu, click "Documento SEI" → should land on an empty `/documentos-sei` list.
3. Click "Novo documento SEI", pick a client and a real PDF with at least one heading, one bold word, and a bulleted list, submit.
4. Should redirect to `/documentos-sei/{id}` showing the split editor with a Markdown draft on the left and a rendered preview on the right; click "Ver PDF original" and confirm the modal shows the actual PDF.
5. Edit the Markdown, click "Salvar" — should switch in place to the read-only final view with "Copiar tudo"; click it and paste somewhere to confirm the clipboard has the edited Markdown.
6. Go back to `/documentos-sei` — the new row should show `Concluído`; click "Ver" again — should land directly on the final view, not the editor.
