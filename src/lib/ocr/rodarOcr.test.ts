import { rodarOcrEmBlocos } from './rodarOcr'

describe('rodarOcrEmBlocos', () => {
  it('reconhece cada página pendente e preenche o corpo, mantendo o wrapper', async () => {
    const markdown = 'X\n\n:::ocr-pendente[arquivoId=a1 pagina=1]\n_(aguardando OCR)_\n:::\n\nY'
    const renderizarPagina = jest.fn().mockResolvedValue('data:image/png;base64,xyz')
    const reconhecer = jest.fn().mockResolvedValue('Texto reconhecido.')

    const resultado = await rodarOcrEmBlocos(markdown, { renderizarPagina, reconhecer })

    expect(resultado).toBe('X\n\n:::ocr-pendente[arquivoId=a1 pagina=1]\nTexto reconhecido.\n:::\n\nY')
    expect(renderizarPagina).toHaveBeenCalledWith('a1', 1)
    expect(reconhecer).toHaveBeenCalledWith('data:image/png;base64,xyz')
  })

  it('processa vários blocos, um a um, reportando progresso', async () => {
    const markdown =
      ':::ocr-pendente[arquivoId=a1 pagina=1]\n_(aguardando OCR)_\n:::\n\n:::ocr-pendente[arquivoId=a1 pagina=2]\n_(aguardando OCR)_\n:::'
    const renderizarPagina = jest.fn().mockResolvedValue('img')
    const reconhecer = jest.fn().mockResolvedValueOnce('Página um.').mockResolvedValueOnce('Página dois.')
    const progresso: { pagina: number; total: number }[] = []

    const resultado = await rodarOcrEmBlocos(markdown, {
      renderizarPagina,
      reconhecer,
      onProgresso: (p) => progresso.push(p),
    })

    expect(resultado).toContain('Página um.')
    expect(resultado).toContain('Página dois.')
    expect(progresso).toEqual([
      { pagina: 1, total: 2 },
      { pagina: 2, total: 2 },
    ])
  })

  it('erro numa página não aborta as outras — vira aviso de falha só naquela página', async () => {
    const markdown =
      ':::ocr-pendente[arquivoId=a1 pagina=1]\n_(aguardando OCR)_\n:::\n\n:::ocr-pendente[arquivoId=a1 pagina=2]\n_(aguardando OCR)_\n:::'
    const renderizarPagina = jest.fn().mockResolvedValue('img')
    const reconhecer = jest.fn().mockRejectedValueOnce(new Error('falhou')).mockResolvedValueOnce('Página dois.')

    const resultado = await rodarOcrEmBlocos(markdown, { renderizarPagina, reconhecer })

    expect(resultado).toContain('OCR falhou nesta página')
    expect(resultado).toContain('Página dois.')
  })

  it('markdown sem bloco pendente devolve o texto inalterado', async () => {
    const resultado = await rodarOcrEmBlocos('texto sem marcador', {
      renderizarPagina: jest.fn(),
      reconhecer: jest.fn(),
    })

    expect(resultado).toBe('texto sem marcador')
  })
})
