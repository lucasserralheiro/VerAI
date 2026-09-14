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
    expect(screen.getByRole('link', { name: 'Relatórios dos clientes' })).toHaveAttribute('href', '/clientes')
    expect(screen.getByRole('link', { name: 'Todos os documentos' })).toHaveAttribute('href', '/')
  })

  it('usa "Relatórios" como cabeçalho de seção, não mais "Análise de Documentos"', () => {
    render(<NavBar />)
    expect(screen.getByText('Relatórios')).toBeInTheDocument()
    expect(screen.queryByText('Análise de Documentos')).not.toBeInTheDocument()
  })

  it('"Todos os documentos" fica dentro do grupo "Relatórios dos clientes", aberto por padrão', () => {
    render(<NavBar />)
    const botao = screen.getByRole('button', { name: 'Recolher Relatórios dos clientes' })
    expect(botao).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('link', { name: 'Todos os documentos' })).toBeInTheDocument()
  })

  it('"Proposta Comercial" é um link de verdade pro histórico, fora de "Relatórios", aberto por padrão', () => {
    render(<NavBar />)
    expect(screen.getByRole('link', { name: 'Proposta Comercial' })).toHaveAttribute('href', '/propostas-comerciais')
    const botao = screen.getByRole('button', { name: 'Recolher Proposta Comercial' })
    expect(botao).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('link', { name: 'Histórico' })).toHaveAttribute('href', '/propostas-comerciais')
  })

  it('alterna o grupo "Proposta Comercial" ao clicar no chevron, sem navegar', () => {
    render(<NavBar />)
    const botao = screen.getByRole('button', { name: 'Recolher Proposta Comercial' })

    fireEvent.click(botao)
    expect(screen.getByRole('button', { name: 'Expandir Proposta Comercial' })).toHaveAttribute(
      'aria-expanded',
      'false'
    )
    expect(screen.queryByRole('link', { name: 'Histórico' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Proposta Comercial' })).toHaveAttribute('href', '/propostas-comerciais')

    fireEvent.click(screen.getByRole('button', { name: 'Expandir Proposta Comercial' }))
    expect(screen.getByRole('link', { name: 'Histórico' })).toBeInTheDocument()
  })

  it('alterna o grupo "Relatórios dos clientes" ao clicar no chevron, sem navegar', () => {
    render(<NavBar />)
    const botao = screen.getByRole('button', { name: 'Recolher Relatórios dos clientes' })

    fireEvent.click(botao)
    expect(screen.getByRole('button', { name: 'Expandir Relatórios dos clientes' })).toHaveAttribute(
      'aria-expanded',
      'false'
    )
    expect(screen.queryByRole('link', { name: 'Todos os documentos' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Relatórios dos clientes' })).toHaveAttribute('href', '/clientes')

    fireEvent.click(screen.getByRole('button', { name: 'Expandir Relatórios dos clientes' }))
    expect(screen.getByRole('link', { name: 'Todos os documentos' })).toBeInTheDocument()
  })

  it('reabre o grupo "Relatórios dos clientes" ao navegar para um dos seus sub-itens', () => {
    pathnameMock = '/notificacoes'
    const { rerender } = render(<NavBar />)
    fireEvent.click(screen.getByRole('button', { name: 'Recolher Relatórios dos clientes' }))
    expect(screen.queryByRole('link', { name: 'Todos os documentos' })).not.toBeInTheDocument()

    pathnameMock = '/'
    rerender(<NavBar />)
    expect(screen.getByRole('link', { name: 'Todos os documentos' })).toBeInTheDocument()
  })

  it('não mostra a seção Configuração para quem não é admin', async () => {
    mockFetch('usuario')
    render(<NavBar />)
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/auth/me'))
    await act(async () => {})
    expect(screen.queryByRole('button', { name: 'Configuração' })).not.toBeInTheDocument()
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

// `MENU_SIMPLIFICADO = true` em nav-bar.tsx esconde "Notificações", a seção
// "Configuração" (mesmo pra admin) e o seletor "Simular usuário" enquanto o
// menu é reorganizado — reverter a flag pra `false` religa tudo isso, e
// então é só trocar `describe.skip` por `describe` aqui embaixo de novo.
describe.skip('NavBar — itens ocultos enquanto MENU_SIMPLIFICADO = true', () => {
  beforeEach(() => {
    pushMock.mockClear()
    pathnameMock = '/'
    localStorage.clear()
    mockFetch('admin')
  })

  it('"Notificações" fica fora do grupo "Relatórios", como item solto', () => {
    render(<NavBar />)
    fireEvent.click(screen.getByRole('button', { name: 'Recolher Relatórios dos clientes' }))
    expect(screen.getByRole('link', { name: 'Notificações' })).toHaveAttribute('href', '/notificacoes')
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

  it('mostra o seletor "Simular usuário" para admin real com o modo ligado e chama switch ao escolher', async () => {
    mockFetchComDevStatus('admin', {
      enabled: true,
      impersonating: false,
      users: [{ id: 'u1', nome: 'Uploader Teste', email: 'up@verai.dev', role: 'uploader' }],
    })
    render(<NavBar />)

    const select = await screen.findByLabelText('Simular usuário')
    fireEvent.change(select, { target: { value: 'u1' } })

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/dev-auth/switch',
        expect.objectContaining({ method: 'POST', body: JSON.stringify({ userId: 'u1' }) })
      )
    )
  })
})

function mockFetchComDevStatus(
  role: string | null,
  devStatus: {
    enabled: boolean
    impersonating: boolean
    users: Array<{ id: string; nome: string; email: string; role: string }>
  }
) {
  global.fetch = jest.fn((url: RequestInfo | URL) => {
    if (url === '/api/auth/me') {
      return Promise.resolve({
        ok: role !== null,
        json: () => Promise.resolve(role ? { nome: 'Fulano', role } : null),
      }) as unknown as Promise<Response>
    }
    if (url === '/api/auth/dev-status') {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(devStatus) }) as unknown as Promise<Response>
    }
    if (url === '/api/notificacoes') {
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) }) as unknown as Promise<Response>
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) }) as unknown as Promise<Response>
  }) as jest.Mock
}

describe('NavBar — modo dev', () => {
  beforeEach(() => {
    pushMock.mockClear()
    pathnameMock = '/'
    localStorage.clear()
  })

  it('não mostra nada de dev-auth quando o modo está desligado', async () => {
    mockFetch('admin')
    render(<NavBar />)
    await screen.findByRole('link', { name: 'Relatórios dos clientes' })
    expect(screen.queryByText('Simular usuário')).not.toBeInTheDocument()
  })

  it('mostra "Voltar para admin" quando está simulando um usuário e chama restore ao clicar', async () => {
    mockFetchComDevStatus('uploader', { enabled: true, impersonating: true, users: [] })
    render(<NavBar />)

    const botao = await screen.findByRole('button', { name: 'Voltar para admin' })
    fireEvent.click(botao)

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith('/api/dev-auth/restore', { method: 'POST' })
    )
  })
})
