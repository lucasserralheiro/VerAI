import { faturamentoCancelado, situacaoFaturamentoCanonica } from './situacao-faturamento'
import { resumirFaturamentos } from './resumo-faturamento'

it('canoniza sem diferenciar caixa e acento', () => {
  expect(situacaoFaturamentoCanonica('  em ABERTO ')).toBe('Em aberto')
  expect(situacaoFaturamentoCanonica('cancelado')).toBe('Cancelado')
  expect(situacaoFaturamentoCanonica('quase')).toBeNull()
})

it('reconhece cancelado no texto livre antigo', () => {
  expect(faturamentoCancelado('CANCELADA - substituída')).toBe(true)
  expect(faturamentoCancelado('Pago')).toBe(false)
  expect(faturamentoCancelado(null)).toBe(false)
})

it('cancelado fica fora do valor total da aba Faturamento', () => {
  const base = { competenciaAno: 2026, competenciaMes: 8, enviadoCliente: true, enviadoGfp: true }
  const resumo = resumirFaturamentos([
    { ...base, id: 'a', valorExibido: '100', situacao: 'Pago' },
    { ...base, id: 'b', valorExibido: '999', situacao: 'Cancelado' },
  ])
  expect(resumo.valorTotal).toBe('100.00')
  expect(resumo.total).toBe(2)
})
