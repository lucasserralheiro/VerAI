/** @jest-environment node */
import { NextRequest } from 'next/server'

jest.mock('@/lib/auth', () => ({
  ...jest.requireActual('@/lib/auth'),
  getAuthUser: jest.fn(),
}))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    cliente: { findMany: jest.fn() },
    itemContrato: { groupBy: jest.fn() },
    usuario: { findUnique: jest.fn() },
    $queryRaw: jest.fn(),
  },
}))

import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { GET } from './route'

const admin = { id: 'u1', nome: 'Admin', email: 'a@x', role: 'admin' as const }
const comum = { id: 'u2', nome: 'Comum', email: 'c@x', role: 'responsavel' as const }
const get = () => new NextRequest('http://localhost/api/relatorios/valor-total')

beforeEach(() => {
  jest.clearAllMocks()
  ;(getAuthUser as jest.Mock).mockResolvedValue(admin)
  ;(prisma.usuario.findUnique as jest.Mock).mockResolvedValue({ clientesPermitidos: [{ id: 'c1' }] })
  ;(prisma.cliente.findMany as jest.Mock).mockResolvedValue([])
  ;(prisma.itemContrato.groupBy as jest.Mock).mockResolvedValue([])
  ;(prisma.$queryRaw as jest.Mock).mockResolvedValue([])
})

describe('GET /api/relatorios/valor-total', () => {
  it('401 sem usuário', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(null)
    expect((await GET(get())).status).toBe(401)
  })

  it('só lista clientes visíveis', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(comum)
    await GET(get())
    expect(prisma.cliente.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: { in: ['c1'] } } }))
  })

  it('soma itens e faturado dos contratos do cliente, em centavos exatos', async () => {
    ;(prisma.cliente.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'c1',
        nome: 'Saúde',
        siglaLegado: 'SMS',
        contratos: [
          { id: 'k1', situacao: 'Ativo', dataVencimento: null },
          { id: 'k2', situacao: 'Finalizado', dataVencimento: null },
        ],
      },
      { id: 'c2', nome: 'Educação', siglaLegado: 'SME', contratos: [] },
    ])
    ;(prisma.itemContrato.groupBy as jest.Mock).mockResolvedValue([
      { contratoId: 'k1', _sum: { valorTotal: '1000.10' } },
      { contratoId: 'k2', _sum: { valorTotal: '0.20' } },
    ])
    ;(prisma.$queryRaw as jest.Mock).mockResolvedValue([{ contratoId: 'k1', faturado: '250.05' }])

    const corpo = await (await GET(get())).json()

    expect(corpo[0]).toEqual({
      id: 'c1',
      nome: 'Saúde',
      siglaLegado: 'SMS',
      contratos: 2,
      contratosAtivos: 1,
      saldo: { valorItens: '1000.3', faturado: '250.05', saldo: '750.25', percentualFaturado: '25.00' },
    })
    expect(corpo[1]).toMatchObject({ contratos: 0, contratosAtivos: 0, saldo: { saldo: null } })
  })
})
