import { render, screen } from '@testing-library/react'
import { PermissaoContext } from '../permissao-cliente'
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

describe('AbaDemandas somente leitura', () => {
  it('sem permissão de edição esconde "Nova demanda"', async () => {
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
    render(
      <PermissaoContext.Provider value={{ carregando: false, podeEditar: false, gerencia: null }}>
        <AbaDemandas clienteId="c1" />
      </PermissaoContext.Provider>,
    )
    expect(await screen.findByRole('link', { name: 'Portal HSPM' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Nova demanda/ })).toBeNull()
  })
})
