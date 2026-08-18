/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'

jest.mock('./prisma', () => ({
  prisma: {
    usuario: {
      findUnique: jest.fn(),
    },
  },
}))

import { prisma } from './prisma'
import {
  hashSenha,
  verificarSenha,
  criarSessao,
  verificarSessao,
  getAuthUser,
  AUTH_COOKIE_NAME,
} from './auth'

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-value-not-for-prod'
})

describe('hashSenha / verificarSenha', () => {
  it('gera um hash que verifica corretamente contra a senha original', async () => {
    const hash = await hashSenha('minhaSenha123')
    expect(hash).not.toBe('minhaSenha123')
    await expect(verificarSenha('minhaSenha123', hash)).resolves.toBe(true)
  })

  it('rejeita uma senha incorreta', async () => {
    const hash = await hashSenha('minhaSenha123')
    await expect(verificarSenha('senhaErrada', hash)).resolves.toBe(false)
  })
})

describe('criarSessao / verificarSessao', () => {
  it('cria um token que verifica de volta pro mesmo payload', async () => {
    const token = await criarSessao({ id: 'user-1', role: 'admin' })
    const payload = await verificarSessao(token)
    expect(payload).toEqual({ id: 'user-1', role: 'admin' })
  })

  it('retorna null para um token inválido', async () => {
    const payload = await verificarSessao('token-invalido')
    expect(payload).toBeNull()
  })
})

describe('getAuthUser', () => {
  it('retorna null quando não há cookie de sessão', async () => {
    const request = new NextRequest('http://localhost/api/qualquer')
    await expect(getAuthUser(request)).resolves.toBeNull()
  })

  it('retorna o usuário quando o cookie tem uma sessão válida', async () => {
    const token = await criarSessao({ id: 'user-1', role: 'admin' })
    ;(prisma.usuario.findUnique as jest.Mock).mockResolvedValue({
      id: 'user-1',
      nome: 'Admin',
      email: 'admin@verai.local',
      role: 'admin',
    })

    const request = new NextRequest('http://localhost/api/qualquer', {
      headers: { cookie: `${AUTH_COOKIE_NAME}=${token}` },
    })

    await expect(getAuthUser(request)).resolves.toEqual({
      id: 'user-1',
      nome: 'Admin',
      email: 'admin@verai.local',
      role: 'admin',
    })
  })
})
