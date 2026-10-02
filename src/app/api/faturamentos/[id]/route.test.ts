/** @jest-environment node */
import { NextRequest } from 'next/server'
import { Prisma } from '@prisma/client'

jest.mock('@/lib/auth', () => ({
  ...jest.requireActual('@/lib/auth'),
  getAuthUser: jest.fn(),
}))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    faturamento: { findUnique: jest.fn(), update: jest.fn(), findFirst: jest.fn().mockResolvedValue(null) },
    contrato: { findUnique: jest.fn() },
    notaFiscal: { findMany: jest.fn(), groupBy: jest.fn() },
    usuario: { findUnique: jest.fn() },
  },
}))

import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { GET, PATCH } from './route'

const admin = { id: 'u1', nome: 'Admin', email: 'a@x', role: 'admin' as const }
const comum = { id: 'u2', nome: 'Comum', email: 'c@x', role: 'responsavel' as const }
const contexto = { params: Promise.resolve({ id: 'f1' }) }
const url = 'http://localhost/api/faturamentos/f1'
const patch = (corpo: unknown) =>
  new NextRequest(url, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) })

beforeEach(() => {
  jest.clearAllMocks()
  ;(getAuthUser as jest.Mock).mockResolvedValue(admin)
  ;(prisma.faturamento.findUnique as jest.Mock).mockImplementation(({ select }) =>
    select.competenciaAno ? { id: 'f1', clienteId: 'c1', competenciaAno: 2026, competenciaMes: 8, valor: null } : { id: 'f1', clienteId: 'c1' }
  )
  ;(prisma.contrato.findUnique as jest.Mock).mockResolvedValue({ clienteId: 'c1' })
  ;(prisma.notaFiscal.findMany as jest.Mock).mockResolvedValue([])
  ;(prisma.notaFiscal.groupBy as jest.Mock).mockResolvedValue([])
})

describe('GET /api/faturamentos/[id]', () => {
  it('401 sem usuário', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(null)
    expect((await GET(new NextRequest(url), contexto)).status).toBe(401)
  })

  it('404 quando o faturamento não existe', async () => {
    ;(prisma.faturamento.findUnique as jest.Mock).mockResolvedValue(null)
    const resposta = await GET(new NextRequest(url), contexto)
    expect(resposta.status).toBe(404)
    await expect(resposta.json()).resolves.toEqual({ error: 'faturamento não encontrado' })
  })

  it('200 para usuário logado sem vínculo com o cliente do faturamento (leitura liberada)', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(comum)
    ;(prisma.usuario.findUnique as jest.Mock).mockResolvedValue({ clientesPermitidos: [] })
    expect((await GET(new NextRequest(url), contexto)).status).toBe(200)
  })

  it('devolve o faturamento com as notas, valores como string', async () => {
    ;(prisma.notaFiscal.findMany as jest.Mock).mockResolvedValue([
      { id: 'n1', valor: new Prisma.Decimal('10.5'), quantidade: null, servico: 'DaaS' },
    ])
    ;(prisma.notaFiscal.groupBy as jest.Mock).mockResolvedValue([
      { faturamentoId: 'f1', servico: 'DaaS', _sum: { valor: new Prisma.Decimal('10.5') } },
    ])
    const resposta = await GET(new NextRequest(url), contexto)
    expect(resposta.status).toBe(200)
    const corpo = await resposta.json()
    expect(corpo).toEqual(expect.objectContaining({ id: 'f1', valorExibido: '10.5', servicos: ['DaaS'] }))
    expect(corpo.notas).toEqual([expect.objectContaining({ id: 'n1', valor: '10.5' })])
  })
})

describe('PATCH /api/faturamentos/[id]', () => {
  it('401 sem usuário', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(null)
    expect((await PATCH(patch({}), contexto)).status).toBe(401)
  })

  it('404 quando o faturamento não existe', async () => {
    ;(prisma.faturamento.findUnique as jest.Mock).mockResolvedValue(null)
    expect((await PATCH(patch({ sei: 'x' }), contexto)).status).toBe(404)
  })

  it('403 sem permissão no cliente', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(comum)
    ;(prisma.usuario.findUnique as jest.Mock).mockResolvedValue({ clientesPermitidos: [] })
    expect((await PATCH(patch({ sei: 'x' }), contexto)).status).toBe(403)
    expect(prisma.faturamento.update).not.toHaveBeenCalled()
  })

  it('400 ao trocar pra contrato de outro cliente', async () => {
    ;(prisma.contrato.findUnique as jest.Mock).mockResolvedValue({ clienteId: 'c2' })
    expect((await PATCH(patch({ contratoId: 'k9' }), contexto)).status).toBe(400)
  })

  it('400 com mês inválido', async () => {
    expect((await PATCH(patch({ competenciaMes: 0 }), contexto)).status).toBe(400)
  })

  it('404 quando o faturamento some antes da escrita (P2025)', async () => {
    ;(prisma.faturamento.update as jest.Mock).mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('sumiu', { code: 'P2025', clientVersion: 'teste' })
    )
    expect((await PATCH(patch({ sei: 'x' }), contexto)).status).toBe(404)
  })

  it('atualiza só os campos enviados', async () => {
    ;(prisma.faturamento.update as jest.Mock).mockImplementation(({ data }) => ({ id: 'f1', valor: null, ...data }))
    const resposta = await PATCH(patch({ enviadoGfp: true, observacao: '' }), contexto)
    expect(resposta.status).toBe(200)
    expect(prisma.faturamento.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'f1' }, data: { enviadoGfp: true, observacao: null } })
    )
  })
})

describe('somente leitura', () => {
  beforeEach(() => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(comum)
    ;(prisma.usuario.findUnique as jest.Mock).mockResolvedValue({ clientesPermitidos: [], gerencias: [] })
  })

  it('PATCH 403 com motivo para quem vê mas não é da gerência', async () => {
    const resposta = await PATCH(patch({ sei: 'x' }), contexto)
    expect(resposta.status).toBe(403)
    await expect(resposta.json()).resolves.toMatchObject({
      motivo: 'Somente leitura: só a equipe da gerência deste cliente edita.',
    })
    expect(prisma.faturamento.update).not.toHaveBeenCalled()
  })
})
