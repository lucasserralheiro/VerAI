/** Temas do manual da equipe (spec docs/superpowers/specs/2026-09-25-assistente-senior-design.md §4.1).
 *  Sem import: usado também pelas regras de alertas (`src/lib/relatorios-clientes/alertas.ts`). */
export const TEMAS_MANUAL = ['prorrogacao', 'aditivo-valor', 'reajuste', 'apostilamento', 'rescisao', 'faturamento', 'sei', 'confere'] as const
export type TemaManual = (typeof TEMAS_MANUAL)[number]
