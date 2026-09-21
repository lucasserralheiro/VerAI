import {
  formatarBlocoOcrPendente,
  listarBlocosOcrPendente,
  reescreverComArquivoId,
  substituirCorpo,
  removerWrapper,
  temBlocoOcrPendente,
} from './marcadorOcrPendente'

describe('formatarBlocoOcrPendente', () => {
  it('sem arquivoId gera só data-pagina', () => {
    expect(formatarBlocoOcrPendente(3)).toBe(
      '<div class="ocr-pendente" data-pagina="3"><p><em>(aguardando OCR)</em></p></div>'
    )
  })

  it('com arquivoId gera data-arquivo-id e data-pagina', () => {
    expect(formatarBlocoOcrPendente(3, 'arq1')).toBe(
      '<div class="ocr-pendente" data-arquivo-id="arq1" data-pagina="3"><p><em>(aguardando OCR)</em></p></div>'
    )
  })

  it('aceita corpo customizado', () => {
    expect(formatarBlocoOcrPendente(1, 'arq1', '<p>texto reconhecido</p>')).toBe(
      '<div class="ocr-pendente" data-arquivo-id="arq1" data-pagina="1"><p>texto reconhecido</p></div>'
    )
  })
})

describe('listarBlocosOcrPendente', () => {
  it('encontra um bloco no meio do texto e extrai arquivoId/pagina/corpo', () => {
    const html =
      '<p>Antes.</p>' +
      '<div class="ocr-pendente" data-arquivo-id="arq1" data-pagina="2"><p><em>(aguardando OCR)</em></p></div>' +
      '<p>Depois.</p>'

    const blocos = listarBlocosOcrPendente(html)

    expect(blocos).toEqual([
      {
        blocoCompleto: '<div class="ocr-pendente" data-arquivo-id="arq1" data-pagina="2"><p><em>(aguardando OCR)</em></p></div>',
        arquivoId: 'arq1',
        pagina: 2,
        corpo: '<p><em>(aguardando OCR)</em></p>',
      },
    ])
  })

  it('encontra vários blocos, em ordem', () => {
    const html =
      '<div class="ocr-pendente" data-pagina="1">A</div>' +
      '<p>texto</p>' +
      '<div class="ocr-pendente" data-pagina="2">B</div>'

    expect(listarBlocosOcrPendente(html).map((b) => b.pagina)).toEqual([1, 2])
  })

  it('sem bloco nenhum devolve lista vazia', () => {
    expect(listarBlocosOcrPendente('<p>texto qualquer sem marcador</p>')).toEqual([])
  })

  it('arquivoId ausente vira null', () => {
    const html = '<div class="ocr-pendente" data-pagina="5">corpo</div>'

    expect(listarBlocosOcrPendente(html)[0].arquivoId).toBeNull()
  })
})

describe('reescreverComArquivoId', () => {
  it('adiciona arquivoId a todos os blocos sem ele', () => {
    const html = '<div class="ocr-pendente" data-pagina="1">A</div><div class="ocr-pendente" data-pagina="2">B</div>'

    const resultado = reescreverComArquivoId(html, 'arq9')

    expect(resultado).toBe(
      '<div class="ocr-pendente" data-arquivo-id="arq9" data-pagina="1">A</div>' +
        '<div class="ocr-pendente" data-arquivo-id="arq9" data-pagina="2">B</div>'
    )
  })

  it('texto sem marcador não muda', () => {
    expect(reescreverComArquivoId('<p>texto normal</p>', 'arq9')).toBe('<p>texto normal</p>')
  })
})

describe('substituirCorpo', () => {
  it('troca só o corpo, mantendo o wrapper e o arquivoId', () => {
    const html =
      '<p>X</p>' +
      '<div class="ocr-pendente" data-arquivo-id="arq1" data-pagina="2"><p><em>(aguardando OCR)</em></p></div>' +
      '<p>Y</p>'
    const bloco = listarBlocosOcrPendente(html)[0]

    const resultado = substituirCorpo(html, bloco, '<p>Texto reconhecido pelo OCR.</p>')

    expect(resultado).toBe(
      '<p>X</p>' +
        '<div class="ocr-pendente" data-arquivo-id="arq1" data-pagina="2"><p>Texto reconhecido pelo OCR.</p></div>' +
        '<p>Y</p>'
    )
  })

  it('não interpreta "$" do texto do OCR como padrão especial de replace (proposta comercial tem "R$" toda hora)', () => {
    const html =
      '<div class="ocr-pendente" data-arquivo-id="arq1" data-pagina="1"><p><em>(aguardando OCR)</em></p></div>'
    const bloco = listarBlocosOcrPendente(html)[0]

    const resultado = substituirCorpo(html, bloco, "<p>Valor: R$100. Referência: $&amp;/$$/$'/$`.</p>")

    expect(resultado).toBe(
      '<div class="ocr-pendente" data-arquivo-id="arq1" data-pagina="1">' +
        "<p>Valor: R$100. Referência: $&amp;/$$/$'/$`.</p>" +
        '</div>'
    )
  })
})

describe('removerWrapper', () => {
  it('substitui o bloco inteiro pelo HTML final, sem sobrar marcador', () => {
    const html =
      '<p>X</p>' +
      '<div class="ocr-pendente" data-arquivo-id="arq1" data-pagina="2"><p>Texto reconhecido.</p></div>' +
      '<p>Y</p>'
    const bloco = listarBlocosOcrPendente(html)[0]

    const resultado = removerWrapper(html, bloco, '<p>Texto reconhecido e conferido.</p>')

    expect(resultado).toBe('<p>X</p><p>Texto reconhecido e conferido.</p><p>Y</p>')
    expect(temBlocoOcrPendente(resultado)).toBe(false)
  })

  it('não interpreta "$" do texto conferido como padrão especial de replace', () => {
    const html =
      '<p>X</p>' +
      '<div class="ocr-pendente" data-arquivo-id="arq1" data-pagina="2"><p>Texto reconhecido.</p></div>' +
      '<p>Y</p>'
    const bloco = listarBlocosOcrPendente(html)[0]

    const resultado = removerWrapper(html, bloco, "<p>Total: R$1.000,00 ($$/$&amp;).</p>")

    expect(resultado).toBe('<p>X</p><p>Total: R$1.000,00 ($$/$&amp;).</p><p>Y</p>')
  })
})

describe('temBlocoOcrPendente', () => {
  it('true quando existe marcador', () => {
    expect(temBlocoOcrPendente('<div class="ocr-pendente" data-pagina="1">A</div>')).toBe(true)
  })

  it('false em texto normal', () => {
    expect(temBlocoOcrPendente('<p>texto qualquer</p>')).toBe(false)
  })
})
