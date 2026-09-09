import type { StructuredTextItem } from 'unpdf'

jest.mock('unpdf', () => ({
  getDocumentProxy: jest.fn().mockResolvedValue({}),
  extractTextItems: jest.fn(),
}))

jest.mock('./pdfTracos', () => ({
  extrairSegmentosRetosPorPagina: jest.fn(),
}))

import { extractTextItems } from 'unpdf'
import { extrairSegmentosRetosPorPagina } from './pdfTracos'
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
  beforeEach(() => {
    ;(extrairSegmentosRetosPorPagina as jest.Mock).mockResolvedValue([[]])
  })

  it('envolve trecho com fonte em negrito em **...**', async () => {
    ;(extractTextItems as jest.Mock).mockResolvedValue({
      totalPages: 1,
      items: [[item({ str: 'Cláusula 1', x: 0, fontFamily: 'Helvetica-Bold', hasEOL: true })]],
    })

    const resultado = await converterPdfParaMarkdown(Buffer.from(''))

    expect(resultado).toBe('**Cláusula 1**')
  })

  it('envolve trecho em itálico com *...*', async () => {
    ;(extractTextItems as jest.Mock).mockResolvedValue({
      totalPages: 1,
      items: [[item({ str: 'Termo em itálico', x: 0, fontFamily: 'Helvetica-Oblique', hasEOL: true })]],
    })

    const resultado = await converterPdfParaMarkdown(Buffer.from(''))

    expect(resultado).toBe('*Termo em itálico*')
  })

  it('combina negrito e itálico em ***...*** quando os dois batem no mesmo trecho', async () => {
    ;(extractTextItems as jest.Mock).mockResolvedValue({
      totalPages: 1,
      items: [[item({ str: 'Muito importante', x: 0, fontFamily: 'Helvetica-BoldOblique', hasEOL: true })]],
    })

    const resultado = await converterPdfParaMarkdown(Buffer.from(''))

    expect(resultado).toBe('***Muito importante***')
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

  it('preserva rodapé de paginação ("Page N of M") — nada é descartado do original', async () => {
    ;(extractTextItems as jest.Mock).mockResolvedValue({
      totalPages: 1,
      items: [
        [
          item({ str: 'Texto da primeira página.', x: 0, hasEOL: true }),
          item({ str: 'Page 1 of 15.', x: 0, hasEOL: true }),
        ],
      ],
    })

    const resultado = await converterPdfParaMarkdown(Buffer.from(''))

    expect(resultado).toContain('Page 1 of 15')
    expect(resultado).toBe('Texto da primeira página.\n\nPage 1 of 15.')
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

  it('envolve em <u>...</u> um trecho com traço horizontal logo abaixo da linha de base', async () => {
    ;(extractTextItems as jest.Mock).mockResolvedValue({
      totalPages: 1,
      items: [[item({ str: 'Cláusula sublinhada', x: 0, y: 100, width: 120, hasEOL: true })]],
    })
    ;(extrairSegmentosRetosPorPagina as jest.Mock).mockResolvedValue([[{ x1: 0, y1: 98, x2: 120, y2: 98 }]])

    const resultado = await converterPdfParaMarkdown(Buffer.from(''))

    expect(resultado).toBe('<u>Cláusula sublinhada</u>')
  })

  it('não sublinha quando o traço abaixo não cobre boa parte da largura do trecho', async () => {
    ;(extractTextItems as jest.Mock).mockResolvedValue({
      totalPages: 1,
      items: [[item({ str: 'Texto normal', x: 0, y: 100, width: 120, hasEOL: true })]],
    })
    ;(extrairSegmentosRetosPorPagina as jest.Mock).mockResolvedValue([[{ x1: 0, y1: 98, x2: 20, y2: 98 }]])

    const resultado = await converterPdfParaMarkdown(Buffer.from(''))

    expect(resultado).toBe('Texto normal')
  })

  it('centraliza título curto quando a folga é parecida dos dois lados', async () => {
    ;(extractTextItems as jest.Mock).mockResolvedValue({
      totalPages: 1,
      items: [
        [item({ str: 'PROPOSTA COMERCIAL', x: 200, width: 195, fontSize: 20, hasEOL: true })],
        [
          item({
            str: 'Corpo do texto que define a margem esquerda e direita do documento inteiro aqui.',
            x: 40,
            width: 515,
            fontSize: 10,
            hasEOL: true,
          }),
        ],
      ],
    })

    const resultado = await converterPdfParaMarkdown(Buffer.from(''))

    expect(resultado).toBe(
      '<h1 align="center">PROPOSTA COMERCIAL</h1>\n\nCorpo do texto que define a margem esquerda e direita do documento inteiro aqui.'
    )
  })

  it('marca parágrafo de várias linhas como justificado quando todas as linhas menos a última tocam a margem direita', async () => {
    ;(extractTextItems as jest.Mock).mockResolvedValue({
      totalPages: 1,
      items: [
        [
          item({ str: 'Primeira linha que vai até a margem direita', x: 40, width: 515, hasEOL: true }),
          item({ str: 'Segunda linha que também toca a mesma margem', x: 40, width: 515, hasEOL: true }),
          item({ str: 'terceira e última linha, mais curta.', x: 40, width: 200, hasEOL: true }),
        ],
      ],
    })

    const resultado = await converterPdfParaMarkdown(Buffer.from(''))

    expect(resultado).toBe(
      '<p align="justify">Primeira linha que vai até a margem direita Segunda linha que também toca a mesma margem terceira e última linha, mais curta.</p>'
    )
  })

  it('reconstrói tabela a partir de bordas vetoriais desenhadas no PDF', async () => {
    ;(extractTextItems as jest.Mock).mockResolvedValue({
      totalPages: 1,
      items: [
        [
          item({ str: 'Item', x: 10, width: 30, y: 90, hasEOL: false }),
          item({ str: 'Valor', x: 110, width: 30, y: 90, hasEOL: true }),
          item({ str: 'Storage', x: 10, width: 40, y: 70, hasEOL: false }),
          item({ str: 'R$ 100', x: 110, width: 40, y: 70, hasEOL: true }),
        ],
      ],
    })
    ;(extrairSegmentosRetosPorPagina as jest.Mock).mockResolvedValue([
      [
        { x1: 0, y1: 100, x2: 200, y2: 100 },
        { x1: 0, y1: 80, x2: 200, y2: 80 },
        { x1: 0, y1: 60, x2: 200, y2: 60 },
        { x1: 0, y1: 60, x2: 0, y2: 100 },
        { x1: 100, y1: 60, x2: 100, y2: 100 },
        { x1: 200, y1: 60, x2: 200, y2: 100 },
      ],
    ])

    const resultado = await converterPdfParaMarkdown(Buffer.from(''))

    expect(resultado).toBe('| Item | Valor |\n| --- | --- |\n| Storage | R$ 100 |')
  })
})
