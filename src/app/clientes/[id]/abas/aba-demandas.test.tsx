import { render, screen } from '@testing-library/react'
import { AbaDemandas } from './aba-demandas'

describe('AbaDemandas', () => {
  it('lista só as demandas do cliente da ficha', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            demandas: [
              {
                id: 'd1',
                assunto: 'Portal HSPM',
                cliente: { id: 'c1', nome: 'Saúde', siglaLegado: 'SMS' },
                notaImportacao: null,
                ultimoTramite: null,
              },
            ],
            sugestoes: { situacao: [], tipo: [], tipoAssunto: [], responsavel: [] },
          }),
      })
    ) as jest.Mock
    render(<AbaDemandas clienteId="c1" />)
    expect(await screen.findByRole('link', { name: 'Portal HSPM' })).toBeInTheDocument()
    expect(global.fetch).toHaveBeenCalledWith('/api/demandas?clienteId=c1')
  })
})
