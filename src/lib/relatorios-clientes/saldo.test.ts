import { calcularSaldo } from './saldo'

describe('calcularSaldo', () => {
  it('saldo = valor dos itens − faturado, e % faturado com 2 casas', () => {
    expect(calcularSaldo({ valorItens: '1000', faturado: '250.5' })).toEqual({
      valorItens: '1000',
      faturado: '250.5',
      saldo: '749.5',
      percentualFaturado: '25.05',
    })
  })

  it('aceita Decimal/number e não perde centavos em soma de ponto flutuante', () => {
    expect(calcularSaldo({ valorItens: 0.3, faturado: 0.1 })).toEqual(
      expect.objectContaining({ saldo: '0.2', percentualFaturado: '33.33' })
    )
  })

  it('saldo pode ficar negativo quando faturou além dos itens', () => {
    expect(calcularSaldo({ valorItens: '100', faturado: '150' })).toEqual(
      expect.objectContaining({ saldo: '-50', percentualFaturado: '150.00' })
    )
  })

  it('sem itens vinculados: saldo e % são null (não calculáveis), nunca saldo negativo enganoso', () => {
    expect(calcularSaldo({ valorItens: '0', faturado: '500' })).toEqual({
      valorItens: '0',
      faturado: '500',
      saldo: null,
      percentualFaturado: null,
    })
  })

  it('null conta como zero', () => {
    expect(calcularSaldo({ valorItens: '200', faturado: null })).toEqual(
      expect.objectContaining({ faturado: '0', saldo: '200', percentualFaturado: '0.00' })
    )
  })
})
