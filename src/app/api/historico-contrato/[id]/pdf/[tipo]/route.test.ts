/** @jest-environment node */
import { NextRequest } from 'next/server'

jest.mock('@/lib/auth', () => ({
  ...jest.requireActual('@/lib/auth'),
  getAuthUser: jest.fn(),
}))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    historicoContrato: { findUnique: jest.fn(), update: jest.fn() },
    usuario: { findUnique: jest.fn() },
  },
}))
jest.mock('@/lib/storage', () => ({
  ...jest.requireActual('@/lib/storage'),
  putUpload: jest.fn(),
  deleteUpload: jest.fn(),
}))

import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { deleteUpload, putUpload } from '@/lib/storage'
import { DELETE, POST } from './route'

const admin = { id: 'u1', nome: 'Admin', email: 'a@x', role: 'admin' as const }
const contexto = (tipo: string) => ({ params: Promise.resolve({ id: 'h1', tipo }) })

function requisicaoComArquivo(arquivo?: File) {
  const corpo = new FormData()
  if (arquivo) corpo.append('arquivo', arquivo)
  return new NextRequest('http://localhost/api/historico-contrato/h1/pdf/proposta', { method: 'POST', body: corpo })
}

const pdf = () => new File(['%PDF-1.4'], 'PA-01.pdf', { type: 'application/pdf' })

beforeEach(() => {
  jest.clearAllMocks()
  ;(getAuthUser as jest.Mock).mockResolvedValue(admin)
  ;(prisma.historicoContrato.findUnique as jest.Mock).mockResolvedValue({ id: 'h1', contrato: { clienteId: 'c1' } })
})

describe('POST /api/historico-contrato/[id]/pdf/[tipo]', () => {
  it('404 para tipo de anexo desconhecido', async () => {
    const resposta = await POST(requisicaoComArquivo(pdf()), contexto('outro'))
    expect(resposta.status).toBe(404)
  })

  it('404 quando a linha do histórico não existe', async () => {
    ;(prisma.historicoContrato.findUnique as jest.Mock).mockResolvedValue(null)
    const resposta = await POST(requisicaoComArquivo(pdf()), contexto('proposta'))
    expect(resposta.status).toBe(404)
  })

  it('400 sem arquivo e para arquivo que não é PDF', async () => {
    expect((await POST(requisicaoComArquivo(), contexto('proposta'))).status).toBe(400)
    const texto = new File(['oi'], 'nota.txt', { type: 'text/plain' })
    expect((await POST(requisicaoComArquivo(texto), contexto('proposta'))).status).toBe(400)
    expect(putUpload).not.toHaveBeenCalled()
  })

  it('sobe o PDF de proposta e grava url/nome nas colunas PC/PA', async () => {
    ;(putUpload as jest.Mock).mockResolvedValue('https://blob.example/p.pdf')
    ;(prisma.historicoContrato.update as jest.Mock).mockResolvedValue({ propostaPdfUrl: 'https://blob.example/p.pdf' })

    const resposta = await POST(requisicaoComArquivo(pdf()), contexto('proposta'))

    expect(resposta.status).toBe(200)
    expect(putUpload).toHaveBeenCalledWith('historico-contrato/h1/proposta.pdf', expect.any(Buffer), 'application/pdf')
    expect(prisma.historicoContrato.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'h1' },
        data: { propostaPdfUrl: 'https://blob.example/p.pdf', propostaPdfNome: 'PA-01.pdf' },
      })
    )
  })

  it('o tipo termo grava nas colunas TC/TA', async () => {
    ;(putUpload as jest.Mock).mockResolvedValue('https://blob.example/t.pdf')
    ;(prisma.historicoContrato.update as jest.Mock).mockResolvedValue({})

    await POST(requisicaoComArquivo(pdf()), contexto('termo'))

    expect(prisma.historicoContrato.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { termoPdfUrl: 'https://blob.example/t.pdf', termoPdfNome: 'PA-01.pdf' } })
    )
  })
})

describe('DELETE /api/historico-contrato/[id]/pdf/[tipo]', () => {
  const requisicao = () => new NextRequest('http://localhost/x', { method: 'DELETE' })

  it('404 quando não há PDF anexado', async () => {
    ;(prisma.historicoContrato.findUnique as jest.Mock)
      .mockResolvedValueOnce({ id: 'h1', contrato: { clienteId: 'c1' } })
      .mockResolvedValueOnce({ propostaPdfUrl: null })
    const resposta = await DELETE(requisicao(), contexto('proposta'))
    expect(resposta.status).toBe(404)
    expect(deleteUpload).not.toHaveBeenCalled()
  })

  it('apaga o blob e zera url/nome', async () => {
    ;(prisma.historicoContrato.findUnique as jest.Mock)
      .mockResolvedValueOnce({ id: 'h1', contrato: { clienteId: 'c1' } })
      .mockResolvedValueOnce({ termoPdfUrl: 'https://blob.example/t.pdf' })
    ;(deleteUpload as jest.Mock).mockResolvedValue(undefined)
    ;(prisma.historicoContrato.update as jest.Mock).mockResolvedValue({})

    const resposta = await DELETE(requisicao(), contexto('termo'))

    expect(resposta.status).toBe(200)
    expect(deleteUpload).toHaveBeenCalledWith('https://blob.example/t.pdf')
    expect(prisma.historicoContrato.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { termoPdfUrl: null, termoPdfNome: null } })
    )
  })
})
