import { indiceDoMes, mesDaLinha, separarFaturado } from './meses'

// Rótulos reais dos controles (varredura de 30/09/2026 no dev).
it.each([
  ['Ago/26', 2026, 8],
  ['AGO/2026', 2026, 8],
  ['Agosto/2026 - PACOTE 2', 2026, 8],
  ['01/08/2026 à 31/08/2026', 2026, 8],
  ['21/08/2026 a 20/09/2026', 2026, 9],
  ['21/01/26 a 20/02/26', 2026, 2],
  ['21/02/2025 á 20/03/2025', 2025, 3],
  ['OUT/26-27DIAS', 2026, 10],
  ['DEZ/25-17DD', 2025, 12],
  ['MAR/26 - 21/02/2026 A 20/03/2026', 2026, 3],
  ['ABR/25 - 21/03/2026 A 20/04/2026', 2026, 4],
  ['MÊS 01 - JUL/23', 2023, 7],
  ['MÊS 28 - JAN-25', 2025, 1],
  ['AGO/26 (MEDIDO)', 2026, 8],
  ['01/01/2027 à 07/01/2027-07DD', 2027, 1],
])('%s', (rotulo, ano, mes) => {
  expect(mesDaLinha(rotulo)).toBe(indiceDoMes(ano, mes))
})

it.each(['MÊS 12', 'FEV/265', 'MAR/6', 'FEZ/2026', ''])('sem mês identificável: "%s"', (rotulo) => {
  expect(mesDaLinha(rotulo)).toBeNull()
})

const l = (rotulo: string, valor: string) => ({ rotulo, valor })

it('meses depois do controle ficam à frente, fora do faturado', () => {
  const r = separarFaturado([l('jul/26', '100.00'), l('ago/26', '100.00'), l('set/26', '100.00'), l('OUT/26-27DIAS', '90.00')], '2026-08')
  expect(r).toEqual({ ateOMes: '200.00', aFrente: [l('set/26', '100.00'), l('OUT/26-27DIAS', '90.00')], semMes: [], foraDeOrdem: [], ultimo: 'ago/26' })
})

it('primeira linha com o ano errado (a tabela é cronológica): conta como faturado e é apontada', () => {
  // FTM 94/2024, controle de ago/2026: "OUT/26-3DIAS" é out/25.
  const r = separarFaturado([l('OUT/26-3DIAS', '666.98'), l('nov/25', '6669.98'), l('ago/26', '3755.20'), l('set/26', '12702.23')], '2026-08')
  expect(r.ateOMes).toBe('11092.16')
  expect(r.foraDeOrdem).toEqual(['OUT/26-3DIAS'])
  expect(r.aFrente).toEqual([l('set/26', '12702.23')])
})

it('mês desconhecido no meio conta; no fim, com valor, fica fora (não dá pra provar)', () => {
  const r = separarFaturado([l('jun/26', '10.00'), l('FEZ/2026', '5.00'), l('ago/26', '10.00'), l('MÊS 14', '7.00'), l('MÊS 15', '0.00')], '2026-08')
  expect(r.ateOMes).toBe('25.00')
  expect(r.semMes).toEqual([l('MÊS 14', '7.00')])
})

it('linhas zeradas à frente não aparecem; último faturado ignora zero', () => {
  const r = separarFaturado([l('jul/26', '50.00'), l('ago/26', '0.00'), l('set/26', '0.00')], '2026-08')
  expect(r).toEqual({ ateOMes: '50.00', aFrente: [], semMes: [], foraDeOrdem: [], ultimo: 'jul/26' })
})

it('última linha com o ano errado (SMSUB 01/2026: "21/12/2026 a 20/01/2026") não puxa o futuro para o faturado', () => {
  const r = separarFaturado([l('jul/26', '100.00'), l('ago/26', '100.00'), l('set/26', '100.00'), l('out/26', '100.00'), l('21/12/2026 a 20/01/2026', '0.00')], '2026-08')
  expect(r).toEqual({ ateOMes: '200.00', aFrente: [l('set/26', '100.00'), l('out/26', '100.00')], semMes: [], foraDeOrdem: [], ultimo: 'ago/26' })
  const comValor = separarFaturado([l('jul/26', '100.00'), l('ago/26', '100.00'), l('set/26', '100.00'), l('21/12/2026 a 20/01/2026', '50.00')], '2026-08')
  expect(comValor.ateOMes).toBe('200.00')
  expect(comValor.semMes).toEqual([l('21/12/2026 a 20/01/2026', '50.00')])
  expect(comValor.foraDeOrdem).toEqual(['21/12/2026 a 20/01/2026'])
})

it('"MÊS n" pelo início da vigência do controle (SPURB 010/2026: 25/06/2026, MÊS 1 termina em julho)', () => {
  const inicio = new Date(Date.UTC(2026, 5, 25))
  expect(mesDaLinha('MÊS 1', inicio)).toBe(indiceDoMes(2026, 7))
  expect(mesDaLinha('MÊS 3', inicio)).toBe(indiceDoMes(2026, 9))
  expect(separarFaturado([l('MÊS 1', '52051.14')], '2026-08', inicio).ateOMes).toBe('52051.14')
  expect(separarFaturado([l('MÊS 1', '52051.14')], '2026-08').semMes).toHaveLength(1)
})

it('ordem dos meses que não fecha nem tirando os fora de ordem: faturado até o mês não é mostrado', () => {
  expect(separarFaturado([l('mar/26', '1.00'), l('abr/26', '1.00'), l('jan/26', '1.00'), l('fev/26', '1.00')], '2026-08').ateOMes).toBeNull()
})
