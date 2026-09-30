/** @jest-environment node */
jest.mock('@/lib/prisma', () => ({ prisma: {} }))

import type { ArquivoDaArea } from '@/lib/biblioteca/leitores'
import { acharContrato, criarLeitorDosControles, mapaDeContratos } from './leitor'
import type { LinhaPdf } from './leitura'

/* eslint-disable @typescript-eslint/no-explicit-any */

const arq = (id: string, nome: string, sha = id): ArquivoDaArea => ({
  id,
  nome,
  sha256: sha,
  extensao: 'pdf',
  modificadoEm: new Date(),
  caminho: `FATURAMENTO SERVIÇOS PRODAM/Controles de Contratos/08.2026/${nome}`,
})
const CGM = arq('a1', 'CGM - CO-16-CGM-2024 (Sust) - 2026.08.pdf')
const XYZ = arq('a2', 'XYZ - CO-99-2024 - 2026.08.pdf')
const L = (...textos: string[]): LinhaPdf => ({ pagina: 1, textos })
const linhasDoPdf = jest.fn(async () => [
  L('CO 16/CGM/2024 - T.A. 02 - Vigência: 15/10/2025 à 14/10/2026'),
  L('PREVISÃO DE FATURAMENTO'),
  L('MÊS 1', '100,00'),
  L('MÊS 2', '100,00'),
  L('TOTAL', '200,00'),
  L('FATURADO'),
  L('OUT/2025', '80,00'),
  L('NOV/2025', '0,00'),
  L('TOTAL', '80,00'),
])
const agora = () => new Date('2026-09-29T15:00:00Z')

function prismaFake(existentes: any[] = []) {
  const tx = {
    controleContrato: { upsert: jest.fn(async ({ create }: any) => ({ id: `c-${create.arquivoId}` })) },
    controleContratoLinha: { deleteMany: jest.fn(), createMany: jest.fn() },
  }
  return {
    tx,
    $transaction: jest.fn(async (fn: any) => fn(tx)),
    contrato: {
      findMany: jest.fn(async () => [
        { id: 'k-cgm', clienteId: 'cl-cgm', chaveSharepoint: 'CGM|16 2024', numeroTermo: 'TC 16/CGM/2024', cliente: { siglaLegado: 'CGM', nome: 'Controladoria Geral do Município' } },
      ]),
    },
    controleContrato: {
      findMany: jest.fn(async (args?: any) => (args?.where?.contratoId === null ? [] : existentes)),
      update: jest.fn(),
      deleteMany: jest.fn(async () => ({ count: 1 })),
    },
    arquivoBiblioteca: { updateMany: jest.fn() },
  }
}

beforeEach(() => linhasDoPdf.mockClear())

it('lê o que é novo, casa o contrato, grava totais e linhas conferidas', async () => {
  const prisma = prismaFake()
  const linha = await criarLeitorDosControles({ linhasDoPdf, agora })({
    prisma: prisma as any,
    todos: [CGM, XYZ],
    mudados: [],
    releitura: false,
    ler: async () => Buffer.from('pdf'),
  })
  expect(linha).toBe('controles de contratos: 2 lidos · previsto conferido 2 · faturado conferido 2 · sem contrato no VerAI 1 · removidos 1')
  expect(prisma.tx.controleContrato.upsert).toHaveBeenCalledWith(
    expect.objectContaining({
      where: { arquivoId: 'a1' },
      create: expect.objectContaining({
        arquivoId: 'a1',
        sha256: 'a1',
        mesAno: 2026,
        mesMes: 8,
        sigla: 'CGM',
        contratoId: 'k-cgm',
        clienteId: 'cl-cgm',
        termoTexto: 'T.A. 02',
        previstoTotal: '200.00',
        faturadoTotal: '80.00',
        previstoConferido: true,
        faturadoConferido: true,
      }),
    })
  )
  expect(prisma.tx.controleContratoLinha.createMany).toHaveBeenCalledWith({
    data: expect.arrayContaining([expect.objectContaining({ controleId: 'c-a1', tipo: 'faturado', posicao: 0, rotulo: 'OUT/2025', valor: '80.00' })]),
  })
  expect(prisma.controleContrato.deleteMany).toHaveBeenCalledWith({ where: { arquivoId: { notIn: ['a1', 'a2'] } } })
})

it('não relê o que já foi lido com o mesmo conteúdo, a não ser em --reler', async () => {
  const prisma = prismaFake([
    { arquivoId: 'a1', sha256: 'a1' },
    { arquivoId: 'a2', sha256: 'a2' },
  ])
  const entrada = { prisma: prisma as any, todos: [CGM, XYZ], mudados: [], ler: async () => Buffer.from('pdf') }
  await criarLeitorDosControles({ linhasDoPdf, agora })({ ...entrada, releitura: false })
  expect(linhasDoPdf).not.toHaveBeenCalled()
  await criarLeitorDosControles({ linhasDoPdf, agora })({ ...entrada, releitura: true })
  expect(linhasDoPdf).toHaveBeenCalledTimes(2)
})

describe('sigla do nome do arquivo escrita de outro jeito', () => {
  // Clientes e contratos reais (nomes do cadastro); o nº e ano do contrato decide, a sigla só desempata.
  const mapas = () =>
    mapaDeContratos({
      contrato: {
        findMany: async () => [
          { id: 'k-spurb', clienteId: 'c-spurb', chaveSharepoint: 'SPURBANISMO|16 2024', numeroTermo: 'TC 016/SP/URB/2024', cliente: { siglaLegado: 'SPURBANISMO', nome: 'São Paulo Urbanismo - SP Urbanismo' } },
          { id: 'k-guai', clienteId: 'c-guai', chaveSharepoint: 'SUB-GUAIANASES|3 2025', numeroTermo: 'TC 003/SUB-G/2025', cliente: { siglaLegado: 'SUB-GUAIANASES', nome: 'Subprefeitura Guaianases' } },
          { id: 'k-itp', clienteId: 'c-itp', chaveSharepoint: 'SUB-ITP|5 2025', numeroTermo: 'TC 005/SUB-ITP/2025', cliente: { siglaLegado: 'SUB-ITP', nome: 'Subprefeitura Itaim Paulista' } },
          { id: 'k-ici', clienteId: 'c-ici', chaveSharepoint: null, numeroTermo: 'TC SN/2024', cliente: { siglaLegado: 'ICI', nome: 'Instituto Curitiba de Informática' } },
          { id: 'k-smsub', clienteId: 'c-smsub', chaveSharepoint: 'SMSUB|11 2021', numeroTermo: 'TC 11/SMSUB/2021', cliente: { siglaLegado: 'SMSUB', nome: 'Secretaria Municipal das Subprefeituras' } },
          { id: 'k-smsu', clienteId: 'c-smsu', chaveSharepoint: 'SMSU|7 2022', numeroTermo: 'TC 007/SMSU/2022', cliente: { siglaLegado: 'SMSU', nome: 'Secretaria Municipal de Segurança Urbana' } },
        ],
      },
    } as any)

  it.each([
    ['SPURB - CO-16-2024 (Sustentação) - 2026.08.pdf', 'CO 16/2024', 'k-spurb'],
    ['SUB-Guainazes - CO-003-2025 - 2026.08.pdf', null, 'k-guai'],
    ['SUB-ITAIM - CO-005-2025 - 2026.08.pdf', null, 'k-itp'],
    ['ICI - CO-S.N-2024 - 2026.08.pdf', 'CO S.N/2024', 'k-ici'],
  ])('%s', async (nome, cabecalho, esperado) => {
    expect(acharContrato(nome, cabecalho, await mapas())?.id).toBe(esperado)
  })

  it('sigla que é de um cliente nunca procura em outro (SMSU sem o 11/2021 não pega o da SMSUB)', async () => {
    expect(acharContrato('SMSU - CO-11-2021 - 2026.08.pdf', null, await mapas())).toBeNull()
  })

  it('sigla desconhecida sem cliente compatível fica sem contrato', async () => {
    expect(acharContrato('SEGES - CO-24-2025 - 2026.08.pdf', null, await mapas())).toBeNull()
    expect(acharContrato('XPTO - CO-16-2024 - 2026.08.pdf', null, await mapas())).toBeNull()
  })
})

it('controle já lido sem contrato é religado sem reler o PDF', async () => {
  const prisma = prismaFake([{ arquivoId: 'a1', sha256: 'a1' }])
  prisma.controleContrato.findMany.mockImplementation(async (args?: any) =>
    args?.where?.contratoId === null ? [{ id: 'ctl-1', arquivoId: 'a1', contratoTexto: 'CO 16/CGM/2024' }] : [{ arquivoId: 'a1', sha256: 'a1' }]
  )
  const linha = await criarLeitorDosControles({ linhasDoPdf, agora })({
    prisma: prisma as any,
    todos: [CGM],
    mudados: [],
    releitura: false,
    ler: async () => Buffer.from('pdf'),
  })
  expect(linhasDoPdf).not.toHaveBeenCalled()
  expect(prisma.controleContrato.update).toHaveBeenCalledWith({ where: { id: 'ctl-1' }, data: { contratoId: 'k-cgm', clienteId: 'cl-cgm' } })
  expect(linha).toContain('religados 1')
})
