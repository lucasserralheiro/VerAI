'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
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
import { cn } from '@/lib/utils'

// "Relatórios" é uma das soluções do VerAI (conjunto de soluções) — por isso
// vive como um grupo próprio no menu, com "Relatórios dos clientes" como
// item principal (link de verdade, com página) e "Todos os documentos" como
// sub-item dele. Quando outra solução existir, ela ganha o mesmo formato de
// grupo, ao lado deste.
const RELATORIOS_LINK = { href: '/clientes', label: 'Relatórios dos clientes', icon: Building2 }
const RELATORIOS_SUBLINKS = [{ href: '/', label: 'Todos os documentos', icon: FileText }]

// "Proposta Comercial (Conversão SEI)" é outro módulo à parte, sem página
// própria de grupo (diferente de "Relatórios dos clientes") — o cabeçalho é
// só um botão que abre/fecha o único sub-item de hoje, "Histórico".
const PROPOSTA_COMERCIAL_SUBLINKS = [{ href: '/propostas-comerciais', label: 'Histórico', icon: History }]

// Fora de qualquer solução — utilitário do produto como um todo.
const NOTIFICACOES_LINK = { href: '/notificacoes', label: 'Notificações', icon: Bell }

const CONFIG_LINKS = [
  { href: '/admin/usuarios', label: 'Usuários', icon: UserCog },
  { href: '/admin/clientes', label: 'Gerenciar clientes', icon: Users },
  { href: '/admin/regras-notificacao', label: 'Regras de notificação', icon: BellRing },
]

const NAV_EXPANDIDA_KEY = 'verai:nav-expandida'
const LARGURA_MINIMA_EXPANDIDA = 640 // px — abaixo disso a barra sempre abre só com ícones

interface DevStatus {
  enabled: boolean
  impersonating: boolean
  users: Array<{ id: string; nome: string; email: string; role: string }>
}

function LinkMenu({
  href,
  label,
  icon: Icon,
  ativo,
  expandida,
  badge,
  className,
}: {
  href: string
  label: string
  icon: LucideIcon
  ativo: boolean
  expandida: boolean
  badge?: number
  className?: string
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      className={cn(
        'relative flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium text-light-blue transition-colors hover:bg-white/[0.06] hover:text-white',
        ativo && 'text-white',
        className
      )}
    >
      {ativo && <span className="absolute inset-y-1 left-0 w-0.5 rounded-full bg-orange" />}
      <span className="relative flex shrink-0 items-center justify-center">
        <Icon className="size-3.5" strokeWidth={2.25} />
        {!!badge && !expandida && (
          <span className="absolute -right-1 -top-1 size-2 rounded-full bg-orange ring-2 ring-navy" />
        )}
      </span>
      {expandida && <span className="truncate whitespace-nowrap">{label}</span>}
      {!!badge && expandida && (
        <span className="ml-auto flex min-w-[1.1rem] items-center justify-center rounded-full bg-orange px-1 py-0.5 text-[0.65rem] leading-none font-semibold text-white">
          {badge}
        </span>
      )}
    </Link>
  )
}

export function NavBar() {
  const pathname = usePathname()
  const router = useRouter()
  const [naoLidas, setNaoLidas] = useState(0)
  const [usuarioAtual, setUsuarioAtual] = useState<{ nome: string; role: string } | null>(null)
  const [devStatus, setDevStatus] = useState<DevStatus>({ enabled: false, impersonating: false, users: [] })
  // Por padrão a barra já mostra ícone + nome — nada fica escondido atrás de hover.
  // Recolher é uma ação explícita de quem quer mais espaço de tela.
  const [expandida, setExpandida] = useState(true)
  const [configAberta, setConfigAberta] = useState(false)
  // O grupo "Relatórios dos clientes" nasce aberto — é a solução em uso hoje.
  const [relatoriosAberto, setRelatoriosAberto] = useState(true)
  // Nasce aberto pelo mesmo motivo que "Relatórios dos clientes": é a única
  // coisa dentro do grupo hoje, não faz sentido esconder por padrão.
  const [propostaComercialAberto, setPropostaComercialAberto] = useState(true)

  const naLoginPage = pathname === '/login'

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

  // Se por algum motivo o grupo Relatórios estiver fechado e a navegação cair
  // num dos seus sub-itens, reabre — pra quem está lá dentro sempre ver onde está.
  useEffect(() => {
    if (RELATORIOS_SUBLINKS.some((link) => link.href === pathname)) {
      setRelatoriosAberto(true)
    }
  }, [pathname])

  useEffect(() => {
    if (PROPOSTA_COMERCIAL_SUBLINKS.some((link) => link.href === pathname)) {
      setPropostaComercialAberto(true)
    }
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

  function alternarRelatorios() {
    if (!expandida) {
      setExpandida(true)
      localStorage.setItem(NAV_EXPANDIDA_KEY, 'true')
      setRelatoriosAberto(true)
      return
    }
    setRelatoriosAberto((aberto) => !aberto)
  }

  function alternarPropostaComercial() {
    if (!expandida) {
      setExpandida(true)
      localStorage.setItem(NAV_EXPANDIDA_KEY, 'true')
      setPropostaComercialAberto(true)
      return
    }
    setPropostaComercialAberto((aberto) => !aberto)
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

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

  const ehAdmin = usuarioAtual?.role === 'admin'

  return (
    <nav
      className={cn(
        'sticky top-0 flex h-screen shrink-0 flex-col bg-gradient-to-b from-navy via-navy to-navy-2 shadow-[1px_0_0_0_rgba(255,255,255,0.06),8px_0_20px_-8px_rgba(0,0,0,0.35)] transition-[width] duration-200',
        expandida ? 'w-56' : 'w-16'
      )}
    >
      <Link
        href="/clientes"
        className="flex shrink-0 items-center gap-2 overflow-hidden px-3.5 py-4"
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-orange text-sm font-bold text-white">
          V
        </span>
        {expandida && (
          <span className="whitespace-nowrap text-base font-semibold tracking-tight text-white">
            Ver<span className="text-orange">AI</span>
          </span>
        )}
      </Link>

      <div className="flex flex-1 flex-col gap-1 px-2.5 py-1">
        {expandida && (
          <span className="px-2.5 pt-1 pb-1 text-[0.65rem] font-semibold tracking-wide text-white/35 uppercase">
            Relatórios
          </span>
        )}

        <div className="flex items-center gap-1">
          <LinkMenu
            href={RELATORIOS_LINK.href}
            label={RELATORIOS_LINK.label}
            icon={RELATORIOS_LINK.icon}
            ativo={pathname === RELATORIOS_LINK.href}
            expandida={expandida}
            className="flex-1"
          />
          {expandida && (
            <button
              type="button"
              onClick={alternarRelatorios}
              aria-label={relatoriosAberto ? 'Recolher Relatórios dos clientes' : 'Expandir Relatórios dos clientes'}
              aria-expanded={relatoriosAberto}
              className="flex shrink-0 items-center justify-center rounded-md p-2 text-light-blue transition-colors hover:bg-white/[0.06] hover:text-white"
            >
              {relatoriosAberto ? (
                <ChevronUp className="size-3.5" strokeWidth={2.25} />
              ) : (
                <ChevronDown className="size-3.5" strokeWidth={2.25} />
              )}
            </button>
          )}
        </div>

        {expandida && relatoriosAberto && (
          <div className="flex flex-col gap-1 pl-4">
            {RELATORIOS_SUBLINKS.map((link) => (
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

        <LinkMenu
          href={NOTIFICACOES_LINK.href}
          label={NOTIFICACOES_LINK.label}
          icon={NOTIFICACOES_LINK.icon}
          ativo={pathname === NOTIFICACOES_LINK.href}
          expandida={expandida}
          badge={naoLidas}
        />

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
