import type { Saldo } from './saldo'
import { calcularSaldo } from './saldo'

/**
 * Base do "valor contratado" de um contrato — uma fonte só, na ordem:
 *  1. valor atual do histórico (última linha com valor: contrato, aditivo ou prorrogação), o mesmo
 *     que a coluna "Valor" da aba Contratos mostra;
 *  2. soma dos itens vinculados, quando o histórico não tem valor.
 * `null` = nenhum dos dois: o contrato fica fora da soma e a tela avisa.
 */
export function baseDoContrato(valorAtualHistorico: string | null, valorItens: string): string | null {
  if (valorAtualHistorico) return valorAtualHistorico
  return Number(valorItens) > 0 ? valorItens : null
}

/** Saldo usando a mesma base (histórico ou itens), pra "% faturado" não depender de ter itens. */
export function saldoComBase(saldoDosItens: Saldo, valorAtualHistorico: string | null): Saldo {
  if (Number(saldoDosItens.valorItens) > 0 || !valorAtualHistorico) return saldoDosItens
  return calcularSaldo({ valorItens: valorAtualHistorico, faturado: saldoDosItens.faturado })
}
