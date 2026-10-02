import { render, screen } from '@testing-library/react'
import AdminPage from './page'

function mockResumo(semGerencia: number) {
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ usuarios: 12, gerencias: 4, clientes: 87, semGerencia }),
    })
  ) as unknown as jest.Mock
}

describe('/admin', () => {
  it('mostra os quatro números do resumo', async () => {
    mockResumo(5)
    render(<AdminPage />)
    expect(await screen.findByText('87')).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.getByText('4')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(global.fetch).toHaveBeenCalledWith('/api/admin/resumo')
    expect(screen.getByRole('heading', { name: 'Administração' })).toBeInTheDocument()
  })

  it('clientes sem gerência em laranja e com link, quando > 0', async () => {
    mockResumo(5)
    render(<AdminPage />)
    const numero = await screen.findByText('5')
    expect(numero.closest('a')).toHaveAttribute('href', '/admin/gerencias')
    expect(numero.className).toMatch(/orange/)
  })

  it('zero sem gerência não vira alerta', async () => {
    mockResumo(0)
    render(<AdminPage />)
    const numero = await screen.findByText('87')
    expect(numero).toBeInTheDocument()
    expect(screen.getByText('0').className).not.toMatch(/orange/)
  })

  it('um cartão por submenu', async () => {
    mockResumo(0)
    render(<AdminPage />)
    await screen.findByText('87')
    for (const href of [
      '/admin/usuarios',
      '/admin/gerencias',
      '/admin/clientes',
      '/admin/regras-notificacao',
      '/admin/assistente',
    ]) {
      expect(screen.getAllByRole('link').some((a) => a.getAttribute('href') === href)).toBe(true)
    }
  })
})
