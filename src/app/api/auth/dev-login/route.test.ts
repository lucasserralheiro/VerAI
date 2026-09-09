/**
 * @jest-environment node
 */
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

describe('POST /api/auth/dev-login', () => {
  it('retorna 401 quando o modo dev está desligado', async () => {
    ;(devAuthEnabled as jest.Mock).mockReturnValue(false)
    const response = await POST()
    expect(response.status).toBe(401)
  })

  it('retorna 500 quando não há usuário admin no banco', async () => {
    ;(devAuthEnabled as jest.Mock).mockReturnValue(true)
    ;(prisma.usuario.findFirst as jest.Mock).mockResolvedValue(null)
    const response = await POST()
    expect(response.status).toBe(500)
  })

  it('retorna 200 com cookie de sessão sem precisar de token', async () => {
    ;(devAuthEnabled as jest.Mock).mockReturnValue(true)
    ;(prisma.usuario.findFirst as jest.Mock).mockResolvedValue({
      id: 'admin-1',
      nome: 'Administrador',
      email: 'admin',
      role: 'admin',
    })
    ;(criarSessao as jest.Mock).mockResolvedValue('token-fake')

    const response = await POST()

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
