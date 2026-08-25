import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { MarkdownFinal } from './markdown-final'

describe('MarkdownFinal', () => {
  beforeEach(() => {
    Object.assign(navigator, { clipboard: { writeText: jest.fn().mockResolvedValue(undefined) } })
  })

  it('mostra o markdown final somente leitura', () => {
    render(<MarkdownFinal conteudoMarkdown="# Proposta" />)
    expect(screen.getByText('# Proposta')).toBeInTheDocument()
  })

  it('copia o markdown pro clipboard e mostra "Copiado!" temporariamente', async () => {
    jest.useFakeTimers()
    render(<MarkdownFinal conteudoMarkdown="# Proposta" />)

    fireEvent.click(screen.getByRole('button', { name: /Copiar tudo/ }))

    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith('# Proposta'))
    expect(await screen.findByRole('button', { name: /Copiado!/ })).toBeInTheDocument()

    act(() => {
      jest.advanceTimersByTime(2000)
    })
    expect(screen.getByRole('button', { name: /Copiar tudo/ })).toBeInTheDocument()

    jest.useRealTimers()
  })
})
