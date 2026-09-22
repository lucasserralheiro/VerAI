/** @jest-environment node */
import { NextRequest } from 'next/server'

jest.mock('@/lib/auth', () => ({
  ...jest.requireActual('@/lib/auth'),
  getAuthUser: jest.fn(),
}))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    cliente: { findUnique: jest.fn() },
    contrato: { findMany: jest.fn(), create: jest.fn() },
    usuario: { findUnique: jest.fn() },
  },
}))
jest.mock('@/lib/relatorios-clientes/saldos-contratos', () => ({ saldosDosContratos: jest.fn() }))

import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { saldosDosContratos } from '@/lib/relatorios-clientes/saldos-contratos'
import { GET, POST } from './route'

const admin = { id: 'u1', nome: 'Admin', email: 'a@x', role: 'admin' as const }
const comum = { id: 'u2', nome: 'Comum', email: 'c@x', role: 'responsavel' as const }
const contexto = { params: Promise.resolve({ clienteId: 'c1' }) }
const url = 'http://localhost/api/clientes/c1/contratos'
const post = (corpo: unknown) =>
  new NextRequest(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) })

const SEM_SALDO = { valorItens: '0', faturado: '0', saldo: null, percentualFaturado: null }

beforeEach(() => {
  jest.clearAllMocks()
  ;(getAuthUser as jest.Mock).mockResolvedValue(admin)
  ;(prisma.cliente.findUnique as jest.Mock).mockResolvedValue({ id: 'c1' })
  ;(prisma.contrato.findMany as jest.Mock).mockResolvedValue([])
  ;(saldosDosContratos as jest.Mock).mockImplementation(async (ids: string[]) => new Map(ids.map((id) => [id, SEM_SALDO])))
})

describe('GET /api/clientes/[clienteId]/contratos', () => {
  it('401 sem usuário', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(null)
    expect((await GET(new NextRequest(url), contexto)).status).toBe(401)
  })

  it('403 sem permissão no cliente', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(comum)
    ;(prisma.usuario.findUnique as jest.Mock).mockResolvedValue({ clientesPermitidos: [] })
    expect((await GET(new NextRequest(url), contexto)).status).toBe(403)
  })

  it('404 quando o cliente não existe', async () => {
    ;(prisma.cliente.findUnique as jest.Mock).mockResolvedValue(null)
    const resposta = await GET(new NextRequest(url), contexto)
    expect(resposta.status).toBe(404)
    await expect(resposta.json()).resolves.toEqual({ error: 'cliente não encontrado' })
  })

  it('lista os contratos do cliente com saldo e situação de vencimento', async () => {
    ;(prisma.contrato.findMany as jest.Mock).mockResolvedValue([
      { id: 'k1', clienteId: 'c1', numeroTermo: 'TC 203/2023', dataVencimento: null },
    ])
    ;(saldosDosContratos as jest.Mock).mockResolvedValue(
      new Map([['k1', { valorItens: '1000', faturado: '250', saldo: '750', percentualFaturado: '25.00' }]])
    )
    const resposta = await GET(new NextRequest(url), contexto)
    expect(resposta.status).toBe(200)
    await expect(resposta.json()).resolves.toEqual([
      expect.objectContaining({
        id: 'k1',
        numeroTermo: 'TC 203/2023',
        saldo: expect.objectContaining({ saldo: '750', percentualFaturado: '25.00' }),
        vencimento: { nivel: 'sem-data', dias: null },
      }),
    ])
    expect(prisma.contrato.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { clienteId: 'c1' } }))
    expect(saldosDosContratos).toHaveBeenCalledWith(['k1'])
  })
})

describe('POST /api/clientes/[clienteId]/contratos', () => {
  it('401 sem usuário', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(null)
    expect((await POST(post({ numeroTermo: 'X' }), contexto)).status).toBe(401)
  })

  it('403 sem permissão no cliente', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(comum)
    ;(prisma.usuario.findUnique as jest.Mock).mockResolvedValue({ clientesPermitidos: [{ id: 'outro' }] })
    expect((await POST(post({ numeroTermo: 'X' }), contexto)).status).toBe(403)
    expect(prisma.contrato.create).not.toHaveBeenCalled()
  })

  it('404 quando o cliente não existe', async () => {
    ;(prisma.cliente.findUnique as jest.Mock).mockResolvedValue(null)
    expect((await POST(post({ numeroTermo: 'X' }), contexto)).status).toBe(404)
  })

  it('400 sem nº do termo, com rótulo em português', async () => {
    const resposta = await POST(post({ descricao: 'x' }), contexto)
    expect(resposta.status).toBe(400)
    await expect(resposta.json()).resolves.toEqual({ error: 'Nº do termo: campo obrigatório' })
  })

  it('400 com vencimento inválido', async () => {
    expect((await POST(post({ numeroTermo: 'X', dataVencimento: '2026-13-01' }), contexto)).status).toBe(400)
  })

  it('cria o contrato no cliente da URL', async () => {
    ;(prisma.contrato.create as jest.Mock).mockImplementation(({ data }) => ({ id: 'k9', dataVencimento: null, ...data }))
    const resposta = await POST(
      post({ numeroTermo: ' TC 010/2026 ', descricao: 'Wi-fi', dataVencimento: '2027-01-31', vigente: true, clienteId: 'outro' }),
      contexto
    )
    expect(resposta.status).toBe(201)
    expect(prisma.contrato.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          clienteId: 'c1',
          numeroTermo: 'TC 010/2026',
          descricao: 'Wi-fi',
          dataVencimento: new Date('2027-01-31T00:00:00Z'),
          vigente: true,
        },
      })
    )
    await expect(resposta.json()).resolves.toEqual(
      expect.objectContaining({ id: 'k9', saldo: SEM_SALDO, vencimento: expect.objectContaining({ nivel: expect.any(String) }) })
    )
  })
})
