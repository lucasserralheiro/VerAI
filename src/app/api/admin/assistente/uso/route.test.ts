/** @jest-environment node */
import { NextRequest } from 'next/server'

jest.mock('@/lib/auth', () => ({ ...jest.requireActual('@/lib/auth'), getAuthUser: jest.fn() }))
jest.mock('@/lib/prisma', () => ({ prisma: { $queryRaw: jest.fn() } }))
jest.mock('@/lib/assistente/custo', () => ({ ...jest.requireActual('@/lib/assistente/custo'), precosDoAmbiente: jest.fn() }))

import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { precosDoAmbiente } from '@/lib/assistente/custo'
import { GET } from './route'

const req = () => new NextRequest('http://localhost/api/admin/assistente/uso')
beforeEach(() => {
  jest.clearAllMocks()
  ;(getAuthUser as jest.Mock).mockResolvedValue({ id: 'u', nome: 'A', email: 'a@x', role: 'admin' })
  ;(prisma.$queryRaw as jest.Mock).mockResolvedValue([{ mes: '2026-09', usuario: 'Ana', perguntas: 10, entrada: 1_000_000, cache: 0, saida: 0 }])
})

it('403 para não-admin', async () => {
  ;(getAuthUser as jest.Mock).mockResolvedValue({ id: 'u', nome: 'B', email: 'b@x', role: 'uploader' })
  expect((await GET(req())).status).toBe(403)
})

it('custo null sem preços configurados', async () => {
  ;(precosDoAmbiente as jest.Mock).mockReturnValue(null)
  expect(await (await GET(req())).json()).toEqual({
    precosConfigurados: false,
    linhas: [{ mes: '2026-09', usuario: 'Ana', perguntas: 10, entrada: 1_000_000, cache: 0, saida: 0, custoUsd: null }],
  })
})

it('custo calculado com preços', async () => {
  ;(precosDoAmbiente as jest.Mock).mockReturnValue({ entrada: 0.28, entradaCache: 0.028, saida: 0.42 })
  const { linhas } = await (await GET(req())).json()
  expect(linhas[0].custoUsd).toBeCloseTo(0.28)
})
