/** @jest-environment node */
import { NextRequest } from 'next/server'

jest.mock('@/lib/auth', () => ({ ...jest.requireActual('@/lib/auth'), getAuthUser: jest.fn() }))
jest.mock('@/lib/visibilidade', () => ({ clienteIdsPermitidos: jest.fn() }))
jest.mock('@/lib/controles-contratos/consultas', () => ({ listarControles: jest.fn(async () => ({ meses: [], mes: null, controles: [] })) }))

import { getAuthUser } from '@/lib/auth'
import { clienteIdsPermitidos } from '@/lib/visibilidade'
import { listarControles } from '@/lib/controles-contratos/consultas'
import { GET } from './route'

it('401 sem usuário', async () => {
  ;(getAuthUser as jest.Mock).mockResolvedValue(null)
  expect((await GET(new NextRequest('http://localhost/api/controle-faturamento'))).status).toBe(401)
})

it('filtra pelos clientes do usuário e pelo mês pedido', async () => {
  ;(getAuthUser as jest.Mock).mockResolvedValue({ id: 'u', role: 'uploader' })
  ;(clienteIdsPermitidos as jest.Mock).mockResolvedValue(['c1'])
  await GET(new NextRequest('http://localhost/api/controle-faturamento?mes=2026-07'))
  expect(listarControles).toHaveBeenCalledWith({ mes: '2026-07', clienteIds: ['c1'] })
})

it('admin vê todos (clienteIds null)', async () => {
  ;(getAuthUser as jest.Mock).mockResolvedValue({ id: 'u', role: 'admin' })
  ;(clienteIdsPermitidos as jest.Mock).mockResolvedValue(null)
  await GET(new NextRequest('http://localhost/api/controle-faturamento'))
  expect(listarControles).toHaveBeenLastCalledWith({ mes: undefined, clienteIds: null })
})
