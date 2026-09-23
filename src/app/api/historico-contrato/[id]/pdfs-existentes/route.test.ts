/** @jest-environment node */
import { NextRequest } from 'next/server'

jest.mock('@/lib/auth', () => ({
  ...jest.requireActual('@/lib/auth'),
  getAuthUser: jest.fn(),
}))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    historicoContrato: { findUnique: jest.fn(), findMany: jest.fn() },
    propostaComercialArquivo: { findMany: jest.fn() },
    usuario: { findUnique: jest.fn() },
  },
}))

import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { GET } from './route'

const admin = { id: 'u1', nome: 'Admin', email: 'a@x', role: 'admin' as const }
const contexto = { params: Promise.resolve({ id: 'h1' }) }
const requisicao = (tipo?: string) =>
  new NextRequest(`http://localhost/api/historico-contrato/h1/pdfs-existentes${tipo ? `?tipo=${tipo}` : ''}`)

beforeEach(() => {
  jest.clearAllMocks()
  ;(getAuthUser as jest.Mock).mockResolvedValue(admin)
  ;(prisma.historicoContrato.findUnique as jest.Mock).mockResolvedValue({
    id: 'h1',
    numero: 'TC 142/2021',
    proposta: 'PC_SMS_211014_136_v4.0',
    contrato: { clienteId: 'c1' },
  })
  ;(prisma.propostaComercialArquivo.findMany as jest.Mock).mockResolvedValue([])
  ;(prisma.historicoContrato.findMany as jest.Mock).mockResolvedValue([])
})

describe('GET /api/historico-contrato/[id]/pdfs-existentes', () => {
  it('400 sem tipo válido', async () => {
    expect((await GET(requisicao(), contexto)).status).toBe(400)
    expect((await GET(requisicao('outro'), contexto)).status).toBe(400)
  })

  it('404 quando a linha não existe', async () => {
    ;(prisma.historicoContrato.findUnique as jest.Mock).mockResolvedValue(null)
    expect((await GET(requisicao('proposta'), contexto)).status).toBe(404)
  })

  it('lista PDFs das Propostas comerciais e de outras linhas do MESMO cliente, sugeridos primeiro', async () => {
    ;(prisma.propostaComercialArquivo.findMany as jest.Mock).mockResolvedValue([
      { id: 'a1', propostaId: 'p1', nomeArquivo: 'Outra proposta.pdf', tamanhoBytes: 2048, createdAt: new Date('2026-03-01T12:00:00Z') },
      { id: 'a2', propostaId: 'p2', nomeArquivo: 'PC_SMS_211014_136_v4.0.pdf', tamanhoBytes: 1048576, createdAt: new Date('2026-02-01T12:00:00Z') },
    ])
    ;(prisma.historicoContrato.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'h2',
        numero: 'TA 001/2022',
        proposta: 'PA-SMS-220606-66 - v3.0',
        propostaPdfUrl: 'https://blob.example/h2-proposta.pdf',
        propostaPdfNome: 'PA-SMS-220606-66 - v3.0.pdf',
        termoPdfUrl: null,
        termoPdfNome: null,
        contrato: { numeroTermo: 'TC 142/2021' },
      },
    ])

    const resposta = await GET(requisicao('proposta'), contexto)
    const corpo = await resposta.json()

    expect(resposta.status).toBe(200)
    expect(corpo.referencia).toBe('PC_SMS_211014_136_v4.0')
    expect(corpo.itens.map((i: { chave: string }) => i.chave)).toEqual([
      'proposta-comercial:a2',
      'proposta-comercial:a1',
      'historico:h2:proposta',
    ])
    expect(corpo.itens[0]).toMatchObject({
      sugerido: true,
      verUrl: '/api/propostas-comerciais/p2/arquivos/a2?modo=preview',
      origem: { origem: 'proposta-comercial', arquivoId: 'a2' },
    })
    expect(corpo.itens[2]).toMatchObject({
      sugerido: false,
      verUrl: 'https://blob.example/h2-proposta.pdf',
      origem: { origem: 'historico', linhaId: 'h2', coluna: 'proposta' },
    })
    // Só do mesmo cliente e nunca a própria linha.
    expect(prisma.historicoContrato.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: { not: 'h1' }, contrato: { clienteId: 'c1' } }) })
    )
    expect(prisma.propostaComercialArquivo.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { tipo: 'pdf' } }))
  })

  it('para o termo compara com o nº da linha e sugere o PDF de outra linha com o mesmo termo', async () => {
    ;(prisma.historicoContrato.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'h3',
        numero: 'TC 142/2021',
        proposta: null,
        propostaPdfUrl: null,
        propostaPdfNome: null,
        termoPdfUrl: 'https://blob.example/h3-termo.pdf',
        termoPdfNome: 'termo.pdf',
        contrato: { numeroTermo: 'TC 142/2021' },
      },
    ])

    const corpo = await (await GET(requisicao('termo'), contexto)).json()

    expect(corpo.referencia).toBe('TC 142/2021')
    expect(corpo.itens).toHaveLength(1)
    expect(corpo.itens[0]).toMatchObject({ chave: 'historico:h3:termo', sugerido: true })
  })
})
