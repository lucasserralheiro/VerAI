/**
 * Situação do faturamento — lista FECHADA (decisão do usuário, 23/09/2026). Antes era texto livre e a
 * regra "cancelado não abate saldo" dependia de alguém escrever "cancelado" certinho.
 *
 * Regra: faturamento **Cancelado** não é execução cobrada — não entra no faturado, no saldo, no % nem
 * no "faturado no último mês". Se foi substituído, quem conta é o novo lançamento.
 */
export const SITUACOES_FATURAMENTO = ['Em aberto', 'Emitido', 'Pago', 'Cancelado'] as const

export type SituacaoFaturamento = (typeof SITUACOES_FATURAMENTO)[number]

/** Texto gravado → situação canônica (sem diferenciar caixa/acento/espaço); `null` quando não casa. */
export function situacaoFaturamentoCanonica(bruto: string | null | undefined): SituacaoFaturamento | null {
  const texto = (bruto ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase()
  if (!texto) return null
  return SITUACOES_FATURAMENTO.find((s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase() === texto) ?? null
}

/** Tolerante ao texto livre que já está no banco ("cancelada", "CANCELADO - substituída"...). */
export function faturamentoCancelado(situacao: string | null | undefined): boolean {
  return !!situacao && /cancel/i.test(situacao)
}

// A mesma regra em SQL está na soma do faturado de `saldos-contratos.ts` (`!~* 'cancel'`).
