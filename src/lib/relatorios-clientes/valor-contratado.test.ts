import { calcularSaldo } from './saldo'
import { baseDoContrato, saldoComBase } from './valor-contratado'

describe('baseDoContrato', () => {
  it('histórico vence os itens', () => expect(baseDoContrato('1000', '300')).toBe('1000'))
  it('sem histórico, usa os itens', () => expect(baseDoContrato(null, '300')).toBe('300'))
  it('sem nenhum dos dois, null', () => expect(baseDoContrato(null, '0')).toBeNull())
})

describe('saldoComBase', () => {
  it('sem itens, calcula o % faturado sobre o valor do histórico', () => {
    const saldo = saldoComBase(calcularSaldo({ valorItens: null, faturado: '250' }), '1000')
    expect(saldo).toMatchObject({ valorItens: '1000', faturado: '250', saldo: '750', percentualFaturado: '25.00' })
  })
  it('com itens, mantém o saldo dos itens', () => {
    const dosItens = calcularSaldo({ valorItens: '400', faturado: '100' })
    expect(saldoComBase(dosItens, '1000')).toBe(dosItens)
  })
  it('sem itens e sem histórico, continua sem base', () => {
    expect(saldoComBase(calcularSaldo({ valorItens: null, faturado: '10' }), null).percentualFaturado).toBeNull()
  })
})
