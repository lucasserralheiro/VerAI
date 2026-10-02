/** @jest-environment node */
import { NextRequest } from 'next/server'

jest.mock('@/lib/auth', () => ({ ...jest.requireActual('@/lib/auth'), getAuthUser: jest.fn() }))
jest.mock('@/lib/gerencias/servico', () => ({ vinculosDoUsuario: jest.fn() }))

import { getAuthUser } from '@/lib/auth'
import { vinculosDoUsuario } from '@/lib/gerencias/servico'
import { GET } from './route'

const req = () => new NextRequest('http://localhost/api/gerencias/minhas')

beforeEach(() => jest.clearAllMocks())

describe('GET /api/gerencias/minhas', () => {
  it('401 sem login', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(null)
    expect((await GET(req())).status).toBe(401)
  })

  it('devolve os vínculos do usuário logado', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue({ id: 'u2', role: 'responsavel' })
    ;(vinculosDoUsuario as jest.Mock).mockResolvedValue([{ gerenciaId: 'g1', papel: 'manager', nome: 'GSI' }])
    const r = await GET(req())
    expect(r.status).toBe(200)
    await expect(r.json()).resolves.toEqual([{ gerenciaId: 'g1', papel: 'manager', nome: 'GSI' }])
    expect(vinculosDoUsuario).toHaveBeenCalledWith('u2')
  })
})
