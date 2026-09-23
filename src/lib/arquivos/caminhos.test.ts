import { caminhoFinalArquivo, caminhoTemporario, nomeSeguro, PREFIXO_TEMPORARIO, urlTemporariaValida } from './caminhos'

describe('nomeSeguro', () => {
  it('tira acento e troca o que não é letra/número/ponto/hífen por _', () => {
    expect(nomeSeguro('Medição agosto/2026 (final).xlsx')).toBe('Medicao_agosto_2026_final_.xlsx')
  })

  it('limita a 120 caracteres preservando a extensão', () => {
    const nome = `${'a'.repeat(200)}.pdf`
    expect(nomeSeguro(nome)).toHaveLength(120)
    expect(nomeSeguro(nome).endsWith('.pdf')).toBe(true)
  })
})

describe('caminhos', () => {
  it('temporário fica sob o prefixo', () => {
    expect(caminhoTemporario('x.pdf').startsWith(PREFIXO_TEMPORARIO)).toBe(true)
    expect(caminhoTemporario('x.pdf').endsWith('-x.pdf')).toBe(true)
  })

  it('final é por cliente e por arquivo', () => {
    expect(caminhoFinalArquivo('c1', 'a1', 'PC 01.pdf')).toBe('clientes/c1/a1/PC_01.pdf')
  })
})

describe('urlTemporariaValida', () => {
  const base = 'https://abc123.public.blob.vercel-storage.com'

  it('aceita URL https do Blob sob o prefixo temporário', () => {
    expect(urlTemporariaValida(`${base}/tmp-arquivos/uuid-x-AbCd.pdf`)).toBe(true)
  })

  it.each([
    `${base}/clientes/c1/a1/x.pdf`,
    'https://evil.example.com/tmp-arquivos/x.pdf',
    'http://abc123.public.blob.vercel-storage.com/tmp-arquivos/x.pdf',
    'not a url',
    42,
    null,
  ])('rejeita %p', (url) => {
    expect(urlTemporariaValida(url)).toBe(false)
  })
})
