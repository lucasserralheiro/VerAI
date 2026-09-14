'use client'

import type { ReactNode } from 'react'
import { diffWordsWithSpace } from 'diff'
import { Redo2, Undo2 } from 'lucide-react'
import { BTN_OUTLINE } from '@/lib/ui'
import { cn } from '@/lib/utils'
import { contextoDaMudanca, type Mudanca } from '@/lib/mudancasTexto'

export interface ListaMudancasProps {
  /** Texto-base de onde as posições das mudanças foram tiradas (o Markdown
   *  ANTES de qualquer correção) — é dele que sai o contexto de cada item. */
  base: string
  mudancas: Mudanca[]
  ativas: ReadonlySet<string>
  /** Sem esse callback a lista é só leitura (sem botão por item). */
  onAlternar?: (id: string) => void
  /** Texto do botão quando a mudança está valendo (ex.: "Desfazer"). */
  rotuloAtiva: string
  /** Texto do botão quando a mudança está desligada (ex.: "Aplicar de novo"). */
  rotuloInativa: string
  /** Aviso mostrado no item desligado (ex.: "Desfeita — ficou como estava."). */
  avisoInativa: string
  desabilitado?: boolean
  /** Título da coluna da esquerda (ex.: "Como está", "Como estava"). */
  rotuloAntes?: string
  /** Título da coluna da direita (ex.: "Como vai ficar", "Como ficou"). */
  rotuloDepois?: string
}

/**
 * Lista de mudanças pra conferir numa `JanelaRevisao`: cada troca é um
 * cartão numerado com as duas versões LADO A LADO — à esquerda como está
 * (trecho trocado riscado em vermelho), à direita como fica (em verde), com
 * um pouco do texto em volta pra localizar o ponto. Letra de leitura, não
 * de código: é texto de proposta, não Markdown pra programador.
 * Usada pela correção automática da checagem e pela revisão de português.
 */
export function ListaMudancas({
  base,
  mudancas,
  ativas,
  onAlternar,
  rotuloAtiva,
  rotuloInativa,
  avisoInativa,
  desabilitado,
  rotuloAntes = 'Como está',
  rotuloDepois = 'Como vai ficar',
}: ListaMudancasProps) {
  return (
    <ol className="space-y-4">
      {mudancas.map((mudanca, indice) => {
        const ativa = ativas.has(mudanca.id)
        const contexto = contextoDaMudanca(base, mudanca.posicoes[0], mudanca.antes.length)
        const partes = diffWordsWithSpace(mudanca.antes, mudanca.depois)
        const detalhes = [
          mudanca.pagina !== undefined ? `Página ${mudanca.pagina}` : null,
          mudanca.posicoes.length > 1 ? `${mudanca.posicoes.length} ocorrências no texto` : null,
        ].filter(Boolean)

        return (
          <li
            key={mudanca.id}
            className={cn('overflow-hidden rounded-xl border border-border-grey bg-white', !ativa && 'bg-light-grey/40')}
          >
            <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
              <div className="flex min-w-0 items-start gap-3">
                <span
                  aria-hidden
                  className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-navy/[0.08] text-sm font-semibold text-navy tabular-nums"
                >
                  {indice + 1}
                </span>
                <div className="min-w-0">
                  {mudanca.motivo && <p className="text-base font-medium leading-snug text-navy">{mudanca.motivo}</p>}
                  {detalhes.length > 0 && <p className="text-sm text-mid-grey">{detalhes.join(' · ')}</p>}
                  {!mudanca.motivo && detalhes.length === 0 && (
                    <p className="text-base font-medium text-navy">Correção {indice + 1}</p>
                  )}
                </div>
              </div>
              {onAlternar && (
                <button
                  type="button"
                  onClick={() => onAlternar(mudanca.id)}
                  disabled={desabilitado}
                  className={cn(BTN_OUTLINE, 'disabled:pointer-events-none disabled:opacity-50')}
                >
                  {ativa ? <Undo2 className="size-3.5" strokeWidth={2.25} /> : <Redo2 className="size-3.5" strokeWidth={2.25} />}
                  {ativa ? rotuloAtiva : rotuloInativa}
                </button>
              )}
            </div>

            <div
              className={cn(
                'grid gap-px border-t border-border-grey bg-border-grey md:grid-cols-2',
                !ativa && 'opacity-60'
              )}
            >
              <ColunaDiff tipo="antes" rotulo={rotuloAntes} contexto={contexto}>
                {partes.map((parte, i) =>
                  parte.added ? null : parte.removed ? (
                    <del key={i} className="rounded-sm bg-red-crit/15 px-0.5 text-red-crit decoration-red-crit/70">
                      {parte.value}
                    </del>
                  ) : (
                    <span key={i}>{parte.value}</span>
                  )
                )}
                {mudanca.antes === '' && <Vazio />}
              </ColunaDiff>
              <ColunaDiff tipo="depois" rotulo={rotuloDepois} contexto={contexto}>
                {partes.map((parte, i) =>
                  parte.removed ? null : parte.added ? (
                    <ins key={i} className="rounded-sm bg-green-ok/20 px-0.5 font-semibold text-green-ok no-underline">
                      {parte.value}
                    </ins>
                  ) : (
                    <span key={i}>{parte.value}</span>
                  )
                )}
                {mudanca.depois === '' && <Vazio />}
              </ColunaDiff>
            </div>

            {!ativa && <p className="border-t border-border-grey px-4 py-2 text-sm text-mid-grey">{avisoInativa}</p>}
          </li>
        )
      })}
    </ol>
  )
}

function ColunaDiff({
  tipo,
  rotulo,
  contexto,
  children,
}: {
  tipo: 'antes' | 'depois'
  rotulo: string
  contexto: { antes: string; depois: string }
  children: ReactNode
}) {
  const antes = tipo === 'antes'
  return (
    <div className={cn('min-w-0 px-4 py-3', antes ? 'bg-red-crit-light/50' : 'bg-green-ok-light/50')}>
      <p className={cn('mb-1.5 flex items-center gap-1.5 text-sm font-semibold', antes ? 'text-red-crit' : 'text-green-ok')}>
        <span aria-hidden className="w-3 select-none">
          {antes ? '−' : '+'}
        </span>
        {rotulo}
      </p>
      <p className="text-base leading-relaxed break-words whitespace-pre-wrap text-navy">
        <span className="text-mid-grey">{contexto.antes}</span>
        {children}
        <span className="text-mid-grey">{contexto.depois}</span>
      </p>
    </div>
  )
}

function Vazio() {
  return <span className="font-sans text-sm text-mid-grey italic">(vazio)</span>
}

/** Legenda curta das cores, pra ficar ao lado do título da lista. */
export function LegendaMudancas({
  antes = 'como estava no Markdown',
  depois = 'como ficou',
}: { antes?: string; depois?: string } = {}) {
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-mid-grey">
      <span className="inline-flex items-center gap-1.5">
        <span aria-hidden className="size-2.5 rounded-sm border border-red-crit/40 bg-red-crit-light" />
        {antes}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span aria-hidden className="size-2.5 rounded-sm border border-green-ok/40 bg-green-ok-light" />
        {depois}
      </span>
    </p>
  )
}
