/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'

jest.mock('@/lib/prisma', () => ({
  prisma: { usuario: { findMany: jest.fn() } },
}))
jest.mock('@/lib/auth', () => ({
  ...jest.requireActual('@/lib/auth'),
  getAuthUser: jest.fn(),
}))
jest.mock('@/lib/dev-auth', () => ({
  ...jest.requireActual('@/lib/dev-auth'),
  devAuthEnabled: jest.fn(),
}))

import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { devAuthEnabled, IMPERSONATOR_COOKIE_NAME } from '@/lib/dev-auth'
import { GET } from './route'

function buildRequest(cookie?: string) {
  return new NextRequest('http://localhost/api/auth/dev-status', {
    headers: cookie ? { cookie } : undefined,
  })
}

describe('GET /api/auth/dev-status', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('retorna enabled false sem consultar usuário quando o modo dev está desligado', async () => {
    ;(devAuthEnabled as jest.Mock).mockReturnValue(false)
    const response = await GET(buildRequest())
    await expect(response.json()).resolves.toEqual({ enabled: false, impersonating: false, users: [] })
    expect(prisma.usuario.findMany).not.toHaveBeenCalled()
  })

  it('retorna a lista de usuários quando quem pergunta é admin real', async () => {
    ;(devAuthEnabled as jest.Mock).mockReturnValue(true)
    ;(getAuthUser as jest.Mock).mockResolvedValue({ id: 'admin-1', role: 'admin' })
    ;(prisma.usuario.findMany as jest.Mock).mockResolvedValue([
      { id: 'u1', nome: 'Uploader Teste', email: 'up@verai.dev', role: 'uploader' },
    ])

    const response = await GET(buildRequest())

    await expect(response.json()).resolves.toEqual({
      enabled: true,
      impersonating: false,
      users: [{ id: 'u1', nome: 'Uploader Teste', email: 'up@verai.dev', role: 'uploader' }],
    })
  })

  it('não retorna a lista quando quem pergunta não é admin', async () => {
    ;(devAuthEnabled as jest.Mock).mockReturnValue(true)
    ;(getAuthUser as jest.Mock).mockResolvedValue({ id: 'u1', role: 'uploader' })

    const response = await GET(buildRequest())

    await expect(response.json()).resolves.toEqual({ enabled: true, impersonating: false, users: [] })
    expect(prisma.usuario.findMany).not.toHaveBeenCalled()
  })

  it('marca impersonating true e não retorna lista quando há cookie de impersonação', async () => {
    ;(devAuthEnabled as jest.Mock).mockReturnValue(true)
    ;(getAuthUser as jest.Mock).mockResolvedValue({ id: 'u1', role: 'uploader' })

    const response = await GET(buildRequest(`${IMPERSONATOR_COOKIE_NAME}=admin-1`))

    await expect(response.json()).resolves.toEqual({ enabled: true, impersonating: true, users: [] })
    expect(prisma.usuario.findMany).not.toHaveBeenCalled()
  })
})
