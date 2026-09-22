/** @jest-environment node */
import { NextRequest } from 'next/server'

jest.mock('@/lib/auth', () => ({
  ...jest.requireActual('@/lib/auth'),
  getAuthUser: jest.fn(),
}))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    responsavelCliente: { findUnique: jest.fn(), update: jest.fn(), delete: jest.fn() },
    usuario: { findUnique: jest.fn() },
  },
}))

import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { DELETE, PATCH } from './route'

const admin = { id: 'u1', nome: 'Admin', email: 'a@x', role: 'admin' as const }
const comum = { id: 'u2', nome: 'Comum', email: 'c@x', role: 'responsavel' as const }
const contexto = { params: Promise.resolve({ id: 'r1' }) }
const url = 'http://localhost/api/responsaveis/r1'

const patch = (corpo: unknown) =>
  new NextRequest(url, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) })
const del = () => new NextRequest(url, { method: 'DELETE' })

beforeEach(() => {
  jest.clearAllMocks()
  ;(getAuthUser as jest.Mock).mockResolvedValue(admin)
  ;(prisma.responsavelCliente.findUnique as jest.Mock).mockResolvedValue({ id: 'r1', clienteId: 'c1' })
})

describe('PATCH /api/responsaveis/[id]', () => {
  it('401 sem usuário', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(null)
    expect((await PATCH(patch({ nome: 'Ana' }), contexto)).status).toBe(401)
  })

  it('404 quando o responsável não existe', async () => {
    ;(prisma.responsavelCliente.findUnique as jest.Mock).mockResolvedValue(null)
    const resposta = await PATCH(patch({ nome: 'Ana' }), contexto)
    expect(resposta.status).toBe(404)
    await expect(resposta.json()).resolves.toEqual({ error: 'responsável não encontrado' })
  })

  it('403 sem permissão no cliente do registro', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(comum)
    ;(prisma.usuario.findUnique as jest.Mock).mockResolvedValue({ clientesPermitidos: [{ id: 'outro' }] })
    expect((await PATCH(patch({ nome: 'Ana' }), contexto)).status).toBe(403)
    expect(prisma.responsavelCliente.update).not.toHaveBeenCalled()
  })

  it('400 com e-mail inválido', async () => {
    const resposta = await PATCH(patch({ nome: 'Ana', email: 'x' }), contexto)
    expect(resposta.status).toBe(400)
    expect(prisma.responsavelCliente.update).not.toHaveBeenCalled()
  })

  it('atualiza o responsável', async () => {
    ;(prisma.responsavelCliente.update as jest.Mock).mockImplementation(({ data }) => ({ id: 'r1', ...data }))
    const resposta = await PATCH(patch({ nome: 'Ana Souza', area: '', email: 'ana@x.gov.br' }), contexto)
    expect(resposta.status).toBe(200)
    expect(prisma.responsavelCliente.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'r1' },
        data: { nome: 'Ana Souza', area: null, email: 'ana@x.gov.br' },
      })
    )
    await expect(resposta.json()).resolves.toEqual(expect.objectContaining({ nome: 'Ana Souza' }))
  })
})

describe('DELETE /api/responsaveis/[id]', () => {
  it('401 sem usuário', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(null)
    expect((await DELETE(del(), contexto)).status).toBe(401)
  })

  it('404 quando o responsável não existe', async () => {
    ;(prisma.responsavelCliente.findUnique as jest.Mock).mockResolvedValue(null)
    expect((await DELETE(del(), contexto)).status).toBe(404)
  })

  it('403 sem permissão no cliente do registro', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(comum)
    ;(prisma.usuario.findUnique as jest.Mock).mockResolvedValue({ clientesPermitidos: [] })
    expect((await DELETE(del(), contexto)).status).toBe(403)
    expect(prisma.responsavelCliente.delete).not.toHaveBeenCalled()
  })

  it('exclui o responsável', async () => {
    const resposta = await DELETE(del(), contexto)
    expect(resposta.status).toBe(200)
    await expect(resposta.json()).resolves.toEqual({ ok: true })
    expect(prisma.responsavelCliente.delete).toHaveBeenCalledWith({ where: { id: 'r1' } })
  })
})
