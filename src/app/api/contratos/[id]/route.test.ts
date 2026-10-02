/** @jest-environment node */
import { NextRequest } from 'next/server'
import { Prisma } from '@prisma/client'

jest.mock('@/lib/auth', () => ({
  ...jest.requireActual('@/lib/auth'),
  getAuthUser: jest.fn(),
}))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    contrato: { findUnique: jest.fn(), update: jest.fn(), delete: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
    historicoContrato: { findMany: jest.fn() },
    itemContrato: { findMany: jest.fn() },
    usuario: { findUnique: jest.fn() },
  },
}))
jest.mock('@/lib/relatorios-clientes/saldos-contratos', () => ({ saldosDosContratos: jest.fn() }))

import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { saldosDosContratos } from '@/lib/relatorios-clientes/saldos-contratos'
import { DELETE, GET, PATCH } from './route'

const admin = { id: 'u1', nome: 'Admin', email: 'a@x', role: 'admin' as const }
const comum = { id: 'u2', nome: 'Comum', email: 'c@x', role: 'responsavel' as const }
const contexto = { params: Promise.resolve({ id: 'k1' }) }
const url = 'http://localhost/api/contratos/k1'
const patch = (corpo: unknown) =>
  new NextRequest(url, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) })

const SALDO = { valorItens: '1000', faturado: '0', saldo: '1000', percentualFaturado: '0.00' }

beforeEach(() => {
  jest.clearAllMocks()
  ;(getAuthUser as jest.Mock).mockResolvedValue(admin)
  ;(prisma.contrato.findUnique as jest.Mock).mockImplementation(({ select }) =>
    select.numeroTermo
      ? { id: 'k1', clienteId: 'c1', numeroTermo: 'TC 203/2023', dataVencimento: null }
      : { id: 'k1', clienteId: 'c1' }
  )
  ;(prisma.historicoContrato.findMany as jest.Mock).mockResolvedValue([])
  ;(prisma.itemContrato.findMany as jest.Mock).mockResolvedValue([])
  ;(saldosDosContratos as jest.Mock).mockResolvedValue(new Map([['k1', SALDO]]))
})

describe('GET /api/contratos/[id]', () => {
  it('401 sem usuário', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(null)
    expect((await GET(new NextRequest(url), contexto)).status).toBe(401)
  })

  it('404 quando o contrato não existe', async () => {
    ;(prisma.contrato.findUnique as jest.Mock).mockResolvedValue(null)
    const resposta = await GET(new NextRequest(url), contexto)
    expect(resposta.status).toBe(404)
    await expect(resposta.json()).resolves.toEqual({ error: 'contrato não encontrado' })
  })

  it('403 sem permissão no cliente do contrato', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(comum)
    ;(prisma.usuario.findUnique as jest.Mock).mockResolvedValue({ clientesPermitidos: [] })
    expect((await GET(new NextRequest(url), contexto)).status).toBe(403)
  })

  it('devolve cabeçalho, histórico por data, itens e saldo, decimais como string', async () => {
    ;(prisma.historicoContrato.findMany as jest.Mock).mockResolvedValue([
      { id: 'h1', tipo: 'ADITIVO', valor: new Prisma.Decimal('50.5') },
    ])
    ;(prisma.itemContrato.findMany as jest.Mock).mockResolvedValue([
      { id: 'i1', quantidade: new Prisma.Decimal('2'), valorUnitario: null, valorTotal: new Prisma.Decimal('1000') },
    ])
    const resposta = await GET(new NextRequest(url), contexto)
    expect(resposta.status).toBe(200)
    const corpo = await resposta.json()
    expect(corpo).toEqual(
      expect.objectContaining({ id: 'k1', numeroTermo: 'TC 203/2023', saldo: SALDO, vencimento: { nivel: 'sem-data', dias: null } })
    )
    expect(corpo.historico).toEqual([expect.objectContaining({ id: 'h1', tipo: 'ADITIVO', valor: '50.5' })])
    expect(corpo.itens).toEqual([expect.objectContaining({ id: 'i1', quantidade: '2', valorTotal: '1000' })])
    expect(prisma.historicoContrato.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { contratoId: 'k1' }, orderBy: [{ data: { sort: 'asc', nulls: 'last' } }, { createdAt: 'asc' }] })
    )
  })
})

describe('PATCH /api/contratos/[id]', () => {
  it('401 sem usuário', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(null)
    expect((await PATCH(patch({ numeroTermo: 'X' }), contexto)).status).toBe(401)
  })

  it('404 quando o contrato não existe', async () => {
    ;(prisma.contrato.findUnique as jest.Mock).mockResolvedValue(null)
    expect((await PATCH(patch({ numeroTermo: 'X' }), contexto)).status).toBe(404)
  })

  it('403 sem permissão no cliente do contrato', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(comum)
    ;(prisma.usuario.findUnique as jest.Mock).mockResolvedValue({ clientesPermitidos: [{ id: 'outro' }] })
    expect((await PATCH(patch({ numeroTermo: 'X' }), contexto)).status).toBe(403)
    expect(prisma.contrato.update).not.toHaveBeenCalled()
  })

  it('400 sem nº do termo', async () => {
    expect((await PATCH(patch({ numeroTermo: ' ' }), contexto)).status).toBe(400)
  })

  it('404 quando o contrato some entre a leitura e a escrita (P2025)', async () => {
    ;(prisma.contrato.update as jest.Mock).mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('sumiu', { code: 'P2025', clientVersion: 'teste' })
    )
    expect((await PATCH(patch({ numeroTermo: 'X' }), contexto)).status).toBe(404)
  })

  it('atualiza o cabeçalho e devolve com saldo', async () => {
    ;(prisma.contrato.update as jest.Mock).mockImplementation(({ data }) => ({ id: 'k1', clienteId: 'c1', dataVencimento: null, ...data }))
    const resposta = await PATCH(patch({ numeroTermo: 'TC 203/2023', situacao: 'Ativo', vigente: 'false' }), contexto)
    expect(resposta.status).toBe(200)
    expect(prisma.contrato.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'k1' }, data: { numeroTermo: 'TC 203/2023', situacao: 'Ativo', vigente: false } })
    )
    await expect(resposta.json()).resolves.toEqual(expect.objectContaining({ situacao: 'Ativo', saldo: SALDO }))
  })
})

describe('somente leitura', () => {
  beforeEach(() => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(comum)
    ;(prisma.usuario.findUnique as jest.Mock).mockResolvedValue({ clientesPermitidos: [], gerencias: [] })
  })

  it('PATCH 403 com motivo para quem vê mas não é da gerência', async () => {
    const resposta = await PATCH(patch({ situacao: 'Ativo' }), contexto)
    expect(resposta.status).toBe(403)
    await expect(resposta.json()).resolves.toMatchObject({
      motivo: 'Somente leitura: só a equipe da gerência deste cliente edita.',
    })
    expect(prisma.contrato.update).not.toHaveBeenCalled()
  })

  it('DELETE 403 com motivo para quem vê mas não é da gerência', async () => {
    const resposta = await DELETE(new NextRequest(url, { method: 'DELETE' }), contexto)
    expect(resposta.status).toBe(403)
    await expect(resposta.json()).resolves.toMatchObject({
      motivo: 'Somente leitura: só a equipe da gerência deste cliente edita.',
    })
    expect(prisma.contrato.delete).not.toHaveBeenCalled()
  })
})
