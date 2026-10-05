/** @jest-environment node */
import { NextRequest } from 'next/server'

jest.mock('@/lib/auth', () => ({ ...jest.requireActual('@/lib/auth'), getAuthUser: jest.fn() }))
jest.mock('@/lib/prisma', () => ({ prisma: { conversaAssistente: { findUnique: jest.fn() } } }))
jest.mock('@/lib/r2', () => ({
  ...jest.requireActual('@/lib/r2'),
  configR2: jest.fn(),
  urlDeEnvioR2: jest.fn(() => 'https://r2.exemplo/assinado'),
}))

import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { configR2, urlDeEnvioR2 } from '@/lib/r2'
import { POST } from './route'

const params = { params: Promise.resolve({ id: 'conv1' }) }
const req = (corpo: unknown) =>
  new NextRequest('http://localhost/api/assistente/conversas/conv1/anexos/envio', { method: 'POST', body: JSON.stringify(corpo) })
const CFG = { conta: 'c', chave: 'k', segredo: 's', bucket: 'b' }

beforeEach(() => {
  jest.clearAllMocks()
  ;(getAuthUser as jest.Mock).mockResolvedValue({ id: 'u1', nome: 'U', email: 'u@x', role: 'responsavel' })
  ;(prisma.conversaAssistente.findUnique as jest.Mock).mockResolvedValue({ usuarioId: 'u1' })
  ;(configR2 as jest.Mock).mockReturnValue(CFG)
})

it('401 sem login', async () => {
  ;(getAuthUser as jest.Mock).mockResolvedValue(null)
  expect((await POST(req({ nome: 'a.pdf', tamanhoBytes: 10 }), params)).status).toBe(401)
})

it('404 conversa de outro usuário ou inexistente', async () => {
  ;(prisma.conversaAssistente.findUnique as jest.Mock).mockResolvedValue({ usuarioId: 'u2' })
  expect((await POST(req({ nome: 'a.pdf', tamanhoBytes: 10 }), params)).status).toBe(404)
  ;(prisma.conversaAssistente.findUnique as jest.Mock).mockResolvedValue(null)
  expect((await POST(req({ nome: 'a.pdf', tamanhoBytes: 10 }), params)).status).toBe(404)
  expect(urlDeEnvioR2).not.toHaveBeenCalled()
})

it('503 sem R2 configurado', async () => {
  ;(configR2 as jest.Mock).mockReturnValue(null)
  expect((await POST(req({ nome: 'a.pdf', tamanhoBytes: 10 }), params)).status).toBe(503)
})

it('400 formato não aceito, tamanho 0 e acima de 50 MB', async () => {
  const exe = await POST(req({ nome: 'a.exe', tamanhoBytes: 10 }), params)
  expect(exe.status).toBe(400)
  expect((await exe.json()).error).toMatch(/formato não aceito/)
  expect((await POST(req({ nome: 'mensagem.eml', tamanhoBytes: 10 }), params)).status).toBe(400)
  expect((await POST(req({ nome: 'a.pdf', tamanhoBytes: 0 }), params)).status).toBe(400)
  expect((await POST(req({ nome: 'a.pdf', tamanhoBytes: 1.5 }), params)).status).toBe(400)
  const grande = await POST(req({ nome: 'a.pdf', tamanhoBytes: 50 * 1024 * 1024 + 1 }), params)
  expect(grande.status).toBe(400)
  expect((await grande.json()).error).toMatch(/arquivo acima de 50 MB/)
  expect(urlDeEnvioR2).not.toHaveBeenCalled()
})

it('200 com link amarrado a tipo e tamanho, na pasta da conversa', async () => {
  const r = await POST(req({ nome: 'Proposta.PDF', tamanhoBytes: 1234 }), params)
  expect(r.status).toBe(200)
  const corpo = await r.json()
  expect(corpo.url).toBe('https://r2.exemplo/assinado')
  expect(corpo.contentType).toBe('application/pdf')
  expect(corpo.endereco).toMatch(/^r2:assistente\/conv1\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$/)
  const [chave, opcoes, cfg] = (urlDeEnvioR2 as jest.Mock).mock.calls[0]
  expect(`r2:${chave}`).toBe(corpo.endereco)
  expect(opcoes).toEqual({ contentType: 'application/pdf', tamanhoBytes: 1234, expiraEmSegundos: 900 })
  expect(cfg).toBe(CFG)
  expect(prisma.conversaAssistente.findUnique).toHaveBeenCalledWith({ where: { id: 'conv1' }, select: { usuarioId: true } })
})
