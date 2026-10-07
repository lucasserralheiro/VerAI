import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Suspense } from 'react'
import ClienteDetalhePage from './page'

const mockReplace = jest.fn()
let mockAba: string | null = null

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: mockReplace }),
  useSearchParams: () => new URLSearchParams(mockAba ? `aba=${mockAba}` : ''),
}))
// A aba Documentos envia direto ao Blob; o cliente do @vercel/blob puxa o `jose` em ESM, que o Jest
// não transforma — mesmo mock de envio-arquivos.test.tsx.
jest.mock('@vercel/blob/client', () => ({ upload: jest.fn() }))

const CLIENTE = {
  id: 'cliente-1',
  nome: 'Prefeitura X',
  siglaLegado: 'PX',
  endereco: 'Rua Dr. Siqueira Campos',
  numero: '176',
  bairro: 'Liberdade',
}

export function mockFetch() {
  global.fetch = jest.fn((url: RequestInfo | URL, init?: RequestInit) => {
    const u = String(url)
    if (u === '/api/clientes/cliente-1' && init?.method === 'PATCH') {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ ...CLIENTE, ...JSON.parse(String(init.body)) }),
      }) as unknown as Promise<Response>
    }
    if (u === '/api/clientes/cliente-1') {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(CLIENTE),
      }) as unknown as Promise<Response>
    }
    if (u === '/api/documentos?clienteId=cliente-1') {
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) }) as unknown as Promise<Response>
    }
    if (u === '/api/clientes/cliente-1/arquivos') {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ arquivos: [], resumo: { total: 0, bytes: 0 } }),
      }) as unknown as Promise<Response>
    }
    if (u === '/api/clientes/cliente-1/contratos') {
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) }) as unknown as Promise<Response>
    }
    if (u === '/api/clientes/cliente-1/responsaveis') {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve([{ id: 'r1', nome: 'Ana Souza', area: 'Sistemas', email: null, telefone: null, celular: null }]),
      }) as unknown as Promise<Response>
    }
    if (u === '/api/auth/me') {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ id: 'u1', role: 'usuario' }),
      }) as unknown as Promise<Response>
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve(null) }) as unknown as Promise<Response>
  }) as jest.Mock
}

// A página usa `use(params)`, que suspende no primeiro render. Envolve num
// Suspense boundary local e espera dentro de `act` pra deixar o ciclo de
// suspensão/retomada do React terminar antes do teste seguir em frente.
export async function renderPagina() {
  await act(async () => {
    render(
      <Suspense fallback={null}>
        <ClienteDetalhePage params={Promise.resolve({ id: 'cliente-1' })} />
      </Suspense>
    )
  })
}

describe('ClienteDetalhePage', () => {
  beforeEach(() => {
    mockAba = null
    mockReplace.mockClear()
    mockFetch()
  })

  it('mostra "Relatórios" como raiz do breadcrumb, antes de Clientes', async () => {
    await renderPagina()
    await screen.findByRole('heading', { name: 'Prefeitura X' })

    expect(screen.getByText('Relatórios')).toBeInTheDocument()
    expect(screen.queryByText('Análise de Documentos')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Clientes' })).toHaveAttribute('href', '/clientes')
  })

  it('usa font-semibold no título (não font-bold)', async () => {
    await renderPagina()
    const heading = await screen.findByRole('heading', { name: 'Prefeitura X' })
    expect(heading).toHaveClass('font-semibold')
    expect(heading).not.toHaveClass('font-bold')
  })

  it('cabeçalho mostra a sigla e o endereço', async () => {
    await renderPagina()
    await screen.findByRole('heading', { name: 'Prefeitura X' })
    expect(screen.getByText('PX')).toBeInTheDocument()
    expect(screen.getByText('Rua Dr. Siqueira Campos, 176 — Liberdade')).toBeInTheDocument()
  })

  it('mostra as abas na ordem da ficha, com Documentos ativa por padrão', async () => {
    await renderPagina()
    await screen.findByRole('heading', { name: 'Prefeitura X' })
    const abas = screen.getAllByRole('tab')
    expect(abas.map((aba) => aba.textContent)).toEqual([
      'Documentos',
      'Contratos',
      'Faturamento',
      'Controle do faturamento',
      'Fornecedores',
      'Demandas',
      'Solicitações',
      'Responsáveis',
    ])
    expect(screen.getByRole('tab', { name: 'Documentos' })).toHaveAttribute('aria-selected', 'true')
    expect(await screen.findByRole('heading', { name: 'Documentos do cliente' })).toBeInTheDocument()
  })

  it('trocar de aba grava ?aba= na URL', async () => {
    await renderPagina()
    fireEvent.click(await screen.findByRole('tab', { name: 'Responsáveis' }))
    expect(mockReplace).toHaveBeenCalledWith('/clientes/cliente-1?aba=responsaveis', { scroll: false })
  })

  it('abre a aba indicada em ?aba=', async () => {
    mockAba = 'responsaveis'
    await renderPagina()
    expect(await screen.findByText('Ana Souza')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Responsáveis' })).toHaveAttribute('aria-selected', 'true')
  })

  it('nenhuma aba mostra mais "Em construção" — todas foram migradas', async () => {
    mockAba = 'demandas'
    await renderPagina()
    expect(await screen.findByRole('tab', { name: 'Demandas' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.queryByText('Em construção')).not.toBeInTheDocument()
  })

  it('?aba= desconhecida cai na aba Documentos', async () => {
    mockAba = 'nao-existe'
    await renderPagina()
    expect(await screen.findByRole('tab', { name: 'Documentos' })).toHaveAttribute('aria-selected', 'true')
  })

  it('"Editar cliente" abre o modal preenchido e salva com PATCH', async () => {
    await renderPagina()
    fireEvent.click(await screen.findByRole('button', { name: 'Editar cliente' }))

    expect(await screen.findByLabelText(/^Nome \*/)).toHaveValue('Prefeitura X')
    // Responsáveis do cliente carregam na grade do modal.
    expect(await screen.findByDisplayValue('Ana Souza')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Sigla'), { target: { value: 'pxx' } })
    fireEvent.change(screen.getByLabelText('Bairro'), { target: { value: 'Sé' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith('/api/clientes/cliente-1', expect.objectContaining({ method: 'PATCH' }))
    )
    const chamada = (global.fetch as jest.Mock).mock.calls.find(
      ([url, init]) => url === '/api/clientes/cliente-1' && init?.method === 'PATCH'
    )
    expect(JSON.parse(chamada[1].body)).toEqual({
      nome: 'Prefeitura X',
      siglaLegado: 'pxx',
      endereco: 'Rua Dr. Siqueira Campos',
      numero: '176',
      bairro: 'Sé',
    })
    // Responsável existente é atualizado (PATCH), não recriado.
    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith('/api/responsaveis/r1', expect.objectContaining({ method: 'PATCH' }))
    )
    expect(await screen.findByText('Rua Dr. Siqueira Campos, 176 — Sé')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Salvar' })).not.toBeInTheDocument()
  })

  it('remover responsável na grade apaga no servidor ao salvar', async () => {
    await renderPagina()
    fireEvent.click(await screen.findByRole('button', { name: 'Editar cliente' }))
    await screen.findByDisplayValue('Ana Souza')

    fireEvent.click(screen.getByRole('button', { name: 'Remover responsável (linha 1)' }))
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith('/api/responsaveis/r1', expect.objectContaining({ method: 'DELETE' }))
    )
  })

  it('"Excluir cliente" no modal pede confirmação e chama DELETE', async () => {
    await renderPagina()
    fireEvent.click(await screen.findByRole('button', { name: 'Editar cliente' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Excluir cliente' }))

    expect(global.fetch).not.toHaveBeenCalledWith('/api/clientes/cliente-1', expect.objectContaining({ method: 'DELETE' }))
    fireEvent.click(screen.getByRole('button', { name: 'Sim' }))

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith('/api/clientes/cliente-1', expect.objectContaining({ method: 'DELETE' }))
    )
  })

  it('mostra o erro da API ao salvar o cliente', async () => {
    await renderPagina()
    const fetchPadrao = global.fetch as jest.Mock
    global.fetch = jest.fn((url: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'PATCH') {
        return Promise.resolve({
          ok: false,
          json: () => Promise.resolve({ error: 'já existe cliente com esse nome/sigla' }),
        }) as unknown as Promise<Response>
      }
      return fetchPadrao(url, init)
    }) as jest.Mock

    fireEvent.click(await screen.findByRole('button', { name: 'Editar cliente' }))
    await screen.findByDisplayValue('Ana Souza')
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    expect(await screen.findByText('já existe cliente com esse nome/sigla')).toBeInTheDocument()
  })
})
