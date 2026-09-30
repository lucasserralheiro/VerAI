/** @jest-environment node */
import { NextRequest } from 'next/server'

jest.mock('@/lib/auth', () => ({ getAuthUser: jest.fn() }))
jest.mock('@/lib/visibilidade', () => ({ clienteIdsPermitidos: jest.fn() }))
jest.mock('@/lib/links-mpls/consultas', () => ({ listarLinks: jest.fn() }))

import { getAuthUser } from '@/lib/auth'
import { clienteIdsPermitidos } from '@/lib/visibilidade'
import { listarLinks } from '@/lib/links-mpls/consultas'
import { GET } from './route'

it('401 sem usuário', async () => {
  ;(getAuthUser as jest.Mock).mockResolvedValue(null)
  expect((await GET(new NextRequest('http://localhost/api/links-mpls'))).status).toBe(401)
})

it('lista só os clientes que o usuário vê, na competência pedida', async () => {
  ;(getAuthUser as jest.Mock).mockResolvedValue({ id: 'u1', role: 'responsavel' })
  ;(clienteIdsPermitidos as jest.Mock).mockResolvedValue(['c1'])
  ;(listarLinks as jest.Mock).mockResolvedValue({ competencias: ['2026-09'], competencia: '2026-09', relatorios: [] })
  const r = await GET(new NextRequest('http://localhost/api/links-mpls?competencia=2026-09'))
  expect(r.status).toBe(200)
  expect(listarLinks).toHaveBeenCalledWith({ competencia: '2026-09', clienteIds: ['c1'] })
})
