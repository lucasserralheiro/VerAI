/** @jest-environment node */
import { NextRequest } from 'next/server'

jest.mock('@/lib/auth', () => ({
  ...jest.requireActual('@/lib/auth'),
  getAuthUser: jest.fn(),
}))
jest.mock('@/lib/prisma', () => ({
  prisma: { propostaComercial: { findUnique: jest.fn(), update: jest.fn(), delete: jest.fn() } },
}))
jest.mock('@/lib/storage', () => ({
  buildDocumentoPrefix: jest.fn(() => '2026/09/p1/'),
  deleteUploadPrefix: jest.fn(async () => {}),
}))
jest.mock('@/lib/r2', () => ({ deleteR2: jest.fn(async () => {}) }))

import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { deleteR2 } from '@/lib/r2'
import { DELETE, PATCH } from './route'

const requisicao = (corpo: unknown) =>
  new NextRequest('http://localhost/api/propostas-comerciais/p1', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo),
  })
const contexto = { params: Promise.resolve({ id: 'p1' }) }

describe('PATCH /api/propostas-comerciais/[id]', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getAuthUser as jest.Mock).mockResolvedValue({ id: 'u1', role: 'admin' })
    ;(prisma.propostaComercial.findUnique as jest.Mock).mockResolvedValue({ id: 'p1' })
  })

  it('html com marcador de OCR pendente salva e mantém rascunho', async () => {
    ;(prisma.propostaComercial.update as jest.Mock).mockImplementation(({ data }) => ({ id: 'p1', ...data }))

    const resposta = await PATCH(
      requisicao({
        conteudoMarkdown: '<p>texto</p><div class="ocr-pendente" data-arquivo-id="a1" data-pagina="2">corpo</div>',
      }),
      contexto
    )

    expect(prisma.propostaComercial.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'rascunho' }) })
    )
    await expect(resposta.json()).resolves.toEqual(expect.objectContaining({ status: 'rascunho' }))
  })

  it('markdown sem marcador vira concluído', async () => {
    ;(prisma.propostaComercial.update as jest.Mock).mockImplementation(({ data }) => ({ id: 'p1', ...data }))

    const resposta = await PATCH(requisicao({ conteudoMarkdown: 'texto normal, sem marcador nenhum' }), contexto)

    expect(prisma.propostaComercial.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'concluido' }) })
    )
    await expect(resposta.json()).resolves.toEqual(expect.objectContaining({ status: 'concluido' }))
  })
})

describe('DELETE /api/propostas-comerciais/[id]', () => {
  const excluir = () =>
    DELETE(new NextRequest('http://localhost/api/propostas-comerciais/p1', { method: 'DELETE' }), contexto)

  beforeEach(() => {
    jest.clearAllMocks()
    ;(getAuthUser as jest.Mock).mockResolvedValue({ id: 'u1', role: 'admin' })
    ;(prisma.propostaComercial.delete as jest.Mock).mockResolvedValue({})
  })

  it('apaga no R2 as imagens extraídas dos PDFs da proposta', async () => {
    ;(prisma.propostaComercial.findUnique as jest.Mock).mockResolvedValue({
      id: 'p1',
      createdAt: new Date('2026-09-28T12:00:00Z'),
      conteudoMarkdown: '<img src="/api/propostas-comerciais/p1/imagens/0/pagina-1-imagem-1.png">',
      // Proposta de antes do envio pelo R2: original no Blob, que sai pelo prefixo.
      arquivos: [
        { caminhoOriginal: 'https://blob/2026/09/p1/0/original.pdf', arquivoClienteId: null, conteudoExtraido: '<img src="/api/propostas-comerciais/p1/imagens/0/pagina-1-imagem-1.png">' },
        { caminhoOriginal: 'https://blob/2026/09/p1/1/original.pdf', arquivoClienteId: null, conteudoExtraido: '<img src="/api/propostas-comerciais/p1/imagens/1/pagina-4-imagem-2.png">' },
        { caminhoOriginal: 'https://blob/2026/09/p1/2/original.xlsx', arquivoClienteId: null, conteudoExtraido: null },
      ],
    })

    const resposta = await excluir()

    expect(resposta.status).toBe(200)
    expect(prisma.propostaComercial.delete).toHaveBeenCalledWith({ where: { id: 'p1' } })
    expect((deleteR2 as jest.Mock).mock.calls.map(([chave]) => chave).sort()).toEqual([
      'propostas-comerciais/p1/0/imagens/pagina-1-imagem-1.png',
      'propostas-comerciais/p1/1/imagens/pagina-4-imagem-2.png',
    ])
  })

  it('falha do R2 ao apagar imagem não impede a exclusão', async () => {
    ;(prisma.propostaComercial.findUnique as jest.Mock).mockResolvedValue({
      id: 'p1',
      createdAt: new Date(),
      conteudoMarkdown: null,
      arquivos: [
        {
          caminhoOriginal: 'r2:propostas-comerciais/p1/0/original.pdf',
          arquivoClienteId: null,
          conteudoExtraido: '<img src="/api/propostas-comerciais/p1/imagens/0/pagina-1-imagem-1.png">',
        },
      ],
    })
    ;(deleteR2 as jest.Mock).mockRejectedValue(new Error('R2 fora'))

    const resposta = await excluir()

    expect(resposta.status).toBe(200)
  })

  it('apaga no R2 o original enviado pela "Nova conversão" — nunca o arquivo do repositório do cliente', async () => {
    ;(prisma.propostaComercial.findUnique as jest.Mock).mockResolvedValue({
      id: 'p1',
      createdAt: new Date(),
      conteudoMarkdown: null,
      arquivos: [
        { caminhoOriginal: 'r2:propostas-comerciais/p1/0/original.pdf', arquivoClienteId: null, conteudoExtraido: null },
        { caminhoOriginal: 'r2:clientes/c1/pc.pdf', arquivoClienteId: 'ac1', conteudoExtraido: null },
      ],
    })

    const resposta = await excluir()

    expect(resposta.status).toBe(200)
    expect((deleteR2 as jest.Mock).mock.calls.map(([chave]) => chave)).toEqual(['propostas-comerciais/p1/0/original.pdf'])
  })
})
