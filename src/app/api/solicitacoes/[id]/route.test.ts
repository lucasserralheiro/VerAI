/** @jest-environment node */
import { NextRequest } from 'next/server'
import { Prisma } from '@prisma/client'

jest.mock('@/lib/auth', () => ({
  ...jest.requireActual('@/lib/auth'),
  getAuthUser: jest.fn(),
}))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    solicitacao: { findUnique: jest.fn(), update: jest.fn() },
    usuario: { findUnique: jest.fn() },
  },
}))

import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PATCH } from './route'

const admin = { id: 'u1', nome: 'Admin', email: 'a@x', role: 'admin' as const }
const comum = { id: 'u2', nome: 'Comum', email: 'c@x', role: 'responsavel' as const }
const contexto = { params: Promise.resolve({ id: 's1' }) }
const patch = (corpo: unknown) =>
  new NextRequest('http://localhost/api/solicitacoes/s1', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo),
  })

beforeEach(() => {
  jest.clearAllMocks()
  ;(getAuthUser as jest.Mock).mockResolvedValue(admin)
  ;(prisma.solicitacao.findUnique as jest.Mock).mockResolvedValue({ id: 's1', clienteId: 'c1' })
})

describe('PATCH /api/solicitacoes/[id]', () => {
  it('401 sem usuário', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(null)
    expect((await PATCH(patch({}), contexto)).status).toBe(401)
  })

  it('404 quando a solicitação não existe', async () => {
    ;(prisma.solicitacao.findUnique as jest.Mock).mockResolvedValue(null)
    const resposta = await PATCH(patch({ situacao: 'x' }), contexto)
    expect(resposta.status).toBe(404)
    await expect(resposta.json()).resolves.toEqual({ error: 'solicitação não encontrada' })
  })

  it('403 sem permissão no cliente atual', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(comum)
    ;(prisma.usuario.findUnique as jest.Mock).mockResolvedValue({ clientesPermitidos: [] })
    expect((await PATCH(patch({ situacao: 'x' }), contexto)).status).toBe(403)
  })

  it('403 ao mover pra cliente que o usuário não vê', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(comum)
    ;(prisma.usuario.findUnique as jest.Mock).mockResolvedValue({ clientesPermitidos: [{ id: 'c1' }] })
    expect((await PATCH(patch({ clienteId: 'c2' }), contexto)).status).toBe(403)
    expect(prisma.solicitacao.update).not.toHaveBeenCalled()
  })

  it('400 com data de conclusão inválida', async () => {
    expect((await PATCH(patch({ dataFinal: '2026-13-01' }), contexto)).status).toBe(400)
  })

  it('404 quando some antes da escrita (P2025)', async () => {
    ;(prisma.solicitacao.update as jest.Mock).mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('sumiu', { code: 'P2025', clientVersion: 'teste' })
    )
    expect((await PATCH(patch({ situacao: 'x' }), contexto)).status).toBe(404)
  })

  it('atualiza só os campos enviados', async () => {
    ;(prisma.solicitacao.update as jest.Mock).mockImplementation(({ data }) => ({ id: 's1', ...data }))
    const resposta = await PATCH(patch({ situacao: 'Concluída', dataFinal: '2026-09-22' }), contexto)
    expect(resposta.status).toBe(200)
    expect(prisma.solicitacao.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 's1' }, data: { situacao: 'Concluída', dataFinal: new Date('2026-09-22T00:00:00Z') } })
    )
  })
})

describe('somente leitura', () => {
  beforeEach(() => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(comum)
    ;(prisma.usuario.findUnique as jest.Mock).mockResolvedValue({ clientesPermitidos: [], gerencias: [] })
  })

  it('PATCH 403 com motivo para quem vê mas não é da gerência', async () => {
    const resposta = await PATCH(patch({ descricao: 'x' }), contexto)
    expect(resposta.status).toBe(403)
    await expect(resposta.json()).resolves.toMatchObject({
      motivo: 'Somente leitura: só a equipe da gerência deste cliente edita.',
    })
    expect(prisma.solicitacao.update).not.toHaveBeenCalled()
  })
})
