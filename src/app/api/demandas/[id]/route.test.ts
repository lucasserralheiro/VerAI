/** @jest-environment node */
import { NextRequest } from 'next/server'
import { Prisma } from '@prisma/client'

jest.mock('@/lib/auth', () => ({
  ...jest.requireActual('@/lib/auth'),
  getAuthUser: jest.fn(),
}))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    demanda: { findUnique: jest.fn(), update: jest.fn() },
    tramiteDemanda: { findMany: jest.fn(), groupBy: jest.fn() },
    usuario: { findUnique: jest.fn() },
  },
}))

import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { GET, PATCH } from './route'

const admin = { id: 'u1', nome: 'Admin', email: 'a@x', role: 'admin' as const }
const comum = { id: 'u2', nome: 'Comum', email: 'c@x', role: 'responsavel' as const }
const contexto = { params: Promise.resolve({ id: 'd1' }) }
const url = 'http://localhost/api/demandas/d1'
const patch = (corpo: unknown) =>
  new NextRequest(url, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) })

beforeEach(() => {
  jest.clearAllMocks()
  ;(getAuthUser as jest.Mock).mockResolvedValue(admin)
  ;(prisma.demanda.findUnique as jest.Mock).mockImplementation(({ select }) =>
    select.assunto ? { id: 'd1', clienteId: 'c1', assunto: 'Liberação VPN', notaImportacao: 'x' } : { id: 'd1', clienteId: 'c1' }
  )
  ;(prisma.tramiteDemanda.findMany as jest.Mock).mockResolvedValue([])
  ;(prisma.tramiteDemanda.groupBy as jest.Mock).mockResolvedValue([])
})

describe('GET /api/demandas/[id]', () => {
  it('401 sem usuário', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(null)
    expect((await GET(new NextRequest(url), contexto)).status).toBe(401)
  })

  it('404 quando a demanda não existe', async () => {
    ;(prisma.demanda.findUnique as jest.Mock).mockResolvedValue(null)
    const resposta = await GET(new NextRequest(url), contexto)
    expect(resposta.status).toBe(404)
    await expect(resposta.json()).resolves.toEqual({ error: 'demanda não encontrada' })
  })

  it('403 sem permissão no cliente da demanda', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(comum)
    ;(prisma.usuario.findUnique as jest.Mock).mockResolvedValue({ clientesPermitidos: [] })
    expect((await GET(new NextRequest(url), contexto)).status).toBe(403)
  })

  it('devolve a demanda com trâmites em ordem de data e sugestões', async () => {
    ;(prisma.tramiteDemanda.findMany as jest.Mock).mockResolvedValue([{ id: 't1', posicao: 'Com a SMS' }])
    ;(prisma.tramiteDemanda.groupBy as jest.Mock).mockImplementation(({ by }) =>
      by[0] === 'responsavelAtual' ? [{ responsavelAtual: 'SMS' }, { responsavelAtual: 'GEN-1' }] : [{ acao: 'x'.repeat(80) }, { acao: 'e-mail enviado' }]
    )
    const resposta = await GET(new NextRequest(url), contexto)
    expect(resposta.status).toBe(200)
    const corpo = await resposta.json()
    expect(corpo).toEqual(expect.objectContaining({ id: 'd1', assunto: 'Liberação VPN', tramites: [{ id: 't1', posicao: 'Com a SMS' }] }))
    expect(corpo.sugestoes).toEqual({ responsavelAtual: ['SMS', 'GEN-1'], acao: ['e-mail enviado'] })
    expect(prisma.tramiteDemanda.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { demandaId: 'd1' }, orderBy: [{ data: { sort: 'asc', nulls: 'last' } }, { createdAt: 'asc' }] })
    )
  })
})

describe('PATCH /api/demandas/[id]', () => {
  it('401 sem usuário', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(null)
    expect((await PATCH(patch({}), contexto)).status).toBe(401)
  })

  it('404 quando a demanda não existe', async () => {
    ;(prisma.demanda.findUnique as jest.Mock).mockResolvedValue(null)
    expect((await PATCH(patch({ situacao: 'x' }), contexto)).status).toBe(404)
  })

  it('403 sem permissão no cliente atual da demanda', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(comum)
    ;(prisma.usuario.findUnique as jest.Mock).mockResolvedValue({ clientesPermitidos: [{ id: 'outro' }] })
    expect((await PATCH(patch({ situacao: 'x' }), contexto)).status).toBe(403)
  })

  it('403 ao mover pra cliente que o usuário não vê', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(comum)
    ;(prisma.usuario.findUnique as jest.Mock).mockResolvedValue({ clientesPermitidos: [{ id: 'c1' }] })
    expect((await PATCH(patch({ clienteId: 'c2' }), contexto)).status).toBe(403)
    expect(prisma.demanda.update).not.toHaveBeenCalled()
  })

  it('400 ao apagar o assunto', async () => {
    expect((await PATCH(patch({ assunto: ' ' }), contexto)).status).toBe(400)
  })

  it('trocar de cliente limpa a nota de importação (a atribuição foi corrigida)', async () => {
    ;(prisma.demanda.update as jest.Mock).mockImplementation(({ data }) => ({ id: 'd1', ...data }))
    const resposta = await PATCH(patch({ clienteId: 'c2' }), contexto)
    expect(resposta.status).toBe(200)
    expect(prisma.demanda.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'd1' }, data: { clienteId: 'c2', notaImportacao: null } })
    )
  })

  it('manter o mesmo cliente não mexe na nota de importação', async () => {
    ;(prisma.demanda.update as jest.Mock).mockImplementation(({ data }) => ({ id: 'd1', ...data }))
    await PATCH(patch({ clienteId: 'c1', situacao: 'Concluído' }), contexto)
    expect(prisma.demanda.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { clienteId: 'c1', situacao: 'Concluído' } })
    )
  })

  it('400 ao mover pra cliente inexistente (P2003)', async () => {
    ;(prisma.demanda.update as jest.Mock).mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('fk', { code: 'P2003', clientVersion: 'teste' })
    )
    expect((await PATCH(patch({ clienteId: 'c404' }), contexto)).status).toBe(400)
  })
})

describe('somente leitura', () => {
  beforeEach(() => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(comum)
    ;(prisma.usuario.findUnique as jest.Mock).mockResolvedValue({ clientesPermitidos: [], gerencias: [] })
  })

  it('PATCH 403 com motivo para quem vê mas não é da gerência', async () => {
    const resposta = await PATCH(patch({ assunto: 'x' }), contexto)
    expect(resposta.status).toBe(403)
    await expect(resposta.json()).resolves.toMatchObject({
      motivo: 'Somente leitura: só a equipe da gerência deste cliente edita.',
    })
    expect(prisma.demanda.update).not.toHaveBeenCalled()
  })
})
