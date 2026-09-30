/** @jest-environment node */
jest.mock('@/lib/prisma', () => ({ prisma: {} }))
jest.mock('./leitura', () => ({ lerCalendario: jest.fn() }))

import type { ArquivoDaArea } from '@/lib/biblioteca/leitores'
import { criarLeitorDoCalendario } from './leitor'
import { lerCalendario } from './leitura'

/* eslint-disable @typescript-eslint/no-explicit-any */

const arq = (id: string, dias: number): ArquivoDaArea => ({
  id,
  nome: `Calendário de Faturamento PRODAM 2026 (${id}).pdf`,
  caminho: `CALENDÁRIO FATURAMENTO/${id}.pdf`,
  extensao: 'pdf',
  sha256: id,
  modificadoEm: new Date(Date.UTC(2026, 0, dias)),
})
const desenho = jest.fn(async () => ({ retangulos: [], textos: [] }))
const agora = () => new Date('2026-09-30T12:00:00Z')
const d = (dia: number) => new Date(Date.UTC(2026, 9, dia))

function prismaFake() {
  const tx = { calendarioFaturamento: { upsert: jest.fn(async () => ({ id: 'c2026' })) }, dataFaturamento: { deleteMany: jest.fn(), createMany: jest.fn() } }
  return {
    tx,
    $transaction: jest.fn(async (fn: any) => fn(tx)),
    calendarioFaturamento: { findMany: jest.fn(async () => []), deleteMany: jest.fn(async () => ({ count: 0 })) },
    arquivoBiblioteca: { updateMany: jest.fn() },
  }
}

it('grava o calendário do ano com as datas lidas; o PDF mais novo do ano fica por último (vale)', async () => {
  ;(lerCalendario as jest.Mock).mockReturnValue({
    ano: 2026,
    status: 'ok',
    avisos: [],
    datas: [{ inicio: d(8), fim: d(8), tipo: 'ENCERRAMENTO', descricao: 'Data de Encerramento do Faturamento' }],
  })
  const prisma = prismaFake()
  const linha = await criarLeitorDoCalendario({ desenho, agora })({
    prisma: prisma as any,
    todos: [arq('novo', 20), arq('velho', 2)],
    mudados: [],
    releitura: false,
    ler: async () => Buffer.from('pdf'),
  })
  expect(prisma.tx.calendarioFaturamento.upsert.mock.calls.map((c: any) => c[0].create.arquivoId)).toEqual(['velho', 'novo'])
  expect(prisma.tx.dataFaturamento.createMany).toHaveBeenLastCalledWith({
    data: [{ calendarioId: 'c2026', inicio: d(8), fim: d(8), tipo: 'ENCERRAMENTO', descricao: 'Data de Encerramento do Faturamento' }],
  })
  expect(linha).toContain('2026: prazos lidos com prova')
})

it('sem prova: grava só feriados e diz por quê', async () => {
  ;(lerCalendario as jest.Mock).mockReturnValue({ ano: 2026, status: 'so-feriados', avisos: ['mês 2026-3: 0 data(s) de encerramento'], datas: [] })
  const prisma = prismaFake()
  const linha = await criarLeitorDoCalendario({ desenho, agora })({ prisma: prisma as any, todos: [arq('a', 1)], mudados: [], releitura: false, ler: async () => Buffer.from('pdf') })
  expect(prisma.tx.dataFaturamento.createMany).not.toHaveBeenCalled()
  expect(linha).toContain('2026: só feriados (mês 2026-3: 0 data(s) de encerramento)')
})
