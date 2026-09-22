/** @jest-environment node */
import { NextRequest } from 'next/server'
import { Prisma } from '@prisma/client'

jest.mock('@/lib/auth', () => ({
  ...jest.requireActual('@/lib/auth'),
  getAuthUser: jest.fn(),
}))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    tramiteDemanda: { findUnique: jest.fn(), update: jest.fn(), delete: jest.fn() },
    usuario: { findUnique: jest.fn() },
  },
}))

import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { DELETE, PATCH } from './route'

const admin = { id: 'u1', nome: 'Admin', email: 'a@x', role: 'admin' as const }
const comum = { id: 'u2', nome: 'Comum', email: 'c@x', role: 'responsavel' as const }
const contexto = { params: Promise.resolve({ id: 't1' }) }
const url = 'http://localhost/api/tramites-demanda/t1'
const patch = (corpo: unknown) =>
  new NextRequest(url, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) })
const del = () => new NextRequest(url, { method: 'DELETE' })
const p2025 = () => new Prisma.PrismaClientKnownRequestError('sumiu', { code: 'P2025', clientVersion: 'teste' })

beforeEach(() => {
  jest.clearAllMocks()
  ;(getAuthUser as jest.Mock).mockResolvedValue(admin)
  ;(prisma.tramiteDemanda.findUnique as jest.Mock).mockResolvedValue({ id: 't1', demanda: { clienteId: 'c1' } })
})

describe('PATCH /api/tramites-demanda/[id]', () => {
  it('401 sem usuário', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(null)
    expect((await PATCH(patch({}), contexto)).status).toBe(401)
  })

  it('404 quando o trâmite não existe', async () => {
    ;(prisma.tramiteDemanda.findUnique as jest.Mock).mockResolvedValue(null)
    const resposta = await PATCH(patch({ posicao: 'x' }), contexto)
    expect(resposta.status).toBe(404)
    await expect(resposta.json()).resolves.toEqual({ error: 'trâmite não encontrado' })
  })

  it('403 sem permissão no cliente da demanda', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(comum)
    ;(prisma.usuario.findUnique as jest.Mock).mockResolvedValue({ clientesPermitidos: [] })
    expect((await PATCH(patch({ posicao: 'x' }), contexto)).status).toBe(403)
    expect(prisma.tramiteDemanda.update).not.toHaveBeenCalled()
  })

  it('400 ao apagar a data', async () => {
    expect((await PATCH(patch({ data: '' }), contexto)).status).toBe(400)
  })

  it('404 quando o trâmite some antes da escrita (P2025)', async () => {
    ;(prisma.tramiteDemanda.update as jest.Mock).mockRejectedValueOnce(p2025())
    expect((await PATCH(patch({ posicao: 'x' }), contexto)).status).toBe(404)
  })

  it('atualiza só os campos enviados', async () => {
    ;(prisma.tramiteDemanda.update as jest.Mock).mockImplementation(({ data }) => ({ id: 't1', ...data }))
    const resposta = await PATCH(patch({ assinado: true, observacao: '' }), contexto)
    expect(resposta.status).toBe(200)
    expect(prisma.tramiteDemanda.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 't1' }, data: { assinado: true, observacao: null } })
    )
  })
})

describe('DELETE /api/tramites-demanda/[id]', () => {
  it('401 sem usuário', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(null)
    expect((await DELETE(del(), contexto)).status).toBe(401)
  })

  it('404 quando o trâmite não existe', async () => {
    ;(prisma.tramiteDemanda.findUnique as jest.Mock).mockResolvedValue(null)
    expect((await DELETE(del(), contexto)).status).toBe(404)
  })

  it('403 sem permissão no cliente da demanda', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(comum)
    ;(prisma.usuario.findUnique as jest.Mock).mockResolvedValue({ clientesPermitidos: [] })
    expect((await DELETE(del(), contexto)).status).toBe(403)
  })

  it('exclui o trâmite', async () => {
    const resposta = await DELETE(del(), contexto)
    expect(resposta.status).toBe(200)
    expect(prisma.tramiteDemanda.delete).toHaveBeenCalledWith({ where: { id: 't1' } })
  })
})
