import { nomeCombina, normalizarNomePdf, ordenarSugeridosPrimeiro, tipoPdfValido } from './pdfs-existentes'

describe('normalizarNomePdf', () => {
  it('tira extensão, acento, pontuação e caixa', () => {
    expect(normalizarNomePdf('PC_SMS_211014_136_v4.0.pdf')).toBe('pcsms211014136v40')
    expect(normalizarNomePdf('Sustentação Melhorias (2023).PDF')).toBe('sustentacaomelhorias2023')
  })

  it('aceita vazio', () => {
    expect(normalizarNomePdf(null)).toBe('')
    expect(normalizarNomePdf(undefined)).toBe('')
  })
})

describe('nomeCombina', () => {
  it('o arquivo da proposta bate com o texto da linha, com ou sem extensão e pontuação', () => {
    expect(nomeCombina('PC_SMS_211014_136_v4.0', 'PC_SMS_211014_136_v4.0.pdf')).toBe(true)
    expect(nomeCombina('PA-SMS-211215-161 v1.0', 'PA SMS 211215 161 v1.0.pdf')).toBe(true)
  })

  it('bate quando o arquivo tem texto a mais (ou a linha tem)', () => {
    expect(nomeCombina('PA-SMS-220606-66 - V2.0', 'PA-SMS-220606-66 - V2.0 - assinado.pdf')).toBe(true)
    expect(nomeCombina('PA-SMS-220606-66 - V2.0 - Certificados', 'PA-SMS-220606-66 - V2.0.pdf')).toBe(true)
  })

  it('versões diferentes não se misturam', () => {
    expect(nomeCombina('PA_SMS_220606_66_v3.0', 'PA_SMS_220606_66_v2.0.pdf')).toBe(false)
  })

  it('texto curto demais ou vazio nunca combina', () => {
    expect(nomeCombina('TC', 'TC 142-2021.pdf')).toBe(false)
    expect(nomeCombina(null, 'qualquer.pdf')).toBe(false)
    expect(nomeCombina('PC_SMS_211014_136_v4.0', null)).toBe(false)
  })
})

describe('ordenarSugeridosPrimeiro', () => {
  it('sugeridos sobem e a ordem relativa de cada grupo é mantida', () => {
    const itens = [
      { n: 1, sugerido: false },
      { n: 2, sugerido: true },
      { n: 3, sugerido: false },
      { n: 4, sugerido: true },
    ]
    expect(ordenarSugeridosPrimeiro(itens).map((i) => i.n)).toEqual([2, 4, 1, 3])
  })
})

describe('tipoPdfValido', () => {
  it('só proposta e termo', () => {
    expect(tipoPdfValido('proposta')).toBe(true)
    expect(tipoPdfValido('termo')).toBe(true)
    expect(tipoPdfValido('outro')).toBe(false)
    expect(tipoPdfValido(null)).toBe(false)
  })
})
