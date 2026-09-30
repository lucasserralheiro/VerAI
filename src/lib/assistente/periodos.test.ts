import { periodoDaPergunta } from './periodos'

const hoje = new Date('2026-09-30T15:00:00Z')
const p = (q: string) => periodoDaPergunta(q, hoje)

it.each([
  ['faturamento do mês passado', '2026-08-01', '2026-08-31'],
  ['e este mês?', '2026-09-01', '2026-09-30'],
  ['o que vence no próximo mês', '2026-10-01', '2026-10-31'],
  ['este ano', '2026-01-01', '2026-12-31'],
  ['no ano passado', '2025-01-01', '2025-12-31'],
  ['últimos 6 meses', '2026-04-01', '2026-09-30'],
  ['ultimos 12 meses', '2025-10-01', '2026-09-30'],
  ['próximo trimestre', '2026-10-01', '2026-12-31'],
  ['até o fim do ano', '2026-09-30', '2026-12-31'],
  ['quando fecha novembro?', '2026-11-01', '2026-11-30'],
  ['e em março?', '2026-03-01', '2026-03-31'],
  ['competência 08/2026', '2026-08-01', '2026-08-31'],
])('%s', (q, inicio, fim) => {
  expect(p(q)).toMatchObject({ inicio, fim })
})

it('texto pronto para o contexto e nada quando não há período', () => {
  expect(p('mês passado')!.texto).toBe('Período citado: 01/08/2026 a 31/08/2026 (competência 2026-08).')
  expect(p('últimos 6 meses')!.texto).toBe('Período citado: 01/04/2026 a 30/09/2026.')
  expect(p('qual o saldo do TC 45/SMIT/2023?')).toBeNull()
  expect(p('SEI 6018.2023/0122629-0')).toBeNull()
})

it('número de contrato (TC, TA, PC, PA, TAP, termo, aditivo, proposta) não vira período', () => {
  expect(p('saldo do TC 12/2023')).toBeNull()
  expect(p('contrato 5/2024')).toBeNull()
  expect(p('PA 3/2025 foi assinada?')).toBeNull()
})

it('faturamento de MM/AAAA vira período', () => {
  expect(p('faturamento de 08/2026')).toMatchObject({
    inicio: '2026-08-01',
    fim: '2026-08-31',
  })
})
