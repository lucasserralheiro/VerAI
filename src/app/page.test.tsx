import { render, screen } from '@testing-library/react'
import DashboardPage from './page'

describe('DashboardPage', () => {
  beforeEach(() => {
    global.fetch = jest.fn() as jest.Mock
  })

  it('mostra o título "Documentos" e o aviso de "Em desenvolvimento"', () => {
    render(<DashboardPage />)
    expect(screen.getByRole('heading', { name: 'Documentos' })).toBeInTheDocument()
    expect(screen.getByText('Em desenvolvimento')).toBeInTheDocument()
  })

  it('não carrega documentos nem mostra os filtros', () => {
    render(<DashboardPage />)
    expect(global.fetch).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: /Filtrar/ })).not.toBeInTheDocument()
  })
})
