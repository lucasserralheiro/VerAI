/** @jest-environment node */
jest.mock('@/lib/prisma', () => ({ prisma: {} }))

import type { ArquivoDaArea } from '@/lib/biblioteca/leitores'
import { agruparPorVersao, criarLeitorDaTabela } from './leitor'

/* eslint-disable @typescript-eslint/no-explicit-any */

const arq = (id: string, nome: string): ArquivoDaArea => ({
  id,
  nome,
  caminho: `TABELA DE PREÇOS PRODAM-SP/${nome}`,
  extensao: nome.split('.').pop()!,
  sha256: id,
  modificadoEm: new Date(),
})
const PASTA = [
  arq('p', 'Memória de Cálculo 2026 v3.0.xlsx'),
  arq('t', 'Tabela de Preços PRODAM-SP 2026 v3.0.pdf'),
  arq('pub', 'Publicação DOC 21.09.2026.pdf'),
  arq('pubt', 'Publicação + Tabela (DOC 21.09.2026).pdf'),
  arq('i', 'INFORMATIVO Alterações Tabela de Preços v3.0.pdf'),
]

it('agrupa por versão: publicação sem "Tabela" no nome e informativo pelo número', () => {
  const [c, ...resto] = agruparPorVersao([...PASTA, arq('p2', 'Memória de Cálculo 2025 v7.0.xlsx')])
  expect(c.versao.versao).toBe('2026 v3.0')
  expect([c.planilha.id, c.pdf?.id, c.publicacao?.id, c.informativo?.id]).toEqual(['p', 't', 'pub', 'i'])
  expect(resto.map((x) => x.versao.versao)).toEqual(['2025 v7.0'])
  expect(resto[0].publicacao).toBeUndefined()
})

function prismaFake() {
  const tx = {
    tabelaPrecos: { upsert: jest.fn(async () => ({ id: 'tab1' })) },
    itemTabelaPrecos: { deleteMany: jest.fn(), createMany: jest.fn() },
  }
  return {
    tx,
    $transaction: jest.fn(async (fn: any) => fn(tx)),
    arquivoBiblioteca: { updateMany: jest.fn() },
  }
}

const lerPlanilha = jest.fn(async () => ({
  aba: 'Tabela',
  repetidos: [],
  itens: [
    { grupo: 'A', secoes: 'A - SISTEMAS', codigo: '10.050.00065.00', descricao: 'ANALISTA', unidade: 'HORA/HOMEM', preco: '269.00', sobDemanda: false, precoTexto: null },
    { grupo: 'E', secoes: 'E - DATA CENTER', codigo: '14.052.00001.00', descricao: 'TID CORPORATIVO', unidade: 'DOC', preco: '4.09', sobDemanda: false, precoTexto: null },
  ],
}))
const textoDoPdf = jest.fn(async (b: Buffer) =>
  b.toString() === 'pdf-tabela'
    ? '10.050.00065.00 ANALISTA HORA/HOMEM 269,00 14.052.00001.00 TID CORPORATIVO DOC 0,50'
    : 'Última Versão publicada: 2026 v3.0 Publicação no Diário Oficial: 21/09/2026 ALTERAÇÃO DE PREÇOS — TID Produto'
)
const ler = async (a: ArquivoDaArea) => Buffer.from(a.id === 't' ? 'pdf-tabela' : a.id === 'i' ? 'pdf-informativo' : 'xlsx')
const agora = () => new Date('2026-09-29T13:00:00Z')

it('grava a versão com os itens conferidos e devolve a linha do log', async () => {
  const prisma = prismaFake()
  const linha = await criarLeitorDaTabela({ lerPlanilha, textoDoPdf, agora })({ prisma: prisma as any, todos: PASTA, mudados: ['p'], releitura: false, ler })
  expect(linha).toBe('tabela de preços 2026 v3.0: 2 serviços · conferem 1 · alterados pelo informativo 1 · fora do PDF 0 · divergem 0')
  expect(prisma.tx.tabelaPrecos.upsert).toHaveBeenCalledWith(
    expect.objectContaining({
      where: { versao: '2026 v3.0' },
      update: expect.objectContaining({
        ordem: 20260300,
        publicadaEm: new Date(Date.UTC(2026, 8, 21)),
        arquivoPlanilhaId: 'p',
        arquivoPdfId: 't',
        arquivoPublicacaoId: 'pub',
        arquivoInformativoId: 'i',
        totalItens: 2,
        divergencias: 0,
      }),
    })
  )
  expect(prisma.tx.itemTabelaPrecos.deleteMany).toHaveBeenCalledWith({ where: { tabelaId: 'tab1' } })
  expect(prisma.tx.itemTabelaPrecos.createMany).toHaveBeenCalledWith({
    data: [
      expect.objectContaining({ tabelaId: 'tab1', posicao: 0, codigo: '10.050.00065.00', preco: '269.00', conferencia: 'confere', precoNoPdf: '269.00' }),
      expect.objectContaining({ tabelaId: 'tab1', posicao: 1, codigo: '14.052.00001.00', preco: '4.09', conferencia: 'alterado-pelo-informativo', precoNoPdf: '0.50' }),
    ],
  })
  expect(prisma.arquivoBiblioteca.updateMany).toHaveBeenCalledWith({
    where: { id: { in: ['p', 't', 'pub', 'i'] } },
    data: { leituraStatus: 'ok', leituraMensagem: null, lidoEm: agora() },
  })
})

it('sem planilha na pasta: avisa e não grava', async () => {
  const prisma = prismaFake()
  const linha = await criarLeitorDaTabela({ lerPlanilha, textoDoPdf, agora })({ prisma: prisma as any, todos: PASTA.slice(1), mudados: [], releitura: false, ler })
  expect(linha).toBe('tabela de preços: nenhuma "Memória de Cálculo <ano> v<n>.xlsx" na pasta — nada lido')
  expect(prisma.$transaction).not.toHaveBeenCalled()
})

it('planilha ilegível: marca o arquivo com erro e a versão anterior continua valendo', async () => {
  const prisma = prismaFake()
  const linha = await criarLeitorDaTabela({ lerPlanilha: async () => ({ erro: 'sem cabeçalho' }), textoDoPdf, agora })({
    prisma: prisma as any,
    todos: PASTA,
    mudados: ['p'],
    releitura: false,
    ler,
  })
  expect(linha).toBe('tabela de preços 2026 v3.0: planilha não lida — sem cabeçalho')
  expect(prisma.$transaction).not.toHaveBeenCalled()
  expect(prisma.arquivoBiblioteca.updateMany).toHaveBeenCalledWith({
    where: { id: { in: ['p'] } },
    data: { leituraStatus: 'erro', leituraMensagem: 'sem cabeçalho', lidoEm: agora() },
  })
})
