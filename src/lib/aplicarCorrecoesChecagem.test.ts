import { aplicarCorrecoesChecagem } from './aplicarCorrecoesChecagem'

describe('aplicarCorrecoesChecagem', () => {
  it('substitui cada trecho pela correção sugerida e conta quantas aplicou', () => {
    const resultado = aplicarCorrecoesChecagem('início Valor: R$ 100 meio Page 2 of 45 fim', [
      { trecho: 'Valor: R$ 100', correcaoSugerida: 'Valor: R$ 1.000' },
      { trecho: 'Page 2 of 45', correcaoSugerida: 'Página 2 de 45' },
    ])

    expect(resultado.markdown).toBe('início Valor: R$ 1.000 meio Página 2 de 45 fim')
    expect(resultado.aplicadas).toBe(2)
  })

  it('ignora item sem correcaoSugerida (null/undefined)', () => {
    const resultado = aplicarCorrecoesChecagem('texto original', [
      { trecho: 'texto', correcaoSugerida: null },
      { trecho: 'original', correcaoSugerida: undefined },
    ])

    expect(resultado.markdown).toBe('texto original')
    expect(resultado.aplicadas).toBe(0)
  })

  it('ignora item onde correcaoSugerida é igual ao trecho (no-op)', () => {
    const resultado = aplicarCorrecoesChecagem('nada muda aqui', [{ trecho: 'nada muda', correcaoSugerida: 'nada muda' }])

    expect(resultado.markdown).toBe('nada muda aqui')
    expect(resultado.aplicadas).toBe(0)
  })

  it('ignora item cujo trecho não existe mais no markdown atual', () => {
    const resultado = aplicarCorrecoesChecagem('documento já editado manualmente', [
      { trecho: 'texto que não existe mais', correcaoSugerida: 'outra coisa' },
    ])

    expect(resultado.markdown).toBe('documento já editado manualmente')
    expect(resultado.aplicadas).toBe(0)
  })

  it('ignora trecho ambíguo (aparece mais de uma vez) — a correção foi ancorada só numa página', () => {
    const resultado = aplicarCorrecoesChecagem('X e X de novo', [{ trecho: 'X', correcaoSugerida: 'Y' }])

    expect(resultado.markdown).toBe('X e X de novo')
    expect(resultado.aplicadas).toBe(0)
  })
})
