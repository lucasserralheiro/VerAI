'use client'

// Peças visuais da lista de clientes por carteira: faixa de totais do nível aberto, pasta da carteira e
// o resumo curto embaixo da pasta do cliente. Números já vêm somados de /api/clientes/painel.

import type { ReactNode } from 'react'
import { AlertTriangle, CalendarClock, FolderOpen, UserRound } from 'lucide-react'
import { formatarMoeda } from '@/lib/relatorios-clientes/formatacao'
import type { CarteiraDoPainel, TotaisCarteira } from '@/lib/relatorios-clientes/painel-carteiras'

const COMPACTO = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  notation: 'compact',
  maximumFractionDigits: 1,
})

/** `12345678.9` → `R$ 12,3 mi` (o valor exato vai no `title`). */
export function moedaCompacta(valor: string | null): string {
  if (valor === null) return '—'
  const numero = Number(valor)
  if (!Number.isFinite(numero)) return '—'
  return COMPACTO.format(numero).replace(/ /g, ' ')
}

function percentual(totais: TotaisCarteira): number | null {
  if (totais.percentualFaturado === null) return null
  return Math.max(0, Math.min(100, Number(totais.percentualFaturado)))
}

function plural(n: number, um: string, varios: string) {
  return `${n.toLocaleString('pt-BR')} ${n === 1 ? um : varios}`
}

function Bloco({
  rotulo,
  valor,
  titulo,
  detalhe,
  tom = 'normal',
}: {
  rotulo: string
  valor: string
  titulo?: string
  detalhe?: ReactNode
  tom?: 'normal' | 'alerta' | 'critico'
}) {
  const cor = tom === 'critico' ? 'text-red-crit' : tom === 'alerta' ? 'text-orange-dark' : 'text-navy'
  return (
    <div className="min-w-0 rounded-xl border border-border-grey bg-white px-4 py-3">
      <p className="text-[11px] font-semibold tracking-wide text-mid-grey uppercase">{rotulo}</p>
      <p className={`mt-0.5 truncate text-xl font-semibold tabular-nums ${cor}`} title={titulo}>
        {valor}
      </p>
      {detalhe && <p className="mt-0.5 truncate text-xs text-mid-grey">{detalhe}</p>}
    </div>
  )
}

/** Faixa de totais do nível aberto (geral, carteira). `null` = carregando; `'erro'` = indisponível. */
export function FaixaTotais({ totais, rotulo }: { totais: TotaisCarteira | null | 'erro'; rotulo: string }) {
  if (totais === 'erro') {
    return <p className="text-xs text-mid-grey">Totais indisponíveis no momento — a lista continua abaixo.</p>
  }
  if (totais === null) {
    return (
      <div aria-label={`Carregando totais ${rotulo}`} className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-[76px] animate-pulse rounded-xl bg-light-grey" />
        ))}
      </div>
    )
  }
  const pct = percentual(totais)
  return (
    <section aria-label={`Totais ${rotulo}`} className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
      <Bloco
        rotulo="Clientes"
        valor={totais.clientes.toLocaleString('pt-BR')}
        detalhe={`${totais.clientesComContratoAtivo.toLocaleString('pt-BR')} com contrato ativo`}
      />
      <Bloco
        rotulo="Contratos ativos"
        valor={totais.contratosAtivos.toLocaleString('pt-BR')}
        detalhe={totais.contratosSemValor > 0 ? `${plural(totais.contratosSemValor, 'sem valor', 'sem valor')} — fora das somas` : undefined}
        tom={totais.contratosSemValor > 0 ? 'alerta' : 'normal'}
      />
      <Bloco
        rotulo="Valor contratado"
        valor={moedaCompacta(totais.valorContratado)}
        titulo={formatarMoeda(totais.valorContratado)}
        detalhe="dos contratos ativos"
      />
      <Bloco
        rotulo="Faturado"
        valor={moedaCompacta(totais.faturado)}
        titulo={formatarMoeda(totais.faturado)}
        detalhe={pct === null ? 'sem base para %' : `${pct.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% do contratado`}
      />
      <Bloco
        rotulo="Saldo"
        valor={moedaCompacta(totais.saldo)}
        titulo={formatarMoeda(totais.saldo)}
        tom={totais.saldo !== null && Number(totais.saldo) < 0 ? 'critico' : 'normal'}
        detalhe="contratado − faturado"
      />
      <Bloco
        rotulo="Vencem em 90 dias"
        valor={totais.vencem90.toLocaleString('pt-BR')}
        tom={totais.vencem30 > 0 || totais.vencidos > 0 ? 'critico' : totais.vencem90 > 0 ? 'alerta' : 'normal'}
        detalhe={
          totais.vencidos > 0
            ? `${totais.vencem30} em 30 dias · ${plural(totais.vencidos, 'vencido', 'vencidos')}`
            : `${totais.vencem30} em 30 dias`
        }
      />
    </section>
  )
}

/** Barra fina do % faturado. */
function BarraFaturado({ totais }: { totais: TotaisCarteira }) {
  const pct = percentual(totais)
  if (pct === null) return <div className="h-1.5 rounded-full bg-light-grey" />
  return (
    <div
      className="h-1.5 overflow-hidden rounded-full bg-light-grey"
      role="meter"
      aria-label="Faturado do contratado"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
    >
      <div className="h-full rounded-full bg-orange" style={{ width: `${pct}%` }} />
    </div>
  )
}

/** Selos de vencimento de um conjunto de contratos (some quando não há nada a avisar). */
export function SelosVencimento({ totais, compacto = false }: { totais: TotaisCarteira; compacto?: boolean }) {
  const selos: Array<{ texto: string; critico: boolean }> = []
  if (totais.vencidos > 0) selos.push({ texto: plural(totais.vencidos, 'vencido', 'vencidos'), critico: true })
  if (totais.vencem30 > 0) selos.push({ texto: `${totais.vencem30} vence${totais.vencem30 === 1 ? '' : 'm'} em 30d`, critico: true })
  const ate90 = totais.vencem90 - totais.vencem30
  if (ate90 > 0) selos.push({ texto: `${ate90} em 90d`, critico: false })
  if (!compacto && totais.contratosSemValor > 0) selos.push({ texto: `${totais.contratosSemValor} sem valor`, critico: false })
  if (selos.length === 0) return null
  return (
    <span className="flex flex-wrap justify-center gap-1">
      {selos.map((s) => (
        <span
          key={s.texto}
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
            s.critico ? 'bg-red-crit-light text-red-crit' : 'bg-orange/10 text-orange-dark'
          }`}
        >
          {s.critico ? <AlertTriangle className="size-3" strokeWidth={2.25} /> : <CalendarClock className="size-3" strokeWidth={2.25} />}
          {s.texto}
        </span>
      ))}
    </span>
  )
}

/** Pasta de uma carteira (gerência): nome, gerente, contagens e o total dela. */
export function PastaCarteira({
  carteira,
  minha,
  href,
  aoAbrir,
  carregandoTotais = false,
}: {
  carteira: CarteiraDoPainel
  minha: boolean
  /** Pasta montada só com a lista de clientes, antes dos totais chegarem: números viram "…". */
  carregandoTotais?: boolean
  href: string
  aoAbrir: () => void
}) {
  const { totais } = carteira
  const sem = carteira.id === 'sem'
  return (
    <a
      href={href}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
        e.preventDefault()
        aoAbrir()
      }}
      className={`group flex h-full flex-col gap-3 rounded-2xl border bg-white p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md ${
        sem ? 'border-dashed border-mid-grey/50' : minha ? 'border-orange/60 ring-1 ring-orange/30' : 'border-border-grey'
      }`}
    >
      <div className="flex items-start gap-3">
        <span className="relative h-11 w-14 shrink-0">
          <span aria-hidden="true" className={`absolute top-0 left-1 h-2.5 w-6 rounded-t-md ${sem ? 'bg-mid-grey' : 'bg-navy'}`} />
          <span aria-hidden="true" className={`absolute top-2 left-0 h-9 w-14 rounded-md shadow-sm ${sem ? 'bg-mid-grey/70' : 'bg-navy-3'}`} />
          <FolderOpen
            aria-hidden="true"
            className="absolute top-[18px] left-1/2 size-4 -translate-x-1/2 text-white/80 opacity-0 transition group-hover:opacity-100"
          />
          {carteira.sigla && (
            <span className="absolute bottom-0.5 left-1/2 max-w-12 -translate-x-1/2 truncate rounded bg-orange px-1 py-0.5 font-mono text-[9px] font-semibold text-white">
              {carteira.sigla}
            </span>
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-[15px] font-semibold text-navy">{carteira.nome}</span>
            {minha && (
              <span className="shrink-0 rounded-full bg-orange/15 px-2 py-0.5 text-[10px] font-semibold text-orange-dark uppercase">
                Sua carteira
              </span>
            )}
          </span>
          {/* Só a pasta "Sem carteira" explica o que é; as demais não mostram gerente. */}
          {sem && (
            <span className="mt-0.5 flex items-center gap-1 truncate text-xs text-mid-grey">
              <UserRound className="size-3.5 shrink-0" strokeWidth={2} />
              Clientes ainda não distribuídos
            </span>
          )}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <span>
          <span className="block text-lg font-semibold text-navy tabular-nums">{totais.clientes}</span>
          <span className="block text-[11px] text-mid-grey">{totais.clientes === 1 ? 'cliente' : 'clientes'}</span>
        </span>
        <span>
          <span className="block text-lg font-semibold text-navy tabular-nums">{carregandoTotais ? '…' : totais.contratosAtivos}</span>
          <span className="block text-[11px] text-mid-grey">contratos ativos</span>
        </span>
        <span title={carregandoTotais ? undefined : formatarMoeda(totais.valorContratado)}>
          <span className="block truncate text-lg font-semibold text-navy tabular-nums">
            {carregandoTotais ? '…' : moedaCompacta(totais.valorContratado)}
          </span>
          <span className="block text-[11px] text-mid-grey">contratado</span>
        </span>
      </div>

      {carregandoTotais ? (
        <div className="h-[30px] animate-pulse rounded bg-light-grey" />
      ) : (
        <div className="space-y-1">
          <BarraFaturado totais={totais} />
          <p className="flex justify-between gap-2 text-[11px] text-mid-grey tabular-nums">
            <span title={formatarMoeda(totais.faturado)}>
              Faturado {moedaCompacta(totais.faturado)}
              {totais.percentualFaturado !== null &&
                ` (${Number(totais.percentualFaturado).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%)`}
            </span>
            <span title={formatarMoeda(totais.saldo)}>Saldo {moedaCompacta(totais.saldo)}</span>
          </p>
        </div>
      )}

      <div className="mt-auto min-h-5">{!carregandoTotais && <SelosVencimento totais={totais} />}</div>
    </a>
  )
}

/** Linha curta embaixo da pasta do cliente: contratos ativos + valor, e selos de vencimento. */
export function ResumoCliente({ totais }: { totais: TotaisCarteira }) {
  return (
    <>
      <span className="text-[11px] text-mid-grey tabular-nums" title={formatarMoeda(totais.valorContratado)}>
        {totais.contratosAtivos === 0
          ? 'sem contrato ativo'
          : `${plural(totais.contratosAtivos, 'ativo', 'ativos')} · ${moedaCompacta(totais.valorContratado)}`}
      </span>
      <SelosVencimento totais={totais} compacto />
    </>
  )
}
