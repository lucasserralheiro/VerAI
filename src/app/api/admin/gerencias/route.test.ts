/** @jest-environment node */
import { NextRequest } from 'next/server'

jest.mock('@/lib/auth', () => ({ ...jest.requireActual('@/lib/auth'), getAuthUser: jest.fn() }))
jest.mock('@/lib/gerencias/servico', () => ({
  listarGerencias: jest.fn(),
  clientesSemGerencia: jest.fn(),
  criarGerencia: jest.fn(),
}))

import { getAuthUser } from '@/lib/auth'
import { clientesSemGerencia, criarGerencia, listarGerencias } from '@/lib/gerencias/servico'
import { ErroGerencia } from '@/lib/gerencias/tipos'
import { GET, POST } from './route'

const admin = { id: 'u1', nome: 'Admin', email: 'a@x', role: 'admin' }
const comum = { id: 'u2', nome: 'Comum', email: 'c@x', role: 'responsavel' }
const post = (corpo: unknown) =>
  new NextRequest('http://localhost/api/admin/gerencias', { method: 'POST', body: JSON.stringify(corpo) })
const get = () => new NextRequest('http://localhost/api/admin/gerencias')

beforeEach(() => jest.clearAllMocks())

describe('GET /api/admin/gerencias', () => {
  it('403 para não admin', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(comum)
    expect((await GET(get())).status).toBe(403)
  })

  it('lista e conta clientes sem gerência', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(admin)
    ;(listarGerencias as jest.Mock).mockResolvedValue([{ id: 'g1' }])
    ;(clientesSemGerencia as jest.Mock).mockResolvedValue([{ id: 'c1' }, { id: 'c2' }])
    const r = await GET(get())
    expect(r.status).toBe(200)
    await expect(r.json()).resolves.toEqual({ gerencias: [{ id: 'g1' }], semGerencia: 2 })
  })
})

describe('POST /api/admin/gerencias', () => {
  it('403 para não admin', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(comum)
    expect((await POST(post({ nome: 'X' }))).status).toBe(403)
  })

  it('400 sem nome', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(admin)
    const r = await POST(post({ sigla: 'S' }))
    expect(r.status).toBe(400)
    await expect(r.json()).resolves.toEqual({ error: 'Nome: obrigatório' })
  })

  it('cria', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(admin)
    ;(criarGerencia as jest.Mock).mockResolvedValue({ id: 'g1' })
    const r = await POST(post({ nome: 'GSI', sigla: 'GSI' }))
    expect(r.status).toBe(201)
    expect(criarGerencia).toHaveBeenCalledWith({ nome: 'GSI', sigla: 'GSI' })
  })

  it('ErroGerencia vira { error } com o status dela', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(admin)
    ;(criarGerencia as jest.Mock).mockRejectedValue(new ErroGerencia('Já existe.', 409))
    const r = await POST(post({ nome: 'GSI' }))
    expect(r.status).toBe(409)
    await expect(r.json()).resolves.toEqual({ error: 'Já existe.' })
  })
})
