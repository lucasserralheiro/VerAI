/** @jest-environment node */
jest.mock('@/lib/prisma', () => ({ prisma: {} }))
jest.mock('@/lib/arquivos/registrar-conteudo', () => ({ registrarConteudo: jest.fn() }))
jest.mock('@/lib/storage', () => ({ putUpload: jest.fn(), deleteUpload: jest.fn(), getUpload: jest.fn() }))

import type { PrismaClient } from '@prisma/client'
import { registrarConteudo } from '@/lib/arquivos/registrar-conteudo'
import { apagarCopiasMigradas, migrarAnexosParaReferencia } from './migracao-anexos'

const linha = (extra: object) => ({
  id: 'h1', tipo: 'CONTRATO', chaveSharepoint: 'SMS|1 2023|SMS/TC 1/1) Inicial',
  propostaPdfUrl: null, propostaPdfNome: null, propostaArquivoId: null,
  termoPdfUrl: 'https://blob/historico-contrato/h1/termo.pdf', termoPdfNome: 'TC 1-2023.pdf', termoArquivoId: null,
  contrato: { clienteId: 'c1' },
  ...extra,
})

function db(linhas: object[], pendentes = 0) {
  return {
    historicoContrato: {
      findMany: jest.fn(async () => linhas),
      update: jest.fn(async () => ({})),
      count: jest.fn(async () => pendentes),
    },
  }
}

beforeEach(() => jest.clearAllMocks())

it('baixa a cópia, registra no repositório do cliente e grava a referência (linha do SharePoint → acompanha o SharePoint)', async () => {
  const banco = db([linha({})])
  ;(registrarConteudo as jest.Mock).mockResolvedValue({ id: 'a1', novo: true })
  const baixar = jest.fn(async () => Buffer.from('%PDF'))
  const r = await migrarAnexosParaReferencia(banco as unknown as PrismaClient, { aplicar: true, baixar })
  expect(baixar).toHaveBeenCalledWith('https://blob/historico-contrato/h1/termo.pdf')
  expect((registrarConteudo as jest.Mock).mock.calls[0][1]).toMatchObject({ clienteId: 'c1', nome: 'TC 1-2023.pdf', categoria: 'TERMO_CONTRATO', origem: 'migrado', enviadoPorId: null })
  expect(banco.historicoContrato.update).toHaveBeenCalledWith({ where: { id: 'h1' }, data: { termoArquivoId: 'a1', termoDoSharepoint: true } })
  expect(r).toEqual({ referenciados: 1, novosNoRepositorio: 1, reaproveitados: 0, falhas: [] })
})

it('linha sem chave do SharePoint é anexo à mão', async () => {
  const banco = db([linha({ chaveSharepoint: null })])
  ;(registrarConteudo as jest.Mock).mockResolvedValue({ id: 'a1', novo: false })
  await migrarAnexosParaReferencia(banco as unknown as PrismaClient, { aplicar: true, baixar: async () => Buffer.from('x') })
  expect((banco.historicoContrato.update.mock.calls[0] as unknown[])[0]).toMatchObject({ data: { termoArquivoId: 'a1', termoDoSharepoint: false } })
})

it('sem --aplicar só conta; falha de download vai pro relatório', async () => {
  const banco = db([linha({}), linha({ id: 'h2' })])
  const baixar = jest.fn().mockResolvedValueOnce(Buffer.from('x')).mockRejectedValueOnce(new Error('404'))
  const r = await migrarAnexosParaReferencia(banco as unknown as PrismaClient, { aplicar: false, baixar })
  expect(r.referenciados).toBe(1)
  expect(r.falhas).toEqual([{ linhaId: 'h2', coluna: 'termo', motivo: '404' }])
  expect(registrarConteudo).not.toHaveBeenCalled()
  expect(banco.historicoContrato.update).not.toHaveBeenCalled()
})

it('apagar cópias: recusa enquanto houver linha sem referência', async () => {
  await expect(apagarCopiasMigradas(db([], 2) as unknown as PrismaClient, { aplicar: true })).rejects.toThrow(/2 linha/)
})

it('apagar cópias: apaga o blob antigo e limpa as colunas de URL', async () => {
  const banco = db([linha({ termoArquivoId: 'a1' })])
  const apagarBlob = jest.fn(async () => {})
  expect(await apagarCopiasMigradas(banco as unknown as PrismaClient, { aplicar: true, apagarBlob })).toEqual({ apagadas: 1 })
  expect(apagarBlob).toHaveBeenCalledWith('https://blob/historico-contrato/h1/termo.pdf')
  expect(banco.historicoContrato.update).toHaveBeenCalledWith({ where: { id: 'h1' }, data: { termoPdfUrl: null, termoPdfNome: null } })
})
