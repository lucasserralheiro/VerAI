/** @jest-environment node */
jest.mock('@/lib/prisma', () => ({ prisma: { cliente: { findMany: jest.fn() }, contrato: { findMany: jest.fn() } } }))
jest.mock('@/lib/visibilidade', () => ({ clienteIdsPermitidos: jest.fn() }))

import { prisma } from '@/lib/prisma'
import { clienteIdsPermitidos } from '@/lib/visibilidade'
import { identificarEntidades } from './entidades'

const usuario = { id: 'u', nome: 'U', email: 'u@x', role: 'responsavel' as const }
const CLIENTES = [
  { id: 'sms', nome: 'Secretaria Municipal da Saúde', siglaLegado: 'SMS' },
  { id: 'smsu', nome: 'Secretaria Municipal de Segurança Urbana', siglaLegado: 'SMSU' },
  { id: 'smsub', nome: 'Secretaria Municipal das Subprefeituras', siglaLegado: 'SMSUB' },
  { id: 'sf', nome: 'Secretaria Municipal da Fazenda', siglaLegado: 'SF' },
  { id: 'spcine', nome: 'Empresa de Cinema e Audiovisual de São Paulo - SPCine', siglaLegado: 'SPCINE' },
  { id: 'smit', nome: 'Secretaria Municipal de Inovação e Tecnologia', siglaLegado: 'SMIT' },
]
const CONTRATOS = [
  { id: 'k45', numeroTermo: 'TC 045/SMIT/2023', clienteId: 'smit' },
  { id: 'k13', numeroTermo: 'TC 13/SMIT/2024', clienteId: 'smit' },
  { id: 'k32', numeroTermo: '032/2025/SEHAB', clienteId: 'sms' },
  { id: 'k32b', numeroTermo: 'TC 32/2025', clienteId: 'smsu' },
]
type Filtro = { clienteId?: string | { in: string[] }; id?: { in: string[] } }
const casaCliente = (clienteId: string, f?: Filtro['clienteId']) => !f || (typeof f === 'string' ? clienteId === f : f.in.includes(clienteId))
const ids = async (pergunta: string, recentes: unknown[] = []) => {
  const r = await identificarEntidades({ pergunta, usuario, recentes })
  return { clientes: r.clientes.map((c) => c.id), contratos: r.contratos.map((c) => c.id) }
}

beforeEach(() => {
  jest.clearAllMocks()
  ;(clienteIdsPermitidos as jest.Mock).mockResolvedValue(null)
  ;(prisma.cliente.findMany as jest.Mock).mockImplementation(async ({ where }: { where: Filtro }) =>
    CLIENTES.filter((c) => !where?.id || where.id.in.includes(c.id))
  )
  ;(prisma.contrato.findMany as jest.Mock).mockImplementation(async ({ where }: { where: Filtro }) =>
    CONTRATOS.filter((c) => casaCliente(c.clienteId, where?.clienteId) && (!where?.id || where.id.in.includes(c.id)))
  )
})

it('SMS × SMSU × SMSUB por palavra inteira', async () => {
  expect((await ids('contratos do SMS')).clientes).toEqual(['sms'])
  expect((await ids('e o SMSU?')).clientes).toEqual(['smsu'])
  expect((await ids('smsub tem saldo?')).clientes).toEqual(['smsub'])
})

it('sigla curta só em maiúsculas', async () => {
  expect((await ids('faturamento da SF')).clientes).toEqual(['sf'])
  expect((await ids('sf é uma sigla?')).clientes).toEqual([])
})

it('apelido e nome sem acento', async () => {
  expect((await ids('contratos da spcine')).clientes).toEqual(['spcine'])
  expect((await ids('secretaria municipal de inovacao e tecnologia')).clientes).toEqual(['smit'])
})

it('dois clientes citados: nenhum entra', async () => {
  expect((await ids('compare SMS e SMIT')).clientes).toEqual([])
})

it('cliente sem permissão não entra', async () => {
  ;(clienteIdsPermitidos as jest.Mock).mockResolvedValue(['sms'])
  expect((await ids('fale do SMIT')).clientes).toEqual([])
})

it('contrato pela chave numérica: zero à esquerda e sigla no meio', async () => {
  expect((await ids('saldo do TC 45/SMIT/2023')).contratos).toEqual(['k45'])
  expect((await ids('o 13/2024 tem reajuste?')).contratos).toEqual(['k13'])
})

it('contrato ambíguo não entra; com cliente identificado, desempata', async () => {
  expect((await ids('o 32/2025')).contratos).toEqual([])
  expect((await ids('o 032/2025/SEHAB do SMS')).contratos).toEqual(['k32'])
})

it('número do cadastro com sufixo ("TC 105/2025/SMS/1/CONTRATOS") casa por número + ano', async () => {
  CONTRATOS.push({ id: 'k105', numeroTermo: 'TC 105/2025/SMS/1/CONTRATOS', clienteId: 'sms' })
  try {
    expect((await ids('e o 105/2025 da SMS?')).contratos).toEqual(['k105'])
  } finally {
    CONTRATOS.pop()
  }
})

it('SEI e data não viram contrato', async () => {
  expect((await ids('SEI 6018.2023/0122629-0 de 31/12/2026')).contratos).toEqual([])
})

it('memória: ids das últimas respostas, só os visíveis', async () => {
  ;(clienteIdsPermitidos as jest.Mock).mockResolvedValue(['smit'])
  const recentes = [
    [{ nome: 'detalheDoContrato', entrada: { contratoId: 'k45' } }],
    [{ nome: 'resumoDoCliente', entrada: { clienteId: 'smit' } }, { nome: 'x', entrada: { clienteId: 'sms' } }],
    null,
  ]
  expect(await ids('e quando ele vence?', recentes)).toEqual({ clientes: ['smit'], contratos: ['k45'] })
})

it('texto pronto para o contexto', async () => {
  const r = await identificarEntidades({ pergunta: 'saldo do TC 45/SMIT/2023 do SMIT', usuario, recentes: [] })
  expect(r.texto).toBe(
    'Já identificados (use estes ids, não procure de novo): cliente SMIT – Secretaria Municipal de Inovação e Tecnologia (clienteId: smit); contrato TC 045/SMIT/2023 (contratoId: k45).'
  )
  expect((await identificarEntidades({ pergunta: 'oi', usuario, recentes: [] })).texto).toBeNull()
})
