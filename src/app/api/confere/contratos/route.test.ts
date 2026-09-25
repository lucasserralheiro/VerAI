/** @jest-environment node */
import { NextRequest } from 'next/server'

jest.mock('@/lib/auth', () => ({ ...jest.requireActual('@/lib/auth'), getAuthUser: jest.fn() }))
jest.mock('@/lib/confere/cadastro', () => ({ buscarContratos: jest.fn() }))

import { getAuthUser } from '@/lib/auth'
import { buscarContratos } from '@/lib/confere/cadastro'
import { GET } from './route'

const admin = { id: 'u1', nome: 'Admin', email: 'a@x', role: 'admin' as const }

beforeEach(() => {
  jest.clearAllMocks()
  ;(getAuthUser as jest.Mock).mockResolvedValue(admin)
})

it('401 sem usuário', async () => {
  ;(getAuthUser as jest.Mock).mockResolvedValue(null)
  expect((await GET(new NextRequest('http://localhost/api/confere/contratos?busca=cgm'))).status).toBe(401)
})

it('repassa o texto da busca', async () => {
  ;(buscarContratos as jest.Mock).mockResolvedValue([{ id: 'ct-1' }])
  const r = await GET(new NextRequest('http://localhost/api/confere/contratos?busca=16%20cgm'))
  expect(await r.json()).toEqual([{ id: 'ct-1' }])
  expect(buscarContratos).toHaveBeenCalledWith(admin, '16 cgm')
})
