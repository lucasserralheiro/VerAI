/** @jest-environment node */
import { NextRequest } from 'next/server'
import { Prisma } from '@prisma/client'

jest.mock('@/lib/auth', () => ({
  ...jest.requireActual('@/lib/auth'),
  getAuthUser: jest.fn(),
}))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    contratoOperacionalizacao: { findUnique: jest.fn(), update: jest.fn(), delete: jest.fn() },
  },
}))

import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { DELETE, PATCH } from './route'

const comum = { id: 'u2', nome: 'Comum', email: 'c@x', role: 'responsavel' as const }
const contexto = { params: Promise.resolve({ id: 'co1' }) }
const url = 'http://localhost/api/cos/co1'
const patch = (corpo: unknown) =>
  new NextRequest(url, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) })
const del = () => new NextRequest(url, { method: 'DELETE' })
const p2025 = () => new Prisma.PrismaClientKnownRequestError('sumiu', { code: 'P2025', clientVersion: 'teste' })

beforeEach(() => {
  jest.clearAllMocks()
  ;(getAuthUser as jest.Mock).mockResolvedValue(comum)
  ;(prisma.contratoOperacionalizacao.findUnique as jest.Mock).mockResolvedValue({
    id: 'co1',
    dataInicio: new Date('2026-01-01T00:00:00Z'),
    dataFim: null,
  })
})

describe('PATCH /api/cos/[id]', () => {
  it('401 sem usuário', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(null)
    expect((await PATCH(patch({}), contexto)).status).toBe(401)
  })

  it('404 quando o CO não existe', async () => {
    ;(prisma.contratoOperacionalizacao.findUnique as jest.Mock).mockResolvedValue(null)
    const resposta = await PATCH(patch({ numero: 'X' }), contexto)
    expect(resposta.status).toBe(404)
    await expect(resposta.json()).resolves.toEqual({ error: 'CO não encontrado' })
  })

  it('400 quando o fim novo fica antes do início já gravado', async () => {
    const resposta = await PATCH(patch({ dataFim: '2025-12-31' }), contexto)
    expect(resposta.status).toBe(400)
    expect(prisma.contratoOperacionalizacao.update).not.toHaveBeenCalled()
  })

  it('404 quando o CO some entre a leitura e a escrita (P2025)', async () => {
    ;(prisma.contratoOperacionalizacao.update as jest.Mock).mockRejectedValueOnce(p2025())
    expect((await PATCH(patch({ numero: 'X' }), contexto)).status).toBe(404)
  })

  it('atualiza só os campos enviados', async () => {
    ;(prisma.contratoOperacionalizacao.update as jest.Mock).mockImplementation(({ data }) => ({
      id: 'co1',
      valor: null,
      ...data,
    }))
    const resposta = await PATCH(patch({ numero: ' CO-8 ', dataFim: '2026-06-30', sei: '' }), contexto)
    expect(resposta.status).toBe(200)
    expect(prisma.contratoOperacionalizacao.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'co1' },
        data: { numero: 'CO-8', dataFim: new Date('2026-06-30T00:00:00Z'), sei: null },
      })
    )
  })
})

describe('DELETE /api/cos/[id]', () => {
  it('401 sem usuário', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(null)
    expect((await DELETE(del(), contexto)).status).toBe(401)
  })

  it('404 quando o CO não existe', async () => {
    ;(prisma.contratoOperacionalizacao.findUnique as jest.Mock).mockResolvedValue(null)
    expect((await DELETE(del(), contexto)).status).toBe(404)
  })

  it('404 quando o CO some antes do delete (P2025)', async () => {
    ;(prisma.contratoOperacionalizacao.delete as jest.Mock).mockRejectedValueOnce(p2025())
    expect((await DELETE(del(), contexto)).status).toBe(404)
  })

  it('exclui o CO', async () => {
    const resposta = await DELETE(del(), contexto)
    expect(resposta.status).toBe(200)
    await expect(resposta.json()).resolves.toEqual({ ok: true })
    expect(prisma.contratoOperacionalizacao.delete).toHaveBeenCalledWith({ where: { id: 'co1' } })
  })
})
