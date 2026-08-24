/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'

jest.mock('@/lib/prisma', () => ({
  prisma: { usuario: { findUnique: jest.fn() } },
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
import { devAuthEnabled, IMPERSONATOR_COOKIE_NAME } from '@/lib/dev-auth'
import { POST } from './route'

function buildRequest(cookie?: string) {
  return new NextRequest('http://localhost/api/dev-auth/restore', {
    method: 'POST',
    headers: cookie ? { cookie } : undefined,
  })
}

describe('POST /api/dev-auth/restore', () => {
  it('retorna 403 quando o modo dev está desligado', async () => {
    ;(devAuthEnabled as jest.Mock).mockReturnValue(false)
    const response = await POST(buildRequest(`${IMPERSONATOR_COOKIE_NAME}=admin-1`))
    expect(response.status).toBe(403)
  })

  it('retorna 403 quando não há simulação ativa', async () => {
    ;(devAuthEnabled as jest.Mock).mockReturnValue(true)
    const response = await POST(buildRequest())
    expect(response.status).toBe(403)
  })

  it('retorna 404 quando o admin original não existe mais', async () => {
    ;(devAuthEnabled as jest.Mock).mockReturnValue(true)
    ;(prisma.usuario.findUnique as jest.Mock).mockResolvedValue(null)
    const response = await POST(buildRequest(`${IMPERSONATOR_COOKIE_NAME}=admin-1`))
    expect(response.status).toBe(404)
  })

  it('restaura a sessão do admin e apaga o cookie de impersonação', async () => {
    ;(devAuthEnabled as jest.Mock).mockReturnValue(true)
    ;(prisma.usuario.findUnique as jest.Mock).mockResolvedValue({
      id: 'admin-1',
      nome: 'Administrador',
      email: 'admin',
      role: 'admin',
    })
    ;(criarSessao as jest.Mock).mockResolvedValue('token-do-admin')

    const response = await POST(buildRequest(`${IMPERSONATOR_COOKIE_NAME}=admin-1`))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      id: 'admin-1',
      nome: 'Administrador',
      email: 'admin',
      role: 'admin',
    })
    expect(response.cookies.get(AUTH_COOKIE_NAME)?.value).toBe('token-do-admin')
    expect(response.cookies.get(IMPERSONATOR_COOKIE_NAME)?.value).toBe('')
  })
})
