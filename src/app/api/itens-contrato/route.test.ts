/** @jest-environment node */
import { NextRequest } from 'next/server'
import { Prisma } from '@prisma/client'

jest.mock('@/lib/auth', () => ({
  ...jest.requireActual('@/lib/auth'),
  getAuthUser: jest.fn(),
}))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    itemContrato: { findMany: jest.fn() },
    cliente: { count: jest.fn() },
    usuario: { findUnique: jest.fn() },
  },
}))

import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { GET } from './route'

const admin = { id: 'u1', nome: 'Admin', email: 'a@x', role: 'admin' as const }
const comum = { id: 'u2', nome: 'Comum', email: 'c@x', role: 'responsavel' as const }
const get = (query: string) => new NextRequest(`http://localhost/api/itens-contrato${query}`)

beforeEach(() => {
  jest.clearAllMocks()
  ;(getAuthUser as jest.Mock).mockResolvedValue(admin)
  ;(prisma.itemContrato.findMany as jest.Mock).mockResolvedValue([])
  ;(prisma.usuario.findUnique as jest.Mock).mockResolvedValue({ clientesPermitidos: [{ id: 'c1' }] })
  ;(prisma.cliente.count as jest.Mock).mockResolvedValue(1)
})

describe('GET /api/itens-contrato', () => {
  it('401 sem usuário', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(null)
    expect((await GET(get('?semContrato=1'))).status).toBe(401)
  })

  it('400 sem ?semContrato=1 (a rota só serve pra reconciliação)', async () => {
    expect((await GET(get(''))).status).toBe(400)
  })

  it('403 para usuário que não vê nenhum cliente', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(comum)
    ;(prisma.cliente.count as jest.Mock).mockResolvedValue(0)
    expect((await GET(get('?semContrato=1'))).status).toBe(403)
    expect(prisma.itemContrato.findMany).not.toHaveBeenCalled()
  })

  it('usuário que vê algum cliente pode buscar', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(comum)
    expect((await GET(get('?semContrato=1'))).status).toBe(200)
  })

  it('busca itens sem contrato pelo texto legado ou descrição, com limite', async () => {
    ;(prisma.itemContrato.findMany as jest.Mock).mockResolvedValue([
      { id: 'i1', contratoId: null, contratoTextoLegado: '031/SEME/2017', valorTotal: new Prisma.Decimal('10'), quantidade: null, valorUnitario: null },
    ])
    const resposta = await GET(get('?semContrato=1&q=%20seme%20'))
    expect(resposta.status).toBe(200)
    await expect(resposta.json()).resolves.toEqual([expect.objectContaining({ id: 'i1', valorTotal: '10' })])
    expect(prisma.itemContrato.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          contratoId: null,
          OR: [
            { contratoTextoLegado: { contains: 'seme', mode: 'insensitive' } },
            { descricao: { contains: 'seme', mode: 'insensitive' } },
          ],
        },
        take: 100,
      })
    )
  })
})
