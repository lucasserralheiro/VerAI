/** @jest-environment node */
import { NextRequest } from 'next/server'

jest.mock('@/lib/auth', () => ({
  ...jest.requireActual('@/lib/auth'),
  getAuthUser: jest.fn(),
}))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    propostaComercial: { create: jest.fn(), update: jest.fn(), findMany: jest.fn() },
    propostaComercialArquivo: { create: jest.fn(), update: jest.fn() },
  },
}))
jest.mock('@/lib/storage', () => ({
  buildUploadPath: jest.fn((id: string, ext: string) => `caminho/${id}/original.${ext}`),
  buildImagemPath: jest.fn((id: string, nome: string) => `caminho/${id}/imagens/${nome}`),
  putUpload: jest.fn().mockResolvedValue('https://blob.exemplo/final.pdf'),
  getUpload: jest.fn(),
  deleteUpload: jest.fn().mockResolvedValue(undefined),
}))
jest.mock('@/lib/extracao/pdfHtml', () => ({ converterPdfParaMarkdown: jest.fn() }))
jest.mock('@/lib/extracao', () => ({ converterParaMarkdownDeterministico: jest.fn() }))
jest.mock('@/lib/ocr/marcadorOcrPendente', () => ({ reescreverComArquivoId: jest.fn((md: string) => md) }))

import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getUpload, deleteUpload } from '@/lib/storage'
import { converterPdfParaMarkdown } from '@/lib/extracao/pdfHtml'
import { POST } from './route'

const requisicao = (corpo: unknown) =>
  new NextRequest('http://localhost/api/propostas-comerciais', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo),
  })

describe('POST /api/propostas-comerciais — arquivos já subidos direto pro Blob (sem passar pelo corpo da requisição)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getAuthUser as jest.Mock).mockResolvedValue({ id: 'u1', role: 'admin' })
    ;(prisma.propostaComercial.create as jest.Mock).mockImplementation(({ data }) => ({ id: 'p1', ...data }))
    ;(prisma.propostaComercial.update as jest.Mock).mockImplementation(({ data }) => ({ id: 'p1', ...data }))
    ;(prisma.propostaComercialArquivo.create as jest.Mock).mockResolvedValue({ id: 'arq1' })
    ;(prisma.propostaComercialArquivo.update as jest.Mock).mockResolvedValue({})
    ;(getUpload as jest.Mock).mockResolvedValue(Buffer.from('conteudo do pdf'))
    ;(converterPdfParaMarkdown as jest.Mock).mockResolvedValue({ markdown: '# Proposta convertida', paginasImagem: [] })
  })

  it('sem autenticação devolve 401', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(null)

    const resposta = await POST(requisicao({ arquivos: [{ nomeArquivo: 'a.pdf', url: 'https://blob/a.pdf' }] }))

    expect(resposta.status).toBe(401)
  })

  it('sem arquivos no corpo devolve 400', async () => {
    const resposta = await POST(requisicao({ arquivos: [] }))

    expect(resposta.status).toBe(400)
  })

  it('tipo de arquivo não suportado devolve 400, sem baixar nada do Blob', async () => {
    const resposta = await POST(requisicao({ arquivos: [{ nomeArquivo: 'malware.exe', url: 'https://blob/a.exe' }] }))

    expect(resposta.status).toBe(400)
    expect(getUpload).not.toHaveBeenCalled()
  })

  it('busca o conteúdo do arquivo pela URL do Blob (não pelo corpo da requisição) e converte normalmente', async () => {
    const resposta = await POST(
      requisicao({ arquivos: [{ nomeArquivo: 'proposta.pdf', url: 'https://blob/tmp/proposta.pdf' }] })
    )

    expect(getUpload).toHaveBeenCalledWith('https://blob/tmp/proposta.pdf')
    expect(converterPdfParaMarkdown).toHaveBeenCalled()
    expect(resposta.status).toBe(201)
    await expect(resposta.json()).resolves.toEqual(expect.objectContaining({ conteudoMarkdown: '# Proposta convertida' }))
  })

  it('apaga o blob temporário depois de copiar o arquivo pro caminho final', async () => {
    await POST(requisicao({ arquivos: [{ nomeArquivo: 'proposta.pdf', url: 'https://blob/tmp/proposta.pdf' }] }))

    expect(deleteUpload).toHaveBeenCalledWith('https://blob/tmp/proposta.pdf')
  })

  it('falha ao baixar do Blob marca a proposta com erro, sem derrubar a requisição', async () => {
    ;(getUpload as jest.Mock).mockRejectedValue(new Error('Falha ao baixar arquivo do storage (404)'))

    const resposta = await POST(
      requisicao({ arquivos: [{ nomeArquivo: 'proposta.pdf', url: 'https://blob/tmp/sumiu.pdf' }] })
    )

    expect(resposta.status).toBe(201)
    await expect(resposta.json()).resolves.toEqual(
      expect.objectContaining({ status: 'erro', mensagemErro: expect.stringContaining('404') })
    )
  })
})
