jest.mock('./apelidos-clientes.json', () => ({ SMSUB: ['subprefeituras'] }), { virtual: false })
import { apelidosDoCliente } from './apelidos'

it.each([
  ['Secretaria Municipal da Saúde', 'SMS', ['saude']],
  ['Secretaria Municipal de Educação', 'SME', ['educacao']],
  ['Secretaria Municipal de Inovação e Tecnologia', 'SMIT', ['inovacao e tecnologia']],
  ['Subprefeitura Pinheiros', 'SUB-PI', ['pinheiros']],
  ['Serviço Funerário do Município de São Paulo', 'SFMSP', ['funerario']],
  ['Secretaria Municipal das Subprefeituras', 'SMSUB', ['subprefeituras']],
  ['Empresa de Cinema e Audiovisual de São Paulo - SPCine', null, ['cinema e audiovisual de sao paulo']],
])('%s', (nome, sigla, esperado) => {
  expect(apelidosDoCliente({ nome, siglaLegado: sigla })).toEqual(esperado)
})
