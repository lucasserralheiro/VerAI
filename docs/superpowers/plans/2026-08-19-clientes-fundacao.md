# Clientes — Fundação (Plano 1/5) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduzir a entidade `Cliente`, a permissão de usuário por cliente, e reestruturar `metricasChave` para números reais — sem quebrar nenhum fluxo hoje existente (upload/análise/relatório de documento continuam funcionando).

**Architecture:** Aditivo ao schema Prisma (`Cliente` + relação N:N com `Usuario`, sem tocar em `Documento` ainda — isso é o Plano 2). Segue exatamente os padrões já usados em `/admin/usuarios` e `/admin/regras-notificacao` (rota REST simples + página client-component com fetch). `metricasChave` muda de `{ label, valor }` pra `{ label, valorNumerico, unidade, valorExibicao }` na camada de IA — único ponto do sistema que produz esse shape.

**Tech Stack:** Next.js 15 App Router, Prisma + PostgreSQL, Zod, Jest + Testing Library.

## Global Constraints

- Nenhuma variação/comparação numérica é calculada pela IA — sempre em código (regra do spec, vale a partir do Plano 3, mas o shape de dado que viabiliza isso nasce aqui).
- Sem testes automatizados para rotas/páginas novas (mesma linha dos módulos 3-8 do VerAI) — só os arquivos que já tinham teste (`lib/ia/analisar.ts`) mantêm teste, atualizado pro novo shape.
- Todo texto de UI/erro em português, seguindo o vocabulário já usado no projeto (`"não autenticado"`, `"acesso negado"`, etc.).
- Convenção de commit: `git commit -m "tipo: descrição"` em português, terminando com `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.

---

### Task 1: Schema — `Cliente` + `Usuario.clientesPermitidos`

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Produces: model `Cliente { id, nome, createdAt, usuariosPermitidos }`; `Usuario.clientesPermitidos: Cliente[]`

- [ ] **Step 1: Editar o schema**

Em `prisma/schema.prisma`, adicionar o campo `clientesPermitidos` dentro do model `Usuario` (depois de `acessos`):

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

E adicionar, ao final do arquivo, o novo model:

```prisma
model Cliente {
  id                 String    @id @default(cuid())
  nome               String    @unique
  createdAt          DateTime  @default(now())
  usuariosPermitidos Usuario[] @relation("UsuarioClientes")
}
```

- [ ] **Step 2: Gerar e rodar a migration**

Requer o banco local rodando (`npm run dev:db:up`, se ainda não estiver). Rodar:

```bash
npx dotenv -e .env.development -- npx prisma migrate dev --name cliente_e_permissoes
```

Expected: cria `prisma/migrations/<timestamp>_cliente_e_permissoes/`, aplica no banco local, regenera o Prisma Client sem erro.

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat: entidade Cliente e permissão de usuário por cliente

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: `lib/visibilidade.ts` — filtro/checagem de cliente

**Files:**
- Modify: `src/lib/visibilidade.ts`

**Interfaces:**
- Consumes: `AuthUser` de `src/lib/auth.ts` (`{ id, nome, email, role }`), `prisma` de `src/lib/prisma.ts`
- Produces: `clientesVisiveisWhere(usuario): Promise<Prisma.ClienteWhereInput>`, `podeVerCliente(usuario, clienteId): Promise<boolean>` — usados pelos Planos 2 e 5. `documentosVisiveisWhere`/`podeVerDocumento` não mudam de assinatura aqui (ganham o filtro de cliente no Plano 2, quando `Documento.clienteId` existir).

- [ ] **Step 1: Adicionar as funções**

No topo do arquivo, junto da função privada `regrasQueBatemComUsuario`, adicionar:

```ts
async function clienteIdsPermitidos(usuario: AuthUser): Promise<string[] | null> {
  // null = sem restrição (admin vê todos os clientes)
  if (usuario.role === 'admin') return null

  const registro = await prisma.usuario.findUnique({
    where: { id: usuario.id },
    select: { clientesPermitidos: { select: { id: true } } },
  })
  return (registro?.clientesPermitidos ?? []).map((c) => c.id)
}
```

E, ao final do arquivo, exportar:

```ts
export async function clientesVisiveisWhere(usuario: AuthUser): Promise<Prisma.ClienteWhereInput> {
  const ids = await clienteIdsPermitidos(usuario)
  return ids === null ? {} : { id: { in: ids } }
}

export async function podeVerCliente(usuario: AuthUser, clienteId: string): Promise<boolean> {
  const ids = await clienteIdsPermitidos(usuario)
  return ids === null || ids.includes(clienteId)
}
```

- [ ] **Step 2: Verificar tipagem**

Run: `npx tsc --noEmit`
Expected: sem erros novos relacionados a `visibilidade.ts` (o projeto já usa `Prisma` importado no topo do arquivo).

- [ ] **Step 3: Commit**

```bash
git add src/lib/visibilidade.ts
git commit -m "feat: clientesVisiveisWhere e podeVerCliente em lib/visibilidade

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: `GET`/`POST /api/admin/clientes`

**Files:**
- Create: `src/app/api/admin/clientes/route.ts`

**Interfaces:**
- Consumes: `prisma` de `@/lib/prisma`
- Produces: `GET` → `Array<{ id, nome, createdAt }>`; `POST { nome }` → `{ id, nome, createdAt }` (`201`) ou `{ error }` (`400`/`409`)

- [ ] **Step 1: Implementar a rota**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const clientes = await prisma.cliente.findMany({
    orderBy: { nome: 'asc' },
    select: { id: true, nome: true, createdAt: true },
  })
  return NextResponse.json(clientes)
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const nome = typeof body?.nome === 'string' ? body.nome.trim() : ''

  if (!nome) {
    return NextResponse.json({ error: '"nome" é obrigatório' }, { status: 400 })
  }

  try {
    const cliente = await prisma.cliente.create({
      data: { nome },
      select: { id: true, nome: true, createdAt: true },
    })
    return NextResponse.json(cliente, { status: 201 })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ error: 'já existe um cliente com esse nome' }, { status: 409 })
    }
    throw error
  }
}
```

Nota: sem checagem de auth/role explícita aqui — `middleware.ts` já bloqueia `/api/admin/*` pra quem não é admin (seção 8 do design de setup base), mesmo padrão de `src/app/api/admin/usuarios/route.ts`.

- [ ] **Step 2: Verificar manualmente**

Com o servidor de dev rodando (`npm run dev`) e logado como admin (seed já cria `admin@verai.local` / `admin123`):

```bash
curl -X POST http://localhost:3000/api/admin/clientes -H "Content-Type: application/json" -H "Cookie: token-verai=<token da sessão>" -d '{"nome":"SEGES"}'
curl http://localhost:3000/api/admin/clientes -H "Cookie: token-verai=<token da sessão>"
```

Expected: `POST` retorna `201` com o cliente criado; `GET` lista `SEGES`; criar `SEGES` de novo retorna `409`.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/admin/clientes/route.ts
git commit -m "feat: rota GET/POST /api/admin/clientes

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Página `/admin/clientes`

**Files:**
- Create: `src/app/admin/clientes/page.tsx`
- Modify: `src/components/nav-bar.tsx`
- Modify: `src/components/nav-bar.test.tsx`

**Interfaces:**
- Consumes: `GET`/`POST /api/admin/clientes` (Task 3)

- [ ] **Step 1: Criar a página**

```tsx
'use client'

import { useEffect, useState, type FormEvent } from 'react'

interface Cliente {
  id: string
  nome: string
  createdAt: string
}

export default function AdminClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [nome, setNome] = useState('')
  const [erro, setErro] = useState<string | null>(null)

  async function carregar() {
    const response = await fetch('/api/admin/clientes')
    if (response.ok) {
      setClientes(await response.json())
    }
  }

  useEffect(() => {
    carregar()
  }, [])

  async function handleCriar(event: FormEvent) {
    event.preventDefault()
    setErro(null)
    const response = await fetch('/api/admin/clientes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome }),
    })
    if (!response.ok) {
      const body = await response.json().catch(() => null)
      setErro(body?.error ?? 'Falha ao criar cliente.')
      return
    }
    setNome('')
    carregar()
  }

  return (
    <main className="space-y-6 p-8">
      <h1 className="text-xl font-semibold">Clientes</h1>

      <form onSubmit={handleCriar} className="flex flex-wrap items-end gap-3 text-sm">
        <label className="flex flex-col gap-1">
          Nome
          <input
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            required
            className="rounded border p-1"
          />
        </label>
        <button type="submit" className="rounded bg-black px-3 py-1.5 text-white">
          Criar cliente
        </button>
        {erro && <span className="text-sm text-red-600">{erro}</span>}
      </form>

      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b">
            <th className="py-2">Nome</th>
            <th>Criado em</th>
          </tr>
        </thead>
        <tbody>
          {clientes.map((cliente) => (
            <tr key={cliente.id} className="border-b">
              <td className="py-2">{cliente.nome}</td>
              <td>{new Date(cliente.createdAt).toLocaleDateString('pt-BR')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  )
}
```

- [ ] **Step 2: Adicionar ao nav bar**

Em `src/components/nav-bar.tsx`, no array `LINKS`, adicionar uma entrada depois de `'/admin/usuarios'`:

```ts
const LINKS = [
  { href: '/', label: 'Documentos' },
  { href: '/notificacoes', label: 'Notificações' },
  { href: '/admin/usuarios', label: 'Usuários' },
  { href: '/admin/clientes', label: 'Gerenciar clientes' },
  { href: '/admin/regras-notificacao', label: 'Regras de notificação' },
]
```

- [ ] **Step 3: Atualizar o teste do nav bar**

Em `src/components/nav-bar.test.tsx`, no teste `'renderiza um link para cada página do dashboard'`, adicionar a asserção:

```ts
    expect(screen.getByRole('link', { name: 'Gerenciar clientes' })).toHaveAttribute(
      'href',
      '/admin/clientes'
    )
```//adicionar logo após a asserção de `'Usuários'`.

- [ ] **Step 4: Rodar os testes**

Run: `npm test -- nav-bar.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/clientes/page.tsx src/components/nav-bar.tsx src/components/nav-bar.test.tsx
git commit -m "feat: página /admin/clientes e link no nav bar

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: `PATCH /api/admin/usuarios` — `clientesPermitidos`

**Files:**
- Modify: `src/app/api/admin/usuarios/route.ts`

**Interfaces:**
- Produces: `GET` agora inclui `clientesPermitidos: Array<{ id, nome }>` por usuário; `PATCH` aceita `clientesPermitidos: string[]` opcional no body (substitui a lista inteira, não faz merge).

- [ ] **Step 1: Atualizar `GET` e `PATCH`**

Em `src/app/api/admin/usuarios/route.ts`, trocar o `select` do `GET`:

```ts
export async function GET() {
  const usuarios = await prisma.usuario.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      nome: true,
      email: true,
      role: true,
      createdAt: true,
      clientesPermitidos: { select: { id: true, nome: true } },
    },
  })
  return NextResponse.json(usuarios)
}
```

E o `PATCH`:

```ts
export async function PATCH(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const id = body?.id
  if (typeof id !== 'string') {
    return NextResponse.json({ error: '"id" é obrigatório' }, { status: 400 })
  }

  const { nome, email, role, senha, clientesPermitidos } = body

  const usuario = await prisma.usuario.update({
    where: { id },
    data: {
      ...(nome ? { nome } : {}),
      ...(email ? { email } : {}),
      ...(role ? { role } : {}),
      ...(senha ? { senhaHash: await hashSenha(senha) } : {}),
      ...(Array.isArray(clientesPermitidos)
        ? { clientesPermitidos: { set: clientesPermitidos.map((clienteId: string) => ({ id: clienteId })) } }
        : {}),
    },
    select: {
      id: true,
      nome: true,
      email: true,
      role: true,
      createdAt: true,
      clientesPermitidos: { select: { id: true, nome: true } },
    },
  })

  return NextResponse.json(usuario)
}
```

O `POST` continua igual (criação sem `clientesPermitidos` por ora — atribuição acontece via `PATCH` na página, Task 6).

- [ ] **Step 2: Verificar manualmente**

```bash
curl http://localhost:3000/api/admin/usuarios -H "Cookie: token-verai=<token>"
curl -X PATCH http://localhost:3000/api/admin/usuarios -H "Content-Type: application/json" -H "Cookie: token-verai=<token>" -d '{"id":"<usuarioId>","clientesPermitidos":["<clienteId>"]}'
```

Expected: `GET` mostra `clientesPermitidos: []` por padrão; `PATCH` com um `clienteId` válido atualiza e o `GET` seguinte mostra o cliente na lista.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/admin/usuarios/route.ts
git commit -m "feat: PATCH /api/admin/usuarios aceita clientesPermitidos

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: Página `/admin/usuarios` — atribuir clientes

**Files:**
- Modify: `src/app/admin/usuarios/page.tsx`

**Interfaces:**
- Consumes: `GET/POST/PATCH /api/admin/usuarios` (Task 5), `GET /api/admin/clientes` (Task 3)

- [ ] **Step 1: Substituir o arquivo inteiro**

```tsx
'use client'

import { useEffect, useState, type FormEvent } from 'react'

interface Cliente {
  id: string
  nome: string
}

interface Usuario {
  id: string
  nome: string
  email: string
  role: string
  createdAt: string
  clientesPermitidos: Cliente[]
}

export default function AdminUsuariosPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [role, setRole] = useState('uploader')
  const [clientesSelecionados, setClientesSelecionados] = useState<string[]>([])
  const [edicoes, setEdicoes] = useState<Record<string, string[]>>({})

  async function carregar() {
    const [usuariosResponse, clientesResponse] = await Promise.all([
      fetch('/api/admin/usuarios'),
      fetch('/api/admin/clientes'),
    ])
    if (usuariosResponse.ok) {
      const lista: Usuario[] = await usuariosResponse.json()
      setUsuarios(lista)
      setEdicoes(Object.fromEntries(lista.map((u) => [u.id, u.clientesPermitidos.map((c) => c.id)])))
    }
    if (clientesResponse.ok) {
      setClientes(await clientesResponse.json())
    }
  }

  useEffect(() => {
    carregar()
  }, [])

  function toggleSelecionado(lista: string[], id: string): string[] {
    return lista.includes(id) ? lista.filter((x) => x !== id) : [...lista, id]
  }

  async function handleCriar(event: FormEvent) {
    event.preventDefault()
    await fetch('/api/admin/usuarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome, email, senha, role }),
    })
    setNome('')
    setEmail('')
    setSenha('')
    setRole('uploader')
    setClientesSelecionados([])
    carregar()
  }

  async function handleExcluir(id: string) {
    await fetch(`/api/admin/usuarios?id=${id}`, { method: 'DELETE' })
    carregar()
  }

  async function handleSalvarClientes(id: string) {
    await fetch('/api/admin/usuarios', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, clientesPermitidos: edicoes[id] ?? [] }),
    })
    carregar()
  }

  return (
    <main className="space-y-6 p-8">
      <h1 className="text-xl font-semibold">Usuários</h1>

      <form onSubmit={handleCriar} className="flex flex-wrap items-end gap-3 text-sm">
        <label className="flex flex-col gap-1">
          Nome
          <input
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            required
            className="rounded border p-1"
          />
        </label>
        <label className="flex flex-col gap-1">
          E-mail
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="rounded border p-1"
          />
        </label>
        <label className="flex flex-col gap-1">
          Senha
          <input
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            required
            className="rounded border p-1"
          />
        </label>
        <label className="flex flex-col gap-1">
          Perfil
          <select value={role} onChange={(e) => setRole(e.target.value)} className="rounded border p-1">
            <option value="uploader">Uploader</option>
            <option value="responsavel">Responsável</option>
            <option value="admin">Admin</option>
          </select>
        </label>
        <button type="submit" className="rounded bg-black px-3 py-1.5 text-white">
          Criar usuário
        </button>
      </form>
      <p className="text-xs text-muted-foreground">
        Clientes permitidos são atribuídos depois de criar o usuário, na tabela abaixo.
      </p>

      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b">
            <th className="py-2">Nome</th>
            <th>E-mail</th>
            <th>Perfil</th>
            <th>Clientes permitidos</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          {usuarios.map((usuario) => (
            <tr key={usuario.id} className="border-b align-top">
              <td className="py-2">{usuario.nome}</td>
              <td>{usuario.email}</td>
              <td>{usuario.role}</td>
              <td>
                {usuario.role === 'admin' ? (
                  <span className="text-xs text-muted-foreground">Todos (admin)</span>
                ) : (
                  <>
                    <div className="flex max-w-xs flex-wrap gap-2">
                      {clientes.map((cliente) => (
                        <label key={cliente.id} className="flex items-center gap-1 text-xs">
                          <input
                            type="checkbox"
                            checked={(edicoes[usuario.id] ?? []).includes(cliente.id)}
                            onChange={() =>
                              setEdicoes({
                                ...edicoes,
                                [usuario.id]: toggleSelecionado(edicoes[usuario.id] ?? [], cliente.id),
                              })
                            }
                          />
                          {cliente.nome}
                        </label>
                      ))}
                    </div>
                    <button
                      onClick={() => handleSalvarClientes(usuario.id)}
                      className="mt-1 text-blue-600 hover:underline"
                    >
                      Salvar clientes
                    </button>
                  </>
                )}
              </td>
              <td>
                <button onClick={() => handleExcluir(usuario.id)} className="text-red-600 hover:underline">
                  Excluir
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  )
}
```

Nota: `clientesSelecionados`/`setClientesSelecionados` do formulário de criação ficam sem uso nesta versão (atribuição é só via tabela, pós-criação) — remover o `useState` correspondente pra não sobrar variável não usada:

- [ ] **Step 2: Remover o state não usado**

Apagar a linha `const [clientesSelecionados, setClientesSelecionados] = useState<string[]>([])` e a linha `setClientesSelecionados([])` dentro de `handleCriar`.

- [ ] **Step 3: Verificar lint e build**

Run: `npm run lint && npm run build`
Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/usuarios/page.tsx
git commit -m "feat: atribuir clientes permitidos a um usuário em /admin/usuarios

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 7: `metricasChave` estruturado na camada de IA

**Files:**
- Modify: `src/lib/ia/analisar.ts`
- Modify: `src/lib/ia/analisar.test.ts`

**Interfaces:**
- Produces: `metricasChave: Array<{ label: string; valorNumerico: number | null; unidade: string | null; valorExibicao: string }> | null` — usado por `Analise.metricasChave` (Prisma `Json?`, sem mudança de coluna) e, futuramente, pelas Tasks de cálculo determinístico dos Planos 3/4.

- [ ] **Step 1: Atualizar o teste primeiro**

Em `src/lib/ia/analisar.test.ts`, trocar o mock/expectativa de `metricasChave` no primeiro teste (`'chama generateObject...'`):

```ts
    ;(generateObject as jest.Mock).mockResolvedValue({
      object: {
        resumo: 'resumo gerado',
        pontosCriticos: [{ texto: 'ponto crítico', severidade: 'alto' }],
        pontosPositivos: [{ texto: 'ponto positivo' }],
        metricasChave: [
          { label: 'linhas', valorNumerico: 120, unidade: null, valorExibicao: '120' },
        ],
      },
    })

    const resultado = await analisarDocumento('conteúdo extraído do documento', 'v1')

    expect(createAnthropic).toHaveBeenCalledWith({ apiKey: 'chave-fake' })
    expect(modeloFactoryMock).toHaveBeenCalledWith('modelo-fake')
    expect(generateObject).toHaveBeenCalledWith(expect.objectContaining({ model: 'modelo-mock' }))
    expect(resultado).toEqual({
      resumo: 'resumo gerado',
      pontosCriticos: [{ texto: 'ponto crítico', severidade: 'alto' }],
      pontosPositivos: [{ texto: 'ponto positivo' }],
      metricasChave: [
        { label: 'linhas', valorNumerico: 120, unidade: null, valorExibicao: '120' },
      ],
      promptVersion: 'v1',
    })
```

Os outros três testes (`vertex`, `google`, `groq`) já usam `metricasChave: null` — não precisam mudar.

- [ ] **Step 2: Rodar e confirmar que ainda passa**

Run: `npm test -- analisar.test.ts`
Expected: PASS — o teste não falha porque o schema Zod ainda não mudou, `generateObject` está mockado (não valida contra o schema de verdade neste teste). Este passo confirma a base antes da mudança de schema/prompt.

- [ ] **Step 3: Atualizar o schema Zod**

Em `src/lib/ia/analisar.ts`, trocar:

```ts
  metricasChave: z.array(z.object({ label: z.string(), valor: z.string() })).nullable(),
```

por:

```ts
  metricasChave: z
    .array(
      z.object({
        label: z.string(),
        valorNumerico: z.number().nullable(),
        unidade: z.string().nullable(),
        valorExibicao: z.string(),
      })
    )
    .nullable(),
```

- [ ] **Step 4: Atualizar o prompt**

No array retornado por `montarPrompt`, trocar o bloco do item 4 (MÉTRICAS-CHAVE):

```ts
    '4. MÉTRICAS-CHAVE: calcule e liste as métricas numéricas mais relevantes que',
    '   dá pra derivar do conteúdo (totais, médias, proporções, contagens,',
    '   comparações) — não repita as estatísticas óbvias se já vieram prontas no',
    '   texto extraído, sintetize o que importa pra decisão.',
```

por:

```ts
    '4. MÉTRICAS-CHAVE: liste as métricas numéricas mais relevantes presentes no',
    '   conteúdo extraído (totais, médias, proporções, contagens já calculadas no',
    '   texto). Para cada uma, informe "valorNumerico" com o número exatamente',
    '   como aparece no texto extraído — nunca estime, arredonde ou invente um',
    '   valor que não esteja lá; se não houver um número exato pra essa métrica,',
    '   deixe "valorNumerico" null e descreva só em "valorExibicao". Preencha',
    '   "unidade" quando fizer sentido (ex: "BRL", "%", "GB", null se não houver)',
    '   e "valorExibicao" formatado como deve aparecer pro leitor (ex:',
    '   "R$ 11.200,00").',
```

- [ ] **Step 5: Rodar os testes de novo**

Run: `npm test -- analisar.test.ts`
Expected: PASS (schema mudou, mas o teste mocka `generateObject` diretamente — não passa pelo `parse` do Zod).

- [ ] **Step 6: Commit**

```bash
git add src/lib/ia/analisar.ts src/lib/ia/analisar.test.ts
git commit -m "feat: metricasChave estruturado (valorNumerico real, sem a IA calcular)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 8: Atualizar consumidores de `metricasChave` (PDF + página de detalhe)

**Files:**
- Modify: `src/lib/pdf/RelatorioDocument.tsx`
- Modify: `src/app/documentos/[id]/page.tsx`

**Interfaces:**
- Consumes: novo shape de `metricasChave` da Task 7

- [ ] **Step 1: Atualizar `RelatorioDocument.tsx`**

Trocar a linha:

```ts
  const metricasChave = (analise.metricasChave as Array<{ label: string; valor: string }> | null) ?? []
```

por:

```ts
  const metricasChave =
    (analise.metricasChave as Array<{ label: string; valorExibicao: string }> | null) ?? []
```

E, no bloco de renderização das métricas, trocar `<Text style={styles.tabelaValor}>{metrica.valor}</Text>` por `<Text style={styles.tabelaValor}>{metrica.valorExibicao}</Text>`.

- [ ] **Step 2: Atualizar `documentos/[id]/page.tsx`**

Trocar a interface:

```ts
interface MetricaChave {
  label: string
  valor: string
}
```

por:

```ts
interface MetricaChave {
  label: string
  valorNumerico: number | null
  unidade: string | null
  valorExibicao: string
}
```

E, na tabela de métricas-chave, trocar `<td className="py-1">{metrica.valor}</td>` por `<td className="py-1">{metrica.valorExibicao}</td>`.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: sem erros de tipo.

- [ ] **Step 4: Verificação manual ponta a ponta**

Com `npm run dev` rodando: subir um Excel/PDF de teste pela tela `/` (upload ainda está lá — muda só no Plano 2), abrir `/documentos/[id]` e confirmar que a seção "Métricas-chave" mostra `valorExibicao` normalmente, e baixar o relatório PDF pra confirmar que a tabela de métricas também aparece certa.

- [ ] **Step 5: Commit**

```bash
git add src/lib/pdf/RelatorioDocument.tsx src/app/documentos/[id]/page.tsx
git commit -m "fix: RelatorioDocument e página de detalhe usam metrica.valorExibicao

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Verificação final do plano

- [ ] `npm test` — todos os testes passam (incluindo `analisar.test.ts` e `nav-bar.test.tsx` atualizados)
- [ ] `npm run build` — build limpo
- [ ] Manual: criar um cliente em `/admin/clientes`, atribuí-lo a um usuário `uploader` em `/admin/usuarios`, confirmar via `GET /api/admin/usuarios` que `clientesPermitidos` reflete a atribuição
- [ ] Manual: fluxo de upload/análise/relatório em `/` continua funcionando de ponta a ponta, agora com métricas mostrando `valorExibicao`
