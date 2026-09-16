import type { StructuredTextItem } from 'unpdf'

jest.mock('unpdf', () => ({
  getDocumentProxy: jest.fn().mockResolvedValue({}),
  extractTextItems: jest.fn(),
}))

jest.mock('./pdfTracos', () => ({
  extrairSegmentosRetosPorPagina: jest.fn(),
}))

jest.mock('./pdfImagens', () => ({
  extrairImagensDeConteudo: jest.fn().mockResolvedValue([]),
}))

jest.mock('./pdfFontes', () => ({
  obterEstilosDeFontePorPagina: jest.fn().mockResolvedValue([]),
}))

import { extractTextItems } from 'unpdf'
import { extrairSegmentosRetosPorPagina } from './pdfTracos'
import { extrairImagensDeConteudo } from './pdfImagens'
import { obterEstilosDeFontePorPagina } from './pdfFontes'
import { converterPdfParaHtml, agruparListasEmHtml } from './pdfHtml'

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

describe('agruparListasEmHtml', () => {
  it('junta blocos <li> consecutivos do MESMO nível num <ul> só', () => {
    const resultado = agruparListasEmHtml([
      '<p>Antes</p>',
      '<li data-nivel="0">Um</li>',
      '<li data-nivel="0">Dois</li>',
      '<p>Depois</p>',
    ])
    expect(resultado).toEqual(['<p>Antes</p>', '<ul><li>Um</li><li>Dois</li></ul>', '<p>Depois</p>'])
  })

  it('aninha o sub-<ul> DENTRO do <li> pai (nunca como irmão de <li> — HTML inválido)', () => {
    const resultado = agruparListasEmHtml([
      '<li data-nivel="0">Item 1</li>',
      '<li data-nivel="1">Sub 1.1</li>',
      '<li data-nivel="0">Item 2</li>',
    ])
    expect(resultado).toEqual([
      '<ul><li>Item 1<ul><li>Sub 1.1</li></ul></li><li>Item 2</li></ul>',
    ])
  })

  it('bloco sem <li> nenhum passa direto, sem <ul> nenhum', () => {
    expect(agruparListasEmHtml(['<p>Só texto</p>'])).toEqual(['<p>Só texto</p>'])
  })
})

describe('converterPdfParaHtml', () => {
  beforeEach(() => {
    ;(extrairSegmentosRetosPorPagina as jest.Mock).mockResolvedValue([{ segmentos: [], fracaoAreaComImagem: 0 }])
  })

  it('envolve trecho com fonte em negrito em <strong>...</strong>', async () => {
    // Texto escolhido de propósito pra não ter cara de título (ver describe
    // 'título com fonte igual ao corpo do texto' abaixo) e isolar só o negrito.
    // Negrito/itálico vêm de `pdfFontes.ts` (nome real da fonte, resolvido via
    // `commonObjs` do pdf.js) — não do `fontFamily` do `unpdf`, que é só uma
    // classificação CSS genérica (sans-serif/serif) sem peso nem estilo.
    ;(extractTextItems as jest.Mock).mockResolvedValue({
      totalPages: 1,
      items: [[item({ str: 'Texto em negrito', x: 0, hasEOL: true })]],
    })
    ;(obterEstilosDeFontePorPagina as jest.Mock).mockResolvedValueOnce([[{ negrito: true, italico: false }]])

    const { html: resultado } = await converterPdfParaHtml(Buffer.from(''))

    expect(resultado).toBe('<p><strong>Texto em negrito</strong></p>')
  })

  it('envolve trecho em itálico com <em>...</em>', async () => {
    ;(extractTextItems as jest.Mock).mockResolvedValue({
      totalPages: 1,
      items: [[item({ str: 'Termo em itálico', x: 0, hasEOL: true })]],
    })
    ;(obterEstilosDeFontePorPagina as jest.Mock).mockResolvedValueOnce([[{ negrito: false, italico: true }]])

    const { html: resultado } = await converterPdfParaHtml(Buffer.from(''))

    expect(resultado).toBe('<p><em>Termo em itálico</em></p>')
  })

  it('combina negrito e itálico em <strong><em>...</em></strong> quando os dois batem no mesmo trecho', async () => {
    ;(extractTextItems as jest.Mock).mockResolvedValue({
      totalPages: 1,
      items: [[item({ str: 'Muito importante', x: 0, hasEOL: true })]],
    })
    ;(obterEstilosDeFontePorPagina as jest.Mock).mockResolvedValueOnce([[{ negrito: true, italico: true }]])

    const { html: resultado } = await converterPdfParaHtml(Buffer.from(''))

    expect(resultado).toBe('<p><strong><em>Muito importante</em></strong></p>')
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

    const { html: resultado } = await converterPdfParaHtml(Buffer.from(''))

    expect(resultado).toBe(
      '<h1>Proposta Comercial</h1>\n\n<p>Corpo do texto normal.</p>\n\n<p>Mais uma linha de corpo.</p>'
    )
  })

  it('reconhece lista com marcador e mantém o número original da lista numerada', async () => {
    ;(extractTextItems as jest.Mock).mockResolvedValue({
      totalPages: 1,
      items: [
        [
          item({ str: '• Primeiro item', x: 0, y: 100, hasEOL: true }),
          item({ str: '1. Segundo item', x: 0, y: 80, hasEOL: true }),
        ],
      ],
    })

    const { html: resultado } = await converterPdfParaHtml(Buffer.from(''))

    // O item numerado sai como parágrafo com o número LITERAL — sem isso o
    // navegador renumeraria a partir de 1 (ver teste abaixo, "preserva a
    // numeração do PDF quando ela pula").
    expect(resultado).toBe('<ul><li>Primeiro item</li></ul>\n\n<p>1. Segundo item</p>')
  })

  it('preserva a numeração do PDF quando ela pula (1, 2, 4) em vez de renumerar', async () => {
    // Em contrato, "cláusula 4" tem que continuar sendo 4. Um <ol> de
    // verdade seria renumerado pelo navegador a partir de 1, 2, 3.
    ;(extractTextItems as jest.Mock).mockResolvedValue({
      totalPages: 1,
      items: [
        [
          item({ str: '1. Das partes.', x: 0, y: 100, hasEOL: true }),
          item({ str: '2. Do objeto.', x: 0, y: 80, hasEOL: true }),
          item({ str: '4. Da vigência.', x: 0, y: 60, hasEOL: true }),
        ],
      ],
    })

    const { html: resultado } = await converterPdfParaHtml(Buffer.from(''))

    expect(resultado).toBe('<p>1. Das partes.</p>\n\n<p>2. Do objeto.</p>\n\n<p>4. Da vigência.</p>')
  })

  it('indenta sub-item de lista conforme a posição X do marcador no PDF', async () => {
    ;(extractTextItems as jest.Mock).mockResolvedValue({
      totalPages: 1,
      items: [
        [
          item({ str: '• Serviço contratado', x: 42, y: 100, hasEOL: true }),
          item({ str: '• Detalhe do serviço', x: 56, y: 80, hasEOL: true }),
          item({ str: '• Outro serviço', x: 42, y: 60, hasEOL: true }),
          item({ str: '• Detalhe do outro', x: 56, y: 40, hasEOL: true }),
        ],
      ],
    })

    const { html: resultado } = await converterPdfParaHtml(Buffer.from(''))

    expect(resultado).toBe(
      '<ul><li>Serviço contratado<ul><li>Detalhe do serviço</li></ul></li>' +
        '<li>Outro serviço<ul><li>Detalhe do outro</li></ul></li></ul>'
    )
  })

  it('quebra um bloco que cresce demais sem pontuação final em vez de virar um parágrafo só', async () => {
    // Simula o caso real: uma tabela de preços que a detecção NÃO reconheceu
    // (nem por borda, nem por corredor — cada linha aqui é UM item só, sem
    // vão largo, de propósito, pra não disparar `temVaoLargo`) e cujas linhas
    // não terminam em pontuação final (comum em linha de tabela com código,
    // valor, quantidade). Sem a válvula de segurança, as 15 linhas virariam
    // UM parágrafo só, ilegível ao colar no SEI.
    const linhas = Array.from({ length: 15 }, (_, indice) =>
      item({ str: `linha ${indice} do bloco sem fechar frase`, x: 0, y: 200 - indice * 10, hasEOL: true })
    )
    ;(extractTextItems as jest.Mock).mockResolvedValue({ totalPages: 1, items: [linhas] })

    const { html: resultado } = await converterPdfParaHtml(Buffer.from(''))
    const blocos = resultado.split('\n\n')

    // 15 linhas, limite de 12 por bloco: quebra em dois parágrafos (12 + 3),
    // não um bloco só de 15 linhas grudadas.
    expect(blocos).toHaveLength(2)
    expect(blocos[0].split(' linha ').length).toBe(12) // 12 linhas no primeiro bloco
    expect(blocos[1].split(' linha ').length).toBe(3) // as 3 linhas restantes no segundo
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

    const { html: resultado } = await converterPdfParaHtml(Buffer.from(''))

    expect(resultado).toBe(
      '<table><thead><tr><th>Item</th><th>Valor</th></tr></thead>' +
        '<tbody><tr><td>Storage</td><td>R$ 100</td></tr></tbody></table>'
    )
  })

  it('devolve string vazia quando não há texto extraído', async () => {
    ;(extractTextItems as jest.Mock).mockResolvedValue({ totalPages: 1, items: [[]] })

    const { html: resultado } = await converterPdfParaHtml(Buffer.from(''))

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

    const { html: resultado } = await converterPdfParaHtml(Buffer.from(''))

    expect(resultado).toBe(
      '<p>Este é um parágrafo que quebra em várias linhas dentro do mesmo PDF e só termina aqui.</p>'
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

    const { html: resultado } = await converterPdfParaHtml(Buffer.from(''))

    expect(resultado.startsWith('<h')).toBe(false)
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

    const { html: resultado } = await converterPdfParaHtml(Buffer.from(''))

    expect(resultado).toContain('Page 1 of 15')
    expect(resultado).toBe('<p>Texto da primeira página.</p>\n\n<p>Page 1 of 15.</p>')
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

    const { html: resultado } = await converterPdfParaHtml(Buffer.from(''))

    expect(resultado).toContain('<th>PRODUTO</th>')
    expect(resultado).toContain('<td>Storage</td><td>10</td><td>R$ 100</td>')
  })

  it('envolve em <u>...</u> um trecho com traço horizontal logo abaixo da linha de base', async () => {
    ;(extractTextItems as jest.Mock).mockResolvedValue({
      totalPages: 1,
      items: [[item({ str: 'Cláusula sublinhada', x: 0, y: 100, width: 120, hasEOL: true })]],
    })
    ;(extrairSegmentosRetosPorPagina as jest.Mock).mockResolvedValue([
      { segmentos: [{ x1: 0, y1: 98, x2: 120, y2: 98 }], fracaoAreaComImagem: 0 },
    ])

    const { html: resultado } = await converterPdfParaHtml(Buffer.from(''))

    expect(resultado).toBe('<p><u>Cláusula sublinhada</u></p>')
  })

  it('não sublinha quando o traço abaixo não cobre boa parte da largura do trecho', async () => {
    ;(extractTextItems as jest.Mock).mockResolvedValue({
      totalPages: 1,
      items: [[item({ str: 'Texto normal', x: 0, y: 100, width: 120, hasEOL: true })]],
    })
    ;(extrairSegmentosRetosPorPagina as jest.Mock).mockResolvedValue([
      { segmentos: [{ x1: 0, y1: 98, x2: 20, y2: 98 }], fracaoAreaComImagem: 0 },
    ])

    const { html: resultado } = await converterPdfParaHtml(Buffer.from(''))

    expect(resultado).toBe('<p>Texto normal</p>')
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

    const { html: resultado } = await converterPdfParaHtml(Buffer.from(''))

    expect(resultado).toBe(
      '<h1 style="text-align:center">PROPOSTA COMERCIAL</h1>\n\n' +
        '<p>Corpo do texto que define a margem esquerda e direita do documento inteiro aqui.</p>'
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

    const { html: resultado } = await converterPdfParaHtml(Buffer.from(''))

    expect(resultado).toBe(
      '<p style="text-align:justify">Primeira linha que vai até a margem direita Segunda linha que também toca a mesma margem terceira e última linha, mais curta.</p>'
    )
  })

  describe('título com fonte igual (ou só um pouco maior) ao corpo do texto', () => {
    // Documentos reais às vezes têm seções inteiras (introdução, cláusulas finais)
    // onde corpo E título usam o mesmo tamanho de fonte — nesses casos só o
    // tamanho de fonte não separa título de frase comum, e o padrão de
    // capitalização (Title Case / TUDO EM MAIÚSCULAS) tem que decidir.

    it('reconhece título em Title Case mesmo com a MESMA fonte do corpo do texto', async () => {
      ;(extractTextItems as jest.Mock).mockResolvedValue({
        totalPages: 1,
        items: [
          [
            item({ str: 'A - Sistemas De Informação', x: 0, fontSize: 9, hasEOL: true }),
            item({ str: 'Texto de apoio pra fixar o corpo do documento em 9pt aqui.', x: 0, fontSize: 9, hasEOL: true }),
          ],
        ],
      })

      const { html: resultado } = await converterPdfParaHtml(Buffer.from(''))

      expect(resultado).toBe(
        '<h2>A - Sistemas De Informação</h2>\n\n<p>Texto de apoio pra fixar o corpo do documento em 9pt aqui.</p>'
      )
    })

    it('NÃO trata continuação de frase (minúscula) como título mesmo com fonte maior que o resto do documento', async () => {
      ;(extractTextItems as jest.Mock).mockResolvedValue({
        totalPages: 1,
        items: [
          [
            item({ str: 'O prazo de início dos serviços será na forma estabelecida no contrato', x: 0, fontSize: 11, hasEOL: true }),
            item({ str: 'administrativo, a ser formalizado entre as partes.', x: 0, fontSize: 11, hasEOL: true }),
            item({ str: 'Corpo do restante do documento em fonte menor.', x: 0, fontSize: 9, hasEOL: true }),
          ],
        ],
      })

      const { html: resultado } = await converterPdfParaHtml(Buffer.from(''))

      expect(resultado).not.toContain('<h2>')
      expect(resultado).toContain(
        'O prazo de início dos serviços será na forma estabelecida no contrato administrativo, a ser formalizado entre as partes.'
      )
    })

    it('não trata conjunção isolada (quebra de linha no meio de uma frase) como título', async () => {
      ;(extractTextItems as jest.Mock).mockResolvedValue({
        totalPages: 1,
        items: [
          [
            item({ str: 'Consulte o nosso catálogo de produtos para mais detalhes', x: 0, fontSize: 9, hasEOL: true }),
            item({ str: 'E 1 AVANÇADO', x: 0, fontSize: 9, hasEOL: true }),
            item({ str: 'Este é o produto mais vendido.', x: 0, fontSize: 9, hasEOL: true }),
          ],
        ],
      })

      const { html: resultado } = await converterPdfParaHtml(Buffer.from(''))

      expect(resultado).not.toContain('<h2>')
      expect(resultado).toBe(
        '<p>Consulte o nosso catálogo de produtos para mais detalhes E 1 AVANÇADO Este é o produto mais vendido.</p>'
      )
    })

    it('título nunca termina em pontuação final, mesmo com fonte bem maior que o corpo', async () => {
      ;(extractTextItems as jest.Mock).mockResolvedValue({
        totalPages: 1,
        items: [
          [
            item({ str: 'TÍTULO FALSO.', x: 0, fontSize: 20, hasEOL: true }),
            item({
              str: 'Corpo do texto normal aqui, com bastante conteúdo para dominar a contagem de caracteres do documento inteiro.',
              x: 0,
              fontSize: 10,
              hasEOL: true,
            }),
          ],
        ],
      })

      const { html: resultado } = await converterPdfParaHtml(Buffer.from(''))

      expect(resultado).not.toContain('<h1>')
      expect(resultado).not.toContain('<h2>')
      expect(resultado).toContain('TÍTULO FALSO.')
    })
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
      {
        segmentos: [
          { x1: 0, y1: 100, x2: 200, y2: 100 },
          { x1: 0, y1: 80, x2: 200, y2: 80 },
          { x1: 0, y1: 60, x2: 200, y2: 60 },
          { x1: 0, y1: 60, x2: 0, y2: 100 },
          { x1: 100, y1: 60, x2: 100, y2: 100 },
          { x1: 200, y1: 60, x2: 200, y2: 100 },
        ],
        fracaoAreaComImagem: 0,
      },
    ])

    const { html: resultado } = await converterPdfParaHtml(Buffer.from(''))

    expect(resultado).toBe(
      '<table><thead><tr><th>Item</th><th>Valor</th></tr></thead>' +
        '<tbody><tr><td>Storage</td><td>R$ 100</td></tr></tbody></table>'
    )
  })
})

describe('imagens do PDF no HTML', () => {
  beforeEach(() => {
    ;(extrairSegmentosRetosPorPagina as jest.Mock).mockResolvedValue([{ segmentos: [], fracaoAreaComImagem: 0 }])
    ;(extrairImagensDeConteudo as jest.Mock).mockResolvedValue([])
  })

  /** Uma figura qualquer, já "extraída": o que importa aqui é a posição, que
   *  decide em que ponto do texto ela entra. */
  function imagem(overrides: { pagina?: number; topo?: number; nomeArquivo?: string } = {}) {
    return {
      pagina: 0,
      x: 60,
      y: 300,
      largura: 480,
      altura: 320,
      topo: 620,
      larguraPx: 1025,
      alturaPx: 690,
      nomeArquivo: 'pagina-1-imagem-1.png',
      png: Buffer.from('png'),
      ...overrides,
    }
  }

  function textoEmDuasLinhas() {
    ;(extractTextItems as jest.Mock).mockResolvedValue({
      totalPages: 1,
      items: [
        [
          item({ str: 'Parágrafo antes da figura.', x: 0, y: 700, hasEOL: true }),
          item({ str: 'Parágrafo depois da figura.', x: 0, y: 200, hasEOL: true }),
        ],
      ],
    })
  }

  it('não toca no PDF em busca de imagem quando não recebe onde gravar', async () => {
    textoEmDuasLinhas()

    const { html: resultado } = await converterPdfParaHtml(Buffer.from(''))

    expect(extrairImagensDeConteudo).not.toHaveBeenCalled()
    expect(resultado).not.toContain('<img')
  })

  it('insere um marcador de OCR pendente na posição da figura, entre os parágrafos', async () => {
    // A imagem está numa página com bastante texto ao redor
    // (textoEmDuasLinhas) — cai em paginasComImagem, então vira marcador de
    // OCR pendente em vez de <img> muda (ver describe abaixo, "cobertura
    // estendida a imagem embutida").
    textoEmDuasLinhas()
    ;(extrairImagensDeConteudo as jest.Mock).mockResolvedValue([imagem()])

    const { html: resultado } = await converterPdfParaHtml(Buffer.from(''), {
      salvarImagem: async (img) => `https://storage.exemplo/${img.nomeArquivo}`,
    })

    expect(resultado).toBe(
      [
        '<p>Parágrafo antes da figura.</p>',
        '<div class="ocr-pendente" data-pagina="1"><p><em>(aguardando OCR)</em></p></div>',
        '<p>Parágrafo depois da figura.</p>',
      ].join('\n\n')
    )
  })

  it('põe no fim o marcador da figura que vem depois da última linha de texto', async () => {
    textoEmDuasLinhas()
    ;(extrairImagensDeConteudo as jest.Mock).mockResolvedValue([
      imagem({ topo: 100, nomeArquivo: 'pagina-1-imagem-1.png' }),
    ])

    const { html: resultado } = await converterPdfParaHtml(Buffer.from(''), {
      salvarImagem: async (img) => `https://storage.exemplo/${img.nomeArquivo}`,
    })

    expect(resultado.split('\n\n').at(-1)).toBe(
      '<div class="ocr-pendente" data-pagina="1"><p><em>(aguardando OCR)</em></p></div>'
    )
  })

  it('descarta a imagem que não conseguiu ser gravada, sem interromper a conversão', async () => {
    textoEmDuasLinhas()
    ;(extrairImagensDeConteudo as jest.Mock).mockResolvedValue([imagem()])

    const { html: resultado } = await converterPdfParaHtml(Buffer.from(''), { salvarImagem: async () => null })

    expect(resultado).not.toContain('<img')
    expect(resultado).not.toContain('ocr-pendente')
    expect(resultado).toContain('Parágrafo antes da figura.')
  })

  it('devolve o marcador da figura sem texto nenhum — página escaneada não pode virar HTML vazio', async () => {
    ;(extractTextItems as jest.Mock).mockResolvedValue({ totalPages: 1, items: [[]] })
    ;(extrairImagensDeConteudo as jest.Mock).mockResolvedValue([imagem()])

    const { html: resultado } = await converterPdfParaHtml(Buffer.from(''), {
      salvarImagem: async (img) => `https://storage.exemplo/${img.nomeArquivo}`,
    })

    expect(resultado).toBe('<div class="ocr-pendente" data-pagina="1"><p><em>(aguardando OCR)</em></p></div>')
  })
})

describe('tabela por posição (sem bordas desenhadas)', () => {
  beforeEach(() => {
    ;(extrairSegmentosRetosPorPagina as jest.Mock).mockResolvedValue([{ segmentos: [], fracaoAreaComImagem: 0 }])
    ;(extrairImagensDeConteudo as jest.Mock).mockResolvedValue([])
  })

  it('não transforma parágrafo justificado em tabela, mesmo com vãos largos entre as palavras', async () => {
    // Justificação estica os espaços entre palavras e abre vãos que passam do
    // limiar de coluna — mas eles caem num X diferente a cada linha, então não
    // sobra corredor nenhum atravessando o bloco.
    ;(extractTextItems as jest.Mock).mockResolvedValue({
      totalPages: 1,
      items: [
        [
          item({ str: 'A', x: 0, width: 12, y: 100 }),
          item({ str: 'arquitetura', x: 40, width: 80, y: 100, hasEOL: true }),
          item({ str: 'integra', x: 0, width: 60, y: 80 }),
          item({ str: 'o', x: 95, width: 10, y: 80 }),
          item({ str: 'sistema', x: 125, width: 55, y: 80, hasEOL: true }),
          item({ str: 'legado', x: 0, width: 50, y: 60 }),
          item({ str: 'por', x: 78, width: 25, y: 60 }),
          item({ str: 'meio.', x: 130, width: 40, y: 60, hasEOL: true }),
        ],
      ],
    })

    const { html: resultado } = await converterPdfParaHtml(Buffer.from(''))

    expect(resultado).not.toContain('<table')
    // E o parágrafo continua inteiro: antes, qualquer linha com vão largo
    // interrompia a absorção e picava o texto em vários blocos.
    expect(resultado).toContain('A arquitetura integra o sistema legado por meio.')
  })

  it('monta a tabela quando as colunas se alinham — o corredor atravessa todas as linhas', async () => {
    ;(extractTextItems as jest.Mock).mockResolvedValue({
      totalPages: 1,
      items: [
        [
          item({ str: 'Papel', x: 0, width: 40, y: 100 }),
          item({ str: 'Quantidade', x: 200, width: 70, y: 100, hasEOL: true }),
          item({ str: 'Gerente', x: 0, width: 55, y: 80 }),
          item({ str: '1', x: 200, width: 8, y: 80, hasEOL: true }),
        ],
      ],
    })

    const { html: resultado } = await converterPdfParaHtml(Buffer.from(''))

    expect(resultado).toBe(
      '<table><thead><tr><th>Papel</th><th>Quantidade</th></tr></thead>' +
        '<tbody><tr><td>Gerente</td><td>1</td></tr></tbody></table>'
    )
  })

  it('mantém como tabela a coluna alinhada à direita, que termina na margem em toda linha', async () => {
    // Tabela de preço: a última coluna é alinhada à direita e encosta na margem
    // em todas as linhas, exatamente como um parágrafo justificado. Descartar o
    // bloco por causa disso apagava a tabela financeira inteira da proposta.
    ;(extractTextItems as jest.Mock).mockResolvedValue({
      totalPages: 1,
      items: [
        [
          item({ str: 'out/26', x: 0, width: 45, y: 100 }),
          item({ str: 'R$ 636.663,98', x: 180, width: 90, y: 100, hasEOL: true }),
          item({ str: 'nov/26', x: 0, width: 45, y: 80 }),
          item({ str: 'R$ 930.663,56', x: 185, width: 85, y: 80, hasEOL: true }),
        ],
      ],
    })

    const { html: resultado } = await converterPdfParaHtml(Buffer.from(''))

    // Primeira linha vira cabeçalho (<th>) — mesma convenção de sempre
    // (a heurística de posição não sabe distinguir cabeçalho de dado,
    // trata a primeira linha do bloco como cabeçalho, igual já fazia no
    // Markdown com "| out/26 | ... |" na primeira linha da tabela).
    expect(resultado).toContain('<th>out/26</th><th>R$ 636.663,98</th>')
    expect(resultado).toContain('<td>nov/26</td><td>R$ 930.663,56</td>')
  })

  it('fecha a tabela na primeira linha de texto corrido, em vez de engolir o parágrafo seguinte', async () => {
    ;(extractTextItems as jest.Mock).mockResolvedValue({
      totalPages: 1,
      items: [
        [
          item({ str: 'Papel', x: 0, width: 40, y: 100 }),
          item({ str: 'Qtd', x: 200, width: 25, y: 100, hasEOL: true }),
          item({ str: 'Gerente', x: 0, width: 55, y: 80 }),
          item({ str: '1', x: 200, width: 8, y: 80, hasEOL: true }),
          // Linha de texto corrido: tem vão largo (entra como candidata), mas
          // atravessa o corredor da tabela e por isso não é absorvida.
          item({ str: 'acompanhamento', x: 60, width: 170, y: 60 }),
          item({ str: 'e.', x: 260, width: 10, y: 60, hasEOL: true }),
        ],
      ],
    })

    const { html: resultado } = await converterPdfParaHtml(Buffer.from(''))
    const blocos = resultado.split('\n\n')

    expect(blocos[0]).toBe(
      '<table><thead><tr><th>Papel</th><th>Qtd</th></tr></thead><tbody><tr><td>Gerente</td><td>1</td></tr></tbody></table>'
    )
    expect(blocos[1]).toBe('<p>acompanhamento e.</p>')
  })
})

describe('ordem de leitura', () => {
  // A ordem em que os itens saem do PDF é a ordem em que foram DESENHADOS, não
  // a ordem em que se lê a página. Estes testes fixam que o conversor reordena
  // pela posição — foi o que colocou o rodapé no topo de toda página e a tabela
  // do cronograma na seção errada da proposta que serviu de referência.
  beforeEach(() => {
    ;(extrairSegmentosRetosPorPagina as jest.Mock).mockResolvedValue([{ segmentos: [], fracaoAreaComImagem: 0 }])
  })

  it('coloca o rodapé no fim da página mesmo quando ele é o primeiro item desenhado', async () => {
    ;(extractTextItems as jest.Mock).mockResolvedValue({
      totalPages: 1,
      items: [
        [
          item({ str: 'Page 1 of 45', x: 278, y: 43, hasEOL: true }),
          item({ str: 'Introdução do documento.', x: 36, y: 700, hasEOL: true }),
          item({ str: 'Segundo parágrafo do documento.', x: 36, y: 680, hasEOL: true }),
        ],
      ],
    })

    const { html: resultado } = await converterPdfParaHtml(Buffer.from(''))

    expect(resultado.split('\n\n')).toEqual([
      '<p>Introdução do documento.</p>',
      '<p>Segundo parágrafo do documento.</p>',
      '<p>Page 1 of 45</p>',
    ])
  })

  it('ordena os trechos de uma linha pelo X, não pela ordem de desenho', async () => {
    // "R$" desenhado depois do valor e à esquerda dele: sem ordenar por X, sai
    // "279.663,46 R$".
    ;(extractTextItems as jest.Mock).mockResolvedValue({
      totalPages: 1,
      items: [
        [
          item({ str: '279.663,46', x: 130, width: 45, y: 655 }),
          item({ str: 'R$', x: 79, width: 14, y: 655, hasEOL: true }),
        ],
      ],
    })

    const { html: resultado } = await converterPdfParaHtml(Buffer.from(''))

    expect(resultado).toContain('R$ 279.663,46')
    expect(resultado).not.toContain('279.663,46 R$')
  })

  it('separa em duas linhas um trecho único que cola textos de alturas diferentes', async () => {
    // O pdf.js emite os dois num trecho só, sem EOL entre eles; pelo Y são um
    // título lá embaixo e a célula de uma tabela no topo da página.
    ;(extractTextItems as jest.Mock).mockResolvedValue({
      totalPages: 1,
      items: [
        [
          item({ str: 'TERMOS E CONDIÇÕES DE CONTRATAÇÃO', x: 36, y: 150 }),
          item({ str: 'Periodo', x: 19, y: 744, hasEOL: true }),
        ],
      ],
    })

    const blocos = (await converterPdfParaHtml(Buffer.from(''))).html.split('\n\n')

    expect(blocos).toHaveLength(2)
    expect(blocos[0]).toContain('Periodo')
    expect(blocos[0]).not.toContain('TERMOS')
    expect(blocos[1]).toContain('TERMOS E CONDIÇÕES DE CONTRATAÇÃO')
  })

  it('mantém a ordem de chegada quando os itens não têm posição que os distinga', async () => {
    // Garantia de que a ordenação é estável: PDF sem Y confiável não pode ser
    // embaralhado pela correção.
    ;(extractTextItems as jest.Mock).mockResolvedValue({
      totalPages: 1,
      items: [
        [
          item({ str: 'Primeira frase.', x: 0, y: 0, hasEOL: true }),
          item({ str: 'Segunda frase.', x: 0, y: 0, hasEOL: true }),
          item({ str: 'Terceira frase.', x: 0, y: 0, hasEOL: true }),
        ],
      ],
    })

    const { html: resultado } = await converterPdfParaHtml(Buffer.from(''))

    expect(resultado).toBe('<p>Primeira frase.</p>\n\n<p>Segunda frase.</p>\n\n<p>Terceira frase.</p>')
  })

  it('não marca como sublinhado o texto que só tem a borda da tabela embaixo', async () => {
    // A borda inferior da célula cai na mesma faixa onde um sublinhado seria
    // desenhado. Sem excluir a grade, toda célula sairia como <u>...</u>.
    ;(extrairSegmentosRetosPorPagina as jest.Mock).mockResolvedValue([
      {
        segmentos: [
          { x1: 0, y1: 110, x2: 300, y2: 110 },
          { x1: 0, y1: 95, x2: 300, y2: 95 },
          { x1: 0, y1: 78, x2: 300, y2: 78 },
          { x1: 0, y1: 78, x2: 0, y2: 110 },
          { x1: 150, y1: 78, x2: 150, y2: 110 },
          { x1: 300, y1: 78, x2: 300, y2: 110 },
        ],
        fracaoAreaComImagem: 0,
      },
    ])
    ;(extractTextItems as jest.Mock).mockResolvedValue({
      totalPages: 1,
      items: [
        [
          item({ str: 'Serviço', x: 10, width: 50, y: 98 }),
          item({ str: 'Valor', x: 160, width: 40, y: 98, hasEOL: true }),
          item({ str: 'Hospedagem', x: 10, width: 70, y: 81 }),
          item({ str: 'R$ 100', x: 160, width: 40, y: 81, hasEOL: true }),
        ],
      ],
    })

    const { html: resultado } = await converterPdfParaHtml(Buffer.from(''))

    expect(resultado).not.toContain('<u>')
  })
})

describe('detecção de página-imagem (fallback de OCR)', () => {
  it('página sem texto e imagem cobrindo quase tudo entra como marcador de OCR pendente na posição certa', async () => {
    ;(extractTextItems as jest.Mock).mockResolvedValue({
      totalPages: 2,
      items: [
        [item({ str: 'Texto normal da página 1.', x: 0, hasEOL: true })],
        [], // página 2: escaneada, pdf.js não extrai texto nenhum
      ],
    })
    ;(extrairSegmentosRetosPorPagina as jest.Mock).mockResolvedValue([
      { segmentos: [], fracaoAreaComImagem: 0 },
      { segmentos: [], fracaoAreaComImagem: 0.9 },
    ])

    const resultado = await converterPdfParaHtml(Buffer.from(''))

    expect(resultado.paginasImagem).toEqual([2])
    expect(resultado.html).toBe(
      '<p>Texto normal da página 1.</p>\n\n<div class="ocr-pendente" data-pagina="2"><p><em>(aguardando OCR)</em></p></div>'
    )
  })

  it('página com texto normal não entra em paginasImagem', async () => {
    ;(extractTextItems as jest.Mock).mockResolvedValue({
      totalPages: 1,
      items: [[item({ str: 'Texto normal, bastante longo pra passar do limiar de caracteres.', x: 0, hasEOL: true })]],
    })
    ;(extrairSegmentosRetosPorPagina as jest.Mock).mockResolvedValue([{ segmentos: [], fracaoAreaComImagem: 0.9 }])

    const resultado = await converterPdfParaHtml(Buffer.from(''))

    expect(resultado.paginasImagem).toEqual([])
  })

  it('texto ralo (abaixo do limiar) sem imagem grande não é marcado', async () => {
    ;(extractTextItems as jest.Mock).mockResolvedValue({
      totalPages: 1,
      items: [[item({ str: 'Pouco texto', x: 0, hasEOL: true })]],
    })
    ;(extrairSegmentosRetosPorPagina as jest.Mock).mockResolvedValue([{ segmentos: [], fracaoAreaComImagem: 0.1 }])

    const resultado = await converterPdfParaHtml(Buffer.from(''))

    expect(resultado.paginasImagem).toEqual([])
  })

  it('PDF 100% imagem não devolve html vazio — devolve um marcador por página', async () => {
    ;(extractTextItems as jest.Mock).mockResolvedValue({
      totalPages: 2,
      items: [[], []],
    })
    ;(extrairSegmentosRetosPorPagina as jest.Mock).mockResolvedValue([
      { segmentos: [], fracaoAreaComImagem: 1 },
      { segmentos: [], fracaoAreaComImagem: 1 },
    ])

    const resultado = await converterPdfParaHtml(Buffer.from(''))

    expect(resultado.html).toBe(
      '<div class="ocr-pendente" data-pagina="1"><p><em>(aguardando OCR)</em></p></div>\n\n' +
        '<div class="ocr-pendente" data-pagina="2"><p><em>(aguardando OCR)</em></p></div>'
    )
    expect(resultado.paginasImagem).toEqual([1, 2])
  })
})

describe('paginasConvertidas (texto original x HTML, por página)', () => {
  it('devolve texto original e html da página, pra página com texto normal', async () => {
    ;(extractTextItems as jest.Mock).mockResolvedValue({
      totalPages: 1,
      items: [[item({ str: 'Texto original da página.', x: 0, hasEOL: true })]],
    })
    ;(extrairSegmentosRetosPorPagina as jest.Mock).mockResolvedValue([{ segmentos: [], fracaoAreaComImagem: 0 }])

    const resultado = await converterPdfParaHtml(Buffer.from(''))

    expect(resultado.paginasConvertidas).toEqual([
      { pagina: 1, textoOriginal: 'Texto original da página.', html: '<p>Texto original da página.</p>' },
    ])
  })

  it('página marcada pra OCR não entra em paginasConvertidas', async () => {
    ;(extractTextItems as jest.Mock).mockResolvedValue({
      totalPages: 2,
      items: [
        [item({ str: 'Texto normal da página 1.', x: 0, hasEOL: true })],
        [], // página 2: escaneada
      ],
    })
    ;(extrairSegmentosRetosPorPagina as jest.Mock).mockResolvedValue([
      { segmentos: [], fracaoAreaComImagem: 0 },
      { segmentos: [], fracaoAreaComImagem: 0.9 },
    ])

    const resultado = await converterPdfParaHtml(Buffer.from(''))

    expect(resultado.paginasConvertidas.map((p) => p.pagina)).toEqual([1])
  })

  it('duas páginas com texto normal geram duas entradas, na ordem', async () => {
    ;(extractTextItems as jest.Mock).mockResolvedValue({
      totalPages: 2,
      items: [
        [item({ str: 'Primeira.', x: 0, hasEOL: true })],
        [item({ str: 'Segunda.', x: 0, hasEOL: true })],
      ],
    })
    ;(extrairSegmentosRetosPorPagina as jest.Mock).mockResolvedValue([
      { segmentos: [], fracaoAreaComImagem: 0 },
      { segmentos: [], fracaoAreaComImagem: 0 },
    ])

    const resultado = await converterPdfParaHtml(Buffer.from(''))

    expect(resultado.paginasConvertidas.map((p) => p.pagina)).toEqual([1, 2])
    expect(resultado.paginasConvertidas[1].textoOriginal).toBe('Segunda.')
  })
})

describe('paginasComImagem (aviso de imagem embutida)', () => {
  it('página com imagem de conteúdo entra em paginasComImagem', async () => {
    ;(extractTextItems as jest.Mock).mockResolvedValue({
      totalPages: 1,
      items: [[item({ str: 'Texto normal da página, com bastante conteúdo textual.', x: 0, hasEOL: true })]],
    })
    ;(extrairSegmentosRetosPorPagina as jest.Mock).mockResolvedValue([{ segmentos: [], fracaoAreaComImagem: 0 }])
    ;(extrairImagensDeConteudo as jest.Mock).mockResolvedValue([
      {
        pagina: 0,
        x: 0,
        y: 0,
        largura: 200,
        altura: 150,
        topo: 150,
        larguraPx: 400,
        alturaPx: 300,
        nomeArquivo: 'pagina-1-imagem-1.png',
        png: Buffer.from(''),
      },
    ])

    const resultado = await converterPdfParaHtml(Buffer.from(''), {
      salvarImagem: async () => 'https://storage.exemplo/img.png',
    })

    expect(resultado.paginasComImagem).toEqual([1])
  })

  it('imagem de conteúdo (página com texto normal) vira marcador de OCR pendente, não <img> muda', async () => {
    ;(extractTextItems as jest.Mock).mockResolvedValue({
      totalPages: 1,
      items: [[item({ str: 'Texto normal da página, com bastante conteúdo textual.', x: 0, hasEOL: true })]],
    })
    ;(extrairSegmentosRetosPorPagina as jest.Mock).mockResolvedValue([{ segmentos: [], fracaoAreaComImagem: 0 }])
    ;(extrairImagensDeConteudo as jest.Mock).mockResolvedValue([
      {
        pagina: 0,
        x: 0,
        y: 0,
        largura: 200,
        altura: 150,
        topo: 150,
        larguraPx: 400,
        alturaPx: 300,
        nomeArquivo: 'pagina-1-imagem-1.png',
        png: Buffer.from(''),
      },
    ])

    const resultado = await converterPdfParaHtml(Buffer.from(''), {
      salvarImagem: async () => 'https://storage.exemplo/img.png',
    })

    expect(resultado.html).toContain('<div class="ocr-pendente" data-pagina="1">')
    expect(resultado.html).not.toContain('<img')
  })

  it('página sem imagem não entra em paginasComImagem', async () => {
    ;(extractTextItems as jest.Mock).mockResolvedValue({
      totalPages: 1,
      items: [[item({ str: 'Texto normal, sem imagem nenhuma nessa página.', x: 0, hasEOL: true })]],
    })
    ;(extrairSegmentosRetosPorPagina as jest.Mock).mockResolvedValue([{ segmentos: [], fracaoAreaComImagem: 0 }])
    ;(extrairImagensDeConteudo as jest.Mock).mockResolvedValue([])

    const resultado = await converterPdfParaHtml(Buffer.from(''))

    expect(resultado.paginasComImagem).toEqual([])
  })

  it('imagem numa página marcada pra OCR não duplica em paginasComImagem', async () => {
    ;(extractTextItems as jest.Mock).mockResolvedValue({ totalPages: 1, items: [[]] }) // página escaneada
    ;(extrairSegmentosRetosPorPagina as jest.Mock).mockResolvedValue([{ segmentos: [], fracaoAreaComImagem: 0.9 }])
    ;(extrairImagensDeConteudo as jest.Mock).mockResolvedValue([
      {
        pagina: 0,
        x: 0,
        y: 0,
        largura: 500,
        altura: 700,
        topo: 700,
        larguraPx: 1000,
        alturaPx: 1400,
        nomeArquivo: 'pagina-1-imagem-1.png',
        png: Buffer.from(''),
      },
    ])

    const resultado = await converterPdfParaHtml(Buffer.from(''), {
      salvarImagem: async () => 'https://storage.exemplo/img.png',
    })

    expect(resultado.paginasImagem).toEqual([1]) // vai pro fluxo de OCR
    expect(resultado.paginasComImagem).toEqual([]) // não duplica aviso aqui
  })
})
