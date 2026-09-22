/** @jest-environment node */
import { NextRequest } from 'next/server'

jest.mock('@/lib/auth', () => ({
  ...jest.requireActual('@/lib/auth'),
  getAuthUser: jest.fn(),
}))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    demanda: { findUnique: jest.fn() },
    tramiteDemanda: { create: jest.fn() },
    usuario: { findUnique: jest.fn() },
  },
}))

import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { POST } from './route'

const admin = { id: 'u1', nome: 'Admin', email: 'a@x', role: 'admin' as const }
const comum = { id: 'u2', nome: 'Comum', email: 'c@x', role: 'responsavel' as const }
const contexto = { params: Promise.resolve({ id: 'd1' }) }
const post = (corpo: unknown) =>
  new NextRequest('http://localhost/api/demandas/d1/tramites', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo),
  })

beforeEach(() => {
  jest.clearAllMocks()
  ;(getAuthUser as jest.Mock).mockResolvedValue(admin)
  ;(prisma.demanda.findUnique as jest.Mock).mockResolvedValue({ id: 'd1', clienteId: 'c1' })
})

describe('POST /api/demandas/[id]/tramites', () => {
  it('401 sem usuário', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(null)
    expect((await POST(post({ data: '2026-09-22' }), contexto)).status).toBe(401)
  })

  it('404 quando a demanda não existe', async () => {
    ;(prisma.demanda.findUnique as jest.Mock).mockResolvedValue(null)
    expect((await POST(post({ data: '2026-09-22' }), contexto)).status).toBe(404)
  })

  it('403 sem permissão no cliente da demanda', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(comum)
    ;(prisma.usuario.findUnique as jest.Mock).mockResolvedValue({ clientesPermitidos: [] })
    expect((await POST(post({ data: '2026-09-22' }), contexto)).status).toBe(403)
  })

  it('400 sem data, com rótulo em português', async () => {
    const resposta = await POST(post({ posicao: 'x' }), contexto)
    expect(resposta.status).toBe(400)
    await expect(resposta.json()).resolves.toEqual({ error: 'Desde: campo obrigatório' })
  })

  it('cria o trâmite na demanda da URL', async () => {
    ;(prisma.tramiteDemanda.create as jest.Mock).mockImplementation(({ data }) => ({ id: 't9', ...data }))
    const resposta = await POST(
      post({ data: '2026-09-22', posicao: 'Aguardando assinatura', responsavelAtual: 'SMS', assinado: false, demandaId: 'outra' }),
      contexto
    )
    expect(resposta.status).toBe(201)
    expect(prisma.tramiteDemanda.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          demandaId: 'd1',
          data: new Date('2026-09-22T00:00:00Z'),
          posicao: 'Aguardando assinatura',
          responsavelAtual: 'SMS',
          assinado: false,
        },
      })
    )
  })
})
