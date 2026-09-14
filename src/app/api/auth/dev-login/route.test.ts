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

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { criarSessao, AUTH_COOKIE_NAME } from '@/lib/auth'
import { devAuthEnabled } from '@/lib/dev-auth'
import { POST } from './route'

function requisicao(body: unknown) {
  return new NextRequest('http://localhost/api/auth/dev-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const ADMIN = { id: 'admin-1', nome: 'Administrador', email: 'admin', role: 'admin' }

describe('POST /api/auth/dev-login', () => {
  const tokenOriginal = process.env.DEV_AUTH_TOKEN

  beforeEach(() => {
    jest.clearAllMocks()
    process.env.DEV_AUTH_TOKEN = 'token-certo'
    ;(devAuthEnabled as jest.Mock).mockReturnValue(true)
    ;(prisma.usuario.findFirst as jest.Mock).mockResolvedValue(ADMIN)
    ;(criarSessao as jest.Mock).mockResolvedValue('sessao-fake')
  })

  afterAll(() => {
    process.env.DEV_AUTH_TOKEN = tokenOriginal
  })

  it('retorna 401 quando o modo dev está desligado', async () => {
    ;(devAuthEnabled as jest.Mock).mockReturnValue(false)
    const response = await POST(requisicao({ token: 'token-certo' }))
    expect(response.status).toBe(401)
  })

  it('retorna 401 sem token', async () => {
    const response = await POST(requisicao({}))
    expect(response.status).toBe(401)
    expect(criarSessao).not.toHaveBeenCalled()
  })

  it('retorna 401 com token errado', async () => {
    const response = await POST(requisicao({ token: 'outro' }))
    expect(response.status).toBe(401)
    expect(criarSessao).not.toHaveBeenCalled()
  })

  it('retorna 401 quando DEV_AUTH_TOKEN não está configurado, mesmo com token vazio', async () => {
    process.env.DEV_AUTH_TOKEN = ''
    const response = await POST(requisicao({ token: '' }))
    expect(response.status).toBe(401)
  })

  it('retorna 500 quando não há usuário admin no banco', async () => {
    ;(prisma.usuario.findFirst as jest.Mock).mockResolvedValue(null)
    const response = await POST(requisicao({ token: 'token-certo' }))
    expect(response.status).toBe(500)
  })

  it('retorna 200 com cookie de sessão quando o token confere', async () => {
    const response = await POST(requisicao({ token: 'token-certo' }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual(ADMIN)
    expect(response.cookies.get(AUTH_COOKIE_NAME)?.value).toBe('sessao-fake')
  })
})
