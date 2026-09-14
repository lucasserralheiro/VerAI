/** @jest-environment node */
import { createHash } from 'node:crypto'
import { NextRequest } from 'next/server'

jest.mock('@/lib/auth', () => ({
  ...jest.requireActual('@/lib/auth'),
  getAuthUser: jest.fn(),
}))
jest.mock('@/lib/prisma', () => ({
  prisma: { propostaComercial: { findUnique: jest.fn(), update: jest.fn() } },
}))
jest.mock('@/lib/storage', () => ({ getUpload: jest.fn() }))
jest.mock('@/lib/extracao/pdfHtml', () => ({ converterPdfParaHtml: jest.fn() }))
jest.mock('@/lib/ia/checarConversao', () => ({ checarConversao: jest.fn() }))

import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getUpload } from '@/lib/storage'
import { converterPdfParaHtml } from '@/lib/extracao/pdfHtml'
import { checarConversao } from '@/lib/ia/checarConversao'
import { POST } from './route'

function hashDocumento(texto: string): string {
  return createHash('sha256').update(texto).digest('hex')
}

const requisicao = (corpo?: unknown, query?: string) =>
  new NextRequest(`http://localhost/api/propostas-comerciais/p1/checagem-ia${query ?? ''}`, {
    method: 'POST',
    ...(corpo !== undefined
      ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) }
      : {}),
  })
const contexto = { params: Promise.resolve({ id: 'p1' }) }

describe('POST /api/propostas-comerciais/[id]/checagem-ia', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getAuthUser as jest.Mock).mockResolvedValue({ id: 'u1', role: 'admin' })
    ;(prisma.propostaComercial.update as jest.Mock).mockResolvedValue({})
  })

  it('retorna 401 sem autenticação', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(null)
    expect((await POST(requisicao(), contexto)).status).toBe(401)
  })

  it('retorna 404 quando a proposta não existe', async () => {
    ;(prisma.propostaComercial.findUnique as jest.Mock).mockResolvedValue(null)
    expect((await POST(requisicao(), contexto)).status).toBe(404)
  })

  it('junta paginasConvertidas de todos os arquivos PDF e audita contra o Markdown já salvo da proposta', async () => {
    ;(prisma.propostaComercial.findUnique as jest.Mock).mockResolvedValue({
      id: 'p1',
      conteudoMarkdown: 'Markdown salvo da proposta',
      checagemIa: null,
      checagemIaEm: null,
      arquivos: [
        { id: 'a1', tipo: 'pdf', ordem: 0, caminhoOriginal: 'https://blob/a1.pdf' },
        { id: 'a2', tipo: 'xlsx', ordem: 1, caminhoOriginal: 'https://blob/a2.xlsx' },
      ],
    })
    ;(getUpload as jest.Mock).mockResolvedValue(Buffer.from('fake'))
    ;(converterPdfParaHtml as jest.Mock).mockResolvedValue({
      html: 'x',
      paginasImagem: [],
      paginasConvertidas: [{ pagina: 1, textoOriginal: 'original', html: 'gerado' }],
      paginasComImagem: [3],
    })
    ;(checarConversao as jest.Mock).mockResolvedValue({ scoreExibido: 87, trechosSuspeitos: [] })

    const resposta = await POST(requisicao(), contexto)

    expect(getUpload).toHaveBeenCalledTimes(1) // só o arquivo pdf, não o xlsx
    expect(getUpload).toHaveBeenCalledWith('https://blob/a1.pdf')
    // Sem `conteudoMarkdown` no corpo do pedido, audita contra o que já está
    // salvo na proposta (sempre o documento INTEIRO, nunca a fatia de uma
    // página — ver o comentário no topo de checarConversao.ts).
    expect(checarConversao).toHaveBeenCalledWith(
      [{ pagina: 1, textoOriginal: 'original', markdown: 'gerado' }],
      'Markdown salvo da proposta'
    )
    const corpo = await resposta.json()
    expect(corpo).toMatchObject({ scoreExibido: 87, trechosSuspeitos: [], paginasComImagem: [3], correcaoAutomaticaAplicada: false })
    expect(typeof corpo.checadoEm).toBe('string')
    // Resultado fica salvo com o hash do documento contra o qual rodou, pra
    // um F5 seguinte saber se o cache ainda vale (ver `mesmoDocumento`).
    expect(prisma.propostaComercial.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          checagemIa: expect.objectContaining({ documentoHash: hashDocumento('Markdown salvo da proposta') }),
        }),
      })
    )
  })

  it('sem nenhum arquivo pdf devolve score null sem chamar checarConversao', async () => {
    ;(prisma.propostaComercial.findUnique as jest.Mock).mockResolvedValue({
      id: 'p1',
      conteudoMarkdown: null,
      checagemIa: null,
      checagemIaEm: null,
      arquivos: [{ id: 'a2', tipo: 'xlsx', ordem: 0, caminhoOriginal: 'https://blob/a2.xlsx' }],
    })

    const resposta = await POST(requisicao(), contexto)

    expect(checarConversao).not.toHaveBeenCalled()
    const corpo = await resposta.json()
    expect(corpo).toMatchObject({ scoreExibido: null, trechosSuspeitos: [], paginasComImagem: [] })
  })

  it('serve do cache quando os PDFs e o documento salvo batem com a última checagem', async () => {
    const documentoSalvo = 'Markdown salvo da proposta'
    ;(prisma.propostaComercial.findUnique as jest.Mock).mockResolvedValue({
      id: 'p1',
      conteudoMarkdown: documentoSalvo,
      checagemIaEm: new Date('2026-09-01T00:00:00.000Z'),
      checagemIa: {
        scoreExibido: 91,
        trechosSuspeitos: [],
        paginasComImagem: [],
        arquivosPdf: ['a1'],
        documentoHash: hashDocumento(documentoSalvo),
        correcaoAutomaticaAplicada: false,
      },
      arquivos: [{ id: 'a1', tipo: 'pdf', ordem: 0, caminhoOriginal: 'https://blob/a1.pdf' }],
    })

    const resposta = await POST(requisicao(), contexto)

    expect(checarConversao).not.toHaveBeenCalled()
    expect(getUpload).not.toHaveBeenCalled()
    const corpo = await resposta.json()
    expect(corpo).toMatchObject({ scoreExibido: 91, trechosSuspeitos: [], paginasComImagem: [] })
  })

  it('refaz a checagem quando o documento salvo mudou desde a última vez (cache não vale mais)', async () => {
    ;(prisma.propostaComercial.findUnique as jest.Mock).mockResolvedValue({
      id: 'p1',
      conteudoMarkdown: 'Markdown NOVO, editado desde a última checagem',
      checagemIaEm: new Date('2026-09-01T00:00:00.000Z'),
      checagemIa: {
        scoreExibido: 91,
        trechosSuspeitos: [],
        paginasComImagem: [],
        arquivosPdf: ['a1'],
        documentoHash: hashDocumento('Markdown antigo'), // não bate mais com o conteudoMarkdown atual
        correcaoAutomaticaAplicada: false,
      },
      arquivos: [{ id: 'a1', tipo: 'pdf', ordem: 0, caminhoOriginal: 'https://blob/a1.pdf' }],
    })
    ;(getUpload as jest.Mock).mockResolvedValue(Buffer.from('fake'))
    ;(converterPdfParaHtml as jest.Mock).mockResolvedValue({
      html: 'x',
      paginasImagem: [],
      paginasConvertidas: [{ pagina: 1, textoOriginal: 'original', html: 'gerado' }],
      paginasComImagem: [],
    })
    ;(checarConversao as jest.Mock).mockResolvedValue({ scoreExibido: 70, trechosSuspeitos: [] })

    const resposta = await POST(requisicao(), contexto)

    expect(checarConversao).toHaveBeenCalledTimes(1)
    const corpo = await resposta.json()
    expect(corpo).toMatchObject({ scoreExibido: 70 })
  })

  it('"Auditar PDF depois das mudanças" (com conteudoMarkdown no corpo) nunca serve do cache', async () => {
    const documentoSalvo = 'Markdown salvo da proposta'
    ;(prisma.propostaComercial.findUnique as jest.Mock).mockResolvedValue({
      id: 'p1',
      conteudoMarkdown: documentoSalvo,
      checagemIaEm: new Date('2026-09-01T00:00:00.000Z'),
      checagemIa: {
        scoreExibido: 91,
        trechosSuspeitos: [],
        paginasComImagem: [],
        arquivosPdf: ['a1'],
        documentoHash: hashDocumento(documentoSalvo), // bateria com o cache se fosse olhado
        correcaoAutomaticaAplicada: false,
      },
      arquivos: [{ id: 'a1', tipo: 'pdf', ordem: 0, caminhoOriginal: 'https://blob/a1.pdf' }],
    })
    ;(getUpload as jest.Mock).mockResolvedValue(Buffer.from('fake'))
    ;(converterPdfParaHtml as jest.Mock).mockResolvedValue({
      html: 'x',
      paginasImagem: [],
      paginasConvertidas: [{ pagina: 1, textoOriginal: 'original', html: 'gerado' }],
      paginasComImagem: [],
    })
    ;(checarConversao as jest.Mock).mockResolvedValue({ scoreExibido: 60, trechosSuspeitos: [] })

    const resposta = await POST(requisicao({ conteudoMarkdown: 'Markdown de agora, com edição ainda não salva' }), contexto)

    expect(checarConversao).toHaveBeenCalledWith(
      [{ pagina: 1, textoOriginal: 'original', markdown: 'gerado' }],
      'Markdown de agora, com edição ainda não salva'
    )
    const corpo = await resposta.json()
    expect(corpo).toMatchObject({ scoreExibido: 60 })
  })

  it('retorna 502 quando a checagem falha', async () => {
    ;(prisma.propostaComercial.findUnique as jest.Mock).mockResolvedValue({
      id: 'p1',
      conteudoMarkdown: 'Markdown salvo',
      checagemIa: null,
      checagemIaEm: null,
      arquivos: [{ id: 'a1', tipo: 'pdf', ordem: 0, caminhoOriginal: 'https://blob/a1.pdf' }],
    })
    ;(getUpload as jest.Mock).mockResolvedValue(Buffer.from('fake'))
    ;(converterPdfParaHtml as jest.Mock).mockResolvedValue({
      html: 'x',
      paginasImagem: [],
      paginasConvertidas: [{ pagina: 1, textoOriginal: 'a', html: 'a' }],
      paginasComImagem: [],
    })
    ;(checarConversao as jest.Mock).mockRejectedValue(new Error('modelo indisponível'))

    const resposta = await POST(requisicao(), contexto)

    expect(resposta.status).toBe(502)
  })

  it('marcarCorrecaoAutomaticaAplicada só grava a marca, sem chamar checarConversao', async () => {
    ;(prisma.propostaComercial.findUnique as jest.Mock).mockResolvedValue({
      id: 'p1',
      conteudoMarkdown: 'Markdown salvo',
      checagemIaEm: null,
      checagemIa: {
        scoreExibido: 80,
        trechosSuspeitos: [],
        paginasComImagem: [],
        arquivosPdf: ['a1'],
        documentoHash: 'hash-antigo',
        correcaoAutomaticaAplicada: false,
      },
      arquivos: [{ id: 'a1', tipo: 'pdf', ordem: 0, caminhoOriginal: 'https://blob/a1.pdf' }],
    })

    const resposta = await POST(requisicao({ marcarCorrecaoAutomaticaAplicada: true }), contexto)

    expect(checarConversao).not.toHaveBeenCalled()
    const corpo = await resposta.json()
    expect(corpo).toMatchObject({ scoreExibido: 80, correcaoAutomaticaAplicada: true })
    expect(prisma.propostaComercial.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          checagemIa: expect.objectContaining({ correcaoAutomaticaAplicada: true }),
        }),
      })
    )
  })
})
