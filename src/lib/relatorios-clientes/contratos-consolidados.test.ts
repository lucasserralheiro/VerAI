jest.mock('@/lib/prisma', () => ({ prisma: {} }))

import { consolidarContrato, type LinhaHistoricoConsolidacao } from './contratos-consolidados'
import { calcularSaldo } from './saldo'
import { vigenciaEfetiva } from './regras'

const HOJE = new Date('2026-09-23T12:00:00Z')
const semSaldo = calcularSaldo({ valorItens: null, faturado: null })

function linha(parte: Partial<LinhaHistoricoConsolidacao>): LinhaHistoricoConsolidacao {
  return {
    tipo: 'CONTRATO',
    data: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    numero: null,
    proposta: null,
    valor: null,
    dataVencimento: null,
    propostaPdfUrl: null,
    propostaPdfNome: null,
    termoPdfUrl: null,
    termoPdfNome: null,
    ...parte,
  }
}

describe('vigenciaEfetiva', () => {
  it('prorrogação estende o prazo do cabeçalho', () => {
    const fim = vigenciaEfetiva(new Date('2025-09-22T03:00:00Z'), [
      { tipo: 'PRORROGACAO', dataVencimento: new Date('2027-09-22T03:00:00Z') },
    ])
    expect(fim?.toISOString()).toBe('2027-09-22T03:00:00.000Z')
  })
  it('prospecção e rescisão não estendem', () => {
    const cadastro = new Date('2025-09-22T03:00:00Z')
    expect(
      vigenciaEfetiva(cadastro, [
        { tipo: 'PROSPECCAO', dataVencimento: new Date('2030-01-01T00:00:00Z') },
        { tipo: 'RESCISAO', dataVencimento: new Date('2031-01-01T00:00:00Z') },
      ])
    ).toBe(cadastro)
  })
  it('sem cabeçalho usa o histórico', () => {
    expect(vigenciaEfetiva(null, [{ tipo: 'ADITIVO', dataVencimento: new Date('2027-01-01T00:00:00Z') }])?.getUTCFullYear()).toBe(2027)
  })
})

describe('consolidarContrato', () => {
  const contrato = { id: 'c1', situacao: 'Ativo', dataVencimento: new Date('2025-09-22T03:00:00Z') }

  it('cabeçalho vencido mas prorrogado no histórico continua ativo', () => {
    const c = consolidarContrato(
      contrato,
      [linha({ tipo: 'PRORROGACAO', dataVencimento: new Date('2027-09-22T03:00:00Z'), valor: '100.5', data: new Date('2025-09-01T00:00:00Z') })],
      semSaldo,
      HOJE
    )
    expect(c.ativo).toBe(true)
    expect(c.vencimento.nivel).toBe('ok')
  })
  it('sem histórico e sem situação, cabeçalho vencido = inativo', () => {
    expect(consolidarContrato({ ...contrato, situacao: null }, [], semSaldo, HOJE).ativo).toBe(false)
  })
  it('situação "Ativo" com data vencida segue ativo, com o semáforo em vencido', () => {
    const c = consolidarContrato(contrato, [], semSaldo, HOJE)
    expect(c.ativo).toBe(true)
    expect(c.vencimento.nivel).toBe('vencido')
  })
  it('linha vazia do legado nunca é ativa', () => {
    expect(consolidarContrato({ ...contrato, dataVencimento: null }, [], semSaldo, HOJE, true).ativo).toBe(false)
  })
  it('rescisão no histórico tira de ativo mesmo com prazo futuro', () => {
    const c = consolidarContrato(
      { ...contrato, dataVencimento: new Date('2030-01-01T00:00:00Z') },
      [linha({ tipo: 'RESCISAO' })],
      semSaldo,
      HOJE
    )
    expect(c.rescindido).toBe(true)
    expect(c.ativo).toBe(false)
  })
  it('valor e saldo usam a mesma base: histórico primeiro, itens como reserva, senão null', () => {
    const comHistorico = consolidarContrato(
      contrato,
      [linha({ valor: '1000', data: new Date('2025-01-01T00:00:00Z') })],
      calcularSaldo({ valorItens: '500', faturado: '250' }),
      HOJE
    )
    expect(comHistorico.valorBase).toBe('1000')
    expect(comHistorico.saldo.percentualFaturado).toBe('25.00')

    const soItens = consolidarContrato(contrato, [], calcularSaldo({ valorItens: '500', faturado: '250' }), HOJE)
    expect(soItens.valorBase).toBe('500')
    expect(soItens.saldo.percentualFaturado).toBe('50.00')

    const nada = consolidarContrato(contrato, [], semSaldo, HOJE)
    expect(nada.valorBase).toBeNull()
    expect(nada.saldo.saldo).toBeNull()
  })
})
