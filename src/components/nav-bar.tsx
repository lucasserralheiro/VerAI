'use client'

import { useEffect, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  FileText,
  Users,
  Bell,
  UserCog,
  Building,
  Building2,
  ShieldCheck,
  BellRing,
  LogOut,
  ChevronDown,
  PanelLeftClose,
  PanelLeftOpen,
  ArrowLeftRight,
  ClipboardCopy,
  History,
  Search,
  Truck,
  ClipboardList,
  Inbox,
  BarChart3,
  Sparkles,
  Tags,
  Receipt,
  CalendarDays,
  TrendingUp,
  Table2,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ClientesRecentes } from './clientes-recentes'
import { TrocaCarteiraMenu, aplicarCarteiraPadrao } from './carteira/carteira-foco'

// "Relatórios" é uma das soluções do VerAI (conjunto de soluções) — por isso
// vive como um grupo próprio no menu, com "Relatórios dos clientes" como
// item principal (link de verdade, com página) e "Todos os documentos" como
// sub-item dele. Quando outra solução existir, ela ganha o mesmo formato de
// grupo, ao lado deste.
// "ConfereAI" é a tela que abre primeiro ao entrar (login e a marca levam pra
// /confere — ver docs/superpowers/specs/2026-09-21-integracao-confere-design.md
// §3.7): cópia do frontend próprio do Confere, sem vínculo com cliente — por
// isso é um grupo próprio, não sub-item de outro. No menu ele é o TERCEIRO
// grupo, depois de "Relatórios dos clientes" e "Proposta Comercial". Ícone
// de lupa (Search) porque a ação central da tela é "conferir"/comparar
// documentos — não tem relação com balança de justiça.
const CONFERE_LINK = { href: '/confere', label: 'ConfereAI', icon: Search }
// Mesmo formato de grupo dos outros dois: o cabeçalho é a ferramenta em si
// (onde se envia contrato e levantamento) e o sub-item é o registro do que já
// passou por ela. A geração continua sem estado — o histórico guarda só o
// nome dos arquivos submetidos e os dois relatórios gerados.
const CONFERE_SUBLINKS = [{ href: '/confere/historico', label: 'Histórico', icon: History }]

// Reajuste por IPC-Fipe (spec docs/superpowers/specs/2026-09-30-reajuste-ipc-fipe-design.md): grupo
// próprio depois do ConfereAI — o cabeçalho abre a correção, os sub-itens o histórico e o índice.
const REAJUSTE_LINK = { href: '/reajuste', label: 'Reajuste IPC-Fipe', icon: TrendingUp }
const REAJUSTE_SUBLINKS = [
  { href: '/reajuste/historico', label: 'Histórico', icon: History },
  { href: '/reajuste/indice', label: 'Tabela do índice', icon: Table2 },
]

const RELATORIOS_LINK = { href: '/clientes', label: 'Relatórios dos clientes', icon: Building2 }
const RELATORIOS_SUBLINKS = [
  { href: '/fornecedores', label: 'Fornecedores', icon: Truck },
  { href: '/demandas', label: 'Demandas', icon: ClipboardList },
  { href: '/solicitacoes', label: 'Solicitações', icon: Inbox },
  { href: '/relatorios', label: 'Relatórios', icon: BarChart3 },
  { href: '/', label: 'Todos os documentos', icon: FileText },
  // Controle de faturamento vem da biblioteca "Documentos" do SharePoint, mas é POR CONTRATO — segue a
  // carteira em foco como as outras telas do grupo. Os Links MPLS saíram do menu em 30/09: ficam só no
  // detalhe do contrato (cartão → /links-mpls/contrato/[id]).
  { href: '/controle-faturamento', label: 'Controle de faturamento', icon: Receipt },
]

// Referências da PRODAM (07/10/2026): valem para todos os clientes, não seguem a carteira em foco — por isso
// ficam fora do grupo "Relatórios dos clientes", numa seção própria logo abaixo dele.
const REFERENCIAS_LINKS = [
  { href: '/tabela-de-precos', label: 'Tabela de preços', icon: Tags },
  { href: '/calendario-faturamento', label: 'Calendário de faturamento', icon: CalendarDays },
]

// "Proposta Comercial (Conversão SEI)" é outro módulo à parte — mesmo padrão
// de "Relatórios dos clientes": o cabeçalho já é um link de verdade pro
// histórico (onde também dá pra iniciar uma nova conversão), com "Histórico"
// como sub-item pra quando o grupo ganhar mais itens no futuro.
const PROPOSTA_COMERCIAL_LINK = {
  href: '/propostas-comerciais',
  label: 'Proposta Comercial',
  icon: ClipboardCopy,
}
// O sub-item "Histórico" apontava para a mesma rota do cabeçalho — saiu (07/10/2026): link repetido só
// confundia. Quando o módulo ganhar outra tela, ela entra aqui e o grupo volta a ter chevron.
const PROPOSTA_COMERCIAL_SUBLINKS: Array<{ href: string; label: string; icon: LucideIcon }> = []

// Fora de qualquer solução — utilitário do produto como um todo.
const NOTIFICACOES_LINK = { href: '/notificacoes', label: 'Notificações', icon: Bell }

// Administração: grupo próprio, só para admin, FORA do MENU_SIMPLIFICADO. O cabeçalho é o painel
// (/admin) e os sub-itens são as telas de cadastro.
const ADMIN_LINK = { href: '/admin', label: 'Administração', icon: ShieldCheck }
const ADMIN_SUBLINKS = [
  { href: '/admin/usuarios', label: 'Usuários', icon: UserCog },
  { href: '/admin/gerencias', label: 'Gerências e carteiras', icon: Building },
  { href: '/admin/clientes', label: 'Clientes', icon: Users },
  { href: '/admin/regras-notificacao', label: 'Regras de notificação', icon: BellRing },
  { href: '/admin/assistente', label: 'Assistente de IA', icon: Sparkles },
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

type Item = { href: string; label: string; icon: LucideIcon }

/** Sub-item ativo na própria rota e nas de detalhe abaixo dela (`/demandas/[id]` acende
 *  "Demandas"). `/` ("Todos os documentos") só na raiz, senão acenderia em tudo. */
function rotaAtiva(pathname: string, href: string) {
  return pathname === href || (href !== '/' && pathname.startsWith(`${href}/`))
}

function Secao({ titulo, expandida, children }: { titulo: string; expandida: boolean; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      {expandida ? (
        <span className="px-2.5 pb-1 text-[10.5px] font-semibold tracking-[0.06em] text-white/35 uppercase">{titulo}</span>
      ) : (
        <span className="mx-auto mb-1 h-px w-6 bg-white/10" aria-hidden />
      )}
      {children}
    </div>
  )
}

/** Item de primeiro nível: ícone + nome. Ativo = fundo claro, ícone laranja e barrinha à esquerda. */
function LinkMenu({
  href,
  label,
  icon: Icon,
  ativo,
  realce = ativo,
  expandida,
  badge,
}: {
  href: string
  label: string
  icon: LucideIcon
  /** A rota é exatamente este item. */
  ativo: boolean
  /** O item (ou um sub-item dele) é onde o usuário está. */
  realce?: boolean
  expandida: boolean
  badge?: number
}) {
  return (
    <Link
      aria-current={ativo ? 'page' : undefined}
      href={href}
      aria-label={label}
      title={expandida ? undefined : label}
      className={cn(
        'group relative flex h-9 min-w-0 flex-1 items-center gap-2.5 rounded-lg px-2.5 text-[13.5px] font-medium text-light-blue/90 transition-colors duration-150',
        'hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange/60',
        realce && 'bg-white/[0.08] text-white',
        !expandida && 'justify-center px-0'
      )}
    >
      {ativo && <span className="absolute inset-y-2 -left-3 w-[3px] rounded-r-full bg-orange" aria-hidden />}
      <span className="relative flex shrink-0">
        <Icon className={cn('size-[18px]', realce ? 'text-orange' : 'text-light-blue/70 group-hover:text-white')} strokeWidth={1.9} />
        {!!badge && !expandida && (
          <span className="absolute -top-1.5 -right-1.5 flex size-4 items-center justify-center rounded-full bg-orange text-[0.6rem] font-bold text-white ring-2 ring-navy">
            {badge > 9 ? '9+' : badge}
          </span>
        )}
      </span>
      {expandida && <span className="min-w-0 flex-1 truncate">{label}</span>}
      {!!badge && expandida && (
        <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-orange px-1.5 text-[0.7rem] font-bold text-white">
          {badge}
        </span>
      )}
    </Link>
  )
}

/** Sub-item: só texto, recuado na linha-guia do grupo — ícone em todo sub-item deixava o menu carregado. */
function SubLink({ href, label, ativo }: { href: string; label: string; ativo: boolean }) {
  return (
    <Link
      aria-current={ativo ? 'page' : undefined}
      href={href}
      aria-label={label}
      className={cn(
        'relative flex h-8 items-center rounded-md pr-2 pl-3 text-[13px] text-light-blue/75 transition-colors',
        'hover:bg-white/[0.05] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange/60',
        ativo && 'bg-white/[0.06] font-semibold text-white'
      )}
    >
      {ativo && <span className="absolute top-1/2 -left-[13px] size-[7px] -translate-y-1/2 rounded-full bg-orange ring-[3px] ring-navy" aria-hidden />}
      <span className="truncate">{label}</span>
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
  link: Item
  sublinks: Item[]
  aberto: boolean
  onToggle: () => void
  pathname: string
  expandida: boolean
}) {
  const filhoAtivo = sublinks.some((s) => rotaAtiva(pathname, s.href))
  const ativo = pathname === link.href

  return (
    <div className="flex flex-col">
      <div className="relative flex items-center">
        <LinkMenu
          href={link.href}
          label={link.label}
          icon={link.icon}
          ativo={ativo}
          realce={ativo || (filhoAtivo && !aberto)}
          expandida={expandida}
        />
        {expandida && sublinks.length > 0 && (
          <button
            type="button"
            onClick={onToggle}
            aria-label={aberto ? `Recolher ${link.label}` : `Expandir ${link.label}`}
            aria-expanded={aberto}
            className="absolute right-1 flex size-7 items-center justify-center rounded-md text-white/35 transition-colors hover:bg-white/[0.08] hover:text-white"
          >
            <ChevronDown className={cn('size-3.5 transition-transform duration-200', !aberto && '-rotate-90')} strokeWidth={2.25} />
          </button>
        )}
      </div>

      {expandida && aberto && sublinks.length > 0 && (
        <div className="mt-0.5 mb-1 ml-[19px] flex flex-col gap-px border-l border-white/[0.10] pl-2.5">
          {sublinks.map((sub) => (
            <SubLink key={sub.href} href={sub.href} label={sub.label} ativo={rotaAtiva(pathname, sub.href)} />
          ))}
        </div>
      )}
    </div>
  )
}

function iniciais(nome: string | undefined) {
  if (!nome) return '…'
  const partes = nome.trim().split(/\s+/)
  return ((partes[0]?.[0] ?? '') + (partes.length > 1 ? partes[partes.length - 1][0] : '')).toUpperCase()
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
  const [adminAberto, setAdminAberto] = useState(false)
  const [minhasGerencias, setMinhasGerencias] = useState<Array<{ papel: string }>>([])
  // Todos os grupos nascem recolhidos: o menu abre limpo e só o grupo da página
  // atual se abre sozinho (efeitos abaixo), pra quem está lá dentro ver onde está.
  const [relatoriosAberto, setRelatoriosAberto] = useState(false)
  const [propostaComercialAberto, setPropostaComercialAberto] = useState(false)
  const [confereAberto, setConfereAberto] = useState(false)
  const [reajusteAberto, setReajusteAberto] = useState(false)

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
    fetch('/api/gerencias/minhas')
      .then((r) => (r.ok ? r.json() : []))
      .then((lista: Array<{ papel: string; gerenciaId: string }>) => {
        const minhas = Array.isArray(lista) ? lista : []
        setMinhasGerencias(minhas)
        aplicarCarteiraPadrao(minhas)
      })
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

  // O grupo Administração abre quando a rota é /admin ou uma página dentro dele.
  useEffect(() => {
    if (pathname === '/admin' || pathname.startsWith('/admin/')) setAdminAberto(true)
  }, [pathname])

  // Se por algum motivo o grupo Relatórios estiver fechado e a navegação cair
  // num dos seus sub-itens, reabre — pra quem está lá dentro sempre ver onde está.
  useEffect(() => {
    if (RELATORIOS_SUBLINKS.some((link) => rotaAtiva(pathname, link.href))) {
      setRelatoriosAberto(true)
    }
  }, [pathname])

  useEffect(() => {
    if (PROPOSTA_COMERCIAL_SUBLINKS.some((link) => link.href === pathname)) {
      setPropostaComercialAberto(true)
    }
  }, [pathname])

  useEffect(() => {
    if (CONFERE_SUBLINKS.some((link) => link.href === pathname)) {
      setConfereAberto(true)
    }
  }, [pathname])

  useEffect(() => {
    if (REAJUSTE_SUBLINKS.some((link) => link.href === pathname)) {
      setReajusteAberto(true)
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

  /** Recolhida, clicar no chevron/grupo primeiro abre a barra; aberta, alterna o grupo. */
  function alternarGrupo(definir: Dispatch<SetStateAction<boolean>>) {
    return () => {
      if (!expandida) {
        setExpandida(true)
        localStorage.setItem(NAV_EXPANDIDA_KEY, 'true')
        definir(true)
        return
      }
      definir((aberto) => !aberto)
    }
  }

  function expandir() {
    setExpandida(true)
    localStorage.setItem(NAV_EXPANDIDA_KEY, 'true')
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
  const souManager = minhasGerencias.some((g) => g.papel === 'manager')
  const rotuloMinhaGerencia = minhasGerencias.length > 1 ? 'Minhas gerências' : 'Minha gerência'

  const papel = usuarioAtual?.role === 'admin' ? 'Administrador' : souManager ? 'Manager' : 'Usuário'

  return (
    <nav
      aria-label="Menu principal"
      className={cn(
        'sticky top-0 flex h-screen shrink-0 flex-col bg-navy shadow-[1px_0_0_0_rgba(255,255,255,0.06)] transition-[width] duration-200',
        expandida ? 'w-64' : 'w-[68px]'
      )}
    >
      {/* Marca + recolher: o controle da barra fica no topo, onde o olho procura. */}
      <div className={cn('flex shrink-0 items-center gap-2 px-4 pt-4 pb-3', !expandida && 'flex-col px-0')}>
        <Link href="/clientes" className="flex min-w-0 flex-1 items-center gap-2.5" aria-label="VerAI — início">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-orange to-orange-dark text-sm font-bold text-white shadow-[0_2px_8px_rgba(240,124,45,0.4)]">
            V
          </span>
          {expandida && (
            <span className="text-[15px] font-bold tracking-tight whitespace-nowrap text-white">
              Ver<span className="text-orange">AI</span>
            </span>
          )}
        </Link>
        <button
          type="button"
          onClick={alternarExpandida}
          aria-label={expandida ? 'Recolher menu' : 'Expandir menu'}
          title={expandida ? 'Recolher menu' : 'Expandir menu'}
          className="flex size-8 shrink-0 items-center justify-center rounded-lg text-white/45 transition-colors hover:bg-white/[0.08] hover:text-white"
        >
          {expandida ? <PanelLeftClose className="size-[18px]" strokeWidth={1.9} /> : <PanelLeftOpen className="size-[18px]" strokeWidth={1.9} />}
        </button>
      </div>

      {/* Carteira em foco: contexto de trabalho global, então fica no alto — não escondida dentro de um grupo. */}
      <div className={cn('shrink-0 px-3 pb-3', !expandida && 'px-2.5')}>
        <TrocaCarteiraMenu expandida={expandida} onExpandir={expandir} />
      </div>

      <div className="nav-scroll flex flex-1 flex-col gap-5 overflow-x-hidden overflow-y-auto px-3 pt-1 pb-4">
        <Secao titulo="Clientes" expandida={expandida}>
          <GrupoMenu
            link={RELATORIOS_LINK}
            sublinks={RELATORIOS_SUBLINKS}
            aberto={relatoriosAberto}
            onToggle={alternarGrupo(setRelatoriosAberto)}
            pathname={pathname}
            expandida={expandida}
          />
          {souManager && (
            <LinkMenu
              href="/gerencias"
              label={rotuloMinhaGerencia}
              icon={Building}
              ativo={rotaAtiva(pathname, '/gerencias')}
              expandida={expandida}
            />
          )}
          <ClientesRecentes pathname={pathname} expandida={expandida} />
        </Secao>

        <Secao titulo="Referências PRODAM" expandida={expandida}>
          {REFERENCIAS_LINKS.map((ref) => (
            <LinkMenu
              key={ref.href}
              href={ref.href}
              label={ref.label}
              icon={ref.icon}
              ativo={rotaAtiva(pathname, ref.href)}
              expandida={expandida}
            />
          ))}
        </Secao>

        <Secao titulo="Ferramentas" expandida={expandida}>
          <GrupoMenu
            link={PROPOSTA_COMERCIAL_LINK}
            sublinks={PROPOSTA_COMERCIAL_SUBLINKS}
            aberto={propostaComercialAberto}
            onToggle={alternarGrupo(setPropostaComercialAberto)}
            pathname={pathname}
            expandida={expandida}
          />
          <GrupoMenu
            link={CONFERE_LINK}
            sublinks={CONFERE_SUBLINKS}
            aberto={confereAberto}
            onToggle={alternarGrupo(setConfereAberto)}
            pathname={pathname}
            expandida={expandida}
          />
          <GrupoMenu
            link={REAJUSTE_LINK}
            sublinks={REAJUSTE_SUBLINKS}
            aberto={reajusteAberto}
            onToggle={alternarGrupo(setReajusteAberto)}
            pathname={pathname}
            expandida={expandida}
          />
          {!MENU_SIMPLIFICADO && (
            <LinkMenu
              href={NOTIFICACOES_LINK.href}
              label={NOTIFICACOES_LINK.label}
              icon={NOTIFICACOES_LINK.icon}
              ativo={pathname === NOTIFICACOES_LINK.href}
              expandida={expandida}
              badge={naoLidas}
            />
          )}
        </Secao>

        {ehAdmin && (
          <Secao titulo="Sistema" expandida={expandida}>
            <GrupoMenu
              link={ADMIN_LINK}
              sublinks={ADMIN_SUBLINKS}
              aberto={adminAberto}
              onToggle={alternarGrupo(setAdminAberto)}
              pathname={pathname}
              expandida={expandida}
            />
          </Secao>
        )}
      </div>

      <div className="flex shrink-0 flex-col gap-2 border-t border-white/[0.08] p-3">
        {devStatus.enabled && devStatus.impersonating && (
          <button
            type="button"
            onClick={handleVoltarAdmin}
            aria-label="Voltar para admin"
            title={expandida ? undefined : `Vendo como ${usuarioAtual?.nome ?? '...'} — voltar para admin`}
            className={cn(
              'flex items-center gap-2 rounded-lg bg-orange/15 px-2.5 py-2 text-[12.5px] font-medium text-orange transition-colors hover:bg-orange/25',
              !expandida && 'justify-center px-0'
            )}
          >
            <ArrowLeftRight className="size-4 shrink-0" strokeWidth={2} />
            {expandida && <span className="min-w-0 flex-1 truncate text-left">Vendo como {usuarioAtual?.nome ?? '...'}</span>}
          </button>
        )}

        {!MENU_SIMPLIFICADO && devStatus.enabled && !devStatus.impersonating && ehAdmin && expandida && devStatus.users.length > 0 && (
          <div className="flex flex-col gap-1 px-1 pb-1">
            <label htmlFor="dev-simular-usuario" className="text-[10px] font-bold tracking-[0.08em] text-white/40 uppercase">
              Simular usuário
            </label>
            <select
              id="dev-simular-usuario"
              onChange={(event) => {
                if (event.target.value) handleSimular(event.target.value)
              }}
              defaultValue=""
              className="rounded-md border border-white/15 bg-navy-2 px-2 py-1.5 text-xs text-white outline-none"
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

        {/* Quem está logado + sair, num cartão só (antes "Sair" e "Recolher" eram dois botões soltos). */}
        <div className={cn('flex items-center gap-2.5 rounded-xl p-1.5', expandida ? 'bg-white/[0.04]' : 'flex-col bg-transparent p-0')}>
          <span
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-light-blue/15 text-[11px] font-bold text-white ring-1 ring-white/10"
            title={expandida ? undefined : usuarioAtual?.nome}
          >
            {iniciais(usuarioAtual?.nome)}
          </span>
          {expandida && (
            <span className="flex min-w-0 flex-1 flex-col leading-tight">
              <span className="truncate text-[13px] font-semibold text-white">{usuarioAtual?.nome ?? '…'}</span>
              <span className="truncate text-[11px] text-white/45">{papel}</span>
            </span>
          )}
          <button
            type="button"
            onClick={handleLogout}
            aria-label="Sair"
            title="Sair"
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-white/50 transition-colors hover:bg-white/[0.08] hover:text-white"
          >
            <LogOut className="size-4" strokeWidth={1.9} />
            <span className="sr-only">Sair</span>
          </button>
        </div>
      </div>
    </nav>
  )
}
