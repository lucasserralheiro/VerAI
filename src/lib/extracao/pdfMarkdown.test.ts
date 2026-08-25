import type { StructuredTextItem } from 'unpdf'

jest.mock('unpdf', () => ({
  getDocumentProxy: jest.fn().mockResolvedValue({}),
  extractTextItems: jest.fn(),
}))

import { extractTextItems } from 'unpdf'
import { converterPdfParaMarkdown } from './pdfMarkdown'

function item(overrides: Partial<StructuredTextItem>): StructuredTextItem {
  return {
    str: '',
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    fontSize: 12,
    fontFamily: 'Helvetica',
    dir: 'ltr',
    hasEOL: false,
    ...overrides,
  }
}

describe('converterPdfParaMarkdown', () => {
  it('envolve trecho com fonte em negrito em **...**', async () => {
    ;(extractTextItems as jest.Mock).mockResolvedValue({
      totalPages: 1,
      items: [[item({ str: 'Cláusula 1', x: 0, fontFamily: 'Helvetica-Bold', hasEOL: true })]],
    })

    const resultado = await converterPdfParaMarkdown(Buffer.from(''))

    expect(resultado).toBe('**Cláusula 1**')
  })

  it('detecta título por tamanho de fonte maior que o corpo do texto', async () => {
    ;(extractTextItems as jest.Mock).mockResolvedValue({
      totalPages: 1,
      items: [
        [
          item({ str: 'Proposta Comercial', x: 0, fontSize: 20, hasEOL: true }),
          item({ str: 'Corpo do texto normal.', x: 0, fontSize: 10, hasEOL: true }),
          item({ str: 'Mais uma linha de corpo.', x: 0, fontSize: 10, hasEOL: true }),
        ],
      ],
    })

    const resultado = await converterPdfParaMarkdown(Buffer.from(''))

    expect(resultado).toBe(
      '# Proposta Comercial\n\nCorpo do texto normal.\n\nMais uma linha de corpo.'
    )
  })

  it('reconhece lista com marcador e lista numerada', async () => {
    ;(extractTextItems as jest.Mock).mockResolvedValue({
      totalPages: 1,
      items: [
        [
          item({ str: '• Primeiro item', x: 0, hasEOL: true }),
          item({ str: '1. Segundo item', x: 0, hasEOL: true }),
        ],
      ],
    })

    const resultado = await converterPdfParaMarkdown(Buffer.from(''))

    expect(resultado).toBe('- Primeiro item\n\n1. Segundo item')
  })

  it('reconstrói tabela quando linhas consecutivas alinham em colunas', async () => {
    ;(extractTextItems as jest.Mock).mockResolvedValue({
      totalPages: 1,
      items: [
        [
          item({ str: 'Item', x: 0, width: 30, hasEOL: false }),
          item({ str: 'Valor', x: 100, width: 30, hasEOL: true }),
          item({ str: 'Storage', x: 0, width: 40, hasEOL: false }),
          item({ str: 'R$ 100', x: 100, width: 40, hasEOL: true }),
        ],
      ],
    })

    const resultado = await converterPdfParaMarkdown(Buffer.from(''))

    expect(resultado).toBe('| Item | Valor |\n| --- | --- |\n| Storage | R$ 100 |')
  })

  it('devolve string vazia quando não há texto extraído', async () => {
    ;(extractTextItems as jest.Mock).mockResolvedValue({ totalPages: 1, items: [[]] })

    const resultado = await converterPdfParaMarkdown(Buffer.from(''))

    expect(resultado).toBe('')
  })

  it('junta linhas quebradas (word-wrap) do mesmo parágrafo até achar pontuação final', async () => {
    ;(extractTextItems as jest.Mock).mockResolvedValue({
      totalPages: 1,
      items: [
        [
          item({ str: 'Este é um parágrafo que quebra em', x: 0, hasEOL: true }),
          item({ str: 'várias linhas dentro do mesmo PDF', x: 0, hasEOL: true }),
          item({ str: 'e só termina aqui.', x: 0, hasEOL: true }),
        ],
      ],
    })

    const resultado = await converterPdfParaMarkdown(Buffer.from(''))

    expect(resultado).toBe(
      'Este é um parágrafo que quebra em várias linhas dentro do mesmo PDF e só termina aqui.'
    )
  })

  it('não classifica frase longa como título mesmo com fonte maior (ruído de medição)', async () => {
    const fraseLonga =
      'Esta e uma frase de abertura razoavelmente longa pra simular ruido de medicao de fonte em um paragrafo de verdade do documento gerado.'
    ;(extractTextItems as jest.Mock).mockResolvedValue({
      totalPages: 1,
      items: [
        [
          item({ str: fraseLonga, x: 0, fontSize: 13, hasEOL: true }),
          item({ str: 'Primeira linha de corpo do texto normal aqui.', x: 0, fontSize: 10, hasEOL: true }),
          item({ str: 'Segunda linha de corpo do texto normal aqui.', x: 0, fontSize: 10, hasEOL: true }),
          item({ str: 'Terceira linha de corpo do texto normal aqui.', x: 0, fontSize: 10, hasEOL: true }),
          item({ str: 'Quarta linha de corpo do texto normal aqui.', x: 0, fontSize: 10, hasEOL: true }),
        ],
      ],
    })

    const resultado = await converterPdfParaMarkdown(Buffer.from(''))

    expect(resultado.startsWith('#')).toBe(false)
    expect(resultado).toContain(fraseLonga)
  })

  it('remove linhas de rodapé de paginação tipo "Page N of M"', async () => {
    ;(extractTextItems as jest.Mock).mockResolvedValue({
      totalPages: 2,
      items: [
        [item({ str: 'Texto da primeira página.', x: 0, hasEOL: true })],
        [
          item({ str: 'Page 1 of 15', x: 0, hasEOL: true }),
          item({ str: 'Texto da segunda página.', x: 0, hasEOL: true }),
        ],
      ],
    })

    const resultado = await converterPdfParaMarkdown(Buffer.from(''))

    expect(resultado).not.toContain('Page 1 of 15')
    expect(resultado).toBe('Texto da primeira página.\n\nTexto da segunda página.')
  })

  it('reconstrói tabela mesmo quando a quantidade de colunas detectadas varia entre as linhas (cabeçalho x dados)', async () => {
    ;(extractTextItems as jest.Mock).mockResolvedValue({
      totalPages: 1,
      items: [
        [
          // cabeçalho com só 1 gap grande (2 colunas detectadas)
          item({ str: 'PRODUTO', x: 0, width: 40, hasEOL: false }),
          item({ str: 'TOTAL', x: 150, width: 30, hasEOL: true }),
          // linha de dados com 2 gaps grandes (3 colunas detectadas)
          item({ str: 'Storage', x: 0, width: 40, hasEOL: false }),
          item({ str: '10', x: 80, width: 10, hasEOL: false }),
          item({ str: 'R$ 100', x: 150, width: 40, hasEOL: true }),
        ],
      ],
    })

    const resultado = await converterPdfParaMarkdown(Buffer.from(''))

    expect(resultado).toContain('| PRODUTO |')
    expect(resultado).toContain('| Storage | 10 | R$ 100 |')
  })
})
