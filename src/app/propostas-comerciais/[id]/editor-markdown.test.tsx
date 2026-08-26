import { render, screen, fireEvent } from '@testing-library/react'
import { EditorMarkdown } from './editor-markdown'

describe('EditorMarkdown', () => {
  it('mostra o markdown inicial no textarea e permite editar', () => {
    render(<EditorMarkdown propostaId="prop1" conteudoInicial="# Título" onSalvar={jest.fn()} />)
    const textarea = screen.getByLabelText('Markdown') as HTMLTextAreaElement
    expect(textarea.value).toBe('# Título')

    fireEvent.change(textarea, { target: { value: '# Título editado' } })
    expect(textarea.value).toBe('# Título editado')
  })

  it('abre e fecha o modal do PDF original', () => {
    render(<EditorMarkdown propostaId="prop1" conteudoInicial="texto" onSalvar={jest.fn()} />)

    expect(screen.queryByTitle('PDF original')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Ver PDF original' }))
    const iframe = screen.getByTitle('PDF original')
    expect(iframe).toHaveAttribute('src', '/api/propostas-comerciais/prop1/original?modo=preview')

    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }))
    expect(screen.queryByTitle('PDF original')).not.toBeInTheDocument()
  })

  it('chama onSalvar com o markdown atual ao clicar em Salvar', () => {
    const onSalvar = jest.fn().mockResolvedValue(undefined)
    render(<EditorMarkdown propostaId="prop1" conteudoInicial="conteúdo original" onSalvar={onSalvar} />)

    fireEvent.change(screen.getByLabelText('Markdown'), { target: { value: 'conteúdo editado' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))

    expect(onSalvar).toHaveBeenCalledWith('conteúdo editado')
  })
})
