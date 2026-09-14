import { rodarOcrEmBlocos } from './rodarOcr'

describe('rodarOcrEmBlocos', () => {
  it('reconhece cada página pendente e preenche o corpo, mantendo o wrapper', async () => {
    const html =
      '<p>X</p>' +
      '<div class="ocr-pendente" data-arquivo-id="a1" data-pagina="1"><p><em>(aguardando OCR)</em></p></div>' +
      '<p>Y</p>'
    const renderizarPagina = jest.fn().mockResolvedValue('data:image/png;base64,xyz')
    const reconhecer = jest.fn().mockResolvedValue('Texto reconhecido.')

    const resultado = await rodarOcrEmBlocos(html, { renderizarPagina, reconhecer })

    expect(resultado).toBe(
      '<p>X</p>' +
        '<div class="ocr-pendente" data-arquivo-id="a1" data-pagina="1">Texto reconhecido.</div>' +
        '<p>Y</p>'
    )
    expect(renderizarPagina).toHaveBeenCalledWith('a1', 1)
    expect(reconhecer).toHaveBeenCalledWith('data:image/png;base64,xyz')
  })

  it('processa vários blocos, um a um, reportando progresso', async () => {
    const html =
      '<div class="ocr-pendente" data-arquivo-id="a1" data-pagina="1"><p><em>(aguardando OCR)</em></p></div>' +
      '<div class="ocr-pendente" data-arquivo-id="a1" data-pagina="2"><p><em>(aguardando OCR)</em></p></div>'
    const renderizarPagina = jest.fn().mockResolvedValue('img')
    const reconhecer = jest.fn().mockResolvedValueOnce('Página um.').mockResolvedValueOnce('Página dois.')
    const progresso: { pagina: number; total: number }[] = []

    const resultado = await rodarOcrEmBlocos(html, {
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
    const html =
      '<div class="ocr-pendente" data-arquivo-id="a1" data-pagina="1"><p><em>(aguardando OCR)</em></p></div>' +
      '<div class="ocr-pendente" data-arquivo-id="a1" data-pagina="2"><p><em>(aguardando OCR)</em></p></div>'
    const renderizarPagina = jest.fn().mockResolvedValue('img')
    const reconhecer = jest.fn().mockRejectedValueOnce(new Error('falhou')).mockResolvedValueOnce('Página dois.')

    const resultado = await rodarOcrEmBlocos(html, { renderizarPagina, reconhecer })

    expect(resultado).toContain('OCR falhou nesta página')
    expect(resultado).toContain('Página dois.')
  })

  it('html sem bloco pendente devolve o texto inalterado', async () => {
    const resultado = await rodarOcrEmBlocos('<p>texto sem marcador</p>', {
      renderizarPagina: jest.fn(),
      reconhecer: jest.fn(),
    })

    expect(resultado).toBe('<p>texto sem marcador</p>')
  })
})
