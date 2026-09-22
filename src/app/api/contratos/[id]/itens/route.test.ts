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
    itemContrato: { create: jest.fn() },
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
  new NextRequest('http://localhost/api/contratos/k1/itens', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo),
  })

beforeEach(() => {
  jest.clearAllMocks()
  ;(getAuthUser as jest.Mock).mockResolvedValue(admin)
  ;(prisma.contrato.findUnique as jest.Mock).mockResolvedValue({ id: 'k1', clienteId: 'c1' })
  ;(prisma.itemContrato.create as jest.Mock).mockImplementation(({ data }) => ({
    id: 'i9',
    contratoTextoLegado: null,
    descricao: null,
    quantidade: null,
    valorUnitario: null,
    ...data,
    valorTotal: new Prisma.Decimal(data.valorTotal),
  }))
})

describe('POST /api/contratos/[id]/itens', () => {
  it('401 sem usuário', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(null)
    expect((await POST(post({ valorTotal: '1' }), contexto)).status).toBe(401)
  })

  it('404 quando o contrato não existe', async () => {
    ;(prisma.contrato.findUnique as jest.Mock).mockResolvedValue(null)
    expect((await POST(post({ valorTotal: '1' }), contexto)).status).toBe(404)
  })

  it('403 sem permissão no cliente do contrato', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(comum)
    ;(prisma.usuario.findUnique as jest.Mock).mockResolvedValue({ clientesPermitidos: [] })
    expect((await POST(post({ valorTotal: '1' }), contexto)).status).toBe(403)
  })

  it('400 sem valor total nem quantidade × valor unitário', async () => {
    const resposta = await POST(post({ descricao: 'Licença', quantidade: '2' }), contexto)
    expect(resposta.status).toBe(400)
    await expect(resposta.json()).resolves.toEqual({
      error: 'Valor total: campo obrigatório (ou informe quantidade e valor unitário)',
    })
    expect(prisma.itemContrato.create).not.toHaveBeenCalled()
  })

  it('400 com valor negativo', async () => {
    const resposta = await POST(post({ valorTotal: '-3' }), contexto)
    expect(resposta.status).toBe(400)
    await expect(resposta.json()).resolves.toEqual({ error: 'Valor total: valor não pode ser negativo' })
  })

  it('calcula o valor total a partir de quantidade × valor unitário', async () => {
    const resposta = await POST(post({ descricao: 'Licença', quantidade: '3', valorUnitario: '33,33' }), contexto)
    expect(resposta.status).toBe(201)
    expect(prisma.itemContrato.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { contratoId: 'k1', descricao: 'Licença', quantidade: '3', valorUnitario: '33.33', valorTotal: '99.99' },
      })
    )
    await expect(resposta.json()).resolves.toEqual(expect.objectContaining({ id: 'i9', valorTotal: '99.99' }))
  })

  it('valor total informado vence o cálculo', async () => {
    await POST(post({ quantidade: '3', valorUnitario: '10', valorTotal: '25' }), contexto)
    expect(prisma.itemContrato.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ valorTotal: '25' }) })
    )
  })
})
