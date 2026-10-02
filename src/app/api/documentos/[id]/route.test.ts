/** @jest-environment node */
import { NextRequest } from 'next/server'

jest.mock('@/lib/auth', () => ({ getAuthUser: jest.fn() }))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    documento: { findUnique: jest.fn(), delete: jest.fn() },
    arquivoCliente: { findFirst: jest.fn() },
    acessoDocumento: { create: jest.fn(), deleteMany: jest.fn() },
    notificacao: { deleteMany: jest.fn() },
    analise: { deleteMany: jest.fn() },
    usuario: { findUnique: jest.fn() },
    regraNotificacao: { findMany: jest.fn() },
    $transaction: jest.fn(),
  },
}))
jest.mock('@/lib/storage', () => ({
  buildDocumentoPrefix: jest.fn(() => '2026/08/doc1/'),
  deleteUploadPrefix: jest.fn().mockResolvedValue(undefined),
}))

import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { deleteUploadPrefix } from '@/lib/storage'
import { DELETE } from './route'

const admin = { id: 'u1', nome: 'Admin', email: 'a@x', role: 'admin' as const }
const contexto = { params: Promise.resolve({ id: 'doc1' }) }
const url = 'http://localhost/api/documentos/doc1'

const documento = {
  id: 'doc1',
  nomeArquivo: 'medicao.xlsx',
  tipo: 'xlsx',
  caminhoOriginal: 'https://x.public.blob.vercel-storage.com/2026/08/doc1/original.xlsx',
  tamanhoBytes: 100,
  status: 'concluido',
  mensagemErro: null,
  uploadedById: 'u1',
  clienteId: 'c1',
  competenciaAno: 2026,
  competenciaMes: 8,
  arquivoId: null,
  createdAt: new Date('2026-08-18T12:00:00Z'),
  analise: null,
}

beforeEach(() => {
  jest.clearAllMocks()
  ;(getAuthUser as jest.Mock).mockResolvedValue(admin)
  ;(prisma.documento.findUnique as jest.Mock).mockResolvedValue(documento)
  ;(prisma.arquivoCliente.findFirst as jest.Mock).mockResolvedValue(null)
  ;(prisma.$transaction as jest.Mock).mockResolvedValue(undefined)
})

describe('DELETE /api/documentos/[id]', () => {
  it('sem ArquivoCliente usando o mesmo blob: apaga o prefixo sem exceções', async () => {
    const resposta = await DELETE(new NextRequest(url, { method: 'DELETE' }), contexto)

    expect(resposta.status).toBe(200)
    expect(prisma.arquivoCliente.findFirst).toHaveBeenCalledWith({
      where: { urlBlob: documento.caminhoOriginal },
      select: { id: true },
    })
    expect(deleteUploadPrefix).toHaveBeenCalledWith('2026/08/doc1/', [])
  })

  it('com ArquivoCliente apontando pro mesmo blob: preserva o original', async () => {
    ;(prisma.arquivoCliente.findFirst as jest.Mock).mockResolvedValue({ id: 'a1' })

    const resposta = await DELETE(new NextRequest(url, { method: 'DELETE' }), contexto)

    expect(resposta.status).toBe(200)
    expect(deleteUploadPrefix).toHaveBeenCalledWith('2026/08/doc1/', [documento.caminhoOriginal])
  })

  it('404 documento inexistente', async () => {
    ;(prisma.documento.findUnique as jest.Mock).mockResolvedValue(null)
    const resposta = await DELETE(new NextRequest(url, { method: 'DELETE' }), contexto)
    expect(resposta.status).toBe(404)
    expect(deleteUploadPrefix).not.toHaveBeenCalled()
  })

  it('403 quem não pode excluir (não é admin nem quem subiu)', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue({ id: 'u2', nome: 'Outro', email: 'o@x', role: 'responsavel' as const })
    ;(prisma.usuario.findUnique as jest.Mock).mockResolvedValue({ clientesPermitidos: [{ id: 'c1' }] })
    ;(prisma.regraNotificacao.findMany as jest.Mock).mockResolvedValue([
      { criterioTipo: 'tipoDocumento', criterioValor: 'xlsx', destinatarios: ['o@x'] },
    ])

    const resposta = await DELETE(new NextRequest(url, { method: 'DELETE' }), contexto)

    expect(resposta.status).toBe(403)
    await expect(resposta.json()).resolves.toEqual({
      error: 'só o admin ou quem subiu o documento pode excluí-lo',
    })
    expect(deleteUploadPrefix).not.toHaveBeenCalled()
  })
})

describe('DELETE /api/documentos/[id] — somente leitura', () => {
  it('403 com motivo para quem vê mas não é da gerência', async () => {
    const comum = { id: 'u2', nome: 'Comum', email: 'c@x', role: 'responsavel' as const }
    ;(getAuthUser as jest.Mock).mockResolvedValue(comum)
    // Leitura liberada: só a consulta de edição (não é da gerência) acontece.
    ;(prisma.documento.findUnique as jest.Mock).mockResolvedValue({ ...documento, uploadedById: 'u2' })
    ;(prisma.usuario.findUnique as jest.Mock).mockResolvedValueOnce({ clientesPermitidos: [], gerencias: [] })
    const resposta = await DELETE(new NextRequest(url, { method: 'DELETE' }), contexto)
    expect(resposta.status).toBe(403)
    await expect(resposta.json()).resolves.toMatchObject({
      motivo: 'Somente leitura: só a equipe da gerência deste cliente edita.',
    })
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })
})
