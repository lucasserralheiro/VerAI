import { formatarData, formatarMoeda } from './formatacao'

describe('formatarMoeda', () => {
  it('formata em reais com separadores brasileiros', () => {
    expect(formatarMoeda(1234.5)).toBe('R$ 1.234,50')
    expect(formatarMoeda('1234567.89')).toBe('R$ 1.234.567,89')
    expect(formatarMoeda(0)).toBe('R$ 0,00')
  })

  it('null ou valor não numérico vira travessão', () => {
    expect(formatarMoeda(null)).toBe('—')
    expect(formatarMoeda('abc')).toBe('—')
  })
})

describe('formatarData', () => {
  it('formata ISO como dd/mm/aaaa, pelo dia em UTC', () => {
    expect(formatarData('2026-09-22T00:00:00.000Z')).toBe('22/09/2026')
    expect(formatarData('2026-01-05')).toBe('05/01/2026')
  })

  it('null ou data inválida vira travessão', () => {
    expect(formatarData(null)).toBe('—')
    expect(formatarData('xx')).toBe('—')
  })
})
