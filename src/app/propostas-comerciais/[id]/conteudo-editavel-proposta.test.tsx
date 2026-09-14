import { render, screen, fireEvent, act } from '@testing-library/react'
import { ConteudoEditavelProposta } from './conteudo-editavel-proposta'

function pegarEditor() {
  return screen.getByRole('textbox', { name: 'Conteúdo da proposta' }) as HTMLDivElement
}

describe('ConteudoEditavelProposta', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })
  afterEach(() => {
    jest.useRealTimers()
  })

  it('renderiza o HTML inicial formatado', () => {
    render(<ConteudoEditavelProposta markdown="<h1>Título</h1>" onChange={jest.fn()} />)
    expect(screen.getByRole('heading', { name: 'Título' })).toBeInTheDocument()
  })

  it('chama onChange (com debounce) com o HTML sanitizado depois de digitar', () => {
    const onChange = jest.fn()
    render(<ConteudoEditavelProposta markdown="<h1>Título</h1>" onChange={onChange} />)

    const editor = pegarEditor()
    editor.innerHTML = '<h1>Título editado</h1>'
    fireEvent.input(editor)

    expect(onChange).not.toHaveBeenCalled()
    act(() => {
      jest.advanceTimersByTime(400)
    })
    expect(onChange).toHaveBeenCalledWith('<h1>Título editado</h1>')
  })

  it('não refaz o HTML quando o markdown muda por causa do próprio onChange (evita cursor pular)', () => {
    const onChange = jest.fn()
    const { rerender } = render(<ConteudoEditavelProposta markdown="<h1>Título</h1>" onChange={onChange} />)

    const editor = pegarEditor()
    editor.innerHTML = '<h1>Digitando</h1>'
    fireEvent.input(editor)
    act(() => {
      jest.advanceTimersByTime(400)
    })

    rerender(<ConteudoEditavelProposta markdown="<h1>Digitando</h1>" onChange={onChange} />)
    expect(editor.innerHTML).toBe('<h1>Digitando</h1>')
  })

  it('refaz o HTML quando o markdown muda por uma fonte externa', () => {
    const onChange = jest.fn()
    const { rerender } = render(<ConteudoEditavelProposta markdown="<h1>Título</h1>" onChange={onChange} />)

    rerender(<ConteudoEditavelProposta markdown="<h1>Corrigido pela IA</h1>" onChange={onChange} />)

    expect(screen.getByRole('heading', { name: 'Corrigido pela IA' })).toBeInTheDocument()
  })

  it('colar insere só texto puro, sem HTML/estilo', () => {
    document.execCommand = jest.fn()
    render(<ConteudoEditavelProposta markdown="<h1>Título</h1>" onChange={jest.fn()} />)

    const editor = pegarEditor()
    const clipboardData = { getData: (tipo: string) => (tipo === 'text/plain' ? 'texto colado' : '<b>html</b>') }
    fireEvent.paste(editor, { clipboardData })

    expect(document.execCommand).toHaveBeenCalledWith('insertText', false, 'texto colado')
  })

  it('Enter dentro de uma célula de tabela é bloqueado', () => {
    render(<ConteudoEditavelProposta markdown="<table><tr><td>1</td></tr></table>" onChange={jest.fn()} />)
    const editor = pegarEditor()
    const celula = editor.querySelector('td')!
    const noDeTexto = celula.firstChild!

    jest.spyOn(window, 'getSelection').mockReturnValue({
      anchorNode: noDeTexto,
    } as unknown as Selection)

    const evento = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
    fireEvent(editor, evento)

    expect(evento.defaultPrevented).toBe(true)
  })

  it('Enter fora de tabela não é bloqueado', () => {
    render(<ConteudoEditavelProposta markdown="<p>Texto simples</p>" onChange={jest.fn()} />)
    const editor = pegarEditor()
    const noDeTexto = editor.querySelector('p')!.firstChild!

    jest.spyOn(window, 'getSelection').mockReturnValue({
      anchorNode: noDeTexto,
    } as unknown as Selection)

    const evento = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
    fireEvent(editor, evento)

    expect(evento.defaultPrevented).toBe(false)
  })
})
