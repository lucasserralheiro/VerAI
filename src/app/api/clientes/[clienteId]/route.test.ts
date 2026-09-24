/** @jest-environment node */
import { NextRequest } from 'next/server'
import { Prisma } from '@prisma/client'

jest.mock('@/lib/auth', () => ({
  ...jest.requireActual('@/lib/auth'),
  getAuthUser: jest.fn(),
}))
jest.mock('@/lib/prisma', () => {
  // Filhos do cliente que o DELETE apaga antes dele, na ordem de dependência (de baixo pra cima).
  const modelosFilhos = [
    'notaFiscal',
    'faturamento',
    'historicoContrato',
    'itemContrato',
    'termoConfirmacao',
    'contrato',
    'tramiteDemanda',
    'demanda',
    'solicitacao',
    'notificacao',
    'acessoDocumento',
    'analise',
    'analiseConsolidada',
    'documento',
    'analiseEvolucao',
    'responsavelCliente',
  ]
  return {
    prisma: {
      cliente: { findUnique: jest.fn(), update: jest.fn(), delete: jest.fn() },
      usuario: { findUnique: jest.fn() },
      $transaction: jest.fn(),
      __modelosFilhos: modelosFilhos,
      ...Object.fromEntries(modelosFilhos.map((modelo) => [modelo, { deleteMany: jest.fn() }])),
    },
  }
})

jest.mock('@/lib/relatorios-clientes/excluir-cliente', () => ({ excluirCliente: jest.fn() }))

import { getAuthUser } from '@/lib/auth'
import { excluirCliente } from '@/lib/relatorios-clientes/excluir-cliente'
import { prisma } from '@/lib/prisma'
import { DELETE, GET, PATCH } from './route'

const admin = { id: 'u1', nome: 'Admin', email: 'a@x', role: 'admin' as const }
const comum = { id: 'u2', nome: 'Comum', email: 'c@x', role: 'responsavel' as const }
const contexto = { params: Promise.resolve({ clienteId: 'c1' }) }
const clienteCompleto = {
  id: 'c1',
  nome: 'Secretaria Municipal da Saúde',
  siglaLegado: 'SMS',
  endereco: 'Rua Dr. Siqueira Campos',
  numero: '176',
  bairro: 'Liberdade',
}

const patch = (corpo: unknown) =>
  new NextRequest('http://localhost/api/clientes/c1', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo),
  })

function erroPrisma(code: string) {
  return new Prisma.PrismaClientKnownRequestError('falhou', { code, clientVersion: 'x' })
}

beforeEach(() => {
  jest.clearAllMocks()
  ;(getAuthUser as jest.Mock).mockResolvedValue(admin)
})

describe('GET /api/clientes/[clienteId]', () => {
  it('401 sem usuário', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(null)
    const resposta = await GET(new NextRequest('http://localhost/api/clientes/c1'), contexto)
    expect(resposta.status).toBe(401)
  })

  it('404 quando o cliente não existe', async () => {
    ;(prisma.cliente.findUnique as jest.Mock).mockResolvedValue(null)
    const resposta = await GET(new NextRequest('http://localhost/api/clientes/c1'), contexto)
    expect(resposta.status).toBe(404)
  })

  it('403 sem permissão no cliente', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(comum)
    ;(prisma.cliente.findUnique as jest.Mock).mockResolvedValue(clienteCompleto)
    ;(prisma.usuario.findUnique as jest.Mock).mockResolvedValue({ clientesPermitidos: [] })
    const resposta = await GET(new NextRequest('http://localhost/api/clientes/c1'), contexto)
    expect(resposta.status).toBe(403)
  })

  it('devolve nome, sigla e endereço', async () => {
    ;(prisma.cliente.findUnique as jest.Mock).mockResolvedValue(clienteCompleto)
    const resposta = await GET(new NextRequest('http://localhost/api/clientes/c1'), contexto)
    expect(resposta.status).toBe(200)
    await expect(resposta.json()).resolves.toEqual(clienteCompleto)
    expect(prisma.cliente.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        select: { id: true, nome: true, siglaLegado: true, endereco: true, numero: true, bairro: true },
      })
    )
  })
})

describe('PATCH /api/clientes/[clienteId]', () => {
  it('401 sem usuário', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(null)
    const resposta = await PATCH(patch({ nome: 'X' }), contexto)
    expect(resposta.status).toBe(401)
  })

  it('403 sem permissão no cliente', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(comum)
    ;(prisma.usuario.findUnique as jest.Mock).mockResolvedValue({ clientesPermitidos: [] })
    const resposta = await PATCH(patch({ nome: 'X' }), contexto)
    expect(resposta.status).toBe(403)
    expect(prisma.cliente.update).not.toHaveBeenCalled()
  })

  it('400 sem nome', async () => {
    const resposta = await PATCH(patch({ nome: '   ', siglaLegado: 'SMS' }), contexto)
    expect(resposta.status).toBe(400)
    await expect(resposta.json()).resolves.toEqual({ error: 'nome: campo obrigatório' })
    expect(prisma.cliente.update).not.toHaveBeenCalled()
  })

  it('404 quando o cliente não existe', async () => {
    ;(prisma.cliente.update as jest.Mock).mockRejectedValue(erroPrisma('P2025'))
    const resposta = await PATCH(patch({ nome: 'X' }), contexto)
    expect(resposta.status).toBe(404)
    await expect(resposta.json()).resolves.toEqual({ error: 'cliente não encontrado' })
  })

  it('409 quando nome ou sigla colide com outro cliente', async () => {
    ;(prisma.cliente.update as jest.Mock).mockRejectedValue(erroPrisma('P2002'))
    const resposta = await PATCH(patch({ nome: 'X', siglaLegado: 'SME' }), contexto)
    expect(resposta.status).toBe(409)
    await expect(resposta.json()).resolves.toEqual({ error: 'já existe cliente com esse nome/sigla' })
  })

  it('atualiza com sigla em maiúsculas e vazio virando null', async () => {
    ;(prisma.cliente.update as jest.Mock).mockImplementation(({ data }) => ({ id: 'c1', ...data }))
    const resposta = await PATCH(
      patch({ nome: ' Secretaria X ', siglaLegado: ' sms ', endereco: 'Rua A', numero: '', bairro: '  ' }),
      contexto
    )
    expect(resposta.status).toBe(200)
    expect(prisma.cliente.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'c1' },
        data: { nome: 'Secretaria X', siglaLegado: 'SMS', endereco: 'Rua A', numero: null, bairro: null },
      })
    )
    await expect(resposta.json()).resolves.toEqual(expect.objectContaining({ nome: 'Secretaria X', siglaLegado: 'SMS' }))
  })
})

describe('DELETE /api/clientes/[clienteId]', () => {
  const requisicao = () => new NextRequest('http://localhost/api/clientes/c1', { method: 'DELETE' })

  it('admin: usa a exclusão única (excluir-cliente.ts)', async () => {
    ;(excluirCliente as jest.Mock).mockResolvedValue(undefined)
    const resposta = await DELETE(requisicao(), contexto)
    expect(resposta.status).toBe(200)
    await expect(resposta.json()).resolves.toEqual({ ok: true })
    expect(excluirCliente).toHaveBeenCalledWith('c1')
  })

  it('403 para quem vê o cliente mas não é admin', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(comum)
    ;(prisma.usuario.findUnique as jest.Mock).mockResolvedValue({ clientesPermitidos: [{ id: 'c1' }] })
    const resposta = await DELETE(requisicao(), contexto)
    expect(resposta.status).toBe(403)
    expect(excluirCliente).not.toHaveBeenCalled()
  })

  it('404 quando o cliente sumiu antes da exclusão', async () => {
    ;(excluirCliente as jest.Mock).mockRejectedValue(erroPrisma('P2025'))
    const resposta = await DELETE(requisicao(), contexto)
    expect(resposta.status).toBe(404)
  })

  it('403 sem permissão no cliente', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(comum)
    ;(prisma.usuario.findUnique as jest.Mock).mockResolvedValue({ clientesPermitidos: [] })
    const resposta = await DELETE(requisicao(), contexto)
    expect(resposta.status).toBe(403)
    expect(excluirCliente).not.toHaveBeenCalled()
  })
})
