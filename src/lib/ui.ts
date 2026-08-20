/**
 * Classes de UI compartilhadas — identidade institucional Prodam (navy/laranja).
 * Centraliza os estilos de botão/input usados nas páginas para manter
 * consistência visual e facilitar ajustes futuros num único lugar.
 */

export const BTN_PRIMARY =
  'inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-gradient-to-b from-[#ff7a34] to-orange px-3.5 py-2 text-sm font-semibold text-white shadow-[0_1px_1px_rgba(0,0,0,0.08),0_6px_16px_-6px_rgba(245,105,30,0.55)] transition-all duration-150 hover:shadow-[0_2px_4px_rgba(0,0,0,0.08),0_10px_22px_-8px_rgba(245,105,30,0.6)] hover:brightness-[1.03] active:scale-[0.98] active:brightness-95 disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none'

export const BTN_OUTLINE =
  'inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-navy/15 bg-white px-3.5 py-2 text-sm font-medium text-navy shadow-xs transition-all duration-150 hover:border-navy/35 hover:bg-navy/[0.04] hover:shadow-sm active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50'

export const BTN_OUTLINE_SM =
  'inline-flex shrink-0 items-center gap-1 rounded-lg border border-navy/15 bg-white px-2.5 py-1 text-xs font-medium text-navy shadow-xs transition-all duration-150 hover:border-navy/35 hover:bg-navy/[0.04] active:scale-[0.98]'

export const LINK_NAVY =
  'inline-flex items-center gap-1 font-medium text-navy transition-colors hover:text-orange hover:underline'

export const LINK_DANGER =
  'inline-flex items-center gap-1 font-medium text-red-crit transition-colors hover:text-red-crit/80 hover:underline'

export const INPUT_BASE =
  'rounded-lg border border-border-grey bg-white px-3 py-2 text-sm text-foreground shadow-xs outline-none transition-all duration-150 focus:border-orange focus:ring-4 focus:ring-orange/12'
