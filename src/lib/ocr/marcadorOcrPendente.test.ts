import {
  formatarBlocoOcrPendente,
  listarBlocosOcrPendente,
  reescreverComArquivoId,
  substituirCorpo,
  removerWrapper,
  temBlocoOcrPendente,
} from './marcadorOcrPendente'

describe('formatarBlocoOcrPendente', () => {
  it('sem arquivoId gera só [pagina=N]', () => {
    expect(formatarBlocoOcrPendente(3)).toBe(':::ocr-pendente[pagina=3]\n_(aguardando OCR)_\n:::')
  })

  it('com arquivoId gera [arquivoId=... pagina=N]', () => {
    expect(formatarBlocoOcrPendente(3, 'arq1')).toBe(':::ocr-pendente[arquivoId=arq1 pagina=3]\n_(aguardando OCR)_\n:::')
  })

  it('aceita corpo customizado', () => {
    expect(formatarBlocoOcrPendente(1, 'arq1', 'texto reconhecido')).toBe(
      ':::ocr-pendente[arquivoId=arq1 pagina=1]\ntexto reconhecido\n:::'
    )
  })
})

describe('listarBlocosOcrPendente', () => {
  it('encontra um bloco no meio do texto e extrai arquivoId/pagina/corpo', () => {
    const markdown = 'Antes.\n\n:::ocr-pendente[arquivoId=arq1 pagina=2]\n_(aguardando OCR)_\n:::\n\nDepois.'

    const blocos = listarBlocosOcrPendente(markdown)

    expect(blocos).toEqual([
      {
        blocoCompleto: ':::ocr-pendente[arquivoId=arq1 pagina=2]\n_(aguardando OCR)_\n:::',
        arquivoId: 'arq1',
        pagina: 2,
        corpo: '_(aguardando OCR)_',
      },
    ])
  })

  it('encontra vários blocos, em ordem', () => {
    const markdown = ':::ocr-pendente[pagina=1]\nA\n:::\n\ntexto\n\n:::ocr-pendente[pagina=2]\nB\n:::'

    expect(listarBlocosOcrPendente(markdown).map((b) => b.pagina)).toEqual([1, 2])
  })

  it('sem bloco nenhum devolve lista vazia', () => {
    expect(listarBlocosOcrPendente('texto qualquer sem marcador')).toEqual([])
  })

  it('arquivoId ausente vira null', () => {
    const markdown = ':::ocr-pendente[pagina=5]\ncorpo\n:::'

    expect(listarBlocosOcrPendente(markdown)[0].arquivoId).toBeNull()
  })
})

describe('reescreverComArquivoId', () => {
  it('adiciona arquivoId a todos os blocos sem ele', () => {
    const markdown = ':::ocr-pendente[pagina=1]\nA\n:::\n\n:::ocr-pendente[pagina=2]\nB\n:::'

    const resultado = reescreverComArquivoId(markdown, 'arq9')

    expect(resultado).toBe(':::ocr-pendente[arquivoId=arq9 pagina=1]\nA\n:::\n\n:::ocr-pendente[arquivoId=arq9 pagina=2]\nB\n:::')
  })

  it('texto sem marcador não muda', () => {
    expect(reescreverComArquivoId('texto normal', 'arq9')).toBe('texto normal')
  })
})

describe('substituirCorpo', () => {
  it('troca só o corpo, mantendo o wrapper e o arquivoId', () => {
    const markdown = 'X\n\n:::ocr-pendente[arquivoId=arq1 pagina=2]\n_(aguardando OCR)_\n:::\n\nY'
    const bloco = listarBlocosOcrPendente(markdown)[0]

    const resultado = substituirCorpo(markdown, bloco, 'Texto reconhecido pelo OCR.')

    expect(resultado).toBe('X\n\n:::ocr-pendente[arquivoId=arq1 pagina=2]\nTexto reconhecido pelo OCR.\n:::\n\nY')
  })
})

describe('removerWrapper', () => {
  it('substitui o bloco inteiro pelo texto final, sem sobrar marcador', () => {
    const markdown = 'X\n\n:::ocr-pendente[arquivoId=arq1 pagina=2]\nTexto reconhecido.\n:::\n\nY'
    const bloco = listarBlocosOcrPendente(markdown)[0]

    const resultado = removerWrapper(markdown, bloco, 'Texto reconhecido e conferido.')

    expect(resultado).toBe('X\n\nTexto reconhecido e conferido.\n\nY')
    expect(temBlocoOcrPendente(resultado)).toBe(false)
  })
})

describe('temBlocoOcrPendente', () => {
  it('true quando existe marcador', () => {
    expect(temBlocoOcrPendente(':::ocr-pendente[pagina=1]\nA\n:::')).toBe(true)
  })

  it('false em texto normal', () => {
    expect(temBlocoOcrPendente('texto qualquer')).toBe(false)
  })
})
