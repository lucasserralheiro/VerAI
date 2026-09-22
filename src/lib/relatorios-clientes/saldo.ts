/**
 * Saldo do contrato (design doc §3.6): valor dos itens vinculados − valor faturado (notas
 * fiscais). Calculado em centavos com BigInt — os valores do banco são `Decimal(14, 2)` e somar em
 * `number` perde centavo. Entrada aceita string decimal, número ou `Prisma.Decimal` (via
 * `toString()`); `null` conta como zero.
 */

// Constantes em vez de literais `100n`: o tsconfig do projeto mira abaixo do ES2020.
const ZERO = BigInt(0)
const UM = BigInt(1)
const DOIS = BigInt(2)
const CEM = BigInt(100)
const DEZ_MIL = BigInt(10000)

type ValorDecimal = string | number | { toString(): string } | null

function paraCentavos(valor: ValorDecimal): bigint {
  if (valor === null) return ZERO
  const texto = typeof valor === 'number' ? valor.toFixed(2) : valor.toString().trim()
  const partes = /^(-?)(\d+)(?:\.(\d+))?$/.exec(texto)
  if (!partes) throw new Error(`valor decimal inválido: ${texto}`)
  const [, sinal, inteiro, fracao = ''] = partes
  // Arredonda a 3ª casa em diante (meio pra cima) — o banco só guarda duas.
  const centavos = BigInt(inteiro) * CEM + BigInt((fracao + '00').slice(0, 2)) + (Number(fracao[2] ?? 0) >= 5 ? UM : ZERO)
  return sinal ? -centavos : centavos
}

/** Centavos → string decimal sem zeros à direita (`74950n` → `"749.5"`, `100000n` → `"1000"`). */
function deCentavos(centavos: bigint): string {
  const negativo = centavos < ZERO
  const absoluto = negativo ? -centavos : centavos
  const fracao = String(absoluto % CEM).padStart(2, '0').replace(/0+$/, '')
  return `${negativo ? '-' : ''}${absoluto / CEM}${fracao ? `.${fracao}` : ''}`
}

export interface Saldo {
  valorItens: string
  faturado: string
  /** `null` quando não há itens vinculados — sem base pra calcular, nunca um negativo enganoso. */
  saldo: string | null
  /** Percentual com duas casas (`"25.05"`); `null` quando não há itens vinculados. */
  percentualFaturado: string | null
}

export function calcularSaldo({ valorItens, faturado }: { valorItens: ValorDecimal; faturado: ValorDecimal }): Saldo {
  const itens = paraCentavos(valorItens)
  const fat = paraCentavos(faturado)
  if (itens === ZERO) {
    return { valorItens: deCentavos(itens), faturado: deCentavos(fat), saldo: null, percentualFaturado: null }
  }
  // Centésimos de ponto percentual, arredondados meio pra cima.
  const centesimos = (fat * DEZ_MIL * DOIS + itens) / (DOIS * itens)
  const percentual = `${centesimos / CEM}.${String(centesimos % CEM).padStart(2, '0')}`
  return {
    valorItens: deCentavos(itens),
    faturado: deCentavos(fat),
    saldo: deCentavos(itens - fat),
    percentualFaturado: percentual,
  }
}
