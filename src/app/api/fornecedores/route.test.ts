/** @jest-environment node */
import { NextRequest } from 'next/server'

jest.mock('@/lib/auth', () => ({
  ...jest.requireActual('@/lib/auth'),
  getAuthUser: jest.fn(),
}))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    fornecedor: { findMany: jest.fn(), create: jest.fn() },
  },
}))

import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { GET, POST } from './route'

const comum = { id: 'u2', nome: 'Comum', email: 'c@x', role: 'responsavel' as const }

const get = (query = '') => new NextRequest(`http://localhost/api/fornecedores${query}`)
const post = (corpo: unknown) =>
  new NextRequest('http://localhost/api/fornecedores', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo),
  })

beforeEach(() => {
  jest.clearAllMocks()
  // Fornecedor não pertence a cliente: basta estar autenticado (qualquer papel).
  ;(getAuthUser as jest.Mock).mockResolvedValue(comum)
  ;(prisma.fornecedor.findMany as jest.Mock).mockResolvedValue([])
})

describe('GET /api/fornecedores', () => {
  it('401 sem usuário', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(null)
    const resposta = await GET(get())
    expect(resposta.status).toBe(401)
    await expect(resposta.json()).resolves.toEqual({ error: 'não autenticado' })
  })

  it('lista ordenado por razão social, com contagem de CO e termos', async () => {
    ;(prisma.fornecedor.findMany as jest.Mock).mockResolvedValue([
      { id: 'f1', razaoSocial: 'ALMAVIVA', cnpj: null, _count: { contratosOperacionalizacao: 1, termosConfirmacao: 2 } },
    ])
    const resposta = await GET(get())
    expect(resposta.status).toBe(200)
    await expect(resposta.json()).resolves.toEqual([
      expect.objectContaining({ id: 'f1', razaoSocial: 'ALMAVIVA', totalCos: 1, totalTermos: 2 }),
    ])
    expect(prisma.fornecedor.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {}, orderBy: { razaoSocial: 'asc' } })
    )
  })

  it('?q= busca por razão social ou CNPJ, sem diferenciar maiúsculas', async () => {
    await GET(get('?q=%20alma%20'))
    expect(prisma.fornecedor.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            { razaoSocial: { contains: 'alma', mode: 'insensitive' } },
            { cnpj: { contains: 'alma', mode: 'insensitive' } },
          ],
        },
      })
    )
  })
})

describe('POST /api/fornecedores', () => {
  it('401 sem usuário', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(null)
    expect((await POST(post({ razaoSocial: 'X' }))).status).toBe(401)
  })

  it('400 sem razão social, com rótulo em português', async () => {
    const resposta = await POST(post({ razaoSocial: '  ' }))
    expect(resposta.status).toBe(400)
    await expect(resposta.json()).resolves.toEqual({ error: 'Razão social: campo obrigatório' })
    expect(prisma.fornecedor.create).not.toHaveBeenCalled()
  })

  it('400 com data de assinatura inválida', async () => {
    expect((await POST(post({ razaoSocial: 'X', dataAssinatura: '2026-02-30' }))).status).toBe(400)
  })

  it('cria o fornecedor', async () => {
    ;(prisma.fornecedor.create as jest.Mock).mockImplementation(({ data }) => ({ id: 'f9', ...data }))
    const resposta = await POST(post({ razaoSocial: ' SAFETEC ', acordo: 'GOOGLE', cnpj: '', dataAssinatura: '2025-04-14' }))
    expect(resposta.status).toBe(201)
    expect(prisma.fornecedor.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { razaoSocial: 'SAFETEC', acordo: 'GOOGLE', cnpj: null, dataAssinatura: new Date('2025-04-14T00:00:00Z') },
      })
    )
    await expect(resposta.json()).resolves.toEqual(expect.objectContaining({ id: 'f9', razaoSocial: 'SAFETEC' }))
  })
})
