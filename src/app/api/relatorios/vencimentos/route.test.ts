/** @jest-environment node */
import { NextRequest } from 'next/server'

jest.mock('@/lib/auth', () => ({
  ...jest.requireActual('@/lib/auth'),
  getAuthUser: jest.fn(),
}))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    contrato: { findMany: jest.fn() },
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
const get = () => new NextRequest('http://localhost/api/relatorios/vencimentos')

const contrato = (id: string, situacao: string | null, dataVencimento: Date | null) => ({
  id,
  clienteId: 'c1',
  numeroTermo: `T-${id}`,
  descricao: null,
  seiCliente: null,
  seiProdam: null,
  situacao,
  dataInicio: null,
  dataVencimento,
  vigente: false,
  linkSei: null,
  cliente: { id: 'c1', nome: 'Saúde', siglaLegado: 'SMS' },
})

beforeEach(() => {
  jest.clearAllMocks()
  ;(getAuthUser as jest.Mock).mockResolvedValue(admin)
  ;(prisma.usuario.findUnique as jest.Mock).mockResolvedValue({ clientesPermitidos: [{ id: 'c1' }] })
  ;(prisma.contrato.findMany as jest.Mock).mockResolvedValue([])
  ;(prisma.itemContrato.groupBy as jest.Mock).mockResolvedValue([])
  ;(prisma.$queryRaw as jest.Mock).mockResolvedValue([])
})

describe('GET /api/relatorios/vencimentos', () => {
  it('401 sem usuário', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(null)
    expect((await GET(get())).status).toBe(401)
  })

  it('filtra pelos clientes visíveis e ordena pelos que vencem primeiro', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(comum)
    await GET(get())
    expect(prisma.contrato.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { cliente: { id: { in: ['c1'] } } },
        orderBy: [{ dataVencimento: { sort: 'asc', nulls: 'last' } }, { numeroTermo: 'asc' }],
      })
    )
  })

  it('cada contrato traz cliente, semáforo, saldo e se está ativo', async () => {
    ;(prisma.contrato.findMany as jest.Mock).mockResolvedValue([
      contrato('k1', 'Ativo', new Date('2099-01-01T03:00:00Z')),
      contrato('k2', 'Finalizado', null),
    ])
    ;(prisma.itemContrato.groupBy as jest.Mock).mockResolvedValue([{ contratoId: 'k1', _sum: { valorTotal: '1000' } }])

    const corpo = await (await GET(get())).json()

    expect(corpo).toHaveLength(2)
    expect(corpo[0]).toMatchObject({
      id: 'k1',
      cliente: { siglaLegado: 'SMS' },
      ativo: true,
      vencimento: { nivel: 'ok' },
      saldo: { valorItens: '1000', saldo: '1000' },
    })
    expect(corpo[1]).toMatchObject({ id: 'k2', ativo: false, vencimento: { nivel: 'sem-data' } })
  })
})
