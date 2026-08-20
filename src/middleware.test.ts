/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'

jest.mock('@/lib/auth', () => ({
  ...jest.requireActual('@/lib/auth'),
  verificarSessao: jest.fn(),
}))

import { verificarSessao, AUTH_COOKIE_NAME } from '@/lib/auth'
import { middleware } from './middleware'

function buildRequest(pathname: string, cookie?: string) {
  return new NextRequest(new URL(pathname, 'http://localhost'), {
    headers: cookie ? { cookie } : undefined,
  })
}

describe('middleware', () => {
  it('deixa passar /login sem sessão', async () => {
    const response = await middleware(buildRequest('/login'))
    expect(response.status).toBe(200)
  })

  it('redireciona pra /login quando não há sessão em rota protegida', async () => {
    const response = await middleware(buildRequest('/'))
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('http://localhost/login')
  })

  it('retorna 401 em rota de api protegida sem sessão', async () => {
    const response = await middleware(buildRequest('/api/documentos'))
    expect(response.status).toBe(401)
  })

  it('libera rota normal para usuário autenticado não-admin', async () => {
    ;(verificarSessao as jest.Mock).mockResolvedValue({ id: 'user-1', role: 'uploader' })
    const response = await middleware(buildRequest('/', `${AUTH_COOKIE_NAME}=token`))
    expect(response.status).toBe(200)
  })

  it('bloqueia rota /admin pra quem não é admin', async () => {
    ;(verificarSessao as jest.Mock).mockResolvedValue({ id: 'user-1', role: 'uploader' })
    const response = await middleware(buildRequest('/admin/usuarios', `${AUTH_COOKIE_NAME}=token`))
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('http://localhost/clientes')
  })

  it('libera rota /api/admin pra admin', async () => {
    ;(verificarSessao as jest.Mock).mockResolvedValue({ id: 'user-1', role: 'admin' })
    const response = await middleware(buildRequest('/api/admin/usuarios', `${AUTH_COOKIE_NAME}=token`))
    expect(response.status).toBe(200)
  })
})
