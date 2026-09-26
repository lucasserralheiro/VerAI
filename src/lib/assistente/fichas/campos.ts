/**
 * Ficha de um PDF do histórico (proposta ou termo): campos lidos uma vez só, cada um com a página e o
 * trecho literal de onde saiu (spec docs/superpowers/specs/2026-09-25-assistente-senior-design.md §5).
 */
export const NOMES_CAMPOS = [
  'objeto',
  'valorTotal',
  'vigenciaInicio',
  'vigenciaFim',
  'vigenciaMeses',
  'reajusteIndice',
  'reajustePeriodicidade',
  'garantia',
  'multas',
  'prazoPagamento',
  'medicao',
  'alteracoes',
] as const

export type NomeCampo = (typeof NOMES_CAMPOS)[number]

export interface CampoFicha {
  valor: string
  pagina: number | null
  /** Copiado do documento, até 200 caracteres. Obrigatório quando vem da IA. */
  trecho: string | null
  fonte: 'regra' | 'ia'
}

export type CamposFicha = Partial<Record<NomeCampo, CampoFicha>>

export const TAMANHO_TRECHO_FICHA = 200
