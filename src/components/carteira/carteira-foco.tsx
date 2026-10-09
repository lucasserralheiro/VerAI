'use client'

// "Carteira em foco" da área Relatórios dos clientes: UMA escolha (gerência, "sem carteira" ou todas) que
// vale para a lista de clientes, Demandas, Solicitações, Relatórios, Documentos, Controle do faturamento e
// Fornecedores. Escolhe-se no menu lateral ou no topo de cada tela; as telas mandam `?carteira=` para a API
// (`src/lib/gerencias/escopo-carteira.ts`). É foco de trabalho, não permissão — "Todas" sempre está à mão.
//
// Guardado em localStorage (por navegador). Sem escolha ainda, o menu põe a carteira do usuário quando ele é
// de UMA gerência só (`aplicarCarteiraPadrao`); senão fica "Todas".

import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Briefcase, Check, ChevronsUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'

const CHAVE = 'verai:carteira-foco'
const EVENTO = 'verai:carteira-foco'
const TODAS = 'todas'
export const SEM_CARTEIRA = 'sem'

export interface GerenciaOpcao {
  id: string
  nome: string
  sigla: string | null
}

function lerBruto(): string | null {
  try {
    return localStorage.getItem(CHAVE)
  } catch {
    return null
  }
}

/** `null` = todas as carteiras. */
function lerFoco(): string | null {
  const v = lerBruto()
  return v && v !== TODAS ? v : null
}

export function definirCarteiraFoco(carteira: string | null) {
  try {
    localStorage.setItem(CHAVE, carteira ?? TODAS)
  } catch {
    // sem storage: a escolha vale só até recarregar
  }
  window.dispatchEvent(new CustomEvent(EVENTO, { detail: carteira }))
}

/** Primeira visita (nada escolhido ainda): foca a carteira do usuário quando ele é de uma gerência só. */
export function aplicarCarteiraPadrao(minhas: Array<{ gerenciaId: string }>) {
  if (lerBruto() !== null) return
  if (minhas.length === 1) definirCarteiraFoco(minhas[0].gerenciaId)
}

/** `pronto` vira true depois de ler o navegador — as telas esperam por ele para não buscar duas vezes. */
export function useCarteiraFoco() {
  const [foco, setFoco] = useState<string | null>(null)
  const [pronto, setPronto] = useState(false)
  useEffect(() => {
    const atualizar = () => setFoco(lerFoco())
    atualizar()
    setPronto(true)
    window.addEventListener(EVENTO, atualizar)
    window.addEventListener('storage', atualizar)
    return () => {
      window.removeEventListener(EVENTO, atualizar)
      window.removeEventListener('storage', atualizar)
    }
  }, [])
  return { foco, pronto, definir: definirCarteiraFoco }
}

/** Acrescenta `carteira=` à URL da API quando há foco. */
export function comCarteira(url: string, foco: string | null): string {
  if (!foco) return url
  return `${url}${url.includes('?') ? '&' : '?'}carteira=${encodeURIComponent(foco)}`
}

let cacheGerencias: Promise<GerenciaOpcao[]> | null = null
function carregarGerencias(): Promise<GerenciaOpcao[]> {
  cacheGerencias ??= fetch('/api/gerencias')
    .then((r) => (r.ok ? r.json() : []))
    .then((lista) => (Array.isArray(lista) ? lista : []))
    .catch(() => {
      cacheGerencias = null
      return []
    })
  return cacheGerencias
}

export function useGerencias() {
  const [gerencias, setGerencias] = useState<GerenciaOpcao[] | null>(null)
  useEffect(() => {
    let ativo = true
    carregarGerencias().then((g) => ativo && setGerencias(g))
    return () => {
      ativo = false
    }
  }, [])
  return gerencias
}

export function nomeDaCarteira(foco: string | null, gerencias: GerenciaOpcao[] | null): string {
  if (!foco) return 'Todas as carteiras'
  if (foco === SEM_CARTEIRA) return 'Sem carteira'
  return gerencias?.find((g) => g.id === foco)?.nome ?? 'Carteira'
}

/**
 * Seletor da carteira em foco. `menu` = no menu lateral (fundo escuro); `pagina` = no topo das telas.
 * Some quando não há gerência cadastrada (nada a escolher).
 */
export function SeletorCarteira({ variante = 'pagina', className }: { variante?: 'menu' | 'pagina'; className?: string }) {
  const { foco, definir } = useCarteiraFoco()
  const gerencias = useGerencias()
  if (!gerencias || gerencias.length === 0) return null
  // Foco numa gerência que não existe mais (desativada): trata como "Todas" na tela.
  const valor = foco && (foco === SEM_CARTEIRA || gerencias.some((g) => g.id === foco)) ? foco : ''

  const select = (
    <select
      aria-label="Carteira em foco"
      value={valor}
      onChange={(e) => definir(e.target.value || null)}
      className={cn(
        'min-w-0 flex-1 cursor-pointer truncate bg-transparent font-semibold outline-none',
        variante === 'menu' ? 'text-[12.5px] text-white [&>option]:text-navy' : 'text-sm text-navy'
      )}
    >
      <option value="">Todas as carteiras</option>
      {gerencias.map((g) => (
        <option key={g.id} value={g.id}>
          {g.nome}
          {g.sigla ? ` (${g.sigla})` : ''}
        </option>
      ))}
      <option value={SEM_CARTEIRA}>Sem carteira</option>
    </select>
  )

  if (variante === 'menu') {
    return (
      <label
        className={cn(
          'flex min-w-0 items-center gap-2 rounded-lg px-1.5 py-1.5 ring-1 transition-colors',
          valor ? 'bg-orange/[0.14] ring-orange/40' : 'bg-white/[0.05] ring-white/10',
          className
        )}
        title="Carteira em foco: vale para todas as telas deste grupo"
      >
        <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-white/10">
          <Briefcase className="size-3.5 text-white/80" strokeWidth={2} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-[9.5px] font-bold tracking-[0.08em] text-white/40 uppercase">Carteira</span>
          {select}
        </span>
      </label>
    )
  }

  return (
    <label
      className={cn(
        'inline-flex min-w-0 items-center gap-2 rounded-lg border px-3 py-1.5',
        valor ? 'border-orange/50 bg-orange/[0.06]' : 'border-border-grey bg-white',
        className
      )}
    >
      <Briefcase className="size-4 shrink-0 text-orange" strokeWidth={2} />
      <span className="text-xs font-medium text-mid-grey">Carteira:</span>
      {select}
    </label>
  )
}

/**
 * Troca de carteira no menu lateral, no formato de "seletor de espaço de trabalho": um botão com a
 * carteira em foco e uma lista própria (sem `<select>` nativo, que no fundo escuro destoa do menu).
 * Recolhido, vira só o ícone — o clique abre o menu e já mostra a lista.
 */
export function TrocaCarteiraMenu({ expandida, onExpandir }: { expandida: boolean; onExpandir: () => void }) {
  const { foco, definir } = useCarteiraFoco()
  const gerencias = useGerencias()
  const [aberto, setAberto] = useState(false)
  const raiz = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (!aberto) return
    function fora(e: MouseEvent) {
      if (raiz.current && !raiz.current.contains(e.target as Node)) setAberto(false)
    }
    function esc(e: KeyboardEvent) {
      if (e.key === 'Escape') setAberto(false)
    }
    document.addEventListener('mousedown', fora)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', fora)
      document.removeEventListener('keydown', esc)
    }
  }, [aberto])

  if (!gerencias || gerencias.length === 0) return null
  const valor = foco && (foco === SEM_CARTEIRA || gerencias.some((g) => g.id === foco)) ? foco : null
  const nome = nomeDaCarteira(valor, gerencias)
  const sigla = valor && valor !== SEM_CARTEIRA ? gerencias.find((g) => g.id === valor)?.sigla : null

  /** Escolher é ir: grava o foco e abre a rota da carteira (`/clientes?carteira=<id|sem>`; "Todas" abre
   *  o panorama das carteiras em `/clientes`). Já na lista de clientes não navega — ela acompanha o foco
   *  sozinha e acerta a URL (`lista-clientes.tsx`), e um `push` aqui brigaria com isso. */
  function escolher(v: string | null) {
    definir(v)
    setAberto(false)
    if (pathname === '/clientes') return
    router.push(v ? `/clientes?carteira=${encodeURIComponent(v)}` : '/clientes')
  }

  const opcoes: Array<{ valor: string | null; nome: string; sigla?: string | null }> = [
    { valor: null, nome: 'Todas as carteiras' },
    ...gerencias.map((g) => ({ valor: g.id, nome: g.nome, sigla: g.sigla })),
    { valor: SEM_CARTEIRA, nome: 'Sem carteira' },
  ]

  return (
    <div ref={raiz} className="relative">
      <button
        type="button"
        aria-label="Carteira em foco"
        aria-haspopup="listbox"
        aria-expanded={aberto}
        title={expandida ? 'Carteira em foco: vale para as telas de Relatórios dos clientes' : `Carteira: ${nome}`}
        onClick={() => {
          if (!expandida) onExpandir()
          setAberto((a) => !a)
        }}
        className={cn(
          'group flex w-full min-w-0 items-center gap-2.5 rounded-xl p-1.5 text-left ring-1 transition-colors',
          valor ? 'bg-light-blue/[0.12] ring-light-blue/40 hover:bg-light-blue/[0.18]' : 'bg-white/[0.04] ring-white/10 hover:bg-white/[0.08]',
          !expandida && 'justify-center p-1'
        )}
      >
        <span
          className={cn(
            'relative flex size-8 shrink-0 items-center justify-center rounded-lg',
            valor ? 'bg-light-blue text-navy' : 'bg-white/10 text-white/80'
          )}
        >
          {sigla ? (
            <span className="text-[10px] leading-none font-bold tracking-tight">{sigla.slice(0, 4)}</span>
          ) : (
            <Briefcase className="size-4" strokeWidth={2} />
          )}
        </span>
        {expandida && (
          <>
            <span className="flex min-w-0 flex-1 flex-col leading-tight">
              <span className="text-[10px] font-medium text-white/45">Carteira</span>
              <span className="truncate text-[13px] font-semibold text-white">
                {nome}
                {sigla && <span className="ml-1 font-normal text-white/50">{sigla}</span>}
              </span>
            </span>
            <ChevronsUpDown className="size-3.5 shrink-0 text-white/40 group-hover:text-white/70" strokeWidth={2} />
          </>
        )}
      </button>

      {aberto && expandida && (
        <div
          role="listbox"
          aria-label="Escolher carteira"
          className="absolute inset-x-0 top-full z-50 mt-1.5 max-h-72 overflow-y-auto rounded-xl bg-white p-1 shadow-xl shadow-black/30 ring-1 ring-black/5 animate-in fade-in slide-in-from-top-1 duration-100"
        >
          {opcoes.map((o, i) => {
            const selecionada = (o.valor ?? null) === valor
            const separar = o.valor === SEM_CARTEIRA || i === 1
            return (
              <div key={o.valor ?? 'todas'}>
                {separar && <div className="my-1 h-px bg-border-grey" />}
                <button
                  type="button"
                  role="option"
                  aria-selected={selecionada}
                  onClick={() => escolher(o.valor)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] text-navy transition-colors hover:bg-navy/[0.05]',
                    selecionada && 'font-semibold'
                  )}
                >
                  <span className="min-w-0 flex-1 truncate">{o.nome}</span>
                  {o.sigla && <span className="shrink-0 text-[11px] text-mid-grey">{o.sigla}</span>}
                  <Check className={cn('size-3.5 shrink-0 text-orange', !selecionada && 'invisible')} strokeWidth={2.5} />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
