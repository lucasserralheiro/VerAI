/** @jest-environment node */
import { NextRequest } from 'next/server'

jest.mock('@/lib/auth', () => ({ ...jest.requireActual('@/lib/auth'), getAuthUser: jest.fn() }))
jest.mock('@/lib/gerencias/servico', () => ({ moverClientes: jest.fn() }))

import { getAuthUser } from '@/lib/auth'
import { moverClientes } from '@/lib/gerencias/servico'
import { ErroGerencia } from '@/lib/gerencias/tipos'
import { POST } from './route'

const admin = { id: 'u1', nome: 'Admin', email: 'a@x', role: 'admin' }
const comum = { id: 'u2', nome: 'Comum', email: 'c@x', role: 'responsavel' }
const post = (corpo: unknown) =>
  new NextRequest('http://localhost/api/admin/gerencias/carteira', { method: 'POST', body: JSON.stringify(corpo) })

beforeEach(() => jest.clearAllMocks())

describe('POST /api/admin/gerencias/carteira', () => {
  it('403 para não admin', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(comum)
    expect((await POST(post({ clienteIds: ['c1'], gerenciaId: 'g1' }))).status).toBe(403)
  })

  it('400 com clienteIds vazio', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(admin)
    expect((await POST(post({ clienteIds: [], gerenciaId: 'g1' }))).status).toBe(400)
  })

  it('repassa porId = usuário logado', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(admin)
    ;(moverClientes as jest.Mock).mockResolvedValue({ movidos: 2 })
    const r = await POST(post({ clienteIds: ['c1', 'c2'], gerenciaId: null }))
    expect(r.status).toBe(200)
    await expect(r.json()).resolves.toEqual({ movidos: 2 })
    expect(moverClientes).toHaveBeenCalledWith(['c1', 'c2'], null, 'u1')
  })

  it('ErroGerencia vira { error } com o status dela', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(admin)
    ;(moverClientes as jest.Mock).mockRejectedValue(new ErroGerencia('Gerência não encontrada.', 404))
    const r = await POST(post({ clienteIds: ['c1'], gerenciaId: 'x' }))
    expect(r.status).toBe(404)
    await expect(r.json()).resolves.toEqual({ error: 'Gerência não encontrada.' })
  })
})
