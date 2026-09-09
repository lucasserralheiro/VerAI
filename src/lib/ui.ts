/**
 * Classes de UI compartilhadas — identidade institucional Prodam (navy/laranja).
 * Centraliza os estilos de botão/input usados nas páginas para manter
 * consistência visual e facilitar ajustes futuros num único lugar.
 */

export const BTN_PRIMARY =
  'inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-orange px-3.5 py-1.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-orange-dark disabled:pointer-events-none disabled:opacity-50'

export const BTN_OUTLINE =
  'inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-navy/15 bg-white px-3.5 py-1.5 text-sm font-medium text-navy transition-colors duration-150 hover:border-navy/35 hover:bg-navy/[0.04] disabled:pointer-events-none disabled:opacity-50'

export const BTN_OUTLINE_SM =
  'inline-flex shrink-0 items-center gap-1 rounded-xl border border-navy/15 bg-white px-2.5 py-1 text-xs font-medium text-navy transition-colors duration-150 hover:border-navy/35 hover:bg-navy/[0.04]'

export const LINK_NAVY =
  'inline-flex items-center gap-1 font-medium text-navy transition-colors hover:text-orange hover:underline'

export const LINK_DANGER =
  'inline-flex items-center gap-1 font-medium text-red-crit transition-colors hover:text-red-crit/80 hover:underline'

export const INPUT_BASE =
  'rounded-xl border border-border-grey bg-white px-3 py-2 text-sm text-foreground shadow-xs outline-none transition-all duration-150 focus:border-orange focus:ring-4 focus:ring-orange/12'

export const BTN_PRIMARY_LG =
  'inline-flex w-full items-center justify-center gap-2 rounded-xl bg-orange px-5 py-3 text-sm font-semibold text-white shadow-md shadow-orange/25 transition-all duration-150 hover:bg-orange-dark hover:shadow-lg hover:shadow-orange/35 active:scale-[0.98] disabled:pointer-events-none disabled:bg-navy/10 disabled:text-mid-grey disabled:shadow-none'
