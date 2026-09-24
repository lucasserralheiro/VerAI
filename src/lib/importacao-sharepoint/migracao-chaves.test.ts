import type { PrismaClient } from '@prisma/client'
import { fundirComLegado, fundirLinhasDuplicadas, migrarChavesDeContrato } from './migracao-chaves'

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

it('antes da sincronização (sem referência ainda) reconhece o mesmo PDF pelo nome da cópia', async () => {
  const banco = db([], [
    linha({ id: 'h1', termoArquivoId: null, termoPdfNome: 'TC 52-SMIT-2024.pdf' }),
    linha({ id: 'h2', termoArquivoId: null, termoPdfNome: 'TC 52-SMIT-2024.pdf', valor: '100.00' }),
  ])
  expect((await fundirLinhasDuplicadas(banco as unknown as PrismaClient, { aplicar: true })).fundidas).toHaveLength(1)
})

it('contrato inicial é um só: duas linhas CONTRATO do SharePoint sem PDF se fundem (SUB-ITP em duas pastas)', async () => {
  const banco = db([], [linha({ id: 'h1', termoArquivoId: null }), linha({ id: 'h2', termoArquivoId: null })])
  expect((await fundirLinhasDuplicadas(banco as unknown as PrismaClient, { aplicar: true })).fundidas).toHaveLength(1)
})

it('contrato inicial com PDFs diferentes não funde — vai pra revisão', async () => {
  const banco = db([], [linha({ id: 'h1', termoArquivoId: 'a' }), linha({ id: 'h2', termoArquivoId: 'b' })])
  const r = await fundirLinhasDuplicadas(banco as unknown as PrismaClient, { aplicar: true })
  expect(r.fundidas).toEqual([])
  expect(r.revisar).toHaveLength(1)
})

it('mesmo número com PDF diferente não funde (SMDHC "TA 001" ×2)', async () => {
  const banco = db([], [linha({ id: 'h1', tipo: 'ADITIVO', numero: 'TA 001', termoArquivoId: 'a' }), linha({ id: 'h2', tipo: 'ADITIVO', numero: 'TA 001', termoArquivoId: 'b' })])
  expect((await fundirLinhasDuplicadas(banco as unknown as PrismaClient, { aplicar: true })).fundidas).toEqual([])
})

describe('fundirComLegado', () => {
  const sp = { id: 'k-sp', clienteId: 'c1', numeroTermo: 'TC 105/2025/SMS/1/CONTRATOS', chaveSharepoint: 'SMS|105 2025', legacyId: null, descricao: 'E-SAÚDE', seiCliente: null, seiProdam: null, dataInicio: null, dataVencimento: null, situacao: null, _count: { itens: 0, faturamentos: 0, termosConfirmacao: 0 } }
  const legado = { id: 'k-leg', clienteId: 'c1', numeroTermo: 'TC 105/2025/SMS-1/CONTRATOS', chaveSharepoint: null, legacyId: 9, descricao: null, seiCliente: '6018.2025/1', seiProdam: null, dataInicio: null, dataVencimento: null, situacao: 'Ativo', _count: { itens: 0, faturamentos: 9, termosConfirmacao: 0 } }

  function banco(contratos: object[]) {
    const b: any = db([])
    b.contrato.findMany = jest.fn(async ({ where }: any) => contratos.filter((c: any) => (where.chaveSharepoint?.not === null ? c.chaveSharepoint !== null : c.chaveSharepoint === null)))
    return b
  }

  it('cópia criada pelo SharePoint vai pro contrato do legado com o mesmo número e ano (SMS TC 105/2025)', async () => {
    const b = banco([sp, legado])
    const r = await fundirComLegado(b as unknown as PrismaClient, { aplicar: true })
    expect(r.fundidos).toEqual(['SMS|105 2025 → TC 105/2025/SMS-1/CONTRATOS'])
    expect(b.historicoContrato.updateMany).toHaveBeenCalledWith({ where: { contratoId: 'k-sp' }, data: { contratoId: 'k-leg' } })
    expect(b.arquivoSharepoint.updateMany).toHaveBeenCalledWith({ where: { contratoId: 'k-sp' }, data: { contratoId: 'k-leg' } })
    expect(b.contrato.delete).toHaveBeenCalledWith({ where: { id: 'k-sp' } })
    expect(b.contrato.update).toHaveBeenCalledWith({ where: { id: 'k-leg' }, data: { descricao: 'E-SAÚDE', chaveSharepoint: 'SMS|105 2025' } })
  })

  it('dois contratos do legado com o mesmo número (SEGES TC 024/2025): não mexe, vai pra revisão', async () => {
    const b = banco([{ ...sp, chaveSharepoint: 'SEGES|24 2025', numeroTermo: 'TC 024/SEGES/2025' }, { ...legado, numeroTermo: 'TC 024/2025 - SEGES' }, { ...legado, id: 'k-leg2', numeroTermo: 'TC 024/2025' }])
    const r = await fundirComLegado(b as unknown as PrismaClient, { aplicar: true })
    expect(r.fundidos).toEqual([])
    expect(r.revisar).toHaveLength(1)
    expect(b.contrato.delete).not.toHaveBeenCalled()
  })
})

it('contrato inicial do legado + o do SharePoint no mesmo contrato: fica a do legado, a do SharePoint sai com os PDFs passados', async () => {
  const banco = db([], [
    linha({ id: 'h-leg', chaveSharepoint: null, legacyId: 5, termoArquivoId: null, valor: '212974949.70' }),
    linha({ id: 'h-sp', chaveSharepoint: 'SMS|105 2025|SMS/TC 105/1) Inicial', legacyId: null, termoArquivoId: 'a-tc', propostaArquivoId: 'a-pc' }),
  ])
  const r = await fundirLinhasDuplicadas(banco as unknown as PrismaClient, { aplicar: true })
  expect(r.fundidas).toHaveLength(1)
  expect(banco.historicoContrato.delete).toHaveBeenCalledWith({ where: { id: 'h-sp' } })
  expect(banco.historicoContrato.update).toHaveBeenCalledWith({
    where: { id: 'h-leg' },
    data: expect.objectContaining({ termoArquivoId: 'a-tc', propostaArquivoId: 'a-pc', chaveSharepoint: 'SMS|105 2025|SMS/TC 105/1) Inicial' }),
  })
})
