/** @jest-environment node */
import { NextRequest } from 'next/server'
jest.mock('@/lib/auth', () => ({ ...jest.requireActual('@/lib/auth'), getAuthUser: jest.fn() }))
jest.mock('@/lib/reajuste/indice', () => ({ lerIndiceGravado: jest.fn(), sincronizarIpcFipe: jest.fn() }))
import { getAuthUser } from '@/lib/auth'
import { lerIndiceGravado, sincronizarIpcFipe } from '@/lib/reajuste/indice'
import { FonteIndiceIndisponivel } from '@/lib/reajuste/serie-bcb'
import { GET, POST } from './route'

const req = (method = 'GET') => new NextRequest('http://localhost/api/reajuste/indice', { method })

beforeEach(() => {
  jest.clearAllMocks()
  ;(getAuthUser as jest.Mock).mockResolvedValue({ id: 'u1', role: 'uploader' })
})

it('401 sem login', async () => {
  ;(getAuthUser as jest.Mock).mockResolvedValue(null)
  expect((await GET(req())).status).toBe(401)
  expect((await POST(req('POST'))).status).toBe(401)
})

it('GET devolve os meses gravados', async () => {
  ;(lerIndiceGravado as jest.Mock).mockResolvedValue({ meses: [{ mes: '2026-08', variacao: '0.01' }], atualizadoEm: null })
  const r = await GET(req())
  expect(await r.json()).toEqual({ meses: [{ mes: '2026-08', variacao: '0.01' }], atualizadoEm: null })
})

it('POST sincroniza; fonte fora vira 502 com a mensagem', async () => {
  ;(sincronizarIpcFipe as jest.Mock).mockResolvedValue({ novos: 2, confirmados: 10, divergentes: [] })
  expect(await (await POST(req('POST'))).json()).toEqual({ novos: 2, confirmados: 10, divergentes: [] })
  ;(sincronizarIpcFipe as jest.Mock).mockRejectedValue(new FonteIndiceIndisponivel('Banco Central respondeu 502'))
  const r = await POST(req('POST'))
  expect(r.status).toBe(502)
  expect(await r.json()).toEqual({ error: 'Banco Central respondeu 502' })
})
