import { render, screen } from '@testing-library/react'
import DemandasPage from './page'

describe('DemandasPage', () => {
  it('mostra o título e a lista geral (com filtro de cliente)', async () => {
    global.fetch = jest.fn((url: RequestInfo | URL) =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve(
            String(url) === '/api/clientes'
              ? []
              : { demandas: [], sugestoes: { situacao: [], tipo: [], tipoAssunto: [], responsavel: [] } }
          ),
      })
    ) as jest.Mock
    render(<DemandasPage />)
    expect(screen.getByRole('heading', { level: 1, name: 'Demandas' })).toBeInTheDocument()
    expect(await screen.findByLabelText('Filtrar por cliente')).toBeInTheDocument()
    expect(global.fetch).toHaveBeenCalledWith('/api/demandas')
  })
})
