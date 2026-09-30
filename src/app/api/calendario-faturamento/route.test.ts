/** @jest-environment node */
import { NextRequest } from 'next/server'

jest.mock('@/lib/auth', () => ({ getAuthUser: jest.fn() }))
jest.mock('@/lib/calendario/consultas', () => ({ calendarioDoAno: jest.fn(async () => ({ anos: [2026], ano: 2026 })), proximosDoFaturamento: jest.fn(async () => []) }))

import { getAuthUser } from '@/lib/auth'
import { calendarioDoAno, proximosDoFaturamento } from '@/lib/calendario/consultas'
import { GET } from './route'
import { GET as GET_PROXIMOS } from './proximos/route'

it('401 sem usuário; qualquer usuário logado vê o calendário do ano pedido', async () => {
  ;(getAuthUser as jest.Mock).mockResolvedValue(null)
  expect((await GET(new NextRequest('http://localhost/api/calendario-faturamento'))).status).toBe(401)
  expect((await GET_PROXIMOS(new NextRequest('http://localhost/api/calendario-faturamento/proximos'))).status).toBe(401)
  ;(getAuthUser as jest.Mock).mockResolvedValue({ id: 'u1', role: 'uploader' })
  expect((await GET(new NextRequest('http://localhost/api/calendario-faturamento?ano=2026'))).status).toBe(200)
  expect(calendarioDoAno).toHaveBeenCalledWith(2026)
})

it('próximos: n entre 1 e 10', async () => {
  ;(getAuthUser as jest.Mock).mockResolvedValue({ id: 'u1', role: 'uploader' })
  await GET_PROXIMOS(new NextRequest('http://localhost/api/calendario-faturamento/proximos?n=50'))
  expect(proximosDoFaturamento).toHaveBeenLastCalledWith(10)
  await GET_PROXIMOS(new NextRequest('http://localhost/api/calendario-faturamento/proximos'))
  expect(proximosDoFaturamento).toHaveBeenLastCalledWith(3)
})
