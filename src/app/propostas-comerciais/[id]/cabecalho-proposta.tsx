import type { ReactNode } from 'react'
import Link from 'next/link'
import { ArrowLeft, Loader2, Trash2 } from 'lucide-react'

/**
 * Cabeçalho da tela da proposta: volta pro histórico, título, origem e as
 * ações da página (à direita). Usado pelo `EspacoProposta` e pela tela de
 * erro de processamento em `page.tsx`, pra as duas terem a mesma cara.
 */
export function CabecalhoProposta({
  titulo,
  subtitulo,
  acoes,
}: {
  titulo: string
  subtitulo: string
  acoes?: ReactNode
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="min-w-0 space-y-1">
        <Link
          href="/propostas-comerciais"
          className="inline-flex items-center gap-1 text-xs font-medium text-mid-grey transition-colors hover:text-navy"
        >
          <ArrowLeft className="size-3.5" strokeWidth={2.25} />
          Histórico de propostas
        </Link>
        <h1 className="text-xl font-bold break-words text-navy">{titulo}</h1>
        <p className="truncate text-xs text-mid-grey" title={subtitulo}>
          {subtitulo}
        </p>
      </div>
      {acoes && <div className="flex shrink-0 items-center gap-2">{acoes}</div>}
    </header>
  )
}

/** Excluir fica discreto (ícone) — é ação rara e destrutiva, não deve
 *  competir com "Copiar formatado". A confirmação fica em `page.tsx`. */
export function BotaoExcluirProposta({ onExcluir, excluindo }: { onExcluir: () => void; excluindo?: boolean }) {
  return (
    <button
      type="button"
      onClick={onExcluir}
      disabled={excluindo}
      aria-label="Excluir proposta"
      title="Excluir proposta"
      className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl border border-navy/15 bg-white text-mid-grey transition-colors duration-150 hover:border-red-crit/40 hover:bg-red-crit-light hover:text-red-crit disabled:pointer-events-none disabled:opacity-50"
    >
      {excluindo ? (
        <Loader2 className="size-4 animate-spin" strokeWidth={2.25} />
      ) : (
        <Trash2 className="size-4" strokeWidth={2.25} />
      )}
    </button>
  )
}
