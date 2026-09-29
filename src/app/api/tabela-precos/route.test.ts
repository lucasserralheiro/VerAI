/** @jest-environment node */
import { NextRequest } from 'next/server'

jest.mock('@/lib/auth', () => ({ ...jest.requireActual('@/lib/auth'), getAuthUser: jest.fn() }))
jest.mock('@/lib/tabela-precos/consultas', () => ({ carregarTabela: jest.fn(), listarVersoes: jest.fn() }))

import { getAuthUser } from '@/lib/auth'
import { carregarTabela, listarVersoes } from '@/lib/tabela-precos/consultas'
import { GET } from './route'
import { GET as GETdiferencas } from './diferencas/route'
import { GET as GETversoes } from './versoes/route'

const logado = () => (getAuthUser as jest.Mock).mockResolvedValue({ id: 'u1', nome: 'A', email: 'a@x', role: 'uploader' })

beforeEach(() => jest.clearAllMocks())

it('401 sem usuário', async () => {
  ;(getAuthUser as jest.Mock).mockResolvedValue(null)
  expect((await GET(new NextRequest('http://localhost/api/tabela-precos'))).status).toBe(401)
  expect((await GETversoes(new NextRequest('http://localhost/api/tabela-precos/versoes'))).status).toBe(401)
})

it('vigente por padrão; ?versao= escolhe; sem tabela lida devolve tabela null', async () => {
  logado()
  ;(carregarTabela as jest.Mock).mockResolvedValueOnce({ tabela: { versao: '2026 v3.0' }, itens: [{ codigo: '1' }] })
  await expect((await GET(new NextRequest('http://localhost/api/tabela-precos'))).json()).resolves.toEqual({ tabela: { versao: '2026 v3.0' }, itens: [{ codigo: '1' }] })
  expect(carregarTabela).toHaveBeenLastCalledWith(undefined)
  ;(carregarTabela as jest.Mock).mockResolvedValueOnce(null)
  await expect((await GET(new NextRequest('http://localhost/api/tabela-precos?versao=2025%20v1.0'))).json()).resolves.toEqual({ tabela: null, itens: [] })
  expect(carregarTabela).toHaveBeenLastCalledWith('2025 v1.0')
})

it('versões: lista para qualquer usuário logado', async () => {
  logado()
  ;(listarVersoes as jest.Mock).mockResolvedValue([{ versao: '2026 v3.0', publicadaEm: null, totalItens: 315, vigente: true }])
  await expect((await GETversoes(new NextRequest('http://localhost/api/tabela-precos/versoes'))).json()).resolves.toEqual([
    { versao: '2026 v3.0', publicadaEm: null, totalItens: 315, vigente: true },
  ])
})

it('diferenças: 400 sem as duas versões, 404 quando uma não existe', async () => {
  logado()
  expect((await GETdiferencas(new NextRequest('http://localhost/api/tabela-precos/diferencas?de=a'))).status).toBe(400)
  ;(carregarTabela as jest.Mock).mockResolvedValueOnce({ tabela: {}, itens: [] }).mockResolvedValueOnce(null)
  expect((await GETdiferencas(new NextRequest('http://localhost/api/tabela-precos/diferencas?de=a&para=b'))).status).toBe(404)
})
