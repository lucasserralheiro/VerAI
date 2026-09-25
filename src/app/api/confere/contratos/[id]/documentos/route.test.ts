/** @jest-environment node */
import { NextRequest } from 'next/server'

jest.mock('@/lib/auth', () => ({ ...jest.requireActual('@/lib/auth'), getAuthUser: jest.fn() }))
jest.mock('@/lib/confere/cadastro', () => ({
  documentosDoContrato: jest.fn(),
  competenciaAtual: jest.fn(() => ({ ano: 2026, mes: 9 })),
}))

import { getAuthUser } from '@/lib/auth'
import { documentosDoContrato } from '@/lib/confere/cadastro'
import { GET } from './route'

const admin = { id: 'u1', nome: 'Admin', email: 'a@x', role: 'admin' as const }
const contexto = { params: Promise.resolve({ id: 'ct-1' }) }
const url = (consulta = '') => new NextRequest(`http://localhost/api/confere/contratos/ct-1/documentos${consulta}`)

beforeEach(() => {
  jest.clearAllMocks()
  ;(getAuthUser as jest.Mock).mockResolvedValue(admin)
})

it('401 sem usuário', async () => {
  ;(getAuthUser as jest.Mock).mockResolvedValue(null)
  expect((await GET(url('?competencia=2026-07'), contexto)).status).toBe(401)
})

it('competência da planilha', async () => {
  ;(documentosDoContrato as jest.Mock).mockResolvedValue({ base: null })
  const r = await GET(url('?competencia=2026-07'), contexto)
  expect(r.status).toBe(200)
  expect(documentosDoContrato).toHaveBeenCalledWith(admin, 'ct-1', { ano: 2026, mes: 7 }, true)
})

it('sem competência (ou inválida): o mês atual, marcado como não lido', async () => {
  ;(documentosDoContrato as jest.Mock).mockResolvedValue({ base: null })
  await GET(url('?competencia=2026-13'), contexto)
  expect(documentosDoContrato).toHaveBeenCalledWith(admin, 'ct-1', { ano: 2026, mes: 9 }, false)
})

it('404 quando o contrato não existe ou não é visível', async () => {
  ;(documentosDoContrato as jest.Mock).mockResolvedValue(null)
  expect((await GET(url(), contexto)).status).toBe(404)
})
