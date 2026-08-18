# VerAI — Setup base + Camada de IA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Colocar de pé o esqueleto completo do VerAI (Next.js + Prisma + auth + rotas/páginas) e a camada de IA agnóstica de provedor, prontos para os módulos de negócio (ingestão, listagem, visualização, notificação, PDF, permissões) plugarem em cima.

**Architecture:** App Next.js 15 (App Router) com Prisma/PostgreSQL, autenticação própria via JWT em cookie httpOnly (sem NextAuth, sem SSO, sem qualquer integração com o SPDF), middleware central de proteção de rotas por role, e uma camada de IA isolada num único arquivo que resolve o provedor via variáveis de ambiente (Vercel AI SDK + Zod). Rotas de API dos módulos 3–8 entram como stubs `501` até seus próprios ciclos de brainstorm/plano.

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind 4 + shadcn/ui, npm, Prisma + PostgreSQL (docker-compose), bcryptjs + jose (auth), Vercel AI SDK (`ai`) + `zod` + `@ai-sdk/anthropic` (camada de IA), Jest + Testing Library.

## Global Constraints

- Next.js 15 App Router, TypeScript, React 19, npm como package manager.
- Tailwind 4 + shadcn/ui.
- PostgreSQL local via `docker-compose`, porta do host `5433` (evita colisão com outros projetos).
- Auth: `bcryptjs` + `jose`, sessão em cookie `httpOnly` chamado `token-verai`. Sem NextAuth, sem SSO, sem qualquer integração com o SPDF ou outro projeto — banco e código 100% próprios do VerAI.
- Variáveis de ambiente: `DATABASE_URL`, `JWT_SECRET`, `UPLOAD_DIR`, `UPLOAD_BASE_URL`, `AI_PROVIDER`, `AI_API_KEY`, `AI_MODEL` — carregadas de `.env.development` em dev.
- Camada de IA: pacote `ai` (Vercel AI SDK) + `zod` para o schema estruturado; provedor concreto plugado via `@ai-sdk/<provider>`, escolhido em runtime só pela env `AI_PROVIDER` — nenhum outro módulo do sistema conhece o provedor.
- Módulos 3–8 (lógica real de ingestão, listagem, visualização, notificação, PDF, permissões) estão fora deste plano — as rotas correspondentes existem só como stub `501`.
- Specs de referência: `docs/superpowers/specs/2026-08-18-camada-ia-design.md` e `docs/superpowers/specs/2026-08-18-setup-base-design.md`.

---

### Task 1: Bootstrap do projeto (Next.js + Tailwind + shadcn + Jest) + git init

**Files:**
- Create: scaffold completo do `create-next-app` (`package.json`, `tsconfig.json`, `next.config.ts`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`, `.gitignore`, `eslint.config.mjs`)
- Create: `components.json`, `src/lib/utils.ts` (via `shadcn init`)
- Create: `jest.config.ts`
- Create: `jest.setup.ts`
- Modify: `.gitignore`
- Modify: `package.json` (script `test`)

**Interfaces:**
- Produces: projeto Next.js rodável (`npm run dev`, `npm run build`), Jest configurado (`npm test`) para todas as tasks seguintes.

- [ ] **Step 1: Rodar o scaffold do Next.js**

```bash
npx --yes create-next-app@15.0.3 . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
```

Nota: a pasta `docs/` já existente não conflita com nenhum arquivo gerado pelo scaffold, então o comando conclui normalmente.

- [ ] **Step 2: Inicializar o shadcn/ui com as configurações padrão**

```bash
npx --yes shadcn@latest init -d -y
```

Expected: cria `components.json`, `src/lib/utils.ts`, e ajusta `src/app/globals.css`/Tailwind config para os tokens do shadcn.

- [ ] **Step 3: Instalar as dependências de teste**

```bash
npm install --save-dev jest jest-environment-jsdom @testing-library/react @testing-library/jest-dom @types/jest dotenv-cli tsx
```

- [ ] **Step 4: Criar `jest.config.ts`**

```ts
import type { Config } from 'jest'
import nextJest from 'next/jest'

const createJestConfig = nextJest({ dir: './' })

const config: Config = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
}

export default createJestConfig(config)
```

- [ ] **Step 5: Criar `jest.setup.ts`**

```ts
import '@testing-library/jest-dom'
```

- [ ] **Step 6: Adicionar o script `test` no `package.json`**

Dentro de `"scripts"`, adicionar:

```json
"test": "jest --passWithNoTests"
```

- [ ] **Step 7: Ajustar o `.gitignore` gerado, adicionando ao final**

```
# VerAI
/uploads
.env
.env.development
tsconfig.tsbuildinfo
```

- [ ] **Step 8: Verificar que o build funciona**

Run: `npm run build`
Expected: build conclui sem erro (`✓ Compiled successfully`).

- [ ] **Step 9: Verificar que o Jest está configurado**

Run: `npm test`
Expected: `No tests found, exiting with code 0` (ou similar) — `--passWithNoTests` evita falha por ausência de testes nesta etapa.

- [ ] **Step 10: git init e commit inicial**

```bash
git init
git add -A
git commit -m "chore: bootstrap Next.js + Tailwind + shadcn + Jest"
```

---

### Task 2: Banco de dados — docker-compose, env e schema Prisma

**Files:**
- Create: `docker-compose.yml`
- Create: `.env.example`
- Create: `.env.development`
- Create: `prisma/schema.prisma`
- Modify: `package.json` (scripts `dev:db:up`, `dev:db:down`, `dev:migrate`, `dev:generate`, `dev:studio`)

**Interfaces:**
- Consumes: nenhuma (task independente de código).
- Produces: banco `verai` migrado com os modelos `Usuario`, `Documento`, `Analise`, `RegraNotificacao`, `Notificacao`, `AcessoDocumento`, disponível em `postgresql://verai_user:verai_pass@localhost:5433/verai` em dev. `@prisma/client` gerado e importável.

- [ ] **Step 1: Instalar o Prisma**

```bash
npm install @prisma/client
npm install --save-dev prisma
```

- [ ] **Step 2: Criar `docker-compose.yml`**

```yaml
services:
  postgres:
    image: postgres:15-alpine
    container_name: verai-postgres
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      PGDATA: /var/lib/postgresql/data/pgdata
    ports:
      - "127.0.0.1:5433:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
    driver: local
```

- [ ] **Step 3: Criar `.env.example`**

```dotenv
NODE_ENV=development

# Database
DATABASE_URL="postgresql://verai_user:verai_pass@localhost:5433/verai"
POSTGRES_DB=verai
POSTGRES_USER=verai_user
POSTGRES_PASSWORD=verai_pass

# Auth
JWT_SECRET=

# Upload local
UPLOAD_DIR=./uploads
UPLOAD_BASE_URL=http://localhost:3000/api/uploads

# Camada de IA
AI_PROVIDER=
AI_API_KEY=
AI_MODEL=
```

- [ ] **Step 4: Gerar um `JWT_SECRET` local e criar `.env.development`**

```bash
openssl rand -hex 32
```

Copiar o valor gerado para o `.env.development` abaixo (chave `JWT_SECRET`):

```dotenv
NODE_ENV=development

# Database (Development)
DATABASE_URL="postgresql://verai_user:verai_pass@localhost:5433/verai"
POSTGRES_DB=verai
POSTGRES_USER=verai_user
POSTGRES_PASSWORD=verai_pass

# Auth
JWT_SECRET="<colar aqui o valor gerado por openssl rand -hex 32>"

# Upload local
UPLOAD_DIR=./uploads
UPLOAD_BASE_URL=http://localhost:3000/api/uploads

# Camada de IA (vazio até decidir o provedor)
AI_PROVIDER=
AI_API_KEY=
AI_MODEL=
```

- [ ] **Step 5: Criar `prisma/schema.prisma`**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Usuario {
  id         String   @id @default(cuid())
  nome       String
  email      String   @unique
  senhaHash  String
  role       String   // uploader | responsavel | admin
  createdAt  DateTime @default(now())
  documentos Documento[]
  acessos    AcessoDocumento[]
}

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
  createdAt       DateTime  @default(now())
  analise         Analise?
  acessos         AcessoDocumento[]
}

model Analise {
  id                  String    @id @default(cuid())
  documentoId         String    @unique
  documento           Documento @relation(fields: [documentoId], references: [id])
  resumo              String    @db.Text
  pontosCriticos      Json
  pontosPositivos     Json
  metricasChave       Json?
  promptVersion       String
  caminhoRelatorioPdf String?
  relatorioGeradoEm   DateTime?
  createdAt           DateTime  @default(now())
}

model RegraNotificacao {
  id            String @id @default(cuid())
  criterioTipo  String // tipoDocumento | palavraChaveNome
  criterioValor String
  destinatarios Json
}

model Notificacao {
  id           String   @id @default(cuid())
  documentoId  String
  destinatario String
  canal        String   // email | dashboard
  lida         Boolean  @default(false)
  createdAt    DateTime @default(now())
}

model AcessoDocumento {
  id          String    @id @default(cuid())
  documentoId String
  documento   Documento @relation(fields: [documentoId], references: [id])
  usuarioId   String
  usuario     Usuario   @relation(fields: [usuarioId], references: [id])
  acao        String    // visualizou | baixou_original | baixou_relatorio
  createdAt   DateTime  @default(now())
}
```

- [ ] **Step 6: Adicionar os scripts de banco no `package.json`**

```json
"dev:db:up": "docker compose --env-file .env.development up -d",
"dev:db:down": "docker compose --env-file .env.development down",
"dev:migrate": "dotenv -e .env.development -- npx prisma migrate dev",
"dev:generate": "dotenv -e .env.development -- npx prisma generate",
"dev:studio": "dotenv -e .env.development -- npx prisma studio"
```

- [ ] **Step 7: Subir o banco local**

Run: `npm run dev:db:up`
Expected: container `verai-postgres` sobe e fica `healthy` (`docker compose --env-file .env.development ps`).

- [ ] **Step 8: Rodar a migração inicial**

```bash
npm run dev:migrate -- --name init
```

Expected: saída termina com `Your database is now in sync with your schema.` e uma pasta nova aparece em `prisma/migrations/`.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: banco de dados — docker-compose, env e schema Prisma"
```

---

### Task 3: Utilitários base — cliente Prisma e helper de storage

**Files:**
- Create: `src/lib/prisma.ts`
- Create: `src/lib/storage.ts`
- Test: `src/lib/storage.test.ts`

**Interfaces:**
- Consumes: `@prisma/client` gerado na Task 2.
- Produces: `prisma: PrismaClient` (singleton, `src/lib/prisma.ts`); `buildUploadPath(documentoId: string, extensao: string, data?: Date): string`, `getUploadFullPath(relativePath: string): string`, `getUploadPublicUrl(relativePath: string): string` (`src/lib/storage.ts`) — usados pelos módulos de ingestão/visualização mais adiante.

- [ ] **Step 1: Escrever o teste de `storage.ts`**

Create `src/lib/storage.test.ts`:

```ts
/**
 * @jest-environment node
 */
import path from 'node:path'
import { buildUploadPath, getUploadFullPath, getUploadPublicUrl } from './storage'

describe('buildUploadPath', () => {
  it('monta o caminho relativo com ano/mes/documentoId/original.ext', () => {
    const data = new Date('2026-08-18T12:00:00Z')
    expect(buildUploadPath('doc123', 'xlsx', data)).toBe('2026/08/doc123/original.xlsx')
  })

  it('preenche o mês com zero à esquerda', () => {
    const data = new Date('2026-01-05T12:00:00Z')
    expect(buildUploadPath('doc456', 'pdf', data)).toBe('2026/01/doc456/original.pdf')
  })
})

describe('getUploadFullPath', () => {
  const originalEnv = process.env.UPLOAD_DIR

  afterEach(() => {
    process.env.UPLOAD_DIR = originalEnv
  })

  it('junta UPLOAD_DIR com o caminho relativo', () => {
    process.env.UPLOAD_DIR = './uploads'
    expect(getUploadFullPath('2026/08/doc123/original.xlsx')).toBe(
      path.join('./uploads', '2026/08/doc123/original.xlsx')
    )
  })

  it('lança erro se UPLOAD_DIR não estiver configurado', () => {
    delete process.env.UPLOAD_DIR
    expect(() => getUploadFullPath('qualquer')).toThrow('UPLOAD_DIR não configurado')
  })
})

describe('getUploadPublicUrl', () => {
  const originalEnv = process.env.UPLOAD_BASE_URL

  afterEach(() => {
    process.env.UPLOAD_BASE_URL = originalEnv
  })

  it('monta a URL pública juntando UPLOAD_BASE_URL com o caminho relativo', () => {
    process.env.UPLOAD_BASE_URL = 'http://localhost:3000/api/uploads'
    expect(getUploadPublicUrl('2026/08/doc123/original.xlsx')).toBe(
      'http://localhost:3000/api/uploads/2026/08/doc123/original.xlsx'
    )
  })

  it('lança erro se UPLOAD_BASE_URL não estiver configurado', () => {
    delete process.env.UPLOAD_BASE_URL
    expect(() => getUploadPublicUrl('qualquer')).toThrow('UPLOAD_BASE_URL não configurado')
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx jest src/lib/storage.test.ts`
Expected: FAIL — `Cannot find module './storage'`.

- [ ] **Step 3: Criar `src/lib/prisma.ts`**

```ts
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
```

- [ ] **Step 4: Criar `src/lib/storage.ts`**

```ts
import path from 'node:path'

export function buildUploadPath(documentoId: string, extensao: string, data: Date = new Date()): string {
  const ano = String(data.getFullYear())
  const mes = String(data.getMonth() + 1).padStart(2, '0')
  return `${ano}/${mes}/${documentoId}/original.${extensao}`
}

export function getUploadFullPath(relativePath: string): string {
  const uploadDir = process.env.UPLOAD_DIR
  if (!uploadDir) throw new Error('UPLOAD_DIR não configurado')
  return path.join(uploadDir, relativePath)
}

export function getUploadPublicUrl(relativePath: string): string {
  const baseUrl = process.env.UPLOAD_BASE_URL
  if (!baseUrl) throw new Error('UPLOAD_BASE_URL não configurado')
  return `${baseUrl}/${relativePath}`
}
```

- [ ] **Step 5: Rodar o teste e confirmar que passa**

Run: `npx jest src/lib/storage.test.ts`
Expected: PASS (6 testes).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: cliente Prisma singleton e helper de storage"
```

---

### Task 4: `lib/auth.ts` — hash de senha, sessão JWT e leitura do usuário autenticado

**Files:**
- Create: `src/lib/auth.ts`
- Test: `src/lib/auth.test.ts`

**Interfaces:**
- Consumes: `prisma` (Task 3).
- Produces: `AUTH_COOKIE_NAME: string`; `hashSenha(senha: string): Promise<string>`; `verificarSenha(senha: string, hash: string): Promise<boolean>`; `type Role = 'uploader' | 'responsavel' | 'admin'`; `criarSessao(payload: { id: string; role: Role }): Promise<string>`; `verificarSessao(token: string): Promise<{ id: string; role: Role } | null>`; `getAuthUser(request: NextRequest): Promise<{ id: string; nome: string; email: string; role: Role } | null>` — usados pelas rotas de auth (Task 6) e pelo middleware (Task 7).

- [ ] **Step 1: Instalar as dependências de auth**

```bash
npm install bcryptjs jose
npm install --save-dev @types/bcryptjs
```

- [ ] **Step 2: Escrever o teste de `auth.ts`**

Create `src/lib/auth.test.ts`:

```ts
/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'

jest.mock('./prisma', () => ({
  prisma: {
    usuario: {
      findUnique: jest.fn(),
    },
  },
}))

import { prisma } from './prisma'
import {
  hashSenha,
  verificarSenha,
  criarSessao,
  verificarSessao,
  getAuthUser,
  AUTH_COOKIE_NAME,
} from './auth'

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-value-not-for-prod'
})

describe('hashSenha / verificarSenha', () => {
  it('gera um hash que verifica corretamente contra a senha original', async () => {
    const hash = await hashSenha('minhaSenha123')
    expect(hash).not.toBe('minhaSenha123')
    await expect(verificarSenha('minhaSenha123', hash)).resolves.toBe(true)
  })

  it('rejeita uma senha incorreta', async () => {
    const hash = await hashSenha('minhaSenha123')
    await expect(verificarSenha('senhaErrada', hash)).resolves.toBe(false)
  })
})

describe('criarSessao / verificarSessao', () => {
  it('cria um token que verifica de volta pro mesmo payload', async () => {
    const token = await criarSessao({ id: 'user-1', role: 'admin' })
    const payload = await verificarSessao(token)
    expect(payload).toEqual({ id: 'user-1', role: 'admin' })
  })

  it('retorna null para um token inválido', async () => {
    const payload = await verificarSessao('token-invalido')
    expect(payload).toBeNull()
  })
})

describe('getAuthUser', () => {
  it('retorna null quando não há cookie de sessão', async () => {
    const request = new NextRequest('http://localhost/api/qualquer')
    await expect(getAuthUser(request)).resolves.toBeNull()
  })

  it('retorna o usuário quando o cookie tem uma sessão válida', async () => {
    const token = await criarSessao({ id: 'user-1', role: 'admin' })
    ;(prisma.usuario.findUnique as jest.Mock).mockResolvedValue({
      id: 'user-1',
      nome: 'Admin',
      email: 'admin@verai.local',
      role: 'admin',
    })

    const request = new NextRequest('http://localhost/api/qualquer', {
      headers: { cookie: `${AUTH_COOKIE_NAME}=${token}` },
    })

    await expect(getAuthUser(request)).resolves.toEqual({
      id: 'user-1',
      nome: 'Admin',
      email: 'admin@verai.local',
      role: 'admin',
    })
  })
})
```

- [ ] **Step 3: Rodar o teste e confirmar que falha**

Run: `npx jest src/lib/auth.test.ts`
Expected: FAIL — `Cannot find module './auth'`.

- [ ] **Step 4: Criar `src/lib/auth.ts`**

```ts
import { SignJWT, jwtVerify } from 'jose'
import bcrypt from 'bcryptjs'
import type { NextRequest } from 'next/server'
import { prisma } from './prisma'

export const AUTH_COOKIE_NAME = 'token-verai'

function getSecretKey() {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET não configurado')
  return new TextEncoder().encode(secret)
}

export async function hashSenha(senha: string): Promise<string> {
  return bcrypt.hash(senha, 10)
}

export async function verificarSenha(senha: string, hash: string): Promise<boolean> {
  return bcrypt.compare(senha, hash)
}

export type Role = 'uploader' | 'responsavel' | 'admin'

export interface SessaoPayload {
  id: string
  role: Role
}

export async function criarSessao(payload: SessaoPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(getSecretKey())
}

export async function verificarSessao(token: string): Promise<SessaoPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey())
    if (typeof payload.id !== 'string' || typeof payload.role !== 'string') return null
    return { id: payload.id, role: payload.role as Role }
  } catch {
    return null
  }
}

export interface AuthUser {
  id: string
  nome: string
  email: string
  role: Role
}

export async function getAuthUser(request: NextRequest): Promise<AuthUser | null> {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value
  if (!token) return null

  const sessao = await verificarSessao(token)
  if (!sessao) return null

  const usuario = await prisma.usuario.findUnique({
    where: { id: sessao.id },
    select: { id: true, nome: true, email: true, role: true },
  })
  if (!usuario) return null

  return usuario as AuthUser
}
```

- [ ] **Step 5: Rodar o teste e confirmar que passa**

Run: `npx jest src/lib/auth.test.ts`
Expected: PASS (6 testes).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: lib/auth.ts — hash de senha, sessão JWT e getAuthUser"
```

---

### Task 5: Seed de usuário admin

**Files:**
- Create: `prisma/seed.ts`
- Modify: `package.json` (bloco `"prisma": { "seed": ... }` e script `dev:seed`)

**Interfaces:**
- Consumes: `Usuario` (Prisma, Task 2), `bcryptjs` (Task 4).
- Produces: usuário `admin@verai.local` (role `admin`) no banco de desenvolvimento, usado para o primeiro login manual e para os módulos de admin mais adiante.

- [ ] **Step 1: Criar `prisma/seed.ts`**

```ts
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const email = 'admin@verai.local'
  const senha = 'admin123'
  const senhaHash = await bcrypt.hash(senha, 10)

  const admin = await prisma.usuario.upsert({
    where: { email },
    update: {},
    create: { nome: 'Administrador', email, senhaHash, role: 'admin' },
  })

  console.log(`Usuário admin pronto: ${admin.email} (senha: ${senha})`)
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

- [ ] **Step 2: Registrar o seed e o script no `package.json`**

Adicionar, no nível raiz do `package.json` (fora de `"scripts"`):

```json
"prisma": {
  "seed": "tsx prisma/seed.ts"
}
```

Adicionar em `"scripts"`:

```json
"dev:seed": "dotenv -e .env.development -- tsx prisma/seed.ts"
```

- [ ] **Step 3: Rodar o seed**

Run: `npm run dev:seed`
Expected: saída `Usuário admin pronto: admin@verai.local (senha: admin123)`.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: seed do usuário admin de desenvolvimento"
```

---

### Task 6: Rotas de autenticação (`login`, `logout`, `me`)

**Files:**
- Create: `src/app/api/auth/login/route.ts`
- Create: `src/app/api/auth/logout/route.ts`
- Create: `src/app/api/auth/me/route.ts`
- Test: `src/app/api/auth/login/route.test.ts`
- Test: `src/app/api/auth/logout/route.test.ts`
- Test: `src/app/api/auth/me/route.test.ts`

**Interfaces:**
- Consumes: `prisma` (Task 3); `verificarSenha`, `criarSessao`, `getAuthUser`, `AUTH_COOKIE_NAME` (Task 4).
- Produces: `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me` — consumidos pela página de login (Task 8) e pelo middleware (Task 7, que redireciona pra `/login`).

- [ ] **Step 1: Escrever o teste de `login/route.ts`**

Create `src/app/api/auth/login/route.test.ts`:

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
  verificarSenha: jest.fn(),
  criarSessao: jest.fn(),
}))

import { prisma } from '@/lib/prisma'
import { verificarSenha, criarSessao, AUTH_COOKIE_NAME } from '@/lib/auth'
import { POST } from './route'

function buildRequest(body: unknown) {
  return new NextRequest('http://localhost/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

describe('POST /api/auth/login', () => {
  it('retorna 400 se faltar email ou senha', async () => {
    const response = await POST(buildRequest({ email: 'a@b.com' }))
    expect(response.status).toBe(400)
  })

  it('retorna 401 se o usuário não existir', async () => {
    ;(prisma.usuario.findUnique as jest.Mock).mockResolvedValue(null)
    const response = await POST(buildRequest({ email: 'a@b.com', senha: 'x' }))
    expect(response.status).toBe(401)
  })

  it('retorna 401 se a senha estiver errada', async () => {
    ;(prisma.usuario.findUnique as jest.Mock).mockResolvedValue({ senhaHash: 'hash' })
    ;(verificarSenha as jest.Mock).mockResolvedValue(false)
    const response = await POST(buildRequest({ email: 'a@b.com', senha: 'errada' }))
    expect(response.status).toBe(401)
  })

  it('retorna 200 com cookie de sessão quando as credenciais são válidas', async () => {
    ;(prisma.usuario.findUnique as jest.Mock).mockResolvedValue({
      id: 'user-1',
      nome: 'Admin',
      email: 'admin@verai.local',
      role: 'admin',
      senhaHash: 'hash',
    })
    ;(verificarSenha as jest.Mock).mockResolvedValue(true)
    ;(criarSessao as jest.Mock).mockResolvedValue('token-fake')

    const response = await POST(buildRequest({ email: 'admin@verai.local', senha: 'admin123' }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      id: 'user-1',
      nome: 'Admin',
      email: 'admin@verai.local',
      role: 'admin',
    })
    expect(response.cookies.get(AUTH_COOKIE_NAME)?.value).toBe('token-fake')
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx jest src/app/api/auth/login`
Expected: FAIL — `Cannot find module './route'`.

- [ ] **Step 3: Criar `src/app/api/auth/login/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verificarSenha, criarSessao, AUTH_COOKIE_NAME, type Role } from '@/lib/auth'

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const email = body?.email
  const senha = body?.senha

  if (typeof email !== 'string' || typeof senha !== 'string') {
    return NextResponse.json({ error: 'email e senha são obrigatórios' }, { status: 400 })
  }

  const usuario = await prisma.usuario.findUnique({ where: { email } })
  if (!usuario || !(await verificarSenha(senha, usuario.senhaHash))) {
    return NextResponse.json({ error: 'credenciais inválidas' }, { status: 401 })
  }

  const token = await criarSessao({ id: usuario.id, role: usuario.role as Role })

  const response = NextResponse.json({
    id: usuario.id,
    nome: usuario.nome,
    email: usuario.email,
    role: usuario.role,
  })
  response.cookies.set(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 8,
  })
  return response
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx jest src/app/api/auth/login`
Expected: PASS (4 testes).

- [ ] **Step 5: Escrever o teste de `logout/route.ts`**

Create `src/app/api/auth/logout/route.test.ts`:

```ts
/**
 * @jest-environment node
 */
import { AUTH_COOKIE_NAME } from '@/lib/auth'
import { POST } from './route'

describe('POST /api/auth/logout', () => {
  it('limpa o cookie de sessão', async () => {
    const response = await POST()
    expect(response.status).toBe(200)
    expect(response.cookies.get(AUTH_COOKIE_NAME)?.value).toBe('')
  })
})
```

- [ ] **Step 6: Criar `src/app/api/auth/logout/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { AUTH_COOKIE_NAME } from '@/lib/auth'

export async function POST() {
  const response = NextResponse.json({ ok: true })
  response.cookies.set(AUTH_COOKIE_NAME, '', { path: '/', maxAge: 0 })
  return response
}
```

- [ ] **Step 7: Rodar o teste e confirmar que passa**

Run: `npx jest src/app/api/auth/logout`
Expected: PASS (1 teste).

- [ ] **Step 8: Escrever o teste de `me/route.ts`**

Create `src/app/api/auth/me/route.test.ts`:

```ts
/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'

jest.mock('@/lib/auth', () => ({
  ...jest.requireActual('@/lib/auth'),
  getAuthUser: jest.fn(),
}))

import { getAuthUser } from '@/lib/auth'
import { GET } from './route'

describe('GET /api/auth/me', () => {
  it('retorna 401 se não estiver autenticado', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(null)
    const response = await GET(new NextRequest('http://localhost/api/auth/me'))
    expect(response.status).toBe(401)
  })

  it('retorna os dados do usuário autenticado', async () => {
    const usuario = { id: 'user-1', nome: 'Admin', email: 'admin@verai.local', role: 'admin' as const }
    ;(getAuthUser as jest.Mock).mockResolvedValue(usuario)
    const response = await GET(new NextRequest('http://localhost/api/auth/me'))
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual(usuario)
  })
})
```

- [ ] **Step 9: Criar `src/app/api/auth/me/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const usuario = await getAuthUser(request)
  if (!usuario) {
    return NextResponse.json({ error: 'não autenticado' }, { status: 401 })
  }
  return NextResponse.json(usuario)
}
```

- [ ] **Step 10: Rodar o teste e confirmar que passa**

Run: `npx jest src/app/api/auth/me`
Expected: PASS (2 testes).

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat: rotas de autenticação login/logout/me"
```

---

### Task 7: Middleware de proteção de rotas

**Files:**
- Create: `src/middleware.ts`
- Test: `src/middleware.test.ts`

**Interfaces:**
- Consumes: `verificarSessao`, `AUTH_COOKIE_NAME` (Task 4).
- Produces: redirecionamento para `/login` (páginas) ou `401`/`403` (API) em toda rota fora de `/login` e `/api/auth/*`; bloqueio de `/admin/*` e `/api/admin/*` para quem não é `admin`.

- [ ] **Step 1: Escrever o teste do middleware**

Create `src/middleware.test.ts`:

```ts
/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'

jest.mock('@/lib/auth', () => ({
  ...jest.requireActual('@/lib/auth'),
  verificarSessao: jest.fn(),
}))

import { verificarSessao, AUTH_COOKIE_NAME } from '@/lib/auth'
import { middleware } from './middleware'

function buildRequest(pathname: string, cookie?: string) {
  return new NextRequest(new URL(pathname, 'http://localhost'), {
    headers: cookie ? { cookie } : undefined,
  })
}

describe('middleware', () => {
  it('deixa passar /login sem sessão', async () => {
    const response = await middleware(buildRequest('/login'))
    expect(response.status).toBe(200)
  })

  it('redireciona pra /login quando não há sessão em rota protegida', async () => {
    const response = await middleware(buildRequest('/'))
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('http://localhost/login')
  })

  it('retorna 401 em rota de api protegida sem sessão', async () => {
    const response = await middleware(buildRequest('/api/documentos'))
    expect(response.status).toBe(401)
  })

  it('libera rota normal para usuário autenticado não-admin', async () => {
    ;(verificarSessao as jest.Mock).mockResolvedValue({ id: 'user-1', role: 'uploader' })
    const response = await middleware(buildRequest('/', `${AUTH_COOKIE_NAME}=token`))
    expect(response.status).toBe(200)
  })

  it('bloqueia rota /admin pra quem não é admin', async () => {
    ;(verificarSessao as jest.Mock).mockResolvedValue({ id: 'user-1', role: 'uploader' })
    const response = await middleware(buildRequest('/admin/usuarios', `${AUTH_COOKIE_NAME}=token`))
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('http://localhost/')
  })

  it('libera rota /api/admin pra admin', async () => {
    ;(verificarSessao as jest.Mock).mockResolvedValue({ id: 'user-1', role: 'admin' })
    const response = await middleware(buildRequest('/api/admin/usuarios', `${AUTH_COOKIE_NAME}=token`))
    expect(response.status).toBe(200)
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx jest src/middleware.test.ts`
Expected: FAIL — `Cannot find module './middleware'`.

- [ ] **Step 3: Criar `src/middleware.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { verificarSessao, AUTH_COOKIE_NAME } from '@/lib/auth'

const PUBLIC_PATHS = ['/login']
const PUBLIC_API_PREFIXES = ['/api/auth/']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (PUBLIC_PATHS.includes(pathname) || PUBLIC_API_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value
  const sessao = token ? await verificarSessao(token) : null
  const isApi = pathname.startsWith('/api/')

  if (!sessao) {
    if (isApi) {
      return NextResponse.json({ error: 'não autenticado' }, { status: 401 })
    }
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const isAdminRoute = pathname.startsWith('/admin') || pathname.startsWith('/api/admin')
  if (isAdminRoute && sessao.role !== 'admin') {
    if (isApi) {
      return NextResponse.json({ error: 'acesso negado' }, { status: 403 })
    }
    return NextResponse.redirect(new URL('/', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx jest src/middleware.test.ts`
Expected: PASS (6 testes).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: middleware de proteção de rotas por sessão e role"
```

---

### Task 8: Página de login

**Files:**
- Create: `src/app/login/page.tsx`
- Test: `src/app/login/page.test.tsx`

**Interfaces:**
- Consumes: `POST /api/auth/login` (Task 6).
- Produces: tela `/login`, redireciona para `/` após login bem-sucedido.

- [ ] **Step 1: Escrever o teste da página de login**

Create `src/app/login/page.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import LoginPage from './page'

const pushMock = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}))

describe('LoginPage', () => {
  beforeEach(() => {
    pushMock.mockClear()
    global.fetch = jest.fn()
  })

  it('renderiza o formulário de login', () => {
    render(<LoginPage />)
    expect(screen.getByText('VerAI — Login')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('E-mail')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Senha')).toBeInTheDocument()
  })

  it('redireciona para / após login bem-sucedido', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({ ok: true })
    render(<LoginPage />)

    fireEvent.change(screen.getByPlaceholderText('E-mail'), { target: { value: 'admin@verai.local' } })
    fireEvent.change(screen.getByPlaceholderText('Senha'), { target: { value: 'admin123' } })
    fireEvent.click(screen.getByText('Entrar'))

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/'))
  })

  it('mostra mensagem de erro quando o login falha', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({ ok: false })
    render(<LoginPage />)

    fireEvent.change(screen.getByPlaceholderText('E-mail'), { target: { value: 'admin@verai.local' } })
    fireEvent.change(screen.getByPlaceholderText('Senha'), { target: { value: 'errada' } })
    fireEvent.click(screen.getByText('Entrar'))

    await waitFor(() => expect(screen.getByText('Credenciais inválidas')).toBeInTheDocument())
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx jest src/app/login`
Expected: FAIL — `Cannot find module './page'`.

- [ ] **Step 3: Criar `src/app/login/page.tsx`**

```tsx
'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
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
    router.push('/')
  }

  return (
    <main className="flex min-h-screen items-center justify-center">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <h1 className="text-xl font-semibold">VerAI — Login</h1>
        <input
          type="email"
          placeholder="E-mail"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="w-full rounded border p-2"
          required
        />
        <input
          type="password"
          placeholder="Senha"
          value={senha}
          onChange={(event) => setSenha(event.target.value)}
          className="w-full rounded border p-2"
          required
        />
        {erro && <p className="text-sm text-red-600">{erro}</p>}
        <button type="submit" className="w-full rounded bg-black p-2 text-white">
          Entrar
        </button>
      </form>
    </main>
  )
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx jest src/app/login`
Expected: PASS (3 testes).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: página de login"
```

---

### Task 9: Páginas esqueleto do dashboard

**Files:**
- Create: `src/app/page.tsx` (listagem)
- Create: `src/app/documentos/[id]/page.tsx`
- Create: `src/app/notificacoes/page.tsx`
- Create: `src/app/admin/usuarios/page.tsx`
- Create: `src/app/admin/regras-notificacao/page.tsx`
- Test: `src/app/dashboard-skeleton.test.tsx`

**Interfaces:**
- Consumes: nenhuma (páginas estáticas, sem lógica de dados ainda — módulos 3–6 preenchem o conteúdo).
- Produces: as 5 rotas de página do dashboard existem e renderizam um estado "em construção".

- [ ] **Step 1: Escrever o teste das páginas esqueleto**

Create `src/app/dashboard-skeleton.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import DashboardPage from './page'
import DocumentoDetalhePage from './documentos/[id]/page'
import NotificacoesPage from './notificacoes/page'
import AdminUsuariosPage from './admin/usuarios/page'
import AdminRegrasNotificacaoPage from './admin/regras-notificacao/page'

describe('páginas esqueleto do dashboard', () => {
  it('renderiza a listagem de documentos', () => {
    render(<DashboardPage />)
    expect(screen.getByText('Documentos')).toBeInTheDocument()
  })

  it('renderiza a página de detalhe do documento com o id da rota', async () => {
    const element = await DocumentoDetalhePage({ params: Promise.resolve({ id: 'doc-1' }) })
    render(element)
    expect(screen.getByText('Documento doc-1')).toBeInTheDocument()
  })

  it('renderiza a página de notificações', () => {
    render(<NotificacoesPage />)
    expect(screen.getByText('Notificações')).toBeInTheDocument()
  })

  it('renderiza a página de usuários do admin', () => {
    render(<AdminUsuariosPage />)
    expect(screen.getByText('Usuários')).toBeInTheDocument()
  })

  it('renderiza a página de regras de notificação do admin', () => {
    render(<AdminRegrasNotificacaoPage />)
    expect(screen.getByText('Regras de notificação')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx jest src/app/dashboard-skeleton.test.tsx`
Expected: FAIL — módulos das páginas ainda não existem.

- [ ] **Step 3: Substituir `src/app/page.tsx` (gerado pelo scaffold) pela listagem**

```tsx
export default function DashboardPage() {
  return (
    <main className="p-8">
      <h1 className="text-xl font-semibold">Documentos</h1>
      <p className="text-sm text-muted-foreground">Listagem em construção.</p>
    </main>
  )
}
```

- [ ] **Step 4: Criar `src/app/documentos/[id]/page.tsx`**

```tsx
export default async function DocumentoDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return (
    <main className="p-8">
      <h1 className="text-xl font-semibold">Documento {id}</h1>
      <p className="text-sm text-muted-foreground">Visualização em construção.</p>
    </main>
  )
}
```

- [ ] **Step 5: Criar `src/app/notificacoes/page.tsx`**

```tsx
export default function NotificacoesPage() {
  return (
    <main className="p-8">
      <h1 className="text-xl font-semibold">Notificações</h1>
      <p className="text-sm text-muted-foreground">Em construção.</p>
    </main>
  )
}
```

- [ ] **Step 6: Criar `src/app/admin/usuarios/page.tsx`**

```tsx
export default function AdminUsuariosPage() {
  return (
    <main className="p-8">
      <h1 className="text-xl font-semibold">Usuários</h1>
      <p className="text-sm text-muted-foreground">Em construção.</p>
    </main>
  )
}
```

- [ ] **Step 7: Criar `src/app/admin/regras-notificacao/page.tsx`**

```tsx
export default function AdminRegrasNotificacaoPage() {
  return (
    <main className="p-8">
      <h1 className="text-xl font-semibold">Regras de notificação</h1>
      <p className="text-sm text-muted-foreground">Em construção.</p>
    </main>
  )
}
```

- [ ] **Step 8: Rodar o teste e confirmar que passa**

Run: `npx jest src/app/dashboard-skeleton.test.tsx`
Expected: PASS (5 testes).

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: páginas esqueleto do dashboard"
```

---

### Task 10: Rotas stub de API dos módulos 3–8 (`501`)

**Files:**
- Create: `src/lib/not-implemented.ts`
- Create: `src/app/api/documentos/route.ts`
- Create: `src/app/api/documentos/[id]/route.ts`
- Create: `src/app/api/documentos/[id]/original/route.ts`
- Create: `src/app/api/documentos/[id]/relatorio/route.ts`
- Create: `src/app/api/documentos/[id]/reprocessar/route.ts`
- Create: `src/app/api/notificacoes/route.ts`
- Create: `src/app/api/admin/usuarios/route.ts`
- Create: `src/app/api/admin/regras-notificacao/route.ts`
- Test: `src/app/api/stub-routes.test.ts`

**Interfaces:**
- Produces: `notImplemented(): NextResponse` (`src/lib/not-implemented.ts`) e os handlers HTTP de cada rota acima, todos retornando `501` — a serem substituídos pela lógica real nos módulos 3–8.

- [ ] **Step 1: Criar `src/lib/not-implemented.ts`**

```ts
import { NextResponse } from 'next/server'

export function notImplemented() {
  return NextResponse.json({ error: 'ainda não implementado' }, { status: 501 })
}
```

- [ ] **Step 2: Criar `src/app/api/documentos/route.ts`**

```ts
import { notImplemented } from '@/lib/not-implemented'

export async function GET() {
  return notImplemented()
}

export async function POST() {
  return notImplemented()
}
```

- [ ] **Step 3: Criar `src/app/api/documentos/[id]/route.ts`**

```ts
import { notImplemented } from '@/lib/not-implemented'

export async function GET() {
  return notImplemented()
}
```

- [ ] **Step 4: Criar `src/app/api/documentos/[id]/original/route.ts`**

```ts
import { notImplemented } from '@/lib/not-implemented'

export async function GET() {
  return notImplemented()
}
```

- [ ] **Step 5: Criar `src/app/api/documentos/[id]/relatorio/route.ts`**

```ts
import { notImplemented } from '@/lib/not-implemented'

export async function GET() {
  return notImplemented()
}
```

- [ ] **Step 6: Criar `src/app/api/documentos/[id]/reprocessar/route.ts`**

```ts
import { notImplemented } from '@/lib/not-implemented'

export async function POST() {
  return notImplemented()
}
```

- [ ] **Step 7: Criar `src/app/api/notificacoes/route.ts`**

```ts
import { notImplemented } from '@/lib/not-implemented'

export async function GET() {
  return notImplemented()
}

export async function PATCH() {
  return notImplemented()
}
```

- [ ] **Step 8: Criar `src/app/api/admin/usuarios/route.ts`**

```ts
import { notImplemented } from '@/lib/not-implemented'

export async function GET() {
  return notImplemented()
}

export async function POST() {
  return notImplemented()
}

export async function PATCH() {
  return notImplemented()
}

export async function DELETE() {
  return notImplemented()
}
```

- [ ] **Step 9: Criar `src/app/api/admin/regras-notificacao/route.ts`**

```ts
import { notImplemented } from '@/lib/not-implemented'

export async function GET() {
  return notImplemented()
}

export async function POST() {
  return notImplemented()
}

export async function PATCH() {
  return notImplemented()
}

export async function DELETE() {
  return notImplemented()
}
```

- [ ] **Step 10: Escrever o teste que cobre todas as rotas stub**

Create `src/app/api/stub-routes.test.ts`:

```ts
/**
 * @jest-environment node
 */
import * as documentos from '@/app/api/documentos/route'
import * as documentoDetalhe from '@/app/api/documentos/[id]/route'
import * as documentoOriginal from '@/app/api/documentos/[id]/original/route'
import * as documentoRelatorio from '@/app/api/documentos/[id]/relatorio/route'
import * as documentoReprocessar from '@/app/api/documentos/[id]/reprocessar/route'
import * as notificacoes from '@/app/api/notificacoes/route'
import * as adminUsuarios from '@/app/api/admin/usuarios/route'
import * as adminRegras from '@/app/api/admin/regras-notificacao/route'

const rotas: Array<[string, () => Promise<Response>]> = [
  ['GET /api/documentos', documentos.GET],
  ['POST /api/documentos', documentos.POST],
  ['GET /api/documentos/[id]', documentoDetalhe.GET],
  ['GET /api/documentos/[id]/original', documentoOriginal.GET],
  ['GET /api/documentos/[id]/relatorio', documentoRelatorio.GET],
  ['POST /api/documentos/[id]/reprocessar', documentoReprocessar.POST],
  ['GET /api/notificacoes', notificacoes.GET],
  ['PATCH /api/notificacoes', notificacoes.PATCH],
  ['GET /api/admin/usuarios', adminUsuarios.GET],
  ['POST /api/admin/usuarios', adminUsuarios.POST],
  ['PATCH /api/admin/usuarios', adminUsuarios.PATCH],
  ['DELETE /api/admin/usuarios', adminUsuarios.DELETE],
  ['GET /api/admin/regras-notificacao', adminRegras.GET],
  ['POST /api/admin/regras-notificacao', adminRegras.POST],
  ['PATCH /api/admin/regras-notificacao', adminRegras.PATCH],
  ['DELETE /api/admin/regras-notificacao', adminRegras.DELETE],
]

describe('rotas stub retornam 501', () => {
  it.each(rotas)('%s retorna 501', async (_nome, handler) => {
    const response = await handler()
    expect(response.status).toBe(501)
  })
})
```

- [ ] **Step 11: Rodar o teste e confirmar que passa**

Run: `npx jest src/app/api/stub-routes.test.ts`
Expected: PASS (16 testes).

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "feat: rotas stub 501 dos módulos 3-8"
```

---

### Task 11: Camada de IA — `lib/ia/analisar.ts`

**Files:**
- Create: `src/lib/ia/analisar.ts`
- Test: `src/lib/ia/analisar.test.ts`

**Interfaces:**
- Consumes: variáveis de ambiente `AI_PROVIDER`, `AI_API_KEY`, `AI_MODEL`.
- Produces: `analisarDocumento(conteudoExtraido: string, promptVersion: string): Promise<{ resumo: string; pontosCriticos: Array<{ texto: string; severidade: 'alto' | 'medio' | 'baixo' }>; pontosPositivos: Array<{ texto: string }>; metricasChave?: Array<{ label: string; valor: string }>; promptVersion: string }>` — será chamada pelo módulo de ingestão (módulo 3, fora deste plano) depois de extrair o conteúdo do documento.

- [ ] **Step 1: Instalar as dependências da camada de IA**

```bash
npm install ai zod @ai-sdk/anthropic
```

- [ ] **Step 2: Escrever o teste de `analisar.ts`**

Create `src/lib/ia/analisar.test.ts`:

```ts
/**
 * @jest-environment node
 */
jest.mock('ai', () => ({
  generateObject: jest.fn(),
}))
jest.mock('@ai-sdk/anthropic', () => ({
  anthropic: jest.fn(() => 'modelo-mock'),
}))

import { generateObject } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { analisarDocumento } from './analisar'

describe('analisarDocumento', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.AI_PROVIDER = 'anthropic'
    process.env.AI_API_KEY = 'chave-fake'
    process.env.AI_MODEL = 'modelo-fake'
  })

  it('chama generateObject com o modelo do provedor configurado e devolve a análise com a versão do prompt', async () => {
    ;(generateObject as jest.Mock).mockResolvedValue({
      object: {
        resumo: 'resumo gerado',
        pontosCriticos: [{ texto: 'ponto crítico', severidade: 'alto' }],
        pontosPositivos: [{ texto: 'ponto positivo' }],
        metricasChave: [{ label: 'linhas', valor: '120' }],
      },
    })

    const resultado = await analisarDocumento('conteúdo extraído do documento', 'v1')

    expect(anthropic).toHaveBeenCalledWith('modelo-fake', { apiKey: 'chave-fake' })
    expect(generateObject).toHaveBeenCalledWith(expect.objectContaining({ model: 'modelo-mock' }))
    expect(resultado).toEqual({
      resumo: 'resumo gerado',
      pontosCriticos: [{ texto: 'ponto crítico', severidade: 'alto' }],
      pontosPositivos: [{ texto: 'ponto positivo' }],
      metricasChave: [{ label: 'linhas', valor: '120' }],
      promptVersion: 'v1',
    })
  })

  it('lança erro quando AI_PROVIDER não é suportado', async () => {
    process.env.AI_PROVIDER = 'desconhecido'
    await expect(analisarDocumento('conteúdo', 'v1')).rejects.toThrow(
      'AI_PROVIDER "desconhecido" não suportado'
    )
  })
})
```

- [ ] **Step 3: Rodar o teste e confirmar que falha**

Run: `npx jest src/lib/ia/analisar.test.ts`
Expected: FAIL — `Cannot find module './analisar'`.

- [ ] **Step 4: Criar `src/lib/ia/analisar.ts`**

```ts
import { generateObject } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { z } from 'zod'

const schema = z.object({
  resumo: z.string(),
  pontosCriticos: z.array(
    z.object({
      texto: z.string(),
      severidade: z.enum(['alto', 'medio', 'baixo']),
    })
  ),
  pontosPositivos: z.array(z.object({ texto: z.string() })),
  metricasChave: z.array(z.object({ label: z.string(), valor: z.string() })).optional(),
})

function montarPrompt(conteudoExtraido: string): string {
  return [
    'Você é um analista que revisa documentos internos e produz um relatório estruturado.',
    'Com base no conteúdo extraído do documento abaixo, gere um resumo executivo,',
    'os pontos críticos, os pontos positivos e, quando fizer sentido, métricas-chave.',
    '',
    'Conteúdo extraído:',
    conteudoExtraido,
  ].join('\n')
}

function getModel() {
  switch (process.env.AI_PROVIDER) {
    case 'anthropic':
      return anthropic(process.env.AI_MODEL!, { apiKey: process.env.AI_API_KEY })
    default:
      throw new Error(`AI_PROVIDER "${process.env.AI_PROVIDER}" não suportado`)
  }
}

export async function analisarDocumento(conteudoExtraido: string, promptVersion: string) {
  const { object } = await generateObject({
    model: getModel(),
    schema,
    prompt: montarPrompt(conteudoExtraido),
  })
  return { ...object, promptVersion }
}
```

- [ ] **Step 5: Rodar o teste e confirmar que passa**

Run: `npx jest src/lib/ia/analisar.test.ts`
Expected: PASS (2 testes).

- [ ] **Step 6: Rodar a suíte completa de testes do projeto**

Run: `npm test`
Expected: todos os testes de todas as tasks passam (PASS em todos os arquivos).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: camada de IA — analisarDocumento com Vercel AI SDK"
```

---

## Verificação final

Depois da Task 11, subir o app localmente e confirmar o fluxo ponta a ponta:

1. `npm run dev:db:up && npm run dev:migrate && npm run dev:seed`
2. `npm run dev`
3. Acessar `http://localhost:3000/` sem sessão → redireciona para `/login`.
4. Logar com `admin@verai.local` / `admin123` → redireciona para `/`, mostra "Documentos — Listagem em construção".
5. Acessar `/admin/usuarios` logado como admin → mostra a página; deslogar e tentar de novo (ou usar um usuário sem role admin) → redireciona pra `/`.
6. `npm test` → suíte completa verde.
