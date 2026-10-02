/** @jest-environment node */
import { NextRequest } from 'next/server'
import { Prisma } from '@prisma/client'

jest.mock('@/lib/auth', () => ({
  ...jest.requireActual('@/lib/auth'),
  getAuthUser: jest.fn(),
}))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    faturamento: { findUnique: jest.fn() },
    notaFiscal: { create: jest.fn() },
    usuario: { findUnique: jest.fn() },
  },
}))

import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { POST } from './route'

const admin = { id: 'u1', nome: 'Admin', email: 'a@x', role: 'admin' as const }
const comum = { id: 'u2', nome: 'Comum', email: 'c@x', role: 'responsavel' as const }
const contexto = { params: Promise.resolve({ id: 'f1' }) }
const post = (corpo: unknown) =>
  new NextRequest('http://localhost/api/faturamentos/f1/notas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo),
  })

beforeEach(() => {
  jest.clearAllMocks()
  ;(getAuthUser as jest.Mock).mockResolvedValue(admin)
  ;(prisma.faturamento.findUnique as jest.Mock).mockResolvedValue({ id: 'f1', clienteId: 'c1' })
})

describe('POST /api/faturamentos/[id]/notas', () => {
  it('401 sem usuário', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(null)
    expect((await POST(post({ valor: '1' }), contexto)).status).toBe(401)
  })

  it('404 quando o faturamento não existe', async () => {
    ;(prisma.faturamento.findUnique as jest.Mock).mockResolvedValue(null)
    expect((await POST(post({ valor: '1' }), contexto)).status).toBe(404)
  })

  it('403 sem permissão no cliente do faturamento', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(comum)
    ;(prisma.usuario.findUnique as jest.Mock).mockResolvedValue({ clientesPermitidos: [] })
    expect((await POST(post({ valor: '1' }), contexto)).status).toBe(403)
  })

  it('400 sem valor, com rótulo em português', async () => {
    const resposta = await POST(post({ numero: '123' }), contexto)
    expect(resposta.status).toBe(400)
    await expect(resposta.json()).resolves.toEqual({ error: 'Valor: campo obrigatório' })
  })

  it('cria a nota no faturamento da URL', async () => {
    ;(prisma.notaFiscal.create as jest.Mock).mockImplementation(({ data }) => ({
      id: 'n9',
      quantidade: null,
      ...data,
      valor: new Prisma.Decimal(data.valor),
    }))
    const resposta = await POST(
      post({ numero: '37619', valor: '113.119,20', dataEmissao: '2022-06-06', servico: 'Prod. Customizados' }),
      contexto
    )
    expect(resposta.status).toBe(201)
    expect(prisma.notaFiscal.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          faturamentoId: 'f1',
          numero: '37619',
          valor: '113119.20',
          dataEmissao: new Date('2022-06-06T00:00:00Z'),
          servico: 'Prod. Customizados',
        },
      })
    )
    await expect(resposta.json()).resolves.toEqual(expect.objectContaining({ id: 'n9', valor: '113119.2' }))
  })
})

describe('somente leitura', () => {
  beforeEach(() => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(comum)
    ;(prisma.usuario.findUnique as jest.Mock).mockResolvedValue({ clientesPermitidos: [], gerencias: [] })
  })

  it('POST 403 com motivo para quem vê mas não é da gerência', async () => {
    const resposta = await POST(post({ valor: '1' }), contexto)
    expect(resposta.status).toBe(403)
    await expect(resposta.json()).resolves.toMatchObject({
      motivo: 'Somente leitura: só a equipe da gerência deste cliente edita.',
    })
    expect(prisma.notaFiscal.create).not.toHaveBeenCalled()
  })
})
