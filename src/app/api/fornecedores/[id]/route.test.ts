/** @jest-environment node */
import { NextRequest } from 'next/server'
import { Prisma } from '@prisma/client'

jest.mock('@/lib/auth', () => ({
  ...jest.requireActual('@/lib/auth'),
  getAuthUser: jest.fn(),
}))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    fornecedor: { findUnique: jest.fn(), update: jest.fn() },
    contratoOperacionalizacao: { findMany: jest.fn() },
    termoConfirmacao: { findMany: jest.fn() },
    usuario: { findUnique: jest.fn() },
  },
}))

import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { GET, PATCH } from './route'

const admin = { id: 'u1', nome: 'Admin', email: 'a@x', role: 'admin' as const }
const comum = { id: 'u2', nome: 'Comum', email: 'c@x', role: 'responsavel' as const }
const contexto = { params: Promise.resolve({ id: 'f1' }) }
const url = 'http://localhost/api/fornecedores/f1'

const patch = (corpo: unknown) =>
  new NextRequest(url, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) })

beforeEach(() => {
  jest.clearAllMocks()
  ;(getAuthUser as jest.Mock).mockResolvedValue(admin)
  ;(prisma.fornecedor.findUnique as jest.Mock).mockResolvedValue({ id: 'f1', razaoSocial: 'ALMAVIVA' })
  ;(prisma.contratoOperacionalizacao.findMany as jest.Mock).mockResolvedValue([])
  ;(prisma.termoConfirmacao.findMany as jest.Mock).mockResolvedValue([])
})

describe('GET /api/fornecedores/[id]', () => {
  it('401 sem usuário', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(null)
    expect((await GET(new NextRequest(url), contexto)).status).toBe(401)
  })

  it('404 quando o fornecedor não existe', async () => {
    ;(prisma.fornecedor.findUnique as jest.Mock).mockResolvedValue(null)
    const resposta = await GET(new NextRequest(url), contexto)
    expect(resposta.status).toBe(404)
    await expect(resposta.json()).resolves.toEqual({ error: 'fornecedor não encontrado' })
  })

  it('devolve o fornecedor com COs e termos, valores decimais como string', async () => {
    ;(prisma.contratoOperacionalizacao.findMany as jest.Mock).mockResolvedValue([
      { id: 'co1', fornecedorId: 'f1', numero: 'CO-1', dataInicio: null, dataFim: null, valor: new Prisma.Decimal('1500.5'), sei: null },
    ])
    ;(prisma.termoConfirmacao.findMany as jest.Mock).mockResolvedValue([
      { id: 't1', numero: 'TC-9', valor: new Prisma.Decimal('10'), cliente: { id: 'c1', nome: 'Saúde', siglaLegado: 'SMS' } },
    ])
    const resposta = await GET(new NextRequest(url), contexto)
    expect(resposta.status).toBe(200)
    const corpo = await resposta.json()
    expect(corpo.razaoSocial).toBe('ALMAVIVA')
    expect(corpo.cos).toEqual([expect.objectContaining({ id: 'co1', valor: '1500.5' })])
    expect(corpo.termos).toEqual([expect.objectContaining({ id: 't1', valor: '10' })])
  })

  it('só lista termos de clientes visíveis ao usuário', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(comum)
    ;(prisma.usuario.findUnique as jest.Mock).mockResolvedValue({ clientesPermitidos: [{ id: 'c1' }] })
    await GET(new NextRequest(url), contexto)
    expect(prisma.termoConfirmacao.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { fornecedorId: 'f1', cliente: { id: { in: ['c1'] } } } })
    )
  })
})

describe('PATCH /api/fornecedores/[id]', () => {
  it('401 sem usuário', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(null)
    expect((await PATCH(patch({ razaoSocial: 'X' }), contexto)).status).toBe(401)
  })

  it('404 quando o fornecedor não existe', async () => {
    ;(prisma.fornecedor.findUnique as jest.Mock).mockResolvedValue(null)
    expect((await PATCH(patch({ razaoSocial: 'X' }), contexto)).status).toBe(404)
    expect(prisma.fornecedor.update).not.toHaveBeenCalled()
  })

  it('400 sem razão social', async () => {
    expect((await PATCH(patch({ razaoSocial: '' }), contexto)).status).toBe(400)
  })

  it('404 quando o fornecedor some entre a leitura e a escrita (P2025)', async () => {
    ;(prisma.fornecedor.update as jest.Mock).mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('sumiu', { code: 'P2025', clientVersion: 'teste' })
    )
    expect((await PATCH(patch({ razaoSocial: 'X' }), contexto)).status).toBe(404)
  })

  it('atualiza o fornecedor', async () => {
    ;(prisma.fornecedor.update as jest.Mock).mockImplementation(({ data }) => ({ id: 'f1', ...data }))
    const resposta = await PATCH(patch({ razaoSocial: 'ALMAVIVA DO BRASIL', sei: ' 7010.1/2 ' }), contexto)
    expect(resposta.status).toBe(200)
    expect(prisma.fornecedor.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'f1' }, data: { razaoSocial: 'ALMAVIVA DO BRASIL', sei: '7010.1/2' } })
    )
  })
})
