import { render, screen } from '@testing-library/react'
import ClientesPage from './page'

describe('ClientesPage', () => {
  beforeEach(() => {
    global.fetch = jest.fn((url: RequestInfo | URL) => {
      const u = String(url)
      if (u === '/api/clientes') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) }) as unknown as Promise<Response>
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve(null) }) as unknown as Promise<Response>
    }) as jest.Mock
  })

  // A tela ficou atrás de uma flag (EM_DESENVOLVIMENTO) até 2026-09-21, quando
  // foi liberada - ListaClientes já tem sua própria suíte completa
  // (lista-clientes.test.tsx); aqui só confirma que a página entrega ela, e
  // não mais o aviso "Em desenvolvimento".
  it('mostra o título "Relatórios dos clientes" com font-semibold', async () => {
    render(<ClientesPage />)
    const heading = await screen.findByRole('heading', { name: 'Relatórios dos clientes' })
    expect(heading).toHaveClass('font-semibold')
    expect(heading).not.toHaveClass('font-bold')
  })

  it('carrega a lista de clientes de verdade, não o aviso de "Em desenvolvimento"', async () => {
    render(<ClientesPage />)
    await screen.findByRole('heading', { name: 'Relatórios dos clientes' })
    expect(global.fetch).toHaveBeenCalledWith('/api/clientes')
    expect(screen.queryByText('Em desenvolvimento')).not.toBeInTheDocument()
  })
})
