# "Relatórios" como nome da solução no menu — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Renomear o vocabulário do menu e do breadcrumb de "Análise de Documentos" para "Relatórios" (e "Clientes" para "Relatórios dos clientes" no item do menu), e dar à página `/clientes` uma forma própria de cadastrar cliente pra quem é admin, sem depender de `/admin/clientes`.

**Architecture:** Mudanças de texto/label em componentes React client-side já existentes (`src/components/nav-bar.tsx`, `src/app/clientes/page.tsx`, `src/app/clientes/[id]/page.tsx`, `src/app/clientes/[id]/[competencia]/page.tsx`). A criação de cliente em `/clientes` reaproveita o endpoint `POST /api/admin/clientes` que já existe e já é protegido pelo middleware — nenhuma rota nova, nenhuma mudança de schema/API. O botão "Novo cliente" segue o mesmo padrão de toggle já usado em `clientes/[id]/page.tsx` pro botão "Nova competência" (botão abre um card de formulário, com botão de fechar quando já há conteúdo na lista).

**Tech Stack:** Next.js 15 (App Router, client components), React 19, TypeScript, Tailwind CSS v4, Jest + Testing Library (`jsdom`).

## Global Constraints

- Vocabulário visível ao usuário usa "Relatórios" no lugar de "Análise de Documentos" (cabeçalho de seção da sidebar e primeiro segmento do breadcrumb). O segmento seguinte do breadcrumb continua dizendo "Clientes" (não muda, mesmo com o item do menu virando "Relatórios dos clientes") — evita redundância `Relatórios › Relatórios dos clientes › ...`.
- `src/app/clientes/[id]/page.tsx` tem, além da mudança deste plano, um diff pendente e não commitado (redesign dos cards de competência, não relacionado a este trabalho). A implementação deve tocar **somente** a linha do breadcrumb nesse arquivo (Task 3), preservando o restante do diff pendente intocado e fora do commit desta feature — ver procedimento de isolamento na Task 3.
- `POST /api/admin/clientes` não muda — aceita só `{ nome }`, já protegido por `role === 'admin'` no middleware. Reaproveitar como está.
- `/admin/clientes` não muda — mesclar e excluir cliente continuam exclusivos de lá.
- Commits não incluem `Co-Authored-By` nem qualquer menção a Claude — o repositório é público.

---

### Task 1: Sidebar — cabeçalho de seção e item "Clientes" viram "Relatórios"

**Files:**
- Modify: `src/components/nav-bar.tsx:24` (array `TOP_LINKS`)
- Modify: `src/components/nav-bar.tsx:165-167` (cabeçalho de seção)
- Modify: `src/components/nav-bar.test.tsx:39` (assert existente)

**Interfaces:**
- Consumes: nada novo.
- Produces: nada consumido por outras tasks.

- [ ] **Step 1: Escrever os testes que falham**

Em `src/components/nav-bar.test.tsx`, dentro do `describe('NavBar', ...)`, troque a asserção existente (linha 39) de:

```tsx
  it('renderiza os links de topo para qualquer usuário', () => {
    render(<NavBar />)
    expect(screen.getByRole('link', { name: 'Clientes' })).toHaveAttribute('href', '/clientes')
    expect(screen.getByRole('link', { name: 'Todos os documentos' })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: 'Notificações' })).toHaveAttribute('href', '/notificacoes')
  })
```

para:

```tsx
  it('renderiza os links de topo para qualquer usuário', () => {
    render(<NavBar />)
    expect(screen.getByRole('link', { name: 'Relatórios dos clientes' })).toHaveAttribute('href', '/clientes')
    expect(screen.getByRole('link', { name: 'Todos os documentos' })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: 'Notificações' })).toHaveAttribute('href', '/notificacoes')
  })

  it('usa "Relatórios" como cabeçalho de seção, não mais "Análise de Documentos"', () => {
    render(<NavBar />)
    expect(screen.getByText('Relatórios')).toBeInTheDocument()
    expect(screen.queryByText('Análise de Documentos')).not.toBeInTheDocument()
  })
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npm test -- src/components/nav-bar.test.tsx`
Expected: FAIL — não encontra link `Relatórios dos clientes` nem texto `Relatórios`

- [ ] **Step 3: Renomear o item do menu e o cabeçalho de seção**

`src/components/nav-bar.tsx:24`, de:

```tsx
const TOP_LINKS = [
  { href: '/clientes', label: 'Clientes', icon: Building2 },
  { href: '/', label: 'Todos os documentos', icon: FileText },
  { href: '/notificacoes', label: 'Notificações', icon: Bell },
]
```

para:

```tsx
const TOP_LINKS = [
  { href: '/clientes', label: 'Relatórios dos clientes', icon: Building2 },
  { href: '/', label: 'Todos os documentos', icon: FileText },
  { href: '/notificacoes', label: 'Notificações', icon: Bell },
]
```

`src/components/nav-bar.tsx:165-167`, de:

```tsx
        {expandida && (
          <span className="px-2.5 pt-1 pb-1 text-[0.65rem] font-semibold tracking-wide text-white/35 uppercase">
            Análise de Documentos
          </span>
        )}
```

para:

```tsx
        {expandida && (
          <span className="px-2.5 pt-1 pb-1 text-[0.65rem] font-semibold tracking-wide text-white/35 uppercase">
            Relatórios
          </span>
        )}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npm test -- src/components/nav-bar.test.tsx`
Expected: PASS em todos os testes do arquivo

- [ ] **Step 5: Commit**

```bash
git add src/components/nav-bar.tsx src/components/nav-bar.test.tsx
git commit -m "feat: menu lateral usa vocabulario Relatorios"
```

---

### Task 2: Página `/clientes` — título, e "+ Novo cliente" pra admin

**Files:**
- Modify: `src/app/clientes/page.tsx` (reescrita completa)
- Modify: `src/app/clientes/page.test.tsx` (reescrita completa)

**Interfaces:**
- Consumes: `POST /api/admin/clientes` (aceita `{ nome: string }`, retorna `201` com o cliente criado ou erro `{ error: string }`), `GET /api/auth/me` (retorna `{ id, nome, email, role }` ou `401`).
- Produces: nada consumido por outras tasks.

- [ ] **Step 1: Escrever os testes que falham**

Substitua todo o conteúdo de `src/app/clientes/page.test.tsx` por:

```tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import ClientesPage from './page'

function mockFetch(options: {
  role: 'admin' | 'usuario' | null
  clientes?: Array<{ id: string; nome: string }>
  criarOk?: boolean
  criarErro?: string
}) {
  const { role, clientes = [], criarOk = true, criarErro = 'Falha ao criar cliente.' } = options
  global.fetch = jest.fn((url: RequestInfo | URL, init?: RequestInit) => {
    const u = String(url)
    if (u === '/api/clientes') {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(clientes) }) as unknown as Promise<Response>
    }
    if (u === '/api/auth/me') {
      return Promise.resolve({
        ok: role !== null,
        json: () => Promise.resolve(role ? { id: 'u1', role } : null),
      }) as unknown as Promise<Response>
    }
    if (u === '/api/admin/clientes' && init?.method === 'POST') {
      if (!criarOk) {
        return Promise.resolve({
          ok: false,
          json: () => Promise.resolve({ error: criarErro }),
        }) as unknown as Promise<Response>
      }
      return Promise.resolve({
        ok: true,
        status: 201,
        json: () => Promise.resolve({ id: 'novo-1', nome: 'Prefeitura Y' }),
      }) as unknown as Promise<Response>
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve(null) }) as unknown as Promise<Response>
  }) as jest.Mock
}

describe('ClientesPage', () => {
  it('usa font-semibold no título (não font-bold) e o nome "Relatórios dos clientes"', async () => {
    mockFetch({ role: 'usuario', clientes: [{ id: 'c1', nome: 'Prefeitura X' }] })
    render(<ClientesPage />)
    const heading = await screen.findByRole('heading', { name: 'Relatórios dos clientes' })
    expect(heading).toHaveClass('font-semibold')
    expect(heading).not.toHaveClass('font-bold')
  })

  it('não-admin não vê o botão "Novo cliente"', async () => {
    mockFetch({ role: 'usuario', clientes: [{ id: 'c1', nome: 'Prefeitura X' }] })
    render(<ClientesPage />)
    await screen.findByRole('heading', { name: 'Relatórios dos clientes' })
    expect(screen.queryByRole('button', { name: 'Novo cliente' })).not.toBeInTheDocument()
  })

  it('admin vê o botão "Novo cliente", abre o formulário e cria com sucesso', async () => {
    mockFetch({ role: 'admin', clientes: [{ id: 'c1', nome: 'Prefeitura X' }] })
    render(<ClientesPage />)

    const botao = await screen.findByRole('button', { name: 'Novo cliente' })
    fireEvent.click(botao)

    const input = await screen.findByLabelText('Nome')
    fireEvent.change(input, { target: { value: 'Prefeitura Y' } })
    fireEvent.click(screen.getByRole('button', { name: 'Criar cliente' }))

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/admin/clientes',
        expect.objectContaining({ method: 'POST', body: JSON.stringify({ nome: 'Prefeitura Y' }) })
      )
    )
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Fechar' })).not.toBeInTheDocument())
  })

  it('mostra erro inline quando a criação falha', async () => {
    mockFetch({
      role: 'admin',
      clientes: [{ id: 'c1', nome: 'Prefeitura X' }],
      criarOk: false,
      criarErro: 'já existe um cliente com esse nome',
    })
    render(<ClientesPage />)

    fireEvent.click(await screen.findByRole('button', { name: 'Novo cliente' }))
    fireEvent.change(await screen.findByLabelText('Nome'), { target: { value: 'Prefeitura X' } })
    fireEvent.click(screen.getByRole('button', { name: 'Criar cliente' }))

    expect(await screen.findByText('já existe um cliente com esse nome')).toBeInTheDocument()
  })

  it('lista vazia + admin mostra o formulário direto, sem o texto de pedir a um admin', async () => {
    mockFetch({ role: 'admin', clientes: [] })
    render(<ClientesPage />)

    expect(await screen.findByLabelText('Nome')).toBeInTheDocument()
    expect(screen.queryByText(/Peça a um admin/)).not.toBeInTheDocument()
  })

  it('lista vazia + não-admin continua mostrando o texto de pedir a um admin, sem formulário', async () => {
    mockFetch({ role: 'usuario', clientes: [] })
    render(<ClientesPage />)

    expect(await screen.findByText(/Peça a um admin/)).toBeInTheDocument()
    expect(screen.queryByLabelText('Nome')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npm test -- src/app/clientes/page.test.tsx`
Expected: FAIL em todos os testes novos — a página ainda não busca `/api/auth/me`, não tem botão "Novo cliente" nem formulário, e o título ainda é "Clientes"

- [ ] **Step 3: Reescrever `src/app/clientes/page.tsx`**

Substitua todo o conteúdo do arquivo por:

```tsx
'use client'

import { useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { ChevronRight, Loader2, Inbox, Plus, AlertCircle, X } from 'lucide-react'
import { BTN_PRIMARY, BTN_OUTLINE, INPUT_BASE } from '@/lib/ui'

interface Cliente {
  id: string
  nome: string
}

interface UsuarioLogado {
  id: string
  role: string
}

function FormularioNovoCliente({
  nome,
  onChangeNome,
  onSubmit,
  erro,
  aoFechar,
}: {
  nome: string
  onChangeNome: (valor: string) => void
  onSubmit: (event: FormEvent) => void
  erro: string | null
  aoFechar?: () => void
}) {
  return (
    <form onSubmit={onSubmit} className="flex w-full flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs font-medium text-mid-grey">Nome</span>
        <input
          type="text"
          value={nome}
          onChange={(e) => onChangeNome(e.target.value)}
          required
          className={INPUT_BASE}
        />
      </label>
      <button type="submit" className={BTN_PRIMARY}>
        <Plus className="size-3.5" strokeWidth={2.25} />
        Criar cliente
      </button>
      {aoFechar && (
        <button
          type="button"
          onClick={aoFechar}
          aria-label="Fechar"
          className="ml-auto flex items-center gap-1 text-sm font-medium text-mid-grey hover:text-navy"
        >
          <X className="size-4" strokeWidth={2.25} />
        </button>
      )}
      {erro && (
        <p className="flex w-full items-center gap-1.5 rounded-lg bg-red-crit-light px-3 py-2 text-sm text-red-crit">
          <AlertCircle className="size-4 shrink-0" strokeWidth={2.25} />
          {erro}
        </p>
      )}
    </form>
  )
}

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [carregando, setCarregando] = useState(true)
  const [usuario, setUsuario] = useState<UsuarioLogado | null>(null)
  const [abrirFormulario, setAbrirFormulario] = useState(false)
  const [nome, setNome] = useState('')
  const [erro, setErro] = useState<string | null>(null)

  async function carregar() {
    const response = await fetch('/api/clientes')
    if (response.ok) setClientes(await response.json())
  }

  useEffect(() => {
    carregar().finally(() => setCarregando(false))
  }, [])

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then(setUsuario)
      .catch(() => {})
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
    setAbrirFormulario(false)
    carregar()
  }

  const ehAdmin = usuario?.role === 'admin'

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-6 py-8 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <span className="text-xs font-semibold tracking-wide text-orange uppercase">Painel</span>
          <h1 className="text-[1.75rem] leading-tight font-semibold tracking-tight text-navy">
            Relatórios dos clientes
          </h1>
        </div>

        {ehAdmin && !abrirFormulario && clientes.length > 0 && (
          <button
            onClick={() => {
              setErro(null)
              setAbrirFormulario(true)
            }}
            className={BTN_OUTLINE}
          >
            <Plus className="size-3.5" strokeWidth={2.25} />
            Novo cliente
          </button>
        )}
      </div>

      {ehAdmin && abrirFormulario && clientes.length > 0 && (
        <div className="card">
          <FormularioNovoCliente
            nome={nome}
            onChangeNome={setNome}
            onSubmit={handleCriar}
            erro={erro}
            aoFechar={() => {
              setErro(null)
              setAbrirFormulario(false)
            }}
          />
        </div>
      )}

      {carregando ? (
        <p className="flex items-center gap-2 text-sm text-mid-grey">
          <Loader2 className="size-4 animate-spin" strokeWidth={2.25} />
          Carregando...
        </p>
      ) : clientes.length === 0 ? (
        ehAdmin ? (
          <div className="card-flush flex flex-col items-center gap-3 p-10 text-center">
            <span className="flex size-11 items-center justify-center rounded-full bg-light-grey text-mid-grey">
              <Inbox className="size-5" strokeWidth={1.75} />
            </span>
            <p className="text-sm text-mid-grey">Nenhum cliente cadastrado ainda.</p>
            <div className="w-full max-w-sm">
              <FormularioNovoCliente nome={nome} onChangeNome={setNome} onSubmit={handleCriar} erro={erro} />
            </div>
          </div>
        ) : (
          <div className="card-flush flex flex-col items-center gap-2 p-10 text-center">
            <span className="flex size-11 items-center justify-center rounded-full bg-light-grey text-mid-grey">
              <Inbox className="size-5" strokeWidth={1.75} />
            </span>
            <p className="text-sm text-mid-grey">
              Nenhum cliente disponível. Peça a um admin pra cadastrar em /admin/clientes e liberar acesso.
            </p>
          </div>
        )
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {clientes.map((cliente) => (
            <li key={cliente.id}>
              <Link
                href={`/clientes/${cliente.id}`}
                className="card card-interactive group flex items-center gap-3"
              >
                <span className="flex-1 text-sm font-semibold text-navy">{cliente.nome}</span>
                <ChevronRight
                  className="size-4 text-mid-grey transition-transform group-hover:translate-x-0.5 group-hover:text-orange"
                  strokeWidth={2.25}
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npm test -- src/app/clientes/page.test.tsx`
Expected: PASS em todos os testes do arquivo

- [ ] **Step 5: Commit**

```bash
git add src/app/clientes/page.tsx src/app/clientes/page.test.tsx
git commit -m "feat: pagina /clientes vira Relatorios dos clientes com criacao de cliente pra admin"
```

---

### Task 3: Breadcrumb dentro do cliente vira "Relatórios"

**Files:**
- Modify: `src/app/clientes/[id]/[competencia]/page.tsx:336`
- Modify: `src/app/clientes/[id]/[competencia]/page.test.tsx:65` (e descrição do teste)
- Modify: `src/app/clientes/[id]/page.tsx:120` (**somente esta linha** — o arquivo tem um diff pendente não relacionado; ver Step 4)
- Modify: `src/app/clientes/[id]/page.test.tsx:53` (e descrição do teste)

**Interfaces:**
- Consumes: nada novo.
- Produces: nada consumido por outras tasks.

- [ ] **Step 1: Escrever os testes que falham**

Em `src/app/clientes/[id]/[competencia]/page.test.tsx`, troque (por volta da linha 60-66):

```tsx
  it('mostra "Análise de Documentos" como raiz do breadcrumb, antes de Clientes e do cliente', async () => {
    mockFetchCompetencia()
    renderPagina()
    await screen.findByRole('heading', { name: 'Agosto/2026' })

    expect(screen.getByText('Análise de Documentos')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Clientes' })).toHaveAttribute('href', '/clientes')
    expect(screen.getByRole('link', { name: 'Prefeitura X' })).toHaveAttribute('href', '/clientes/cliente-1')
  })
```

por:

```tsx
  it('mostra "Relatórios" como raiz do breadcrumb, antes de Clientes e do cliente', async () => {
    mockFetchCompetencia()
    renderPagina()
    await screen.findByRole('heading', { name: 'Agosto/2026' })

    expect(screen.getByText('Relatórios')).toBeInTheDocument()
    expect(screen.queryByText('Análise de Documentos')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Clientes' })).toHaveAttribute('href', '/clientes')
    expect(screen.getByRole('link', { name: 'Prefeitura X' })).toHaveAttribute('href', '/clientes/cliente-1')
  })
```

Em `src/app/clientes/[id]/page.test.tsx`, troque (por volta da linha 49-55):

```tsx
  it('mostra "Análise de Documentos" como raiz do breadcrumb, antes de Clientes', async () => {
    await renderPagina()
    await screen.findByRole('heading', { name: 'Prefeitura X' })

    expect(screen.getByText('Análise de Documentos')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Clientes' })).toHaveAttribute('href', '/clientes')
  })
```

por:

```tsx
  it('mostra "Relatórios" como raiz do breadcrumb, antes de Clientes', async () => {
    await renderPagina()
    await screen.findByRole('heading', { name: 'Prefeitura X' })

    expect(screen.getByText('Relatórios')).toBeInTheDocument()
    expect(screen.queryByText('Análise de Documentos')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Clientes' })).toHaveAttribute('href', '/clientes')
  })
```

- [ ] **Step 2: Rodar os dois arquivos de teste e confirmar que falham**

Run: `npm test -- "src/app/clientes/[id]/[competencia]/page.test.tsx" "src/app/clientes/[id]/page.test.tsx"`
Expected: FAIL nos dois testes alterados — ainda mostram "Análise de Documentos"

- [ ] **Step 3: Implementar em `clientes/[id]/[competencia]/page.tsx` (arquivo sem diff pendente — direto)**

Linha 336, de:

```tsx
          <span>Análise de Documentos</span>
```

para:

```tsx
          <span>Relatórios</span>
```

- [ ] **Step 4: Isolar o diff pendente antes de mexer em `clientes/[id]/page.tsx`**

Esse arquivo tem mudanças não commitadas e não relacionadas a este trabalho (redesign dos cards de competência). Pra commitar só a linha do breadcrumb sem misturar com esse diff pendente, guarda ele num stash antes de editar:

Run: `git stash push -m "wip: redesign cards de competencia (nao relacionado)" -- "src/app/clientes/[id]/page.tsx"`
Expected: comando conclui e `git diff -- "src/app/clientes/[id]/page.tsx"` não mostra mais nenhuma alteração (arquivo volta a bater com o último commit)

- [ ] **Step 5: Implementar em `clientes/[id]/page.tsx`**

Com o arquivo agora limpo (igual ao HEAD), linha 120 (o `<nav>` de breadcrumb é o mesmo de antes, já que o stash não mexeu nele — só reverteu o resto), de:

```tsx
            <span>Análise de Documentos</span>
```

para:

```tsx
            <span>Relatórios</span>
```

- [ ] **Step 6: Rodar os dois arquivos de teste e confirmar que passam**

Run: `npm test -- "src/app/clientes/[id]/[competencia]/page.test.tsx" "src/app/clientes/[id]/page.test.tsx"`
Expected: PASS em todos os testes de ambos os arquivos

- [ ] **Step 7: Commit**

```bash
git add "src/app/clientes/[id]/[competencia]/page.tsx" "src/app/clientes/[id]/[competencia]/page.test.tsx" "src/app/clientes/[id]/page.tsx" "src/app/clientes/[id]/page.test.tsx"
git commit -m "feat: breadcrumb do cliente usa vocabulario Relatorios"
```

- [ ] **Step 8: Restaurar o diff pendente de `clientes/[id]/page.tsx`**

Run: `git stash pop`
Expected: aplica de volta sem conflito (o stash não tocava a linha do breadcrumb, que já está commitada agora). Confirme com `git status` que `src/app/clientes/[id]/page.tsx` volta a aparecer como modificado — só que agora **sem** a linha do breadcrumb no diff (ela já bate com o HEAD novo).

Se o `git stash pop` reportar conflito (não esperado, mas por segurança): resolva mantendo a linha do breadcrumb como `<span>Relatórios</span>` e todo o restante do diff pendente como estava antes do Step 4, depois `git stash drop` se o pop tiver deixado o stash na lista por causa do conflito.

---

### Task 4: Verificação final

**Files:** nenhum (só validação).

**Interfaces:** nenhuma.

- [ ] **Step 1: Rodar a suíte de testes completa**

Run: `npm test`
Expected: todos os testes passam, incluindo os novos/alterados nas Tasks 1-3

- [ ] **Step 2: Rodar o lint**

Run: `npm run lint`
Expected: sem erros

- [ ] **Step 3: Rodar o build de produção**

Run: `npm run build`
Expected: build conclui sem erro

- [ ] **Step 4: Confirmar que o diff pendente de `clientes/[id]/page.tsx` continua intacto e não commitado**

Run: `git log --oneline -3 -- "src/app/clientes/[id]/page.tsx"` e `git diff -- "src/app/clientes/[id]/page.tsx"`
Expected: o commit da Task 3 aparece no log tocando só a linha do breadcrumb; o `git diff` ainda mostra pendente o redesign dos cards de competência (não commitado), exatamente como estava antes deste plano começar.

- [ ] **Step 5: Verificação visual manual**

Rodar `npm run dev`, logar como admin, e conferir:

- Sidebar mostra "Relatórios" como cabeçalho de seção e "Relatórios dos clientes" como label do link (Task 1)
- `/clientes` mostra o título "Relatórios dos clientes", o botão "Novo cliente" (admin) abre o formulário, criar funciona e recarrega a lista (Task 2)
- Com a lista de clientes vazia (ambiente de teste sem cliente), admin vê o formulário direto, sem o texto de pedir a outro admin (Task 2)
- Breadcrumb dentro de `/clientes/[id]` e `/clientes/[id]/[competencia]` começa com "Relatórios" (Task 3)

Não há checkbox de "passou"/"falhou" automatizado pra este step — é confirmação visual do humano que está rodando o plano.

- [ ] **Step 6: Nenhum commit neste passo — Task 4 é só verificação sobre os commits já feitos nas Tasks 1-3.**
