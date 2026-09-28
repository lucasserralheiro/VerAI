/** @jest-environment node */
jest.mock('@/lib/prisma', () => ({
  prisma: {
    documento: { findMany: jest.fn(async () => []) },
    historicoContrato: { findMany: jest.fn() },
    arquivoSharepoint: { findMany: jest.fn() },
    propostaComercialArquivo: { findMany: jest.fn(async () => []) },
  },
}))

import { prisma } from '@/lib/prisma'
import { usosDosArquivos } from './servico'

const contrato = { id: 'k1', numeroTermo: 'TC 211/2022', clienteId: 'c1' }

it('coluna PC/PA–TC/TA da linha e lugar no SharePoint viram usos com contrato', async () => {
  ;(prisma.historicoContrato.findMany as jest.Mock).mockResolvedValue([
    { id: 'h1', tipo: 'ADITIVO', numero: 'TA 01', propostaArquivoId: null, termoArquivoId: 'a1', propostaDoSharepoint: false, termoDoSharepoint: true, contrato },
  ])
  ;(prisma.arquivoSharepoint.findMany as jest.Mock).mockResolvedValue([
    { arquivoId: 'a1', caminho: 'SMSUB/TC 211/2) TA 01/TA 01.pdf', contrato, arquivo: { clienteId: 'c1' } },
    { arquivoId: 'a2', caminho: '1. PUBLICAÇÕES NO DOC/2026.09.14 - SMSUB - Despacho.pdf', contrato: null, arquivo: { clienteId: 'c1' } },
  ])
  const usos = await usosDosArquivos(['a1', 'a2'])
  expect(usos.get('a1')).toEqual([
    {
      tipo: 'historico-contrato',
      rotulo: 'Contrato TC 211/2022 · TC/TA de TA 01',
      href: '/clientes/c1/contratos/k1',
      contrato: { id: 'k1', numeroTermo: 'TC 211/2022' },
      competencia: null,
      daSincronizacao: true,
      coluna: 'termo',
    },
    {
      tipo: 'sharepoint',
      rotulo: 'SharePoint · SMSUB/TC 211/2) TA 01/TA 01.pdf',
      href: '/clientes/c1/contratos/k1',
      contrato: { id: 'k1', numeroTermo: 'TC 211/2022' },
      competencia: null,
      daSincronizacao: true,
    },
  ])
  expect(usos.get('a2')).toEqual([
    {
      tipo: 'sharepoint',
      rotulo: 'SharePoint · 1. PUBLICAÇÕES NO DOC/2026.09.14 - SMSUB - Despacho.pdf',
      href: '/clientes/c1',
      contrato: null,
      competencia: null,
      daSincronizacao: true,
    },
  ])
  expect((prisma.arquivoSharepoint.findMany as jest.Mock).mock.calls[0][0].where).toEqual({ arquivoId: { in: ['a1', 'a2'] }, removidoNaOrigemEm: null })
})

it('conversão em Markdown (Proposta Comercial) feita a partir do arquivo vira uso sem contrato', async () => {
  ;(prisma.historicoContrato.findMany as jest.Mock).mockResolvedValue([])
  ;(prisma.arquivoSharepoint.findMany as jest.Mock).mockResolvedValue([])
  ;(prisma.propostaComercialArquivo.findMany as jest.Mock).mockResolvedValue([{ arquivoClienteId: 'a1', propostaId: 'p1' }])
  const usos = await usosDosArquivos(['a1'])
  expect(usos.get('a1')).toEqual([
    {
      tipo: 'conversao-markdown',
      rotulo: 'Conversão em Markdown',
      href: '/propostas-comerciais/p1',
      contrato: null,
      competencia: null,
    },
  ])
})
