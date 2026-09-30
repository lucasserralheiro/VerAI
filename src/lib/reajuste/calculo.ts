// Fator do IPC-Fipe acumulado num período escolhido pelo usuário (spec §1.4). Puro: roda na tela
// (prévia na hora) e na rota (que recalcula e não confia no navegador).
import Decimal from 'decimal.js'
import { mesesEntre, somarMeses } from './meses'

export type Calculo =
  | { ok: true; meses: Array<{ mes: string; variacao: string }>; fator: string; acumuladoPct: string }
  | { ok: false; faltando: string[] }
  | { ok: false; erro: string }

export function periodoSugerido(ultimoPublicado: string) {
  return { inicial: somarMeses(ultimoPublicado, -11), final: ultimoPublicado }
}

export function fatorCompleto(meses: Array<{ variacao: string }>): Decimal {
  return meses.reduce((fator, m) => fator.times(new Decimal(m.variacao).dividedBy(100).plus(1)), new Decimal(1))
}

export function calcularPeriodo(inicial: string, final: string, indice: Map<string, string>): Calculo {
  if (inicial > final) return { ok: false, erro: 'o mês inicial é depois do final' }
  const lista = mesesEntre(inicial, final)
  const faltando = lista.filter((mes) => !indice.has(mes))
  if (faltando.length > 0) return { ok: false, faltando }
  const meses = lista.map((mes) => ({ mes, variacao: indice.get(mes)! }))
  const fator = fatorCompleto(meses)
  return {
    ok: true,
    meses,
    fator: fator.toFixed(6, Decimal.ROUND_HALF_UP),
    acumuladoPct: fator.minus(1).times(100).toFixed(2, Decimal.ROUND_HALF_UP),
  }
}

export function corrigirValor(original: string, fator: Decimal): string {
  return new Decimal(original).times(fator).toFixed(2, Decimal.ROUND_HALF_UP)
}
