import { chaveImagemProposta, chavesDasImagensNoHtml, urlImagemProposta } from './imagens'

describe('imagens extraídas do PDF de uma proposta comercial (Cloudflare R2)', () => {
  it('a chave fica na pasta da proposta, por arquivo', () => {
    expect(chaveImagemProposta('p1', 0, 'pagina-2-imagem-1.png')).toBe('propostas-comerciais/p1/0/imagens/pagina-2-imagem-1.png')
  })

  it('a URL que vai no <img> é a rota do VerAI, nunca o endereço do R2', () => {
    expect(urlImagemProposta('p1', 0, 'pagina-2-imagem-1.png')).toBe('/api/propostas-comerciais/p1/imagens/0/pagina-2-imagem-1.png')
  })

  it('acha no HTML as chaves das imagens da própria proposta, sem repetir', () => {
    const html =
      '<p>a</p><img alt="x" src="/api/propostas-comerciais/p1/imagens/0/pagina-1-imagem-1.png">' +
      '<img src="/api/propostas-comerciais/p1/imagens/1/pagina-3-imagem-2.png">' +
      '<img src="/api/propostas-comerciais/p1/imagens/0/pagina-1-imagem-1.png">' +
      '<img src="/api/propostas-comerciais/OUTRA/imagens/0/pagina-1-imagem-1.png">' +
      '<img src="https://abc.public.blob.vercel-storage.com/2026/09/p1/0/imagens/pagina-1-imagem-1.png">'

    expect(chavesDasImagensNoHtml(html, 'p1')).toEqual([
      'propostas-comerciais/p1/0/imagens/pagina-1-imagem-1.png',
      'propostas-comerciais/p1/1/imagens/pagina-3-imagem-2.png',
    ])
  })

  it('HTML vazio ou nulo não tem imagem', () => {
    expect(chavesDasImagensNoHtml(null, 'p1')).toEqual([])
    expect(chavesDasImagensNoHtml('', 'p1')).toEqual([])
  })
})
