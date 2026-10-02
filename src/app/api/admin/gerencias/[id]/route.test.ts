/** @jest-environment node */
import { NextRequest } from 'next/server'

jest.mock('@/lib/auth', () => ({ ...jest.requireActual('@/lib/auth'), getAuthUser: jest.fn() }))
jest.mock('@/lib/gerencias/servico', () => ({ atualizarGerencia: jest.fn() }))

import { getAuthUser } from '@/lib/auth'
import { atualizarGerencia } from '@/lib/gerencias/servico'
import { ErroGerencia } from '@/lib/gerencias/tipos'
import { PATCH } from './route'

const admin = { id: 'u1', nome: 'Admin', email: 'a@x', role: 'admin' }
const comum = { id: 'u2', nome: 'Comum', email: 'c@x', role: 'responsavel' }
const patch = (corpo: unknown) =>
  new NextRequest('http://localhost/api/admin/gerencias/g1', { method: 'PATCH', body: JSON.stringify(corpo) })
const ctx = { params: Promise.resolve({ id: 'g1' }) }

beforeEach(() => jest.clearAllMocks())

describe('PATCH /api/admin/gerencias/[id]', () => {
  it('403 para não admin', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(comum)
    expect((await PATCH(patch({ nome: 'X' }), ctx)).status).toBe(403)
  })

  it('repassa só o que veio', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(admin)
    const r = await PATCH(patch({ ativa: false }), ctx)
    expect(r.status).toBe(200)
    expect(atualizarGerencia).toHaveBeenCalledWith('g1', { ativa: false })
  })

  it('renomeia', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(admin)
    await PATCH(patch({ nome: 'Novo', sigla: 'N' }), ctx)
    expect(atualizarGerencia).toHaveBeenCalledWith('g1', { nome: 'Novo', sigla: 'N' })
  })

  it('ErroGerencia vira { error } com o status dela', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(admin)
    ;(atualizarGerencia as jest.Mock).mockRejectedValue(new ErroGerencia('Tire os 3 clientes.', 409))
    const r = await PATCH(patch({ ativa: false }), ctx)
    expect(r.status).toBe(409)
    await expect(r.json()).resolves.toEqual({ error: 'Tire os 3 clientes.' })
  })
})
