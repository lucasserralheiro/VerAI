/** @jest-environment node */
import { NextRequest } from 'next/server'

jest.mock('@/lib/assistente/indexacao/sincronizar', () => ({ sincronizarIndice: jest.fn() }))
import { sincronizarIndice } from '@/lib/assistente/indexacao/sincronizar'
import { GET } from './route'

const req = (auth?: string) =>
  new NextRequest('http://localhost/api/assistente/indexar/cron', { headers: auth ? { authorization: auth } : {} })

beforeEach(() => {
  jest.clearAllMocks()
  process.env.CRON_SECRET = 'segredo'
  ;(sincronizarIndice as jest.Mock).mockResolvedValue({ ok: 1, sem_texto: 0, erro: 0, removidos: 0, restantes: 0 })
})

it('401 sem o segredo certo', async () => {
  expect((await GET(req('Bearer errado'))).status).toBe(401)
  expect((await GET(req())).status).toBe(401)
})

it('401 quando CRON_SECRET não está configurado', async () => {
  delete process.env.CRON_SECRET
  expect((await GET(req('Bearer undefined'))).status).toBe(401)
})

it('sincroniza com o segredo certo', async () => {
  const resposta = await GET(req('Bearer segredo'))
  expect(resposta.status).toBe(200)
  expect(sincronizarIndice).toHaveBeenCalledWith({ conferirVersao: true, limite: 30 })
})
