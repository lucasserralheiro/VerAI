/** @jest-environment node */
import { NextRequest } from 'next/server'
import { Prisma } from '@prisma/client'

jest.mock('@/lib/auth', () => ({
  ...jest.requireActual('@/lib/auth'),
  getAuthUser: jest.fn(),
}))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    notaFiscal: { findUnique: jest.fn(), update: jest.fn(), delete: jest.fn() },
    usuario: { findUnique: jest.fn() },
  },
}))

import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { DELETE, PATCH } from './route'

const admin = { id: 'u1', nome: 'Admin', email: 'a@x', role: 'admin' as const }
const comum = { id: 'u2', nome: 'Comum', email: 'c@x', role: 'responsavel' as const }
const contexto = { params: Promise.resolve({ id: 'n1' }) }
const url = 'http://localhost/api/notas-fiscais/n1'
const patch = (corpo: unknown) =>
  new NextRequest(url, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) })
const del = () => new NextRequest(url, { method: 'DELETE' })
const p2025 = () => new Prisma.PrismaClientKnownRequestError('sumiu', { code: 'P2025', clientVersion: 'teste' })

beforeEach(() => {
  jest.clearAllMocks()
  ;(getAuthUser as jest.Mock).mockResolvedValue(admin)
  ;(prisma.notaFiscal.findUnique as jest.Mock).mockResolvedValue({ id: 'n1', faturamento: { clienteId: 'c1' } })
})

describe('PATCH /api/notas-fiscais/[id]', () => {
  it('401 sem usuário', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(null)
    expect((await PATCH(patch({}), contexto)).status).toBe(401)
  })

  it('404 quando a nota não existe', async () => {
    ;(prisma.notaFiscal.findUnique as jest.Mock).mockResolvedValue(null)
    const resposta = await PATCH(patch({ numero: '1' }), contexto)
    expect(resposta.status).toBe(404)
    await expect(resposta.json()).resolves.toEqual({ error: 'nota fiscal não encontrada' })
  })

  it('403 sem permissão no cliente do faturamento', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(comum)
    ;(prisma.usuario.findUnique as jest.Mock).mockResolvedValue({ clientesPermitidos: [] })
    expect((await PATCH(patch({ numero: '1' }), contexto)).status).toBe(403)
    expect(prisma.notaFiscal.update).not.toHaveBeenCalled()
  })

  it('400 ao apagar o valor ou com valor negativo', async () => {
    expect((await PATCH(patch({ valor: '' }), contexto)).status).toBe(400)
    expect((await PATCH(patch({ valor: '-1' }), contexto)).status).toBe(400)
  })

  it('404 quando a nota some antes da escrita (P2025)', async () => {
    ;(prisma.notaFiscal.update as jest.Mock).mockRejectedValueOnce(p2025())
    expect((await PATCH(patch({ numero: '1' }), contexto)).status).toBe(404)
  })

  it('atualiza só os campos enviados', async () => {
    ;(prisma.notaFiscal.update as jest.Mock).mockImplementation(({ data }) => ({ id: 'n1', valor: null, quantidade: null, ...data }))
    const resposta = await PATCH(patch({ numero: ' 37619 ' }), contexto)
    expect(resposta.status).toBe(200)
    expect(prisma.notaFiscal.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'n1' }, data: { numero: '37619' } }))
  })
})

describe('DELETE /api/notas-fiscais/[id]', () => {
  it('401 sem usuário', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(null)
    expect((await DELETE(del(), contexto)).status).toBe(401)
  })

  it('404 quando a nota não existe', async () => {
    ;(prisma.notaFiscal.findUnique as jest.Mock).mockResolvedValue(null)
    expect((await DELETE(del(), contexto)).status).toBe(404)
  })

  it('403 sem permissão no cliente do faturamento', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(comum)
    ;(prisma.usuario.findUnique as jest.Mock).mockResolvedValue({ clientesPermitidos: [] })
    expect((await DELETE(del(), contexto)).status).toBe(403)
  })

  it('exclui a nota', async () => {
    const resposta = await DELETE(del(), contexto)
    expect(resposta.status).toBe(200)
    expect(prisma.notaFiscal.delete).toHaveBeenCalledWith({ where: { id: 'n1' } })
  })
})
