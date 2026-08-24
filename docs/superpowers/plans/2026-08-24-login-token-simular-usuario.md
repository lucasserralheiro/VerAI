# Login por token e "Simular usuário" no header (modo DEV_AUTH) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar um modo de desenvolvimento (`DEV_AUTH_ENABLED=1`) em que a tela `/login`
vira um campo de token que entra direto como admin, e o header ganha um seletor para "ver
como" outro usuário real do banco — trocando a sessão de verdade, sem logout/login manual.

**Architecture:** Duas variáveis de ambiente (`DEV_AUTH_ENABLED`, `DEV_AUTH_TOKEN`) controlam
tudo via um módulo central `src/lib/dev-auth.ts`. Quatro rotas novas (`dev-login`,
`dev-status`, `dev-auth/switch`, `dev-auth/restore`) reaproveitam `criarSessao`/`AUTH_COOKIE_NAME`
de `src/lib/auth.ts` — a "simulação" é sempre uma troca real do cookie de sessão, nunca um
estado visual paralelo. Um segundo cookie httpOnly (`dev-impersonando`) guarda o id do admin
original enquanto uma simulação está ativa. A página `/login` e a `NavBar` só mudam de
aparência; toda a lógica de permissão existente (middleware, `clientesPermitidos`) continua
funcionando sem alteração.

**Tech Stack:** Next.js App Router (route handlers + server/client components), Prisma,
`jose` (JWT), Jest + Testing Library (padrão já usado no repo).

## Global Constraints

- `DEV_AUTH_ENABLED` só liga o recurso quando seu valor é exatamente a string `"1"`; qualquer
  outro valor (ausente, `"0"`, `"true"`) mantém tudo desligado.
- `DEV_AUTH_TOKEN` vem de variável de ambiente — nunca fica hardcoded no código.
- O cookie de sessão continua sendo `token-verai` (`AUTH_COOKIE_NAME` de `src/lib/auth.ts`),
  com os mesmos atributos já usados em `POST /api/auth/login`: `httpOnly: true`,
  `secure: process.env.NODE_ENV === 'production'`, `sameSite: 'lax'`, `path: '/'`,
  `maxAge: 60 * 60 * 8`.
- O novo cookie `dev-impersonando` usa exatamente os mesmos atributos de segurança do cookie
  de sessão.
- `POST /api/auth/dev-login` e `GET /api/auth/dev-status` ficam sob `/api/auth/` — já é um
  prefixo público em `PUBLIC_API_PREFIXES` (`src/middleware.ts`), então **não mexer no
  middleware** para essas duas rotas.
- `POST /api/dev-auth/switch` e `POST /api/dev-auth/restore` ficam fora de qualquer prefixo
  público — o middleware já exige uma sessão válida antes de deixar a requisição chegar nelas.
  **Não adicionar `/api/dev-auth/` a `PUBLIC_API_PREFIXES`.**
- Só um admin real (sessão sem o cookie `dev-impersonando`) pode chamar `switch`. Não existe
  encadeamento: para simular outra pessoa a partir de uma simulação ativa, primeiro chama
  `restore`.
- Testes seguem o padrão do repo: rotas usam `/** @jest-environment node */` + `jest.mock` de
  `@/lib/prisma` e `@/lib/auth`; componentes usam Testing Library com `jest.mock('next/navigation')`
  e `global.fetch` mockado por URL.

---

## Task 1: `src/lib/dev-auth.ts` — módulo central do modo dev

**Files:**
- Create: `src/lib/dev-auth.ts`
- Test: `src/lib/dev-auth.test.ts`
- Modify: `.env.example`
- Modify: `.env.development`

**Interfaces:**
- Produces: `devAuthEnabled(): boolean`, `IMPERSONATOR_COOKIE_NAME: string` (valor
  `'dev-impersonando'`), `getImpersonatorId(request: NextRequest): string | null` — usados por
  todas as rotas das Tasks 3–6 e pela `NavBar` (Task 8) só indiretamente via essas rotas.

- [ ] **Step 1: Escrever o teste falhando**

Criar `src/lib/dev-auth.test.ts`:

```ts
/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'
import { devAuthEnabled, getImpersonatorId, IMPERSONATOR_COOKIE_NAME } from './dev-auth'

describe('devAuthEnabled', () => {
  const originalValue = process.env.DEV_AUTH_ENABLED

  afterEach(() => {
    process.env.DEV_AUTH_ENABLED = originalValue
  })

  it('retorna false quando a variável não está definida', () => {
    delete process.env.DEV_AUTH_ENABLED
    expect(devAuthEnabled()).toBe(false)
  })

  it('retorna false para qualquer valor diferente de "1"', () => {
    process.env.DEV_AUTH_ENABLED = 'true'
    expect(devAuthEnabled()).toBe(false)
  })

  it('retorna true quando a variável é "1"', () => {
    process.env.DEV_AUTH_ENABLED = '1'
    expect(devAuthEnabled()).toBe(true)
  })
})

describe('getImpersonatorId', () => {
  it('retorna null quando não há cookie de impersonação', () => {
    const request = new NextRequest('http://localhost/api/qualquer')
    expect(getImpersonatorId(request)).toBeNull()
  })

  it('retorna o id gravado no cookie de impersonação', () => {
    const request = new NextRequest('http://localhost/api/qualquer', {
      headers: { cookie: `${IMPERSONATOR_COOKIE_NAME}=admin-1` },
    })
    expect(getImpersonatorId(request)).toBe('admin-1')
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx jest src/lib/dev-auth.test.ts`
Expected: FAIL — `Cannot find module './dev-auth'`.

- [ ] **Step 3: Implementar**

Criar `src/lib/dev-auth.ts`:

```ts
import type { NextRequest } from 'next/server'

/**
 * Modo de desenvolvimento: login por token + "Simular usuário" no header.
 * Liga com DEV_AUTH_ENABLED=1 — nunca deve estar ligado em produção real.
 */

export const IMPERSONATOR_COOKIE_NAME = 'dev-impersonando'

export function devAuthEnabled(): boolean {
  return process.env.DEV_AUTH_ENABLED === '1'
}

export function getImpersonatorId(request: NextRequest): string | null {
  return request.cookies.get(IMPERSONATOR_COOKIE_NAME)?.value ?? null
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx jest src/lib/dev-auth.test.ts`
Expected: PASS (5 testes).

- [ ] **Step 5: Documentar as variáveis de ambiente**

Em `.env.example`, adicionar ao final do bloco `# Auth`:

```
JWT_SECRET=

# Modo de desenvolvimento — login por token + "Simular usuário" no header.
# "1" liga; vazio/ausente desliga (mantenha desligado em produção real).
DEV_AUTH_ENABLED=
DEV_AUTH_TOKEN=
```

Em `.env.development`, adicionar ao final do bloco `# Auth` (valores reais, este arquivo já é
ignorado pelo git):

```
JWT_SECRET="45b7d9190578b8679181225c541d8da2673827bf74f661767fc516b6a9d012e6"

# Modo de desenvolvimento — login por token + "Simular usuário" no header
DEV_AUTH_ENABLED=1
DEV_AUTH_TOKEN=verai_2026
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/dev-auth.ts src/lib/dev-auth.test.ts .env.example .env.development
git commit -m "feat: modulo dev-auth com flag DEV_AUTH_ENABLED e cookie de impersonacao"
```

---

## Task 2: Usuários de teste no seed

**Files:**
- Modify: `prisma/seed.ts`

**Interfaces:**
- Produces: dois usuários no banco — `uploader-teste@verai.dev` (role `uploader`) e
  `responsavel-teste@verai.dev` (role `responsavel`) — consumidos manualmente pelo seletor da
  Task 8 (não há dependência de código, só de dado).

- [ ] **Step 1: Editar o seed**

Modificar `prisma/seed.ts` — trocar o corpo de `main()` para criar os três usuários:

```ts
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const senhaHashAdmin = await bcrypt.hash('123456', 10)
  const admin = await prisma.usuario.upsert({
    where: { email: 'admin' },
    update: {},
    create: { nome: 'Administrador', email: 'admin', senhaHash: senhaHashAdmin, role: 'admin' },
  })
  console.log(`Usuário admin pronto: ${admin.email} (senha: 123456)`)

  const senhaHashTeste = await bcrypt.hash('123456', 10)

  const uploaderTeste = await prisma.usuario.upsert({
    where: { email: 'uploader-teste@verai.dev' },
    update: {},
    create: {
      nome: 'Uploader Teste',
      email: 'uploader-teste@verai.dev',
      senhaHash: senhaHashTeste,
      role: 'uploader',
    },
  })
  console.log(`Usuário uploader de teste pronto: ${uploaderTeste.email} (senha: 123456)`)

  const responsavelTeste = await prisma.usuario.upsert({
    where: { email: 'responsavel-teste@verai.dev' },
    update: {},
    create: {
      nome: 'Responsável Teste',
      email: 'responsavel-teste@verai.dev',
      senhaHash: senhaHashTeste,
      role: 'responsavel',
    },
  })
  console.log(`Usuário responsavel de teste pronto: ${responsavelTeste.email} (senha: 123456)`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
```

- [ ] **Step 2: Rodar contra o banco local (se estiver disponível)**

Run: `npm run dev:seed`
Expected: as três linhas de log acima, sem erro. Se o Postgres local não estiver rodando
(`docker compose up -d` primeiro, se aplicável neste ambiente), pule este passo e apenas
revise o diff — o seed roda como parte do fluxo normal de setup do projeto.

- [ ] **Step 3: Commit**

```bash
git add prisma/seed.ts
git commit -m "feat: seed cria usuarios de teste uploader e responsavel"
```

---

## Task 3: `POST /api/auth/dev-login`

**Files:**
- Create: `src/app/api/auth/dev-login/route.ts`
- Test: `src/app/api/auth/dev-login/route.test.ts`

**Interfaces:**
- Consumes: `devAuthEnabled()` de `@/lib/dev-auth` (Task 1); `criarSessao`, `AUTH_COOKIE_NAME`,
  `type Role` de `@/lib/auth` (já existentes); `prisma.usuario.findFirst` de `@/lib/prisma`.
- Produces: `POST /api/auth/dev-login` — corpo `{ token: string }`, sucesso `200` com
  `{ id, nome, email, role }` + cookie `token-verai`; usado pelo `dev-login-form.tsx` (Task 7).

- [ ] **Step 1: Escrever o teste falhando**

Criar `src/app/api/auth/dev-login/route.test.ts`:

```ts
/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'

jest.mock('@/lib/prisma', () => ({
  prisma: { usuario: { findFirst: jest.fn() } },
}))
jest.mock('@/lib/auth', () => ({
  ...jest.requireActual('@/lib/auth'),
  criarSessao: jest.fn(),
}))
jest.mock('@/lib/dev-auth', () => ({
  ...jest.requireActual('@/lib/dev-auth'),
  devAuthEnabled: jest.fn(),
}))

import { prisma } from '@/lib/prisma'
import { criarSessao, AUTH_COOKIE_NAME } from '@/lib/auth'
import { devAuthEnabled } from '@/lib/dev-auth'
import { POST } from './route'

function buildRequest(body: unknown) {
  return new NextRequest('http://localhost/api/auth/dev-login', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

describe('POST /api/auth/dev-login', () => {
  it('retorna 401 quando o modo dev está desligado', async () => {
    ;(devAuthEnabled as jest.Mock).mockReturnValue(false)
    const response = await POST(buildRequest({ token: 'verai_2026' }))
    expect(response.status).toBe(401)
  })

  it('retorna 401 quando o token está errado', async () => {
    ;(devAuthEnabled as jest.Mock).mockReturnValue(true)
    process.env.DEV_AUTH_TOKEN = 'verai_2026'
    const response = await POST(buildRequest({ token: 'errado' }))
    expect(response.status).toBe(401)
  })

  it('retorna 500 quando não há usuário admin no banco', async () => {
    ;(devAuthEnabled as jest.Mock).mockReturnValue(true)
    process.env.DEV_AUTH_TOKEN = 'verai_2026'
    ;(prisma.usuario.findFirst as jest.Mock).mockResolvedValue(null)
    const response = await POST(buildRequest({ token: 'verai_2026' }))
    expect(response.status).toBe(500)
  })

  it('retorna 200 com cookie de sessão quando o token está certo', async () => {
    ;(devAuthEnabled as jest.Mock).mockReturnValue(true)
    process.env.DEV_AUTH_TOKEN = 'verai_2026'
    ;(prisma.usuario.findFirst as jest.Mock).mockResolvedValue({
      id: 'admin-1',
      nome: 'Administrador',
      email: 'admin',
      role: 'admin',
    })
    ;(criarSessao as jest.Mock).mockResolvedValue('token-fake')

    const response = await POST(buildRequest({ token: 'verai_2026' }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      id: 'admin-1',
      nome: 'Administrador',
      email: 'admin',
      role: 'admin',
    })
    expect(response.cookies.get(AUTH_COOKIE_NAME)?.value).toBe('token-fake')
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx jest src/app/api/auth/dev-login/route.test.ts`
Expected: FAIL — `Cannot find module './route'`.

- [ ] **Step 3: Implementar**

Criar `src/app/api/auth/dev-login/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { criarSessao, AUTH_COOKIE_NAME, type Role } from '@/lib/auth'
import { devAuthEnabled } from '@/lib/dev-auth'

export async function POST(request: NextRequest) {
  if (!devAuthEnabled()) {
    return NextResponse.json({ error: 'token inválido' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const token = body?.token

  if (typeof token !== 'string' || token !== process.env.DEV_AUTH_TOKEN) {
    return NextResponse.json({ error: 'token inválido' }, { status: 401 })
  }

  const admin = await prisma.usuario.findFirst({ where: { role: 'admin' } })
  if (!admin) {
    return NextResponse.json(
      { error: 'nenhum usuário admin encontrado — rode "npm run dev:seed"' },
      { status: 500 }
    )
  }

  const sessionToken = await criarSessao({ id: admin.id, role: admin.role as Role })

  const response = NextResponse.json({
    id: admin.id,
    nome: admin.nome,
    email: admin.email,
    role: admin.role,
  })
  response.cookies.set(AUTH_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 8,
  })
  return response
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx jest src/app/api/auth/dev-login/route.test.ts`
Expected: PASS (4 testes).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/auth/dev-login/route.ts src/app/api/auth/dev-login/route.test.ts
git commit -m "feat: rota de login por token (modo dev)"
```

---

## Task 4: `GET /api/auth/dev-status`

**Files:**
- Create: `src/app/api/auth/dev-status/route.ts`
- Test: `src/app/api/auth/dev-status/route.test.ts`

**Interfaces:**
- Consumes: `devAuthEnabled()`, `getImpersonatorId()` de `@/lib/dev-auth` (Task 1);
  `getAuthUser()` de `@/lib/auth`; `prisma.usuario.findMany` de `@/lib/prisma`.
- Produces: `GET /api/auth/dev-status` → `{ enabled: boolean, impersonating: boolean, users:
  Array<{ id, nome, email, role }> }` — consumido pela `NavBar` (Task 8).

- [ ] **Step 1: Escrever o teste falhando**

Criar `src/app/api/auth/dev-status/route.test.ts`:

```ts
/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'

jest.mock('@/lib/prisma', () => ({
  prisma: { usuario: { findMany: jest.fn() } },
}))
jest.mock('@/lib/auth', () => ({
  ...jest.requireActual('@/lib/auth'),
  getAuthUser: jest.fn(),
}))
jest.mock('@/lib/dev-auth', () => ({
  ...jest.requireActual('@/lib/dev-auth'),
  devAuthEnabled: jest.fn(),
}))

import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { devAuthEnabled, IMPERSONATOR_COOKIE_NAME } from '@/lib/dev-auth'
import { GET } from './route'

function buildRequest(cookie?: string) {
  return new NextRequest('http://localhost/api/auth/dev-status', {
    headers: cookie ? { cookie } : undefined,
  })
}

describe('GET /api/auth/dev-status', () => {
  it('retorna enabled false sem consultar usuário quando o modo dev está desligado', async () => {
    ;(devAuthEnabled as jest.Mock).mockReturnValue(false)
    const response = await GET(buildRequest())
    await expect(response.json()).resolves.toEqual({ enabled: false, impersonating: false, users: [] })
    expect(prisma.usuario.findMany).not.toHaveBeenCalled()
  })

  it('retorna a lista de usuários quando quem pergunta é admin real', async () => {
    ;(devAuthEnabled as jest.Mock).mockReturnValue(true)
    ;(getAuthUser as jest.Mock).mockResolvedValue({ id: 'admin-1', role: 'admin' })
    ;(prisma.usuario.findMany as jest.Mock).mockResolvedValue([
      { id: 'u1', nome: 'Uploader Teste', email: 'up@verai.dev', role: 'uploader' },
    ])

    const response = await GET(buildRequest())

    await expect(response.json()).resolves.toEqual({
      enabled: true,
      impersonating: false,
      users: [{ id: 'u1', nome: 'Uploader Teste', email: 'up@verai.dev', role: 'uploader' }],
    })
  })

  it('não retorna a lista quando quem pergunta não é admin', async () => {
    ;(devAuthEnabled as jest.Mock).mockReturnValue(true)
    ;(getAuthUser as jest.Mock).mockResolvedValue({ id: 'u1', role: 'uploader' })

    const response = await GET(buildRequest())

    await expect(response.json()).resolves.toEqual({ enabled: true, impersonating: false, users: [] })
    expect(prisma.usuario.findMany).not.toHaveBeenCalled()
  })

  it('marca impersonating true e não retorna lista quando há cookie de impersonação', async () => {
    ;(devAuthEnabled as jest.Mock).mockReturnValue(true)
    ;(getAuthUser as jest.Mock).mockResolvedValue({ id: 'u1', role: 'uploader' })

    const response = await GET(buildRequest(`${IMPERSONATOR_COOKIE_NAME}=admin-1`))

    await expect(response.json()).resolves.toEqual({ enabled: true, impersonating: true, users: [] })
    expect(prisma.usuario.findMany).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx jest src/app/api/auth/dev-status/route.test.ts`
Expected: FAIL — `Cannot find module './route'`.

- [ ] **Step 3: Implementar**

Criar `src/app/api/auth/dev-status/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { devAuthEnabled, getImpersonatorId } from '@/lib/dev-auth'

export async function GET(request: NextRequest) {
  if (!devAuthEnabled()) {
    return NextResponse.json({ enabled: false, impersonating: false, users: [] })
  }

  const impersonating = getImpersonatorId(request) !== null
  const usuarioAtual = await getAuthUser(request)
  const podeVerLista = usuarioAtual?.role === 'admin' && !impersonating

  const users = podeVerLista
    ? await prisma.usuario.findMany({
        where: { role: { in: ['uploader', 'responsavel'] } },
        orderBy: { nome: 'asc' },
        select: { id: true, nome: true, email: true, role: true },
      })
    : []

  return NextResponse.json({ enabled: true, impersonating, users })
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx jest src/app/api/auth/dev-status/route.test.ts`
Expected: PASS (4 testes).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/auth/dev-status/route.ts src/app/api/auth/dev-status/route.test.ts
git commit -m "feat: rota de status do modo dev (enabled/impersonating/users)"
```

---

## Task 5: `POST /api/dev-auth/switch`

**Files:**
- Create: `src/app/api/dev-auth/switch/route.ts`
- Test: `src/app/api/dev-auth/switch/route.test.ts`

**Interfaces:**
- Consumes: `devAuthEnabled()`, `getImpersonatorId()`, `IMPERSONATOR_COOKIE_NAME` de
  `@/lib/dev-auth`; `getAuthUser`, `criarSessao`, `AUTH_COOKIE_NAME`, `type Role` de
  `@/lib/auth`; `prisma.usuario.findUnique`.
- Produces: `POST /api/dev-auth/switch` — corpo `{ userId: string }`, sucesso `200` com
  `{ id, nome, email, role }` + cookies `token-verai` (novo usuário) e `dev-impersonando`
  (id do admin original) — consumido pela `NavBar` (Task 8).

- [ ] **Step 1: Escrever o teste falhando**

Criar `src/app/api/dev-auth/switch/route.test.ts`:

```ts
/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'

jest.mock('@/lib/prisma', () => ({
  prisma: { usuario: { findUnique: jest.fn() } },
}))
jest.mock('@/lib/auth', () => ({
  ...jest.requireActual('@/lib/auth'),
  getAuthUser: jest.fn(),
  criarSessao: jest.fn(),
}))
jest.mock('@/lib/dev-auth', () => ({
  ...jest.requireActual('@/lib/dev-auth'),
  devAuthEnabled: jest.fn(),
}))

import { prisma } from '@/lib/prisma'
import { getAuthUser, criarSessao, AUTH_COOKIE_NAME } from '@/lib/auth'
import { devAuthEnabled, IMPERSONATOR_COOKIE_NAME } from '@/lib/dev-auth'
import { POST } from './route'

function buildRequest(body: unknown, cookie?: string) {
  return new NextRequest('http://localhost/api/dev-auth/switch', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
  })
}

describe('POST /api/dev-auth/switch', () => {
  it('retorna 403 quando o modo dev está desligado', async () => {
    ;(devAuthEnabled as jest.Mock).mockReturnValue(false)
    const response = await POST(buildRequest({ userId: 'u1' }))
    expect(response.status).toBe(403)
  })

  it('retorna 403 quando quem chama não é admin', async () => {
    ;(devAuthEnabled as jest.Mock).mockReturnValue(true)
    ;(getAuthUser as jest.Mock).mockResolvedValue({ id: 'u1', role: 'uploader' })
    const response = await POST(buildRequest({ userId: 'u2' }))
    expect(response.status).toBe(403)
  })

  it('retorna 403 quando já existe uma simulação ativa', async () => {
    ;(devAuthEnabled as jest.Mock).mockReturnValue(true)
    ;(getAuthUser as jest.Mock).mockResolvedValue({ id: 'admin-1', role: 'admin' })
    const response = await POST(
      buildRequest({ userId: 'u1' }, `${IMPERSONATOR_COOKIE_NAME}=admin-1`)
    )
    expect(response.status).toBe(403)
  })

  it('retorna 404 quando o usuário alvo não existe', async () => {
    ;(devAuthEnabled as jest.Mock).mockReturnValue(true)
    ;(getAuthUser as jest.Mock).mockResolvedValue({ id: 'admin-1', role: 'admin' })
    ;(prisma.usuario.findUnique as jest.Mock).mockResolvedValue(null)
    const response = await POST(buildRequest({ userId: 'inexistente' }))
    expect(response.status).toBe(404)
  })

  it('troca a sessão e grava o cookie de impersonação quando tudo está certo', async () => {
    ;(devAuthEnabled as jest.Mock).mockReturnValue(true)
    ;(getAuthUser as jest.Mock).mockResolvedValue({ id: 'admin-1', role: 'admin' })
    ;(prisma.usuario.findUnique as jest.Mock).mockResolvedValue({
      id: 'u1',
      nome: 'Uploader Teste',
      email: 'up@verai.dev',
      role: 'uploader',
    })
    ;(criarSessao as jest.Mock).mockResolvedValue('token-do-uploader')

    const response = await POST(buildRequest({ userId: 'u1' }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      id: 'u1',
      nome: 'Uploader Teste',
      email: 'up@verai.dev',
      role: 'uploader',
    })
    expect(response.cookies.get(AUTH_COOKIE_NAME)?.value).toBe('token-do-uploader')
    expect(response.cookies.get(IMPERSONATOR_COOKIE_NAME)?.value).toBe('admin-1')
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx jest src/app/api/dev-auth/switch/route.test.ts`
Expected: FAIL — `Cannot find module './route'`.

- [ ] **Step 3: Implementar**

Criar `src/app/api/dev-auth/switch/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser, criarSessao, AUTH_COOKIE_NAME, type Role } from '@/lib/auth'
import { devAuthEnabled, getImpersonatorId, IMPERSONATOR_COOKIE_NAME } from '@/lib/dev-auth'

export async function POST(request: NextRequest) {
  if (!devAuthEnabled()) {
    return NextResponse.json({ error: 'recurso desativado' }, { status: 403 })
  }

  const usuarioAtual = await getAuthUser(request)
  if (!usuarioAtual || usuarioAtual.role !== 'admin') {
    return NextResponse.json({ error: 'só o admin pode simular outro usuário' }, { status: 403 })
  }

  if (getImpersonatorId(request)) {
    return NextResponse.json(
      { error: 'já está simulando um usuário — volte para admin antes de trocar' },
      { status: 403 }
    )
  }

  const body = await request.json().catch(() => null)
  const userId = body?.userId
  if (typeof userId !== 'string') {
    return NextResponse.json({ error: '"userId" é obrigatório' }, { status: 400 })
  }

  const alvo = await prisma.usuario.findUnique({ where: { id: userId } })
  if (!alvo) {
    return NextResponse.json({ error: 'usuário não encontrado' }, { status: 404 })
  }

  const sessionToken = await criarSessao({ id: alvo.id, role: alvo.role as Role })
  const cookieOpts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 60 * 60 * 8,
  }

  const response = NextResponse.json({
    id: alvo.id,
    nome: alvo.nome,
    email: alvo.email,
    role: alvo.role,
  })
  response.cookies.set(AUTH_COOKIE_NAME, sessionToken, cookieOpts)
  response.cookies.set(IMPERSONATOR_COOKIE_NAME, usuarioAtual.id, cookieOpts)
  return response
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx jest src/app/api/dev-auth/switch/route.test.ts`
Expected: PASS (5 testes).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/dev-auth/switch/route.ts src/app/api/dev-auth/switch/route.test.ts
git commit -m "feat: rota de troca de sessao para simular outro usuario"
```

---

## Task 6: `POST /api/dev-auth/restore`

**Files:**
- Create: `src/app/api/dev-auth/restore/route.ts`
- Test: `src/app/api/dev-auth/restore/route.test.ts`

**Interfaces:**
- Consumes: `devAuthEnabled()`, `getImpersonatorId()`, `IMPERSONATOR_COOKIE_NAME` de
  `@/lib/dev-auth`; `criarSessao`, `AUTH_COOKIE_NAME`, `type Role` de `@/lib/auth`;
  `prisma.usuario.findUnique`.
- Produces: `POST /api/dev-auth/restore` — sucesso `200` com `{ id, nome, email, role }` do
  admin original + cookie `token-verai` restaurado e `dev-impersonando` apagado — consumido
  pela `NavBar` (Task 8).

- [ ] **Step 1: Escrever o teste falhando**

Criar `src/app/api/dev-auth/restore/route.test.ts`:

```ts
/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'

jest.mock('@/lib/prisma', () => ({
  prisma: { usuario: { findUnique: jest.fn() } },
}))
jest.mock('@/lib/auth', () => ({
  ...jest.requireActual('@/lib/auth'),
  criarSessao: jest.fn(),
}))
jest.mock('@/lib/dev-auth', () => ({
  ...jest.requireActual('@/lib/dev-auth'),
  devAuthEnabled: jest.fn(),
}))

import { prisma } from '@/lib/prisma'
import { criarSessao, AUTH_COOKIE_NAME } from '@/lib/auth'
import { devAuthEnabled, IMPERSONATOR_COOKIE_NAME } from '@/lib/dev-auth'
import { POST } from './route'

function buildRequest(cookie?: string) {
  return new NextRequest('http://localhost/api/dev-auth/restore', {
    method: 'POST',
    headers: cookie ? { cookie } : undefined,
  })
}

describe('POST /api/dev-auth/restore', () => {
  it('retorna 403 quando o modo dev está desligado', async () => {
    ;(devAuthEnabled as jest.Mock).mockReturnValue(false)
    const response = await POST(buildRequest(`${IMPERSONATOR_COOKIE_NAME}=admin-1`))
    expect(response.status).toBe(403)
  })

  it('retorna 403 quando não há simulação ativa', async () => {
    ;(devAuthEnabled as jest.Mock).mockReturnValue(true)
    const response = await POST(buildRequest())
    expect(response.status).toBe(403)
  })

  it('retorna 404 quando o admin original não existe mais', async () => {
    ;(devAuthEnabled as jest.Mock).mockReturnValue(true)
    ;(prisma.usuario.findUnique as jest.Mock).mockResolvedValue(null)
    const response = await POST(buildRequest(`${IMPERSONATOR_COOKIE_NAME}=admin-1`))
    expect(response.status).toBe(404)
  })

  it('restaura a sessão do admin e apaga o cookie de impersonação', async () => {
    ;(devAuthEnabled as jest.Mock).mockReturnValue(true)
    ;(prisma.usuario.findUnique as jest.Mock).mockResolvedValue({
      id: 'admin-1',
      nome: 'Administrador',
      email: 'admin',
      role: 'admin',
    })
    ;(criarSessao as jest.Mock).mockResolvedValue('token-do-admin')

    const response = await POST(buildRequest(`${IMPERSONATOR_COOKIE_NAME}=admin-1`))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      id: 'admin-1',
      nome: 'Administrador',
      email: 'admin',
      role: 'admin',
    })
    expect(response.cookies.get(AUTH_COOKIE_NAME)?.value).toBe('token-do-admin')
    expect(response.cookies.get(IMPERSONATOR_COOKIE_NAME)?.value).toBe('')
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx jest src/app/api/dev-auth/restore/route.test.ts`
Expected: FAIL — `Cannot find module './route'`.

- [ ] **Step 3: Implementar**

Criar `src/app/api/dev-auth/restore/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { criarSessao, AUTH_COOKIE_NAME, type Role } from '@/lib/auth'
import { devAuthEnabled, getImpersonatorId, IMPERSONATOR_COOKIE_NAME } from '@/lib/dev-auth'

export async function POST(request: NextRequest) {
  if (!devAuthEnabled()) {
    return NextResponse.json({ error: 'recurso desativado' }, { status: 403 })
  }

  const adminId = getImpersonatorId(request)
  if (!adminId) {
    return NextResponse.json({ error: 'não há simulação ativa' }, { status: 403 })
  }

  const admin = await prisma.usuario.findUnique({ where: { id: adminId } })
  if (!admin) {
    return NextResponse.json({ error: 'usuário admin original não encontrado' }, { status: 404 })
  }

  const sessionToken = await criarSessao({ id: admin.id, role: admin.role as Role })

  const response = NextResponse.json({
    id: admin.id,
    nome: admin.nome,
    email: admin.email,
    role: admin.role,
  })
  response.cookies.set(AUTH_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 8,
  })
  response.cookies.set(IMPERSONATOR_COOKIE_NAME, '', { path: '/', maxAge: 0 })
  return response
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx jest src/app/api/dev-auth/restore/route.test.ts`
Expected: PASS (4 testes).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/dev-auth/restore/route.ts src/app/api/dev-auth/restore/route.test.ts
git commit -m "feat: rota para voltar da simulacao para o admin original"
```

---

## Task 7: Tela `/login` — token substitui o formulário no modo dev

**Files:**
- Create: `src/app/login/dev-login-form.tsx`
- Test: `src/app/login/dev-login-form.test.tsx`
- Create: `src/app/login/login-form.tsx`
- Test: `src/app/login/login-form.test.tsx`
- Modify: `src/app/login/page.tsx`
- Modify: `src/app/login/page.test.tsx`

**Interfaces:**
- Consumes: `devAuthEnabled()` de `@/lib/dev-auth` (Task 1); `POST /api/auth/dev-login` (Task
  3) e `POST /api/auth/login` (já existente).
- Produces: `LoginForm` (componente, sem props) e `DevLoginForm` (componente, sem props),
  ambos exportados como named exports e usados por `page.tsx`.

- [ ] **Step 1: Escrever o teste do `DevLoginForm` (falhando)**

Criar `src/app/login/dev-login-form.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { DevLoginForm } from './dev-login-form'

const pushMock = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}))

describe('DevLoginForm', () => {
  beforeEach(() => {
    pushMock.mockClear()
    global.fetch = jest.fn()
  })

  it('renderiza o campo de token', () => {
    render(<DevLoginForm />)
    expect(screen.getByRole('heading', { name: 'Entrar' })).toBeInTheDocument()
    expect(screen.getByPlaceholderText('verai_2026')).toBeInTheDocument()
  })

  it('redireciona para /clientes quando o token é aceito', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({ ok: true })
    render(<DevLoginForm />)

    fireEvent.change(screen.getByPlaceholderText('verai_2026'), { target: { value: 'verai_2026' } })
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/clientes'))
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/auth/dev-login',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ token: 'verai_2026' }) })
    )
  })

  it('mostra mensagem de erro quando o token é inválido', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({ ok: false })
    render(<DevLoginForm />)

    fireEvent.change(screen.getByPlaceholderText('verai_2026'), { target: { value: 'errado' } })
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))

    await waitFor(() => expect(screen.getByText('Token inválido')).toBeInTheDocument())
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx jest src/app/login/dev-login-form.test.tsx`
Expected: FAIL — `Cannot find module './dev-login-form'`.

- [ ] **Step 3: Implementar `DevLoginForm`**

Criar `src/app/login/dev-login-form.tsx`:

```tsx
'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { KeyRound, AlertCircle } from 'lucide-react'
import { BTN_PRIMARY } from '@/lib/ui'

export function DevLoginForm() {
  const router = useRouter()
  const [token, setToken] = useState('')
  const [erro, setErro] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setErro(null)
    const response = await fetch('/api/auth/dev-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
    if (!response.ok) {
      setErro('Token inválido')
      return
    }
    router.push('/clientes')
  }

  return (
    <section className="flex items-center justify-center bg-background p-8">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-6">
        <div className="space-y-1 lg:hidden">
          <div className="mb-4 flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-md bg-orange text-base font-bold text-white">
              V
            </span>
            <span className="text-lg font-semibold tracking-tight text-navy">
              Ver<span className="text-orange">AI</span>
            </span>
          </div>
        </div>

        <div className="space-y-1">
          <h2 className="text-2xl font-semibold text-navy">Entrar</h2>
          <p className="text-sm text-mid-grey">Modo de desenvolvimento — informe o token de acesso.</p>
        </div>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-foreground">Token</span>
          <span className="relative flex items-center">
            <KeyRound className="pointer-events-none absolute left-3 size-4 text-mid-grey" strokeWidth={2} />
            <input
              type="text"
              autoComplete="off"
              placeholder="verai_2026"
              value={token}
              onChange={(event) => setToken(event.target.value)}
              className="w-full rounded-lg border border-border-grey py-2.5 pr-3 pl-9 text-sm shadow-xs outline-none transition-all focus:border-orange focus:ring-4 focus:ring-orange/12"
              required
            />
          </span>
        </label>

        {erro && (
          <p className="flex items-center gap-1.5 rounded-lg bg-red-crit-light px-3 py-2 text-sm text-red-crit">
            <AlertCircle className="size-4 shrink-0" strokeWidth={2.25} />
            {erro}
          </p>
        )}

        <button type="submit" className={`${BTN_PRIMARY} w-full justify-center`}>
          Entrar
        </button>
      </form>
    </section>
  )
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx jest src/app/login/dev-login-form.test.tsx`
Expected: PASS (3 testes).

- [ ] **Step 5: Extrair `LoginForm` do `page.tsx` atual**

Criar `src/app/login/login-form.tsx` com exatamente o conteúdo do `<section>` de
formulário que hoje vive em `src/app/login/page.tsx` (linhas 60–121), envolvido num
componente nomeado:

```tsx
'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Mail, Lock, AlertCircle } from 'lucide-react'
import { BTN_PRIMARY } from '@/lib/ui'

export function LoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setErro(null)
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, senha }),
    })
    if (!response.ok) {
      setErro('Credenciais inválidas')
      return
    }
    router.push('/clientes')
  }

  return (
    <section className="flex items-center justify-center bg-background p-8">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-6">
        <div className="space-y-1 lg:hidden">
          <div className="mb-4 flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-md bg-orange text-base font-bold text-white">
              V
            </span>
            <span className="text-lg font-semibold tracking-tight text-navy">
              Ver<span className="text-orange">AI</span>
            </span>
          </div>
        </div>

        <div className="space-y-1">
          <h2 className="text-2xl font-semibold text-navy">Entrar</h2>
          <p className="text-sm text-mid-grey">Acesse com suas credenciais institucionais.</p>
        </div>

        <div className="space-y-4">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-foreground">Usuário</span>
            <span className="relative flex items-center">
              <Mail className="pointer-events-none absolute left-3 size-4 text-mid-grey" strokeWidth={2} />
              <input
                type="text"
                autoComplete="username"
                placeholder="admin ou voce@empresa.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-lg border border-border-grey py-2.5 pr-3 pl-9 text-sm shadow-xs outline-none transition-all focus:border-orange focus:ring-4 focus:ring-orange/12"
                required
              />
            </span>
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-foreground">Senha</span>
            <span className="relative flex items-center">
              <Lock className="pointer-events-none absolute left-3 size-4 text-mid-grey" strokeWidth={2} />
              <input
                type="password"
                placeholder="••••••••"
                value={senha}
                onChange={(event) => setSenha(event.target.value)}
                className="w-full rounded-lg border border-border-grey py-2.5 pr-3 pl-9 text-sm shadow-xs outline-none transition-all focus:border-orange focus:ring-4 focus:ring-orange/12"
                required
              />
            </span>
          </label>
        </div>

        {erro && (
          <p className="flex items-center gap-1.5 rounded-lg bg-red-crit-light px-3 py-2 text-sm text-red-crit">
            <AlertCircle className="size-4 shrink-0" strokeWidth={2.25} />
            {erro}
          </p>
        )}

        <button type="submit" className={`${BTN_PRIMARY} w-full justify-center`}>
          Entrar
        </button>
      </form>
    </section>
  )
}
```

Mover `src/app/login/page.test.tsx` para `src/app/login/login-form.test.tsx`, trocando o
import e o alvo renderizado:

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { LoginForm } from './login-form'

const pushMock = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}))

describe('LoginForm', () => {
  beforeEach(() => {
    pushMock.mockClear()
    global.fetch = jest.fn()
  })

  it('renderiza o formulário de login', () => {
    render(<LoginForm />)
    expect(screen.getByRole('heading', { name: 'Entrar' })).toBeInTheDocument()
    expect(screen.getByPlaceholderText('admin ou voce@empresa.com')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument()
  })

  it('redireciona para /clientes após login bem-sucedido', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({ ok: true })
    render(<LoginForm />)

    fireEvent.change(screen.getByPlaceholderText('admin ou voce@empresa.com'), {
      target: { value: 'admin@verai.local' },
    })
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'admin123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/clientes'))
  })

  it('mostra mensagem de erro quando o login falha', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({ ok: false })
    render(<LoginForm />)

    fireEvent.change(screen.getByPlaceholderText('admin ou voce@empresa.com'), {
      target: { value: 'admin@verai.local' },
    })
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'errada' } })
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))

    await waitFor(() => expect(screen.getByText('Credenciais inválidas')).toBeInTheDocument())
  })
})
```

- [ ] **Step 6: Rodar e confirmar que o `LoginForm` passa**

Run: `npx jest src/app/login/login-form.test.tsx`
Expected: PASS (3 testes).

- [ ] **Step 7: Reescrever `page.tsx` como server component**

Substituir todo o conteúdo de `src/app/login/page.tsx`:

```tsx
import { devAuthEnabled } from '@/lib/dev-auth'
import { LoginForm } from './login-form'
import { DevLoginForm } from './dev-login-form'

export default function LoginPage() {
  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="hidden flex-col justify-between bg-navy p-12 text-white lg:flex">
        <div className="flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-md bg-orange text-base font-bold text-white">
            V
          </span>
          <span className="text-lg font-semibold tracking-tight">
            Ver<span className="text-orange">AI</span>
          </span>
        </div>

        <div className="space-y-5">
          <span className="inline-block rounded-full bg-white/10 px-3 py-1 text-xs font-semibold tracking-wide text-orange uppercase">
            Uso interno
          </span>
          <h1 className="max-w-md text-4xl leading-tight font-bold text-orange">
            Análise automatizada de documentos via IA
          </h1>
          <div className="h-px w-16 bg-orange" />
          <p className="max-w-sm text-sm leading-relaxed text-light-blue">
            Centralize o envio, a verificação e o histórico de documentos dos seus clientes com
            insights gerados por inteligência artificial.
          </p>
        </div>

        <p className="text-xs text-light-blue/70">
          © {new Date().getFullYear()} Prodam — VerAI
        </p>
      </section>

      {devAuthEnabled() ? <DevLoginForm /> : <LoginForm />}
    </main>
  )
}
```

- [ ] **Step 8: Reescrever `page.test.tsx`**

Substituir todo o conteúdo de `src/app/login/page.test.tsx`:

```tsx
jest.mock('@/lib/dev-auth', () => ({ devAuthEnabled: jest.fn() }))
jest.mock('./login-form', () => ({ LoginForm: () => <div>login-form</div> }))
jest.mock('./dev-login-form', () => ({ DevLoginForm: () => <div>dev-login-form</div> }))

import { render, screen } from '@testing-library/react'
import { devAuthEnabled } from '@/lib/dev-auth'
import LoginPage from './page'

describe('LoginPage', () => {
  it('renderiza o formulário normal quando o modo dev está desligado', () => {
    ;(devAuthEnabled as jest.Mock).mockReturnValue(false)
    render(<LoginPage />)
    expect(screen.getByText('login-form')).toBeInTheDocument()
    expect(screen.queryByText('dev-login-form')).not.toBeInTheDocument()
  })

  it('renderiza o formulário de token quando o modo dev está ligado', () => {
    ;(devAuthEnabled as jest.Mock).mockReturnValue(true)
    render(<LoginPage />)
    expect(screen.getByText('dev-login-form')).toBeInTheDocument()
    expect(screen.queryByText('login-form')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 9: Rodar toda a suíte da pasta `login` e confirmar que passa**

Run: `npx jest src/app/login`
Expected: PASS (8 testes — 2 de `page.test.tsx`, 3 de `login-form.test.tsx`, 3 de
`dev-login-form.test.tsx`).

- [ ] **Step 10: Commit**

```bash
git add src/app/login
git commit -m "feat: tela de login vira campo de token no modo dev"
```

---

## Task 8: `NavBar` — seletor "Simular usuário" e "Voltar para admin"

**Files:**
- Modify: `src/components/nav-bar.tsx`
- Modify: `src/components/nav-bar.test.tsx`

**Interfaces:**
- Consumes: `GET /api/auth/dev-status` (Task 4), `POST /api/dev-auth/switch` (Task 5),
  `POST /api/dev-auth/restore` (Task 6).

- [ ] **Step 1: Escrever os testes novos (falhando)**

Em `src/components/nav-bar.test.tsx`, adicionar uma função auxiliar e um novo `describe` ao
final do arquivo (mantendo tudo que já existe intacto):

```tsx
function mockFetchComDevStatus(
  role: 'admin' | 'usuario' | null,
  devStatus: {
    enabled: boolean
    impersonating: boolean
    users: Array<{ id: string; nome: string; email: string; role: string }>
  }
) {
  global.fetch = jest.fn((url: RequestInfo | URL) => {
    if (url === '/api/auth/me') {
      return Promise.resolve({
        ok: role !== null,
        json: () => Promise.resolve(role ? { nome: 'Fulano', role } : null),
      }) as unknown as Promise<Response>
    }
    if (url === '/api/auth/dev-status') {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(devStatus) }) as unknown as Promise<Response>
    }
    if (url === '/api/notificacoes') {
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) }) as unknown as Promise<Response>
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) }) as unknown as Promise<Response>
  }) as jest.Mock
}

describe('NavBar — modo dev', () => {
  const reloadMock = jest.fn()

  beforeEach(() => {
    pushMock.mockClear()
    pathnameMock = '/'
    localStorage.clear()
    reloadMock.mockClear()
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, reload: reloadMock },
    })
  })

  it('não mostra nada de dev-auth quando o modo está desligado', async () => {
    mockFetch('admin')
    render(<NavBar />)
    await screen.findByRole('button', { name: 'Configuração' })
    expect(screen.queryByText('Simular usuário')).not.toBeInTheDocument()
  })

  it('mostra o seletor "Simular usuário" para admin real com o modo ligado', async () => {
    mockFetchComDevStatus('admin', {
      enabled: true,
      impersonating: false,
      users: [{ id: 'u1', nome: 'Uploader Teste', email: 'up@verai.dev', role: 'uploader' }],
    })
    render(<NavBar />)

    const select = await screen.findByLabelText('Simular usuário')
    fireEvent.change(select, { target: { value: 'u1' } })

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/dev-auth/switch',
        expect.objectContaining({ method: 'POST', body: JSON.stringify({ userId: 'u1' }) })
      )
    )
    await waitFor(() => expect(reloadMock).toHaveBeenCalled())
  })

  it('mostra "Voltar para admin" quando está simulando um usuário', async () => {
    mockFetchComDevStatus('uploader', { enabled: true, impersonating: true, users: [] })
    render(<NavBar />)

    const botao = await screen.findByRole('button', { name: 'Voltar para admin' })
    fireEvent.click(botao)

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith('/api/dev-auth/restore', { method: 'POST' })
    )
    await waitFor(() => expect(reloadMock).toHaveBeenCalled())
  })
})
```

- [ ] **Step 2: Rodar e confirmar que os testes novos falham**

Run: `npx jest src/components/nav-bar.test.tsx`
Expected: FAIL nos 3 testes novos do describe `NavBar — modo dev` (elementos não encontrados);
os testes já existentes continuam passando.

- [ ] **Step 3: Implementar no `NavBar`**

Em `src/components/nav-bar.tsx`, ajustar o import de ícones (linha 6–19) acrescentando
`ArrowLeftRight`:

```tsx
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
} from 'lucide-react'
```

Logo abaixo de `NAV_EXPANDIDA_KEY`/`LARGURA_MINIMA_EXPANDIDA`, adicionar o tipo:

```ts
interface DevStatus {
  enabled: boolean
  impersonating: boolean
  users: Array<{ id: string; nome: string; email: string; role: string }>
}
```

Trocar o estado `role` (linha 41: `const [role, setRole] = useState<string | null>(null)`) e o
efeito que o preenche (linhas 49–55) por:

```ts
const [usuarioAtual, setUsuarioAtual] = useState<{ nome: string; role: string } | null>(null)
const [devStatus, setDevStatus] = useState<DevStatus>({ enabled: false, impersonating: false, users: [] })

useEffect(() => {
  if (naLoginPage) return
  fetch('/api/auth/me')
    .then((r) => (r.ok ? r.json() : null))
    .then((usuario: { nome: string; role: string } | null) => setUsuarioAtual(usuario))
    .catch(() => {})
}, [naLoginPage])

useEffect(() => {
  if (naLoginPage) return
  fetch('/api/auth/dev-status')
    .then((r) => (r.ok ? r.json() : null))
    .then((status: DevStatus | null) => {
      if (status) setDevStatus(status)
    })
    .catch(() => {})
}, [naLoginPage])
```

Trocar `const ehAdmin = role === 'admin'` (linha 107) por:

```ts
const ehAdmin = usuarioAtual?.role === 'admin'
```

Adicionar, perto de `handleLogout`, os dois novos handlers:

```ts
async function handleSimular(userId: string) {
  if (!userId) return
  await fetch('/api/dev-auth/switch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  })
  window.location.reload()
}

async function handleVoltarAdmin() {
  await fetch('/api/dev-auth/restore', { method: 'POST' })
  window.location.reload()
}
```

No bloco final `<div className="flex shrink-0 flex-col gap-1 px-2.5 py-2.5">`, logo antes do
botão "Sair", inserir:

```tsx
{devStatus.enabled && devStatus.impersonating && (
  <button
    type="button"
    onClick={handleVoltarAdmin}
    aria-label="Voltar para admin"
    className="flex items-center gap-2.5 rounded-md bg-orange/15 px-2.5 py-2 text-sm font-medium text-orange transition-colors hover:bg-orange/25"
  >
    <ArrowLeftRight className="size-3.5 shrink-0" strokeWidth={2.25} />
    {expandida && (
      <span className="truncate whitespace-nowrap">
        Vendo como {usuarioAtual?.nome ?? '...'} · Voltar para admin
      </span>
    )}
  </button>
)}

{devStatus.enabled && !devStatus.impersonating && ehAdmin && expandida && devStatus.users.length > 0 && (
  <div className="flex flex-col gap-1 px-0.5 pb-1">
    <label
      htmlFor="dev-simular-usuario"
      className="text-[0.65rem] font-semibold tracking-wide text-white/40 uppercase"
    >
      Simular usuário
    </label>
    <select
      id="dev-simular-usuario"
      onChange={(event) => {
        if (event.target.value) handleSimular(event.target.value)
      }}
      defaultValue=""
      className="rounded-md border border-white/15 bg-navy-2 px-2 py-1.5 text-xs font-normal tracking-normal text-white normal-case outline-none"
    >
      <option value="" disabled>
        Escolher...
      </option>
      {devStatus.users.map((usuario) => (
        <option key={usuario.id} value={usuario.id}>
          {usuario.nome} ({usuario.role})
        </option>
      ))}
    </select>
  </div>
)}
```

- [ ] **Step 4: Rodar toda a suíte do `nav-bar` e confirmar que passa**

Run: `npx jest src/components/nav-bar.test.tsx`
Expected: PASS (todos os testes — os já existentes + os 3 novos do describe `NavBar — modo dev`).

- [ ] **Step 5: Commit**

```bash
git add src/components/nav-bar.tsx src/components/nav-bar.test.tsx
git commit -m "feat: seletor de simular usuario e voltar para admin no header"
```

---

## Verificação final

- [ ] Rodar a suíte inteira: `npx jest`
Expected: todos os testes passam, incluindo os pré-existentes (`middleware.test.ts`,
`auth.test.ts`, rotas de `login`/`logout`/`me`, etc. — nenhum deles foi tocado por este plano).
- [ ] Rodar `npx tsc --noEmit` (ou o script de typecheck do projeto, se houver um em
  `package.json`) para garantir que os tipos novos (`DevStatus`, `Role` reaproveitado) fecham.
- [ ] Manual, se houver Postgres local rodando: `npm run dev` com `DEV_AUTH_ENABLED=1` e
  `DEV_AUTH_TOKEN=verai_2026` em `.env.development` (já configurado na Task 1) → abrir
  `/login`, entrar com `verai_2026`, confirmar redirecionamento para `/clientes` como admin;
  no header, escolher "Uploader Teste" em Simular usuário, confirmar que a página recarrega e
  o menu Configuração (admin-only) some; clicar "Voltar para admin", confirmar que volta.
