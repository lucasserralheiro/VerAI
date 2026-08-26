import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { PropostaFinal } from './proposta-final'

class ClipboardItemFalso {
  constructor(public items: Record<string, Blob>) {}
}

describe('PropostaFinal', () => {
  beforeEach(() => {
    ;(global as unknown as { ClipboardItem: typeof ClipboardItemFalso }).ClipboardItem = ClipboardItemFalso
    Object.assign(navigator, { clipboard: { write: jest.fn().mockResolvedValue(undefined) } })
  })

  it('mostra o preview renderizado do markdown', () => {
    render(<PropostaFinal conteudoMarkdown="# Proposta" onEditarNovamente={jest.fn()} />)
    expect(screen.getByRole('heading', { name: 'Proposta' })).toBeInTheDocument()
  })

  it('copia o conteúdo formatado (HTML + texto simples) pro clipboard e mostra "Copiado!" temporariamente', async () => {
    jest.useFakeTimers()
    render(<PropostaFinal conteudoMarkdown="# Proposta" onEditarNovamente={jest.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: /Copiar formatado/ }))

    await waitFor(() => expect(navigator.clipboard.write).toHaveBeenCalled())
    const itemCopiado = (navigator.clipboard.write as jest.Mock).mock.calls[0][0][0] as ClipboardItemFalso
    expect(itemCopiado.items['text/html']).toBeInstanceOf(Blob)
    expect(itemCopiado.items['text/plain']).toBeInstanceOf(Blob)
    expect(await screen.findByRole('button', { name: /Copiado!/ })).toBeInTheDocument()

    act(() => {
      jest.advanceTimersByTime(2000)
    })
    expect(screen.getByRole('button', { name: /Copiar formatado/ })).toBeInTheDocument()

    jest.useRealTimers()
  })

  it('chama onEditarNovamente ao clicar em "Editar novamente"', () => {
    const onEditarNovamente = jest.fn()
    render(<PropostaFinal conteudoMarkdown="# Proposta" onEditarNovamente={onEditarNovamente} />)

    fireEvent.click(screen.getByRole('button', { name: 'Editar novamente' }))

    expect(onEditarNovamente).toHaveBeenCalled()
  })
})
