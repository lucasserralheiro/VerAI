import { render, screen } from '@testing-library/react'
import ClientesPage from './page'

describe('ClientesPage', () => {
  beforeEach(() => {
    global.fetch = jest.fn() as jest.Mock
  })

  it('mostra o título "Relatórios dos clientes" com font-semibold', () => {
    render(<ClientesPage />)
    const heading = screen.getByRole('heading', { name: 'Relatórios dos clientes' })
    expect(heading).toHaveClass('font-semibold')
    expect(heading).not.toHaveClass('font-bold')
  })

  it('mostra o aviso de "Em desenvolvimento" no lugar da lista', () => {
    render(<ClientesPage />)
    expect(screen.getByText('Em desenvolvimento')).toBeInTheDocument()
    expect(screen.getByText(/ainda não está disponível/)).toBeInTheDocument()
  })

  it('não carrega clientes nem mostra o botão "Novo cliente"', () => {
    render(<ClientesPage />)
    expect(global.fetch).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'Novo cliente' })).not.toBeInTheDocument()
  })
})
