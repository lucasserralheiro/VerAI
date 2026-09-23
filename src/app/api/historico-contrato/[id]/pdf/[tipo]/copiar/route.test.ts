/** @jest-environment node */
import { NextRequest } from 'next/server'

jest.mock('@/lib/auth', () => ({
  ...jest.requireActual('@/lib/auth'),
  getAuthUser: jest.fn(),
}))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    historicoContrato: { findUnique: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
    propostaComercialArquivo: { findFirst: jest.fn() },
    usuario: { findUnique: jest.fn() },
  },
}))
jest.mock('@/lib/storage', () => ({
  ...jest.requireActual('@/lib/storage'),
  getUpload: jest.fn(),
  putUpload: jest.fn(),
}))

import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getUpload, putUpload } from '@/lib/storage'
import { POST } from './route'

const admin = { id: 'u1', nome: 'Admin', email: 'a@x', role: 'admin' as const }
const contexto = (tipo: string) => ({ params: Promise.resolve({ id: 'h1', tipo }) })
const requisicao = (corpo: unknown) =>
  new NextRequest('http://localhost/api/historico-contrato/h1/pdf/proposta/copiar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo),
  })

beforeEach(() => {
  jest.clearAllMocks()
  ;(getAuthUser as jest.Mock).mockResolvedValue(admin)
  ;(prisma.historicoContrato.findUnique as jest.Mock).mockResolvedValue({
    id: 'h1',
    numero: null,
    proposta: null,
    contrato: { clienteId: 'c1' },
  })
  ;(getUpload as jest.Mock).mockResolvedValue(Buffer.from('%PDF-1.4'))
  ;(putUpload as jest.Mock).mockResolvedValue('https://blob.example/copia.pdf')
  ;(prisma.historicoContrato.update as jest.Mock).mockResolvedValue({ propostaPdfUrl: 'https://blob.example/copia.pdf' })
})

describe('POST /api/historico-contrato/[id]/pdf/[tipo]/copiar', () => {
  it('404 para tipo de anexo desconhecido', async () => {
    expect((await POST(requisicao({}), contexto('outro'))).status).toBe(404)
  })

  it('400 sem origem reconhecida', async () => {
    expect((await POST(requisicao({}), contexto('proposta'))).status).toBe(400)
    expect((await POST(requisicao({ origem: 'historico', linhaId: 'h2' }), contexto('proposta'))).status).toBe(400)
    expect(putUpload).not.toHaveBeenCalled()
  })

  it('copia o PDF de uma proposta comercial pro caminho da linha e grava url/nome', async () => {
    ;(prisma.propostaComercialArquivo.findFirst as jest.Mock).mockResolvedValue({
      caminhoOriginal: 'https://blob.example/original.pdf',
      nomeArquivo: 'PC_SMS_211014_136_v4.0.pdf',
    })

    const resposta = await POST(requisicao({ origem: 'proposta-comercial', arquivoId: 'a1' }), contexto('proposta'))

    expect(resposta.status).toBe(200)
    expect(prisma.propostaComercialArquivo.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'a1', tipo: 'pdf' } })
    )
    expect(getUpload).toHaveBeenCalledWith('https://blob.example/original.pdf')
    expect(putUpload).toHaveBeenCalledWith('historico-contrato/h1/proposta.pdf', expect.any(Buffer), 'application/pdf')
    expect(prisma.historicoContrato.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'h1' },
        data: { propostaPdfUrl: 'https://blob.example/copia.pdf', propostaPdfNome: 'PC_SMS_211014_136_v4.0.pdf' },
      })
    )
  })

  it('404 quando o arquivo da proposta comercial não existe', async () => {
    ;(prisma.propostaComercialArquivo.findFirst as jest.Mock).mockResolvedValue(null)
    const resposta = await POST(requisicao({ origem: 'proposta-comercial', arquivoId: 'x' }), contexto('proposta'))
    expect(resposta.status).toBe(404)
    expect(putUpload).not.toHaveBeenCalled()
  })

  it('copia o PDF de outra linha do mesmo cliente', async () => {
    ;(prisma.historicoContrato.findFirst as jest.Mock).mockResolvedValue({
      propostaPdfUrl: null,
      propostaPdfNome: null,
      termoPdfUrl: 'https://blob.example/h2-termo.pdf',
      termoPdfNome: 'TC 142-2021.pdf',
    })

    const resposta = await POST(requisicao({ origem: 'historico', linhaId: 'h2', coluna: 'termo' }), contexto('termo'))

    expect(resposta.status).toBe(200)
    // A linha de origem só vale se for do mesmo cliente da linha de destino.
    expect(prisma.historicoContrato.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'h2', contrato: { clienteId: 'c1' } } })
    )
    expect(getUpload).toHaveBeenCalledWith('https://blob.example/h2-termo.pdf')
    expect(putUpload).toHaveBeenCalledWith('historico-contrato/h1/termo.pdf', expect.any(Buffer), 'application/pdf')
    expect(prisma.historicoContrato.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { termoPdfUrl: 'https://blob.example/copia.pdf', termoPdfNome: 'TC 142-2021.pdf' } })
    )
  })

  it('404 quando a linha de origem é de outro cliente ou não tem o PDF', async () => {
    ;(prisma.historicoContrato.findFirst as jest.Mock).mockResolvedValue(null)
    const resposta = await POST(requisicao({ origem: 'historico', linhaId: 'h9', coluna: 'proposta' }), contexto('proposta'))
    expect(resposta.status).toBe(404)
    expect(getUpload).not.toHaveBeenCalled()
  })

  it('400 quando a origem é o próprio PDF da linha', async () => {
    const resposta = await POST(requisicao({ origem: 'historico', linhaId: 'h1', coluna: 'proposta' }), contexto('proposta'))
    expect(resposta.status).toBe(400)
    expect(putUpload).not.toHaveBeenCalled()
  })

  it('502 quando não consegue ler o PDF de origem e não grava nada', async () => {
    ;(prisma.propostaComercialArquivo.findFirst as jest.Mock).mockResolvedValue({
      caminhoOriginal: 'https://blob.example/sumiu.pdf',
      nomeArquivo: 'x.pdf',
    })
    ;(getUpload as jest.Mock).mockRejectedValue(new Error('404'))

    const resposta = await POST(requisicao({ origem: 'proposta-comercial', arquivoId: 'a1' }), contexto('proposta'))

    expect(resposta.status).toBe(502)
    expect(putUpload).not.toHaveBeenCalled()
    expect(prisma.historicoContrato.update).not.toHaveBeenCalled()
  })
})
