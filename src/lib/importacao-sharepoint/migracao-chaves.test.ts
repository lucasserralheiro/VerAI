import type { PrismaClient } from '@prisma/client'
import { fundirLinhasDuplicadas, migrarChavesDeContrato } from './migracao-chaves'

/* eslint-disable @typescript-eslint/no-explicit-any */

const contrato = (c: object) => ({
  id: 'k1', chaveSharepoint: 'SUB-ITP|1 2026', createdAt: new Date('2026-09-23T10:00:00Z'),
  numeroTermo: 'TC 001/SUB/IT/2026', descricao: null, seiCliente: null, seiProdam: null, dataInicio: null, dataVencimento: null, situacao: null,
  cliente: { siglaLegado: 'SUB-ITP' }, _count: { itens: 0, faturamentos: 0, termosConfirmacao: 0 }, ...c,
})

function db(contratos: object[], linhas: object[] = []) {
  const banco: any = {
    contrato: { findMany: jest.fn(async () => contratos), update: jest.fn(), delete: jest.fn() },
    historicoContrato: { findMany: jest.fn(async () => linhas), updateMany: jest.fn(), update: jest.fn(), delete: jest.fn() },
    arquivoSharepoint: { updateMany: jest.fn() },
    $transaction: jest.fn(async (ops: unknown[]) => ops),
  }
  return banco
}

it('chave pela sigla; duas pastas do mesmo cliente → funde no que já tem a chave nova', async () => {
  const banco = db([
    contrato({ id: 'k1', chaveSharepoint: 'SUB-ITP|1 2026' }),
    contrato({ id: 'k2', chaveSharepoint: 'SUB-ITAM PAULISTA|1 2026', descricao: 'Office 365' }),
  ])
  const r = await migrarChavesDeContrato(banco as unknown as PrismaClient, { aplicar: true })
  expect(r.fundidos).toEqual(['SUB-ITAM PAULISTA|1 2026 → SUB-ITP|1 2026'])
  expect(banco.contrato.update).toHaveBeenCalledWith({ where: { id: 'k1' }, data: { descricao: 'Office 365' } })
  expect(banco.historicoContrato.updateMany).toHaveBeenCalledWith({ where: { contratoId: 'k2' }, data: { contratoId: 'k1' } })
  expect(banco.contrato.delete).toHaveBeenCalledWith({ where: { id: 'k2' } })
})

it('só renomeia a chave quando não há colisão', async () => {
  const banco = db([contrato({ id: 'k3', chaveSharepoint: 'SGM - CASA CIVIL|8 2026', cliente: { siglaLegado: 'SGM' } })])
  const r = await migrarChavesDeContrato(banco as unknown as PrismaClient, { aplicar: true })
  expect(r.renomeados).toBe(1)
  expect(banco.contrato.update).toHaveBeenCalledWith({ where: { id: 'k3' }, data: { chaveSharepoint: 'SGM|8 2026' } })
})

it('duplicado com item, faturamento ou termo não é fundido — vai pra revisão', async () => {
  const banco = db([
    contrato({ id: 'k1' }),
    contrato({ id: 'k2', chaveSharepoint: 'SUB-ITAM PAULISTA|1 2026', _count: { itens: 2, faturamentos: 0, termosConfirmacao: 0 } }),
  ])
  const r = await migrarChavesDeContrato(banco as unknown as PrismaClient, { aplicar: true })
  expect(r.revisar).toHaveLength(1)
  expect(banco.contrato.delete).not.toHaveBeenCalled()
})

const linha = (l: object) => ({
  id: 'h1', contratoId: 'k1', tipo: 'CONTRATO', createdAt: new Date(), chaveSharepoint: 'x',
  numero: 'TC 52/SMIT/2024', data: null, valor: null, objeto: null, proposta: null, situacao: null, dataInicio: null, dataVencimento: null, dataEnvio: null, observacao: null,
  propostaArquivoId: null, termoArquivoId: 'a52', propostaDoSharepoint: false, termoDoSharepoint: true, ...l,
})

it('linhas do mesmo termo com o mesmo PDF: funde na mais completa (SMIT TC 52)', async () => {
  const banco = db([], [linha({ id: 'h1' }), linha({ id: 'h2', valor: '100.00', propostaArquivoId: 'apc' })])
  const r = await fundirLinhasDuplicadas(banco as unknown as PrismaClient, { aplicar: true })
  expect(r.fundidas).toHaveLength(1)
  expect(banco.arquivoSharepoint.updateMany).toHaveBeenCalledWith({ where: { historicoId: 'h1' }, data: { historicoId: 'h2' } })
  expect(banco.historicoContrato.delete).toHaveBeenCalledWith({ where: { id: 'h1' } })
})

it('mesmo número com PDF diferente não funde (SMDHC "TA 001" ×2)', async () => {
  const banco = db([], [linha({ id: 'h1', tipo: 'ADITIVO', numero: 'TA 001', termoArquivoId: 'a' }), linha({ id: 'h2', tipo: 'ADITIVO', numero: 'TA 001', termoArquivoId: 'b' })])
  expect((await fundirLinhasDuplicadas(banco as unknown as PrismaClient, { aplicar: true })).fundidas).toEqual([])
})
