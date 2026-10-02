/** @jest-environment node */
import { NextRequest } from 'next/server'
import { Prisma } from '@prisma/client'

jest.mock('@/lib/auth', () => ({
  ...jest.requireActual('@/lib/auth'),
  getAuthUser: jest.fn(),
}))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    itemContrato: { findUnique: jest.fn(), update: jest.fn(), delete: jest.fn() },
    contrato: { findUnique: jest.fn() },
    cliente: { count: jest.fn() },
    usuario: { findUnique: jest.fn() },
  },
}))

import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { DELETE, PATCH } from './route'

const admin = { id: 'u1', nome: 'Admin', email: 'a@x', role: 'admin' as const }
const comum = { id: 'u2', nome: 'Comum', email: 'c@x', role: 'responsavel' as const }
const contexto = { params: Promise.resolve({ id: 'i1' }) }
const url = 'http://localhost/api/itens-contrato/i1'
const patch = (corpo: unknown) =>
  new NextRequest(url, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) })
const del = () => new NextRequest(url, { method: 'DELETE' })

const itemVinculado = {
  id: 'i1',
  contrato: { clienteId: 'c1' },
  quantidade: new Prisma.Decimal('2'),
  valorUnitario: new Prisma.Decimal('10'),
  valorTotal: new Prisma.Decimal('20'),
  clienteSiglaLegado: null as string | null,
}
const itemSolto = { ...itemVinculado, contrato: null }

beforeEach(() => {
  jest.clearAllMocks()
  ;(getAuthUser as jest.Mock).mockResolvedValue(admin)
  ;(prisma.itemContrato.findUnique as jest.Mock).mockResolvedValue(itemVinculado)
  ;(prisma.contrato.findUnique as jest.Mock).mockResolvedValue({ clienteId: 'c1' })
  ;(prisma.cliente.count as jest.Mock).mockResolvedValue(1)
  ;(prisma.itemContrato.update as jest.Mock).mockImplementation(({ data }) => ({
    id: 'i1',
    contratoId: null,
    contratoTextoLegado: null,
    descricao: null,
    quantidade: null,
    valorUnitario: null,
    valorTotal: new Prisma.Decimal('20'),
    ...data,
  }))
})

describe('PATCH /api/itens-contrato/[id]', () => {
  it('401 sem usuário', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(null)
    expect((await PATCH(patch({}), contexto)).status).toBe(401)
  })

  it('404 quando o item não existe', async () => {
    ;(prisma.itemContrato.findUnique as jest.Mock).mockResolvedValue(null)
    const resposta = await PATCH(patch({ descricao: 'x' }), contexto)
    expect(resposta.status).toBe(404)
    await expect(resposta.json()).resolves.toEqual({ error: 'item não encontrado' })
  })

  it('403 sem permissão no cliente do contrato atual do item', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(comum)
    ;(prisma.usuario.findUnique as jest.Mock).mockResolvedValue({ clientesPermitidos: [{ id: 'outro' }] })
    expect((await PATCH(patch({ descricao: 'x' }), contexto)).status).toBe(403)
    expect(prisma.itemContrato.update).not.toHaveBeenCalled()
  })

  it('403 em item sem contrato para quem não vê nenhum cliente', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(comum)
    ;(prisma.itemContrato.findUnique as jest.Mock).mockResolvedValue(itemSolto)
    ;(prisma.cliente.count as jest.Mock).mockResolvedValue(0)
    expect((await PATCH(patch({ descricao: 'x' }), contexto)).status).toBe(403)
  })

  it('400 ao vincular a um contrato que não existe', async () => {
    ;(prisma.contrato.findUnique as jest.Mock).mockResolvedValue(null)
    const resposta = await PATCH(patch({ contratoId: 'k404' }), contexto)
    expect(resposta.status).toBe(400)
    await expect(resposta.json()).resolves.toEqual({ error: 'Contrato: não encontrado' })
  })

  it('403 ao vincular a contrato de cliente que o usuário não vê', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(comum)
    ;(prisma.itemContrato.findUnique as jest.Mock).mockResolvedValue(itemSolto)
    ;(prisma.usuario.findUnique as jest.Mock).mockResolvedValue({ clientesPermitidos: [{ id: 'c1' }] })
    ;(prisma.contrato.findUnique as jest.Mock).mockResolvedValue({ clienteId: 'c2' })
    expect((await PATCH(patch({ contratoId: 'k2' }), contexto)).status).toBe(403)
    expect(prisma.itemContrato.update).not.toHaveBeenCalled()
  })

  it('vincula um item importado a um contrato (reconciliação)', async () => {
    ;(prisma.itemContrato.findUnique as jest.Mock).mockResolvedValue(itemSolto)
    const resposta = await PATCH(patch({ contratoId: 'k1' }), contexto)
    expect(resposta.status).toBe(200)
    expect(prisma.itemContrato.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'i1' }, data: { contratoId: 'k1' } })
    )
  })

  it('400 ao apagar o valor total', async () => {
    expect((await PATCH(patch({ valorTotal: '' }), contexto)).status).toBe(400)
  })

  it('recalcula quando a tela reenvia o total antigo junto com a quantidade nova', async () => {
    await PATCH(patch({ quantidade: '5', valorUnitario: '10', valorTotal: '20' }), contexto)
    expect(prisma.itemContrato.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { quantidade: '5', valorUnitario: '10', valorTotal: '50' } })
    )
  })

  it('total diferente do gravado é informado de propósito e vence', async () => {
    await PATCH(patch({ quantidade: '5', valorTotal: '49,90' }), contexto)
    expect(prisma.itemContrato.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { quantidade: '5', valorTotal: '49.90' } })
    )
  })

  it('400 ao vincular item do legado de um cliente a contrato de outro cliente', async () => {
    ;(prisma.itemContrato.findUnique as jest.Mock).mockResolvedValue({ ...itemSolto, clienteSiglaLegado: 'SMS' })
    ;(prisma.contrato.findUnique as jest.Mock).mockResolvedValue({ clienteId: 'c1', cliente: { siglaLegado: 'SME' } })
    const resposta = await PATCH(patch({ contratoId: 'k1' }), contexto)
    expect(resposta.status).toBe(400)
    expect(prisma.itemContrato.update).not.toHaveBeenCalled()
  })

  it('recalcula o valor total quando muda quantidade ou valor unitário sem mandar o total', async () => {
    await PATCH(patch({ quantidade: '5' }), contexto)
    expect(prisma.itemContrato.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { quantidade: '5', valorTotal: '50' } })
    )
  })
})

describe('DELETE /api/itens-contrato/[id]', () => {
  it('401 sem usuário', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(null)
    expect((await DELETE(del(), contexto)).status).toBe(401)
  })

  it('404 quando o item não existe', async () => {
    ;(prisma.itemContrato.findUnique as jest.Mock).mockResolvedValue(null)
    expect((await DELETE(del(), contexto)).status).toBe(404)
  })

  it('403 sem permissão no cliente do contrato do item', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(comum)
    ;(prisma.usuario.findUnique as jest.Mock).mockResolvedValue({ clientesPermitidos: [] })
    expect((await DELETE(del(), contexto)).status).toBe(403)
    expect(prisma.itemContrato.delete).not.toHaveBeenCalled()
  })

  it('exclui o item', async () => {
    const resposta = await DELETE(del(), contexto)
    expect(resposta.status).toBe(200)
    expect(prisma.itemContrato.delete).toHaveBeenCalledWith({ where: { id: 'i1' } })
  })
})

describe('somente leitura', () => {
  beforeEach(() => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(comum)
    ;(prisma.usuario.findUnique as jest.Mock).mockResolvedValue({ clientesPermitidos: [], gerencias: [] })
  })

  it('PATCH 403 com motivo para quem vê mas não é da gerência', async () => {
    const resposta = await PATCH(patch({ descricao: 'X' }), contexto)
    expect(resposta.status).toBe(403)
    await expect(resposta.json()).resolves.toMatchObject({
      motivo: 'Somente leitura: só a equipe da gerência deste cliente edita.',
    })
    expect(prisma.itemContrato.update).not.toHaveBeenCalled()
  })

  it('DELETE 403 com motivo para quem vê mas não é da gerência', async () => {
    const resposta = await DELETE(del(), contexto)
    expect(resposta.status).toBe(403)
    await expect(resposta.json()).resolves.toMatchObject({
      motivo: 'Somente leitura: só a equipe da gerência deste cliente edita.',
    })
    expect(prisma.itemContrato.delete).not.toHaveBeenCalled()
  })
})
