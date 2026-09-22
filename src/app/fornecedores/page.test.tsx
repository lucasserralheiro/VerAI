import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import FornecedoresPage from './page'

const ALMAVIVA = {
  id: 'f1',
  razaoSocial: 'ALMAVIVA',
  cnpj: null,
  contato: null,
  acordo: 'LIFERAY',
  numeroAcordo: 'AC-04.06/2022',
  dataAssinatura: '2025-09-23T00:00:00.000Z',
  sei: '7010.2025/0005275-4',
  totalCos: 1,
  totalTermos: 2,
}

function resposta(ok: boolean, corpo: unknown) {
  return Promise.resolve({ ok, json: () => Promise.resolve(corpo) }) as unknown as Promise<Response>
}

function mockApi(options: { erroLista?: boolean; erroPost?: string } = {}) {
  let lista = [ALMAVIVA]
  global.fetch = jest.fn((url: RequestInfo | URL, init?: RequestInit) => {
    const u = String(url)
    const metodo = init?.method ?? 'GET'
    if (u.startsWith('/api/fornecedores') && metodo === 'GET') {
      if (options.erroLista) return resposta(false, { error: 'não autenticado' })
      const q = new URL(u, 'http://x').searchParams.get('q')?.toLowerCase()
      return resposta(true, q ? lista.filter((f) => f.razaoSocial.toLowerCase().includes(q)) : lista)
    }
    if (u === '/api/fornecedores' && metodo === 'POST') {
      if (options.erroPost) return resposta(false, { error: options.erroPost })
      const novo = { ...ALMAVIVA, id: 'f2', totalCos: 0, totalTermos: 0, ...JSON.parse(String(init?.body)) }
      lista = [...lista, novo]
      return resposta(true, novo)
    }
    return resposta(false, { error: `rota inesperada ${metodo} ${u}` })
  }) as jest.Mock
}

describe('FornecedoresPage', () => {
  it('lista os fornecedores com acordo e link para a ficha', async () => {
    mockApi()
    render(<FornecedoresPage />)
    const link = await screen.findByRole('link', { name: 'ALMAVIVA' })
    expect(link).toHaveAttribute('href', '/fornecedores/f1')
    const linha = link.closest('tr')!
    expect(within(linha).getByText('LIFERAY')).toBeInTheDocument()
    expect(within(linha).getByText('AC-04.06/2022')).toBeInTheDocument()
  })

  it('busca por razão social ou CNPJ', async () => {
    mockApi()
    render(<FornecedoresPage />)
    await screen.findByText('ALMAVIVA')
    fireEvent.change(screen.getByLabelText('Buscar fornecedor'), { target: { value: 'safe' } })
    fireEvent.submit(screen.getByRole('search'))
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/fornecedores?q=safe'))
    expect(await screen.findByText('Nenhum fornecedor encontrado.')).toBeInTheDocument()
  })

  it('mostra erro quando a lista não carrega', async () => {
    mockApi({ erroLista: true })
    render(<FornecedoresPage />)
    expect(await screen.findByText('não autenticado')).toBeInTheDocument()
  })

  it('cadastra um fornecedor novo', async () => {
    mockApi()
    render(<FornecedoresPage />)
    fireEvent.click(await screen.findByRole('button', { name: /Novo fornecedor/ }))
    fireEvent.change(screen.getByLabelText('Razão social'), { target: { value: 'SAFETEC' } })
    fireEvent.change(screen.getByLabelText('Acordo'), { target: { value: 'GOOGLE' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    expect(await screen.findByRole('link', { name: 'SAFETEC' })).toBeInTheDocument()
    const post = (global.fetch as jest.Mock).mock.calls.find(([, init]) => init?.method === 'POST')!
    expect(JSON.parse(post[1].body)).toEqual(expect.objectContaining({ razaoSocial: 'SAFETEC', acordo: 'GOOGLE' }))
  })

  it('mostra a mensagem da API quando o cadastro falha', async () => {
    mockApi({ erroPost: 'Razão social: campo obrigatório' })
    render(<FornecedoresPage />)
    fireEvent.click(await screen.findByRole('button', { name: /Novo fornecedor/ }))
    fireEvent.change(screen.getByLabelText('Razão social'), { target: { value: 'X' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    expect(await screen.findByText('Razão social: campo obrigatório')).toBeInTheDocument()
  })
})
