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
    arquivoCliente: { findMany: jest.fn() },
  },
}))
jest.mock('@/lib/visibilidade', () => ({ podeVerCliente: jest.fn() }))
jest.mock('@/lib/storage', () => ({
  buildUploadPath: jest.fn((id: string, ext: string) => `caminho/${id}/original.${ext}`),
  putUpload: jest.fn().mockResolvedValue('https://blob.exemplo/final.pdf'),
  getUpload: jest.fn(),
  deleteUpload: jest.fn().mockResolvedValue(undefined),
}))
jest.mock('@/lib/r2', () => ({
  ...jest.requireActual('@/lib/r2'),
  putR2: jest.fn(async (chave: string) => `r2:${chave}`),
}))
jest.mock('@/lib/extracao/pdfHtml', () => ({ converterPdfParaHtml: jest.fn() }))
jest.mock('@/lib/extracao', () => ({ converterParaHtmlDeterministico: jest.fn() }))
jest.mock('@/lib/ocr/marcadorOcrPendente', () => ({ reescreverComArquivoId: jest.fn((html: string) => html) }))

import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getUpload, deleteUpload, putUpload } from '@/lib/storage'
import { converterPdfParaHtml } from '@/lib/extracao/pdfHtml'
import { podeVerCliente } from '@/lib/visibilidade'
import { putR2 } from '@/lib/r2'
import { POST } from './route'

const requisicao = (corpo: unknown) =>
  new NextRequest('http://localhost/api/propostas-comerciais', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo),
  })

/** Endereço que `/api/propostas-comerciais/envio` devolve depois do PUT direto do navegador no R2. */
const ENVIO = 'r2:tmp-uploads/0f8fad5b-d9cb-469f-a165-70867728950e.pdf'

describe('POST /api/propostas-comerciais — arquivos já subidos direto pro R2 (sem passar pelo corpo da requisição)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(putR2 as jest.Mock).mockImplementation(async (chave: string) => `r2:${chave}`)
    ;(getAuthUser as jest.Mock).mockResolvedValue({ id: 'u1', role: 'admin' })
    ;(prisma.propostaComercial.create as jest.Mock).mockImplementation(({ data }) => ({ id: 'p1', ...data }))
    ;(prisma.propostaComercial.update as jest.Mock).mockImplementation(({ data }) => ({ id: 'p1', ...data }))
    ;(prisma.propostaComercialArquivo.create as jest.Mock).mockResolvedValue({ id: 'arq1' })
    ;(prisma.propostaComercialArquivo.update as jest.Mock).mockResolvedValue({})
    ;(getUpload as jest.Mock).mockResolvedValue(Buffer.from('conteudo do pdf'))
    ;(converterPdfParaHtml as jest.Mock).mockResolvedValue({ html: '<h1>Proposta convertida</h1>', paginasImagem: [] })
  })

  it('sem autenticação devolve 401', async () => {
    ;(getAuthUser as jest.Mock).mockResolvedValue(null)

    const resposta = await POST(requisicao({ arquivos: [{ nomeArquivo: 'a.pdf', url: ENVIO }] }))

    expect(resposta.status).toBe(401)
  })

  it('sem arquivos no corpo devolve 400', async () => {
    const resposta = await POST(requisicao({ arquivos: [] }))

    expect(resposta.status).toBe(400)
  })

  it('tipo de arquivo não suportado devolve 400, sem baixar nada', async () => {
    const resposta = await POST(requisicao({ arquivos: [{ nomeArquivo: 'malware.exe', url: ENVIO }] }))

    expect(resposta.status).toBe(400)
    expect(getUpload).not.toHaveBeenCalled()
  })

  // A rota lê e depois APAGA o endereço recebido: aceitar qualquer um deixaria o navegador ler ou
  // apagar arquivo alheio do bucket (o do SharePoint de outro cliente, por exemplo).
  it.each([
    ['arquivo de outro lugar do bucket', 'r2:clientes/c1/pc.pdf'],
    ['caminho que escapa da pasta temporária', 'r2:tmp-uploads/../clientes/c1/pc.pdf'],
    ['URL do Vercel Blob', 'https://blob.vercel-storage.com/tmp-uploads/a.pdf'],
    ['URL qualquer', 'http://169.254.169.254/latest/meta-data'],
  ])('%s devolve 400, sem baixar nem criar proposta', async (_caso, url) => {
    const resposta = await POST(requisicao({ arquivos: [{ nomeArquivo: 'proposta.pdf', url }] }))

    expect(resposta.status).toBe(400)
    expect(getUpload).not.toHaveBeenCalled()
    expect(deleteUpload).not.toHaveBeenCalled()
    expect(prisma.propostaComercial.create).not.toHaveBeenCalled()
  })

  it('busca o conteúdo pelo endereço do envio (não pelo corpo da requisição) e converte normalmente', async () => {
    const resposta = await POST(requisicao({ arquivos: [{ nomeArquivo: 'proposta.pdf', url: ENVIO }] }))

    expect(getUpload).toHaveBeenCalledWith(ENVIO)
    expect(converterPdfParaHtml).toHaveBeenCalled()
    expect(resposta.status).toBe(201)
    await expect(resposta.json()).resolves.toEqual(
      expect.objectContaining({ conteudoMarkdown: '<h1>Proposta convertida</h1>' })
    )
  })

  it('grava o original no R2, na pasta da proposta — nunca no Blob', async () => {
    await POST(requisicao({ arquivos: [{ nomeArquivo: 'proposta.pdf', url: ENVIO }] }))

    expect(putR2).toHaveBeenCalledWith('propostas-comerciais/p1/0/original.pdf', Buffer.from('conteudo do pdf'), 'application/pdf')
    expect(putUpload).not.toHaveBeenCalled()
    expect(prisma.propostaComercialArquivo.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ caminhoOriginal: 'r2:propostas-comerciais/p1/0/original.pdf' }),
    })
  })

  it('apaga o temporário depois de gravar o original', async () => {
    await POST(requisicao({ arquivos: [{ nomeArquivo: 'proposta.pdf', url: ENVIO }] }))

    expect(deleteUpload).toHaveBeenCalledWith(ENVIO)
  })

  it('falha ao gravar o original marca a proposta com erro, sem 500 e sem apagar o temporário', async () => {
    ;(putR2 as jest.Mock).mockRejectedValue(new Error('R2 recusou a gravação (500)'))

    const resposta = await POST(requisicao({ arquivos: [{ nomeArquivo: 'proposta.pdf', url: ENVIO }] }))

    expect(resposta.status).toBe(201)
    await expect(resposta.json()).resolves.toEqual(
      expect.objectContaining({ status: 'erro', mensagemErro: expect.stringContaining('R2 recusou') })
    )
    expect(deleteUpload).not.toHaveBeenCalled()
  })

  it('falha ao baixar o temporário marca a proposta com erro, sem derrubar a requisição', async () => {
    ;(getUpload as jest.Mock).mockRejectedValue(new Error('Falha ao baixar arquivo do storage (404)'))

    const resposta = await POST(requisicao({ arquivos: [{ nomeArquivo: 'proposta.pdf', url: ENVIO }] }))

    expect(resposta.status).toBe(201)
    await expect(resposta.json()).resolves.toEqual(
      expect.objectContaining({ status: 'erro', mensagemErro: expect.stringContaining('404') })
    )
  })
})

describe('POST /api/propostas-comerciais — arquivo do repositório do cliente (aba Documentos)', () => {
  const arquivoDoCliente = { id: 'ac1', clienteId: 'c1', nome: 'PC-SPREGULA.pdf', tamanhoBytes: 1234, urlBlob: 'r2:clientes/c1/pc.pdf' }

  beforeEach(() => {
    jest.clearAllMocks()
    ;(getAuthUser as jest.Mock).mockResolvedValue({ id: 'u1', role: 'user' })
    ;(podeVerCliente as jest.Mock).mockResolvedValue(true)
    ;(prisma.arquivoCliente.findMany as jest.Mock).mockResolvedValue([arquivoDoCliente])
    ;(prisma.propostaComercial.create as jest.Mock).mockImplementation(({ data }) => ({ id: 'p1', ...data }))
    ;(prisma.propostaComercial.update as jest.Mock).mockImplementation(({ data }) => ({ id: 'p1', ...data }))
    ;(prisma.propostaComercialArquivo.create as jest.Mock).mockResolvedValue({ id: 'arq1' })
    ;(prisma.propostaComercialArquivo.update as jest.Mock).mockResolvedValue({})
    ;(getUpload as jest.Mock).mockResolvedValue(Buffer.from('conteudo do pdf'))
    ;(converterPdfParaHtml as jest.Mock).mockResolvedValue({ html: '<h1>Proposta convertida</h1>', paginasImagem: [] })
  })

  it('converte lendo o arquivo guardado, referencia o ArquivoCliente e não copia nem apaga o original', async () => {
    const resposta = await POST(requisicao({ arquivosCliente: ['ac1'] }))

    expect(resposta.status).toBe(201)
    expect(getUpload).toHaveBeenCalledWith('r2:clientes/c1/pc.pdf')
    expect(putUpload).not.toHaveBeenCalled()
    expect(putR2).not.toHaveBeenCalled()
    expect(deleteUpload).not.toHaveBeenCalled()
    expect(prisma.propostaComercialArquivo.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        nomeArquivo: 'PC-SPREGULA.pdf',
        caminhoOriginal: 'r2:clientes/c1/pc.pdf',
        arquivoClienteId: 'ac1',
      }),
    })
    await expect(resposta.json()).resolves.toEqual(
      expect.objectContaining({ conteudoMarkdown: '<h1>Proposta convertida</h1>' })
    )
  })

  it('imagem de dentro do PDF vai pro R2 (nunca pro Blob, suspenso) e o <img> aponta pra rota do VerAI', async () => {
    ;(converterPdfParaHtml as jest.Mock).mockImplementation(async (_buffer, opcoes) => {
      const src = await opcoes.salvarImagem({ nomeArquivo: 'pagina-2-imagem-1.png', png: Buffer.from('png') })
      return { html: `<p>texto</p><img src="${src}">`, paginasImagem: [] }
    })

    const resposta = await POST(requisicao({ arquivosCliente: ['ac1'] }))

    expect(putR2).toHaveBeenCalledWith('propostas-comerciais/p1/0/imagens/pagina-2-imagem-1.png', Buffer.from('png'), 'image/png')
    expect(putUpload).not.toHaveBeenCalled()
    await expect(resposta.json()).resolves.toEqual(
      expect.objectContaining({
        status: 'rascunho',
        conteudoMarkdown: '<p>texto</p><img src="/api/propostas-comerciais/p1/imagens/0/pagina-2-imagem-1.png">',
      })
    )
  })

  it('arquivo de cliente que o usuário não vê devolve 403, sem criar proposta', async () => {
    ;(podeVerCliente as jest.Mock).mockResolvedValue(false)

    const resposta = await POST(requisicao({ arquivosCliente: ['ac1'] }))

    expect(resposta.status).toBe(403)
    expect(prisma.propostaComercial.create).not.toHaveBeenCalled()
  })

  it('arquivo removido ou inexistente devolve 404', async () => {
    ;(prisma.arquivoCliente.findMany as jest.Mock).mockResolvedValue([])

    const resposta = await POST(requisicao({ arquivosCliente: ['sumiu'] }))

    expect(resposta.status).toBe(404)
    expect(prisma.propostaComercial.create).not.toHaveBeenCalled()
  })

  it('extensão que o conversor não aceita devolve 400', async () => {
    ;(prisma.arquivoCliente.findMany as jest.Mock).mockResolvedValue([{ ...arquivoDoCliente, nome: 'foto.png' }])

    const resposta = await POST(requisicao({ arquivosCliente: ['ac1'] }))

    expect(resposta.status).toBe(400)
    expect(getUpload).not.toHaveBeenCalled()
  })
})
