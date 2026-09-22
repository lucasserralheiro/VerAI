import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import SolicitacoesPage from './page'

const SOLICITACAO = {
  id: 's1',
  clienteId: 'c1',
  tipo: 'RDM',
  numero: '1615977',
  descricao: 'Aumento capacidade Sharepoint',
  situacao: null,
  dataAbertura: '2026-02-24T03:00:00.000Z',
  dataFinal: null,
  comVisita: false,
  observacao: null,
  cliente: { id: 'c1', nome: 'Secretaria de Governo', siglaLegado: 'SGM' },
}

function resposta(ok: boolean, corpo: unknown) {
  return Promise.resolve({ ok, json: () => Promise.resolve(corpo) }) as unknown as Promise<Response>
}

function mockApi(options: { erroLista?: boolean; erroPost?: string } = {}) {
  let lista: Array<Record<string, unknown>> = [SOLICITACAO]
  global.fetch = jest.fn((url: RequestInfo | URL, init?: RequestInit) => {
    const u = String(url)
    const metodo = init?.method ?? 'GET'
    const corpo = init?.body ? JSON.parse(String(init.body)) : null
    if (u.startsWith('/api/solicitacoes') && metodo === 'GET') {
      return options.erroLista
        ? resposta(false, { error: 'não autenticado' })
        : resposta(true, { solicitacoes: lista, sugestoes: { tipo: ['RDM', 'Solicitação'], situacao: ['Concluída'] } })
    }
    if (u === '/api/clientes') {
      return resposta(true, [
        { id: 'c1', nome: 'Secretaria de Governo', siglaLegado: 'SGM' },
        { id: 'c2', nome: 'Secretaria da Saúde', siglaLegado: 'SMS' },
      ])
    }
    if (u === '/api/solicitacoes' && metodo === 'POST') {
      if (options.erroPost) return resposta(false, { error: options.erroPost })
      const nova = { ...SOLICITACAO, id: 's2', ...corpo, cliente: { id: 'c2', nome: 'Secretaria da Saúde', siglaLegado: 'SMS' } }
      lista = [nova, ...lista]
      return resposta(true, nova)
    }
    if (u === '/api/solicitacoes/s1' && metodo === 'PATCH') {
      lista = lista.map((s) => (s.id === 's1' ? { ...s, ...corpo } : s))
      return resposta(true, lista[0])
    }
    return resposta(false, { error: `rota inesperada ${metodo} ${u}` })
  }) as jest.Mock
}

describe('SolicitacoesPage', () => {
  it('lista as solicitações com cliente, nº do chamado e tipo', async () => {
    mockApi()
    render(<SolicitacoesPage />)
    const linha = (await screen.findByText('Aumento capacidade Sharepoint')).closest('tr')!
    expect(within(linha).getByText('SGM')).toBeInTheDocument()
    expect(within(linha).getByText('1615977')).toBeInTheDocument()
    expect(within(linha).getByText('RDM')).toBeInTheDocument()
    expect(within(linha).getByText('24/02/2026')).toBeInTheDocument()
  })

  it('filtra por cliente, situação e busca', async () => {
    mockApi()
    render(<SolicitacoesPage />)
    await screen.findByText('Aumento capacidade Sharepoint')
    await screen.findByRole('option', { name: 'SMS — Secretaria da Saúde' })
    fireEvent.change(screen.getByLabelText('Filtrar por cliente'), { target: { value: 'c2' } })
    fireEvent.change(screen.getByLabelText('Filtrar por situação'), { target: { value: 'Concluída' } })
    fireEvent.change(screen.getByLabelText('Buscar solicitação'), { target: { value: '1615977' } })
    fireEvent.submit(screen.getByRole('search'))
    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith('/api/solicitacoes?clienteId=c2&situacao=Conclu%C3%ADda&q=1615977')
    )
  })

  it('mostra erro quando a lista não carrega', async () => {
    mockApi({ erroLista: true })
    render(<SolicitacoesPage />)
    expect(await screen.findByText('não autenticado')).toBeInTheDocument()
  })

  it('cadastra uma solicitação', async () => {
    mockApi()
    render(<SolicitacoesPage />)
    fireEvent.click(await screen.findByRole('button', { name: /Nova solicitação/ }))
    const form = screen.getByRole('form', { name: 'Nova solicitação' })
    await within(form).findByRole('option', { name: 'SMS — Secretaria da Saúde' })
    fireEvent.change(within(form).getByLabelText('Cliente'), { target: { value: 'c2' } })
    fireEvent.change(within(form).getByLabelText('Assunto'), { target: { value: 'Liberação acesso NAS' } })
    fireEvent.change(within(form).getByLabelText('Nº do chamado'), { target: { value: '1685569' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Salvar' }))
    expect(await screen.findByText('Liberação acesso NAS')).toBeInTheDocument()
    const post = (global.fetch as jest.Mock).mock.calls.find(([, init]) => init?.method === 'POST')!
    expect(JSON.parse(post[1].body)).toEqual(
      expect.objectContaining({ clienteId: 'c2', descricao: 'Liberação acesso NAS', numero: '1685569', comVisita: false })
    )
  })

  it('edita uma solicitação inline', async () => {
    mockApi()
    render(<SolicitacoesPage />)
    const linha = (await screen.findByText('Aumento capacidade Sharepoint')).closest('tr')!
    fireEvent.click(within(linha).getByRole('button', { name: 'Editar' }))
    const form = screen.getByRole('form', { name: 'Editar solicitação' })
    await within(form).findByRole('option', { name: 'SGM — Secretaria de Governo' })
    fireEvent.change(within(form).getByLabelText('Situação'), { target: { value: 'Concluída' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Salvar' }))
    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith('/api/solicitacoes/s1', expect.objectContaining({ method: 'PATCH' }))
    )
    expect(await screen.findByText('Concluída', { selector: 'td' })).toBeInTheDocument()
  })

  it('mostra a mensagem da API quando salvar falha', async () => {
    mockApi({ erroPost: 'acesso negado' })
    render(<SolicitacoesPage />)
    fireEvent.click(await screen.findByRole('button', { name: /Nova solicitação/ }))
    const form = screen.getByRole('form', { name: 'Nova solicitação' })
    await within(form).findByRole('option', { name: 'SMS — Secretaria da Saúde' })
    fireEvent.change(within(form).getByLabelText('Cliente'), { target: { value: 'c2' } })
    fireEvent.change(within(form).getByLabelText('Assunto'), { target: { value: 'X' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Salvar' }))
    expect(await within(form).findByText('acesso negado')).toBeInTheDocument()
  })
})
