/** @jest-environment node */
import { NextRequest } from 'next/server'

jest.mock('@/lib/auth', () => ({ ...jest.requireActual('@/lib/auth'), getAuthUser: jest.fn() }))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    historicoContrato: { findUnique: jest.fn() },
    usuario: { findUnique: jest.fn() },
    propostaComercialArquivo: { findMany: jest.fn() },
    arquivoCliente: { findMany: jest.fn() },
  },
}))

import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { GET } from './route'

const admin = { id: 'u1', nome: 'Admin', email: 'a@x', role: 'admin' as const }
const contexto = { params: Promise.resolve({ id: 'h1' }) }
const req = (tipo: string) => new NextRequest(`http://localhost/api/historico-contrato/h1/pdfs-existentes?tipo=${tipo}`)

beforeEach(() => {
  jest.clearAllMocks()
  ;(getAuthUser as jest.Mock).mockResolvedValue(admin)
  ;(prisma.historicoContrato.findUnique as jest.Mock).mockResolvedValue({ id: 'h1', tipo: 'ADITIVO', numero: 'TA 01', proposta: 'PA-SF-220814-106', contrato: { clienteId: 'c1' } })
  ;(prisma.propostaComercialArquivo.findMany as jest.Mock).mockResolvedValue([
    { id: 'p1', propostaId: 'pp1', nomeArquivo: 'outra.pdf', tamanhoBytes: 10, createdAt: new Date('2026-09-01T00:00:00Z') },
  ])
  ;(prisma.arquivoCliente.findMany as jest.Mock).mockResolvedValue([
    { id: 'a1', nome: 'PA-SF-220814-106 v3.0.pdf', tamanhoBytes: 20, categoria: 'PROPOSTA_ADITIVO', origem: 'sharepoint', createdAt: new Date('2026-09-02T00:00:00Z') },
  ])
})

it('400 para tipo inválido', async () => {
  expect((await GET(req('x'), contexto)).status).toBe(400)
})

it('lista PDFs do repositório do cliente e da tela de propostas, sugeridos primeiro', async () => {
  const corpo = await (await GET(req('proposta'), contexto)).json()
  expect((prisma.arquivoCliente.findMany as jest.Mock).mock.calls[0][0].where).toEqual({ clienteId: 'c1', removidoEm: null, contentType: 'application/pdf' })
  expect(corpo.referencia).toBe('PA-SF-220814-106')
  expect(corpo.itens[0]).toMatchObject({
    chave: 'repositorio:a1',
    nome: 'PA-SF-220814-106 v3.0.pdf',
    detalhe: 'Proposta de aditivo · SharePoint',
    verUrl: '/api/arquivos/a1?modo=inline',
    sugerido: true,
    origem: { origem: 'repositorio', arquivoId: 'a1' },
  })
  expect(corpo.itens[1]).toMatchObject({ chave: 'proposta-comercial:p1', sugerido: false })
})
