/** @jest-environment node */
import { NextRequest } from 'next/server'
jest.mock('@/lib/auth', () => ({ ...jest.requireActual('@/lib/auth'), getAuthUser: jest.fn() }))
jest.mock('@/lib/r2', () => ({ ...jest.requireActual('@/lib/r2'), getR2: jest.fn() }))
import { getAuthUser } from '@/lib/auth'
import { getR2 } from '@/lib/r2'
import { POST } from './route'

const UUID = '0b8f4a2e-1c3d-4e5f-8a9b-0c1d2e3f4a5b'
const req = (corpo: unknown) =>
  new NextRequest('http://localhost/api/reajuste/leitura', { method: 'POST', body: JSON.stringify(corpo) })

beforeEach(() => {
  jest.clearAllMocks()
  ;(getAuthUser as jest.Mock).mockResolvedValue({ id: 'u1', nome: 'Fulano', role: 'uploader' })
})

it('401 sem login e 400 com endereço fora do temporário', async () => {
  ;(getAuthUser as jest.Mock).mockResolvedValueOnce(null)
  expect((await POST(req({ endereco: `r2:tmp-uploads/${UUID}.csv` }))).status).toBe(401)
  expect((await POST(req({ endereco: 'r2:propostas-comerciais/x/original.pdf' }))).status).toBe(400)
})

it('lê o CSV do temporário e devolve as colunas', async () => {
  ;(getR2 as jest.Mock).mockResolvedValue(new Response('Item;Valor\nA;1.500,00\n'))
  const r = await POST(req({ endereco: `r2:tmp-uploads/${UUID}.csv` }))
  expect(r.status).toBe(200)
  expect(await r.json()).toEqual({
    tipo: 'planilha',
    colunas: [expect.objectContaining({ cabecalho: 'Valor' })],
    abas: [expect.objectContaining({ linhaCabecalho: 1 })],
  })
})

it('arquivo ilegível vira 422 com a mensagem', async () => {
  ;(getR2 as jest.Mock).mockResolvedValue(new Response('lixo'))
  const r = await POST(req({ endereco: `r2:tmp-uploads/${UUID}.xlsx` }))
  expect(r.status).toBe(422)
  expect((await r.json()).error).toMatch(/não foi possível abrir a planilha/)
})
