import { extensoDoTrecho, numeroPorExtenso } from './extenso'

it('número por extenso', () => {
  expect(numeroPorExtenso('dois milhões, duzentos e sete mil, novecentos e noventa e dois reais e vinte centavos')).toBe(2207992.2)
  expect(numeroPorExtenso('um milhão, oitocentos e oitenta e sete mil, quinhentos e doze reais e vinte e dois centavos')).toBe(1887512.22)
  expect(numeroPorExtenso('cento e sessenta e nove mil, trezentos e quarenta e oito reais e noventa centavos')).toBe(169348.9)
  expect(numeroPorExtenso('mil e duzentos reais')).toBe(1200)
  expect(numeroPorExtenso('sem número nenhum')).toBeNull()
})

it('confere o número com o extenso logo depois dele', () => {
  expect(extensoDoTrecho('é de R$ 2.207.992,20 (dois milhões, duzentos e sete mil, novecentos e noventa e dois reais e vinte centavos)', 'R$ 2.207.992,20')).toBe('igual')
  // Documento que se contradiz (varredura de 28/09): número e extenso diferentes.
  expect(
    extensoDoTrecho('o valor do contrato passa para R$ 97.181,62 (noventa e quatro mil e trezentos e trinta e seis reais e e dezoito centavos).', 'R$ 97.181,62')
  ).toBe('diferente')
})

it('sem extenso, ou extenso cortado antes de "reais": não dá para conferir', () => {
  expect(extensoDoTrecho('VALOR DO ADITAMENTO: R$ 823.635,30', 'R$ 823.635,30')).toBeNull()
  expect(extensoDoTrecho('perfazendo o valor total de R$ 2.881.634,64 (dois milhões e o', 'R$ 2.881.634,64')).toBeNull()
  expect(extensoDoTrecho('outro texto', 'R$ 1,00')).toBeNull()
})
