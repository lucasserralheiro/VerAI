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

describe('fix round 1', () => {
  const c = (textoVerai: string, fonte: string) => conferirResposta({ textoVerai, fontes: [fonte] })
  it('moeda sem milhar ou com 1 casa não é cortada', () => {
    expect(extrairNumeros('R$ 1234,56 e R$ 1.234,5 e R$ 1000,00')).toEqual(['R$ 1234,56', 'R$ 1.234,5', 'R$ 1000,00'])
    expect(c('Valor R$ 1234,56.', 'R$ 1.234,56')).toEqual({ conferidos: 1, naoConfirmados: [] })
  })
  it('fonte com inteiro cru ou decimal longo confirma o arredondado', () => {
    expect(c('Valor R$ 1.000,00.', 'valor 1000')).toEqual({ conferidos: 1, naoConfirmados: [] })
    expect(c('Taxa 33,33%.', 'acumulado 33.333333%')).toEqual({ conferidos: 1, naoConfirmados: [] })
  })
  it('moeda e percentual não se confirmam entre si', () => {
    expect(c('Foi 40%.', 'R$ 40,00').naoConfirmados).toEqual(['40%'])
  })
  it('percentual com 3 casas não vira "175%"', () => {
    expect(extrairNumeros('taxa 6,175%')).toEqual([])
  })
  it('competência em qualquer formato', () => {
    expect(c('Competência 08/2026.', 'ago/2026')).toEqual({ conferidos: 1, naoConfirmados: [] })
    expect(c('Competência 08/2026.', '2026-08')).toEqual({ conferidos: 1, naoConfirmados: [] })
    expect(c('Competência ago/2026.', 'sem nada')).toEqual({ conferidos: 0, naoConfirmados: ['ago/2026'] })
    expect(extrairNumeros('vence 31/12/2026')).toEqual(['31/12/2026'])
  })
  it('sinal: negativo não confirma positivo', () => {
    expect(c('Saldo -R$ 5,00.', 'R$ 5,00').naoConfirmados).toEqual(['-R$ 5,00'])
    expect(c('Saldo R$ -5,00.', 'R$ 5,00').naoConfirmados).toEqual(['R$ -5,00'])
  })
})
