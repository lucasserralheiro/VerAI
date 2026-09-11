/** @jest-environment node */
import { NextRequest } from 'next/server'

jest.mock('@/lib/auth', () => ({
  ...jest.requireActual('@/lib/auth'),
  getAuthUser: jest.fn(),
}))
jest.mock('@/lib/prisma', () => ({
  prisma: { propostaComercial: { findUnique: jest.fn() } },
}))
jest.mock('@/lib/storage', () => ({ getUpload: jest.fn() }))
jest.mock('@/lib/extracao/pdfMarkdown', () => ({ converterPdfParaMarkdown: jest.fn() }))
jest.mock('@/lib/ia/checarConversao', () => ({ checarConversao: jest.fn() }))

import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getUpload } from '@/lib/storage'
import { converterPdfParaMarkdown } from '@/lib/extracao/pdfMarkdown'
import { checarConversao } from '@/lib/ia/checarConversao'
import { POST } from './route'

const requisicao = () => new NextRequest('http://localhost/api/propostas-comerciais/p1/checagem-ia', { method: 'POST' })
const contexto = { params: Promise.resolve({ id: 'p1' }) }

describe('POST /api/propostas-comerciais/[id]/checagem-ia', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getAuthUser as jest.Mock).mockResolvedValue({ id: 'u1', role: 'admin' })
  })

  it('retorna 401 sem autenticação', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(null)
    expect((await POST(requisicao(), contexto)).status).toBe(401)
  })

  it('retorna 404 quando a proposta não existe', async () => {
    ;(prisma.propostaComercial.findUnique as jest.Mock).mockResolvedValue(null)
    expect((await POST(requisicao(), contexto)).status).toBe(404)
  })

  it('junta paginasConvertidas de todos os arquivos PDF e devolve o resultado da checagem', async () => {
    ;(prisma.propostaComercial.findUnique as jest.Mock).mockResolvedValue({
      id: 'p1',
      arquivos: [
        { id: 'a1', tipo: 'pdf', caminhoOriginal: 'https://blob/a1.pdf' },
        { id: 'a2', tipo: 'xlsx', caminhoOriginal: 'https://blob/a2.xlsx' },
      ],
    })
    ;(getUpload as jest.Mock).mockResolvedValue(Buffer.from('fake'))
    ;(converterPdfParaMarkdown as jest.Mock).mockResolvedValue({
      markdown: 'x',
      paginasImagem: [],
      paginasConvertidas: [{ pagina: 1, textoOriginal: 'original', markdown: 'gerado' }],
      paginasComImagem: [3],
    })
    ;(checarConversao as jest.Mock).mockResolvedValue({ scoreExibido: 87, trechosSuspeitos: [] })

    const resposta = await POST(requisicao(), contexto)

    expect(getUpload).toHaveBeenCalledTimes(1) // só o arquivo pdf, não o xlsx
    expect(getUpload).toHaveBeenCalledWith('https://blob/a1.pdf')
    expect(checarConversao).toHaveBeenCalledWith([{ pagina: 1, textoOriginal: 'original', markdown: 'gerado' }])
    await expect(resposta.json()).resolves.toEqual({ scoreExibido: 87, trechosSuspeitos: [], paginasComImagem: [3] })
  })

  it('sem nenhum arquivo pdf devolve score null sem chamar checarConversao', async () => {
    ;(prisma.propostaComercial.findUnique as jest.Mock).mockResolvedValue({
      id: 'p1',
      arquivos: [{ id: 'a2', tipo: 'xlsx', caminhoOriginal: 'https://blob/a2.xlsx' }],
    })

    const resposta = await POST(requisicao(), contexto)

    expect(checarConversao).not.toHaveBeenCalled()
    await expect(resposta.json()).resolves.toEqual({ scoreExibido: null, trechosSuspeitos: [], paginasComImagem: [] })
  })

  it('retorna 502 quando a checagem falha', async () => {
    ;(prisma.propostaComercial.findUnique as jest.Mock).mockResolvedValue({
      id: 'p1',
      arquivos: [{ id: 'a1', tipo: 'pdf', caminhoOriginal: 'https://blob/a1.pdf' }],
    })
    ;(getUpload as jest.Mock).mockResolvedValue(Buffer.from('fake'))
    ;(converterPdfParaMarkdown as jest.Mock).mockResolvedValue({
      markdown: 'x',
      paginasImagem: [],
      paginasConvertidas: [{ pagina: 1, textoOriginal: 'a', markdown: 'a' }],
      paginasComImagem: [],
    })
    ;(checarConversao as jest.Mock).mockRejectedValue(new Error('modelo indisponível'))

    const resposta = await POST(requisicao(), contexto)

    expect(resposta.status).toBe(502)
  })
})
