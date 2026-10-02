/** @jest-environment node */
import { NextRequest } from 'next/server'

jest.mock('@/lib/auth', () => ({ ...jest.requireActual('@/lib/auth'), getAuthUser: jest.fn() }))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    conversaAssistente: { findUnique: jest.fn(), update: jest.fn() },
    mensagemAssistente: { create: jest.fn() },
    anexoAssistente: { findMany: jest.fn() },
  },
}))
jest.mock('@/lib/assistente/anexos/registrar', () => ({
  ...jest.requireActual('@/lib/assistente/anexos/registrar'),
  registrarAnexo: jest.fn(),
}))

import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { AnexoForaDoR2, registrarAnexo } from '@/lib/assistente/anexos/registrar'
import { GET, POST, maxDuration } from './route'

const UUID = '0b1c2d3e-4f50-4617-8899-aabbccddeeff'
const endereco = `r2:assistente/conv1/${UUID}.pdf`
const params = { params: Promise.resolve({ id: 'conv1' }) }
const req = (corpo?: unknown) =>
  new NextRequest('http://localhost/api/assistente/conversas/conv1/anexos', corpo === undefined ? {} : { method: 'POST', body: JSON.stringify(corpo) })
const usuario = { id: 'u1', nome: 'U', email: 'u@x', role: 'responsavel' }

beforeEach(() => {
  jest.clearAllMocks()
  ;(getAuthUser as jest.Mock).mockResolvedValue(usuario)
  ;(prisma.conversaAssistente.findUnique as jest.Mock).mockResolvedValue({ usuarioId: 'u1' })
  ;(registrarAnexo as jest.Mock).mockResolvedValue({ anexo: { id: 'a1', nome: 'p.pdf', status: 'ok', ficha: { tipo: 'proposta' } }, texto: '**p.pdf** — ficha' })
})

it('maxDuration 300', () => expect(maxDuration).toBe(300))

it('401 sem login', async () => {
  ;(getAuthUser as jest.Mock).mockResolvedValue(null)
  expect((await POST(req({ endereco, nome: 'p.pdf' }), params)).status).toBe(401)
  expect((await GET(req(), params)).status).toBe(401)
})

it('404 conversa de outro usuário ou inexistente: não registra nem lista', async () => {
  ;(prisma.conversaAssistente.findUnique as jest.Mock).mockResolvedValue({ usuarioId: 'u2' })
  expect((await POST(req({ endereco, nome: 'p.pdf' }), params)).status).toBe(404)
  expect((await GET(req(), params)).status).toBe(404)
  ;(prisma.conversaAssistente.findUnique as jest.Mock).mockResolvedValue(null)
  expect((await POST(req({ endereco, nome: 'p.pdf' }), params)).status).toBe(404)
  expect(registrarAnexo).not.toHaveBeenCalled()
  expect(prisma.anexoAssistente.findMany).not.toHaveBeenCalled()
})

it('400 endereço de outra conversa ou fora da pasta do assistente', async () => {
  for (const e of [`r2:assistente/conv2/${UUID}.pdf`, `r2:tmp-uploads/${UUID}.pdf`, `r2:assistente/conv1/../conv2/${UUID}.pdf`]) {
    expect((await POST(req({ endereco: e, nome: 'p.pdf' }), params)).status).toBe(400)
  }
  expect(registrarAnexo).not.toHaveBeenCalled()
})

it('400 corpo inválido (nome vazio/longo, OCR fora do limite)', async () => {
  expect((await POST(req({ endereco, nome: '' }), params)).status).toBe(400)
  expect((await POST(req({ endereco, nome: 'x'.repeat(201) }), params)).status).toBe(400)
  expect((await POST(req({ endereco, nome: 'pasta/' }), params)).status).toBe(400)
  expect((await POST(req({ endereco, nome: 'p.pdf', paginasOcr: [{ pagina: 0, texto: 'a' }] }), params)).status).toBe(400)
  expect((await POST(req({ endereco, nome: 'p.pdf', paginasOcr: [{ pagina: 1, texto: 'a'.repeat(200001) }] }), params)).status).toBe(400)
  const muitas = Array.from({ length: 2001 }, (_, i) => ({ pagina: i + 1, texto: '' }))
  expect((await POST(req({ endereco, nome: 'p.pdf', paginasOcr: muitas }), params)).status).toBe(400)
  expect(registrarAnexo).not.toHaveBeenCalled()
})

it('400 quando o arquivo não chegou ao R2, sem mensagem gravada', async () => {
  ;(registrarAnexo as jest.Mock).mockRejectedValue(new AnexoForaDoR2())
  const r = await POST(req({ endereco, nome: 'p.pdf' }), params)
  expect(r.status).toBe(400)
  expect((await r.json()).error).toBe('arquivo não encontrado; envie de novo')
  expect(prisma.mensagemAssistente.create).not.toHaveBeenCalled()
})

it('outra falha (banco) não vira "envie de novo": propaga', async () => {
  ;(registrarAnexo as jest.Mock).mockRejectedValue(new Error('banco fora'))
  await expect(POST(req({ endereco, nome: 'p.pdf' }), params)).rejects.toThrow('banco fora')
  expect(prisma.mensagemAssistente.create).not.toHaveBeenCalled()
})

it('registra, grava a ficha como resposta direta e devolve anexo + texto', async () => {
  const ocr = [{ pagina: 1, texto: 'lido no navegador' }]
  const r = await POST(req({ endereco, nome: 'C:\\Users\\x\\p.pdf', paginasOcr: ocr }), params)
  expect(r.status).toBe(200)
  expect(await r.json()).toEqual({ anexo: { id: 'a1', nome: 'p.pdf', status: 'ok', ficha: { tipo: 'proposta' } }, texto: '**p.pdf** — ficha' })
  expect(registrarAnexo).toHaveBeenCalledWith({ conversaId: 'conv1', usuario: expect.objectContaining({ id: 'u1' }), endereco, nome: 'p.pdf', paginasOcr: ocr })
  expect(prisma.mensagemAssistente.create).toHaveBeenCalledWith({
    data: { conversaId: 'conv1', papel: 'assistente', conteudo: '**p.pdf** — ficha', origem: 'direta', tipos: ['verai'] },
  })
  expect(prisma.conversaAssistente.update).toHaveBeenCalledWith({ where: { id: 'conv1' }, data: { atualizadaEm: expect.any(Date) } })
  // dono conferido antes de registrar
  expect((prisma.conversaAssistente.findUnique as jest.Mock).mock.invocationCallOrder[0]).toBeLessThan(
    (registrarAnexo as jest.Mock).mock.invocationCallOrder[0]
  )
})

it('GET lista os anexos da conversa em ordem', async () => {
  const lista = [{ id: 'a1', nome: 'p.pdf', formato: 'pdf', status: 'ok', paginas: 2, ocr: false, ficha: null }]
  ;(prisma.anexoAssistente.findMany as jest.Mock).mockResolvedValue(lista)
  expect(await (await GET(req(), params)).json()).toEqual({ anexos: lista })
  expect(prisma.anexoAssistente.findMany).toHaveBeenCalledWith({
    where: { conversaId: 'conv1' },
    orderBy: { createdAt: 'asc' },
    select: { id: true, nome: true, formato: true, status: true, paginas: true, ocr: true, ficha: true },
  })
})
