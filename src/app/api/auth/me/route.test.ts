/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'

jest.mock('@/lib/auth', () => ({
  ...jest.requireActual('@/lib/auth'),
  getAuthUser: jest.fn(),
}))

import { getAuthUser } from '@/lib/auth'
import { GET } from './route'

describe('GET /api/auth/me', () => {
  it('retorna 401 se não estiver autenticado', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(null)
    const response = await GET(new NextRequest('http://localhost/api/auth/me'))
    expect(response.status).toBe(401)
  })

  it('retorna os dados do usuário autenticado', async () => {
    const usuario = { id: 'user-1', nome: 'Admin', email: 'admin@verai.local', role: 'admin' as const }
    ;(getAuthUser as jest.Mock).mockResolvedValue(usuario)
    const response = await GET(new NextRequest('http://localhost/api/auth/me'))
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual(usuario)
  })
})
