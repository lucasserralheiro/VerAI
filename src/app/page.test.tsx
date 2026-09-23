import { render, screen } from '@testing-library/react'
import DashboardPage from './page'

describe('DashboardPage', () => {
  beforeEach(() => {
    global.fetch = jest.fn((url: RequestInfo | URL) => {
      const u = String(url)
      if (u.startsWith('/api/documentos') || u === '/api/clientes') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) }) as unknown as Promise<Response>
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve(null) }) as unknown as Promise<Response>
    }) as jest.Mock
  })

  // A tela ficou atrás de uma flag (EM_DESENVOLVIMENTO) até 2026-09-22, quando
  // foi liberada; aqui só confirma que a página entrega a listagem, e não mais
  // o aviso "Em desenvolvimento".
  it('carrega a lista de documentos de verdade, não o aviso de "Em desenvolvimento"', async () => {
    render(<DashboardPage />)
    await screen.findByRole('heading', { name: 'Documentos' })
    expect(global.fetch).toHaveBeenCalledWith('/api/documentos')
    expect(screen.queryByText('Em desenvolvimento')).not.toBeInTheDocument()
  })
})
