import { custoEstimadoUsd, precosDoAmbiente } from './custo'

it('cache é cobrado pelo preço de cache, o resto pelo cheio', () => {
  // 1M entrada (400k de cache), 100k saída
  expect(custoEstimadoUsd({ entrada: 1_000_000, cache: 400_000, saida: 100_000 }, { entrada: 0.28, entradaCache: 0.028, saida: 0.42 })).toBeCloseTo(
    0.6 * 0.28 + 0.4 * 0.028 + 0.1 * 0.42
  )
})

it('precosDoAmbiente: null se faltar algum', () => {
  const env = process.env
  process.env = { ...env, ASSISTENTE_PRECO_ENTRADA: '0.28', ASSISTENTE_PRECO_ENTRADA_CACHE: '0.028', ASSISTENTE_PRECO_SAIDA: '' }
  expect(precosDoAmbiente()).toBeNull()
  process.env.ASSISTENTE_PRECO_SAIDA = '0.42'
  expect(precosDoAmbiente()).toEqual({ entrada: 0.28, entradaCache: 0.028, saida: 0.42 })
  process.env = env
})
