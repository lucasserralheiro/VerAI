/** @jest-environment node */
jest.mock('@/lib/prisma', () => ({ prisma: {} }))
jest.mock('@/lib/relatorios-clientes/vincular-itens', () => ({
  ...jest.requireActual('@/lib/relatorios-clientes/vincular-itens'),
  vincularItensOrfaos: jest.fn(async () => ({ vinculados: 0, ambiguos: 0, semCorrespondencia: 0 })),
}))

import type { PrismaClient } from '@prisma/client'
import { importarContratos, type ContratoLido, type TermoLido } from './importar'

const clientes = new Map([['SMSUB', { id: 'c1', nome: 'Subprefeituras' }]])

function termo(t: Partial<TermoLido> & Pick<TermoLido, 'pasta'>): TermoLido {
  return {
    chave: `SMSUB|211 2022|${t.pasta}`, ordem: 1, tipo: 'CONTRATO', numero: null, rotulo: '', meses: null, aviso: null,
    termoPdf: null, propostaPdf: null, outros: [], arquivos: [], campos: null, hashes: [], ...t,
  }
}

function contrato(termos: TermoLido[], extra: Partial<ContratoLido> = {}): ContratoLido {
  return { chave: 'SMSUB|211 2022', pastaCliente: 'SMSUB', numeroTermo: 'TC 211/2022', descricao: 'Acesso à Rede', finalizado: false, tambemEmFinalizados: false, pastas: [], termos, ...extra }
}

type Estado = { contrato?: unknown; linhas?: unknown[] }

function db(estado: Estado = {}) {
  let n = 0
  return {
    contrato: {
      findUnique: jest.fn(async () => estado.contrato ?? null),
      findMany: jest.fn(async () => []),
      create: jest.fn(async () => ({ id: 'k-novo' })),
      update: jest.fn(),
    },
    historicoContrato: {
      findMany: jest.fn(async () => estado.linhas ?? []),
      create: jest.fn(async () => ({ id: `h-novo-${++n}` })),
      update: jest.fn(),
    },
  }
}

const linhaDb = (l: object) => ({
  id: 'h1', tipo: 'CONTRATO', numero: 'TC 211/2022', data: null, valor: null, objeto: null, proposta: null, situacao: null,
  dataInicio: null, dataVencimento: null, chaveSharepoint: null,
  propostaArquivoId: null, propostaDoSharepoint: false, termoArquivoId: null, termoDoSharepoint: false,
  propostaArquivo: null, termoArquivo: null, arquivosSharepoint: [], ...l,
})

const inicial = 'SMSUB/TC 211/1) TC 211-SMSUB-COGEL-2022'
const arquivos = new Map([
  [`${inicial}/TC 211.pdf`, 'a-termo'],
  [`${inicial}/PC-SMSUB.pdf`, 'a-pc'],
  [`${inicial}/WORK/Mem_Calc.xlsx`, 'a-work'],
])
const termoInicial = termo({
  pasta: inicial,
  termoPdf: `${inicial}/TC 211.pdf`,
  propostaPdf: `${inicial}/PC-SMSUB.pdf`,
  arquivos: [...arquivos.keys()],
  hashes: ['h-termo', 'h-pc', 'h-work'],
})

it('contrato novo: cria contrato e linha, liga PC/PA e TC/TA por referência (do SharePoint) e diz onde cada arquivo caiu', async () => {
  const banco = db()
  const r = await importarContratos(banco as unknown as PrismaClient, { aplicar: true, contratos: [contrato([termoInicial])], clientes, arquivoIdPorCaminho: arquivos })
  expect(r).toMatchObject({ contratosCriados: 1, linhasCriadas: 1, anexosLigados: 2 })
  expect(banco.historicoContrato.update).toHaveBeenCalledWith({ where: { id: 'h-novo-1' }, data: { propostaArquivoId: 'a-pc', propostaDoSharepoint: true } })
  expect(banco.historicoContrato.update).toHaveBeenCalledWith({ where: { id: 'h-novo-1' }, data: { termoArquivoId: 'a-termo', termoDoSharepoint: true } })
  expect(r.linhaPorCaminho.get(`${inicial}/WORK/Mem_Calc.xlsx`)).toBe('h-novo-1')
  expect(r.contratoPorCaminho.get(`${inicial}/WORK/Mem_Calc.xlsx`)).toBe('k-novo')
})

it('termo já conhecido: não cria linha; PDF trocado no SharePoint troca a coluna do SharePoint', async () => {
  const banco = db({
    contrato: { id: 'k1', chaveSharepoint: 'SMSUB|211 2022', situacao: null },
    linhas: [linhaDb({ termoArquivoId: 'a-velho', termoDoSharepoint: true, arquivosSharepoint: [{ caminho: `${inicial}/PC-SMSUB.pdf`, sha256: 'h-pc' }] })],
  })
  const r = await importarContratos(banco as unknown as PrismaClient, { aplicar: true, contratos: [contrato([termoInicial])], clientes, arquivoIdPorCaminho: arquivos })
  expect(r.linhasCriadas).toBe(0)
  expect(banco.historicoContrato.update).toHaveBeenCalledWith({ where: { id: 'h1' }, data: { termoArquivoId: 'a-termo', termoDoSharepoint: true } })
})

it('coluna anexada à mão nunca é trocada — vira aviso', async () => {
  const banco = db({
    contrato: { id: 'k1', chaveSharepoint: 'SMSUB|211 2022', situacao: null },
    linhas: [linhaDb({ termoArquivoId: 'a-mao', termoDoSharepoint: false })],
  })
  const r = await importarContratos(banco as unknown as PrismaClient, { aplicar: true, contratos: [contrato([termoInicial])], clientes, arquivoIdPorCaminho: arquivos })
  expect(banco.historicoContrato.update).not.toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ termoArquivoId: 'a-termo' }) }))
  expect(r.avisos.join('\n')).toMatch(/anexado à mão/)
})

it('marcadores da própria importação ("TA XX", "Em elaboração") são trocados quando o termo fica pronto', async () => {
  const pastaTa = 'SMSUB/TC 211/3) TC 211 - TA 03 - Redução'
  const banco = db({
    contrato: { id: 'k1', chaveSharepoint: 'SMSUB|211 2022', situacao: null },
    linhas: [linhaDb({ id: 'hx', tipo: 'ADITIVO', numero: 'TA XX', situacao: 'Em elaboração', arquivosSharepoint: [{ caminho: 'SMSUB/TC 211/3) TC 211 - TA XX - Redução/PA.pdf', sha256: 'h-pa' }] })],
  })
  const ta = termo({
    pasta: pastaTa, tipo: 'ADITIVO', numero: 'TA 03', chave: `SMSUB|211 2022|${pastaTa}`,
    arquivos: [`${pastaTa}/PA.pdf`, `${pastaTa}/TA 03 assinado.pdf`], hashes: ['h-pa', 'h-ta'],
    campos: { numeroDocumento: null, seiCliente: null, seiProdam: null, contratante: null, objeto: null, valor: null, assinaturaEm: new Date('2026-09-01T12:00:00Z'), inicio: null, fim: null, meses: null, inicioNaAssinatura: false, prorrogaVigencia: false, semTexto: false },
  })
  await importarContratos(banco as unknown as PrismaClient, { aplicar: true, contratos: [contrato([ta])], clientes, arquivoIdPorCaminho: new Map() })
  const data = (banco.historicoContrato.update as jest.Mock).mock.calls[0][0].data
  expect(data).toMatchObject({ numero: 'TA 03', situacao: null })
})

it('"Finalizado" gravado pela importação sai quando o contrato tem pasta ativa no SharePoint (com aviso)', async () => {
  const banco = db({ contrato: { id: 'k1', chaveSharepoint: 'SMSUB|211 2022', situacao: 'Finalizado', legacyId: null }, linhas: [linhaDb({})] })
  const r = await importarContratos(banco as unknown as PrismaClient, { aplicar: true, contratos: [contrato([termoInicial])], clientes, arquivoIdPorCaminho: arquivos })
  expect((banco.contrato.update as jest.Mock).mock.calls[0][0].data).toMatchObject({ situacao: null })
  expect(r.avisos.join('\n')).toMatch(/pasta ativa/)
})

it('"Finalizado" de contrato do legado (GRC-1) não é mexido — só aviso', async () => {
  const banco = db({ contrato: { id: 'k1', chaveSharepoint: 'SMSUB|211 2022', situacao: 'Finalizado', legacyId: 77 }, linhas: [linhaDb({})] })
  const r = await importarContratos(banco as unknown as PrismaClient, { aplicar: true, contratos: [contrato([termoInicial])], clientes, arquivoIdPorCaminho: arquivos })
  const dados = (banco.contrato.update as jest.Mock).mock.calls.map((c) => c[0].data)
  expect(dados.every((d) => !('situacao' in d))).toBe(true)
  expect(r.avisos.join('\n')).toMatch(/pasta ativa/)
})

it('contrato que aparece em ativos e em finalizados gera aviso pra arrumar a pasta', async () => {
  const banco = db()
  const r = await importarContratos(banco as unknown as PrismaClient, { aplicar: true, contratos: [contrato([termoInicial], { tambemEmFinalizados: true })], clientes, arquivoIdPorCaminho: arquivos })
  expect(r.avisos.join('\n')).toMatch(/também aparece em "Contratos Finalizados"/)
})
