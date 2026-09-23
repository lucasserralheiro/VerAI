import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ListaClientes } from './lista-clientes'

function mockFetch(options: {
  role: 'admin' | 'usuario' | null
  clientes?: Array<{ id: string; nome: string; siglaLegado?: string | null }>
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

describe('ListaClientes', () => {
  it('usa font-semibold no título (não font-bold) e o nome "Relatórios dos clientes"', async () => {
    mockFetch({ role: 'usuario', clientes: [{ id: 'c1', nome: 'Prefeitura X' }] })
    render(<ListaClientes />)
    const heading = await screen.findByRole('heading', { name: 'Relatórios dos clientes' })
    expect(heading).toHaveClass('font-semibold')
    expect(heading).not.toHaveClass('font-bold')
  })

  it('mostra a sigla ao lado do nome quando o cliente tem', async () => {
    mockFetch({
      role: 'usuario',
      clientes: [
        { id: 'c1', nome: 'Secretaria Municipal da Saúde', siglaLegado: 'SMS' },
        { id: 'c2', nome: 'Prefeitura X', siglaLegado: null },
      ],
    })
    render(<ListaClientes />)

    const link = (await screen.findByText('Secretaria Municipal da Saúde')).closest('a') as HTMLElement
    expect(link).toHaveTextContent('SMS')
    expect((screen.getByText('Prefeitura X').closest('a') as HTMLElement).textContent).toBe('Prefeitura X')
  })

  it('não-admin não vê o botão "Novo cliente"', async () => {
    mockFetch({ role: 'usuario', clientes: [{ id: 'c1', nome: 'Prefeitura X' }] })
    render(<ListaClientes />)
    await screen.findByRole('heading', { name: 'Relatórios dos clientes' })
    expect(screen.queryByRole('button', { name: 'Novo cliente' })).not.toBeInTheDocument()
  })

  it('admin vê o botão "Novo cliente", abre o modal e cria com sucesso', async () => {
    mockFetch({ role: 'admin', clientes: [{ id: 'c1', nome: 'Prefeitura X' }] })
    render(<ListaClientes />)

    fireEvent.click(await screen.findByRole('button', { name: 'Novo cliente' }))
    expect(await screen.findByRole('heading', { name: 'Novo cliente' })).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText(/^Nome \*/), { target: { value: 'Prefeitura Y' } })
    fireEvent.click(screen.getByRole('button', { name: 'Criar cliente' }))

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith('/api/admin/clientes', expect.objectContaining({ method: 'POST' }))
    )
    const chamada = (global.fetch as jest.Mock).mock.calls.find(([, init]) => init?.method === 'POST')
    expect(JSON.parse(chamada[1].body)).toEqual({
      siglaLegado: '',
      nome: 'Prefeitura Y',
      endereco: '',
      numero: '',
      bairro: '',
      responsaveis: [],
    })
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Novo cliente' })).not.toBeInTheDocument())
  })

  it('envia sigla, endereço e responsáveis preenchidos; ignora a linha em branco', async () => {
    mockFetch({ role: 'admin', clientes: [{ id: 'c1', nome: 'Prefeitura X' }] })
    render(<ListaClientes />)

    fireEvent.click(await screen.findByRole('button', { name: 'Novo cliente' }))
    fireEvent.change(await screen.findByLabelText('Sigla'), { target: { value: 'pmy' } })
    fireEvent.change(screen.getByLabelText(/^Nome \*/), { target: { value: 'Prefeitura Y' } })
    fireEvent.change(screen.getByLabelText('Endereço'), { target: { value: 'Rua A' } })
    fireEvent.change(screen.getByLabelText('Nº'), { target: { value: '10' } })
    fireEvent.change(screen.getByLabelText('Bairro'), { target: { value: 'Sé' } })
    fireEvent.change(screen.getByLabelText('Nome(s) do(s) responsável(is) (linha 1)'), { target: { value: 'Ana' } })
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar responsável' }))
    fireEvent.click(screen.getByRole('button', { name: 'Criar cliente' }))

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith('/api/admin/clientes', expect.objectContaining({ method: 'POST' }))
    )
    const chamada = (global.fetch as jest.Mock).mock.calls.find(([, init]) => init?.method === 'POST')
    expect(JSON.parse(chamada[1].body)).toEqual({
      siglaLegado: 'pmy',
      nome: 'Prefeitura Y',
      endereco: 'Rua A',
      numero: '10',
      bairro: 'Sé',
      responsaveis: [{ nome: 'Ana', area: '', email: '', telefone: '', celular: '' }],
    })
  })

  it('não envia quando uma linha de responsável está preenchida sem nome', async () => {
    mockFetch({ role: 'admin', clientes: [{ id: 'c1', nome: 'Prefeitura X' }] })
    render(<ListaClientes />)

    fireEvent.click(await screen.findByRole('button', { name: 'Novo cliente' }))
    fireEvent.change(await screen.findByLabelText(/^Nome \*/), { target: { value: 'Prefeitura Y' } })
    fireEvent.change(screen.getByLabelText('Área (linha 1)'), { target: { value: 'TI' } })
    fireEvent.click(screen.getByRole('button', { name: 'Criar cliente' }))

    expect(await screen.findByText(/Informe o nome do responsável/)).toBeInTheDocument()
    expect(global.fetch).not.toHaveBeenCalledWith('/api/admin/clientes', expect.anything())
  })

  it('mostra erro no modal quando a criação falha', async () => {
    mockFetch({
      role: 'admin',
      clientes: [{ id: 'c1', nome: 'Prefeitura X' }],
      criarOk: false,
      criarErro: 'já existe um cliente com esse nome ou sigla',
    })
    render(<ListaClientes />)

    fireEvent.click(await screen.findByRole('button', { name: 'Novo cliente' }))
    fireEvent.change(await screen.findByLabelText(/^Nome \*/), { target: { value: 'Prefeitura X' } })
    fireEvent.click(screen.getByRole('button', { name: 'Criar cliente' }))

    expect(await screen.findByText('já existe um cliente com esse nome ou sigla')).toBeInTheDocument()
  })

  it('lista vazia + admin mostra a mensagem de vazio e o botão "Novo cliente", sem o texto de pedir a um admin', async () => {
    mockFetch({ role: 'admin', clientes: [] })
    render(<ListaClientes />)

    expect(await screen.findByText(/Nenhum cliente cadastrado ainda/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Novo cliente' })).toBeInTheDocument()
    expect(screen.queryByText(/Peça a um admin/)).not.toBeInTheDocument()
  })

  it('lista vazia + não-admin continua mostrando o texto de pedir a um admin, sem formulário', async () => {
    mockFetch({ role: 'usuario', clientes: [] })
    render(<ListaClientes />)

    expect(await screen.findByText(/Peça a um admin/)).toBeInTheDocument()
    expect(screen.queryByLabelText('Nome')).not.toBeInTheDocument()
  })

  describe('busca', () => {
    const CLIENTES = [
      { id: 'c1', nome: 'SECRETARIA MUNICIPAL DE GESTÃO', siglaLegado: 'SEGES' },
      { id: 'c2', nome: 'Secretaria Municipal da Saúde', siglaLegado: 'SMS' },
      { id: 'c3', nome: 'SMDET', siglaLegado: null },
    ]

    it('filtra por nome ignorando maiúsculas e acentos', async () => {
      mockFetch({ role: 'usuario', clientes: CLIENTES })
      render(<ListaClientes />)

      fireEvent.change(await screen.findByLabelText('Buscar cliente'), { target: { value: 'gestao' } })
      expect(screen.getByText('SECRETARIA MUNICIPAL DE GESTÃO')).toBeInTheDocument()
      expect(screen.queryByText('Secretaria Municipal da Saúde')).not.toBeInTheDocument()
      expect(screen.queryByText('SMDET')).not.toBeInTheDocument()
    })

    it('filtra pela sigla', async () => {
      mockFetch({ role: 'usuario', clientes: CLIENTES })
      render(<ListaClientes />)

      fireEvent.change(await screen.findByLabelText('Buscar cliente'), { target: { value: 'sms' } })
      expect(screen.getByText('Secretaria Municipal da Saúde')).toBeInTheDocument()
      expect(screen.queryByText('SMDET')).not.toBeInTheDocument()
    })

    it('mostra mensagem quando nada corresponde', async () => {
      mockFetch({ role: 'usuario', clientes: CLIENTES })
      render(<ListaClientes />)

      fireEvent.change(await screen.findByLabelText('Buscar cliente'), { target: { value: 'zzz' } })
      expect(screen.getByText(/Nenhum cliente encontrado para/)).toBeInTheDocument()
    })
  })
})
