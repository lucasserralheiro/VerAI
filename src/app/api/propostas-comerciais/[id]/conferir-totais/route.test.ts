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
jest.mock('@/lib/extracao/docx', () => ({ extrairDocx: jest.fn() }))
jest.mock('@/lib/extracao/excel', () => ({ extrairTotaisDePlanilha: jest.fn() }))
jest.mock('@/lib/conferirTotais', () => ({ conferirTotais: jest.fn(), conferirTotaisPlanilha: jest.fn() }))

import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getUpload } from '@/lib/storage'
import { converterPdfParaHtml } from '@/lib/extracao/pdfHtml'
import { extrairDocx } from '@/lib/extracao/docx'
import { extrairTotaisDePlanilha } from '@/lib/extracao/excel'
import { conferirTotais, conferirTotaisPlanilha } from '@/lib/conferirTotais'
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
    ;(conferirTotais as jest.Mock).mockReturnValue([])
    ;(conferirTotaisPlanilha as jest.Mock).mockReturnValue([])
  })

  it('retorna 401 sem autenticação', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(null)
    expect((await POST(requisicao(), contexto)).status).toBe(401)
  })

  it('retorna 404 quando a proposta não existe', async () => {
    ;(prisma.propostaComercial.findUnique as jest.Mock).mockResolvedValue(null)
    expect((await POST(requisicao(), contexto)).status).toBe(404)
  })

  it('junta páginas de PDF (origem "Página N") e texto do Word (origem = nome do arquivo)', async () => {
    ;(prisma.propostaComercial.findUnique as jest.Mock).mockResolvedValue({
      id: 'p1',
      conteudoMarkdown: 'Documento salvo',
      conferenciaTotais: null,
      conferenciaTotaisEm: null,
      arquivos: [
        { id: 'a1', tipo: 'pdf', ordem: 0, caminhoOriginal: 'https://blob/a1.pdf', nomeArquivo: 'proposta.pdf' },
        { id: 'a3', tipo: 'docx', ordem: 2, caminhoOriginal: 'https://blob/a3.docx', nomeArquivo: 'anexo.docx' },
      ],
    })
    ;(getUpload as jest.Mock).mockResolvedValue(Buffer.from('fake'))
    ;(converterPdfParaHtml as jest.Mock).mockResolvedValue({
      html: 'x',
      paginasImagem: [],
      paginasConvertidas: [{ pagina: 1, textoOriginal: 'Total: R$ 10,00', html: '<p>x</p>' }],
      paginasComImagem: [],
    })
    ;(extrairDocx as jest.Mock).mockResolvedValue('Total do anexo: R$ 20,00')
    ;(conferirTotais as jest.Mock).mockReturnValue([
      { origem: 'Página 1', pagina: 1, rotulo: 'Total', valorNoOriginal: 'R$ 10,00', encontradoNoDocumento: true, ocorrenciasNoDocumento: 1 },
    ])

    const resposta = await POST(requisicao(), contexto)

    expect(getUpload).toHaveBeenCalledTimes(2) // pdf + docx
    expect(extrairDocx).toHaveBeenCalledWith(Buffer.from('fake'))
    expect(conferirTotais).toHaveBeenCalledWith(
      [
        { origem: 'Página 1', pagina: 1, textoOriginal: 'Total: R$ 10,00' },
        { origem: 'anexo.docx', pagina: null, textoOriginal: 'Total do anexo: R$ 20,00' },
      ],
      'Documento salvo'
    )
    const corpo = await resposta.json()
    expect(typeof corpo.checadoEm).toBe('string')
    expect(prisma.propostaComercial.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          conferenciaTotais: expect.objectContaining({
            documentoHash: hashDocumento('Documento salvo'),
            arquivosRelevantes: ['a1', 'a3'],
          }),
        }),
      })
    )
  })

  it('confere planilha (xlsx/csv) com extração e comparação próprias, concatenado com o resto', async () => {
    ;(prisma.propostaComercial.findUnique as jest.Mock).mockResolvedValue({
      id: 'p1',
      conteudoMarkdown: 'Documento salvo',
      conferenciaTotais: null,
      conferenciaTotaisEm: null,
      arquivos: [
        { id: 'a1', tipo: 'pdf', ordem: 0, caminhoOriginal: 'https://blob/a1.pdf', nomeArquivo: 'proposta.pdf' },
        { id: 'a2', tipo: 'xlsx', ordem: 1, caminhoOriginal: 'https://blob/a2.xlsx', nomeArquivo: 'precos.xlsx' },
        { id: 'a4', tipo: 'csv', ordem: 3, caminhoOriginal: 'https://blob/a4.csv', nomeArquivo: 'custos.csv' },
      ],
    })
    ;(getUpload as jest.Mock).mockResolvedValue(Buffer.from('fake'))
    ;(converterPdfParaHtml as jest.Mock).mockResolvedValue({
      html: 'x',
      paginasImagem: [],
      paginasConvertidas: [],
      paginasComImagem: [],
    })
    ;(extrairTotaisDePlanilha as jest.Mock)
      .mockResolvedValueOnce([{ rotulo: 'Total Geral', valor: 279663.46 }]) // xlsx
      .mockResolvedValueOnce([{ rotulo: 'Subtotal', valor: 500 }]) // csv
    ;(conferirTotaisPlanilha as jest.Mock)
      .mockReturnValueOnce([
        { origem: 'precos.xlsx', pagina: null, rotulo: 'Total Geral', valorNoOriginal: '279.663,46', encontradoNoDocumento: true, ocorrenciasNoDocumento: 1 },
      ])
      .mockReturnValueOnce([
        { origem: 'custos.csv', pagina: null, rotulo: 'Subtotal', valorNoOriginal: '500,00', encontradoNoDocumento: false, ocorrenciasNoDocumento: 0 },
      ])

    const resposta = await POST(requisicao(), contexto)

    expect(extrairTotaisDePlanilha).toHaveBeenNthCalledWith(1, Buffer.from('fake'), 'xlsx')
    expect(extrairTotaisDePlanilha).toHaveBeenNthCalledWith(2, Buffer.from('fake'), 'csv')
    expect(conferirTotaisPlanilha).toHaveBeenNthCalledWith(1, 'precos.xlsx', [{ rotulo: 'Total Geral', valor: 279663.46 }], 'Documento salvo')
    expect(conferirTotaisPlanilha).toHaveBeenNthCalledWith(2, 'custos.csv', [{ rotulo: 'Subtotal', valor: 500 }], 'Documento salvo')
    const corpo = await resposta.json()
    expect(corpo.totais).toEqual([
      { origem: 'precos.xlsx', pagina: null, rotulo: 'Total Geral', valorNoOriginal: '279.663,46', encontradoNoDocumento: true, ocorrenciasNoDocumento: 1 },
      { origem: 'custos.csv', pagina: null, rotulo: 'Subtotal', valorNoOriginal: '500,00', encontradoNoDocumento: false, ocorrenciasNoDocumento: 0 },
    ])
  })

  it('serve do cache quando os arquivos (pdf+docx+planilha) e o documento salvo batem com a última conferência', async () => {
    const documentoSalvo = 'Documento salvo'
    ;(prisma.propostaComercial.findUnique as jest.Mock).mockResolvedValue({
      id: 'p1',
      conteudoMarkdown: documentoSalvo,
      conferenciaTotaisEm: new Date('2026-09-01T00:00:00.000Z'),
      conferenciaTotais: {
        totais: [{ origem: 'Página 1', pagina: 1, rotulo: 'Total', valorNoOriginal: 'R$ 10,00', encontradoNoDocumento: true, ocorrenciasNoDocumento: 1 }],
        arquivosRelevantes: ['a1'],
        documentoHash: hashDocumento(documentoSalvo),
      },
      arquivos: [{ id: 'a1', tipo: 'pdf', ordem: 0, caminhoOriginal: 'https://blob/a1.pdf', nomeArquivo: 'proposta.pdf' }],
    })

    const resposta = await POST(requisicao(), contexto)

    expect(conferirTotais).not.toHaveBeenCalled()
    expect(extrairTotaisDePlanilha).not.toHaveBeenCalled()
    expect(getUpload).not.toHaveBeenCalled()
    const corpo = await resposta.json()
    expect(corpo.totais).toEqual([
      { origem: 'Página 1', pagina: 1, rotulo: 'Total', valorNoOriginal: 'R$ 10,00', encontradoNoDocumento: true, ocorrenciasNoDocumento: 1 },
    ])
  })

  it('refaz quando o documento salvo mudou desde a última conferência (cache não vale mais)', async () => {
    ;(prisma.propostaComercial.findUnique as jest.Mock).mockResolvedValue({
      id: 'p1',
      conteudoMarkdown: 'Documento NOVO, editado',
      conferenciaTotaisEm: new Date('2026-09-01T00:00:00.000Z'),
      conferenciaTotais: {
        totais: [],
        arquivosRelevantes: ['a1'],
        documentoHash: hashDocumento('Documento antigo'), // não bate mais
      },
      arquivos: [{ id: 'a1', tipo: 'pdf', ordem: 0, caminhoOriginal: 'https://blob/a1.pdf', nomeArquivo: 'proposta.pdf' }],
    })
    ;(getUpload as jest.Mock).mockResolvedValue(Buffer.from('fake'))
    ;(converterPdfParaHtml as jest.Mock).mockResolvedValue({
      html: 'x',
      paginasImagem: [],
      paginasConvertidas: [{ pagina: 1, textoOriginal: 'a', html: 'a' }],
      paginasComImagem: [],
    })

    const resposta = await POST(requisicao(), contexto)

    expect(conferirTotais).toHaveBeenCalledTimes(1)
    expect(resposta.status).toBe(200)
  })

  it('cache salvo no formato antigo (arquivosPdf, sem arquivosRelevantes) é tratado como nunca conferido', async () => {
    const documentoSalvo = 'Documento salvo'
    ;(prisma.propostaComercial.findUnique as jest.Mock).mockResolvedValue({
      id: 'p1',
      conteudoMarkdown: documentoSalvo,
      conferenciaTotaisEm: new Date('2026-09-01T00:00:00.000Z'),
      conferenciaTotais: {
        totais: [],
        arquivosPdf: ['a1'], // formato antigo
        documentoHash: hashDocumento(documentoSalvo),
      },
      arquivos: [{ id: 'a1', tipo: 'pdf', ordem: 0, caminhoOriginal: 'https://blob/a1.pdf', nomeArquivo: 'proposta.pdf' }],
    })
    ;(getUpload as jest.Mock).mockResolvedValue(Buffer.from('fake'))
    ;(converterPdfParaHtml as jest.Mock).mockResolvedValue({
      html: 'x',
      paginasImagem: [],
      paginasConvertidas: [{ pagina: 1, textoOriginal: 'a', html: 'a' }],
      paginasComImagem: [],
    })

    const resposta = await POST(requisicao(), contexto)

    expect(conferirTotais).toHaveBeenCalledTimes(1)
    expect(resposta.status).toBe(200)
  })

  it('sem nenhum arquivo relevante chama conferirTotais com lista vazia de fontes', async () => {
    ;(prisma.propostaComercial.findUnique as jest.Mock).mockResolvedValue({
      id: 'p1',
      conteudoMarkdown: null,
      conferenciaTotais: null,
      conferenciaTotaisEm: null,
      arquivos: [],
    })

    const resposta = await POST(requisicao(), contexto)

    expect(conferirTotais).toHaveBeenCalledWith([], '')
    const corpo = await resposta.json()
    expect(corpo.totais).toEqual([])
  })
})
