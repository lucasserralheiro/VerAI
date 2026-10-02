/** @jest-environment node */
import { NextRequest } from 'next/server'

jest.mock('@/lib/auth', () => ({ ...jest.requireActual('@/lib/auth'), getAuthUser: jest.fn() }))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    cliente: { findUnique: jest.fn() },
    documento: { findUnique: jest.fn(), update: jest.fn() },
    usuario: { findUnique: jest.fn() },
  },
}))

jest.mock('@/lib/ia/evoluir', () => ({ analisarEvolucao: jest.fn() }))

import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { POST } from './route'

const comum = { id: 'u2', nome: 'Comum', email: 'c@x', role: 'responsavel' as const }

describe('POST /api/clientes/[clienteId]/competencias/[competencia]/analise-evolucao — somente leitura', () => {
  it('POST 403 com motivo para quem vê mas não é da gerência', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(comum)
    ;(prisma.usuario.findUnique as jest.Mock).mockResolvedValue({ clientesPermitidos: [], gerencias: [] })
    ;(prisma.cliente.findUnique as jest.Mock).mockResolvedValue({ id: 'c1' })
    ;(prisma.documento.findUnique as jest.Mock).mockResolvedValue({ id: 'd1', clienteId: 'c1' })
    const resposta = await POST(new NextRequest('http://localhost/x', { method: 'POST' }), { params: Promise.resolve({ clienteId: 'c1', competencia: '2026-08' }) })
    expect(resposta.status).toBe(403)
    await expect(resposta.json()).resolves.toMatchObject({
      motivo: 'Somente leitura: só a equipe da gerência deste cliente edita.',
    })
    expect(prisma.documento.update).not.toHaveBeenCalled()
  })
})
