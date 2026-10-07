import type { ResultadoConversaoPdf } from '../pdfHtml'
import { medirConversao } from './metricas'

function resultado(html: string, textoOriginal: string): ResultadoConversaoPdf {
  return {
    html,
    paginasImagem: [],
    paginasConvertidas: [{ pagina: 1, textoOriginal, html }],
    correcoesDeTexto: [],
    alertasDeTexto: [],
    camadaDeTextoSuspeita: false,
    paginasComImagem: [],
  }
}

describe('medirConversao', () => {
  it('confere PREÇO × QUANT = TOTAL em cada linha da tabela de preço', () => {
    const html =
      '<table><tr><th>PRODUTO</th><th>PREÇO</th><th>QUANT</th><th>TOTAL</th></tr>' +
      '<tr><td>Licença</td><td>10,00</td><td>3</td><td>30,00</td></tr>' +
      '<tr><td>Suporte</td><td>10,00</td><td>3</td><td>31,00</td></tr></table>'
    const m = medirConversao(resultado(html, 'PRODUTO PREÇO QUANT TOTAL\nLicença 10,00 3 30,00\nSuporte 10,00 3 31,00'))
    expect(m.tabelas).toBe(1)
    expect(m.linhasAritmeticaOk).toBe(1)
    expect(m.linhasAritmeticaQuebrada).toBe(1)
    expect(m.numerosPerdidos).toBe(0)
  })

  it('tabela de 1 coluna cheia de valor é preço não reconhecido', () => {
    const html = '<table><tr><td>Item 1,00 Item 2,00 Total 3,00</td></tr></table>'
    const m = medirConversao(resultado(html, 'Item 1,00 Item 2,00 Total 3,00'))
    expect(m.precoNaoReconhecido).toBe(1)
    expect(m.molduraViradaTabela).toBe(0)
  })

  it('traz as métricas de fidelidade junto', () => {
    const m = medirConversao(resultado('<p>Valor</p>', 'Valor 99,90'))
    expect(m.numerosPerdidos).toBe(1)
    expect(m.palavrasNoPdf).toBe(2)
  })
})
