/** @jest-environment node */
import { NextRequest } from 'next/server'

jest.mock('@/lib/auth', () => ({ ...jest.requireActual('@/lib/auth'), getAuthUser: jest.fn() }))
jest.mock('@/lib/gerencias/servico', () => ({ clientesSemGerencia: jest.fn() }))

import { getAuthUser } from '@/lib/auth'
import { clientesSemGerencia } from '@/lib/gerencias/servico'
import { GET } from './route'

const req = () => new NextRequest('http://localhost/api/admin/gerencias/sem-gerencia')

beforeEach(() => jest.clearAllMocks())

describe('GET /api/admin/gerencias/sem-gerencia', () => {
  it('403 para não admin', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue({ id: 'u2', role: 'responsavel' })
    expect((await GET(req())).status).toBe(403)
  })

  it('lista os clientes sem carteira', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue({ id: 'u1', role: 'admin' })
    ;(clientesSemGerencia as jest.Mock).mockResolvedValue([{ id: 'c1', nome: 'A', siglaLegado: null }])
    const r = await GET(req())
    expect(r.status).toBe(200)
    await expect(r.json()).resolves.toEqual([{ id: 'c1', nome: 'A', siglaLegado: null }])
  })
})
