/** @jest-environment node */
import { NextRequest } from 'next/server'

jest.mock('@/lib/auth', () => ({ ...jest.requireActual('@/lib/auth'), getAuthUser: jest.fn() }))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    historicoContrato: { findUnique: jest.fn(), update: jest.fn() },
    usuario: { findUnique: jest.fn() },
    arquivoCliente: {},
  },
}))
jest.mock('@/lib/arquivos/registrar-conteudo', () => ({ registrarConteudo: jest.fn() }))
jest.mock('@/lib/storage', () => ({ ...jest.requireActual('@/lib/storage'), putUpload: jest.fn(), deleteUpload: jest.fn() }))

import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { registrarConteudo } from '@/lib/arquivos/registrar-conteudo'
import { deleteUpload, putUpload } from '@/lib/storage'
import { DELETE, POST } from './route'

const admin = { id: 'u1', nome: 'Admin', email: 'a@x', role: 'admin' as const }
const contexto = (tipo: string) => ({ params: Promise.resolve({ id: 'h1', tipo }) })
const pdf = () => new File(['%PDF-1.4'], 'PA-01.pdf', { type: 'application/pdf' })
function requisicao(arquivo?: File) {
  const corpo = new FormData()
  if (arquivo) corpo.append('arquivo', arquivo)
  return new NextRequest('http://localhost/api/historico-contrato/h1/pdf/proposta', { method: 'POST', body: corpo })
}
const linhaComAnexo = { propostaArquivo: { id: 'a1', nome: 'PA-01.pdf' }, termoArquivo: null, propostaDoSharepoint: false, termoDoSharepoint: false }

beforeEach(() => {
  jest.clearAllMocks()
  ;(getAuthUser as jest.Mock).mockResolvedValue(admin)
  ;(prisma.historicoContrato.findUnique as jest.Mock).mockResolvedValue({ id: 'h1', tipo: 'ADITIVO', contrato: { clienteId: 'c1' } })
})

describe('POST', () => {
  it('404 para tipo desconhecido e para linha que não existe', async () => {
    expect((await POST(requisicao(pdf()), contexto('outro'))).status).toBe(404)
    ;(prisma.historicoContrato.findUnique as jest.Mock).mockResolvedValue(null)
    expect((await POST(requisicao(pdf()), contexto('proposta'))).status).toBe(404)
  })

  it('400 sem arquivo e para não-PDF', async () => {
    expect((await POST(requisicao(), contexto('proposta'))).status).toBe(400)
    expect((await POST(requisicao(new File(['oi'], 'nota.txt', { type: 'text/plain' })), contexto('proposta'))).status).toBe(400)
    expect(registrarConteudo).not.toHaveBeenCalled()
  })

  it('registra no repositório do cliente e a linha passa a apontar pra ele (anexo à mão)', async () => {
    ;(registrarConteudo as jest.Mock).mockResolvedValue({ id: 'a1', novo: true })
    ;(prisma.historicoContrato.update as jest.Mock).mockResolvedValue(linhaComAnexo)
    const resposta = await POST(requisicao(pdf()), contexto('proposta'))
    expect(resposta.status).toBe(200)
    expect((registrarConteudo as jest.Mock).mock.calls[0][1]).toMatchObject({
      clienteId: 'c1', nome: 'PA-01.pdf', categoria: 'PROPOSTA_ADITIVO', origem: 'upload', enviadoPorId: 'u1',
    })
    expect((prisma.historicoContrato.update as jest.Mock).mock.calls[0][0]).toMatchObject({
      where: { id: 'h1' },
      data: { propostaArquivoId: 'a1', propostaDoSharepoint: false },
    })
    expect(await resposta.json()).toMatchObject({ propostaPdfUrl: '/api/arquivos/a1?modo=inline', propostaPdfNome: 'PA-01.pdf' })
    expect(putUpload).not.toHaveBeenCalled()
  })
})

describe('DELETE', () => {
  it('solta a referência e não apaga arquivo nenhum', async () => {
    ;(prisma.historicoContrato.findUnique as jest.Mock)
      .mockResolvedValueOnce({ id: 'h1', tipo: 'ADITIVO', contrato: { clienteId: 'c1' } })
      .mockResolvedValueOnce({ propostaArquivoId: 'a1', termoArquivoId: null })
    ;(prisma.historicoContrato.update as jest.Mock).mockResolvedValue({ ...linhaComAnexo, propostaArquivo: null })
    const resposta = await DELETE(new NextRequest('http://localhost/x', { method: 'DELETE' }), contexto('proposta'))
    expect(resposta.status).toBe(200)
    expect((prisma.historicoContrato.update as jest.Mock).mock.calls[0][0].data).toEqual({ propostaArquivoId: null, propostaDoSharepoint: false })
    expect(deleteUpload).not.toHaveBeenCalled()
  })

  it('404 quando a coluna está vazia', async () => {
    ;(prisma.historicoContrato.findUnique as jest.Mock)
      .mockResolvedValueOnce({ id: 'h1', tipo: 'ADITIVO', contrato: { clienteId: 'c1' } })
      .mockResolvedValueOnce({ propostaArquivoId: null, termoArquivoId: null })
    expect((await DELETE(new NextRequest('http://localhost/x', { method: 'DELETE' }), contexto('proposta'))).status).toBe(404)
  })
})
