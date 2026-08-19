# Clientes — Páginas e upload por competência (Plano 2/5) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `Documento` passa a exigir `clienteId` + competência (mês/ano); upload sai da tela `/` e vai para `/clientes/[id]/[competencia]`; nascem as páginas `/clientes`, `/clientes/[id]` e `/clientes/[id]/[competencia]`.

**Architecture:** `GET /api/documentos` ganha filtros `clienteId`/`competenciaAno`/`competenciaMes` (reaproveitado pelas páginas novas, sem rota aninhada nova); `POST /api/documentos` passa a exigir os três campos no `formData`. Duas rotas novas e enxutas (`/api/clientes`, `/api/clientes/[id]`) espelham `documentosVisiveisWhere`/`podeVerDocumento` só que pro nível de cliente. Páginas seguem o mesmo padrão client-component + fetch já usado em `/` e `/documentos/[id]`.

**Tech Stack:** Next.js 15 App Router, Prisma + PostgreSQL, Jest + Testing Library.

## Global Constraints

- Depende do Plano 1 (`Cliente`, `Usuario.clientesPermitidos`, `clientesVisiveisWhere`/`podeVerCliente`, `metricasChave` estruturado) já mergeado.
- Ambiente é dev, sem dado de produção — a migration deste plano reseta o banco local (seção 3 do design).
- Sem testes automatizados pra rotas/páginas novas (mesma linha dos módulos 3-8); `lib/competencia.ts` é pura e ganha teste, mesmo padrão de `lib/storage.ts`.
- Todo texto de UI/erro em português.
- Convenção de commit: `git commit -m "tipo: descrição"` em português, terminando com `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.

---

### Task 1: Schema — `Documento.clienteId`/competência

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Produces: `Documento.clienteId: string`, `Documento.competenciaAno: number`, `Documento.competenciaMes: number` (1-12); `Cliente.documentos: Documento[]`

- [ ] **Step 1: Resetar o banco de dev (limpa documentos de teste antes da coluna virar obrigatória)**

```bash
npx dotenv -e .env.development -- npx prisma migrate reset --force
```

Expected: reaplica as migrations existentes (Plano 1 incluso) num banco vazio e roda o seed (`admin@verai.local`) de novo.

- [ ] **Step 2: Editar o schema**

Em `prisma/schema.prisma`, no model `Documento`, adicionar os campos depois de `uploadedBy` e o índice:

```prisma
model Documento {
  id              String    @id @default(cuid())
  nomeArquivo     String
  tipo            String    // xlsx, csv, pdf, docx
  caminhoOriginal String
  tamanhoBytes    Int
  status          String    @default("processando") // processando | concluido | erro
  mensagemErro    String?
  uploadedById    String
  uploadedBy      Usuario   @relation(fields: [uploadedById], references: [id])
  clienteId       String
  cliente         Cliente   @relation(fields: [clienteId], references: [id])
  competenciaAno  Int
  competenciaMes  Int
  createdAt       DateTime  @default(now())
  analise         Analise?
  acessos         AcessoDocumento[]
  notificacoes    Notificacao[]

  @@index([clienteId, competenciaAno, competenciaMes])
}
```

E no model `Cliente` (criado no Plano 1), adicionar a relação inversa:

```prisma
model Cliente {
  id                 String      @id @default(cuid())
  nome               String      @unique
  createdAt          DateTime    @default(now())
  usuariosPermitidos Usuario[]   @relation("UsuarioClientes")
  documentos         Documento[]
}
```

- [ ] **Step 3: Gerar e aplicar a migration**

```bash
npx dotenv -e .env.development -- npx prisma migrate dev --name documento_cliente_competencia
```

Expected: aplica sem pedir valor default (tabela `Documento` está vazia por causa do Step 1).

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat: Documento passa a exigir clienteId e competência (ano/mês)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: `lib/competencia.ts`

**Files:**
- Create: `src/lib/competencia.ts`
- Test: `src/lib/competencia.test.ts`

**Interfaces:**
- Produces: `parseCompetencia(texto: string): { ano: number; mes: number } | null`, `formatarCompetencia(ano: number, mes: number): string`, `nomeCompetencia(ano: number, mes: number): string` — usados pelas páginas deste plano e dos Planos 3/4.

- [ ] **Step 1: Escrever o teste**

```ts
/**
 * @jest-environment node
 */
import { parseCompetencia, formatarCompetencia, nomeCompetencia } from './competencia'

describe('formatarCompetencia', () => {
  it('monta AAAA-MM com mês em dois dígitos', () => {
    expect(formatarCompetencia(2026, 8)).toBe('2026-08')
    expect(formatarCompetencia(2026, 12)).toBe('2026-12')
  })
})

describe('parseCompetencia', () => {
  it('lê AAAA-MM válido', () => {
    expect(parseCompetencia('2026-08')).toEqual({ ano: 2026, mes: 8 })
  })

  it('retorna null pra formato inválido', () => {
    expect(parseCompetencia('agosto-2026')).toBeNull()
    expect(parseCompetencia('2026-8')).toBeNull()
  })

  it('retorna null pra mês fora de 1-12', () => {
    expect(parseCompetencia('2026-13')).toBeNull()
    expect(parseCompetencia('2026-00')).toBeNull()
  })
})

describe('nomeCompetencia', () => {
  it('monta "Mês/Ano" em português', () => {
    expect(nomeCompetencia(2026, 8)).toBe('Agosto/2026')
    expect(nomeCompetencia(2026, 1)).toBe('Janeiro/2026')
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test -- competencia.test.ts`
Expected: FAIL — `Cannot find module './competencia'`

- [ ] **Step 3: Implementar**

```ts
const NOMES_MES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

export function formatarCompetencia(ano: number, mes: number): string {
  return `${ano}-${String(mes).padStart(2, '0')}`
}

export function parseCompetencia(texto: string): { ano: number; mes: number } | null {
  const match = /^(\d{4})-(\d{2})$/.exec(texto)
  if (!match) return null
  const ano = Number(match[1])
  const mes = Number(match[2])
  if (mes < 1 || mes > 12) return null
  return { ano, mes }
}

export function nomeCompetencia(ano: number, mes: number): string {
  return `${NOMES_MES[mes - 1]}/${ano}`
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm test -- competencia.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/competencia.ts src/lib/competencia.test.ts
git commit -m "feat: lib/competencia — parse/formatação de AAAA-MM

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: `lib/visibilidade.ts` — filtro de cliente em documentos

**Files:**
- Modify: `src/lib/visibilidade.ts`

**Interfaces:**
- Consumes: `clienteIdsPermitidos` (privada, já existe do Plano 1)
- Produces: `documentosVisiveisWhere`/`podeVerDocumento` (assinatura igual, comportamento muda — agora também restringem por cliente)

- [ ] **Step 1: Atualizar `documentosVisiveisWhere`**

Trocar a função inteira por:

```ts
export async function documentosVisiveisWhere(usuario: AuthUser): Promise<Prisma.DocumentoWhereInput> {
  const idsClientes = await clienteIdsPermitidos(usuario)
  const restricaoCliente: Prisma.DocumentoWhereInput =
    idsClientes === null ? {} : { clienteId: { in: idsClientes } }

  if (usuario.role === 'admin') return restricaoCliente
  if (usuario.role === 'uploader') return { AND: [restricaoCliente, { uploadedById: usuario.id }] }

  const regras = await regrasQueBatemComUsuario(usuario.email)
  const tipos = regras.filter((r) => r.criterioTipo === 'tipoDocumento').map((r) => r.criterioValor)
  const palavras = regras.filter((r) => r.criterioTipo === 'palavraChaveNome').map((r) => r.criterioValor)

  const OR: Prisma.DocumentoWhereInput[] = [{ uploadedById: usuario.id }]
  if (tipos.length > 0) OR.push({ tipo: { in: tipos } })
  for (const palavra of palavras) {
    OR.push({ nomeArquivo: { contains: palavra, mode: 'insensitive' } })
  }
  return { AND: [restricaoCliente, { OR }] }
}
```

- [ ] **Step 2: Atualizar `podeVerDocumento`**

Trocar a função inteira por:

```ts
export async function podeVerDocumento(usuario: AuthUser, documento: Documento): Promise<boolean> {
  const idsClientes = await clienteIdsPermitidos(usuario)
  if (idsClientes !== null && !idsClientes.includes(documento.clienteId)) return false

  if (usuario.role === 'admin' || documento.uploadedById === usuario.id) return true
  if (usuario.role === 'uploader') return false

  const regras = await regrasQueBatemComUsuario(usuario.email)
  return regras.some((regra) => {
    if (regra.criterioTipo === 'tipoDocumento') return regra.criterioValor === documento.tipo
    if (regra.criterioTipo === 'palavraChaveNome') {
      return documento.nomeArquivo.toLowerCase().includes(regra.criterioValor.toLowerCase())
    }
    return false
  })
}
```

- [ ] **Step 3: Verificar tipagem**

Run: `npx tsc --noEmit`
Expected: sem erros (o Prisma Client já expõe `Documento.clienteId` depois da Task 1).

- [ ] **Step 4: Commit**

```bash
git add src/lib/visibilidade.ts
git commit -m "feat: documentosVisiveisWhere e podeVerDocumento respeitam clientesPermitidos

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: `GET`/`POST /api/documentos` — filtros e upload por cliente/competência

**Files:**
- Modify: `src/app/api/documentos/route.ts`

**Interfaces:**
- Consumes: `podeVerCliente` de `@/lib/visibilidade` (Plano 1)
- Produces: `GET` aceita `?clienteId=&competenciaAno=&competenciaMes=` além dos filtros já existentes, resposta inclui `cliente: { id, nome }`, `competenciaAno`, `competenciaMes`; `POST` exige `clienteId`, `competenciaAno`, `competenciaMes` no `formData` (além de `arquivo`)

- [ ] **Step 1: Substituir o arquivo inteiro**

```ts
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { documentosVisiveisWhere, podeVerCliente } from '@/lib/visibilidade'
import { buildUploadPath, getUploadFullPath } from '@/lib/storage'
import { extrairConteudo } from '@/lib/extracao'
import { analisarDocumento, PROMPT_VERSION_ATUAL } from '@/lib/ia/analisar'
import { dispararNotificacoes } from '@/lib/notificacao'

const TIPOS_SUPORTADOS = ['xlsx', 'csv', 'pdf'] as const

function tipoDoArquivo(nomeArquivo: string): string | null {
  const extensao = nomeArquivo.split('.').pop()?.toLowerCase()
  return extensao && (TIPOS_SUPORTADOS as readonly string[]).includes(extensao) ? extensao : null
}

export async function GET(request: NextRequest) {
  const usuario = await getAuthUser(request)
  if (!usuario) {
    return NextResponse.json({ error: 'não autenticado' }, { status: 401 })
  }

  const params = request.nextUrl.searchParams
  const tipo = params.get('tipo')
  const status = params.get('status')
  const busca = params.get('busca')
  const de = params.get('de')
  const ate = params.get('ate')
  const clienteId = params.get('clienteId')
  const competenciaAno = params.get('competenciaAno')
  const competenciaMes = params.get('competenciaMes')

  const filtros: Prisma.DocumentoWhereInput = {}
  if (tipo) filtros.tipo = tipo
  if (status) filtros.status = status
  if (busca) filtros.nomeArquivo = { contains: busca, mode: 'insensitive' }
  if (de || ate) {
    filtros.createdAt = {
      ...(de ? { gte: new Date(de) } : {}),
      ...(ate ? { lte: new Date(ate) } : {}),
    }
  }
  if (clienteId) filtros.clienteId = clienteId
  if (competenciaAno) filtros.competenciaAno = Number(competenciaAno)
  if (competenciaMes) filtros.competenciaMes = Number(competenciaMes)

  const where: Prisma.DocumentoWhereInput = {
    AND: [await documentosVisiveisWhere(usuario), filtros],
  }

  const documentos = await prisma.documento.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      nomeArquivo: true,
      tipo: true,
      status: true,
      mensagemErro: true,
      tamanhoBytes: true,
      createdAt: true,
      competenciaAno: true,
      competenciaMes: true,
      uploadedBy: { select: { nome: true } },
      cliente: { select: { id: true, nome: true } },
      analise: { select: { id: true } },
    },
  })

  return NextResponse.json(documentos)
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

  const tipo = tipoDoArquivo(arquivo.name)
  if (!tipo) {
    return NextResponse.json(
      { error: `tipo de arquivo não suportado. Aceitos: ${TIPOS_SUPORTADOS.join(', ')}` },
      { status: 400 }
    )
  }

  const clienteId = formData?.get('clienteId')
  const competenciaAno = Number(formData?.get('competenciaAno'))
  const competenciaMes = Number(formData?.get('competenciaMes'))
  if (
    typeof clienteId !== 'string' ||
    !clienteId ||
    !Number.isInteger(competenciaAno) ||
    !Number.isInteger(competenciaMes) ||
    competenciaMes < 1 ||
    competenciaMes > 12
  ) {
    return NextResponse.json(
      { error: '"clienteId", "competenciaAno" e "competenciaMes" (1-12) são obrigatórios' },
      { status: 400 }
    )
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

  const documento = await prisma.documento.create({
    data: {
      nomeArquivo: arquivo.name,
      tipo,
      caminhoOriginal: '',
      tamanhoBytes: buffer.length,
      uploadedById: usuario.id,
      clienteId,
      competenciaAno,
      competenciaMes,
      status: 'processando',
    },
  })

  const caminhoRelativo = buildUploadPath(documento.id, tipo)
  const caminhoCompleto = getUploadFullPath(caminhoRelativo)
  await mkdir(dirname(caminhoCompleto), { recursive: true })
  await writeFile(caminhoCompleto, buffer)
  await prisma.documento.update({
    where: { id: documento.id },
    data: { caminhoOriginal: caminhoRelativo },
  })

  let documentoFinal
  try {
    const conteudoExtraido = await extrairConteudo(buffer, tipo)
    const analise = await analisarDocumento(conteudoExtraido, PROMPT_VERSION_ATUAL)

    await prisma.analise.create({
      data: {
        documentoId: documento.id,
        resumo: analise.resumo,
        pontosCriticos: analise.pontosCriticos,
        pontosPositivos: analise.pontosPositivos,
        metricasChave: analise.metricasChave ?? undefined,
        recomendacoes: analise.recomendacoes ?? undefined,
        promptVersion: analise.promptVersion,
      },
    })

    documentoFinal = await prisma.documento.update({
      where: { id: documento.id },
      data: { status: 'concluido' },
    })
  } catch (error) {
    documentoFinal = await prisma.documento.update({
      where: { id: documento.id },
      data: {
        status: 'erro',
        mensagemErro: error instanceof Error ? error.message : String(error),
      },
    })
  }

  await dispararNotificacoes(documentoFinal)

  return NextResponse.json(documentoFinal, { status: 201 })
}
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: sem erros de tipo.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/documentos/route.ts
git commit -m "feat: GET/POST /api/documentos passam a considerar cliente/competência

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: `GET /api/documentos/[id]` — inclui `cliente`

**Files:**
- Modify: `src/app/api/documentos/[id]/route.ts`

- [ ] **Step 1: Atualizar o `include`**

Trocar:

```ts
  const documento = await prisma.documento.findUnique({
    where: { id },
    include: {
      uploadedBy: { select: { nome: true } },
      analise: true,
    },
  })
```

por:

```ts
  const documento = await prisma.documento.findUnique({
    where: { id },
    include: {
      uploadedBy: { select: { nome: true } },
      cliente: { select: { id: true, nome: true } },
      analise: true,
    },
  })
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/documentos/[id]/route.ts
git commit -m "feat: GET /api/documentos/[id] inclui o cliente

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: `GET /api/clientes` e `GET /api/clientes/[id]`

**Files:**
- Create: `src/app/api/clientes/route.ts`
- Create: `src/app/api/clientes/[id]/route.ts`

**Interfaces:**
- Consumes: `clientesVisiveisWhere`, `podeVerCliente` de `@/lib/visibilidade` (Plano 1)
- Produces: `GET /api/clientes` → `Array<{ id, nome }>` (só os clientes visíveis ao usuário); `GET /api/clientes/[id]` → `{ id, nome }` ou `404`/`403`

- [ ] **Step 1: `src/app/api/clientes/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { clientesVisiveisWhere } from '@/lib/visibilidade'

export async function GET(request: NextRequest) {
  const usuario = await getAuthUser(request)
  if (!usuario) {
    return NextResponse.json({ error: 'não autenticado' }, { status: 401 })
  }

  const clientes = await prisma.cliente.findMany({
    where: await clientesVisiveisWhere(usuario),
    orderBy: { nome: 'asc' },
    select: { id: true, nome: true },
  })
  return NextResponse.json(clientes)
}
```

- [ ] **Step 2: `src/app/api/clientes/[id]/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { podeVerCliente } from '@/lib/visibilidade'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const usuario = await getAuthUser(request)
  if (!usuario) {
    return NextResponse.json({ error: 'não autenticado' }, { status: 401 })
  }

  const { id } = await params
  const cliente = await prisma.cliente.findUnique({ where: { id }, select: { id: true, nome: true } })
  if (!cliente) {
    return NextResponse.json({ error: 'cliente não encontrado' }, { status: 404 })
  }

  const podeVer = await podeVerCliente(usuario, cliente.id)
  if (!podeVer) {
    return NextResponse.json({ error: 'acesso negado' }, { status: 403 })
  }

  return NextResponse.json(cliente)
}
```

- [ ] **Step 3: Verificar manualmente**

```bash
curl http://localhost:3000/api/clientes -H "Cookie: token-verai=<token>"
curl http://localhost:3000/api/clientes/<id> -H "Cookie: token-verai=<token>"
```

Expected: como admin, lista todos os clientes; como `uploader` sem `clientesPermitidos`, lista vazia.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/clientes
git commit -m "feat: rotas GET /api/clientes e /api/clientes/[id]

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 7: Página `/clientes`

**Files:**
- Create: `src/app/clientes/page.tsx`

**Interfaces:**
- Consumes: `GET /api/clientes` (Task 6)

- [ ] **Step 1: Criar a página**

```tsx
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Cliente {
  id: string
  nome: string
}

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    fetch('/api/clientes')
      .then((r) => (r.ok ? r.json() : []))
      .then(setClientes)
      .finally(() => setCarregando(false))
  }, [])

  return (
    <main className="space-y-6 p-8">
      <h1 className="text-xl font-semibold">Clientes</h1>

      {carregando ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : clientes.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhum cliente disponível. Peça a um admin pra cadastrar em /admin/clientes e liberar acesso.
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {clientes.map((cliente) => (
            <li key={cliente.id}>
              <Link
                href={`/clientes/${cliente.id}`}
                className="block rounded border p-4 text-sm font-medium hover:bg-gray-50"
              >
                {cliente.nome}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/clientes/page.tsx
git commit -m "feat: página /clientes

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 8: Página `/clientes/[id]`

**Files:**
- Create: `src/app/clientes/[id]/page.tsx`

**Interfaces:**
- Consumes: `GET /api/clientes/[id]` (Task 6), `GET /api/documentos?clienteId=` (Task 4), `formatarCompetencia`/`nomeCompetencia` (Task 2)

- [ ] **Step 1: Criar a página**

```tsx
'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { formatarCompetencia, nomeCompetencia } from '@/lib/competencia'

interface Cliente {
  id: string
  nome: string
}

interface Documento {
  competenciaAno: number
  competenciaMes: number
}

interface Competencia {
  ano: number
  mes: number
  quantidade: number
}

export default function ClienteDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [competencias, setCompetencias] = useState<Competencia[]>([])
  const [carregando, setCarregando] = useState(true)
  const [novoAno, setNovoAno] = useState(new Date().getFullYear())
  const [novoMes, setNovoMes] = useState(new Date().getMonth() + 1)

  useEffect(() => {
    async function carregar() {
      const [clienteResponse, documentosResponse] = await Promise.all([
        fetch(`/api/clientes/${id}`),
        fetch(`/api/documentos?clienteId=${id}`),
      ])
      if (clienteResponse.ok) setCliente(await clienteResponse.json())
      if (documentosResponse.ok) {
        const documentos: Documento[] = await documentosResponse.json()
        const porCompetencia = new Map<string, Competencia>()
        for (const doc of documentos) {
          const chave = formatarCompetencia(doc.competenciaAno, doc.competenciaMes)
          const atual = porCompetencia.get(chave)
          porCompetencia.set(chave, {
            ano: doc.competenciaAno,
            mes: doc.competenciaMes,
            quantidade: (atual?.quantidade ?? 0) + 1,
          })
        }
        setCompetencias([...porCompetencia.values()].sort((a, b) => b.ano - a.ano || b.mes - a.mes))
      }
      setCarregando(false)
    }
    carregar()
  }, [id])

  function handleNovoMes() {
    router.push(`/clientes/${id}/${formatarCompetencia(novoAno, novoMes)}`)
  }

  if (carregando) {
    return (
      <main className="p-8">
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </main>
    )
  }

  if (!cliente) {
    return (
      <main className="p-8">
        <p className="text-sm text-red-600">Cliente não encontrado ou sem acesso.</p>
      </main>
    )
  }

  return (
    <main className="space-y-6 p-8">
      <h1 className="text-xl font-semibold">{cliente.nome}</h1>

      <div className="flex items-end gap-3 text-sm">
        <label className="flex flex-col gap-1">
          Ano
          <input
            type="number"
            value={novoAno}
            onChange={(e) => setNovoAno(Number(e.target.value))}
            className="w-24 rounded border p-1"
          />
        </label>
        <label className="flex flex-col gap-1">
          Mês
          <select
            value={novoMes}
            onChange={(e) => setNovoMes(Number(e.target.value))}
            className="rounded border p-1"
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((mes) => (
              <option key={mes} value={mes}>
                {mes}
              </option>
            ))}
          </select>
        </label>
        <button onClick={handleNovoMes} className="rounded border px-3 py-1.5">
          Abrir mês
        </button>
      </div>

      {competencias.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum documento ainda. Abra um mês pra começar.</p>
      ) : (
        <ul className="space-y-2">
          {competencias.map((c) => (
            <li key={formatarCompetencia(c.ano, c.mes)}>
              <Link
                href={`/clientes/${id}/${formatarCompetencia(c.ano, c.mes)}`}
                className="flex items-center justify-between rounded border p-3 text-sm hover:bg-gray-50"
              >
                <span>{nomeCompetencia(c.ano, c.mes)}</span>
                <span className="text-muted-foreground">{c.quantidade} documento(s)</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add "src/app/clientes/[id]/page.tsx"
git commit -m "feat: página /clientes/[id] — competências do cliente

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 9: Página `/clientes/[id]/[competencia]` (upload vive aqui agora)

**Files:**
- Create: `src/app/clientes/[id]/[competencia]/page.tsx`

**Interfaces:**
- Consumes: `GET /api/clientes/[id]`, `GET`/`POST /api/documentos` (Tasks 4/6), `parseCompetencia`/`nomeCompetencia` (Task 2)

- [ ] **Step 1: Criar a página**

```tsx
'use client'

import { use, useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { nomeCompetencia, parseCompetencia } from '@/lib/competencia'

interface Documento {
  id: string
  nomeArquivo: string
  tipo: string
  status: string
  createdAt: string
  uploadedBy: { nome: string }
  analise: { id: string } | null
}

interface Cliente {
  id: string
  nome: string
}

const STATUS_BADGE: Record<string, string> = {
  concluido: 'bg-green-100 text-green-800',
  processando: 'bg-gray-100 text-gray-800',
  erro: 'bg-red-100 text-red-800',
}

export default function ClienteCompetenciaPage({
  params,
}: {
  params: Promise<{ id: string; competencia: string }>
}) {
  const { id, competencia } = use(params)
  const parsed = parseCompetencia(competencia)
  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [documentos, setDocumentos] = useState<Documento[]>([])
  const [carregando, setCarregando] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [erroUpload, setErroUpload] = useState<string | null>(null)

  async function carregar() {
    if (!parsed) return
    setCarregando(true)
    const [clienteResponse, documentosResponse] = await Promise.all([
      fetch(`/api/clientes/${id}`),
      fetch(`/api/documentos?clienteId=${id}&competenciaAno=${parsed.ano}&competenciaMes=${parsed.mes}`),
    ])
    if (clienteResponse.ok) setCliente(await clienteResponse.json())
    if (documentosResponse.ok) setDocumentos(await documentosResponse.json())
    setCarregando(false)
  }

  useEffect(() => {
    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, competencia])

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!parsed) return
    setErroUpload(null)
    const form = event.currentTarget
    const input = form.elements.namedItem('arquivo') as HTMLInputElement
    const arquivo = input.files?.[0]
    if (!arquivo) return

    setEnviando(true)
    const formData = new FormData()
    formData.set('arquivo', arquivo)
    formData.set('clienteId', id)
    formData.set('competenciaAno', String(parsed.ano))
    formData.set('competenciaMes', String(parsed.mes))

    const response = await fetch('/api/documentos', { method: 'POST', body: formData })
    setEnviando(false)

    if (!response.ok) {
      const body = await response.json().catch(() => null)
      setErroUpload(body?.error ?? 'Falha ao enviar o documento.')
      return
    }
    form.reset()
    carregar()
  }

  if (!parsed) {
    return (
      <main className="p-8">
        <p className="text-sm text-red-600">Competência inválida na URL (esperado AAAA-MM).</p>
      </main>
    )
  }

  return (
    <main className="space-y-6 p-8">
      <div>
        <p className="text-sm text-muted-foreground">
          <Link href={`/clientes/${id}`} className="hover:underline">
            {cliente?.nome ?? '...'}
          </Link>
        </p>
        <h1 className="text-xl font-semibold">{nomeCompetencia(parsed.ano, parsed.mes)}</h1>
      </div>

      <form onSubmit={handleUpload} className="flex items-center gap-3">
        <input type="file" name="arquivo" accept=".xlsx,.csv,.pdf" required className="text-sm" />
        <button
          type="submit"
          disabled={enviando}
          className="rounded bg-black px-3 py-1.5 text-sm text-white disabled:opacity-50"
        >
          {enviando ? 'Enviando...' : 'Enviar documento'}
        </button>
        {erroUpload && <span className="text-sm text-red-600">{erroUpload}</span>}
      </form>

      {carregando ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : documentos.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum documento neste mês ainda.</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b">
              <th className="py-2">Arquivo</th>
              <th>Tipo</th>
              <th>Enviado por</th>
              <th>Quando</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {documentos.map((doc) => (
              <tr key={doc.id} className="border-b">
                <td className="py-2">{doc.nomeArquivo}</td>
                <td>{doc.tipo}</td>
                <td>{doc.uploadedBy.nome}</td>
                <td>{new Date(doc.createdAt).toLocaleString('pt-BR')}</td>
                <td>
                  <span className={`rounded px-2 py-0.5 text-xs ${STATUS_BADGE[doc.status] ?? ''}`}>
                    {doc.status}
                  </span>
                </td>
                <td className="space-x-3">
                  <Link href={`/documentos/${doc.id}`} className="text-blue-600 hover:underline">
                    Ver análise
                  </Link>
                  <a href={`/api/documentos/${doc.id}/original`} className="text-blue-600 hover:underline">
                    Baixar original
                  </a>
                  {doc.status === 'concluido' && (
                    <a href={`/api/documentos/${doc.id}/relatorio`} className="text-blue-600 hover:underline">
                      Baixar relatório
                    </a>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  )
}
```

Nota: a checkbox de seleção pra "Gerar análise consolidada" e o botão "Comparar com mês anterior" entram nesta mesma página nos Planos 3 e 4 — não implementar aqui.

- [ ] **Step 2: Commit**

```bash
git add "src/app/clientes/[id]/[competencia]/page.tsx"
git commit -m "feat: página /clientes/[id]/[competencia] — upload e documentos do mês

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 10: `/` perde o upload, ganha colunas e filtro de cliente

**Files:**
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes: `GET /api/clientes` (Task 6), `GET /api/documentos?clienteId=` (Task 4)

- [ ] **Step 1: Substituir o arquivo inteiro**

```tsx
'use client'

import { useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'

interface Documento {
  id: string
  nomeArquivo: string
  tipo: string
  status: string
  mensagemErro: string | null
  tamanhoBytes: number
  createdAt: string
  competenciaAno: number
  competenciaMes: number
  uploadedBy: { nome: string }
  cliente: { id: string; nome: string }
  analise: { id: string } | null
}

interface Cliente {
  id: string
  nome: string
}

interface Filtros {
  tipo: string
  status: string
  busca: string
  de: string
  ate: string
  clienteId: string
}

const FILTROS_VAZIOS: Filtros = { tipo: '', status: '', busca: '', de: '', ate: '', clienteId: '' }

const STATUS_BADGE: Record<string, string> = {
  concluido: 'bg-green-100 text-green-800',
  processando: 'bg-gray-100 text-gray-800',
  erro: 'bg-red-100 text-red-800',
}

function montarQuery(filtros: Filtros): string {
  const params = new URLSearchParams()
  if (filtros.tipo) params.set('tipo', filtros.tipo)
  if (filtros.status) params.set('status', filtros.status)
  if (filtros.busca) params.set('busca', filtros.busca)
  if (filtros.de) params.set('de', filtros.de)
  if (filtros.ate) params.set('ate', filtros.ate)
  if (filtros.clienteId) params.set('clienteId', filtros.clienteId)
  return params.toString()
}

export default function DashboardPage() {
  const [documentos, setDocumentos] = useState<Documento[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [carregando, setCarregando] = useState(true)
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_VAZIOS)

  async function carregarDocumentos(filtrosAtuais: Filtros) {
    setCarregando(true)
    const query = montarQuery(filtrosAtuais)
    const response = await fetch(`/api/documentos${query ? `?${query}` : ''}`)
    if (response.ok) {
      setDocumentos(await response.json())
    }
    setCarregando(false)
  }

  useEffect(() => {
    carregarDocumentos(FILTROS_VAZIOS)
    fetch('/api/clientes')
      .then((r) => (r.ok ? r.json() : []))
      .then(setClientes)
  }, [])

  function handleFiltrar(event: FormEvent) {
    event.preventDefault()
    carregarDocumentos(filtros)
  }

  return (
    <main className="space-y-6 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Documentos</h1>
        <p className="text-sm text-muted-foreground">
          Pra enviar um documento, entre no cliente e no mês em{' '}
          <Link href="/clientes" className="text-blue-600 hover:underline">
            Clientes
          </Link>
          .
        </p>
      </div>

      <form onSubmit={handleFiltrar} className="flex flex-wrap items-end gap-3 text-sm">
        <label className="flex flex-col gap-1">
          Cliente
          <select
            value={filtros.clienteId}
            onChange={(e) => setFiltros({ ...filtros, clienteId: e.target.value })}
            className="rounded border p-1"
          >
            <option value="">Todos</option>
            {clientes.map((cliente) => (
              <option key={cliente.id} value={cliente.id}>
                {cliente.nome}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          Tipo
          <select
            value={filtros.tipo}
            onChange={(e) => setFiltros({ ...filtros, tipo: e.target.value })}
            className="rounded border p-1"
          >
            <option value="">Todos</option>
            <option value="xlsx">Excel</option>
            <option value="csv">CSV</option>
            <option value="pdf">PDF</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          Status
          <select
            value={filtros.status}
            onChange={(e) => setFiltros({ ...filtros, status: e.target.value })}
            className="rounded border p-1"
          >
            <option value="">Todos</option>
            <option value="processando">Processando</option>
            <option value="concluido">Concluído</option>
            <option value="erro">Erro</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          Busca (nome)
          <input
            type="text"
            value={filtros.busca}
            onChange={(e) => setFiltros({ ...filtros, busca: e.target.value })}
            className="rounded border p-1"
          />
        </label>
        <label className="flex flex-col gap-1">
          De
          <input
            type="date"
            value={filtros.de}
            onChange={(e) => setFiltros({ ...filtros, de: e.target.value })}
            className="rounded border p-1"
          />
        </label>
        <label className="flex flex-col gap-1">
          Até
          <input
            type="date"
            value={filtros.ate}
            onChange={(e) => setFiltros({ ...filtros, ate: e.target.value })}
            className="rounded border p-1"
          />
        </label>
        <button type="submit" className="rounded border px-3 py-1.5">
          Filtrar
        </button>
      </form>

      {carregando ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : documentos.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum documento encontrado.</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b">
              <th className="py-2">Arquivo</th>
              <th>Cliente</th>
              <th>Competência</th>
              <th>Tipo</th>
              <th>Data</th>
              <th>Quem subiu</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {documentos.map((doc) => (
              <tr key={doc.id} className="border-b">
                <td className="py-2">{doc.nomeArquivo}</td>
                <td>{doc.cliente.nome}</td>
                <td>
                  {String(doc.competenciaMes).padStart(2, '0')}/{doc.competenciaAno}
                </td>
                <td>{doc.tipo}</td>
                <td>{new Date(doc.createdAt).toLocaleString('pt-BR')}</td>
                <td>{doc.uploadedBy.nome}</td>
                <td>
                  <span className={`rounded px-2 py-0.5 text-xs ${STATUS_BADGE[doc.status] ?? ''}`}>
                    {doc.status}
                  </span>
                </td>
                <td className="space-x-3">
                  <Link href={`/documentos/${doc.id}`} className="text-blue-600 hover:underline">
                    Ver análise
                  </Link>
                  <a href={`/api/documentos/${doc.id}/original`} className="text-blue-600 hover:underline">
                    Baixar original
                  </a>
                  {doc.status === 'concluido' && (
                    <a href={`/api/documentos/${doc.id}/relatorio`} className="text-blue-600 hover:underline">
                      Baixar relatório
                    </a>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  )
}
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: / perde upload (move pra /clientes/[id]/[competencia]), ganha coluna/filtro de cliente

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 11: Nav bar — link "Clientes"

**Files:**
- Modify: `src/components/nav-bar.tsx`
- Modify: `src/components/nav-bar.test.tsx`

- [ ] **Step 1: Adicionar o link**

Em `LINKS`, adicionar `{ href: '/clientes', label: 'Clientes' }` logo depois de `'/'`:

```ts
const LINKS = [
  { href: '/', label: 'Documentos' },
  { href: '/clientes', label: 'Clientes' },
  { href: '/notificacoes', label: 'Notificações' },
  { href: '/admin/usuarios', label: 'Usuários' },
  { href: '/admin/clientes', label: 'Gerenciar clientes' },
  { href: '/admin/regras-notificacao', label: 'Regras de notificação' },
]
```

- [ ] **Step 2: Atualizar o teste**

Em `nav-bar.test.tsx`, adicionar depois da asserção de `'Documentos'`:

```ts
    expect(screen.getByRole('link', { name: 'Clientes' })).toHaveAttribute('href', '/clientes')
```

- [ ] **Step 3: Rodar o teste**

Run: `npm test -- nav-bar.test.tsx`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/components/nav-bar.tsx src/components/nav-bar.test.tsx
git commit -m "feat: link Clientes no nav bar

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Verificação final do plano

- [ ] `npm test` — passa
- [ ] `npm run build` — build limpo
- [ ] Manual: como admin, criar cliente "SEGES" em `/admin/clientes`, abrir `/clientes` → `/clientes/<id>` → "Abrir mês" Agosto/2026 → subir um Excel/PDF de teste → documento aparece na tabela com "Enviado por"/"Quando" corretos, análise gerada normalmente
- [ ] Manual: `/` mostra o mesmo documento com as colunas Cliente/Competência, filtro por cliente funciona
- [ ] Manual: como `uploader` sem `clientesPermitidos`, `/clientes` mostra "Nenhum cliente disponível"; depois de um admin atribuir SEGES a esse usuário em `/admin/usuarios`, `/clientes` mostra SEGES
