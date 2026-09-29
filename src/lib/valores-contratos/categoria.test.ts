import { aceitaCategoria, categoriaDoValor } from './categoria'

// Trechos reais da varredura de 28/09/2026 (fichas dos termos do dev).
it.each([
  ['VALOR TOTAL ESTIMADO DA SUPRESSÃO: R$ 72.032,85 (setenta e dois mil)', 'R$ 72.032,85', 'diferenca'],
  ['VALOR DO APOSTILAMENTO: R$ 20.039,52 (vinte mil)', 'R$ 20.039,52', 'diferenca'],
  ['no valor de complementar de R$ 9.075,96 (nove mil)', 'R$ 9.075,96', 'diferenca'],
  ['2.1. Em razão do acréscimo previsto no item 1.1, o valor do contrato passa para R$ 97.181,62 (noventa)', 'R$ 97.181,62', 'novo-total'],
  ['Com a aplicação do reajuste, o valor total do contrato passa para R$ 294.171,25 (duzentos)', 'R$ 294.171,25', 'novo-total'],
  ['VALOR DESTE ATUALIZADO DO CONTRATO: R$ 17.553.608,29 (dezessete)', 'R$ 17.553.608,29', 'novo-total'],
  ['passando o valor do contrato de R$ 5.808.984,99 para R$ 6.488.055,34 (seis milhões)', 'R$ 6.488.055,34', 'novo-total'],
  ['Alterase o valor contratual passando de R$ 3.236.555,44 (três milhões) – SEM REAJSUTE , para R$ 3.236.490,90 (três)', 'R$ 3.236.490,90', 'novo-total'],
  [
    'VALOR DO TERMO: Passa de R$ 42.047.395,56 (quarenta e dois milhões, quarenta e sete mil, trezentos e noventa e cinco reais e cinquenta e seis centavos) para R$ 63.071.057,11 (sessenta)',
    'R$ 63.071.057,11',
    'novo-total',
  ],
  ['1.2 O valor mensal da presente contratação será de R$ 240.136,20 (duzentos), perfazendo o valor total de R$ 2.881.634,64 (dois)', 'R$ 2.881.634,64', 'total'],
  ['VALOR INICIAL DO CONTRATO: R$ 169.348,90 (cento)', 'R$ 169.348,90', 'inicial'],
  ['O valor total estimado do Contrato nª 068/SMDHC/2020, para o período ora prorrogado pelo presente Termo de aditamento, é de R$ 3.151.984,05 (Três)', 'R$ 3.151.984,05', 'periodo'],
  ['VALOR DO ADITAMENTO: R$ 823.635,30 (oitocentos)', 'R$ 823.635,30', 'periodo'],
  ['O valor estimado do contrato é de R$ 53.066,17 (cinquenta)', 'R$ 53.066,17', 'total'],
  ['8.1 - O preço total do presente contrato é de R$ 2.173.536,00 (dois milhões)', 'R$ 2.173.536,00', 'total'],
  ['BRL 33.665.04', '33.665.04', 'ambiguo'],
])('%s', (trecho, valor, categoria) => {
  expect(categoriaDoValor(trecho, valor)).toBe(categoria)
})

it('categorias aceitas por tipo de linha', () => {
  expect(aceitaCategoria('CONTRATO', 'total')).toBe(true)
  expect(aceitaCategoria('CONTRATO', 'periodo')).toBe(false)
  expect(aceitaCategoria('PRORROGACAO', 'periodo')).toBe(true)
  expect(aceitaCategoria('PRORROGACAO', 'novo-total')).toBe(true)
  expect(aceitaCategoria('ADITIVO', 'novo-total')).toBe(true)
  expect(aceitaCategoria('ADITIVO', 'periodo')).toBe(false)
  expect(aceitaCategoria('ADITIVO', 'total')).toBe(false)
  expect(aceitaCategoria('RESCISAO', 'total')).toBe(false)
})
