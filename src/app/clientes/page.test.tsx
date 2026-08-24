import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import ClientesPage from './page'

function mockFetch(options: {
  role: 'admin' | 'usuario' | null
  clientes?: Array<{ id: string; nome: string }>
  criarOk?: boolean
  criarErro?: string
}) {
  const { role, clientes = [], criarOk = true, criarErro = 'Falha ao criar cliente.' } = options
  global.fetch = jest.fn((url: RequestInfo | URL, init?: RequestInit) => {
    const u = String(url)
    if (u === '/api/clientes') {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(clientes) }) as unknown as Promise<Response>
    }
    if (u === '/api/auth/me') {
      return Promise.resolve({
        ok: role !== null,
        json: () => Promise.resolve(role ? { id: 'u1', role } : null),
      }) as unknown as Promise<Response>
    }
    if (u === '/api/admin/clientes' && init?.method === 'POST') {
      if (!criarOk) {
        return Promise.resolve({
          ok: false,
          json: () => Promise.resolve({ error: criarErro }),
        }) as unknown as Promise<Response>
      }
      return Promise.resolve({
        ok: true,
        status: 201,
        json: () => Promise.resolve({ id: 'novo-1', nome: 'Prefeitura Y' }),
      }) as unknown as Promise<Response>
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve(null) }) as unknown as Promise<Response>
  }) as jest.Mock
}

describe('ClientesPage', () => {
  it('usa font-semibold no título (não font-bold) e o nome "Relatórios dos clientes"', async () => {
    mockFetch({ role: 'usuario', clientes: [{ id: 'c1', nome: 'Prefeitura X' }] })
    render(<ClientesPage />)
    const heading = await screen.findByRole('heading', { name: 'Relatórios dos clientes' })
    expect(heading).toHaveClass('font-semibold')
    expect(heading).not.toHaveClass('font-bold')
  })

  it('não-admin não vê o botão "Novo cliente"', async () => {
    mockFetch({ role: 'usuario', clientes: [{ id: 'c1', nome: 'Prefeitura X' }] })
    render(<ClientesPage />)
    await screen.findByRole('heading', { name: 'Relatórios dos clientes' })
    expect(screen.queryByRole('button', { name: 'Novo cliente' })).not.toBeInTheDocument()
  })

  it('admin vê o botão "Novo cliente", abre o formulário e cria com sucesso', async () => {
    mockFetch({ role: 'admin', clientes: [{ id: 'c1', nome: 'Prefeitura X' }] })
    render(<ClientesPage />)

    const botao = await screen.findByRole('button', { name: 'Novo cliente' })
    fireEvent.click(botao)

    const input = await screen.findByLabelText('Nome')
    fireEvent.change(input, { target: { value: 'Prefeitura Y' } })
    fireEvent.click(screen.getByRole('button', { name: 'Criar cliente' }))

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/admin/clientes',
        expect.objectContaining({ method: 'POST', body: JSON.stringify({ nome: 'Prefeitura Y' }) })
      )
    )
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Fechar' })).not.toBeInTheDocument())
  })

  it('mostra erro inline quando a criação falha', async () => {
    mockFetch({
      role: 'admin',
      clientes: [{ id: 'c1', nome: 'Prefeitura X' }],
      criarOk: false,
      criarErro: 'já existe um cliente com esse nome',
    })
    render(<ClientesPage />)

    fireEvent.click(await screen.findByRole('button', { name: 'Novo cliente' }))
    fireEvent.change(await screen.findByLabelText('Nome'), { target: { value: 'Prefeitura X' } })
    fireEvent.click(screen.getByRole('button', { name: 'Criar cliente' }))

    expect(await screen.findByText('já existe um cliente com esse nome')).toBeInTheDocument()
  })

  it('lista vazia + admin mostra o formulário direto, sem o texto de pedir a um admin', async () => {
    mockFetch({ role: 'admin', clientes: [] })
    render(<ClientesPage />)

    expect(await screen.findByLabelText('Nome')).toBeInTheDocument()
    expect(screen.queryByText(/Peça a um admin/)).not.toBeInTheDocument()
  })

  it('lista vazia + não-admin continua mostrando o texto de pedir a um admin, sem formulário', async () => {
    mockFetch({ role: 'usuario', clientes: [] })
    render(<ClientesPage />)

    expect(await screen.findByText(/Peça a um admin/)).toBeInTheDocument()
    expect(screen.queryByLabelText('Nome')).not.toBeInTheDocument()
  })
})
