import type { TemaDoManual, TemaManual } from './temas'
import { aditivoValor } from './aditivo-valor'
import { apostilamento } from './apostilamento'
import { confere } from './confere'
import { faturamento } from './faturamento'
import { prorrogacao } from './prorrogacao'
import { reajuste } from './reajuste'
import { rescisao } from './rescisao'
import { sei } from './sei'

/**
 * Manual da equipe (spec docs/superpowers/specs/2026-09-25-assistente-senior-design.md §4.1): um arquivo
 * por tema, no build, e cada mudança aparece no diff. Rascunho não é regra — a equipe revisa e troca
 * `status` para `validado` com `validadoPor`/`validadoEm`.
 */
export const MANUAL: Record<TemaManual, TemaDoManual> = {
  prorrogacao,
  'aditivo-valor': aditivoValor,
  reajuste,
  apostilamento,
  rescisao,
  faturamento,
  sei,
  confere,
}

export type { TemaDoManual, TemaManual } from './temas'
export { TEMAS_MANUAL } from './temas'
