import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { ListaDemandas } from './lista-demandas'

const DEMANDA = {
  id: 'd1',
  clienteId: 'c1',
  assunto: 'Liberação VPN SMTUR',
  tipoAssunto: 'Outros',
  tipo: 'E-mail',
  responsavel: 'Vera',
  situacao: 'Em andamento',
  dataAbertura: '2026-08-01T03:00:00.000Z',
  documento: null,
  sei: null,
  notaImportacao: 'cliente atribuído no import (SMS): cliente vazio no GRC-1',
  cliente: { id: 'c1', nome: 'Secretaria da Saúde', siglaLegado: 'SMS' },
  ultimoTramite: { posicao: 'Aguardando retorno da SMS', responsavelAtual: 'SMS', data: '2026-09-10T03:00:00.000Z' },
}

const SUGESTOES = { situacao: ['Em andamento', 'Concluído'], tipo: ['E-mail'], tipoAssunto: ['Outros'], responsavel: ['Vera'] }

function resposta(ok: boolean, corpo: unknown) {
  return Promise.resolve({ ok, json: () => Promise.resolve(corpo) }) as unknown as Promise<Response>
}

function mockApi(options: { erroLista?: boolean; erroPost?: string } = {}) {
  let lista: Array<Record<string, unknown>> = [DEMANDA]
  global.fetch = jest.fn((url: RequestInfo | URL, init?: RequestInit) => {
    const u = String(url)
    const metodo = init?.method ?? 'GET'
    if (u.startsWith('/api/demandas') && metodo === 'GET') {
      return options.erroLista ? resposta(false, { error: 'não autenticado' }) : resposta(true, { demandas: lista, sugestoes: SUGESTOES })
    }
    if (u === '/api/clientes') {
      return resposta(true, [
        { id: 'c1', nome: 'Secretaria da Saúde', siglaLegado: 'SMS' },
        { id: 'c2', nome: 'Secretaria da Fazenda', siglaLegado: 'SF' },
      ])
    }
    if (u === '/api/demandas' && metodo === 'POST') {
      if (options.erroPost) return resposta(false, { error: options.erroPost })
      const corpo = JSON.parse(String(init?.body))
      const nova = { ...DEMANDA, id: 'd2', notaImportacao: null, ultimoTramite: null, ...corpo }
      lista = [nova, ...lista]
      return resposta(true, nova)
    }
    return resposta(false, { error: `rota inesperada ${metodo} ${u}` })
  }) as jest.Mock
}

describe('ListaDemandas', () => {
  it('na ficha do cliente: tabela do mockup, só do cliente, com aviso de atribuição no import', async () => {
    mockApi()
    render(<ListaDemandas clienteId="c1" />)
    const link = await screen.findByRole('link', { name: 'Liberação VPN SMTUR' })
    expect(link).toHaveAttribute('href', '/demandas/d1')
    const linha = link.closest('tr')!
    expect(within(linha).getByText('E-mail')).toBeInTheDocument()
    expect(within(linha).getByText('Vera')).toBeInTheDocument()
    expect(within(linha).getByText('Aguardando retorno da SMS')).toBeInTheDocument()
    expect(within(linha).getByText('10/09/2026')).toBeInTheDocument()
    expect(within(linha).getByText('Em andamento')).toBeInTheDocument()
    expect(within(linha).getByTitle('cliente atribuído no import (SMS): cliente vazio no GRC-1')).toBeInTheDocument()
    expect(global.fetch).toHaveBeenCalledWith('/api/demandas?clienteId=c1')
    // Na ficha do cliente não há coluna nem filtro de cliente.
    expect(screen.queryByLabelText('Filtrar por cliente')).not.toBeInTheDocument()
  })

  it('na lista geral: coluna de cliente e filtros de cliente, situação, busca e atribuídas no import', async () => {
    mockApi()
    render(<ListaDemandas />)
    const linha = (await screen.findByRole('link', { name: 'Liberação VPN SMTUR' })).closest('tr')!
    expect(within(linha).getByText('SMS')).toBeInTheDocument()
    await screen.findByRole('option', { name: 'SF — Secretaria da Fazenda' })
    fireEvent.change(screen.getByLabelText('Filtrar por cliente'), { target: { value: 'c2' } })
    fireEvent.change(screen.getByLabelText('Filtrar por situação'), { target: { value: 'Concluído' } })
    fireEvent.click(screen.getByLabelText('Só com cliente atribuído no import'))
    fireEvent.change(screen.getByLabelText('Buscar demanda'), { target: { value: 'vpn' } })
    fireEvent.submit(screen.getByRole('search'))
    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith('/api/demandas?clienteId=c2&situacao=Conclu%C3%ADdo&atribuidaNoImport=1&q=vpn')
    )
  })

  it('mostra erro quando a lista não carrega', async () => {
    mockApi({ erroLista: true })
    render(<ListaDemandas />)
    expect(await screen.findByText('não autenticado')).toBeInTheDocument()
  })

  it('cria uma demanda no cliente da ficha', async () => {
    mockApi()
    render(<ListaDemandas clienteId="c1" />)
    fireEvent.click(await screen.findByRole('button', { name: /Nova demanda/ }))
    const form = screen.getByRole('form', { name: 'Nova demanda' })
    fireEvent.change(within(form).getByLabelText('Assunto'), { target: { value: 'Portal HSPM' } })
    fireEvent.change(within(form).getByLabelText('Situação'), { target: { value: 'Em andamento' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Salvar' }))
    expect(await screen.findByRole('link', { name: 'Portal HSPM' })).toBeInTheDocument()
    const post = (global.fetch as jest.Mock).mock.calls.find(([, init]) => init?.method === 'POST')!
    expect(JSON.parse(post[1].body)).toEqual(expect.objectContaining({ clienteId: 'c1', assunto: 'Portal HSPM', situacao: 'Em andamento' }))
  })

  it('na lista geral, a demanda nova pede o cliente e mostra erro da API', async () => {
    mockApi({ erroPost: 'acesso negado' })
    render(<ListaDemandas />)
    fireEvent.click(await screen.findByRole('button', { name: /Nova demanda/ }))
    const form = screen.getByRole('form', { name: 'Nova demanda' })
    await within(form).findByRole('option', { name: 'SF — Secretaria da Fazenda' })
    fireEvent.change(within(form).getByLabelText('Cliente'), { target: { value: 'c2' } })
    fireEvent.change(within(form).getByLabelText('Assunto'), { target: { value: 'X' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Salvar' }))
    expect(await within(form).findByText('acesso negado')).toBeInTheDocument()
  })
})
