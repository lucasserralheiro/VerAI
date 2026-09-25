/** @jest-environment node */
import { NextRequest } from 'next/server'

jest.mock('@/lib/auth', () => ({ ...jest.requireActual('@/lib/auth'), getAuthUser: jest.fn() }))
jest.mock('@/lib/prisma', () => ({ prisma: { $queryRaw: jest.fn() } }))

import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { GET } from './route'

it('401 sem usuário', async () => {
  ;(getAuthUser as jest.Mock).mockResolvedValue(null)
  expect((await GET(new NextRequest('http://localhost/api/confere/execucoes'))).status).toBe(401)
})

it('lista com contrato e competência junto com a execução', async () => {
  ;(getAuthUser as jest.Mock).mockResolvedValue({ id: 'u1', nome: 'A', email: 'a@x', role: 'admin' })
  const linha = {
    id: 'e1',
    nomeContrato: 'PA.pdf',
    nomeLevantamento: 'L.xlsx',
    nomesAditivos: [],
    temResultado: true,
    createdAt: '2026-09-25T12:00:00.000Z',
    contratoId: 'ct-1',
    clienteId: 'cl-1',
    numeroTermo: 'TC 16/CGM/2024',
    competenciaAno: 2026,
    competenciaMes: 8,
  }
  ;(prisma.$queryRaw as jest.Mock).mockResolvedValue([linha])
  const r = await GET(new NextRequest('http://localhost/api/confere/execucoes'))
  expect(await r.json()).toEqual([linha])
  const sql = (prisma.$queryRaw as jest.Mock).mock.calls[0][0].join('?')
  expect(sql).toContain('LEFT JOIN "Contrato"')
  expect(sql).toContain('"competenciaAno"')
})
