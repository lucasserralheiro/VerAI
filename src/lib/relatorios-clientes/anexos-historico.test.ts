import { anexosDaLinha, categoriaDaColuna, dadosDaColuna, urlDoArquivo } from './anexos-historico'

it('dados do Prisma de uma coluna', () => {
  expect(dadosDaColuna('proposta', 'a1', true)).toEqual({ propostaArquivoId: 'a1', propostaDoSharepoint: true })
  expect(dadosDaColuna('termo', null, false)).toEqual({ termoArquivoId: null, termoDoSharepoint: false })
})

it('monta a forma que a tela já conhece a partir das referências', () => {
  expect(
    anexosDaLinha({ propostaArquivo: { id: 'a1', nome: 'PA-01.pdf' }, termoArquivo: null, propostaDoSharepoint: true, termoDoSharepoint: false })
  ).toEqual({
    propostaPdfUrl: '/api/arquivos/a1?modo=inline',
    propostaPdfNome: 'PA-01.pdf',
    propostaArquivoId: 'a1',
    propostaDoSharepoint: true,
    termoPdfUrl: null,
    termoPdfNome: null,
    termoArquivoId: null,
    termoDoSharepoint: false,
  })
  expect(urlDoArquivo('x')).toBe('/api/arquivos/x?modo=inline')
})

it('categoria do anexo pela coluna e pelo tipo da linha', () => {
  expect(categoriaDaColuna('proposta', 'CONTRATO')).toBe('PROPOSTA_COMERCIAL')
  expect(categoriaDaColuna('proposta', 'ADITIVO')).toBe('PROPOSTA_ADITIVO')
  expect(categoriaDaColuna('termo', 'CONTRATO')).toBe('TERMO_CONTRATO')
  expect(categoriaDaColuna('termo', 'PRORROGACAO')).toBe('TERMO_ADITIVO')
})
