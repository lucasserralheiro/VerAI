# Reorganização da NavBar (Configuração) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agrupar os 3 links administrativos da `NavBar` (Usuários, Gerenciar clientes, Regras de notificação) dentro de uma seção accordion "Configuração", mantendo Clientes, Todos os documentos e Notificações soltos no topo para qualquer usuário logado.

**Architecture:** Um único componente (`src/components/nav-bar.tsx`) muda de uma lista plana de links para dois grupos (`TOP_LINKS` sempre visível, `CONFIG_LINKS` dentro de um accordion visível só para admin). O estado `configAberta` é recalculado a cada mudança de `pathname` (aberto se a rota atual for uma das 3 rotas admin, fechado caso contrário) e também pode ser alternado manualmente pelo clique no botão "Configuração". Nenhuma mudança de backend, API ou schema — é puramente front-end, um arquivo de componente + seu teste.

**Tech Stack:** Next.js (App Router) + React + TypeScript, Tailwind CSS, `lucide-react` para ícones, Jest + Testing Library para testes.

## Global Constraints

- Notificações **não** entra em Configuração — continua item de topo, visível a qualquer usuário logado (não só admin), independente da reorganização.
- A seção Configuração só é renderizada quando `role === 'admin'` (mesma regra hoje aplicada aos itens `adminOnly`).
- O accordion não persiste estado em `localStorage` — é recalculado a partir de `pathname` a cada mount/navegação.
- Com a sidebar recolhida (modo só ícones), clicar no ícone de Configuração deve expandir a sidebar inteira (reaproveitando a mesma lógica de `expandida`/`NAV_EXPANDIDA_KEY` já existente) e abrir o accordion num único clique — não existe popover/flyout separado.
- Rótulos e rotas dos 6 links não mudam: Clientes (`/clientes`), Todos os documentos (`/`), Notificações (`/notificacoes`), Usuários (`/admin/usuarios`), Gerenciar clientes (`/admin/clientes`), Regras de notificação (`/admin/regras-notificacao`).

---

### Task 1: Restructure NavBar into top links + "Configuração" accordion

**Files:**
- Modify: `src/components/nav-bar.tsx`
- Test: `src/components/nav-bar.test.tsx`

**Interfaces:**
- Consumes: nothing new — same `usePathname`/`useRouter` from `next/navigation`, same `/api/auth/me` and `/api/notificacoes` fetches, same `cn` helper from `@/lib/utils`.
- Produces: `NavBar` export unchanged in signature (no props). No other file imports internals of `nav-bar.tsx`, so nothing downstream is affected.

Note: the current test file has a pre-existing broken assertion (`getByRole('link', { name: 'Documentos' })` — the actual label is `'Todos os documentos'`) and never properly mocks `/api/auth/me`'s `.json()`, so admin-only links currently render only because the fetch silently fails and `role` stays whatever passes the assertions incidentally. This task replaces the whole test file with a fetch mock that correctly distinguishes URLs, fixing that pre-existing breakage as part of the rewrite.

- [ ] **Step 1: Replace the test file with the full new suite (will fail against the old component)**

Replace the full contents of `src/components/nav-bar.test.tsx` with:

```tsx
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react'
import { NavBar } from './nav-bar'

const pushMock = jest.fn()
let pathnameMock = '/'
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
  usePathname: () => pathnameMock,
}))

function mockFetch(role: 'admin' | 'usuario' | null) {
  global.fetch = jest.fn((url: RequestInfo | URL) => {
    if (url === '/api/auth/me') {
      return Promise.resolve({
        ok: role !== null,
        json: () => Promise.resolve(role ? { role } : null),
      }) as unknown as Promise<Response>
    }
    if (url === '/api/notificacoes') {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve([]),
      }) as unknown as Promise<Response>
    }
    return Promise.resolve({ ok: true }) as unknown as Promise<Response>
  }) as jest.Mock
}

describe('NavBar', () => {
  beforeEach(() => {
    pushMock.mockClear()
    pathnameMock = '/'
    mockFetch('admin')
  })

  it('renderiza os links de topo para qualquer usuário', () => {
    render(<NavBar />)
    expect(screen.getByRole('link', { name: 'Clientes' })).toHaveAttribute('href', '/clientes')
    expect(screen.getByRole('link', { name: 'Todos os documentos' })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: 'Notificações' })).toHaveAttribute('href', '/notificacoes')
  })

  it('não mostra a seção Configuração para quem não é admin', async () => {
    mockFetch('usuario')
    render(<NavBar />)
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/auth/me'))
    await act(async () => {})
    expect(screen.queryByRole('button', { name: 'Configuração' })).not.toBeInTheDocument()
  })

  it('mostra a seção Configuração fechada por padrão para admin em rota não-admin', async () => {
    render(<NavBar />)
    const botao = await screen.findByRole('button', { name: 'Configuração' })
    expect(botao).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('link', { name: 'Usuários' })).not.toBeInTheDocument()
  })

  it('abre a seção Configuração automaticamente quando a rota atual é uma página admin', async () => {
    pathnameMock = '/admin/usuarios'
    render(<NavBar />)
    const botao = await screen.findByRole('button', { name: 'Configuração' })
    expect(botao).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('link', { name: 'Usuários' })).toHaveAttribute('href', '/admin/usuarios')
    expect(screen.getByRole('link', { name: 'Gerenciar clientes' })).toHaveAttribute('href', '/admin/clientes')
    expect(screen.getByRole('link', { name: 'Regras de notificação' })).toHaveAttribute(
      'href',
      '/admin/regras-notificacao'
    )
  })

  it('alterna a seção Configuração ao clicar, com a barra expandida', async () => {
    render(<NavBar />)
    const botao = await screen.findByRole('button', { name: 'Configuração' })

    fireEvent.click(botao)
    expect(botao).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('link', { name: 'Usuários' })).toBeInTheDocument()

    fireEvent.click(botao)
    expect(botao).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('link', { name: 'Usuários' })).not.toBeInTheDocument()
  })

  it('com a barra recolhida, clicar em Configuração expande a barra e abre a seção', async () => {
    render(<NavBar />)
    fireEvent.click(screen.getByRole('button', { name: 'Recolher menu' }))

    const botaoConfig = await screen.findByRole('button', { name: 'Configuração' })
    fireEvent.click(botaoConfig)

    expect(screen.getByRole('button', { name: 'Recolher menu' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Usuários' })).toHaveAttribute('href', '/admin/usuarios')
  })

  it('faz logout e redireciona para /login ao clicar em Sair', async () => {
    render(<NavBar />)
    fireEvent.click(screen.getByText('Sair'))

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/auth/logout', { method: 'POST' }))
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/login'))
  })

  it('não renderiza nada na tela de login', () => {
    pathnameMock = '/login'
    const { container } = render(<NavBar />)
    expect(container).toBeEmptyDOMElement()
  })
})
```

- [ ] **Step 2: Run the suite to confirm it fails against the current component**

Run: `npx jest src/components/nav-bar.test.tsx`
Expected: multiple FAIL — e.g. no `button` with name `Configuração` exists yet, `aria-expanded` attribute doesn't exist, sublinks render unconditionally instead of behind the accordion.

- [ ] **Step 3: Replace `src/components/nav-bar.tsx` with the restructured component**

Replace the full contents of `src/components/nav-bar.tsx` with:

```tsx
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  FileSearch,
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
} from 'lucide-react'
import { cn } from '@/lib/utils'

const TOP_LINKS = [
  { href: '/clientes', label: 'Clientes', icon: Building2 },
  { href: '/', label: 'Todos os documentos', icon: FileText },
  { href: '/notificacoes', label: 'Notificações', icon: Bell },
]

const CONFIG_LINKS = [
  { href: '/admin/usuarios', label: 'Usuários', icon: UserCog },
  { href: '/admin/clientes', label: 'Gerenciar clientes', icon: Users },
  { href: '/admin/regras-notificacao', label: 'Regras de notificação', icon: BellRing },
]

const NAV_EXPANDIDA_KEY = 'verai:nav-expandida'
const LARGURA_MINIMA_EXPANDIDA = 640 // px — abaixo disso a barra sempre abre só com ícones

export function NavBar() {
  const pathname = usePathname()
  const router = useRouter()
  const [naoLidas, setNaoLidas] = useState(0)
  const [role, setRole] = useState<string | null>(null)
  // Por padrão a barra já mostra ícone + nome — nada fica escondido atrás de hover.
  // Recolher é uma ação explícita de quem quer mais espaço de tela.
  const [expandida, setExpandida] = useState(true)
  const [configAberta, setConfigAberta] = useState(false)

  const naLoginPage = pathname === '/login'

  useEffect(() => {
    if (naLoginPage) return
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((usuario: { role: string } | null) => setRole(usuario?.role ?? null))
      .catch(() => {})
  }, [naLoginPage])

  useEffect(() => {
    if (pathname === '/login') return
    fetch('/api/notificacoes')
      .then((r) => (r.ok ? r.json() : []))
      .then((lista: Array<{ lida: boolean }>) => setNaoLidas(lista.filter((n) => !n.lida).length))
      .catch(() => {})
  }, [pathname])

  useEffect(() => {
    const salvo = localStorage.getItem(NAV_EXPANDIDA_KEY)
    if (salvo !== null) {
      setExpandida(salvo === 'true')
    } else if (window.innerWidth < LARGURA_MINIMA_EXPANDIDA) {
      setExpandida(false)
    }
  }, [])

  // A seção Configuração nasce aberta quando a rota atual é uma das páginas
  // admin — assim quem chega direto em /admin/usuarios já vê onde está.
  useEffect(() => {
    setConfigAberta(CONFIG_LINKS.some((link) => link.href === pathname))
  }, [pathname])

  if (pathname === '/login') {
    return null
  }

  function alternarExpandida() {
    const proximoEstado = !expandida
    setExpandida(proximoEstado)
    localStorage.setItem(NAV_EXPANDIDA_KEY, String(proximoEstado))
  }

  function alternarConfig() {
    if (!expandida) {
      // Com a barra recolhida não há espaço para os sublinks: expande a
      // barra inteira e já deixa a seção aberta, num único clique.
      setExpandida(true)
      localStorage.setItem(NAV_EXPANDIDA_KEY, 'true')
      setConfigAberta(true)
      return
    }
    setConfigAberta((aberta) => !aberta)
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  const ehAdmin = role === 'admin'

  return (
    <nav
      className={cn(
        'sticky top-0 flex h-screen shrink-0 flex-col bg-gradient-to-b from-navy via-navy to-navy-2 shadow-[1px_0_0_0_rgba(255,255,255,0.06),8px_0_20px_-8px_rgba(0,0,0,0.35)] transition-[width] duration-200',
        expandida ? 'w-56' : 'w-16'
      )}
    >
      <Link
        href="/clientes"
        className="group flex shrink-0 items-center gap-2 overflow-hidden px-3.5 py-4"
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-b from-[#ff7a34] to-orange text-white shadow-[0_2px_8px_-2px_rgba(245,105,30,0.6)] transition-transform group-hover:scale-105">
          <FileSearch className="size-4.5" strokeWidth={2.25} />
        </span>
        {expandida && (
          <span className="whitespace-nowrap text-base font-semibold tracking-tight text-white">
            Ver<span className="text-orange">AI</span>
          </span>
        )}
      </Link>

      <div className="flex flex-1 flex-col gap-1 px-2.5 py-1">
        {TOP_LINKS.map((link) => {
          const ativo = pathname === link.href
          const Icon = link.icon
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-label={link.label}
              className={cn(
                'relative flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium text-light-blue transition-colors hover:bg-white/[0.06] hover:text-white',
                ativo && 'text-white'
              )}
            >
              {ativo && <span className="absolute inset-y-1 left-0 w-0.5 rounded-full bg-orange" />}
              <span className="relative flex shrink-0 items-center justify-center">
                <Icon className="size-3.5" strokeWidth={2.25} />
                {link.href === '/notificacoes' && naoLidas > 0 && !expandida && (
                  <span className="absolute -right-1 -top-1 size-2 rounded-full bg-orange ring-2 ring-navy" />
                )}
              </span>
              {expandida && <span className="truncate whitespace-nowrap">{link.label}</span>}
              {link.href === '/notificacoes' && naoLidas > 0 && expandida && (
                <span className="ml-auto flex min-w-[1.1rem] items-center justify-center rounded-full bg-orange px-1 py-0.5 text-[0.65rem] leading-none font-semibold text-white">
                  {naoLidas}
                </span>
              )}
            </Link>
          )
        })}

        {ehAdmin && (
          <>
            <span className="my-1.5 block h-px w-full shrink-0 bg-white/15" aria-hidden />
            <button
              type="button"
              onClick={alternarConfig}
              aria-label="Configuração"
              aria-expanded={configAberta}
              className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium text-light-blue transition-colors hover:bg-white/[0.06] hover:text-white"
            >
              <span className="flex shrink-0 items-center justify-center">
                <Settings className="size-3.5" strokeWidth={2.25} />
              </span>
              {expandida && (
                <>
                  <span className="truncate whitespace-nowrap">Configuração</span>
                  <span className="ml-auto flex shrink-0 items-center justify-center">
                    {configAberta ? (
                      <ChevronUp className="size-3.5" strokeWidth={2.25} />
                    ) : (
                      <ChevronDown className="size-3.5" strokeWidth={2.25} />
                    )}
                  </span>
                </>
              )}
            </button>

            {expandida && configAberta && (
              <div className="flex flex-col gap-1 pl-4">
                {CONFIG_LINKS.map((link) => {
                  const ativo = pathname === link.href
                  const Icon = link.icon
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      aria-label={link.label}
                      className={cn(
                        'relative flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium text-light-blue transition-colors hover:bg-white/[0.06] hover:text-white',
                        ativo && 'text-white'
                      )}
                    >
                      {ativo && (
                        <span className="absolute inset-y-1 left-0 w-0.5 rounded-full bg-orange" />
                      )}
                      <span className="flex shrink-0 items-center justify-center">
                        <Icon className="size-3.5" strokeWidth={2.25} />
                      </span>
                      <span className="truncate whitespace-nowrap">{link.label}</span>
                    </Link>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>

      <div className="flex shrink-0 flex-col gap-1 px-2.5 py-2.5">
        <button
          onClick={handleLogout}
          aria-label="Sair"
          className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium text-white/80 transition-colors hover:bg-white/[0.06] hover:text-white"
        >
          <LogOut className="size-3.5 shrink-0" strokeWidth={2.25} />
          {expandida && <span className="whitespace-nowrap">Sair</span>}
        </button>
        <button
          onClick={alternarExpandida}
          aria-label={expandida ? 'Recolher menu' : 'Expandir menu'}
          className="flex items-center gap-2.5 rounded-md border border-white/15 px-2.5 py-1.5 text-sm font-medium text-white/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-all hover:border-white/30 hover:bg-white/[0.06] hover:text-white"
        >
          {expandida ? (
            <>
              <ChevronLeft className="size-3.5 shrink-0" strokeWidth={2.25} />
              <span className="whitespace-nowrap">Recolher</span>
            </>
          ) : (
            <ChevronRight className="mx-auto size-3.5" strokeWidth={2.25} />
          )}
        </button>
      </div>
    </nav>
  )
}
```

- [ ] **Step 4: Run the suite to confirm it passes**

Run: `npx jest src/components/nav-bar.test.tsx`
Expected: PASS — all 8 tests green.

- [ ] **Step 5: Typecheck, lint, and run the full test suite to catch regressions elsewhere**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no output (no type errors).

Run: `npx eslint src/components/nav-bar.tsx src/components/nav-bar.test.tsx`
Expected: no output (no lint errors).

Run: `npx jest`
Expected: all suites PASS (confirms nothing outside `nav-bar` relies on the old flat `LINKS` export or on `adminOnly`-shaped link objects).

- [ ] **Step 6: Commit**

```bash
git add src/components/nav-bar.tsx src/components/nav-bar.test.tsx
git commit -m "feat: agrupa links admin da navbar em seção Configuração

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```
