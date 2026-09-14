import { escaparHtml } from './escaparHtml'

describe('escaparHtml', () => {
  it('escapa & antes de escapar < e >, pra não escapar em dobro um &lt; já literal do texto', () => {
    expect(escaparHtml('Fulano & Cia')).toBe('Fulano &amp; Cia')
    expect(escaparHtml('&lt;tag&gt;')).toBe('&amp;lt;tag&amp;gt;')
  })

  it('escapa < e > soltos', () => {
    expect(escaparHtml('Preço < 100 e > 50')).toBe('Preço &lt; 100 e &gt; 50')
  })

  it('texto sem caractere especial passa direto', () => {
    expect(escaparHtml('Texto normal, com vírgula.')).toBe('Texto normal, com vírgula.')
  })
})
