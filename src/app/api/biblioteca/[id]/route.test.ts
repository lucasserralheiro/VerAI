/** @jest-environment node */
import { NextRequest } from 'next/server'

jest.mock('@/lib/auth', () => ({ ...jest.requireActual('@/lib/auth'), getAuthUser: jest.fn() }))
jest.mock('@/lib/prisma', () => ({ prisma: { arquivoBiblioteca: { findUnique: jest.fn() } } }))
jest.mock('@/lib/storage', () => ({ abrirUpload: jest.fn() }))

import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { abrirUpload } from '@/lib/storage'
import { GET } from './route'

const usuario = (role: string) => ({ id: 'u1', nome: 'A', email: 'a@x', role })
const pedido = (q = '') => new NextRequest(`http://localhost/api/biblioteca/ab1${q}`)
const ctx = { params: Promise.resolve({ id: 'ab1' }) }
const arquivo = (area: string) => ({ area, nome: 'Tabela de Preços 2026 v3.0.pdf', contentType: 'application/pdf', chave: 'r2:biblioteca-documentos/x.pdf' })

beforeEach(() => {
  jest.clearAllMocks()
  ;(abrirUpload as jest.Mock).mockImplementation(async () => new Response('PDF', { headers: { 'content-length': '3' } }))
})

it('401 sem usuário', async () => {
  ;(getAuthUser as jest.Mock).mockResolvedValue(null)
  expect((await GET(pedido(), ctx)).status).toBe(401)
})

it('tabela de preços abre para qualquer usuário, inline, sem expor a chave do R2', async () => {
  ;(getAuthUser as jest.Mock).mockResolvedValue(usuario('uploader'))
  ;(prisma.arquivoBiblioteca.findUnique as jest.Mock).mockResolvedValue(arquivo('TABELA_PRECOS'))
  const r = await GET(pedido(), ctx)
  expect(r.status).toBe(200)
  expect(r.headers.get('content-disposition')).toMatch(/^inline; filename="Tabela de Precos 2026 v3.0.pdf"; filename\*=UTF-8''Tabela%20de%20Pre%C3%A7os/)
  expect(r.headers.get('content-type')).toBe('application/pdf')
  expect(await r.text()).toBe('PDF')
  expect(abrirUpload).toHaveBeenCalledWith('r2:biblioteca-documentos/x.pdf')
})

it('?baixar=1 vira anexo', async () => {
  ;(getAuthUser as jest.Mock).mockResolvedValue(usuario('uploader'))
  ;(prisma.arquivoBiblioteca.findUnique as jest.Mock).mockResolvedValue(arquivo('TABELA_PRECOS'))
  expect((await GET(pedido('?baixar=1'), ctx)).headers.get('content-disposition')).toMatch(/^attachment;/)
})

it('área restrita: 404 para quem não é admin (não revela que existe), 200 para admin', async () => {
  ;(prisma.arquivoBiblioteca.findUnique as jest.Mock).mockResolvedValue(arquivo('LINKS_MPLS'))
  ;(getAuthUser as jest.Mock).mockResolvedValue(usuario('responsavel'))
  expect((await GET(pedido(), ctx)).status).toBe(404)
  ;(getAuthUser as jest.Mock).mockResolvedValue(usuario('admin'))
  expect((await GET(pedido(), ctx)).status).toBe(200)
})

it('404 quando não existe; 502 quando o storage falha', async () => {
  ;(getAuthUser as jest.Mock).mockResolvedValue(usuario('admin'))
  ;(prisma.arquivoBiblioteca.findUnique as jest.Mock).mockResolvedValue(null)
  expect((await GET(pedido(), ctx)).status).toBe(404)
  ;(prisma.arquivoBiblioteca.findUnique as jest.Mock).mockResolvedValue(arquivo('CALENDARIO'))
  ;(abrirUpload as jest.Mock).mockImplementation(async () => new Response('x', { status: 500 }))
  expect((await GET(pedido(), ctx)).status).toBe(502)
})
