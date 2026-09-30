import { dataParaMes, mesDeHoje, mesParaData, mesesEntre, nomeDoMes, somarMeses } from './meses'

describe('meses AAAA-MM', () => {
  it('soma e subtrai atravessando o ano', () => {
    expect(somarMeses('2026-01', -1)).toBe('2025-12')
    expect(somarMeses('2025-09', 11)).toBe('2026-08')
    expect(somarMeses('2026-12', 1)).toBe('2027-01')
  })
  it('lista o período inclusive e vazio quando invertido', () => {
    expect(mesesEntre('2025-11', '2026-02')).toEqual(['2025-11', '2025-12', '2026-01', '2026-02'])
    expect(mesesEntre('2026-02', '2026-02')).toEqual(['2026-02'])
    expect(mesesEntre('2026-03', '2026-02')).toEqual([])
  })
  it('nome curto em pt-BR', () => {
    expect(nomeDoMes('2026-08')).toBe('ago/2026')
    expect(nomeDoMes('2025-12')).toBe('dez/2025')
  })
  it('converte de e para Date UTC do dia 1', () => {
    expect(mesParaData('2026-08').toISOString()).toBe('2026-08-01T00:00:00.000Z')
    expect(dataParaMes(new Date('2026-08-01T00:00:00Z'))).toBe('2026-08')
  })
  it('mês de hoje no fuso de São Paulo', () => {
    // 01/10 01:00 UTC ainda é 30/09 em São Paulo
    expect(mesDeHoje(new Date('2026-10-01T01:00:00Z'))).toBe('2026-09')
    expect(mesDeHoje(new Date('2026-10-01T12:00:00Z'))).toBe('2026-10')
  })
})
