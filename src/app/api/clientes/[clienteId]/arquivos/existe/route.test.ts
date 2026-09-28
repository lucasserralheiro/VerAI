/** @jest-environment node */
import { NextRequest } from 'next/server'

jest.mock('@/lib/auth', () => ({ ...jest.requireActual('@/lib/auth'), getAuthUser: jest.fn() }))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    arquivoCliente: { findFirst: jest.fn() },
    documento: { findMany: jest.fn() },
    historicoContrato: { findMany: jest.fn(async () => []) },
    arquivoSharepoint: { findMany: jest.fn(async () => []) },
    propostaComercialArquivo: { findMany: jest.fn(async () => []) },
    usuario: { findUnique: jest.fn() },
  },
}))

import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { GET } from './route'

const hash = 'a'.repeat(64)
const get = (query: string, clienteId = 'c1') =>
  GET(new NextRequest(`http://localhost/api/clientes/${clienteId}/arquivos/existe${query}`), {
    params: Promise.resolve({ clienteId }),
  })

beforeEach(() => {
  jest.clearAllMocks()
  ;(getAuthUser as jest.Mock).mockResolvedValue({ id: 'u1', role: 'admin' })
  ;(prisma.arquivoCliente.findFirst as jest.Mock).mockResolvedValue(null)
  ;(prisma.documento.findMany as jest.Mock).mockResolvedValue([])
})

describe('GET /api/clientes/[clienteId]/arquivos/existe', () => {
  it('401 sem usuário', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(null)
    expect((await get(`?sha256=${hash}`)).status).toBe(401)
  })

  it.each(['', '?sha256=abc', `?sha256=${'g'.repeat(64)}`])('400 com hash inválido (%s)', async (query) => {
    expect((await get(query)).status).toBe(400)
  })

  it('null quando o cliente não tem o conteúdo', async () => {
    await expect((await get(`?sha256=${hash.toUpperCase()}`)).json()).resolves.toEqual({ arquivo: null })
    expect(prisma.arquivoCliente.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { clienteId: 'c1', sha256: hash, removidoEm: null } })
    )
  })

  it('devolve o existente com usos', async () => {
    ;(prisma.arquivoCliente.findFirst as jest.Mock).mockResolvedValue({ id: 'a1', nome: 'PC 01.pdf' })
    await expect((await get(`?sha256=${hash}`)).json()).resolves.toEqual({ arquivo: { id: 'a1', nome: 'PC 01.pdf', usos: [] } })
  })
})
