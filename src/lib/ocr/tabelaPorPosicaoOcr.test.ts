import { reconstruirTabelaOcr } from './tabelaPorPosicaoOcr'
import type { PalavraReconhecidaOcr } from './rodarOcr'

function palavra(texto: string, x: number, largura: number, y: number): PalavraReconhecidaOcr {
  return { texto, x, largura, y }
}

describe('reconstruirTabelaOcr', () => {
  it('devolve null quando não há palavra nenhuma', () => {
    expect(reconstruirTabelaOcr([])).toBeNull()
  })

  it('devolve null quando só tem uma linha (sem corredor pra confirmar)', () => {
    const palavras = [palavra('Item', 10, 40, 100), palavra('Valor', 120, 40, 100)]
    expect(reconstruirTabelaOcr(palavras)).toBeNull()
  })

  it('reconstrói tabela quando duas colunas se alinham em pelo menos duas linhas', () => {
    // Y cresce de cima pra baixo (coordenada de canvas/bbox do tesseract,
    // diferente do PDF nativo) — cabeçalho (Item/Valor) tem Y menor, vem
    // primeiro na ordem de leitura.
    const palavras = [
      palavra('Item', 10, 40, 60),
      palavra('Valor', 200, 40, 60),
      palavra('Storage', 10, 60, 100),
      palavra('R$100', 200, 50, 100),
    ]

    const html = reconstruirTabelaOcr(palavras)

    expect(html).toBe(
      '<table><thead><tr><th>Item</th><th>Valor</th></tr></thead>' +
        '<tbody><tr><td>Storage</td><td>R$100</td></tr></tbody></table>'
    )
  })

  it('devolve null pra texto corrido sem coluna nenhuma (parágrafo comum)', () => {
    const palavras = [
      palavra('Texto', 10, 40, 100),
      palavra('corrido', 55, 50, 100),
      palavra('sem', 10, 30, 60),
      palavra('coluna', 45, 50, 60),
    ]

    expect(reconstruirTabelaOcr(palavras)).toBeNull()
  })
})
