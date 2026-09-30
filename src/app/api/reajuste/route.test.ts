/** @jest-environment node */
import { NextRequest } from 'next/server'
jest.mock('@/lib/auth', () => ({ ...jest.requireActual('@/lib/auth'), getAuthUser: jest.fn() }))
jest.mock('@/lib/r2', () => ({ ...jest.requireActual('@/lib/r2'), getR2: jest.fn(), putR2: jest.fn(), deleteR2: jest.fn() }))
jest.mock('@/lib/reajuste/indice', () => ({ lerIndiceGravado: jest.fn() }))
jest.mock('@/lib/prisma', () => ({ prisma: { reajusteExecucao: { create: jest.fn(), findMany: jest.fn() } } }))
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { deleteR2, getR2, putR2 } from '@/lib/r2'
import { lerIndiceGravado } from '@/lib/reajuste/indice'
import { GET, POST } from './route'

const UUID = '0b8f4a2e-1c3d-4e5f-8a9b-0c1d2e3f4a5b'
const ENDERECO = `r2:tmp-uploads/${UUID}.csv`
const req = (corpo: unknown) => new NextRequest('http://localhost/api/reajuste', { method: 'POST', body: JSON.stringify(corpo) })
// 'sheet1' é o nome que o exceljs dá à aba de um CSV.
const base = {
  endereco: ENDERECO,
  nomeArquivo: 'itens.csv',
  inicial: '2026-07',
  final: '2026-08',
  colunas: [{ aba: 'sheet1', coluna: 2, linhaCabecalho: 1 }],
}

beforeEach(() => {
  jest.clearAllMocks()
  ;(getAuthUser as jest.Mock).mockResolvedValue({ id: 'u1', nome: 'Fulano', role: 'uploader' })
  ;(lerIndiceGravado as jest.Mock).mockResolvedValue({
    meses: [
      { mes: '2026-07', variacao: '-0.03' },
      { mes: '2026-08', variacao: '0.01' },
    ],
    atualizadoEm: null,
  })
  ;(getR2 as jest.Mock).mockImplementation(() => Promise.resolve(new Response('Item;Valor\nA;1.000,00\n')))
  ;(deleteR2 as jest.Mock).mockResolvedValue(undefined)
  ;(prisma.reajusteExecucao.create as jest.Mock).mockImplementation(({ data }) => Promise.resolve(data))
})

it('401 sem login', async () => {
  ;(getAuthUser as jest.Mock).mockResolvedValue(null)
  expect((await POST(req(base))).status).toBe(401)
  expect((await GET(new NextRequest('http://localhost/api/reajuste'))).status).toBe(401)
})

it('400 com mês faltando no índice, período inválido ou nada marcado', async () => {
  expect((await POST(req({ ...base, final: '2026-09' }))).status).toBe(400)
  expect((await POST(req({ ...base, inicial: 'julho' }))).status).toBe(400)
  expect((await POST(req({ ...base, colunas: [] }))).status).toBe(400)
  expect(putR2).not.toHaveBeenCalled()
})

it('gera, grava original e resultado no R2, apaga o temporário e registra o histórico', async () => {
  const r = await POST(req(base))
  expect(r.status).toBe(200)
  const { id } = await r.json()
  expect(putR2).toHaveBeenCalledWith(`reajustes/${id}/original.csv`, expect.any(Buffer), 'text/csv')
  expect(putR2).toHaveBeenCalledWith(`reajustes/${id}/resultado.xlsx`, expect.any(Buffer), expect.stringContaining('spreadsheetml'))
  expect(deleteR2).toHaveBeenCalledWith(`tmp-uploads/${UUID}.csv`)
  expect(prisma.reajusteExecucao.create).toHaveBeenCalledWith({
    data: expect.objectContaining({
      id,
      usuarioId: 'u1',
      nomeArquivo: 'itens.csv',
      tipoArquivo: 'csv',
      fator: '0.99979997',
      acumuladoPct: '-0.02',
      quantidadeValores: 1,
      meses: [
        { mes: '2026-07', variacao: '-0.03' },
        { mes: '2026-08', variacao: '0.01' },
      ],
    }),
  })
})

it('GET lista o histórico com o nome de quem fez', async () => {
  ;(prisma.reajusteExecucao.findMany as jest.Mock).mockResolvedValue([
    {
      id: 'r1',
      nomeArquivo: 'itens.csv',
      tipoArquivo: 'csv',
      mesInicial: new Date('2025-09-01T00:00:00Z'),
      mesFinal: new Date('2026-08-01T00:00:00Z'),
      acumuladoPct: { toString: () => '3.55' },
      fator: { toFixed: () => '1.035543' },
      quantidadeValores: 4,
      usuario: { nome: 'Fulano' },
      createdAt: new Date('2026-09-30T15:00:00Z'),
    },
  ])
  const r = await GET(new NextRequest('http://localhost/api/reajuste'))
  expect(await r.json()).toEqual([
    {
      id: 'r1',
      nomeArquivo: 'itens.csv',
      tipoArquivo: 'csv',
      mesInicial: '2025-09',
      mesFinal: '2026-08',
      acumuladoPct: '3.55',
      fator: '1.035543',
      quantidadeValores: 4,
      usuario: 'Fulano',
      createdAt: '2026-09-30T15:00:00.000Z',
    },
  ])
})
