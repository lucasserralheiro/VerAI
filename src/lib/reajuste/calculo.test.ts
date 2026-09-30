import Decimal from 'decimal.js'
import { calcularPeriodo, corrigirValor, fatorCompleto, periodoSugerido } from './calculo'

// Valores reais publicados pela Fipe (conferidos em 30/09/2026)
const REAIS: Array<[string, string]> = [
  ['2025-08', '0.04'], ['2025-09', '0.65'], ['2025-10', '0.27'], ['2025-11', '0.20'], ['2025-12', '0.32'],
  ['2026-01', '0.21'], ['2026-02', '0.25'], ['2026-03', '0.59'], ['2026-04', '0.40'], ['2026-05', '0.45'],
  ['2026-06', '0.18'], ['2026-07', '-0.03'], ['2026-08', '0.01'],
]
const indice = new Map(REAIS)

describe('periodoSugerido', () => {
  it('12 meses terminando no último publicado, atravessando o ano', () => {
    expect(periodoSugerido('2026-08')).toEqual({ inicial: '2025-09', final: '2026-08' })
    expect(periodoSugerido('2026-01')).toEqual({ inicial: '2025-02', final: '2026-01' })
  })
})

describe('calcularPeriodo', () => {
  it('acumulado real set/2025–ago/2026 = 3,55 %', () => {
    const r = calcularPeriodo('2025-09', '2026-08', indice)
    expect(r).toMatchObject({ ok: true, fator: '1.035543', acumuladoPct: '3.55' })
    if (r.ok) expect(r.meses).toHaveLength(12)
  })
  it('um mês só, inclusive negativo', () => {
    expect(calcularPeriodo('2026-07', '2026-07', indice)).toMatchObject({ ok: true, fator: '0.999700', acumuladoPct: '-0.03' })
  })
  it('mês sem índice não calcula e diz qual falta', () => {
    expect(calcularPeriodo('2026-07', '2026-09', indice)).toEqual({ ok: false, faltando: ['2026-09'] })
  })
  it('período invertido é erro', () => {
    expect(calcularPeriodo('2026-08', '2026-07', indice)).toEqual({ ok: false, erro: 'o mês inicial é depois do final' })
  })
})

describe('corrigirValor', () => {
  it('usa o fator completo e arredonda só no fim, meio para cima', () => {
    const fator = fatorCompleto(REAIS.slice(1).map(([, variacao]) => ({ variacao })))
    expect(corrigirValor('10000', fator)).toBe('10355.43')
    expect(corrigirValor('0.5', new Decimal('1.01'))).toBe('0.51') // 0.505 → 0.51
  })
})
