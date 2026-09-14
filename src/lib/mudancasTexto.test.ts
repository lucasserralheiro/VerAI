import { aplicarMudancas, contextoDaMudanca, mudancasDaChecagem, mudancasEntreTextos } from './mudancasTexto'

describe('mudancasDaChecagem', () => {
  it('ancora cada trecho corrigível na posição dele no texto-base', () => {
    const base = 'início Valor: R$ 100 meio'
    const [mudanca] = mudancasDaChecagem(base, [
      { trecho: 'Valor: R$ 100', correcaoSugerida: 'Valor: R$ 1.000', pagina: 2, motivo: 'número' },
    ])

    expect(mudanca).toMatchObject({
      id: 't0',
      posicoes: [7],
      antes: 'Valor: R$ 100',
      depois: 'Valor: R$ 1.000',
      pagina: 2,
      motivo: 'número',
    })
  })

  it('ignora sem correção, correção igual ao trecho e trecho que sumiu do texto', () => {
    const mudancas = mudancasDaChecagem('um dois três', [
      { trecho: 'um', correcaoSugerida: null },
      { trecho: 'dois', correcaoSugerida: 'dois' },
      { trecho: 'quatro', correcaoSugerida: 'cinco' },
    ])

    expect(mudancas).toEqual([])
  })

  it('trecho ambíguo (aparece mais de uma vez) não vira mudança — evita corrigir ocorrência errada', () => {
    // Sem correção segura tem que descartar, mas trecho AMBÍGUO também: a
    // correção foi ancorada só no texto original de UMA página (ver
    // `correcaoEhSegura` em `checarConversao.ts`), então aplicá-la em toda
    // ocorrência do mesmo texto no documento arrisca corrigir um trecho de
    // OUTRA página que já estava certo. Melhor deixar pra conferência manual.
    const mudancas = mudancasDaChecagem('X e X', [{ trecho: 'X', correcaoSugerida: 'Y' }])
    expect(mudancas).toEqual([])
  })

  it('não corrige um valor que já estava certo só porque é igual, por coincidência, ao trecho errado de outra página', () => {
    const base = ['Valor do item A: R$ 1.500,00', 'Valor do item B: R$ 1.500,00'].join('\n')
    const trechos = [{ trecho: 'R$ 1.500,00', correcaoSugerida: 'R$ 1.550,00', pagina: 1, motivo: 'valor divergente do PDF' }]

    const mudancas = mudancasDaChecagem(base, trechos)

    expect(mudancas).toEqual([])
    expect(aplicarMudancas(base, mudancas)).toBe(base)
  })

  it('não reaplica quando a correção contém o trecho e o texto já está corrigido', () => {
    const trechos = [{ trecho: 'R$ 100', correcaoSugerida: 'R$ 100,00' }]
    const corrigido = aplicarMudancas('Total R$ 100 mensais', mudancasDaChecagem('Total R$ 100 mensais', trechos))

    expect(corrigido).toBe('Total R$ 100,00 mensais')
    expect(mudancasDaChecagem(corrigido, trechos)).toEqual([])
  })

  it('não deixa dois trechos sobrepostos brigarem pelo mesmo pedaço de texto', () => {
    const base = 'R$ 100,00 mensais'
    const mudancas = mudancasDaChecagem(base, [
      { trecho: 'R$ 100,00', correcaoSugerida: 'R$ 1.000,00' },
      { trecho: '100,00 mensais', correcaoSugerida: '1.000,00 mensais' },
    ])

    expect(mudancas).toHaveLength(1)
    expect(aplicarMudancas(base, mudancas)).toBe('R$ 1.000,00 mensais')
  })
})

describe('aplicarMudancas', () => {
  const base = 'A e B e C'
  const mudancas = mudancasDaChecagem(base, [
    { trecho: 'A', correcaoSugerida: 'AA' },
    { trecho: 'C', correcaoSugerida: 'CC' },
  ])

  it('aplica todas quando não recebe o conjunto de ativas', () => {
    expect(aplicarMudancas(base, mudancas)).toBe('AA e B e CC')
  })

  it('aplica só as ativas — desfazer uma é recalcular do base sem ela', () => {
    expect(aplicarMudancas(base, mudancas, new Set(['t1']))).toBe('A e B e CC')
    expect(aplicarMudancas(base, mudancas, new Set())).toBe(base)
  })

  it('nunca aplica em cascata (correção que contém outro trecho)', () => {
    const texto = 'foo bar'
    const lista = mudancasDaChecagem(texto, [
      { trecho: 'foo', correcaoSugerida: 'bar' },
      { trecho: 'bar', correcaoSugerida: 'baz' },
    ])
    expect(aplicarMudancas(texto, lista)).toBe('bar baz')
  })
})

describe('mudancasEntreTextos', () => {
  it('quebra a revisão em mudanças por palavra e reaplicar tudo devolve o corrigido exato', () => {
    const original = 'A proposta e boa. Nao ha acao nenhuma.'
    const corrigido = 'A proposta é boa. Não há ação nenhuma.'
    const mudancas = mudancasEntreTextos(original, corrigido)

    expect(mudancas.map((m) => [m.antes, m.depois])).toEqual([
      ['e', 'é'],
      ['Nao', 'Não'],
      ['ha', 'há'],
      ['acao', 'ação'],
    ])
    expect(aplicarMudancas(original, mudancas)).toBe(corrigido)
  })

  it('aplicar só parte das mudanças mantém o resto do original', () => {
    const original = 'Nao ha acao.'
    const mudancas = mudancasEntreTextos(original, 'Não há ação.')
    const semSegunda = new Set(mudancas.filter((_, i) => i !== 1).map((m) => m.id))

    expect(aplicarMudancas(original, mudancas, semSegunda)).toBe('Não ha ação.')
  })

  it('textos iguais não geram mudança', () => {
    expect(mudancasEntreTextos('igual', 'igual')).toEqual([])
  })
})

describe('contextoDaMudanca', () => {
  it('mostra o texto em volta sem atravessar a linha do Markdown', () => {
    const base = '# Título\n| Item | R$ 100 | mensal |\nOutra linha'
    const posicao = base.indexOf('R$ 100')

    expect(contextoDaMudanca(base, posicao, 'R$ 100'.length)).toEqual({ antes: '| Item | ', depois: ' | mensal |' })
  })

  it('corta em fronteira de palavra e marca com reticências quando a linha continua', () => {
    const base = 'palavra '.repeat(20) + 'ALVO' + ' palavra'.repeat(20)
    const posicao = base.indexOf('ALVO')
    const contexto = contextoDaMudanca(base, posicao, 4, 20)

    expect(contexto.antes.startsWith('…palavra')).toBe(true)
    expect(contexto.depois.endsWith('palavra…')).toBe(true)
  })
})
