/** @jest-environment node */
jest.mock('@/lib/prisma', () => ({
  prisma: {
    historicoContrato: { findMany: jest.fn() },
    faturamento: { findMany: jest.fn() },
    documento: { findMany: jest.fn() },
    propostaComercialArquivo: { findMany: jest.fn() },
    arquivoCliente: { findMany: jest.fn() },
    documentoReferencia: { findMany: jest.fn() },
  },
}))

import { prisma } from '@/lib/prisma'
import { listarFontes } from './fontes'

beforeEach(() => {
  jest.clearAllMocks()
  ;(prisma.historicoContrato.findMany as jest.Mock).mockResolvedValue([
    {
      id: 'h1',
      contratoId: 'k1',
      contrato: { clienteId: 'c1' },
      // PC/PA e TC/TA por referência ao repositório (spec sharepoint-lugar-certo §3.4): o nome vem do arquivo.
      propostaArquivo: { urlBlob: 'https://b/h1-p.pdf', nome: 'PC_031.pdf' },
      termoArquivo: { urlBlob: 'https://b/h1-t.pdf', nome: 'TA_01.pdf' },
    },
  ])
  ;(prisma.faturamento.findMany as jest.Mock).mockResolvedValue([
    { id: 'f1', pdfUrl: 'https://b/f1.pdf', pdfNomeArquivo: 'NF.pdf', clienteId: 'c1', contratoId: 'k1' },
  ])
  ;(prisma.documento.findMany as jest.Mock).mockResolvedValue([
    { id: 'd1', caminhoOriginal: 'https://b/d1.xlsx', nomeArquivo: 'med.xlsx', tipo: 'xlsx', clienteId: 'c2' },
  ])
  ;(prisma.documentoReferencia.findMany as jest.Mock).mockResolvedValue([
    { id: 'r1', titulo: 'Lei 14.133/2021', nomeArquivo: 'lei-14133.html', urlBlob: 'r2:referencias/r1-lei-14133.html' },
  ])
  ;(prisma.arquivoCliente.findMany as jest.Mock).mockResolvedValue([
    { id: 'a1', clienteId: 'c3', nome: 'Publicação DOC.pdf', extensao: 'pdf', urlBlob: 'r2:a1' },
  ])
  ;(prisma.propostaComercialArquivo.findMany as jest.Mock).mockResolvedValue([
    { id: 'p1', caminhoOriginal: 'https://b/p1.pdf', nomeArquivo: 'prop.pdf', tipo: 'pdf', conteudoExtraido: '<p>x</p>' },
  ])
})

it('junta as sete origens com cliente/contrato desnormalizados', async () => {
  const fontes = await listarFontes()
  expect(fontes).toEqual([
    { origem: 'HISTORICO_PROPOSTA', origemId: 'h1', url: 'https://b/h1-p.pdf', nomeArquivo: 'PC_031.pdf', tipo: 'pdf', clienteId: 'c1', contratoId: 'k1', textoPronto: null },
    { origem: 'HISTORICO_TERMO', origemId: 'h1', url: 'https://b/h1-t.pdf', nomeArquivo: 'TA_01.pdf', tipo: 'pdf', clienteId: 'c1', contratoId: 'k1', textoPronto: null },
    { origem: 'FATURAMENTO_PDF', origemId: 'f1', url: 'https://b/f1.pdf', nomeArquivo: 'NF.pdf', tipo: 'pdf', clienteId: 'c1', contratoId: 'k1', textoPronto: null },
    { origem: 'DOCUMENTO', origemId: 'd1', url: 'https://b/d1.xlsx', nomeArquivo: 'med.xlsx', tipo: 'xlsx', clienteId: 'c2', contratoId: null, textoPronto: null },
    { origem: 'PROPOSTA_COMERCIAL_ARQUIVO', origemId: 'p1', url: 'https://b/p1.pdf', nomeArquivo: 'prop.pdf', tipo: 'pdf', clienteId: null, contratoId: null, textoPronto: '<p>x</p>' },
    { origem: 'ARQUIVO_CLIENTE', origemId: 'a1', url: 'r2:a1', nomeArquivo: 'Publicação DOC.pdf', tipo: 'pdf', clienteId: 'c3', contratoId: null, textoPronto: null },
    { origem: 'REFERENCIA', origemId: 'r1', url: 'r2:referencias/r1-lei-14133.html', nomeArquivo: 'Lei 14.133/2021', tipo: 'html', clienteId: null, contratoId: null, textoPronto: null },
  ])
})

it('com clienteId filtra no banco e deixa proposta comercial (sem cliente) de fora', async () => {
  await listarFontes({ clienteId: 'c1' })
  expect((prisma.faturamento.findMany as jest.Mock).mock.calls[0][0].where).toMatchObject({ clienteId: 'c1' })
  expect((prisma.historicoContrato.findMany as jest.Mock).mock.calls[0][0].where).toMatchObject({ contrato: { clienteId: 'c1' } })
  expect(prisma.propostaComercialArquivo.findMany).not.toHaveBeenCalled()
  expect(prisma.documentoReferencia.findMany).not.toHaveBeenCalled()
})

it('ARQUIVO_CLIENTE: só ativo, legível, sem uso no histórico nem em Documento', async () => {
  await listarFontes({ clienteId: 'c3' })
  expect((prisma.arquivoCliente.findMany as jest.Mock).mock.calls[0][0].where).toEqual({
    removidoEm: null,
    extensao: { in: ['pdf', 'docx', 'xlsx', 'csv'] },
    linhasComoProposta: { none: {} },
    linhasComoTermo: { none: {} },
    documentos: { none: {} },
    clienteId: 'c3',
  })
})
