/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'

jest.mock('@/lib/prisma', () => ({
  prisma: { usuario: { findFirst: jest.fn() } },
}))
jest.mock('@/lib/auth', () => ({
  ...jest.requireActual('@/lib/auth'),
  criarSessao: jest.fn(),
}))
jest.mock('@/lib/dev-auth', () => ({
  ...jest.requireActual('@/lib/dev-auth'),
  devAuthEnabled: jest.fn(),
}))

import { prisma } from '@/lib/prisma'
import { criarSessao, AUTH_COOKIE_NAME } from '@/lib/auth'
import { devAuthEnabled } from '@/lib/dev-auth'
import { POST } from './route'

function buildRequest(body: unknown) {
  return new NextRequest('http://localhost/api/auth/dev-login', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

describe('POST /api/auth/dev-login', () => {
  it('retorna 401 quando o modo dev está desligado', async () => {
    ;(devAuthEnabled as jest.Mock).mockReturnValue(false)
    const response = await POST(buildRequest({ token: 'verai_2026' }))
    expect(response.status).toBe(401)
  })

  it('retorna 401 quando o token está errado', async () => {
    ;(devAuthEnabled as jest.Mock).mockReturnValue(true)
    process.env.DEV_AUTH_TOKEN = 'verai_2026'
    const response = await POST(buildRequest({ token: 'errado' }))
    expect(response.status).toBe(401)
  })

  it('retorna 500 quando não há usuário admin no banco', async () => {
    ;(devAuthEnabled as jest.Mock).mockReturnValue(true)
    process.env.DEV_AUTH_TOKEN = 'verai_2026'
    ;(prisma.usuario.findFirst as jest.Mock).mockResolvedValue(null)
    const response = await POST(buildRequest({ token: 'verai_2026' }))
    expect(response.status).toBe(500)
  })

  it('retorna 200 com cookie de sessão quando o token está certo', async () => {
    ;(devAuthEnabled as jest.Mock).mockReturnValue(true)
    process.env.DEV_AUTH_TOKEN = 'verai_2026'
    ;(prisma.usuario.findFirst as jest.Mock).mockResolvedValue({
      id: 'admin-1',
      nome: 'Administrador',
      email: 'admin',
      role: 'admin',
    })
    ;(criarSessao as jest.Mock).mockResolvedValue('token-fake')

    const response = await POST(buildRequest({ token: 'verai_2026' }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      id: 'admin-1',
      nome: 'Administrador',
      email: 'admin',
      role: 'admin',
    })
    expect(response.cookies.get(AUTH_COOKIE_NAME)?.value).toBe('token-fake')
  })
})
