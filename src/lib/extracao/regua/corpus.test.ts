import { familiaDoGerador, pareceProposta } from './corpus'

describe('pareceProposta', () => {
  it.each([
    'PC-ADESAMPA-240326-44 v3.0.pdf',
    'PA-CGM- 250912-127 v4.0.pdf',
    'Proposta PA-201210-154 v1.0.pdf',
    'SEI_147453498_Proposta_Comercial_934.pdf',
    'pa-smdet-260428-782.PDF',
  ])('aceita %s', (nome) => expect(pareceProposta(nome)).toBe(true))

  it.each(['TC 073-2019 - TA 02.pdf', 'TC 16-CGM-2024 - TA 01.pdf', 'SPA-relatorio.pdf', 'PC-CGM-230726-82 v3.3.docx'])(
    'recusa %s',
    (nome) => expect(pareceProposta(nome)).toBe(false)
  )
})

describe('familiaDoGerador', () => {
  it('tira a versão e junta Creator e Producer iguais', () => {
    expect(familiaDoGerador('Microsoft® Word para Microsoft 365', 'Microsoft® Word para Microsoft 365')).toBe(
      'Microsoft® Word para Microsoft'
    )
    expect(familiaDoGerador('wkhtmltopdf 0.12.6', 'Qt 4.8.7')).toBe('wkhtmltopdf / Qt')
  })

  it('sem metadado tem nome próprio', () => {
    expect(familiaDoGerador(undefined, '')).toBe('(sem metadado)')
  })
})
