/** @jest-environment node */
jest.mock('@/lib/prisma', () => ({ prisma: {} }))

import type { ArquivoDaArea } from '@/lib/biblioteca/leitores'
import { criarLeitorDaPlanilha } from './leitor'

/* eslint-disable @typescript-eslint/no-explicit-any */

const arq = (id: string, nome = '2026.01 - Contratos Receita.xlsx'): ArquivoDaArea => ({
  id, nome, sha256: id, extensao: nome.split('.').pop()!, modificadoEm: new Date(), caminho: `PLANILHA DE CONTRATOS DE RECEITA PRODAM/${nome}`,
})
const lida = { linha: 4, sigla: 'CGM', contratoTexto: 'TC 16/CGM/2024', chave: 'CGM|16 2024', termoTexto: null, termoNumero: 0, tipoTermo: 'Contrato inicial', valor: '10.00', inicio: null, fim: null, statusFormalizacao: 'CONTRATAÇÃO CONCLUÍDA' }
const lerPlanilha = jest.fn(async () => ({ linhas: [lida, { ...lida, linha: 5 }] }))

function prismaFake(jaLidos: string[] = []) {
  const tx = { linhaPlanilhaContratos: { deleteMany: jest.fn(), createMany: jest.fn() } }
  return {
    tx,
    $transaction: jest.fn(async (fn: any) => fn(tx)),
    linhaPlanilhaContratos: {
      findMany: jest.fn(async () => jaLidos.map((arquivoId) => ({ arquivoId }))),
      deleteMany: jest.fn(async () => ({ count: 0 })),
    },
    arquivoBiblioteca: { updateMany: jest.fn() },
  }
}

beforeEach(() => lerPlanilha.mockClear())

it('troca as linhas do arquivo pelas lidas agora e apaga as de arquivo que saiu', async () => {
  const prisma = prismaFake()
  const linha = await criarLeitorDaPlanilha({ lerPlanilha, agora: () => new Date('2026-09-29T15:00:00Z') })({
    prisma: prisma as any, todos: [arq('x1'), arq('pdf', 'nota.pdf')], mudados: ['x1'], releitura: false, ler: async () => Buffer.from('x'),
  })
  expect(linha).toBe('planilha de contratos: 2 linhas de 1 arquivo(s)')
  expect(prisma.tx.linhaPlanilhaContratos.deleteMany).toHaveBeenCalledWith({ where: { arquivoId: 'x1' } })
  expect(prisma.tx.linhaPlanilhaContratos.createMany).toHaveBeenCalledWith({ data: [{ ...lida, arquivoId: 'x1' }, { ...lida, linha: 5, arquivoId: 'x1' }] })
  expect(prisma.linhaPlanilhaContratos.deleteMany).toHaveBeenCalledWith({ where: { arquivoId: { notIn: ['x1'] } } })
})

it('não relê arquivo já lido e sem mudança; relê em --reler', async () => {
  const prisma = prismaFake(['x1'])
  const entrada = { prisma: prisma as any, todos: [arq('x1')], mudados: [], ler: async () => Buffer.from('x') }
  await criarLeitorDaPlanilha({ lerPlanilha, agora: () => new Date() })({ ...entrada, releitura: false })
  expect(lerPlanilha).not.toHaveBeenCalled()
  await criarLeitorDaPlanilha({ lerPlanilha, agora: () => new Date() })({ ...entrada, releitura: true })
  expect(lerPlanilha).toHaveBeenCalledTimes(1)
})

it('planilha ilegível: marca o arquivo com erro e mantém as linhas anteriores', async () => {
  const prisma = prismaFake()
  const linha = await criarLeitorDaPlanilha({ lerPlanilha: async () => ({ erro: 'sem cabeçalho' }), agora: () => new Date() })({
    prisma: prisma as any, todos: [arq('x1')], mudados: ['x1'], releitura: false, ler: async () => Buffer.from('x'),
  })
  expect(linha).toBe('planilha de contratos: 0 linhas de 0 arquivo(s) · 2026.01 - Contratos Receita.xlsx: sem cabeçalho')
  expect(prisma.$transaction).not.toHaveBeenCalled()
})
