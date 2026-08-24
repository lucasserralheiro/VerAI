/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'

jest.mock('@/lib/prisma', () => ({
  prisma: { usuario: { findUnique: jest.fn() } },
}))
jest.mock('@/lib/auth', () => ({
  ...jest.requireActual('@/lib/auth'),
  getAuthUser: jest.fn(),
  criarSessao: jest.fn(),
}))
jest.mock('@/lib/dev-auth', () => ({
  ...jest.requireActual('@/lib/dev-auth'),
  devAuthEnabled: jest.fn(),
}))

import { prisma } from '@/lib/prisma'
import { getAuthUser, criarSessao, AUTH_COOKIE_NAME } from '@/lib/auth'
import { devAuthEnabled, IMPERSONATOR_COOKIE_NAME } from '@/lib/dev-auth'
import { POST } from './route'

function buildRequest(body: unknown, cookie?: string) {
  return new NextRequest('http://localhost/api/dev-auth/switch', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
  })
}

describe('POST /api/dev-auth/switch', () => {
  it('retorna 403 quando o modo dev está desligado', async () => {
    ;(devAuthEnabled as jest.Mock).mockReturnValue(false)
    const response = await POST(buildRequest({ userId: 'u1' }))
    expect(response.status).toBe(403)
  })

  it('retorna 403 quando quem chama não é admin', async () => {
    ;(devAuthEnabled as jest.Mock).mockReturnValue(true)
    ;(getAuthUser as jest.Mock).mockResolvedValue({ id: 'u1', role: 'uploader' })
    const response = await POST(buildRequest({ userId: 'u2' }))
    expect(response.status).toBe(403)
  })

  it('retorna 403 quando já existe uma simulação ativa', async () => {
    ;(devAuthEnabled as jest.Mock).mockReturnValue(true)
    ;(getAuthUser as jest.Mock).mockResolvedValue({ id: 'admin-1', role: 'admin' })
    const response = await POST(
      buildRequest({ userId: 'u1' }, `${IMPERSONATOR_COOKIE_NAME}=admin-1`)
    )
    expect(response.status).toBe(403)
  })

  it('retorna 404 quando o usuário alvo não existe', async () => {
    ;(devAuthEnabled as jest.Mock).mockReturnValue(true)
    ;(getAuthUser as jest.Mock).mockResolvedValue({ id: 'admin-1', role: 'admin' })
    ;(prisma.usuario.findUnique as jest.Mock).mockResolvedValue(null)
    const response = await POST(buildRequest({ userId: 'inexistente' }))
    expect(response.status).toBe(404)
  })

  it('troca a sessão e grava o cookie de impersonação quando tudo está certo', async () => {
    ;(devAuthEnabled as jest.Mock).mockReturnValue(true)
    ;(getAuthUser as jest.Mock).mockResolvedValue({ id: 'admin-1', role: 'admin' })
    ;(prisma.usuario.findUnique as jest.Mock).mockResolvedValue({
      id: 'u1',
      nome: 'Uploader Teste',
      email: 'up@verai.dev',
      role: 'uploader',
    })
    ;(criarSessao as jest.Mock).mockResolvedValue('token-do-uploader')

    const response = await POST(buildRequest({ userId: 'u1' }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      id: 'u1',
      nome: 'Uploader Teste',
      email: 'up@verai.dev',
      role: 'uploader',
    })
    expect(response.cookies.get(AUTH_COOKIE_NAME)?.value).toBe('token-do-uploader')
    expect(response.cookies.get(IMPERSONATOR_COOKIE_NAME)?.value).toBe('admin-1')
  })
})
