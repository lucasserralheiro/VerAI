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
jest.mock('@/lib/conferirTotais', () => ({ conferirTotais: jest.fn() }))

import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getUpload } from '@/lib/storage'
import { converterPdfParaHtml } from '@/lib/extracao/pdfHtml'
import { conferirTotais } from '@/lib/conferirTotais'
import { POST } from './route'

function hashDocumento(texto: string): string {
  return createHash('sha256').update(texto).digest('hex')
}

const requisicao = () =>
  new NextRequest('http://localhost/api/propostas-comerciais/p1/conferir-totais', { method: 'POST' })
const contexto = { params: Promise.resolve({ id: 'p1' }) }

describe('POST /api/propostas-comerciais/[id]/conferir-totais', () => {
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

  it('junta paginasConvertidas de todos os PDFs (ignora xlsx/docx) e conta contra o documento salvo', async () => {
    ;(prisma.propostaComercial.findUnique as jest.Mock).mockResolvedValue({
      id: 'p1',
      conteudoMarkdown: 'Documento salvo',
      conferenciaTotais: null,
      conferenciaTotaisEm: null,
      arquivos: [
        { id: 'a1', tipo: 'pdf', ordem: 0, caminhoOriginal: 'https://blob/a1.pdf' },
        { id: 'a2', tipo: 'xlsx', ordem: 1, caminhoOriginal: 'https://blob/a2.xlsx' },
      ],
    })
    ;(getUpload as jest.Mock).mockResolvedValue(Buffer.from('fake'))
    ;(converterPdfParaHtml as jest.Mock).mockResolvedValue({
      html: 'x',
      paginasImagem: [],
      paginasConvertidas: [{ pagina: 1, textoOriginal: 'Total: R$ 10,00', html: '<p>x</p>' }],
      paginasComImagem: [],
    })
    ;(conferirTotais as jest.Mock).mockReturnValue([
      { pagina: 1, rotulo: 'Total', valorNoPdf: 'R$ 10,00', encontradoNoDocumento: true, ocorrenciasNoDocumento: 1 },
    ])

    const resposta = await POST(requisicao(), contexto)

    expect(getUpload).toHaveBeenCalledTimes(1) // só o arquivo pdf, não o xlsx
    expect(conferirTotais).toHaveBeenCalledWith(
      [{ pagina: 1, textoOriginal: 'Total: R$ 10,00', html: '<p>x</p>' }],
      'Documento salvo'
    )
    const corpo = await resposta.json()
    expect(corpo).toMatchObject({
      totais: [{ pagina: 1, rotulo: 'Total', valorNoPdf: 'R$ 10,00', encontradoNoDocumento: true, ocorrenciasNoDocumento: 1 }],
    })
    expect(typeof corpo.checadoEm).toBe('string')
    expect(prisma.propostaComercial.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          conferenciaTotais: expect.objectContaining({ documentoHash: hashDocumento('Documento salvo') }),
        }),
      })
    )
  })

  it('serve do cache quando os PDFs e o documento salvo batem com a última conferência', async () => {
    const documentoSalvo = 'Documento salvo'
    ;(prisma.propostaComercial.findUnique as jest.Mock).mockResolvedValue({
      id: 'p1',
      conteudoMarkdown: documentoSalvo,
      conferenciaTotaisEm: new Date('2026-09-01T00:00:00.000Z'),
      conferenciaTotais: {
        totais: [{ pagina: 1, rotulo: 'Total', valorNoPdf: 'R$ 10,00', encontradoNoDocumento: true, ocorrenciasNoDocumento: 1 }],
        arquivosPdf: ['a1'],
        documentoHash: hashDocumento(documentoSalvo),
      },
      arquivos: [{ id: 'a1', tipo: 'pdf', ordem: 0, caminhoOriginal: 'https://blob/a1.pdf' }],
    })

    const resposta = await POST(requisicao(), contexto)

    expect(conferirTotais).not.toHaveBeenCalled()
    expect(getUpload).not.toHaveBeenCalled()
    const corpo = await resposta.json()
    expect(corpo.totais).toEqual([
      { pagina: 1, rotulo: 'Total', valorNoPdf: 'R$ 10,00', encontradoNoDocumento: true, ocorrenciasNoDocumento: 1 },
    ])
  })

  it('refaz quando o documento salvo mudou desde a última conferência (cache não vale mais)', async () => {
    ;(prisma.propostaComercial.findUnique as jest.Mock).mockResolvedValue({
      id: 'p1',
      conteudoMarkdown: 'Documento NOVO, editado',
      conferenciaTotaisEm: new Date('2026-09-01T00:00:00.000Z'),
      conferenciaTotais: {
        totais: [],
        arquivosPdf: ['a1'],
        documentoHash: hashDocumento('Documento antigo'), // não bate mais
      },
      arquivos: [{ id: 'a1', tipo: 'pdf', ordem: 0, caminhoOriginal: 'https://blob/a1.pdf' }],
    })
    ;(getUpload as jest.Mock).mockResolvedValue(Buffer.from('fake'))
    ;(converterPdfParaHtml as jest.Mock).mockResolvedValue({
      html: 'x',
      paginasImagem: [],
      paginasConvertidas: [{ pagina: 1, textoOriginal: 'a', html: 'a' }],
      paginasComImagem: [],
    })
    ;(conferirTotais as jest.Mock).mockReturnValue([])

    const resposta = await POST(requisicao(), contexto)

    expect(conferirTotais).toHaveBeenCalledTimes(1)
    expect(resposta.status).toBe(200)
  })

  it('sem nenhum arquivo pdf chama conferirTotais com lista vazia de páginas', async () => {
    ;(prisma.propostaComercial.findUnique as jest.Mock).mockResolvedValue({
      id: 'p1',
      conteudoMarkdown: null,
      conferenciaTotais: null,
      conferenciaTotaisEm: null,
      arquivos: [{ id: 'a2', tipo: 'xlsx', ordem: 0, caminhoOriginal: 'https://blob/a2.xlsx' }],
    })
    ;(conferirTotais as jest.Mock).mockReturnValue([])

    const resposta = await POST(requisicao(), contexto)

    expect(conferirTotais).toHaveBeenCalledWith([], '')
    const corpo = await resposta.json()
    expect(corpo.totais).toEqual([])
  })
})
