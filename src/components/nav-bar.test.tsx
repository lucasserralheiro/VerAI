import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { NavBar } from './nav-bar'

const pushMock = jest.fn()
let pathnameMock = '/'
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
  usePathname: () => pathnameMock,
}))

describe('NavBar', () => {
  beforeEach(() => {
    pushMock.mockClear()
    pathnameMock = '/'
    global.fetch = jest.fn().mockResolvedValue({ ok: true })
  })

  it('renderiza um link para cada página do dashboard', () => {
    render(<NavBar />)
    expect(screen.getByRole('link', { name: 'Documentos' })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: 'Notificações' })).toHaveAttribute('href', '/notificacoes')
    expect(screen.getByRole('link', { name: 'Usuários' })).toHaveAttribute('href', '/admin/usuarios')
    expect(screen.getByRole('link', { name: 'Gerenciar clientes' })).toHaveAttribute(
      'href',
      '/admin/clientes'
    )
    expect(screen.getByRole('link', { name: 'Regras de notificação' })).toHaveAttribute(
      'href',
      '/admin/regras-notificacao'
    )
  })

  it('faz logout e redireciona para /login ao clicar em Sair', async () => {
    render(<NavBar />)
    fireEvent.click(screen.getByText('Sair'))

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/auth/logout', { method: 'POST' }))
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/login'))
  })

  it('não renderiza nada na tela de login', () => {
    pathnameMock = '/login'
    const { container } = render(<NavBar />)
    expect(container).toBeEmptyDOMElement()
  })
})
