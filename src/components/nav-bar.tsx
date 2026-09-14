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

// "Proposta Comercial (Conversão SEI)" é outro módulo à parte — mesmo padrão
// de "Relatórios dos clientes": o cabeçalho já é um link de verdade pro
// histórico (onde também dá pra iniciar uma nova conversão), com "Histórico"
// como sub-item pra quando o grupo ganhar mais itens no futuro.
const PROPOSTA_COMERCIAL_LINK = {
  href: '/propostas-comerciais',
  label: 'Proposta Comercial',
  icon: ClipboardCopy,
}
const PROPOSTA_COMERCIAL_SUBLINKS = [{ href: '/propostas-comerciais', label: 'Histórico', icon: History }]

// Fora de qualquer solução — utilitário do produto como um todo.
const NOTIFICACOES_LINK = { href: '/notificacoes', label: 'Notificações', icon: Bell }

const CONFIG_LINKS = [
  { href: '/admin/usuarios', label: 'Usuários', icon: UserCog },
  { href: '/admin/clientes', label: 'Gerenciar clientes', icon: Users },
  { href: '/admin/regras-notificacao', label: 'Regras de notificação', icon: BellRing },
]

// Menu temporariamente simplificado: só "Relatórios" e "Proposta Comercial"
// ficam visíveis para todos os usuários enquanto o restante do menu é
// reorganizado. Reverter = trocar para false (ou remover a flag e os `if`s
// que a usam abaixo).
const MENU_SIMPLIFICADO = true

const NAV_EXPANDIDA_KEY = 'verai:nav-expandida'
const LARGURA_MINIMA_EXPANDIDA = 640 // px — abaixo disso a barra sempre abre só com ícones

interface DevStatus {
  enabled: boolean
  impersonating: boolean
  users: Array<{ id: string; nome: string; email: string; role: string }>
}

function IconeMenu({ icon: Icon, badge, expandida }: { icon: LucideIcon; badge?: number; expandida: boolean }) {
  return (
    <span className="relative flex size-8 shrink-0 items-center justify-center rounded-lg">
      <Icon className="size-[18px]" strokeWidth={1.75} />
      {!!badge && !expandida && (
        <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-orange text-[0.6rem] font-bold leading-none text-white ring-2 ring-navy">
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </span>
  )
}

function LinkMenu({
  href,
  label,
  icon,
  ativo,
  expandida,
  badge,
  className,
  destaque = false,
}: {
  href: string
  label: string
  icon: LucideIcon
  ativo: boolean
  expandida: boolean
  badge?: number
  className?: string
  destaque?: boolean
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      className={cn(
        'group relative flex items-center gap-2 rounded-lg py-1.5 pl-1.5 pr-2 text-[13px] font-medium text-light-blue transition-all duration-150',
        'hover:bg-white/[0.07] hover:text-white',
        ativo
          ? destaque
            ? 'bg-orange/[0.12] text-white'
            : 'bg-white/[0.08] text-white'
          : '',
        className
      )}
    >
      {ativo && destaque && (
        <span className="absolute inset-y-1.5 left-0 w-[3px] rounded-full bg-orange" />
      )}
      <span className={cn(ativo && destaque && 'text-orange')}>
        <IconeMenu icon={icon} badge={badge} expandida={expandida} />
      </span>
      {expandida && (
        <span className={cn('min-w-0 flex-1 truncate leading-tight', destaque && 'font-semibold')}>{label}</span>
      )}
      {!!badge && expandida && (
        <span className="ml-auto flex h-5 min-w-[1.25rem] shrink-0 items-center justify-center rounded-full bg-orange px-1.5 text-[0.7rem] font-bold leading-none text-white">
          {badge}
        </span>
      )}
    </Link>
  )
}

function GrupoMenu({
  link,
  sublinks,
  aberto,
  onToggle,
  pathname,
  expandida,
}: {
  link: { href: string; label: string; icon: LucideIcon }
  sublinks: Array<{ href: string; label: string; icon: LucideIcon }>
  aberto: boolean
  onToggle: () => void
  pathname: string
  expandida: boolean
}) {
  const ativo = pathname === link.href || sublinks.some((s) => s.href === pathname)

  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-0.5">
        <LinkMenu
          href={link.href}
          label={link.label}
          icon={link.icon}
          ativo={pathname === link.href}
          expandida={expandida}
          className="flex-1"
          destaque
        />
        {expandida && sublinks.length > 0 && (
          <button
            type="button"
            onClick={onToggle}
            aria-label={aberto ? `Recolher ${link.label}` : `Expandir ${link.label}`}
            aria-expanded={aberto}
            className={cn(
              'flex size-7 shrink-0 items-center justify-center rounded-md text-light-blue/70 transition-all duration-150 hover:bg-white/[0.07] hover:text-white',
              ativo && 'text-white/70'
            )}
          >
            <ChevronDown
              className={cn('size-3.5 transition-transform duration-200', aberto && 'rotate-180')}
              strokeWidth={2.25}
            />
          </button>
        )}
      </div>

      {expandida && aberto && sublinks.length > 0 && (
        <div className="ml-4 flex flex-col gap-0.5 border-l border-white/[0.08] pl-3">
          {sublinks.map((sub) => (
            <LinkMenu
              key={sub.href}
              href={sub.href}
              label={sub.label}
              icon={sub.icon}
              ativo={pathname === sub.href}
              expandida={expandida}
            />
          ))}
        </div>
      )}
    </div>
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
        expandida ? 'w-64' : 'w-[68px]'
      )}
    >
      <Link
        href="/clientes"
        className={cn(
          'flex shrink-0 items-center gap-2.5 overflow-hidden px-4 py-5',
          !expandida && 'justify-center px-0'
        )}
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-orange to-orange-dark text-sm font-bold text-white shadow-[0_2px_6px_rgba(240,124,45,0.35)]">
          V
        </span>
        {expandida && (
          <span className="whitespace-nowrap text-[15px] font-bold tracking-tight text-white">
            Ver<span className="text-orange">AI</span>
          </span>
        )}
      </Link>

      <div className="nav-scroll flex flex-1 flex-col gap-4 overflow-x-hidden overflow-y-auto px-3 py-2">
        <div className="flex flex-col gap-1">
          {expandida && (
            <span className="px-1.5 pb-0.5 text-[10px] font-bold tracking-[0.08em] text-white/30 uppercase">
              Relatórios
            </span>
          )}

          <GrupoMenu
            link={RELATORIOS_LINK}
            sublinks={RELATORIOS_SUBLINKS}
            aberto={relatoriosAberto}
            onToggle={alternarRelatorios}
            pathname={pathname}
            expandida={expandida}
          />

          <GrupoMenu
            link={PROPOSTA_COMERCIAL_LINK}
            sublinks={PROPOSTA_COMERCIAL_SUBLINKS}
            aberto={propostaComercialAberto}
            onToggle={alternarPropostaComercial}
            pathname={pathname}
            expandida={expandida}
          />
        </div>

        {!MENU_SIMPLIFICADO && (
          <div className="flex flex-col gap-1">
            <LinkMenu
              href={NOTIFICACOES_LINK.href}
              label={NOTIFICACOES_LINK.label}
              icon={NOTIFICACOES_LINK.icon}
              ativo={pathname === NOTIFICACOES_LINK.href}
              expandida={expandida}
              badge={naoLidas}
            />
          </div>
        )}

        {!MENU_SIMPLIFICADO && ehAdmin && (
          <div className="flex flex-col gap-1 border-t border-white/[0.08] pt-3">
            <button
              type="button"
              onClick={alternarConfig}
              aria-label="Configuração"
              aria-expanded={configAberta}
              className={cn(
                'flex items-center gap-2 rounded-lg py-1.5 pl-1.5 pr-2 text-[13px] font-medium text-light-blue transition-all duration-150 hover:bg-white/[0.07] hover:text-white',
                !expandida && 'justify-center'
              )}
            >
              <IconeMenu icon={Settings} expandida={expandida} />
              {expandida && (
                <>
                  <span className="min-w-0 flex-1 truncate text-left leading-tight">Configuração</span>
                  <ChevronDown
                    className={cn('size-3.5 shrink-0 transition-transform duration-200', configAberta && 'rotate-180')}
                    strokeWidth={2.25}
                  />
                </>
              )}
            </button>

            {expandida && configAberta && (
              <div className="ml-4 flex flex-col gap-0.5 border-l border-white/[0.08] pl-3">
                {CONFIG_LINKS.map((link) => (
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
          </div>
        )}
      </div>

      <div className="flex shrink-0 flex-col gap-1.5 border-t border-white/[0.08] px-3 py-3">
        {devStatus.enabled && devStatus.impersonating && (
          <button
            type="button"
            onClick={handleVoltarAdmin}
            aria-label="Voltar para admin"
            className={cn(
              'flex items-center gap-2 rounded-lg bg-orange/15 py-1.5 pl-1.5 pr-2 text-[13px] font-medium text-orange transition-colors hover:bg-orange/25',
              !expandida && 'justify-center'
            )}
          >
            <span className="flex size-8 shrink-0 items-center justify-center">
              <ArrowLeftRight className="size-[18px]" strokeWidth={1.75} />
            </span>
            {expandida && (
              <span className="min-w-0 flex-1 truncate leading-tight">
                Vendo como {usuarioAtual?.nome ?? '...'}
              </span>
            )}
          </button>
        )}

        {!MENU_SIMPLIFICADO && devStatus.enabled && !devStatus.impersonating && ehAdmin && expandida && devStatus.users.length > 0 && (
          <div className="flex flex-col gap-1 px-1 pb-1">
            <label
              htmlFor="dev-simular-usuario"
              className="text-[10px] font-bold tracking-[0.08em] text-white/40 uppercase"
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
          className={cn(
            'flex items-center gap-2 rounded-lg py-1.5 pl-1.5 pr-2 text-[13px] font-medium text-white/70 transition-colors hover:bg-white/[0.07] hover:text-white',
            !expandida && 'justify-center'
          )}
        >
          <span className="flex size-8 shrink-0 items-center justify-center">
            <LogOut className="size-[18px]" strokeWidth={1.75} />
          </span>
          {expandida && <span className="leading-tight">Sair</span>}
        </button>

        <button
          onClick={alternarExpandida}
          aria-label={expandida ? 'Recolher menu' : 'Expandir menu'}
          className={cn(
            'flex items-center justify-center gap-2 rounded-lg border border-white/10 py-1.5 text-[13px] font-medium text-white/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition-all hover:border-white/25 hover:bg-white/[0.07] hover:text-white'
          )}
        >
          {expandida ? (
            <>
              <ChevronLeft className="size-3.5 shrink-0" strokeWidth={2.25} />
              <span className="leading-tight">Recolher</span>
            </>
          ) : (
            <ChevronRight className="size-3.5" strokeWidth={2.25} />
          )}
        </button>
      </div>
    </nav>
  )
}
