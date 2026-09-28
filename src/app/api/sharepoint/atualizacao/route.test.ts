/** @jest-environment node */
import { NextRequest } from 'next/server'

jest.mock('@/lib/auth', () => ({
  ...jest.requireActual('@/lib/auth'),
  getAuthUser: jest.fn(),
}))
jest.mock('@/lib/prisma', () => ({
  prisma: { atualizacaoSharepoint: { findFirst: jest.fn() } },
}))

import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { GET } from './route'

const pedido = () => new NextRequest('http://localhost/api/sharepoint/atualizacao')

describe('GET /api/sharepoint/atualizacao', () => {
  it('401 sem usuário', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(null)
    expect((await GET(pedido())).status).toBe(401)
  })

  it('devolve o início da passada mais recente, para qualquer usuário logado', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue({ id: 'u1', nome: 'A', email: 'a@x', role: 'usuario' })
    ;(prisma.atualizacaoSharepoint.findFirst as jest.Mock).mockResolvedValue({ iniciadaEm: new Date('2026-09-28T13:30:00.000Z') })
    const resposta = await GET(pedido())
    await expect(resposta.json()).resolves.toEqual({ atualizadoEm: '2026-09-28T13:30:00.000Z' })
    expect(prisma.atualizacaoSharepoint.findFirst).toHaveBeenCalledWith({ orderBy: { iniciadaEm: 'desc' }, select: { iniciadaEm: true } })
  })

  it('null quando o banco nunca foi sincronizado', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue({ id: 'u1', nome: 'A', email: 'a@x', role: 'usuario' })
    ;(prisma.atualizacaoSharepoint.findFirst as jest.Mock).mockResolvedValue(null)
    await expect((await GET(pedido())).json()).resolves.toEqual({ atualizadoEm: null })
  })
})
