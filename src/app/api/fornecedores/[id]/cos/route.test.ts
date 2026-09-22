/** @jest-environment node */
import { NextRequest } from 'next/server'
import { Prisma } from '@prisma/client'

jest.mock('@/lib/auth', () => ({
  ...jest.requireActual('@/lib/auth'),
  getAuthUser: jest.fn(),
}))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    fornecedor: { findUnique: jest.fn() },
    contratoOperacionalizacao: { create: jest.fn() },
  },
}))

import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { POST } from './route'

const comum = { id: 'u2', nome: 'Comum', email: 'c@x', role: 'responsavel' as const }
const contexto = { params: Promise.resolve({ id: 'f1' }) }
const post = (corpo: unknown) =>
  new NextRequest('http://localhost/api/fornecedores/f1/cos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo),
  })

beforeEach(() => {
  jest.clearAllMocks()
  ;(getAuthUser as jest.Mock).mockResolvedValue(comum)
  ;(prisma.fornecedor.findUnique as jest.Mock).mockResolvedValue({ id: 'f1' })
})

describe('POST /api/fornecedores/[id]/cos', () => {
  it('401 sem usuário', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(null)
    expect((await POST(post({}), contexto)).status).toBe(401)
  })

  it('404 quando o fornecedor não existe', async () => {
    ;(prisma.fornecedor.findUnique as jest.Mock).mockResolvedValue(null)
    const resposta = await POST(post({ numero: 'CO-1' }), contexto)
    expect(resposta.status).toBe(404)
    await expect(resposta.json()).resolves.toEqual({ error: 'fornecedor não encontrado' })
  })

  it('400 com valor negativo, com rótulo em português', async () => {
    const resposta = await POST(post({ valor: '-5' }), contexto)
    expect(resposta.status).toBe(400)
    await expect(resposta.json()).resolves.toEqual({ error: 'Valor: valor não pode ser negativo' })
  })

  it('400 com fim da vigência antes do início', async () => {
    const resposta = await POST(post({ dataInicio: '2026-05-01', dataFim: '2026-04-30' }), contexto)
    expect(resposta.status).toBe(400)
    await expect(resposta.json()).resolves.toEqual({ error: 'Fim da vigência: não pode ser antes do início' })
    expect(prisma.contratoOperacionalizacao.create).not.toHaveBeenCalled()
  })

  it('cria o CO no fornecedor da URL', async () => {
    ;(prisma.contratoOperacionalizacao.create as jest.Mock).mockImplementation(({ data }) => ({
      id: 'co1',
      numero: null,
      dataInicio: null,
      dataFim: null,
      sei: null,
      ...data,
      valor: new Prisma.Decimal(data.valor),
    }))
    const resposta = await POST(
      post({ numero: 'CO-7', dataInicio: '2026-01-01', dataFim: '2026-12-31', valor: '1.234,56', fornecedorId: 'outro' }),
      contexto
    )
    expect(resposta.status).toBe(201)
    expect(prisma.contratoOperacionalizacao.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          fornecedorId: 'f1',
          numero: 'CO-7',
          dataInicio: new Date('2026-01-01T00:00:00Z'),
          dataFim: new Date('2026-12-31T00:00:00Z'),
          valor: '1234.56',
        },
      })
    )
    await expect(resposta.json()).resolves.toEqual(expect.objectContaining({ id: 'co1', valor: '1234.56' }))
  })
})
