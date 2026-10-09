'use client'

import { useEffect, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react'
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
  ArrowLeftRight,
  ClipboardCopy,
  History,
  FileCheck2,
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
  Menu,
  X,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { TrocaCarteiraMenu, aplicarCarteiraPadrao, definirCarteiraFoco } from './carteira/carteira-foco'

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
// de documento com visto (FileCheck2): a ação central da tela é conferir
// documentos. A lupa de antes lia como "buscar", e o menu já tem busca em outro lugar.
const CONFERE_LINK = { href: '/confere', label: 'ConfereAI', icon: FileCheck2 }
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
// "Relatórios dos clientes" leva a TODOS os clientes, sem carteira em foco, e recarrega a página — também
// quando já se está em /clientes numa pasta (sem isso o clique não mudava nada na tela).
const TODOS_OS_CLIENTES = '/clientes?visao=todos'
/** Clique simples: zera o foco da carteira e recarrega em "Todos os clientes". Ctrl/Cmd/Shift/botão do
 *  meio seguem o comportamento normal do link (nova aba ou janela). */
function irParaTodosOsClientes(evento: React.MouseEvent<HTMLAnchorElement>) {
  if (evento.button !== 0 || evento.metaKey || evento.ctrlKey || evento.shiftKey || evento.altKey) return
  evento.preventDefault()
  definirCarteiraFoco(null)
  window.location.assign(TODOS_OS_CLIENTES)
}
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
  { href: '/admin/api', label: 'API e integrações', icon: ArrowLeftRight },
]

// Menu temporariamente simplificado: só "Relatórios" e "Proposta Comercial"
// ficam visíveis para todos os usuários enquanto o restante do menu é
// reorganizado. Reverter = trocar para false (ou remover a flag e os `if`s
// que a usam abaixo).
const MENU_SIMPLIFICADO = true

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

/** Bloco do menu. Sem `titulo` não há rótulo nem divisor: grupo único não precisa de cabeçalho. */
function Secao({ titulo, expandida, children }: { titulo?: string; expandida: boolean; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      {!titulo ? null : expandida ? (
        <span className="px-2.5 pb-1 text-[11px] font-semibold tracking-[0.06em] text-white/55 uppercase">{titulo}</span>
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
  onClick,
}: {
  href: string
  label: string
  icon: LucideIcon
  onClick?: React.MouseEventHandler<HTMLAnchorElement>
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
      onClick={onClick}
      aria-label={label}
      title={expandida ? undefined : label}
      className={cn(
        'group relative flex h-9 min-w-0 flex-1 items-center gap-2.5 rounded-lg px-2.5 text-[14px] font-medium text-light-blue/90 transition-colors duration-150',
        'hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange/60',
        realce && 'bg-white/[0.08] text-white',
        !expandida && 'justify-center px-0'
      )}
    >
      {ativo && <span className="absolute inset-y-2 -left-3 w-[3px] rounded-r-full bg-orange" aria-hidden />}
      <span className="relative flex shrink-0">
        <Icon className={cn('size-[18px]', realce ? 'text-white' : 'text-light-blue/70 group-hover:text-white')} strokeWidth={1.9} />
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
        'relative flex h-8 items-center rounded-md pr-2 pl-3 text-[13.5px] text-light-blue/75 transition-colors',
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
  destino,
  onClickLink,
}: {
  link: Item
  sublinks: Item[]
  aberto: boolean
  onToggle: () => void
  pathname: string
  expandida: boolean
  /** Para onde o cabeçalho do grupo leva, quando não é a própria rota dele (`link.href`). */
  destino?: string
  onClickLink?: React.MouseEventHandler<HTMLAnchorElement>
}) {
  const filhoAtivo = sublinks.some((s) => rotaAtiva(pathname, s.href))
  const ativo = pathname === link.href

  return (
    <div className="flex flex-col">
      <div className="group/grupo relative flex items-center">
        <LinkMenu
          href={destino ?? link.href}
          onClick={onClickLink}
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
            className={cn(
              'absolute right-1 flex size-7 items-center justify-center rounded-md text-white/50 transition hover:bg-white/[0.08] hover:text-white focus-visible:opacity-100',
              // Setinha em todo item era ruído: aparece ao passar o mouse, ao focar ou com o grupo aberto.
              aberto ? 'opacity-100' : 'opacity-0 group-hover/grupo:opacity-100 group-focus-within/grupo:opacity-100'
            )}
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
  // Telas largas: rail de ícones (68px) que abre por cima do conteúdo ao passar o mouse ou focar
  // (`pairando`). Telas estreitas (<1024px): barra superior + gaveta.
  const [pairando, setPairando] = useState(false)
  const [estreita, setEstreita] = useState(false)
  const [gavetaAberta, setGavetaAberta] = useState(false)
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null)
  const expandida = estreita || pairando
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
    const consulta = window.matchMedia('(max-width: 1023px)')
    const atualizar = () => setEstreita(consulta.matches)
    atualizar()
    consulta.addEventListener('change', atualizar)
    return () => consulta.removeEventListener('change', atualizar)
  }, [])

  // Trocou de página: fecha a gaveta (telas estreitas).
  useEffect(() => {
    setGavetaAberta(false)
  }, [pathname])

  useEffect(() => {
    if (!gavetaAberta) return
    function esc(e: KeyboardEvent) {
      if (e.key === 'Escape') setGavetaAberta(false)
    }
    document.addEventListener('keydown', esc)
    return () => document.removeEventListener('keydown', esc)
  }, [gavetaAberta])

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

  /** Abre/fecha a barra ao passar o mouse com um pequeno atraso: não pisca ao atravessar a tela. */
  function agendarPairar(valor: boolean, atraso: number) {
    if (temporizador.current) clearTimeout(temporizador.current)
    temporizador.current = setTimeout(() => setPairando(valor), atraso)
  }

  /** Recolhida, clicar no chevron/grupo primeiro abre a barra; aberta, alterna o grupo. */
  function alternarGrupo(definir: Dispatch<SetStateAction<boolean>>) {
    return () => {
      if (!expandida) {
        setPairando(true)
        definir(true)
        return
      }
      definir((aberto) => !aberto)
    }
  }

  function expandir() {
    setPairando(true)
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

  const sobreposta = pairando

  return (
    <>
      {/* Telas estreitas: barra superior fina com hambúrguer; o menu abre em gaveta. */}
      <header className="sticky top-0 z-40 flex h-12 shrink-0 items-center gap-3 bg-navy px-3 shadow-[0_1px_0_0_rgba(255,255,255,0.06)] lg:hidden">
        <button
          type="button"
          onClick={() => setGavetaAberta(true)}
          aria-label="Abrir menu"
          aria-expanded={gavetaAberta}
          className="flex size-9 items-center justify-center rounded-lg text-white/80 transition-colors hover:bg-white/[0.08] hover:text-white"
        >
          <Menu className="size-5" strokeWidth={1.9} />
        </button>
        <Link href="/clientes" className="text-[15px] font-bold tracking-tight text-white" aria-label="VerAI — início">
          Ver<span className="text-orange">AI</span>
        </Link>
      </header>
      {gavetaAberta && <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setGavetaAberta(false)} aria-hidden />}

      {/* Reserva o espaço da barra no layout: 68px (rail). A barra em si flutua por cima ao abrir. */}
      <div className={cn('lg:sticky lg:top-0 lg:z-40 lg:h-screen lg:shrink-0 lg:transition-[width] lg:duration-200', 'lg:w-[68px]')}>
    <nav
      aria-label="Menu principal"
      onMouseEnter={() => agendarPairar(true, 120)}
      onMouseLeave={() => agendarPairar(false, 250)}
      onFocusCapture={() => agendarPairar(true, 0)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) agendarPairar(false, 150)
      }}
      className={cn(
        'flex flex-col bg-navy shadow-[1px_0_0_0_rgba(255,255,255,0.06)] transition-[width,transform,box-shadow] duration-200',
        // Gaveta (<1024px)
        'fixed inset-y-0 left-0 z-50 w-64',
        gavetaAberta ? 'translate-x-0' : '-translate-x-full',
        // Rail (≥1024px)
        'lg:absolute lg:z-40 lg:translate-x-0',
        expandida ? 'lg:w-64' : 'lg:w-[68px]',
        sobreposta && 'lg:shadow-[8px_0_24px_-6px_rgba(0,0,0,0.45)]'
      )}
    >
      {/* Marca + fixar: o controle da barra fica no topo, onde o olho procura. */}
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
          onClick={() => setGavetaAberta(false)}
          aria-label="Fechar menu"
          className="flex size-8 shrink-0 items-center justify-center rounded-lg text-white/60 transition-colors hover:bg-white/[0.08] hover:text-white lg:hidden"
        >
          <X className="size-[18px]" strokeWidth={1.9} />
        </button>
      </div>

      {/* Carteira em foco: contexto de trabalho global, então fica no alto — não escondida dentro de um grupo. */}
      <div className={cn('shrink-0 px-3 pb-3', !expandida && 'px-2.5')}>
        <TrocaCarteiraMenu expandida={expandida} onExpandir={expandir} />
      </div>

      <div className="nav-scroll flex flex-1 flex-col gap-5 overflow-x-hidden overflow-y-auto px-3 pt-1 pb-4">
        <Secao expandida={expandida}>
          <GrupoMenu
            link={RELATORIOS_LINK}
            destino={TODOS_OS_CLIENTES}
            onClickLink={irParaTodosOsClientes}
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
        </Secao>

        <Secao titulo="Referências" expandida={expandida}>
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

        {/* Administração é de poucos e de uso raro: fica no fim da barra, separada, sem título. */}
        {ehAdmin && (
          <div className="mt-auto border-t border-white/[0.08] pt-3">
            <GrupoMenu
              link={ADMIN_LINK}
              sublinks={ADMIN_SUBLINKS}
              aberto={adminAberto}
              onToggle={alternarGrupo(setAdminAberto)}
              pathname={pathname}
              expandida={expandida}
            />
          </div>
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
              {/* Nome e papel iguais ("Administrador" / "Administrador") não dizem nada a mais. */}
              {papel !== usuarioAtual?.nome && <span className="truncate text-[11.5px] text-white/55">{papel}</span>}
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
      </div>
    </>
  )
}
