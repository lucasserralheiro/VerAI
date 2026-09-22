import { Suspense } from 'react'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import FornecedorDetalhePage from './page'

const CO = {
  id: 'co1',
  fornecedorId: 'f1',
  numero: 'CO-12/2025',
  dataInicio: '2025-01-01T00:00:00.000Z',
  dataFim: '2025-12-31T00:00:00.000Z',
  valor: '150000',
  sei: '7010.2025/1',
}

const TERMO = {
  id: 't1',
  fornecedorId: 'f1',
  clienteId: 'c1',
  contratoId: null,
  numero: 'TC-0192',
  valor: null,
  vigenciaInicio: null,
  vigenciaFim: null,
  sei: null,
  observacao: null,
  fornecedor: { id: 'f1', razaoSocial: 'ALMAVIVA' },
  cliente: { id: 'c1', nome: 'Secretaria da Saúde', siglaLegado: 'SMS' },
  contrato: null,
}

function fornecedor(cos = [CO]) {
  return {
    id: 'f1',
    razaoSocial: 'ALMAVIVA',
    cnpj: null,
    contato: null,
    acordo: 'LIFERAY',
    numeroAcordo: 'AC-04.06/2022',
    dataAssinatura: '2025-09-23T00:00:00.000Z',
    sei: '7010.2025/0005275-4',
    cos,
    termos: [TERMO],
  }
}

function resposta(ok: boolean, corpo: unknown) {
  return Promise.resolve({ ok, json: () => Promise.resolve(corpo) }) as unknown as Promise<Response>
}

function mockApi(options: { naoEncontrado?: boolean; erroPostCo?: string } = {}) {
  let cos = [CO]
  global.fetch = jest.fn((url: RequestInfo | URL, init?: RequestInit) => {
    const u = String(url)
    const metodo = init?.method ?? 'GET'
    if (u === '/api/fornecedores/f1' && metodo === 'GET') {
      return options.naoEncontrado ? resposta(false, { error: 'fornecedor não encontrado' }) : resposta(true, fornecedor(cos))
    }
    if (u === '/api/fornecedores/f1' && metodo === 'PATCH') {
      return resposta(true, { ...fornecedor(cos), ...JSON.parse(String(init?.body)) })
    }
    if (u === '/api/fornecedores/f1/cos' && metodo === 'POST') {
      if (options.erroPostCo) return resposta(false, { error: options.erroPostCo })
      const novo = { ...CO, id: 'co2', valor: null, dataInicio: null, dataFim: null, sei: null, ...JSON.parse(String(init?.body)) }
      cos = [...cos, novo]
      return resposta(true, novo)
    }
    if (u === '/api/cos/co1' && metodo === 'DELETE') {
      cos = cos.filter((c) => c.id !== 'co1')
      return resposta(true, { ok: true })
    }
    if (u === '/api/termos-confirmacao?fornecedorId=f1') return resposta(true, [TERMO])
    return resposta(false, { error: `rota inesperada ${metodo} ${u}` })
  }) as jest.Mock
}

async function renderizar() {
  await act(async () => {
    render(
      <Suspense fallback={null}>
        <FornecedorDetalhePage params={Promise.resolve({ id: 'f1' })} />
      </Suspense>
    )
  })
}

describe('FornecedorDetalhePage', () => {
  it('mostra cabeçalho, CO e termos do fornecedor', async () => {
    mockApi()
    await renderizar()
    expect(await screen.findByRole('heading', { level: 1, name: 'ALMAVIVA' })).toBeInTheDocument()
    expect(screen.getByText(/LIFERAY/)).toBeInTheDocument()
    const linhaCo = screen.getByText('CO-12/2025').closest('tr')!
    expect(within(linhaCo).getByText('R$ 150.000,00')).toBeInTheDocument()
    expect(within(linhaCo).getByText('01/01/2025 – 31/12/2025')).toBeInTheDocument()
    expect(await screen.findByText('SMS — Secretaria da Saúde')).toBeInTheDocument()
  })

  it('mostra aviso quando o fornecedor não existe', async () => {
    mockApi({ naoEncontrado: true })
    await renderizar()
    expect(await screen.findByText('fornecedor não encontrado')).toBeInTheDocument()
  })

  it('cadastra um CO novo', async () => {
    mockApi()
    await renderizar()
    fireEvent.click(await screen.findByRole('button', { name: /Novo CO/ }))
    fireEvent.change(screen.getByLabelText('Nº do CO'), { target: { value: 'CO-99/2026' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    expect(await screen.findByText('CO-99/2026')).toBeInTheDocument()
    const post = (global.fetch as jest.Mock).mock.calls.find(([u, init]) => u === '/api/fornecedores/f1/cos' && init?.method === 'POST')!
    expect(JSON.parse(post[1].body)).toEqual(expect.objectContaining({ numero: 'CO-99/2026' }))
  })

  it('mostra a mensagem da API quando o CO não salva', async () => {
    mockApi({ erroPostCo: 'Fim da vigência: não pode ser antes do início' })
    await renderizar()
    fireEvent.click(await screen.findByRole('button', { name: /Novo CO/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    expect(await screen.findByText('Fim da vigência: não pode ser antes do início')).toBeInTheDocument()
  })

  it('exclui um CO depois da confirmação inline', async () => {
    mockApi()
    await renderizar()
    const linhaCo = (await screen.findByText('CO-12/2025')).closest('tr')!
    fireEvent.click(within(linhaCo).getByRole('button', { name: 'Excluir' }))
    fireEvent.click(within(linhaCo).getByRole('button', { name: 'Sim' }))
    await waitFor(() => expect(screen.queryByText('CO-12/2025')).not.toBeInTheDocument())
  })

  it('edita o cabeçalho do fornecedor', async () => {
    mockApi()
    await renderizar()
    fireEvent.click(await screen.findByRole('button', { name: /Editar fornecedor/ }))
    fireEvent.change(screen.getByLabelText('Razão social'), { target: { value: 'ALMAVIVA DO BRASIL' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'ALMAVIVA DO BRASIL' })).toBeInTheDocument()
  })
})
