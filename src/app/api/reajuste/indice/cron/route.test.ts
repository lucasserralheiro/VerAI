/** @jest-environment node */
import { NextRequest } from 'next/server'
jest.mock('@/lib/reajuste/indice', () => ({ sincronizarIpcFipe: jest.fn() }))
import { sincronizarIpcFipe } from '@/lib/reajuste/indice'
import { GET } from './route'

const req = (auth?: string) =>
  new NextRequest('http://localhost/api/reajuste/indice/cron', { headers: auth ? { authorization: auth } : {} })

beforeEach(() => {
  jest.clearAllMocks()
  process.env.CRON_SECRET = 'segredo'
  ;(sincronizarIpcFipe as jest.Mock).mockResolvedValue({ novos: 0, confirmados: 13, divergentes: [] })
})

it('401 sem o segredo certo ou sem CRON_SECRET', async () => {
  expect((await GET(req('Bearer errado'))).status).toBe(401)
  delete process.env.CRON_SECRET
  expect((await GET(req('Bearer undefined'))).status).toBe(401)
})

it('sincroniza com o segredo certo', async () => {
  const r = await GET(req('Bearer segredo'))
  expect(r.status).toBe(200)
  expect(sincronizarIpcFipe).toHaveBeenCalled()
})
