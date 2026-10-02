/** @jest-environment node */
import { NextRequest } from 'next/server'
import { Prisma } from '@prisma/client'

jest.mock('@/lib/auth', () => ({
  ...jest.requireActual('@/lib/auth'),
  getAuthUser: jest.fn(),
}))
jest.mock('@/lib/relatorios-clientes/vincular-itens', () => ({ vincularItensDoContrato: jest.fn() }))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    historicoContrato: { findUnique: jest.fn(), update: jest.fn(), delete: jest.fn() },
    usuario: { findUnique: jest.fn() },
  },
}))

import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { DELETE, PATCH } from './route'

const admin = { id: 'u1', nome: 'Admin', email: 'a@x', role: 'admin' as const }
const comum = { id: 'u2', nome: 'Comum', email: 'c@x', role: 'responsavel' as const }
const contexto = { params: Promise.resolve({ id: 'h1' }) }
const url = 'http://localhost/api/historico-contrato/h1'
const patch = (corpo: unknown) =>
  new NextRequest(url, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) })
const del = () => new NextRequest(url, { method: 'DELETE' })
const p2025 = () => new Prisma.PrismaClientKnownRequestError('sumiu', { code: 'P2025', clientVersion: 'teste' })

beforeEach(() => {
  jest.clearAllMocks()
  ;(getAuthUser as jest.Mock).mockResolvedValue(admin)
  ;(prisma.historicoContrato.findUnique as jest.Mock).mockResolvedValue({ id: 'h1', contrato: { clienteId: 'c1' } })
})

describe('PATCH /api/historico-contrato/[id]', () => {
  it('401 sem usuário', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(null)
    expect((await PATCH(patch({}), contexto)).status).toBe(401)
  })

  it('404 quando a linha não existe', async () => {
    ;(prisma.historicoContrato.findUnique as jest.Mock).mockResolvedValue(null)
    const resposta = await PATCH(patch({ numero: 'X' }), contexto)
    expect(resposta.status).toBe(404)
    await expect(resposta.json()).resolves.toEqual({ error: 'linha do histórico não encontrada' })
  })

  it('403 sem permissão no cliente do contrato', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(comum)
    ;(prisma.usuario.findUnique as jest.Mock).mockResolvedValue({ clientesPermitidos: [] })
    expect((await PATCH(patch({ numero: 'X' }), contexto)).status).toBe(403)
    expect(prisma.historicoContrato.update).not.toHaveBeenCalled()
  })

  it('400 com tipo inválido ou valor negativo', async () => {
    expect((await PATCH(patch({ tipo: 'X' }), contexto)).status).toBe(400)
    expect((await PATCH(patch({ valor: '-1' }), contexto)).status).toBe(400)
  })

  it('404 quando a linha some entre a leitura e a escrita (P2025)', async () => {
    ;(prisma.historicoContrato.update as jest.Mock).mockRejectedValueOnce(p2025())
    expect((await PATCH(patch({ numero: 'X' }), contexto)).status).toBe(404)
  })

  it('atualiza só os campos enviados', async () => {
    ;(prisma.historicoContrato.update as jest.Mock).mockImplementation(({ data }) => ({ id: 'h1', valor: null, ...data }))
    const resposta = await PATCH(patch({ tipo: 'RESCISAO', observacao: '' }), contexto)
    expect(resposta.status).toBe(200)
    expect(prisma.historicoContrato.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'h1' }, data: { tipo: 'RESCISAO', observacao: null } })
    )
  })
})

describe('DELETE /api/historico-contrato/[id]', () => {
  it('401 sem usuário', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(null)
    expect((await DELETE(del(), contexto)).status).toBe(401)
  })

  it('404 quando a linha não existe', async () => {
    ;(prisma.historicoContrato.findUnique as jest.Mock).mockResolvedValue(null)
    expect((await DELETE(del(), contexto)).status).toBe(404)
  })

  it('403 sem permissão no cliente do contrato', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(comum)
    ;(prisma.usuario.findUnique as jest.Mock).mockResolvedValue({ clientesPermitidos: [] })
    expect((await DELETE(del(), contexto)).status).toBe(403)
  })

  it('exclui a linha', async () => {
    const resposta = await DELETE(del(), contexto)
    expect(resposta.status).toBe(200)
    expect(prisma.historicoContrato.delete).toHaveBeenCalledWith({ where: { id: 'h1' } })
  })
})

describe('somente leitura', () => {
  beforeEach(() => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(comum)
    ;(prisma.usuario.findUnique as jest.Mock).mockResolvedValue({ clientesPermitidos: [], gerencias: [] })
  })

  it('PATCH 403 com motivo para quem vê mas não é da gerência', async () => {
    const resposta = await PATCH(patch({ numero: 'X' }), contexto)
    expect(resposta.status).toBe(403)
    await expect(resposta.json()).resolves.toMatchObject({
      motivo: 'Somente leitura: só a equipe da gerência deste cliente edita.',
    })
    expect(prisma.historicoContrato.update).not.toHaveBeenCalled()
  })

  it('DELETE 403 com motivo para quem vê mas não é da gerência', async () => {
    const resposta = await DELETE(del(), contexto)
    expect(resposta.status).toBe(403)
    await expect(resposta.json()).resolves.toMatchObject({
      motivo: 'Somente leitura: só a equipe da gerência deste cliente edita.',
    })
    expect(prisma.historicoContrato.delete).not.toHaveBeenCalled()
  })
})
