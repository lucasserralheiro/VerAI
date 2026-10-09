import { chaveDaGerencia, mesmaSigla, siglaComparavel } from './chaves'

// Os mesmos casos vivem no AIBertinho (src/lib/integracao/chaves.test.ts) — as duas pontas
// precisam produzir a mesma chave.
describe('chaveDaGerencia', () => {
  it.each([
    ['GRC-4', 'GRC4'],
    ['grc4', 'GRC4'],
    ['grc4-beatriz', 'GRC4'],
    ['KAM 2', 'KAM2'],
    ['KAM10', 'KAM10'],
    ['kam3-gercino-teste', 'KAM3'],
    ['GRC-C', 'GRCC'],
    ['grcc-debora', 'GRCC'],
  ])('%s → %s', (entrada, chave) => expect(chaveDaGerencia(entrada)).toBe(chave))

  it.each([null, '', 'Tríade Digital', 'Sem carteira'])('%s não é gerência', (entrada) =>
    expect(chaveDaGerencia(entrada)).toBeNull()
  )
})

describe('sigla do cliente', () => {
  it('ignora acento, caixa, espaço e hífen', () => {
    expect(siglaComparavel('SP REGULA')).toBe('SPREGULA')
    expect(mesmaSigla('SP-REGULA', 'sp regula')).toBe(true)
    expect(mesmaSigla('SPTuris', 'SPTURIS')).toBe(true)
  })
  it('vazio nunca casa', () => {
    expect(mesmaSigla('', '')).toBe(false)
    expect(mesmaSigla(null, null)).toBe(false)
  })
  it('sigla diferente não casa, nem por prefixo', () => {
    expect(mesmaSigla('SF', 'SFM')).toBe(false)
  })
})
