import { render, screen, fireEvent } from '@testing-library/react'
import { EditarComoTexto } from './editar-como-texto'

describe('EditarComoTexto', () => {
  it('começa fechado, só com o link "Editar como texto"', () => {
    render(<EditarComoTexto markdown="# Título" onChange={jest.fn()} />)
    expect(screen.getByRole('button', { name: 'Editar como texto' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Editar como texto')).not.toBeInTheDocument()
  })

  it('abre a textarea com o markdown atual e propaga mudanças', () => {
    const onChange = jest.fn()
    render(<EditarComoTexto markdown="# Título" onChange={onChange} />)

    fireEvent.click(screen.getByRole('button', { name: 'Editar como texto' }))
    const textarea = screen.getByLabelText('Editar como texto') as HTMLTextAreaElement
    expect(textarea.value).toBe('# Título')

    fireEvent.change(textarea, { target: { value: '# Título editado' } })
    expect(onChange).toHaveBeenCalledWith('# Título editado')
  })

  it('"Voltar" fecha a textarea', () => {
    render(<EditarComoTexto markdown="# Título" onChange={jest.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Editar como texto' }))
    fireEvent.click(screen.getByRole('button', { name: 'Voltar pra edição normal' }))
    expect(screen.getByRole('button', { name: 'Editar como texto' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Editar como texto')).not.toBeInTheDocument()
  })
})
