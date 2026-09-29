/** @jest-environment node */
jest.mock('@/lib/prisma', () => ({ prisma: {} }))
jest.mock('@/lib/tabela-precos/consultas', () => ({ carregarTabela: jest.fn() }))

import { carregarTabela } from '@/lib/tabela-precos/consultas'
import { consultarTabelaDePrecos } from './precos'

/* eslint-disable @typescript-eslint/no-explicit-any */

const contexto = (role: 'uploader' | 'admin') => ({ usuario: { id: 'u', nome: 'U', email: 'u@x', role }, hoje: new Date('2026-09-29') })
const item = (codigo: string, descricao: string, extra = {}) => ({
  codigo,
  descricao,
  grupo: 'E',
  secoes: 'E - DATA CENTER',
  unidade: 'DOC/MÊS',
  preco: '4.09',
  sobDemanda: false,
  precoTexto: null,
  conferencia: 'confere',
  precoNoPdf: '4.09',
  ...extra,
})

beforeEach(() => {
  ;(carregarTabela as jest.Mock).mockResolvedValue({
    tabela: { versao: '2026 v3.0', publicadaEm: '2026-09-21T00:00:00.000Z' },
    itens: [
      item('14.052.00001.00', 'TID CORPORATIVO ATÉ 4000', { conferencia: 'alterado-pelo-informativo', precoNoPdf: '0.50' }),
      item('10.050.00070.00', 'ANALISTA - ADICIONAL', { preco: null, sobDemanda: true }),
    ],
  })
})

it('busca por palavra e devolve preço, versão e o aviso do informativo — tabela pública: não filtra por cliente', async () => {
  const r = (await consultarTabelaDePrecos.executar({ busca: 'tid', limite: 20 }, contexto('uploader'))) as any
  expect(r).toEqual({
    versao: '2026 v3.0',
    publicadaEm: '21/09/2026',
    total: 1,
    itens: [
      {
        codigo: '14.052.00001.00',
        descricao: 'TID CORPORATIVO ATÉ 4000',
        unidade: 'DOC/MÊS',
        preco: 'R$ 4,09',
        aviso: 'preço alterado pelo informativo depois da publicação (PDF publicado: R$ 0,50)',
      },
    ],
  })
})

it('sob demanda e tabela ainda não lida', async () => {
  const r = (await consultarTabelaDePrecos.executar({ busca: 'adicional', limite: 20 }, contexto('admin'))) as any
  expect(r.itens[0].preco).toBe('sob demanda')
  ;(carregarTabela as jest.Mock).mockResolvedValue(null)
  expect(await consultarTabelaDePrecos.executar({ busca: 'x1', limite: 20 }, contexto('admin'))).toEqual({
    erro: 'a tabela de preços ainda não foi lida da pasta do SharePoint',
  })
})
