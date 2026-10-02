/** @jest-environment node */
import { NextRequest } from 'next/server'

jest.mock('@/lib/auth', () => ({ ...jest.requireActual('@/lib/auth'), getAuthUser: jest.fn() }))
jest.mock('@/lib/gerencias/servico', () => ({ detalheGerencia: jest.fn(), vinculosDoUsuario: jest.fn() }))

import { getAuthUser } from '@/lib/auth'
import { detalheGerencia, vinculosDoUsuario } from '@/lib/gerencias/servico'
import { GET } from './route'

const req = () => new NextRequest('http://localhost/api/gerencias/g1')
const ctx = { params: Promise.resolve({ id: 'g1' }) }
const detalhe = { id: 'g1', nome: 'GSI', membros: [] }

beforeEach(() => jest.clearAllMocks())

describe('GET /api/gerencias/[id]', () => {
  it('401 sem login', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(null)
    expect((await GET(req(), ctx)).status).toBe(401)
  })

  it('manager: gere a equipe, não nomeia manager', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue({ id: 'u2', role: 'responsavel' })
    ;(vinculosDoUsuario as jest.Mock).mockResolvedValue([{ gerenciaId: 'g1', papel: 'manager', nome: 'GSI' }])
    ;(detalheGerencia as jest.Mock).mockResolvedValue(detalhe)
    const r = await GET(req(), ctx)
    expect(r.status).toBe(200)
    await expect(r.json()).resolves.toEqual({ ...detalhe, podeGerirEquipe: true, podeNomearManager: false })
  })

  it('usuário da gerência: só vê', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue({ id: 'u2', role: 'responsavel' })
    ;(vinculosDoUsuario as jest.Mock).mockResolvedValue([{ gerenciaId: 'g1', papel: 'usuario', nome: 'GSI' }])
    ;(detalheGerencia as jest.Mock).mockResolvedValue(detalhe)
    const j = await (await GET(req(), ctx)).json()
    expect(j.podeGerirEquipe).toBe(false)
    expect(j.podeNomearManager).toBe(false)
  })

  it('admin: gere e nomeia', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue({ id: 'u1', role: 'admin' })
    ;(detalheGerencia as jest.Mock).mockResolvedValue(detalhe)
    const j = await (await GET(req(), ctx)).json()
    expect(j.podeGerirEquipe).toBe(true)
    expect(j.podeNomearManager).toBe(true)
  })

  it('403 para quem é de fora', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue({ id: 'u2', role: 'responsavel' })
    ;(vinculosDoUsuario as jest.Mock).mockResolvedValue([{ gerenciaId: 'g9', papel: 'manager', nome: 'Outra' }])
    expect((await GET(req(), ctx)).status).toBe(403)
    expect(detalheGerencia).not.toHaveBeenCalled()
  })

  it('404 se a gerência não existe', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue({ id: 'u1', role: 'admin' })
    ;(detalheGerencia as jest.Mock).mockResolvedValue(null)
    expect((await GET(req(), ctx)).status).toBe(404)
  })
})
