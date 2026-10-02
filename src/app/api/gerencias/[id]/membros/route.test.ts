/** @jest-environment node */
import { NextRequest } from 'next/server'

jest.mock('@/lib/auth', () => ({ ...jest.requireActual('@/lib/auth'), getAuthUser: jest.fn() }))
jest.mock('@/lib/gerencias/servico', () => ({
  gravarMembro: jest.fn(),
  papelNaGerencia: jest.fn(),
  removerMembro: jest.fn(),
  vinculosDoUsuario: jest.fn(),
}))

import { getAuthUser } from '@/lib/auth'
import { gravarMembro, papelNaGerencia, removerMembro, vinculosDoUsuario } from '@/lib/gerencias/servico'
import { DELETE, POST } from './route'

const ctx = { params: Promise.resolve({ id: 'g1' }) }
const post = (corpo: unknown) =>
  new NextRequest('http://localhost/api/gerencias/g1/membros', { method: 'POST', body: JSON.stringify(corpo) })
const del = (q = 'usuarioId=u9') => new NextRequest(`http://localhost/api/gerencias/g1/membros?${q}`, { method: 'DELETE' })
const MOTIVO = 'Só o administrador nomeia ou tira manager.'

const comoManager = () => {
  ;(getAuthUser as jest.Mock).mockResolvedValue({ id: 'u2', role: 'responsavel' })
  ;(vinculosDoUsuario as jest.Mock).mockResolvedValue([{ gerenciaId: 'g1', papel: 'manager', nome: 'GSI' }])
}

beforeEach(() => {
  jest.clearAllMocks()
  ;(papelNaGerencia as jest.Mock).mockResolvedValue(null)
})

describe('POST /api/gerencias/[id]/membros', () => {
  it('manager põe usuario', async () => {
    comoManager()
    const r = await POST(post({ usuarioId: 'u9', papel: 'usuario' }), ctx)
    expect(r.status).toBe(200)
    expect(gravarMembro).toHaveBeenCalledWith('g1', 'u9', 'usuario')
  })

  it('manager não põe manager', async () => {
    comoManager()
    const r = await POST(post({ usuarioId: 'u9', papel: 'manager' }), ctx)
    expect(r.status).toBe(403)
    await expect(r.json()).resolves.toEqual({ error: MOTIVO })
    expect(gravarMembro).not.toHaveBeenCalled()
  })

  it('usuário da gerência não mexe na equipe', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue({ id: 'u2', role: 'responsavel' })
    ;(vinculosDoUsuario as jest.Mock).mockResolvedValue([{ gerenciaId: 'g1', papel: 'usuario', nome: 'GSI' }])
    expect((await POST(post({ usuarioId: 'u9', papel: 'usuario' }), ctx)).status).toBe(403)
  })

  it('admin nomeia manager', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue({ id: 'u1', role: 'admin' })
    expect((await POST(post({ usuarioId: 'u9', papel: 'manager' }), ctx)).status).toBe(200)
  })

  it('400 com papel inválido', async () => {
    comoManager()
    expect((await POST(post({ usuarioId: 'u9', papel: 'chefe' }), ctx)).status).toBe(400)
  })
})

describe('DELETE /api/gerencias/[id]/membros', () => {
  it('manager tira usuario', async () => {
    comoManager()
    ;(papelNaGerencia as jest.Mock).mockResolvedValue('usuario')
    const r = await DELETE(del(), ctx)
    expect(r.status).toBe(200)
    expect(removerMembro).toHaveBeenCalledWith('g1', 'u9')
  })

  it('manager não tira manager', async () => {
    comoManager()
    ;(papelNaGerencia as jest.Mock).mockResolvedValue('manager')
    const r = await DELETE(del(), ctx)
    expect(r.status).toBe(403)
    await expect(r.json()).resolves.toEqual({ error: MOTIVO })
    expect(removerMembro).not.toHaveBeenCalled()
  })

  it('400 sem usuarioId', async () => {
    comoManager()
    expect((await DELETE(del(''), ctx)).status).toBe(400)
  })
})
