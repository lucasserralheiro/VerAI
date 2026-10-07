import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ListaClientes } from './lista-clientes'

function mockFetch(options: {
  role: 'admin' | 'usuario' | null
  clientes?: Array<{ id: string; nome: string; siglaLegado?: string | null; gerencia?: { id: string; nome: string } | null }>
  criarOk?: boolean
  criarErro?: string
  atualizadoEm?: string | null
  painel?: unknown
}) {
  const { role, clientes = [], criarOk = true, criarErro = 'Falha ao criar cliente.', atualizadoEm, painel } = options
  global.fetch = jest.fn((url: RequestInfo | URL, init?: RequestInit) => {
    const u = String(url)
    if (u === '/api/sharepoint/atualizacao' && atualizadoEm !== undefined) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ atualizadoEm }) }) as unknown as Promise<Response>
    }
    if (u === '/api/clientes/painel' && painel !== undefined) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(painel) }) as unknown as Promise<Response>
    }
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
  // A pasta aberta vira a carteira em foco (localStorage) — não pode vazar de um teste para o outro.
  beforeEach(() => {
    localStorage.clear()
    window.history.pushState(null, '', '/')
  })

  it('abre na raiz com uma pasta por carteira e, ao abrir a pasta, mostra só os clientes dela', async () => {
    mockFetch({
      role: 'usuario',
      clientes: [
        { id: 'c1', nome: 'Saúde', gerencia: { id: 'g1', nome: 'GCR' } },
        { id: 'c2', nome: 'Obras', gerencia: null },
      ],
    })
    render(<ListaClientes />)
    const pastaGcr = (await screen.findByText('GCR')).closest('a') as HTMLElement
    expect(screen.getByText('Sem carteira')).toBeInTheDocument()
    expect(screen.queryByText('Saúde')).toBeNull()

    fireEvent.click(pastaGcr)
    expect(await screen.findByText('Saúde')).toBeInTheDocument()
    expect(screen.queryByText('Obras')).toBeNull()
    expect(window.location.search).toBe('?carteira=g1')

    fireEvent.click(screen.getByRole('link', { name: 'Todas as carteiras' }))
    fireEvent.click(screen.getByText('Sem carteira').closest('a') as HTMLElement)
    expect(await screen.findByText('Obras')).toBeInTheDocument()
    expect(screen.queryByText('Saúde')).toBeNull()
    window.history.pushState(null, '', '/')
  })

  it('na raiz, a busca procura em todos os clientes e mostra a carteira de cada um', async () => {
    mockFetch({
      role: 'usuario',
      clientes: [
        { id: 'c1', nome: 'Saúde', gerencia: { id: 'g1', nome: 'GCR' } },
        { id: 'c2', nome: 'Obras', gerencia: null },
      ],
    })
    render(<ListaClientes />)
    fireEvent.change(await screen.findByLabelText('Buscar cliente'), { target: { value: 'saude' } })
    expect(screen.getByText('Saúde')).toBeInTheDocument()
    expect(screen.getByText('Carteira: GCR')).toBeInTheDocument()
    expect(screen.queryByText('Obras')).toBeNull()
  })

  it('mostra os totais do painel no nível aberto', async () => {
    const totais = (clientes: number, valor: string) => ({
      clientes,
      clientesComContratoAtivo: clientes,
      contratosAtivos: 2,
      contratosSemValor: 0,
      valorContratado: valor,
      faturado: '0',
      saldo: valor,
      percentualFaturado: '0.00',
      vencidos: 0,
      vencem30: 1,
      vencem90: 1,
    })
    mockFetch({
      role: 'usuario',
      clientes: [{ id: 'c1', nome: 'Saúde', gerencia: { id: 'g1', nome: 'GCR' } }],
      painel: {
        geral: totais(1, '2500000'),
        carteiras: [{ id: 'g1', nome: 'GCR', sigla: null, gerentes: ['Ana'], totais: totais(1, '2500000') }],
        clientes: { c1: totais(1, '2500000') },
      },
    })
    render(<ListaClientes />)
    expect(await screen.findByText('Gerente: Ana')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Totais gerais' })).toHaveTextContent('Valor contratado')
    expect(screen.getByText('1 vence em 30d')).toBeInTheDocument()
  })

  it('usa font-semibold no título (não font-bold) e o nome "Relatórios dos clientes"', async () => {
    mockFetch({ role: 'usuario', clientes: [{ id: 'c1', nome: 'Prefeitura X' }] })
    render(<ListaClientes />)
    const heading = await screen.findByRole('heading', { name: 'Relatórios dos clientes' })
    expect(heading).toHaveClass('font-semibold')
    expect(heading).not.toHaveClass('font-bold')
  })

  it('mostra embaixo do título quando os documentos vieram do SharePoint', async () => {
    mockFetch({ role: 'usuario', clientes: [{ id: 'c1', nome: 'Prefeitura X' }], atualizadoEm: new Date().toISOString() })
    render(<ListaClientes />)
    expect(await screen.findByText(/^Documentos do SharePoint atualizados em /)).toBeInTheDocument()
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
