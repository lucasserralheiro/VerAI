/** @jest-environment node */
import { NextRequest } from 'next/server'

jest.mock('@/lib/auth', () => ({ ...jest.requireActual('@/lib/auth'), getAuthUser: jest.fn() }))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    usuario: { count: jest.fn() },
    gerencia: { count: jest.fn() },
    cliente: { count: jest.fn() },
  },
}))

import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { GET } from './route'

const req = () => new NextRequest('http://localhost/api/admin/resumo')

beforeEach(() => jest.clearAllMocks())

describe('GET /api/admin/resumo', () => {
  it('403 para não admin', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue({ id: 'u2', role: 'responsavel' })
    expect((await GET(req())).status).toBe(403)
  })

  it('devolve as quatro contagens', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue({ id: 'u1', role: 'admin' })
    ;(prisma.usuario.count as jest.Mock).mockResolvedValue(7)
    ;(prisma.gerencia.count as jest.Mock).mockResolvedValue(3)
    ;(prisma.cliente.count as jest.Mock).mockResolvedValueOnce(40).mockResolvedValueOnce(5)
    const r = await GET(req())
    expect(r.status).toBe(200)
    await expect(r.json()).resolves.toEqual({ usuarios: 7, gerencias: 3, clientes: 40, semGerencia: 5 })
    expect(prisma.gerencia.count).toHaveBeenCalledWith({ where: { ativa: true } })
    expect(prisma.cliente.count).toHaveBeenLastCalledWith({ where: { carteira: null } })
  })
})
