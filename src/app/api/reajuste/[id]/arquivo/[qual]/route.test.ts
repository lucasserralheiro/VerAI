/** @jest-environment node */
import { NextRequest } from 'next/server'
jest.mock('@/lib/auth', () => ({ ...jest.requireActual('@/lib/auth'), getAuthUser: jest.fn() }))
jest.mock('@/lib/r2', () => ({ ...jest.requireActual('@/lib/r2'), getR2: jest.fn() }))
jest.mock('@/lib/prisma', () => ({ prisma: { reajusteExecucao: { findUnique: jest.fn() } } }))
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getR2 } from '@/lib/r2'
import { GET } from './route'

const chamar = (qual: string) => GET(new NextRequest('http://localhost/x'), { params: Promise.resolve({ id: 'r1', qual }) })

beforeEach(() => {
  jest.clearAllMocks()
  ;(getAuthUser as jest.Mock).mockResolvedValue({ id: 'u1', role: 'uploader' })
  ;(prisma.reajusteExecucao.findUnique as jest.Mock).mockResolvedValue({
    id: 'r1',
    nomeArquivo: 'Itens 2026.csv',
    tipoArquivo: 'csv',
    chaveOriginal: 'reajustes/r1/original.csv',
    chaveResultado: 'reajustes/r1/resultado.xlsx',
  })
  ;(getR2 as jest.Mock).mockImplementation(() => Promise.resolve(new Response('conteudo')))
})

it('401, 404 para qual inválido ou execução inexistente', async () => {
  ;(getAuthUser as jest.Mock).mockResolvedValueOnce(null)
  expect((await chamar('resultado')).status).toBe(401)
  expect((await chamar('outro')).status).toBe(404)
  ;(prisma.reajusteExecucao.findUnique as jest.Mock).mockResolvedValueOnce(null)
  expect((await chamar('resultado')).status).toBe(404)
})

it('entrega o resultado com nome derivado do original', async () => {
  const r = await chamar('resultado')
  expect(getR2).toHaveBeenCalledWith('reajustes/r1/resultado.xlsx')
  expect(r.headers.get('content-disposition')).toContain("filename*=UTF-8''Itens%202026%20-%20reajustado.xlsx")
})

it('entrega o original com o tipo dele', async () => {
  const r = await chamar('original')
  expect(getR2).toHaveBeenCalledWith('reajustes/r1/original.csv')
  expect(r.headers.get('content-type')).toBe('text/csv')
})
