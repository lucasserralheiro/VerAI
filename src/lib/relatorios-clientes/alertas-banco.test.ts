/** @jest-environment node */
jest.mock('@/lib/prisma', () => ({
  prisma: {
    contrato: { findMany: jest.fn() },
    faturamento: { findMany: jest.fn() },
    indiceDocumento: { findMany: jest.fn() },
  },
}))
jest.mock('./contratos-consolidados', () => ({ consolidarContratos: jest.fn() }))
jest.mock('@/lib/importacao-sharepoint/auditoria-banco', () => ({ auditarNoBanco: jest.fn() }))

import { prisma } from '@/lib/prisma'
import { consolidarContratos } from './contratos-consolidados'
import { auditarNoBanco } from '@/lib/importacao-sharepoint/auditoria-banco'
import { alertasDaAuditoria, alertasDosContratos } from './alertas-banco'

const hoje = new Date('2026-09-26T15:00:00Z')
const consolidado = (over = {}) => ({
  ativo: true, rescindido: false, vazio: false, vigenciaFim: new Date('2027-12-31T00:00:00Z'), vencimento: { nivel: 'ok', dias: 461 },
  situacaoDesatualizada: false, prorrogacaoEmAndamento: false, valorBase: '1000', saldo: { valorItens: '0', faturado: '0', saldo: '1000', percentualFaturado: '0' },
  ...over,
})

beforeEach(() => {
  jest.clearAllMocks()
  ;(prisma.contrato.findMany as jest.Mock).mockResolvedValue([
    {
      id: 'k1', clienteId: 'c1', numeroTermo: 'TC 45/SMIT/2023', situacao: 'Ativo', dataVencimento: null, cliente: { siglaLegado: 'SMIT', nome: 'Secretaria X' },
      historico: [
        { id: 'h1', tipo: 'CONTRATO', data: null, situacao: null, termoArquivoId: 'a1' },
        { id: 'h2', tipo: 'ADITIVO', data: new Date('2025-01-01'), situacao: null, termoArquivoId: null },
        { id: 'h3', tipo: 'ADITIVO', data: null, situacao: 'Em elaboração', termoArquivoId: null },
      ],
    },
  ])
  ;(consolidarContratos as jest.Mock).mockResolvedValue(new Map([['k1', consolidado({ vencimento: { nivel: 'critico', dias: 20 } })]]))
  ;(prisma.faturamento.findMany as jest.Mock).mockResolvedValue([])
  ;(prisma.indiceDocumento.findMany as jest.Mock).mockResolvedValue([{ origemId: 'h1' }])
  ;(auditarNoBanco as jest.Mock).mockResolvedValue([
    { tipo: 'termo-duplicado', cliente: 'SMIT', contrato: 'TC 45/SMIT/2023', detalhe: '"TA 01" e "TA 01"' },
    { tipo: 'ativo-sem-valor', cliente: 'SMIT', contrato: 'TC 45/SMIT/2023', detalhe: 'x' },
  ])
})

it('filtra pelos clientes permitidos e junta regras, documentos e auditoria, em ordem', async () => {
  const alertas = await alertasDosContratos({ clienteIds: ['c1'] }, hoje)
  expect((prisma.contrato.findMany as jest.Mock).mock.calls[0][0].where.AND[0]).toEqual({ clienteId: { in: ['c1'] } })
  // 7 competências encerradas: 08/2026 a 02/2026
  expect((prisma.faturamento.findMany as jest.Mock).mock.calls[0][0].where.OR).toHaveLength(7)
  expect(alertas.map((a) => a.codigo)).toEqual(['vence-sem-prorrogacao', 'cadastro-termo-duplicado', 'termo-sem-pdf', 'termo-sem-texto'])
  expect(alertas.find((a) => a.codigo === 'termo-sem-pdf')!.detalhe).toBe('1 termo assinado sem PDF') // h3 sem assinatura não conta
  expect(alertas[0].cliente).toBe('SMIT')
})

it('admin (clienteIds null) não filtra por cliente; sem contratos não consulta o resto', async () => {
  ;(prisma.contrato.findMany as jest.Mock).mockResolvedValue([])
  expect(await alertasDosContratos({ clienteIds: null }, hoje)).toEqual([])
  expect((prisma.contrato.findMany as jest.Mock).mock.calls[0][0].where.AND[0]).toEqual({})
  expect(consolidarContratos).not.toHaveBeenCalled()
})

it('alertasDaAuditoria: liga pelo sigla|número e ignora achado sem contrato carregado', () => {
  const contratos = [{ id: 'k1', clienteId: 'c1', cliente: 'SMIT', chaveAuditoria: 'SMIT|TC 45/SMIT/2023', contrato: 'TC 45/SMIT/2023' }]
  const alertas = alertasDaAuditoria(
    [
      { tipo: 'finalizado-vigente', cliente: 'SMIT', contrato: 'TC 45/SMIT/2023', detalhe: 'situação "Finalizado"' },
      { tipo: 'finalizado-vigente', cliente: 'SMS', contrato: 'TC 1/2020', detalhe: 'x' },
    ],
    contratos
  )
  expect(alertas).toEqual([
    expect.objectContaining({ codigo: 'cadastro-finalizado-vigente', nivel: 'atencao', contratoId: 'k1', acao: 'Revisar o cadastro do contrato.' }),
  ])
})
