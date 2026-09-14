import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

/**
 * Título de cada etapa do painel de revisão (lado direito da proposta).
 * `etapa` numera passos sequenciais quando existem (ex.: OCR antes da
 * checagem) — a checagem por IA em si não usa mais número: cobre
 * conversão e português na mesma etapa, não são mais duas.
 */
export function TituloSecao({
  etapa,
  icone: Icone,
  children,
}: {
  etapa?: number
  icone: LucideIcon
  children: ReactNode
}) {
  return (
    <h2 className="flex items-center gap-2.5 text-base font-semibold text-navy">
      {etapa !== undefined ? (
        <span
          aria-hidden
          className="flex size-6 shrink-0 items-center justify-center rounded-full bg-navy text-[13px] font-semibold text-white tabular-nums"
        >
          {etapa}
        </span>
      ) : (
        <Icone className="size-5 shrink-0" strokeWidth={2.25} />
      )}
      {children}
    </h2>
  )
}
