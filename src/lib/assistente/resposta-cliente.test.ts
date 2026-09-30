/** @jest-environment node */
jest.mock('@/lib/prisma', () => ({ prisma: {} }))
import { mensagemSoCliente, respostaDeAmbiguidade, respostaDoCliente } from './resposta-cliente'

const sms = { nome: 'Secretaria Municipal da Saúde', siglaLegado: 'SMS' }

it.each([
  ['SMS', true], ['saúde', true], ['me fale da saude', true], ['cliente SMS?', true], ['tudo sobre a SMS', true],
  ['quanto falta faturar da saúde?', false], ['SMS e SME', false], ['contratos da SMS', false],
])('mensagemSoCliente(%s) = %s', (q, esperado) => {
  expect(mensagemSoCliente(q, sms)).toBe(esperado)
})

const contrato = (extra = {}) => ({
  id: 'k1', numero: 'TC 9/SMS/2024', ativo: true, fimVigencia: '31/12/2026', diasParaVencer: 92, vencimento: 'ok',
  valorContratado: 'R$ 1.000.000,00', faturado: 'R$ 400.000,00', saldo: 'R$ 600.000,00', percentualFaturado: '40%',
  situacaoDesatualizada: false, prorrogacaoEmAndamento: false, valores: { valor: '1000000', faturado: '400000', saldo: '600000' }, ...extra,
})

it('resposta do cliente: números do consolidado, próximo vencimento, prazo e alertas, com links', () => {
  const texto = respostaDoCliente({
    id: 'c1', nome: 'Secretaria Municipal da Saúde', sigla: 'SMS',
    contratos: [contrato(), contrato({ id: 'k2', numero: 'TC 10/SMS/2025', valorContratado: 'sem valor cadastrado', saldo: null, percentualFaturado: null, fimVigencia: '15/11/2026', diasParaVencer: 46, valores: { valor: null, faturado: '0', saldo: null } }), contrato({ id: 'k3', ativo: false })] as never,
    alertas: [{ nivel: 'critico', titulo: 'Vence em 46 dias sem prorrogação', contrato: 'TC 10/SMS/2025', contratoId: 'k2' }] as never,
    proximoPrazo: { tipo: 'Encerramento do faturamento', data: '05/10/2026', quando: 'em 5 dias' },
  })
  expect(texto).toBe(
    [
      '**SMS – Secretaria Municipal da Saúde**: 2 contratos ativos · valor R$ 1.000.000,00 · faturado R$ 400.000,00 · saldo R$ 600.000,00 (1 sem valor cadastrado, fora das somas)',
      '',
      '- Próximo vencimento: [TC 10/SMS/2025](contrato:k2) em 15/11/2026 (46 dias)',
      '- Próximo prazo do faturamento: Encerramento do faturamento em 05/10/2026 (em 5 dias)',
      '',
      '**Atenção**',
      '- 🔴 Vence em 46 dias sem prorrogação — [TC 10/SMS/2025](contrato:k2)',
      '',
      '[Abrir o cliente](cliente:c1) · Pergunte, por exemplo: "quanto falta faturar?" ou "o que vence este ano?"',
    ].join('\n')
  )
})

it('ambiguidade lista as opções', () => {
  expect(respostaDeAmbiguidade([{ nome: 'Secretaria Municipal da Saúde', sigla: 'SMS' }, { nome: 'Secretaria Municipal de Educação', sigla: 'SME' }])).toBe(
    'Encontrei mais de um cliente. Qual deles?\n- SMS – Secretaria Municipal da Saúde\n- SME – Secretaria Municipal de Educação'
  )
})
