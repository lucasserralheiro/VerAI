/** @jest-environment node */
import { NextRequest } from 'next/server'

jest.mock('@/lib/auth', () => ({ ...jest.requireActual('@/lib/auth'), getAuthUser: jest.fn() }))
jest.mock('@/lib/prisma', () => ({ prisma: { usuario: { findUnique: jest.fn() } } }))
jest.mock('@/lib/confere/pastas', () => ({ pastasDoCliente: jest.fn() }))

import { getAuthUser } from '@/lib/auth'
import { pastasDoCliente } from '@/lib/confere/pastas'
import { prisma } from '@/lib/prisma'
import { GET } from './route'

const admin = { id: 'u1', nome: 'Admin', email: 'a@x', role: 'admin' as const }
const comum = { id: 'u2', nome: 'Comum', email: 'c@x', role: 'responsavel' as const }
const contexto = { params: Promise.resolve({ clienteId: 'cl-1' }) }
const pedido = () => new NextRequest('http://localhost/api/confere/clientes/cl-1/pastas')

beforeEach(() => {
  jest.clearAllMocks()
  ;(getAuthUser as jest.Mock).mockResolvedValue(admin)
})

it('401 sem usuário', async () => {
  ;(getAuthUser as jest.Mock).mockResolvedValue(null)
  expect((await GET(pedido(), contexto)).status).toBe(401)
})

it('200 para usuário logado sem vínculo com o cliente (leitura liberada)', async () => {
  ;(getAuthUser as jest.Mock).mockResolvedValue(comum)
  ;(prisma.usuario.findUnique as jest.Mock).mockResolvedValue({ clientesPermitidos: [] })
  const pastas = { cliente: { id: 'cl-1', nome: 'C', sigla: 'C' }, arquivos: [] }
  ;(pastasDoCliente as jest.Mock).mockResolvedValue(pastas)
  const resposta = await GET(pedido(), contexto)
  expect(resposta.status).toBe(200)
  expect(await resposta.json()).toEqual(pastas)
})

it('404 cliente inexistente', async () => {
  ;(pastasDoCliente as jest.Mock).mockResolvedValue(null)
  expect((await GET(pedido(), contexto)).status).toBe(404)
})

it('devolve as pastas do cliente', async () => {
  const pastas = { cliente: { id: 'cl-1', nome: 'C', sigla: 'C' }, arquivos: [] }
  ;(pastasDoCliente as jest.Mock).mockResolvedValue(pastas)
  const resposta = await GET(pedido(), contexto)
  expect(await resposta.json()).toEqual(pastas)
  expect(pastasDoCliente).toHaveBeenCalledWith('cl-1')
})
