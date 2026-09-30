import { conferirResposta, extrairNumeros } from './conferencia'

it('extrai valor, percentual, data, competência, SEI e número de contrato', () => {
  expect(extrairNumeros('Saldo R$ 600.000,00 (40%), vence 31/12/2026, compet. 08/2026, SEI 6018.2023/0122629-0, TC 45/SMIT/2023.')).toEqual([
    'R$ 600.000,00', '40%', '31/12/2026', '08/2026', '6018.2023/0122629-0', '45/SMIT/2023',
  ])
})

it('confere contra as fontes (saídas das ferramentas + contexto); o que não aparece é não confirmado', () => {
  const r = conferirResposta({
    textoVerai: 'O TC 45/SMIT/2023 tem saldo de R$ 600.000,00 e vence em 31/12/2026. Faturado R$ 999,99.',
    fontes: ['numero|saldo|fim\nTC 45/SMIT/2023|R$ 600.000,00|31/12/2026', 'Hoje é 30/09/2026.'],
  })
  expect(r).toEqual({ conferidos: 3, naoConfirmados: ['R$ 999,99'] })
})

it('tolera formato: "R$ 1.000,00" × "R$ 1000,00" × "1000.00"; percentual com vírgula ou ponto', () => {
  expect(conferirResposta({ textoVerai: 'Valor R$ 1.000,00 (6,17%).', fontes: ['valor: 1000.00 acumulado 6.17%'] })).toEqual({ conferidos: 2, naoConfirmados: [] })
})

it('texto sem número: nada a conferir', () => {
  expect(conferirResposta({ textoVerai: 'Não encontrei isso no VerAI.', fontes: [] })).toEqual({ conferidos: 0, naoConfirmados: [] })
})

it('inteiro solto da fonte (o "30" de uma data) não confirma "R$ 30,00"', () => {
  expect(conferirResposta({ textoVerai: 'Custa R$ 30,00.', fontes: ['Hoje é 30/09/2026.'] })).toEqual({ conferidos: 0, naoConfirmados: ['R$ 30,00'] })
})
