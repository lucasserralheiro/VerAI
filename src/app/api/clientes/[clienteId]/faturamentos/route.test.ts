/** @jest-environment node */
import { NextRequest } from 'next/server'
import { Prisma } from '@prisma/client'

jest.mock('@/lib/auth', () => ({
  ...jest.requireActual('@/lib/auth'),
  getAuthUser: jest.fn(),
}))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    cliente: { findUnique: jest.fn() },
    contrato: { findUnique: jest.fn() },
    faturamento: { findMany: jest.fn(), create: jest.fn(), findFirst: jest.fn().mockResolvedValue(null) },
    notaFiscal: { groupBy: jest.fn() },
    usuario: { findUnique: jest.fn() },
  },
}))

import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { GET, POST } from './route'

const admin = { id: 'u1', nome: 'Admin', email: 'a@x', role: 'admin' as const }
const comum = { id: 'u2', nome: 'Comum', email: 'c@x', role: 'responsavel' as const }
const contexto = { params: Promise.resolve({ clienteId: 'c1' }) }
const base = 'http://localhost/api/clientes/c1/faturamentos'
const get = (query = '') => new NextRequest(`${base}${query}`)
const post = (corpo: unknown) =>
  new NextRequest(base, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) })

const valido = { contratoId: 'k1', competenciaAno: '2026', competenciaMes: '8' }

beforeEach(() => {
  jest.clearAllMocks()
  ;(getAuthUser as jest.Mock).mockResolvedValue(admin)
  ;(prisma.cliente.findUnique as jest.Mock).mockResolvedValue({ id: 'c1' })
  ;(prisma.contrato.findUnique as jest.Mock).mockResolvedValue({ clienteId: 'c1' })
  ;(prisma.faturamento.findMany as jest.Mock).mockResolvedValue([])
  ;(prisma.notaFiscal.groupBy as jest.Mock).mockResolvedValue([])
})

describe('GET /api/clientes/[clienteId]/faturamentos', () => {
  it('401 sem usuário', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(null)
    expect((await GET(get(), contexto)).status).toBe(401)
  })

  it('403 sem permissão no cliente', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(comum)
    ;(prisma.usuario.findUnique as jest.Mock).mockResolvedValue({ clientesPermitidos: [] })
    expect((await GET(get(), contexto)).status).toBe(403)
  })

  it('404 quando o cliente não existe', async () => {
    ;(prisma.cliente.findUnique as jest.Mock).mockResolvedValue(null)
    expect((await GET(get(), contexto)).status).toBe(404)
  })

  it('400 com filtro de mês inválido', async () => {
    const resposta = await GET(get('?mes=13'), contexto)
    expect(resposta.status).toBe(400)
    await expect(resposta.json()).resolves.toEqual({ error: 'Mês: deve ser um número inteiro entre 1 e 12' })
  })

  it('filtra por ano, mês e contrato, da competência mais recente pra trás', async () => {
    await GET(get('?ano=2026&mes=8&contratoId=k1'), contexto)
    expect(prisma.faturamento.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { clienteId: 'c1', competenciaAno: 2026, competenciaMes: 8, contratoId: 'k1' },
        orderBy: [{ competenciaAno: 'desc' }, { competenciaMes: 'desc' }, { createdAt: 'desc' }],
      })
    )
  })

  it('valor exibido cai pra soma das notas quando o faturamento não tem valor, com os serviços das notas', async () => {
    ;(prisma.faturamento.findMany as jest.Mock).mockResolvedValue([
      { id: 'f1', competenciaAno: 2026, competenciaMes: 8, valor: null },
      { id: 'f2', competenciaAno: 2026, competenciaMes: 7, valor: new Prisma.Decimal('99') },
    ])
    ;(prisma.notaFiscal.groupBy as jest.Mock).mockResolvedValue([
      { faturamentoId: 'f1', servico: 'Data Center', _sum: { valor: new Prisma.Decimal('100.5') } },
      { faturamentoId: 'f1', servico: 'Comunicação', _sum: { valor: new Prisma.Decimal('0.5') } },
      { faturamentoId: 'f1', servico: null, _sum: { valor: new Prisma.Decimal('1') } },
    ])
    const resposta = await GET(get(), contexto)
    await expect(resposta.json()).resolves.toEqual([
      expect.objectContaining({ id: 'f1', valor: null, valorNotas: '102', valorExibido: '102', servicos: ['Comunicação', 'Data Center'] }),
      expect.objectContaining({ id: 'f2', valor: '99', valorNotas: '0', valorExibido: '99', servicos: [] }),
    ])
  })
})

describe('POST /api/clientes/[clienteId]/faturamentos', () => {
  it('401 sem usuário', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(null)
    expect((await POST(post(valido), contexto)).status).toBe(401)
  })

  it('403 sem permissão no cliente', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(comum)
    ;(prisma.usuario.findUnique as jest.Mock).mockResolvedValue({ clientesPermitidos: [] })
    expect((await POST(post(valido), contexto)).status).toBe(403)
  })

  it('400 sem competência', async () => {
    const resposta = await POST(post({ contratoId: 'k1', competenciaAno: '2026' }), contexto)
    expect(resposta.status).toBe(400)
    await expect(resposta.json()).resolves.toEqual({ error: 'Mês: campo obrigatório' })
  })

  it('400 quando o contrato é de outro cliente', async () => {
    ;(prisma.contrato.findUnique as jest.Mock).mockResolvedValue({ clienteId: 'c2' })
    const resposta = await POST(post(valido), contexto)
    expect(resposta.status).toBe(400)
    await expect(resposta.json()).resolves.toEqual({ error: 'Contrato: não pertence a este cliente' })
    expect(prisma.faturamento.create).not.toHaveBeenCalled()
  })

  it('cria o faturamento no cliente da URL', async () => {
    ;(prisma.faturamento.create as jest.Mock).mockImplementation(({ data }) => ({ id: 'f9', valor: null, ...data }))
    const resposta = await POST(post({ ...valido, sei: '7010.2026/1', enviadoCliente: true, clienteId: 'outro' }), contexto)
    expect(resposta.status).toBe(201)
    expect(prisma.faturamento.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { clienteId: 'c1', contratoId: 'k1', competenciaAno: 2026, competenciaMes: 8, sei: '7010.2026/1', enviadoCliente: true },
      })
    )
    await expect(resposta.json()).resolves.toEqual(expect.objectContaining({ id: 'f9', valorExibido: '0' }))
  })
})

describe('POST — um lançamento principal por contrato + competência', () => {
  it('409 quando já existe o principal do mês (e não grava)', async () => {
    ;(prisma.faturamento.findFirst as jest.Mock).mockResolvedValueOnce({ id: 'f-existente' })
    const resposta = await POST(post(valido), contexto)
    expect(resposta.status).toBe(409)
    expect(prisma.faturamento.create).not.toHaveBeenCalled()
  })

  it('complementar passa mesmo com o principal existente', async () => {
    ;(prisma.faturamento.findFirst as jest.Mock).mockResolvedValueOnce({ id: 'f-existente' })
    ;(prisma.faturamento.create as jest.Mock).mockResolvedValueOnce({ id: 'f2', contrato: { id: 'k1', numeroTermo: 'X' }, valor: null })
    const resposta = await POST(post({ ...valido, complementar: true }), contexto)
    expect(resposta.status).toBe(201)
    expect(prisma.faturamento.findFirst).not.toHaveBeenCalled()
  })

  it('situação fora da lista é recusada; em qualquer caixa vira a forma canônica', async () => {
    expect((await POST(post({ ...valido, situacao: 'quase pago' }), contexto)).status).toBe(400)
    ;(prisma.faturamento.create as jest.Mock).mockResolvedValueOnce({ id: 'f3', contrato: { id: 'k1', numeroTermo: 'X' }, valor: null })
    await POST(post({ ...valido, situacao: 'cancelado' }), contexto)
    expect(prisma.faturamento.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ situacao: 'Cancelado' }) })
    )
  })
})
