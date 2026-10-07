/** @jest-environment node */
jest.mock('@/lib/prisma', () => ({ prisma: {} }))

import { montarPainel, totalizar, SEM_CARTEIRA } from './painel-carteiras'
import type { NivelVencimento } from './vencimento'

function contrato(ativo: boolean, valorBase: string | null, faturado: string, nivel: NivelVencimento = 'ok') {
  return { ativo, valorBase, vencimento: { nivel, dias: null }, saldo: { faturado } }
}

describe('totalizar', () => {
  it('soma só os ativos com valor; ativo sem valor fica fora das duas somas e é contado', () => {
    const t = totalizar([
      [contrato(true, '1000', '250'), contrato(false, '9999', '9999'), contrato(true, null, '500')],
      [contrato(true, '0.10', '0.05')],
    ])
    expect(t).toMatchObject({
      clientes: 2,
      clientesComContratoAtivo: 2,
      contratosAtivos: 3,
      contratosSemValor: 1,
      valorContratado: '1000.1',
      faturado: '250.05',
      saldo: '750.05',
      percentualFaturado: '25.00',
    })
  })

  it('conta vencimentos dos ativos: 90 dias inclui os de 30; vencido à parte', () => {
    const t = totalizar([
      [contrato(true, '1', '0', 'vencido'), contrato(true, '1', '0', 'critico'), contrato(true, '1', '0', 'atencao')],
      [contrato(false, '1', '0', 'critico')],
    ])
    expect(t).toMatchObject({ vencidos: 1, vencem30: 1, vencem90: 2, clientesComContratoAtivo: 1 })
  })

  it('sem contrato: zeros e sem %', () => {
    expect(totalizar([[]])).toMatchObject({ clientes: 1, valorContratado: '0', saldo: null, percentualFaturado: null })
  })
})

describe('montarPainel', () => {
  const gerencias = [
    { id: 'g1', nome: 'Beatriz', sigla: 'GB', ativa: true, gerentes: ['Beatriz Souza'] },
    { id: 'g2', nome: 'Vazia', sigla: null, ativa: true, gerentes: [] },
    { id: 'g3', nome: 'Inativa', sigla: null, ativa: false, gerentes: [] },
  ]

  it('agrupa por gerência, mostra ativa vazia, esconde inativa vazia e põe "Sem carteira" no fim', () => {
    const painel = montarPainel(
      [
        { id: 'c1', gerenciaId: 'g1', contratos: [contrato(true, '100', '10')] },
        { id: 'c2', gerenciaId: 'g1', contratos: [contrato(true, '50', '0')] },
        { id: 'c3', gerenciaId: null, contratos: [contrato(true, '20', '20')] },
      ],
      gerencias
    )
    expect(painel.carteiras.map((c) => c.id)).toEqual(['g1', 'g2', SEM_CARTEIRA])
    expect(painel.carteiras[0]).toMatchObject({ gerentes: ['Beatriz Souza'], totais: { clientes: 2, valorContratado: '150' } })
    expect(painel.carteiras[1].totais.clientes).toBe(0)
    expect(painel.geral).toMatchObject({ clientes: 3, valorContratado: '170', faturado: '30' })
    expect(painel.clientes.c3).toMatchObject({ clientes: 1, saldo: '0' })
  })

  it('a soma das carteiras é o geral', () => {
    const painel = montarPainel(
      [
        { id: 'c1', gerenciaId: 'g1', contratos: [contrato(true, '100.33', '10.11')] },
        { id: 'c2', gerenciaId: 'g3', contratos: [contrato(true, '0.67', '0.89')] },
      ],
      gerencias
    )
    const soma = painel.carteiras.reduce((acc, c) => acc + Number(c.totais.valorContratado), 0)
    expect(soma).toBeCloseTo(Number(painel.geral.valorContratado))
    expect(painel.carteiras.map((c) => c.id)).toEqual(['g1', 'g2', 'g3'])
  })
})
