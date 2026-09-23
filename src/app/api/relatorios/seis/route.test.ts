/** @jest-environment node */
import { NextRequest } from 'next/server'

jest.mock('@/lib/auth', () => ({
  ...jest.requireActual('@/lib/auth'),
  getAuthUser: jest.fn(),
}))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    contrato: { findMany: jest.fn() },
    faturamento: { findMany: jest.fn() },
    usuario: { findUnique: jest.fn() },
  },
}))

import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { GET } from './route'

const admin = { id: 'u1', nome: 'Admin', email: 'a@x', role: 'admin' as const }
const comum = { id: 'u2', nome: 'Comum', email: 'c@x', role: 'responsavel' as const }
const get = (query = '') => new NextRequest(`http://localhost/api/relatorios/seis${query}`)

beforeEach(() => {
  jest.clearAllMocks()
  ;(getAuthUser as jest.Mock).mockResolvedValue(admin)
  ;(prisma.usuario.findUnique as jest.Mock).mockResolvedValue({ clientesPermitidos: [{ id: 'c1' }] })
  ;(prisma.contrato.findMany as jest.Mock).mockResolvedValue([])
  ;(prisma.faturamento.findMany as jest.Mock).mockResolvedValue([])
})

describe('GET /api/relatorios/seis', () => {
  it('401 sem usuário', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(null)
    expect((await GET(get())).status).toBe(401)
  })

  it('filtra pelos clientes visíveis e pelo cliente pedido, só com SEI preenchido', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(comum)
    await GET(get('?clienteId=c1'))
    expect(prisma.contrato.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          cliente: { id: { in: ['c1'] } },
          clienteId: 'c1',
          OR: [{ seiCliente: { not: null } }, { seiProdam: { not: null } }, { linkSei: { not: null } }],
        },
      })
    )
    expect(prisma.faturamento.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { cliente: { id: { in: ['c1'] } }, clienteId: 'c1', sei: { not: null } } })
    )
  })

  it('devolve os SEIs de contrato e de faturamento', async () => {
    ;(prisma.contrato.findMany as jest.Mock).mockResolvedValue([{ id: 'k1', seiCliente: '6018.2024/0001-1' }])
    ;(prisma.faturamento.findMany as jest.Mock).mockResolvedValue([{ id: 'f1', sei: '7010.2026/0002-2' }])
    const corpo = await (await GET(get())).json()
    expect(corpo).toEqual({
      contratos: [{ id: 'k1', seiCliente: '6018.2024/0001-1' }],
      faturamentos: [{ id: 'f1', sei: '7010.2026/0002-2' }],
    })
  })
})
