/** @jest-environment node */
import { NextRequest } from 'next/server'

jest.mock('@/lib/auth', () => ({ ...jest.requireActual('@/lib/auth'), getAuthUser: jest.fn() }))
jest.mock('@/lib/visibilidade', () => ({ podeEditarCliente: jest.fn(), podeVerCliente: jest.fn() }))
jest.mock('@/lib/gerencias/servico', () => ({ gerenciaDoCliente: jest.fn() }))

import { getAuthUser } from '@/lib/auth'
import { podeEditarCliente } from '@/lib/visibilidade'
import { gerenciaDoCliente } from '@/lib/gerencias/servico'
import { GET } from './route'

const req = () => new NextRequest('http://localhost/api/clientes/c1/permissao')
const ctx = { params: Promise.resolve({ clienteId: 'c1' }) }

beforeEach(() => jest.clearAllMocks())

describe('GET /api/clientes/[clienteId]/permissao', () => {
  it('401 sem login', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(null)
    expect((await GET(req(), ctx)).status).toBe(401)
  })

  it('devolve a gerência e se pode editar', async () => {
    const u = { id: 'u2', role: 'responsavel' }
    ;(getAuthUser as jest.Mock).mockResolvedValue(u)
    ;(gerenciaDoCliente as jest.Mock).mockResolvedValue({ id: 'g1', nome: 'GSI' })
    ;(podeEditarCliente as jest.Mock).mockResolvedValue(false)
    const r = await GET(req(), ctx)
    expect(r.status).toBe(200)
    await expect(r.json()).resolves.toEqual({ gerencia: { id: 'g1', nome: 'GSI' }, podeEditar: false })
    expect(podeEditarCliente).toHaveBeenCalledWith(u, 'c1')
  })

  it('cliente sem carteira', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue({ id: 'u1', role: 'admin' })
    ;(gerenciaDoCliente as jest.Mock).mockResolvedValue(null)
    ;(podeEditarCliente as jest.Mock).mockResolvedValue(true)
    await expect((await GET(req(), ctx)).json()).resolves.toEqual({ gerencia: null, podeEditar: true })
  })
})
