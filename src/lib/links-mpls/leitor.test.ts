/** @jest-environment node */
jest.mock('@/lib/prisma', () => ({ prisma: {} }))

import type { ArquivoDaArea } from '@/lib/biblioteca/leitores'
import { criarLeitorDosLinks } from './leitor'
import type { ItemPdf } from './leitura'

/* eslint-disable @typescript-eslint/no-explicit-any */

const pasta = 'FATURAMENTO SERVIÇOS PRODAM/Links MPLS - Relatórios para Faturamento/2026/2026.09 - Relatórios de Setembro de 2026'
const arq = (id: string, nome: string, categoria = 'Links Solução'): ArquivoDaArea => ({
  id,
  nome,
  sha256: id,
  extensao: 'pdf',
  modificadoEm: new Date(),
  caminho: `${pasta}/${categoria}/${nome}`,
})
const CGM = arq('a1', 'CGM 09-2026 - Links - TC 16-CGM -2024.pdf')
const I = (x: number, y: number, s: string): ItemPdf => ({ pagina: 1, x, y, s })
// Texto real do relatório da CGM de set/2026 (posições do PDF).
const itensCgm = [
  I(399, 564, 'LINKS - CGM'),
  I(760, 564, 'Setembro-2026'),
  I(292, 526, 'CONTRATO CGM Nº 16/CGM/2024 CONTRATOS'),
  I(338, 510, 'LINKS MPLS - SERVIÇO DE LINK'),
  I(386, 463, 'LINKS ATIVOS'),
  I(201, 404, 'Total Geral'),
  I(403, 404, '1'),
  I(57, 359, 'CÓD MPLS (ID)'),
  I(595, 359, 'Tipo'),
  I(678, 359, 'Endereço'),
  I(768, 359, 'Número'),
  I(411, 342, 'STIC - CONTROLADORIA GERAL DO MUNICÍPIO'),
  I(61, 337, 'V05604N/21'),
  I(127, 337, 'TC 16/CGM/2024'),
  I(217, 337, '16384'),
  I(256, 337, 'Sem redundância'),
  I(363, 337, '30-dez-21'),
  I(578, 337, 'RUA'),
  I(629, 337, 'LÍBERO BADARÓ'),
  I(777, 337, '293'),
  I(411, 331, '(BKP REDE AURA)'),
  I(681, 303, 'TOTAL ='),
  I(781, 303, '1'),
]
const itensDoPdf = jest.fn(async () => itensCgm)
const agora = () => new Date('2026-09-30T12:00:00Z')

function prismaFake(existentes: any[] = []) {
  const tx = {
    relatorioLinks: { upsert: jest.fn(async ({ create }: any) => ({ id: `r-${create.arquivoId}` })) },
    linkMpls: { deleteMany: jest.fn(), createMany: jest.fn() },
  }
  return {
    tx,
    $transaction: jest.fn(async (fn: any) => fn(tx)),
    contrato: {
      findMany: jest.fn(async () => [
        { id: 'k-cgm', clienteId: 'cl-cgm', chaveSharepoint: 'CGM|16 2024', numeroTermo: 'TC 16/CGM/2024', cliente: { siglaLegado: 'CGM', nome: 'Controladoria Geral do Município' } },
      ]),
    },
    relatorioLinks: {
      findMany: jest.fn(async (args?: any) => (args?.where?.contratoId === null ? [] : existentes)),
      update: jest.fn(),
      deleteMany: jest.fn(async () => ({ count: 0 })),
    },
    arquivoBiblioteca: { updateMany: jest.fn() },
  }
}

beforeEach(() => itensDoPdf.mockClear())

it('lê, confere pelos totais, casa o contrato e grava relatório e links', async () => {
  const prisma = prismaFake()
  const linha = await criarLeitorDosLinks({ itensDoPdf, agora })({ prisma: prisma as any, todos: [CGM], mudados: [], releitura: false, ler: async () => Buffer.from('pdf') })
  expect(linha).toBe('links MPLS: 1 lidos · conferidos 1 · sem contrato no VerAI 0 · removidos 0')
  expect(prisma.tx.relatorioLinks.upsert).toHaveBeenCalledWith(
    expect.objectContaining({
      create: expect.objectContaining({
        arquivoId: 'a1',
        ano: 2026,
        mes: 9,
        categoria: 'SOLUCAO',
        sigla: 'CGM',
        contratoTexto: '16/CGM/2024',
        contratoId: 'k-cgm',
        clienteId: 'cl-cgm',
        ativos: 1,
        cancelados: 0,
        conferido: true,
        avisos: [],
      }),
    })
  )
  expect(prisma.tx.linkMpls.createMany).toHaveBeenCalledWith({
    data: [
      expect.objectContaining({
        codigo: 'V05604N/21',
        situacao: 'ATIVO',
        kbps: 16384,
        redundancia: 'Sem redundância',
        dataAceite: new Date(Date.UTC(2021, 11, 30)),
        entidade: 'STIC - CONTROLADORIA GERAL DO MUNICÍPIO (BKP REDE AURA)',
        tipoLogradouro: 'RUA',
        endereco: 'LÍBERO BADARÓ',
        numero: '293',
      }),
    ],
  })
})

it('não fecha pela soma: grava o relatório sem links nem contagem; título de outro mês vira aviso', async () => {
  const prisma = prismaFake()
  itensDoPdf.mockResolvedValueOnce([...itensCgm.filter((i) => i.s !== 'Setembro-2026'), I(760, 564, 'Agosto-2026'), I(61, 320, 'V05605N/21')])
  await criarLeitorDosLinks({ itensDoPdf, agora })({ prisma: prisma as any, todos: [CGM], mudados: [], releitura: false, ler: async () => Buffer.from('pdf') })
  const dados = prisma.tx.relatorioLinks.upsert.mock.calls[0][0].create
  expect(dados).toMatchObject({ conferido: false, ativos: null, cancelados: null })
  expect(dados.avisos).toEqual(expect.arrayContaining(['título diz agosto/2026; a pasta é de setembro/2026']))
  expect(prisma.tx.linkMpls.createMany).not.toHaveBeenCalled()
})

it('não relê o mesmo conteúdo; religa relatório já lido sem contrato', async () => {
  const prisma = prismaFake([{ arquivoId: 'a1', sha256: 'a1' }])
  prisma.relatorioLinks.findMany.mockImplementation(async (args?: any) =>
    args?.where?.contratoId === null ? [{ id: 'r1', arquivoId: 'a1', contratoTexto: '16/CGM/2024' }] : [{ arquivoId: 'a1', sha256: 'a1' }]
  )
  const linha = await criarLeitorDosLinks({ itensDoPdf, agora })({ prisma: prisma as any, todos: [CGM], mudados: [], releitura: false, ler: async () => Buffer.from('pdf') })
  expect(itensDoPdf).not.toHaveBeenCalled()
  expect(prisma.relatorioLinks.update).toHaveBeenCalledWith({ where: { id: 'r1' }, data: { contratoId: 'k-cgm', clienteId: 'cl-cgm' } })
  expect(linha).toContain('religados 1')
})
