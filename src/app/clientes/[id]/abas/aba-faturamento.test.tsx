import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { AbaFaturamento } from './aba-faturamento'
import { PermissaoContext } from '../permissao-cliente'

const FAT = {
  id: 'f1',
  clienteId: 'c1',
  contratoId: 'k1',
  competenciaAno: 2026,
  competenciaMes: 8,
  valor: null,
  situacao: null,
  sei: '7010.2026/0009363-0',
  complementar: false,
  observacao: null,
  unidadeDestino: 'SMS/CTIC',
  enviadoCliente: true,
  enviadoGfp: false,
  contrato: { id: 'k1', numeroTermo: 'TC 107/2025/SI' },
  valorNotas: '6752620.3',
  servicos: ['Data Center', 'Redes'],
  valorExibido: '6752620.3',
}

function resposta(ok: boolean, corpo: unknown) {
  return Promise.resolve({ ok, json: () => Promise.resolve(corpo) }) as unknown as Promise<Response>
}

function mockApi(options: { erroLista?: boolean; erroPost?: string } = {}) {
  let lista: Array<Record<string, unknown>> = [FAT]
  global.fetch = jest.fn((url: RequestInfo | URL, init?: RequestInit) => {
    const u = String(url)
    const metodo = init?.method ?? 'GET'
    if (u.startsWith('/api/clientes/c1/faturamentos') && metodo === 'GET') {
      return options.erroLista ? resposta(false, { error: 'acesso negado' }) : resposta(true, lista)
    }
    if (u === '/api/clientes/c1/contratos') {
      return resposta(true, [
        { id: 'k1', numeroTermo: 'TC 107/2025/SI' },
        { id: 'k2', numeroTermo: 'TC 207/2023' },
      ])
    }
    if (u === '/api/clientes/c1/faturamentos' && metodo === 'POST') {
      if (options.erroPost) return resposta(false, { error: options.erroPost })
      const corpo = JSON.parse(String(init?.body))
      const novo = {
        ...FAT,
        id: 'f2',
        ...corpo,
        competenciaAno: Number(corpo.competenciaAno),
        competenciaMes: Number(corpo.competenciaMes),
        contrato: { id: 'k2', numeroTermo: 'TC 207/2023' },
        servicos: [],
        valorExibido: '0',
      }
      lista = [novo, ...lista]
      return resposta(true, novo)
    }
    return resposta(false, { error: `rota inesperada ${metodo} ${u}` })
  }) as jest.Mock
}

describe('AbaFaturamento', () => {
  it('lista os faturamentos como no mockup', async () => {
    mockApi()
    render(<AbaFaturamento clienteId="c1" />)
    // O nº SEI é o SeiLink (sem link cadastrado, o clique copia o número); o lançamento abre em "ver lançamento".
    const linha = (await screen.findByRole('button', { name: '7010.2026/0009363-0' })).closest('tr')!
    expect(within(linha).getByRole('link', { name: 'ver lançamento' })).toHaveAttribute('href', '/clientes/c1/faturamentos/f1')
    expect(within(linha).getByText('TC 107/2025/SI')).toBeInTheDocument()
    expect(within(linha).getByText('7010.2026/0009363-0')).toBeInTheDocument()
    expect(within(linha).getByText('Data Center, Redes')).toBeInTheDocument()
    expect(within(linha).getByText('R$ 6.752.620,30')).toBeInTheDocument()
    expect(within(linha).getByText('sim')).toBeInTheDocument()
    expect(within(linha).getByText('pendente')).toBeInTheDocument()
    expect(within(linha).getByText('Destino: SMS/CTIC')).toBeInTheDocument()
  })

  it('agrupa por competência, com total e pendências da faixa', async () => {
    mockApi()
    render(<AbaFaturamento clienteId="c1" />)
    const faixa = (await screen.findByRole('heading', { name: 'Agosto de 2026' })).closest('tr')!
    expect(within(faixa).getByText('1 lançamento')).toBeInTheDocument()
    expect(within(faixa).getByText('R$ 6.752.620,30')).toBeInTheDocument()
    expect(within(faixa).getByText('1 com envio pendente')).toBeInTheDocument()
  })

  it('resume o faturamento no topo e filtra só os pendentes de envio', async () => {
    mockApi()
    render(<AbaFaturamento clienteId="c1" />)
    const resumo = await screen.findByLabelText('Resumo do faturamento')
    expect(within(resumo).getByText('1/1')).toBeInTheDocument() // enviado ao cliente
    expect(within(resumo).getByText('0/1')).toBeInTheDocument() // enviado ao GFP

    fireEvent.click(screen.getByRole('button', { name: 'Só pendentes de envio' }))
    expect(screen.getByRole('button', { name: '7010.2026/0009363-0' })).toBeInTheDocument() // GFP pendente: continua
  })

  it('filtra por competência e contrato', async () => {
    mockApi()
    render(<AbaFaturamento clienteId="c1" />)
    await screen.findByText('Agosto de 2026')
    await screen.findByRole('option', { name: 'TC 207/2023' })
    fireEvent.change(screen.getByLabelText('Filtrar por ano'), { target: { value: '2026' } })
    fireEvent.change(screen.getByLabelText('Filtrar por mês'), { target: { value: '8' } })
    fireEvent.change(screen.getByLabelText('Filtrar por contrato'), { target: { value: 'k2' } })
    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith('/api/clientes/c1/faturamentos?ano=2026&mes=8&contratoId=k2')
    )
  })

  it('"Lançamento" na faixa da competência abre o formulário já com mês, ano e contrato', async () => {
    mockApi()
    render(<AbaFaturamento clienteId="c1" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Adicionar lançamento em Agosto de 2026' }))
    const form = await screen.findByRole('form', { name: 'Novo faturamento' })
    expect(within(form).getByLabelText('Mês')).toHaveValue('8')
    expect(within(form).getByLabelText('Ano')).toHaveValue('2026')
  })

  it('mostra erro quando a lista não carrega', async () => {
    mockApi({ erroLista: true })
    render(<AbaFaturamento clienteId="c1" />)
    expect(await screen.findByText('acesso negado')).toBeInTheDocument()
  })

  it('cadastra um faturamento', async () => {
    mockApi()
    render(<AbaFaturamento clienteId="c1" />)
    fireEvent.click(await screen.findByRole('button', { name: /Novo faturamento/ }))
    const form = screen.getByRole('form', { name: 'Novo faturamento' })
    await within(form).findByRole('option', { name: 'TC 207/2023' })
    fireEvent.change(within(form).getByLabelText('Contrato'), { target: { value: 'k2' } })
    fireEvent.change(within(form).getByLabelText('Mês'), { target: { value: '7' } })
    fireEvent.change(within(form).getByLabelText('Ano'), { target: { value: '2026' } })
    fireEvent.change(within(form).getByLabelText('SEI'), { target: { value: '7010.2026/0008279-5' } })
    fireEvent.click(within(form).getByLabelText('Enviado ao cliente'))
    fireEvent.click(within(form).getByRole('button', { name: 'Salvar' }))
    expect(await screen.findByRole('button', { name: '7010.2026/0008279-5' })).toBeInTheDocument()
    const post = (global.fetch as jest.Mock).mock.calls.find(([, init]) => init?.method === 'POST')!
    expect(JSON.parse(post[1].body)).toEqual(
      expect.objectContaining({
        contratoId: 'k2',
        competenciaMes: '7',
        competenciaAno: '2026',
        sei: '7010.2026/0008279-5',
        enviadoCliente: true,
        enviadoGfp: false,
      })
    )
  })

  it('mostra a mensagem da API quando o cadastro falha', async () => {
    mockApi({ erroPost: 'Contrato: não pertence a este cliente' })
    render(<AbaFaturamento clienteId="c1" />)
    fireEvent.click(await screen.findByRole('button', { name: /Novo faturamento/ }))
    const form = screen.getByRole('form', { name: 'Novo faturamento' })
    await within(form).findByRole('option', { name: 'TC 207/2023' })
    fireEvent.change(within(form).getByLabelText('Contrato'), { target: { value: 'k2' } })
    fireEvent.change(within(form).getByLabelText('Mês'), { target: { value: '7' } })
    fireEvent.change(within(form).getByLabelText('Ano'), { target: { value: '2026' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Salvar' }))
    expect(await screen.findByText('Contrato: não pertence a este cliente')).toBeInTheDocument()
  })
})

describe('AbaFaturamento somente leitura', () => {
  it('sem permissão de edição não mostra "Novo faturamento" nem "Lançamento", e a linha não abre o editor', async () => {
    mockApi()
    render(
      <PermissaoContext.Provider value={{ carregando: false, podeEditar: false, gerencia: null }}>
        <AbaFaturamento clienteId="c1" />
      </PermissaoContext.Provider>,
    )
    expect(await screen.findByText('7010.2026/0009363-0')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Novo faturamento/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /Adicionar lançamento/ })).toBeNull()
    fireEvent.click(screen.getByText('7010.2026/0009363-0'))
    expect(screen.queryByText('Excluir faturamento')).toBeNull()
  })
})
