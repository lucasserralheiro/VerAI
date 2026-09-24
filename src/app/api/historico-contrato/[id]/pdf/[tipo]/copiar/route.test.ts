/** @jest-environment node */
import { NextRequest } from 'next/server'

jest.mock('@/lib/auth', () => ({ ...jest.requireActual('@/lib/auth'), getAuthUser: jest.fn() }))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    historicoContrato: { findUnique: jest.fn(), update: jest.fn() },
    usuario: { findUnique: jest.fn() },
    propostaComercialArquivo: { findFirst: jest.fn() },
    arquivoCliente: { findFirst: jest.fn() },
  },
}))
jest.mock('@/lib/arquivos/registrar-conteudo', () => ({ registrarConteudo: jest.fn() }))
jest.mock('@/lib/storage', () => ({ ...jest.requireActual('@/lib/storage'), getUpload: jest.fn(), putUpload: jest.fn() }))

import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { registrarConteudo } from '@/lib/arquivos/registrar-conteudo'
import { getUpload, putUpload } from '@/lib/storage'
import { POST } from './route'

const admin = { id: 'u1', nome: 'Admin', email: 'a@x', role: 'admin' as const }
const contexto = { params: Promise.resolve({ id: 'h1', tipo: 'termo' }) }
const req = (corpo: unknown) => new NextRequest('http://localhost/x', { method: 'POST', body: JSON.stringify(corpo) })
const depois = { propostaArquivo: null, termoArquivo: { id: 'a9', nome: 'TA 01.pdf' }, propostaDoSharepoint: false, termoDoSharepoint: false }

beforeEach(() => {
  jest.clearAllMocks()
  ;(getAuthUser as jest.Mock).mockResolvedValue(admin)
  ;(prisma.historicoContrato.findUnique as jest.Mock).mockResolvedValue({ id: 'h1', tipo: 'ADITIVO', contrato: { clienteId: 'c1' } })
  ;(prisma.historicoContrato.update as jest.Mock).mockResolvedValue(depois)
})

it('do repositório: aponta pro mesmo arquivo, sem cópia', async () => {
  ;(prisma.arquivoCliente.findFirst as jest.Mock).mockResolvedValue({ id: 'a9' })
  const resposta = await POST(req({ origem: 'repositorio', arquivoId: 'a9' }), contexto)
  expect(resposta.status).toBe(200)
  expect((prisma.arquivoCliente.findFirst as jest.Mock).mock.calls[0][0].where).toEqual({ id: 'a9', clienteId: 'c1', removidoEm: null, contentType: 'application/pdf' })
  expect((prisma.historicoContrato.update as jest.Mock).mock.calls[0][0].data).toEqual({ termoArquivoId: 'a9', termoDoSharepoint: false })
  expect(getUpload).not.toHaveBeenCalled()
  expect(putUpload).not.toHaveBeenCalled()
})

it('do repositório de outro cliente: 404', async () => {
  ;(prisma.arquivoCliente.findFirst as jest.Mock).mockResolvedValue(null)
  expect((await POST(req({ origem: 'repositorio', arquivoId: 'a9' }), contexto)).status).toBe(404)
})

it('da tela de propostas: registra no repositório do cliente e aponta', async () => {
  ;(prisma.propostaComercialArquivo.findFirst as jest.Mock).mockResolvedValue({ caminhoOriginal: 'https://blob/p1.pdf', nomeArquivo: 'TA 01.pdf' })
  ;(getUpload as jest.Mock).mockResolvedValue(Buffer.from('%PDF'))
  ;(registrarConteudo as jest.Mock).mockResolvedValue({ id: 'a9', novo: true })
  const resposta = await POST(req({ origem: 'proposta-comercial', arquivoId: 'p1' }), contexto)
  expect(resposta.status).toBe(200)
  expect((registrarConteudo as jest.Mock).mock.calls[0][1]).toMatchObject({ clienteId: 'c1', nome: 'TA 01.pdf', categoria: 'TERMO_ADITIVO', origem: 'upload', enviadoPorId: 'u1' })
  expect(await resposta.json()).toMatchObject({ termoPdfUrl: '/api/arquivos/a9?modo=inline' })
})

it('origem desconhecida: 400', async () => {
  expect((await POST(req({ origem: 'historico', linhaId: 'h2', coluna: 'termo' }), contexto)).status).toBe(400)
})
