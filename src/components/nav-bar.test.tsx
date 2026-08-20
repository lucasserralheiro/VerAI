import { act, render, screen, fireEvent, waitFor } from '@testing-library/react'
import { NavBar } from './nav-bar'

const pushMock = jest.fn()
let pathnameMock = '/'
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
  usePathname: () => pathnameMock,
}))

function mockFetch(role: 'admin' | 'usuario' | null) {
  global.fetch = jest.fn((url: RequestInfo | URL) => {
    if (url === '/api/auth/me') {
      return Promise.resolve({
        ok: role !== null,
        json: () => Promise.resolve(role ? { role } : null),
      }) as unknown as Promise<Response>
    }
    if (url === '/api/notificacoes') {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve([]),
      }) as unknown as Promise<Response>
    }
    return Promise.resolve({ ok: true }) as unknown as Promise<Response>
  }) as jest.Mock
}

describe('NavBar', () => {
  beforeEach(() => {
    pushMock.mockClear()
    pathnameMock = '/'
    localStorage.clear()
    mockFetch('admin')
  })

  it('renderiza os links de topo para qualquer usuário', () => {
    render(<NavBar />)
    expect(screen.getByRole('link', { name: 'Clientes' })).toHaveAttribute('href', '/clientes')
    expect(screen.getByRole('link', { name: 'Todos os documentos' })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: 'Notificações' })).toHaveAttribute('href', '/notificacoes')
  })

  it('não mostra a seção Configuração para quem não é admin', async () => {
    mockFetch('usuario')
    render(<NavBar />)
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/auth/me'))
    await act(async () => {})
    expect(screen.queryByRole('button', { name: 'Configuração' })).not.toBeInTheDocument()
  })

  it('mostra a seção Configuração fechada por padrão para admin em rota não-admin', async () => {
    render(<NavBar />)
    const botao = await screen.findByRole('button', { name: 'Configuração' })
    expect(botao).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('link', { name: 'Usuários' })).not.toBeInTheDocument()
  })

  it('abre a seção Configuração automaticamente quando a rota atual é uma página admin', async () => {
    pathnameMock = '/admin/usuarios'
    render(<NavBar />)
    const botao = await screen.findByRole('button', { name: 'Configuração' })
    expect(botao).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('link', { name: 'Usuários' })).toHaveAttribute('href', '/admin/usuarios')
    expect(screen.getByRole('link', { name: 'Gerenciar clientes' })).toHaveAttribute('href', '/admin/clientes')
    expect(screen.getByRole('link', { name: 'Regras de notificação' })).toHaveAttribute(
      'href',
      '/admin/regras-notificacao'
    )
  })

  it('alterna a seção Configuração ao clicar, com a barra expandida', async () => {
    render(<NavBar />)
    const botao = await screen.findByRole('button', { name: 'Configuração' })

    fireEvent.click(botao)
    expect(botao).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('link', { name: 'Usuários' })).toBeInTheDocument()

    fireEvent.click(botao)
    expect(botao).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('link', { name: 'Usuários' })).not.toBeInTheDocument()
  })

  it('com a barra recolhida, clicar em Configuração expande a barra e abre a seção', async () => {
    render(<NavBar />)
    fireEvent.click(screen.getByRole('button', { name: 'Recolher menu' }))

    const botaoConfig = await screen.findByRole('button', { name: 'Configuração' })
    fireEvent.click(botaoConfig)

    expect(screen.getByRole('button', { name: 'Recolher menu' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Usuários' })).toHaveAttribute('href', '/admin/usuarios')
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
