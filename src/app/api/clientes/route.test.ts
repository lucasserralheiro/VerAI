/** @jest-environment node */
import { NextRequest } from 'next/server'

jest.mock('@/lib/auth', () => ({
  ...jest.requireActual('@/lib/auth'),
  getAuthUser: jest.fn(),
}))
jest.mock('@/lib/prisma', () => ({
  prisma: { cliente: { findMany: jest.fn() } },
}))

import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { GET } from './route'

describe('GET /api/clientes', () => {
  it('401 sem usuário', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(null)
    const resposta = await GET(new NextRequest('http://localhost/api/clientes'))
    expect(resposta.status).toBe(401)
  })

  it('lista com a sigla do legado', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue({ id: 'u1', nome: 'A', email: 'a@x', role: 'admin' })
    ;(prisma.cliente.findMany as jest.Mock).mockResolvedValue([
      { id: 'c1', nome: 'Saúde', siglaLegado: 'SMS', carteira: { gerencia: { id: 'g1', nome: 'GCR' } } },
      { id: 'c2', nome: 'Obras', siglaLegado: 'SMUL', carteira: null },
    ])
    const resposta = await GET(new NextRequest('http://localhost/api/clientes'))
    await expect(resposta.json()).resolves.toEqual([
      { id: 'c1', nome: 'Saúde', siglaLegado: 'SMS', gerencia: { id: 'g1', nome: 'GCR' } },
      { id: 'c2', nome: 'Obras', siglaLegado: 'SMUL', gerencia: null },
    ])
    expect(prisma.cliente.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          carteira: { select: { gerencia: { select: { id: true, nome: true } } } },
        }),
      })
    )
  })
})
