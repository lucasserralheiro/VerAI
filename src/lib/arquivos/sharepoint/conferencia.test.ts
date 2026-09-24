import { conferir } from './conferencia'

it('por cliente: quantos no SharePoint, quantos no VerAI e quais faltam', () => {
  const esperados = new Map([
    ['SMS/TC 1/a.pdf', 'Saúde'],
    ['SMS/TC 1/b.pdf', 'Saúde'],
    ['SGM/TC 2/c.pdf', 'Governo'],
  ])
  expect(conferir(esperados, new Set(['SMS/TC 1/a.pdf', 'SGM/TC 2/c.pdf']))).toEqual([
    { cliente: 'Governo', noSharepoint: 1, noVerai: 1, faltando: [] },
    { cliente: 'Saúde', noSharepoint: 2, noVerai: 1, faltando: ['SMS/TC 1/b.pdf'] },
  ])
})
