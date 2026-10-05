import { colunaParaLetra, colunasCitadas, letraParaColuna, traduzirFormula, type MapaDeColunas } from './formulas'

// Memória de cálculo: E = preço (→ L), H = total (→ M). Cronograma: C..I (→ J..P).
const mapa: MapaDeColunas = new Map([
  ['Memória Cálculo', new Map([[5, 12], [8, 13]])],
  ['Cronograma', new Map([[3, 10], [4, 11], [5, 12], [6, 13], [7, 14], [8, 15], [9, 16]])],
])

describe('letras de coluna', () => {
  it('ida e volta', () => {
    expect(letraParaColuna('A')).toBe(1)
    expect(letraParaColuna('AA')).toBe(27)
    expect(colunaParaLetra(28)).toBe('AB')
    expect(colunaParaLetra(letraParaColuna('XFD'))).toBe('XFD')
  })
})

describe('traduzirFormula', () => {
  it('total refeito com o preço corrigido; qtde e meses continuam os originais', () => {
    expect(traduzirFormula('ROUND(E6*F6*G6,2)', 'Memória Cálculo', mapa)).toEqual({ tipo: 'traduzida', formula: 'ROUND(L6*F6*G6,2)' })
  })
  it('subtotal e total geral somam as colunas corrigidas', () => {
    expect(traduzirFormula('SUM(H6:H9)', 'Memória Cálculo', mapa)).toEqual({ tipo: 'traduzida', formula: 'SUM(M6:M9)' })
    expect(traduzirFormula('SUM(H5,H10,H13)', 'Memória Cálculo', mapa)).toEqual({ tipo: 'traduzida', formula: 'SUM(M5,M10,M13)' })
  })
  it('referência a outra aba, com $ e intervalo de várias colunas', () => {
    expect(traduzirFormula("'Memória Cálculo'!H5", 'Cronograma', mapa)).toEqual({ tipo: 'traduzida', formula: "'Memória Cálculo'!M5" })
    expect(traduzirFormula('ROUND(C$16/12,2)', 'Cronograma', mapa)).toEqual({ tipo: 'traduzida', formula: 'ROUND(J$16/12,2)' })
    expect(traduzirFormula('SUM(C3:H3)', 'Cronograma', mapa)).toEqual({ tipo: 'traduzida', formula: 'SUM(J3:O3)' })
  })
  it('sem coluna marcada, intervalo misto e texto entre aspas', () => {
    expect(traduzirFormula('F6*G6', 'Memória Cálculo', mapa)).toEqual({ tipo: 'sem-coluna-marcada' })
    expect(traduzirFormula('SUM(D6:F6)', 'Memória Cálculo', mapa)).toEqual({ tipo: 'intraduzivel' })
    expect(traduzirFormula('IF(E6>0,"E6",0)', 'Memória Cálculo', mapa)).toEqual({ tipo: 'traduzida', formula: 'IF(L6>0,"E6",0)' })
  })
  it('nome de função com dígito não é referência', () => {
    expect(traduzirFormula('LOG10(E6)', 'Memória Cálculo', mapa)).toEqual({ tipo: 'traduzida', formula: 'LOG10(L6)' })
  })
})

describe('colunasCitadas', () => {
  it('cada referência com as colunas que cobre', () => {
    expect(colunasCitadas("SUM(C3:E3)+'Memória Cálculo'!H5", 'Cronograma')).toEqual([
      { aba: 'Cronograma', colunas: [3, 4, 5] },
      { aba: 'Memória Cálculo', colunas: [8] },
    ])
  })
})
