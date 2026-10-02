/** @jest-environment node */
import { NextRequest } from 'next/server'
import { Prisma } from '@prisma/client'

jest.mock('@/lib/auth', () => ({
  ...jest.requireActual('@/lib/auth'),
  getAuthUser: jest.fn(),
}))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    termoConfirmacao: { findUnique: jest.fn(), update: jest.fn(), delete: jest.fn() },
    contrato: { findUnique: jest.fn() },
    usuario: { findUnique: jest.fn() },
  },
}))

import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { DELETE, PATCH } from './route'

const admin = { id: 'u1', nome: 'Admin', email: 'a@x', role: 'admin' as const }
const comum = { id: 'u2', nome: 'Comum', email: 'c@x', role: 'responsavel' as const }
const contexto = { params: Promise.resolve({ id: 't1' }) }
const url = 'http://localhost/api/termos-confirmacao/t1'
const patch = (corpo: unknown) =>
  new NextRequest(url, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) })
const del = () => new NextRequest(url, { method: 'DELETE' })
const p2025 = () => new Prisma.PrismaClientKnownRequestError('sumiu', { code: 'P2025', clientVersion: 'teste' })

beforeEach(() => {
  jest.clearAllMocks()
  ;(getAuthUser as jest.Mock).mockResolvedValue(admin)
  ;(prisma.termoConfirmacao.findUnique as jest.Mock).mockResolvedValue({
    id: 't1',
    clienteId: 'c1',
    vigenciaInicio: new Date('2026-01-01T00:00:00Z'),
    vigenciaFim: null,
  })
})

describe('PATCH /api/termos-confirmacao/[id]', () => {
  it('401 sem usuário', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(null)
    expect((await PATCH(patch({}), contexto)).status).toBe(401)
  })

  it('404 quando o termo não existe', async () => {
    ;(prisma.termoConfirmacao.findUnique as jest.Mock).mockResolvedValue(null)
    const resposta = await PATCH(patch({ numero: 'X' }), contexto)
    expect(resposta.status).toBe(404)
    await expect(resposta.json()).resolves.toEqual({ error: 'termo de confirmação não encontrado' })
  })

  it('403 sem permissão no cliente do termo', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(comum)
    ;(prisma.usuario.findUnique as jest.Mock).mockResolvedValue({ clientesPermitidos: [{ id: 'outro' }] })
    expect((await PATCH(patch({ numero: 'X' }), contexto)).status).toBe(403)
    expect(prisma.termoConfirmacao.update).not.toHaveBeenCalled()
  })

  it('400 quando o contrato novo é de outro cliente', async () => {
    ;(prisma.contrato.findUnique as jest.Mock).mockResolvedValue({ clienteId: 'c2' })
    const resposta = await PATCH(patch({ contratoId: 'k9' }), contexto)
    expect(resposta.status).toBe(400)
    await expect(resposta.json()).resolves.toEqual({ error: 'Contrato: não pertence a este cliente' })
  })

  it('400 quando o fim novo fica antes do início já gravado', async () => {
    expect((await PATCH(patch({ vigenciaFim: '2025-06-01' }), contexto)).status).toBe(400)
    expect(prisma.termoConfirmacao.update).not.toHaveBeenCalled()
  })

  it('404 quando o termo some entre a leitura e a escrita (P2025)', async () => {
    ;(prisma.termoConfirmacao.update as jest.Mock).mockRejectedValueOnce(p2025())
    expect((await PATCH(patch({ numero: 'X' }), contexto)).status).toBe(404)
  })

  it('desvincula o contrato e atualiza os campos enviados', async () => {
    ;(prisma.termoConfirmacao.update as jest.Mock).mockImplementation(({ data }) => ({ id: 't1', valor: null, ...data }))
    const resposta = await PATCH(patch({ contratoId: '', numero: 'TC-2' }), contexto)
    expect(resposta.status).toBe(200)
    expect(prisma.contrato.findUnique).not.toHaveBeenCalled()
    expect(prisma.termoConfirmacao.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 't1' }, data: { contratoId: null, numero: 'TC-2' } })
    )
  })
})

describe('DELETE /api/termos-confirmacao/[id]', () => {
  it('401 sem usuário', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(null)
    expect((await DELETE(del(), contexto)).status).toBe(401)
  })

  it('404 quando o termo não existe', async () => {
    ;(prisma.termoConfirmacao.findUnique as jest.Mock).mockResolvedValue(null)
    expect((await DELETE(del(), contexto)).status).toBe(404)
  })

  it('403 sem permissão no cliente do termo', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(comum)
    ;(prisma.usuario.findUnique as jest.Mock).mockResolvedValue({ clientesPermitidos: [] })
    expect((await DELETE(del(), contexto)).status).toBe(403)
    expect(prisma.termoConfirmacao.delete).not.toHaveBeenCalled()
  })

  it('exclui o termo', async () => {
    const resposta = await DELETE(del(), contexto)
    expect(resposta.status).toBe(200)
    await expect(resposta.json()).resolves.toEqual({ ok: true })
    expect(prisma.termoConfirmacao.delete).toHaveBeenCalledWith({ where: { id: 't1' } })
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
    expect(prisma.termoConfirmacao.update).not.toHaveBeenCalled()
  })

  it('DELETE 403 com motivo para quem vê mas não é da gerência', async () => {
    const resposta = await DELETE(del(), contexto)
    expect(resposta.status).toBe(403)
    await expect(resposta.json()).resolves.toMatchObject({
      motivo: 'Somente leitura: só a equipe da gerência deste cliente edita.',
    })
    expect(prisma.termoConfirmacao.delete).not.toHaveBeenCalled()
  })
})
