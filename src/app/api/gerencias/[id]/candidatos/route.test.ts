/** @jest-environment node */
import { NextRequest } from 'next/server'

jest.mock('@/lib/auth', () => ({ ...jest.requireActual('@/lib/auth'), getAuthUser: jest.fn() }))
jest.mock('@/lib/gerencias/servico', () => ({ candidatosDaEquipe: jest.fn(), vinculosDoUsuario: jest.fn() }))

import { getAuthUser } from '@/lib/auth'
import { candidatosDaEquipe, vinculosDoUsuario } from '@/lib/gerencias/servico'
import { GET } from './route'

const req = () => new NextRequest('http://localhost/api/gerencias/g1/candidatos')
const ctx = { params: Promise.resolve({ id: 'g1' }) }

beforeEach(() => jest.clearAllMocks())

describe('GET /api/gerencias/[id]/candidatos', () => {
  it('401 sem login', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(null)
    expect((await GET(req(), ctx)).status).toBe(401)
  })

  it('403 para usuário da gerência', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue({ id: 'u2', role: 'responsavel' })
    ;(vinculosDoUsuario as jest.Mock).mockResolvedValue([{ gerenciaId: 'g1', papel: 'usuario', nome: 'GSI' }])
    expect((await GET(req(), ctx)).status).toBe(403)
  })

  it('manager recebe a lista', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue({ id: 'u2', role: 'responsavel' })
    ;(vinculosDoUsuario as jest.Mock).mockResolvedValue([{ gerenciaId: 'g1', papel: 'manager', nome: 'GSI' }])
    ;(candidatosDaEquipe as jest.Mock).mockResolvedValue([{ id: 'u3', nome: 'Ana', email: 'a@x' }])
    const r = await GET(req(), ctx)
    expect(r.status).toBe(200)
    await expect(r.json()).resolves.toEqual([{ id: 'u3', nome: 'Ana', email: 'a@x' }])
    expect(candidatosDaEquipe).toHaveBeenCalledWith('g1')
  })

  it('admin recebe a lista sem consultar vínculos', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue({ id: 'u1', role: 'admin' })
    ;(candidatosDaEquipe as jest.Mock).mockResolvedValue([])
    expect((await GET(req(), ctx)).status).toBe(200)
    expect(vinculosDoUsuario).not.toHaveBeenCalled()
  })
})
