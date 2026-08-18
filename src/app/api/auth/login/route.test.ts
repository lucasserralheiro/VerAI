/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'

jest.mock('@/lib/prisma', () => ({
  prisma: { usuario: { findUnique: jest.fn() } },
}))
jest.mock('@/lib/auth', () => ({
  ...jest.requireActual('@/lib/auth'),
  verificarSenha: jest.fn(),
  criarSessao: jest.fn(),
}))

import { prisma } from '@/lib/prisma'
import { verificarSenha, criarSessao, AUTH_COOKIE_NAME } from '@/lib/auth'
import { POST } from './route'

function buildRequest(body: unknown) {
  return new NextRequest('http://localhost/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

describe('POST /api/auth/login', () => {
  it('retorna 400 se faltar email ou senha', async () => {
    const response = await POST(buildRequest({ email: 'a@b.com' }))
    expect(response.status).toBe(400)
  })

  it('retorna 401 se o usuário não existir', async () => {
    ;(prisma.usuario.findUnique as jest.Mock).mockResolvedValue(null)
    const response = await POST(buildRequest({ email: 'a@b.com', senha: 'x' }))
    expect(response.status).toBe(401)
  })

  it('retorna 401 se a senha estiver errada', async () => {
    ;(prisma.usuario.findUnique as jest.Mock).mockResolvedValue({ senhaHash: 'hash' })
    ;(verificarSenha as jest.Mock).mockResolvedValue(false)
    const response = await POST(buildRequest({ email: 'a@b.com', senha: 'errada' }))
    expect(response.status).toBe(401)
  })

  it('retorna 200 com cookie de sessão quando as credenciais são válidas', async () => {
    ;(prisma.usuario.findUnique as jest.Mock).mockResolvedValue({
      id: 'user-1',
      nome: 'Admin',
      email: 'admin@verai.local',
      role: 'admin',
      senhaHash: 'hash',
    })
    ;(verificarSenha as jest.Mock).mockResolvedValue(true)
    ;(criarSessao as jest.Mock).mockResolvedValue('token-fake')

    const response = await POST(buildRequest({ email: 'admin@verai.local', senha: 'admin123' }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      id: 'user-1',
      nome: 'Admin',
      email: 'admin@verai.local',
      role: 'admin',
    })
    expect(response.cookies.get(AUTH_COOKIE_NAME)?.value).toBe('token-fake')
  })
})
