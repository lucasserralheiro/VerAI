/** @jest-environment node */
import { NextRequest } from 'next/server'
import { Prisma } from '@prisma/client'

jest.mock('@/lib/auth', () => ({
  ...jest.requireActual('@/lib/auth'),
  getAuthUser: jest.fn(),
}))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    termoConfirmacao: { findMany: jest.fn(), create: jest.fn() },
    contrato: { findUnique: jest.fn() },
    usuario: { findUnique: jest.fn() },
  },
}))

import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { GET, POST } from './route'

const admin = { id: 'u1', nome: 'Admin', email: 'a@x', role: 'admin' as const }
const comum = { id: 'u2', nome: 'Comum', email: 'c@x', role: 'responsavel' as const }
const base = 'http://localhost/api/termos-confirmacao'
const get = (query: string) => new NextRequest(`${base}${query}`)
const post = (corpo: unknown) =>
  new NextRequest(base, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) })

const termoValido = { fornecedorId: 'f1', clienteId: 'c1', numero: 'TC-01/2026' }

beforeEach(() => {
  jest.clearAllMocks()
  ;(getAuthUser as jest.Mock).mockResolvedValue(admin)
  ;(prisma.termoConfirmacao.findMany as jest.Mock).mockResolvedValue([])
  ;(prisma.usuario.findUnique as jest.Mock).mockResolvedValue({ clientesPermitidos: [{ id: 'c1' }] })
})

describe('GET /api/termos-confirmacao', () => {
  it('401 sem usuário', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(null)
    expect((await GET(get('?clienteId=c1'))).status).toBe(401)
  })

  it('400 sem clienteId nem fornecedorId', async () => {
    const resposta = await GET(get(''))
    expect(resposta.status).toBe(400)
    await expect(resposta.json()).resolves.toEqual({ error: 'informe clienteId ou fornecedorId' })
  })

  it('403 ao pedir termos de um cliente sem permissão', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(comum)
    expect((await GET(get('?clienteId=outro'))).status).toBe(403)
    expect(prisma.termoConfirmacao.findMany).not.toHaveBeenCalled()
  })

  it('lista os termos do cliente, valor como string', async () => {
    ;(prisma.termoConfirmacao.findMany as jest.Mock).mockResolvedValue([
      { id: 't1', numero: 'TC-1', valor: new Prisma.Decimal('99.9') },
    ])
    const resposta = await GET(get('?clienteId=c1'))
    expect(resposta.status).toBe(200)
    await expect(resposta.json()).resolves.toEqual([expect.objectContaining({ id: 't1', valor: '99.9' })])
    expect(prisma.termoConfirmacao.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { clienteId: 'c1' } }))
  })

  it('por fornecedor, só traz termos de clientes visíveis', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(comum)
    await GET(get('?fornecedorId=f1'))
    expect(prisma.termoConfirmacao.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { fornecedorId: 'f1', cliente: { id: { in: ['c1'] } } } })
    )
  })
})

describe('POST /api/termos-confirmacao', () => {
  it('401 sem usuário', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(null)
    expect((await POST(post(termoValido))).status).toBe(401)
  })

  it('400 sem fornecedor, com rótulo em português', async () => {
    const resposta = await POST(post({ clienteId: 'c1' }))
    expect(resposta.status).toBe(400)
    await expect(resposta.json()).resolves.toEqual({ error: 'Fornecedor: campo obrigatório' })
  })

  it('403 sem permissão no cliente do termo', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(comum)
    expect((await POST(post({ ...termoValido, clienteId: 'outro' }))).status).toBe(403)
    expect(prisma.termoConfirmacao.create).not.toHaveBeenCalled()
  })

  it('400 quando o contrato é de outro cliente', async () => {
    ;(prisma.contrato.findUnique as jest.Mock).mockResolvedValue({ clienteId: 'c2' })
    const resposta = await POST(post({ ...termoValido, contratoId: 'k9' }))
    expect(resposta.status).toBe(400)
    await expect(resposta.json()).resolves.toEqual({ error: 'Contrato: não pertence a este cliente' })
    expect(prisma.termoConfirmacao.create).not.toHaveBeenCalled()
  })

  it('400 quando o contrato não existe', async () => {
    ;(prisma.contrato.findUnique as jest.Mock).mockResolvedValue(null)
    expect((await POST(post({ ...termoValido, contratoId: 'k9' }))).status).toBe(400)
  })

  it('400 com fim da vigência antes do início', async () => {
    const resposta = await POST(post({ ...termoValido, vigenciaInicio: '2026-03-01', vigenciaFim: '2026-02-01' }))
    expect(resposta.status).toBe(400)
    await expect(resposta.json()).resolves.toEqual({ error: 'Fim da vigência: não pode ser antes do início' })
  })

  it('400 quando o fornecedor não existe (P2003)', async () => {
    ;(prisma.termoConfirmacao.create as jest.Mock).mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('fk', { code: 'P2003', clientVersion: 'teste' })
    )
    expect((await POST(post(termoValido))).status).toBe(400)
  })

  it('cria o termo ligado a um contrato do mesmo cliente', async () => {
    ;(prisma.contrato.findUnique as jest.Mock).mockResolvedValue({ clienteId: 'c1' })
    ;(prisma.termoConfirmacao.create as jest.Mock).mockImplementation(({ data }) => ({
      id: 't9',
      ...data,
      valor: new Prisma.Decimal(data.valor),
    }))
    const resposta = await POST(
      post({ ...termoValido, contratoId: 'k1', valor: '2.500,00', vigenciaInicio: '2026-01-01', sei: '' })
    )
    expect(resposta.status).toBe(201)
    expect(prisma.termoConfirmacao.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          fornecedorId: 'f1',
          clienteId: 'c1',
          contratoId: 'k1',
          numero: 'TC-01/2026',
          valor: '2500.00',
          vigenciaInicio: new Date('2026-01-01T00:00:00Z'),
          sei: null,
        },
      })
    )
    await expect(resposta.json()).resolves.toEqual(expect.objectContaining({ id: 't9', valor: '2500' }))
  })
})
