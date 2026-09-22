import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { AbaResponsaveis } from './aba-responsaveis'

interface Responsavel {
  id: string
  nome: string
  area: string | null
  email: string | null
  telefone: string | null
  celular: string | null
}

const ANA: Responsavel = {
  id: 'r1',
  nome: 'Ana Souza',
  area: 'Sistemas',
  email: 'ana@prefeitura.sp.gov.br',
  telefone: '11 3333-0000',
  celular: null,
}

function resposta(ok: boolean, corpo: unknown) {
  return Promise.resolve({ ok, json: () => Promise.resolve(corpo) }) as unknown as Promise<Response>
}

function mockApi(options: { lista?: Responsavel[]; erroPost?: string } = {}) {
  let lista = [...(options.lista ?? [ANA])]
  global.fetch = jest.fn((url: RequestInfo | URL, init?: RequestInit) => {
    const u = String(url)
    const metodo = init?.method ?? 'GET'
    if (u === '/api/clientes/c1/responsaveis' && metodo === 'GET') return resposta(true, lista)
    if (u === '/api/clientes/c1/responsaveis' && metodo === 'POST') {
      if (options.erroPost) return resposta(false, { error: options.erroPost })
      const novo = { id: 'r2', area: null, email: null, telefone: null, celular: null, ...JSON.parse(String(init?.body)) }
      lista = [...lista, novo]
      return resposta(true, novo)
    }
    if (u === '/api/responsaveis/r1' && metodo === 'PATCH') {
      const atualizado = { ...ANA, ...JSON.parse(String(init?.body)) }
      lista = lista.map((r) => (r.id === 'r1' ? atualizado : r))
      return resposta(true, atualizado)
    }
    if (u === '/api/responsaveis/r1' && metodo === 'DELETE') {
      lista = lista.filter((r) => r.id !== 'r1')
      return resposta(true, { ok: true })
    }
    return resposta(false, { error: 'inesperado' })
  }) as jest.Mock
}

describe('AbaResponsaveis', () => {
  it('mostra um cartão por responsável com área e contatos', async () => {
    mockApi()
    render(<AbaResponsaveis clienteId="c1" />)

    expect(await screen.findByText('Ana Souza')).toBeInTheDocument()
    expect(screen.getByText('Sistemas')).toBeInTheDocument()
    expect(screen.getByText('ana@prefeitura.sp.gov.br')).toBeInTheDocument()
    expect(screen.getByText('11 3333-0000')).toBeInTheDocument()
  })

  it('lista vazia mostra aviso', async () => {
    mockApi({ lista: [] })
    render(<AbaResponsaveis clienteId="c1" />)
    expect(await screen.findByText('Nenhum responsável cadastrado.')).toBeInTheDocument()
  })

  it('cria um responsável', async () => {
    mockApi()
    render(<AbaResponsaveis clienteId="c1" />)

    fireEvent.click(await screen.findByRole('button', { name: 'Novo responsável' }))
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Bruno Lima' } })
    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'bruno@x.gov.br' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/clientes/c1/responsaveis',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ nome: 'Bruno Lima', area: '', email: 'bruno@x.gov.br', telefone: '', celular: '' }),
        })
      )
    )
    expect(await screen.findByText('Bruno Lima')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Salvar' })).not.toBeInTheDocument()
  })

  it('mostra o erro da API ao criar', async () => {
    mockApi({ erroPost: 'email: e-mail inválido' })
    render(<AbaResponsaveis clienteId="c1" />)

    fireEvent.click(await screen.findByRole('button', { name: 'Novo responsável' }))
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Bruno' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))

    expect(await screen.findByText('email: e-mail inválido')).toBeInTheDocument()
  })

  it('edita um responsável', async () => {
    mockApi()
    render(<AbaResponsaveis clienteId="c1" />)

    const cartao = (await screen.findByText('Ana Souza')).closest('li') as HTMLElement
    fireEvent.click(within(cartao).getByRole('button', { name: 'Editar' }))
    expect(screen.getByLabelText('Nome')).toHaveValue('Ana Souza')
    fireEvent.change(screen.getByLabelText('Área'), { target: { value: 'Infraestrutura' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith('/api/responsaveis/r1', expect.objectContaining({ method: 'PATCH' }))
    )
    expect(await screen.findByText('Infraestrutura')).toBeInTheDocument()
  })

  it('exclui com confirmação inline', async () => {
    mockApi()
    render(<AbaResponsaveis clienteId="c1" />)

    const cartao = (await screen.findByText('Ana Souza')).closest('li') as HTMLElement
    fireEvent.click(within(cartao).getByRole('button', { name: 'Excluir' }))
    expect(within(cartao).getByText('Excluir?')).toBeInTheDocument()
    fireEvent.click(within(cartao).getByRole('button', { name: 'Não' }))
    expect(screen.getByText('Ana Souza')).toBeInTheDocument()

    fireEvent.click(within(cartao).getByRole('button', { name: 'Excluir' }))
    fireEvent.click(within(cartao).getByRole('button', { name: 'Sim' }))

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith('/api/responsaveis/r1', expect.objectContaining({ method: 'DELETE' }))
    )
    expect(await screen.findByText('Nenhum responsável cadastrado.')).toBeInTheDocument()
  })
})
