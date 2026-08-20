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
