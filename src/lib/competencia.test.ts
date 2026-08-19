/**
 * @jest-environment node
 */
import { parseCompetencia, formatarCompetencia, nomeCompetencia } from './competencia'

describe('formatarCompetencia', () => {
  it('monta AAAA-MM com mês em dois dígitos', () => {
    expect(formatarCompetencia(2026, 8)).toBe('2026-08')
    expect(formatarCompetencia(2026, 12)).toBe('2026-12')
  })
})

describe('parseCompetencia', () => {
  it('lê AAAA-MM válido', () => {
    expect(parseCompetencia('2026-08')).toEqual({ ano: 2026, mes: 8 })
  })

  it('retorna null pra formato inválido', () => {
    expect(parseCompetencia('agosto-2026')).toBeNull()
    expect(parseCompetencia('2026-8')).toBeNull()
  })

  it('retorna null pra mês fora de 1-12', () => {
    expect(parseCompetencia('2026-13')).toBeNull()
    expect(parseCompetencia('2026-00')).toBeNull()
  })
})

describe('nomeCompetencia', () => {
  it('monta "Mês/Ano" em português', () => {
    expect(nomeCompetencia(2026, 8)).toBe('Agosto/2026')
    expect(nomeCompetencia(2026, 1)).toBe('Janeiro/2026')
  })
})
