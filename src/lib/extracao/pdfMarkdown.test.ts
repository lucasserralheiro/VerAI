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
})
