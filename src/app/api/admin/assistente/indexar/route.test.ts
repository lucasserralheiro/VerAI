/** @jest-environment node */
import { NextRequest } from 'next/server'

jest.mock('@/lib/auth', () => ({ ...jest.requireActual('@/lib/auth'), getAuthUser: jest.fn() }))
jest.mock('@/lib/prisma', () => ({ prisma: { indiceDocumento: { groupBy: jest.fn() } } }))
jest.mock('@/lib/assistente/indexacao/sincronizar', () => ({ sincronizarIndice: jest.fn() }))

import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sincronizarIndice } from '@/lib/assistente/indexacao/sincronizar'
import { GET, POST } from './route'

const req = () => new NextRequest('http://localhost/api/admin/assistente/indexar', { method: 'POST' })

beforeEach(() => {
  jest.clearAllMocks()
  ;(getAuthUser as jest.Mock).mockResolvedValue({ id: 'u1', nome: 'A', email: 'a@x', role: 'admin' })
  ;(prisma.indiceDocumento.groupBy as jest.Mock).mockResolvedValue([{ status: 'ok', _count: { _all: 3 } }])
  ;(sincronizarIndice as jest.Mock).mockResolvedValue({ ok: 2, sem_texto: 0, erro: 0, removidos: 0, restantes: 5 })
})

it('403 para quem não é admin', async () => {
  ;(getAuthUser as jest.Mock).mockResolvedValue({ id: 'u2', nome: 'B', email: 'b@x', role: 'responsavel' })
  expect((await POST(req())).status).toBe(403)
})

it('POST sincroniza um lote conferindo versão e devolve contagem por status', async () => {
  const resposta = await POST(req())
  expect(sincronizarIndice).toHaveBeenCalledWith({ conferirVersao: true, limite: 20 })
  expect(await resposta.json()).toEqual({ ok: 2, sem_texto: 0, erro: 0, removidos: 0, restantes: 5, porStatus: { ok: 3 } })
})

it('GET só lê a contagem', async () => {
  expect(await (await GET(req())).json()).toEqual({ porStatus: { ok: 3 } })
  expect(sincronizarIndice).not.toHaveBeenCalled()
})
