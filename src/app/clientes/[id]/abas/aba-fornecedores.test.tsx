import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { AbaFornecedores } from './aba-fornecedores'

const TERMO = {
  id: 't1',
  fornecedorId: 'f1',
  clienteId: 'c1',
  contratoId: 'k1',
  numero: 'TC-0192',
  valor: '4120000',
  vigenciaInicio: '2025-09-23T00:00:00.000Z',
  vigenciaFim: '2026-09-22T00:00:00.000Z',
  sei: '7010.2025/0005275-1',
  observacao: null,
  fornecedor: { id: 'f1', razaoSocial: 'ALMAVIVA' },
  cliente: { id: 'c1', nome: 'Saúde', siglaLegado: 'SMS' },
  contrato: { id: 'k1', numeroTermo: 'TC 105/2025/SI' },
}

function resposta(ok: boolean, corpo: unknown) {
  return Promise.resolve({ ok, json: () => Promise.resolve(corpo) }) as unknown as Promise<Response>
}

function mockApi(options: { lista?: unknown[]; erroLista?: boolean; erroPost?: string } = {}) {
  let lista = [...(options.lista ?? [TERMO])]
  global.fetch = jest.fn((url: RequestInfo | URL, init?: RequestInit) => {
    const u = String(url)
    const metodo = init?.method ?? 'GET'
    if (u === '/api/termos-confirmacao?clienteId=c1' && metodo === 'GET') {
      return options.erroLista ? resposta(false, { error: 'acesso negado' }) : resposta(true, lista)
    }
    if (u === '/api/fornecedores' && metodo === 'GET') {
      return resposta(true, [
        { id: 'f1', razaoSocial: 'ALMAVIVA' },
        { id: 'f2', razaoSocial: 'BRASOFTWARE' },
      ])
    }
    if (u === '/api/termos-confirmacao' && metodo === 'POST') {
      if (options.erroPost) return resposta(false, { error: options.erroPost })
      const corpo = JSON.parse(String(init?.body))
      const novo = {
        ...TERMO,
        ...corpo,
        id: 't2',
        contratoId: null,
        contrato: null,
        fornecedor: { id: corpo.fornecedorId, razaoSocial: 'BRASOFTWARE' },
      }
      lista = [...lista, novo]
      return resposta(true, novo)
    }
    if (u === '/api/termos-confirmacao/t1' && metodo === 'DELETE') {
      lista = lista.filter((t) => (t as { id: string }).id !== 't1')
      return resposta(true, { ok: true })
    }
    return resposta(false, { error: `rota inesperada ${metodo} ${u}` })
  }) as jest.Mock
}

describe('AbaFornecedores', () => {
  it('lista os termos do cliente como no mockup', async () => {
    mockApi()
    render(<AbaFornecedores clienteId="c1" />)
    const linha = (await screen.findByText('ALMAVIVA')).closest('tr')!
    expect(within(linha).getByText('TC-0192')).toBeInTheDocument()
    expect(within(linha).getByText('TC 105/2025/SI')).toBeInTheDocument()
    expect(within(linha).getByText('R$ 4.120.000,00')).toBeInTheDocument()
    expect(within(linha).getByText('23/09/2025 – 22/09/2026')).toBeInTheDocument()
    expect(within(linha).getByText('7010.2025/0005275-1')).toBeInTheDocument()
  })

  it('mostra erro quando a lista não carrega, em vez de lista vazia', async () => {
    mockApi({ erroLista: true })
    render(<AbaFornecedores clienteId="c1" />)
    expect(await screen.findByText('acesso negado')).toBeInTheDocument()
    expect(screen.queryByText(/Nenhum termo/)).not.toBeInTheDocument()
  })

  it('cria um termo de confirmação escolhendo o fornecedor', async () => {
    mockApi({ lista: [] })
    render(<AbaFornecedores clienteId="c1" />)
    fireEvent.click(await screen.findByRole('button', { name: /Novo termo de confirmação/ }))
    const select = await screen.findByLabelText('Fornecedor')
    await screen.findByRole('option', { name: 'BRASOFTWARE' })
    fireEvent.change(select, { target: { value: 'f2' } })
    fireEvent.change(screen.getByLabelText('Nº do TC'), { target: { value: 'TC-0201' } })
    fireEvent.change(screen.getByLabelText('Valor'), { target: { value: '980.500,00' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/termos-confirmacao',
        expect.objectContaining({ method: 'POST' })
      )
    )
    const post = (global.fetch as jest.Mock).mock.calls.find(([, init]) => init?.method === 'POST')!
    expect(JSON.parse(post[1].body)).toEqual(
      expect.objectContaining({ clienteId: 'c1', fornecedorId: 'f2', numero: 'TC-0201', valor: '980.500,00' })
    )
    expect(await screen.findByText('BRASOFTWARE')).toBeInTheDocument()
  })

  it('mostra a mensagem da API quando salvar falha', async () => {
    mockApi({ lista: [], erroPost: 'Contrato: não pertence a este cliente' })
    render(<AbaFornecedores clienteId="c1" />)
    fireEvent.click(await screen.findByRole('button', { name: /Novo termo de confirmação/ }))
    await screen.findByRole('option', { name: 'ALMAVIVA' })
    fireEvent.change(screen.getByLabelText('Fornecedor'), { target: { value: 'f1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    expect(await screen.findByText('Contrato: não pertence a este cliente')).toBeInTheDocument()
  })

  it('exclui um termo depois da confirmação inline', async () => {
    mockApi()
    render(<AbaFornecedores clienteId="c1" />)
    await screen.findByText('ALMAVIVA')
    fireEvent.click(screen.getByRole('button', { name: 'Excluir' }))
    fireEvent.click(screen.getByRole('button', { name: 'Sim' }))
    await waitFor(() => expect(screen.queryByText('ALMAVIVA')).not.toBeInTheDocument())
  })
})
