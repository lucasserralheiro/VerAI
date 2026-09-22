/** @jest-environment node */
import { NextRequest } from 'next/server'

jest.mock('@/lib/auth', () => ({
  ...jest.requireActual('@/lib/auth'),
  getAuthUser: jest.fn(),
}))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    cliente: { findUnique: jest.fn() },
    responsavelCliente: { findMany: jest.fn(), create: jest.fn() },
    usuario: { findUnique: jest.fn() },
  },
}))

import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { GET, POST } from './route'

const admin = { id: 'u1', nome: 'Admin', email: 'a@x', role: 'admin' as const }
const comum = { id: 'u2', nome: 'Comum', email: 'c@x', role: 'responsavel' as const }
const contexto = { params: Promise.resolve({ clienteId: 'c1' }) }
const url = 'http://localhost/api/clientes/c1/responsaveis'

const post = (corpo: unknown) =>
  new NextRequest(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) })

beforeEach(() => {
  jest.clearAllMocks()
  ;(getAuthUser as jest.Mock).mockResolvedValue(admin)
  ;(prisma.cliente.findUnique as jest.Mock).mockResolvedValue({ id: 'c1' })
})

describe('GET /api/clientes/[clienteId]/responsaveis', () => {
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

  it('lista os responsáveis do cliente ordenados por nome', async () => {
    const lista = [{ id: 'r1', nome: 'Ana', area: 'Sistemas', email: null, telefone: null, celular: null }]
    ;(prisma.responsavelCliente.findMany as jest.Mock).mockResolvedValue(lista)
    const resposta = await GET(new NextRequest(url), contexto)
    expect(resposta.status).toBe(200)
    await expect(resposta.json()).resolves.toEqual(lista)
    expect(prisma.responsavelCliente.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { clienteId: 'c1' }, orderBy: { nome: 'asc' } })
    )
  })
})

describe('POST /api/clientes/[clienteId]/responsaveis', () => {
  it('401 sem usuário', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(null)
    expect((await POST(post({ nome: 'Ana' }), contexto)).status).toBe(401)
  })

  it('403 sem permissão no cliente', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(comum)
    ;(prisma.usuario.findUnique as jest.Mock).mockResolvedValue({ clientesPermitidos: [] })
    expect((await POST(post({ nome: 'Ana' }), contexto)).status).toBe(403)
    expect(prisma.responsavelCliente.create).not.toHaveBeenCalled()
  })

  it('404 quando o cliente não existe', async () => {
    ;(prisma.cliente.findUnique as jest.Mock).mockResolvedValue(null)
    expect((await POST(post({ nome: 'Ana' }), contexto)).status).toBe(404)
    expect(prisma.responsavelCliente.create).not.toHaveBeenCalled()
  })

  it('400 sem nome', async () => {
    const resposta = await POST(post({ nome: '  ' }), contexto)
    expect(resposta.status).toBe(400)
    await expect(resposta.json()).resolves.toEqual({ error: 'nome: campo obrigatório' })
  })

  it('400 com e-mail inválido', async () => {
    const resposta = await POST(post({ nome: 'Ana', email: 'ana-sem-arroba' }), contexto)
    expect(resposta.status).toBe(400)
    await expect(resposta.json()).resolves.toEqual({ error: 'email: e-mail inválido' })
  })

  it('cria o responsável e devolve 201', async () => {
    ;(prisma.responsavelCliente.create as jest.Mock).mockImplementation(({ data }) => ({ id: 'r1', ...data }))
    const resposta = await POST(
      post({ nome: ' Ana ', area: 'Sistemas', email: 'ana@prefeitura.sp.gov.br', telefone: '', celular: '11 9999-0000' }),
      contexto
    )
    expect(resposta.status).toBe(201)
    expect(prisma.responsavelCliente.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          clienteId: 'c1',
          nome: 'Ana',
          area: 'Sistemas',
          email: 'ana@prefeitura.sp.gov.br',
          telefone: null,
          celular: '11 9999-0000',
        },
      })
    )
    await expect(resposta.json()).resolves.toEqual(expect.objectContaining({ id: 'r1', nome: 'Ana' }))
  })
})
