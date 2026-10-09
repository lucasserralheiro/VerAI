import { act, render, screen, fireEvent, waitFor } from '@testing-library/react'
import { NavBar } from './nav-bar'

const pushMock = jest.fn()
let pathnameMock = '/'
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
  usePathname: () => pathnameMock,
}))

type Vinculo = { gerenciaId: string; papel: 'manager' | 'usuario'; nome: string }

function mockFetch(role: 'admin' | 'usuario' | null, minhas: Vinculo[] = []) {
  global.fetch = jest.fn((url: RequestInfo | URL) => {
    if (url === '/api/gerencias/minhas') {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(minhas) }) as unknown as Promise<Response>
    }
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

// Tela larga abre a barra só de ícones (os nomes aparecem ao passar o mouse); estreita mostra a
// gaveta com tudo nomeado. Os testes olham o menu aberto, então simulam a tela estreita.
beforeAll(() => {
  window.matchMedia = ((query: string) => ({
    matches: query.includes('max-width'),
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
})

// "Histórico" existe em dois grupos (ConfereAI e Proposta Comercial) — as
// asserções olham o destino, não só o nome.
function hrefsDoHistorico() {
  return screen.queryAllByRole('link', { name: 'Histórico' }).map((a) => a.getAttribute('href'))
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
    expect(screen.getByRole('link', { name: 'Relatórios dos clientes' })).toHaveAttribute('href', '/clientes?visao=todos')
    expect(screen.getByRole('link', { name: 'Todos os documentos' })).toHaveAttribute('href', '/')
  })

  it('"ConfereAI" é o terceiro grupo do menu: depois de "Relatórios dos clientes" e "Proposta Comercial"', () => {
    render(<NavBar />)
    const links = screen.getAllByRole('link')
    const confere = screen.getByRole('link', { name: 'ConfereAI' })
    expect(confere).toHaveAttribute('href', '/confere')
    const relatorios = screen.getByRole('link', { name: 'Relatórios dos clientes' })
    const proposta = screen.getByRole('link', { name: 'Proposta Comercial' })
    expect(links.indexOf(relatorios)).toBeLessThan(links.indexOf(proposta))
    expect(links.indexOf(proposta)).toBeLessThan(links.indexOf(confere))
  })

  it('"ConfereAI" tem o sub-item "Histórico" apontando pra /confere/historico', () => {
    render(<NavBar />)
    fireEvent.click(screen.getByRole('button', { name: 'Expandir ConfereAI' }))
    expect(hrefsDoHistorico()).toContain('/confere/historico')
  })

  it('"Reajuste IPC-Fipe" é um grupo depois do ConfereAI, com Histórico e Tabela do índice', () => {
    render(<NavBar />)
    const links = screen.getAllByRole('link')
    const reajuste = screen.getByRole('link', { name: 'Reajuste IPC-Fipe' })
    expect(reajuste).toHaveAttribute('href', '/reajuste')
    expect(links.indexOf(screen.getByRole('link', { name: 'ConfereAI' }))).toBeLessThan(links.indexOf(reajuste))
    fireEvent.click(screen.getByRole('button', { name: 'Expandir Reajuste IPC-Fipe' }))
    expect(hrefsDoHistorico()).toContain('/reajuste/historico')
    expect(screen.getByRole('link', { name: 'Tabela do índice' })).toHaveAttribute('href', '/reajuste/indice')
  })

  it('a marca no topo leva para /clientes, a porta de entrada', () => {
    render(<NavBar />)
    // Tela estreita: a marca está na barra de cima e na gaveta — as duas levam a /clientes.
    const marcas = screen.getAllByRole('link', { name: /Ver\s*AI/ })
    expect(marcas.length).toBeGreaterThan(0)
    for (const marca of marcas) expect(marca).toHaveAttribute('href', '/clientes')
  })

  it('separa o menu nas seções "Referências" e "Ferramentas" — Clientes e Administração não levam título', () => {
    render(<NavBar />)
    for (const secao of ['Referências', 'Ferramentas']) {
      expect(screen.getAllByText(secao).some((el) => !el.closest('a'))).toBe(true)
    }
    for (const semTitulo of ['Clientes', 'Sistema', 'Referências PRODAM']) {
      expect(screen.queryAllByText(semTitulo).some((el) => !el.closest('a'))).toBe(false)
    }
    expect(screen.queryByText('Análise de Documentos')).not.toBeInTheDocument()
  })

  it('"Todos os documentos" fica dentro do grupo "Relatórios dos clientes", aberto por padrão', () => {
    render(<NavBar />)
    const botao = screen.getByRole('button', { name: 'Recolher Relatórios dos clientes' })
    expect(botao).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('link', { name: 'Todos os documentos' })).toBeInTheDocument()
  })

  it('"Tabela de preços" (biblioteca Documentos do SharePoint) fica dentro de "Relatórios dos clientes"', () => {
    render(<NavBar />)
    expect(screen.getByRole('link', { name: 'Tabela de preços' })).toHaveAttribute('href', '/tabela-de-precos')
    expect(screen.getByRole('link', { name: 'Controle de faturamento' })).toHaveAttribute('href', '/controle-faturamento')
    // Links MPLS não têm tela geral: só o cartão no detalhe do contrato.
    expect(screen.queryByRole('link', { name: 'Links MPLS' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Calendário de faturamento' })).toHaveAttribute('href', '/calendario-faturamento')
  })

  it('"Fornecedores", "Demandas" e "Solicitações" são sub-itens do grupo "Relatórios dos clientes"', () => {
    render(<NavBar />)
    expect(screen.getByRole('link', { name: 'Fornecedores' })).toHaveAttribute('href', '/fornecedores')
    expect(screen.getByRole('link', { name: 'Demandas' })).toHaveAttribute('href', '/demandas')
    expect(screen.getByRole('link', { name: 'Solicitações' })).toHaveAttribute('href', '/solicitacoes')
  })

  it('"Relatórios" (consultas cross-cliente) é sub-item do grupo "Relatórios dos clientes"', () => {
    render(<NavBar />)
    expect(screen.getByRole('link', { name: 'Relatórios' })).toHaveAttribute('href', '/relatorios')
  })

  it.each([
    ['/demandas/d1', 'Demandas'],
    ['/fornecedores/f1', 'Fornecedores'],
    ['/relatorios', 'Relatórios'],
  ])('em %s o sub-item "%s" fica ativo', (rota, item) => {
    pathnameMock = rota
    render(<NavBar />)
    expect(screen.getByRole('link', { name: item })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Todos os documentos' })).not.toHaveAttribute('aria-current')
  })

  it('"Proposta Comercial" é um link de verdade pro histórico, sem sub-item repetindo a mesma rota', () => {
    render(<NavBar />)
    expect(screen.getByRole('link', { name: 'Proposta Comercial' })).toHaveAttribute('href', '/propostas-comerciais')
    expect(screen.queryByRole('button', { name: /(Expandir|Recolher) Proposta Comercial/ })).not.toBeInTheDocument()
    expect(hrefsDoHistorico()).not.toContain('/propostas-comerciais')
  })

  it('grupos de ferramentas nascem recolhidos fora das suas rotas', () => {
    render(<NavBar />)
    expect(screen.getByRole('button', { name: 'Expandir ConfereAI' })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByRole('button', { name: 'Expandir Reajuste IPC-Fipe' })).toHaveAttribute('aria-expanded', 'false')
    expect(hrefsDoHistorico()).toEqual([])
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
    expect(screen.getByRole('link', { name: 'Relatórios dos clientes' })).toHaveAttribute('href', '/clientes?visao=todos')

    fireEvent.click(screen.getByRole('button', { name: 'Expandir Relatórios dos clientes' }))
    expect(screen.getByRole('link', { name: 'Todos os documentos' })).toBeInTheDocument()
  })

  it('reabre o grupo "Relatórios dos clientes" ao navegar para um dos seus sub-itens', () => {
    pathnameMock = '/notificacoes'
    const { rerender } = render(<NavBar />)
    expect(screen.queryByRole('link', { name: 'Todos os documentos' })).not.toBeInTheDocument()

    pathnameMock = '/'
    rerender(<NavBar />)
    expect(screen.getByRole('link', { name: 'Todos os documentos' })).toBeInTheDocument()
  })

  it('admin vê o grupo "Administração" com os cinco sublinks, na ordem, mesmo com MENU_SIMPLIFICADO', async () => {
    render(<NavBar />)
    const grupo = await screen.findByRole('link', { name: 'Administração' })
    fireEvent.click(screen.getByRole('button', { name: 'Expandir Administração' }))
    expect(grupo).toHaveAttribute('href', '/admin')
    const esperados: Array<[string, string]> = [
      ['Usuários', '/admin/usuarios'],
      ['Gerências e carteiras', '/admin/gerencias'],
      ['Clientes', '/admin/clientes'],
      ['Regras de notificação', '/admin/regras-notificacao'],
      ['Assistente de IA', '/admin/assistente'],
      ['API e integrações', '/admin/api'],
    ]
    const links = screen.getAllByRole('link')
    let anterior = links.indexOf(grupo)
    for (const [nome, href] of esperados) {
      const link = screen.getByRole('link', { name: nome })
      expect(link).toHaveAttribute('href', href)
      const pos = links.indexOf(link)
      expect(pos).toBeGreaterThan(anterior)
      anterior = pos
    }
  })

  it('o grupo "Administração" nasce aberto em rota /admin', async () => {
    pathnameMock = '/admin/gerencias/g1'
    render(<NavBar />)
    expect(await screen.findByRole('button', { name: 'Recolher Administração' })).toHaveAttribute('aria-expanded', 'true')
  })

  it('não mostra "Administração" para quem não é admin', async () => {
    mockFetch('usuario')
    render(<NavBar />)
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/auth/me'))
    await act(async () => {})
    expect(screen.queryByRole('link', { name: 'Administração' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Usuários' })).not.toBeInTheDocument()
  })

  it('admin continua vendo todos os links que o menu já tinha', async () => {
    render(<NavBar />)
    await screen.findByRole('link', { name: 'Administração' })
    fireEvent.click(screen.getByRole('button', { name: 'Expandir Administração' }))
    fireEvent.click(screen.getByRole('button', { name: 'Expandir ConfereAI' }))
    fireEvent.click(screen.getByRole('button', { name: 'Expandir Reajuste IPC-Fipe' }))
    const hrefs = screen.getAllByRole('link').map((a) => a.getAttribute('href'))
    const antes = [
      '/confere', '/clientes', '/fornecedores', '/demandas', '/solicitacoes', '/relatorios', '/',
      '/tabela-de-precos', '/controle-faturamento', '/calendario-faturamento', '/propostas-comerciais',
      '/confere/historico', '/reajuste', '/reajuste/historico', '/reajuste/indice',
      '/admin/usuarios', '/admin/clientes', '/admin/regras-notificacao', '/admin/assistente',
    ]
    for (const href of antes) expect(hrefs).toContain(href)
  })

  it('manager de uma gerência vê "Minha gerência" apontando pra /gerencias', async () => {
    mockFetch('usuario', [{ gerenciaId: 'g1', papel: 'manager', nome: 'GCR' }])
    render(<NavBar />)
    expect(await screen.findByRole('link', { name: 'Minha gerência' })).toHaveAttribute('href', '/gerencias')
  })

  it('com duas gerências o rótulo vai pro plural', async () => {
    mockFetch('usuario', [
      { gerenciaId: 'g1', papel: 'manager', nome: 'GCR' },
      { gerenciaId: 'g2', papel: 'usuario', nome: 'GTI' },
    ])
    render(<NavBar />)
    expect(await screen.findByRole('link', { name: 'Minhas gerências' })).toHaveAttribute('href', '/gerencias')
  })

  it('quem é só "usuario" de gerência não vê "Minha gerência"', async () => {
    mockFetch('usuario', [{ gerenciaId: 'g1', papel: 'usuario', nome: 'GCR' }])
    render(<NavBar />)
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/gerencias/minhas'))
    await act(async () => {})
    expect(screen.queryByRole('link', { name: /Minh[ao]s? gerências?/ })).not.toBeInTheDocument()
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
