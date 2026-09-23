/** @jest-environment node */
jest.mock('@/lib/prisma', () => ({
  prisma: {
    cliente: { findMany: jest.fn(), findUnique: jest.fn() },
    faturamento: { aggregate: jest.fn() },
  },
}))
jest.mock('@/lib/visibilidade', () => ({ clienteIdsPermitidos: jest.fn(), podeVerCliente: jest.fn() }))
jest.mock('@/lib/relatorios-clientes/contratos-consolidados', () => ({ consolidarContratos: jest.fn() }))

import { prisma } from '@/lib/prisma'
import { clienteIdsPermitidos, podeVerCliente } from '@/lib/visibilidade'
import { consolidarContratos } from '@/lib/relatorios-clientes/contratos-consolidados'
import type { Ferramenta, ContextoFerramenta } from './comum'
import { buscarClientes, resumoDoCliente } from './clientes'

const ctx: ContextoFerramenta = { usuario: { id: 'u', nome: 'U', email: 'u@x', role: 'responsavel' }, hoje: new Date('2026-09-23T12:00:00Z') }
const rodar = <E extends import('zod').ZodType>(f: Ferramenta<E>, entrada: unknown) => f.executar(f.entrada.parse(entrada), ctx)

beforeEach(() => {
  jest.clearAllMocks()
  ;(clienteIdsPermitidos as jest.Mock).mockResolvedValue(['c1'])
  ;(podeVerCliente as jest.Mock).mockImplementation(async (_u, id) => id === 'c1')
})

describe('buscarClientes', () => {
  it('casa nome ou sigla sem acento, só entre os clientes liberados', async () => {
    ;(prisma.cliente.findMany as jest.Mock).mockResolvedValue([
      { id: 'c1', nome: 'Secretaria Municipal de Inovação e Tecnologia', siglaLegado: 'SMIT', _count: { contratos: 3 } },
    ])
    const r = await rodar(buscarClientes, { termo: 'smit' })
    expect((prisma.cliente.findMany as jest.Mock).mock.calls[0][0].where).toEqual({ id: { in: ['c1'] } })
    expect(r).toEqual({ total: 1, clientes: [{ id: 'c1', nome: 'Secretaria Municipal de Inovação e Tecnologia', sigla: 'SMIT', contratos: 3, href: '/clientes/c1' }] })
    expect(await rodar(buscarClientes, { termo: 'inovacao' })).toMatchObject({ total: 1 })
  })
})

describe('resumoDoCliente', () => {
  it('não encontrado para cliente sem permissão (sem consultar o banco)', async () => {
    expect(await rodar(resumoDoCliente, { clienteId: 'c9' })).toEqual({ erro: 'não encontrado' })
    expect(prisma.cliente.findUnique).not.toHaveBeenCalled()
  })

  it('contratos vêm do consolidado; linha vazia do legado fica de fora', async () => {
    ;(prisma.cliente.findUnique as jest.Mock).mockResolvedValue({
      id: 'c1', nome: 'SMIT', siglaLegado: 'SMIT', endereco: 'Rua X', numero: '10', bairro: 'Centro',
      responsaveis: [{ nome: 'Ana', area: 'TI', email: 'ana@x', telefone: null, celular: null }],
      contratos: [
        { id: 'k1', clienteId: 'c1', numeroTermo: '031/2023', descricao: null, seiCliente: null, seiProdam: null, situacao: null, dataInicio: null, dataVencimento: null, vigente: null, linkSei: null },
        { id: 'k2', clienteId: 'c1', numeroTermo: null, descricao: null, seiCliente: null, seiProdam: null, situacao: null, dataInicio: null, dataVencimento: null, vigente: null, linkSei: null },
      ],
      _count: { demandas: 4, solicitacoes: 2, faturamentos: 10 },
    })
    const base = { vigenciaFim: null, vencimento: { nivel: 'sem-data', dias: null }, rescindido: false, ativo: true, resumoHistorico: { aditivos: 0, prorrogacoes: 0, valorAtual: null, proposta: null, termo: null }, valorBase: '500', saldo: { valorItens: '500', faturado: '100', saldo: '400', percentualFaturado: '20' } }
    ;(consolidarContratos as jest.Mock).mockResolvedValue(new Map([['k1', { ...base, vazio: false }], ['k2', { ...base, vazio: true }]]))
    ;(prisma.faturamento.aggregate as jest.Mock).mockResolvedValue({ _sum: { valor: '1234.5' } })

    const r = (await rodar(resumoDoCliente, { clienteId: 'c1' })) as { contratos: { numero: string; valorContratado: string }[]; totais: Record<string, unknown>; endereco: string }
    expect(r.contratos).toHaveLength(1)
    expect(r.contratos[0]).toMatchObject({ numero: '031/2023', valorContratado: 'R$ 500,00' })
    expect(r.totais).toEqual({ contratos: 1, ativos: 1, faturadoTotal: 'R$ 1.234,50', demandas: 4, solicitacoes: 2, faturamentos: 10 })
    expect(r.endereco).toBe('Rua X, 10, Centro')
  })
})
