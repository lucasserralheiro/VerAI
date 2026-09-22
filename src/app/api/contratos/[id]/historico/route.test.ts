/** @jest-environment node */
import { NextRequest } from 'next/server'
import { Prisma } from '@prisma/client'

jest.mock('@/lib/auth', () => ({
  ...jest.requireActual('@/lib/auth'),
  getAuthUser: jest.fn(),
}))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    contrato: { findUnique: jest.fn() },
    historicoContrato: { create: jest.fn() },
    usuario: { findUnique: jest.fn() },
  },
}))

import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { POST } from './route'

const admin = { id: 'u1', nome: 'Admin', email: 'a@x', role: 'admin' as const }
const comum = { id: 'u2', nome: 'Comum', email: 'c@x', role: 'responsavel' as const }
const contexto = { params: Promise.resolve({ id: 'k1' }) }
const post = (corpo: unknown) =>
  new NextRequest('http://localhost/api/contratos/k1/historico', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo),
  })

beforeEach(() => {
  jest.clearAllMocks()
  ;(getAuthUser as jest.Mock).mockResolvedValue(admin)
  ;(prisma.contrato.findUnique as jest.Mock).mockResolvedValue({ id: 'k1', clienteId: 'c1' })
})

describe('POST /api/contratos/[id]/historico', () => {
  it('401 sem usuário', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(null)
    expect((await POST(post({ tipo: 'ADITIVO' }), contexto)).status).toBe(401)
  })

  it('404 quando o contrato não existe', async () => {
    ;(prisma.contrato.findUnique as jest.Mock).mockResolvedValue(null)
    expect((await POST(post({ tipo: 'ADITIVO' }), contexto)).status).toBe(404)
  })

  it('403 sem permissão no cliente do contrato', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(comum)
    ;(prisma.usuario.findUnique as jest.Mock).mockResolvedValue({ clientesPermitidos: [] })
    expect((await POST(post({ tipo: 'ADITIVO' }), contexto)).status).toBe(403)
    expect(prisma.historicoContrato.create).not.toHaveBeenCalled()
  })

  it('400 sem tipo ou com tipo fora do enum', async () => {
    const semTipo = await POST(post({ numero: '1' }), contexto)
    expect(semTipo.status).toBe(400)
    await expect(semTipo.json()).resolves.toEqual({ error: expect.stringMatching(/^Tipo: /) })
    expect((await POST(post({ tipo: 'RENOVACAO' }), contexto)).status).toBe(400)
  })

  it('cria a linha do histórico no contrato da URL', async () => {
    ;(prisma.historicoContrato.create as jest.Mock).mockImplementation(({ data }) => ({
      id: 'h9',
      ...data,
      valor: new Prisma.Decimal(data.valor),
    }))
    const resposta = await POST(
      post({ tipo: 'PRORROGACAO', numero: '2º TA', data: '2026-03-01', valor: '12.345,67', contratoId: 'outro' }),
      contexto
    )
    expect(resposta.status).toBe(201)
    expect(prisma.historicoContrato.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          contratoId: 'k1',
          tipo: 'PRORROGACAO',
          numero: '2º TA',
          data: new Date('2026-03-01T00:00:00Z'),
          valor: '12345.67',
        },
      })
    )
    await expect(resposta.json()).resolves.toEqual(expect.objectContaining({ id: 'h9', valor: '12345.67' }))
  })
})
