/** @jest-environment node */
jest.mock('@/lib/storage', () => ({ buildDocumentoPrefix: jest.fn(() => 'p/'), deleteUploadPrefix: jest.fn() }))
jest.mock('@/lib/prisma', () => {
  const modelos = [
    'notaFiscal', 'faturamento', 'historicoContrato', 'itemContrato', 'termoConfirmacao', 'tramiteDemanda',
    'demanda', 'solicitacao', 'notificacao', 'acessoDocumento', 'analise', 'analiseConsolidada', 'documento',
    'analiseEvolucao', 'acessoArquivo', 'arquivoCliente', 'contrato', 'indiceDocumento', 'responsavelCliente',
  ]
  const ordem: string[] = []
  const prisma: Record<string, unknown> = {
    __ordem: ordem,
    $transaction: jest.fn(),
    cliente: { delete: jest.fn(() => ordem.push('cliente')) },
  }
  for (const m of modelos) prisma[m] = { deleteMany: jest.fn(() => ordem.push(m)), findMany: jest.fn() }
  return { prisma }
})

import { prisma } from '@/lib/prisma'
import { deleteUploadPrefix } from '@/lib/storage'
import { excluirCliente, operacoesExcluirCliente } from './excluir-cliente'

const ordem = (prisma as unknown as { __ordem: string[] }).__ordem

beforeEach(() => {
  ordem.length = 0
  jest.clearAllMocks()
})

it('apaga repositório e índice do assistente também, e o cliente por último', () => {
  operacoesExcluirCliente('c1')
  expect(ordem).toEqual(expect.arrayContaining(['acessoArquivo', 'arquivoCliente', 'indiceDocumento']))
  expect(ordem.indexOf('documento')).toBeLessThan(ordem.indexOf('arquivoCliente'))
  expect(ordem.indexOf('acessoArquivo')).toBeLessThan(ordem.indexOf('arquivoCliente'))
  expect(ordem.indexOf('arquivoCliente')).toBeLessThan(ordem.indexOf('contrato'))
  expect(ordem.indexOf('faturamento')).toBeLessThan(ordem.indexOf('contrato'))
  expect(ordem[ordem.length - 1]).toBe('cliente')
})

it('roda numa transação e limpa os blobs dos documentos depois', async () => {
  ;(prisma.documento.findMany as jest.Mock).mockResolvedValue([{ id: 'd1', createdAt: new Date() }])
  await excluirCliente('c1')
  expect(prisma.$transaction).toHaveBeenCalledTimes(1)
  expect(deleteUploadPrefix).toHaveBeenCalledWith('p/')
})
