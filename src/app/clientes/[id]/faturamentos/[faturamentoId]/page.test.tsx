import { Suspense } from 'react'
import { PermissaoContext } from '../../permissao-cliente'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import FaturamentoDetalhePage from './page'

const NOTA = {
  id: 'n1',
  faturamentoId: 'f1',
  numero: '37619',
  valor: '113119.2',
  dataEmissao: '2022-06-06T03:00:00.000Z',
  servico: 'Prod. Customizados',
  quantidade: null,
  complementar: false,
}

function faturamento(notas: unknown[] = [NOTA], parcial: Record<string, unknown> = {}) {
  return {
    id: 'f1',
    clienteId: 'c1',
    contratoId: 'k1',
    competenciaAno: 2022,
    competenciaMes: 5,
    valor: null,
    situacao: null,
    sei: '7010202200055294',
    complementar: false,
    observacao: null,
    unidadeDestino: 'SMS/CTIC',
    enviadoCliente: false,
    enviadoGfp: false,
    contrato: { id: 'k1', numeroTermo: 'TC 142/2021' },
    valorNotas: '113119.2',
    servicos: ['Prod. Customizados'],
    valorExibido: '113119.2',
    notas,
    ...parcial,
  }
}

function resposta(ok: boolean, corpo: unknown) {
  return Promise.resolve({ ok, json: () => Promise.resolve(corpo) }) as unknown as Promise<Response>
}

function mockApi(options: { erroNota?: string } = {}) {
  let notas: Array<Record<string, unknown>> = [NOTA]
  global.fetch = jest.fn((url: RequestInfo | URL, init?: RequestInit) => {
    const u = String(url)
    const metodo = init?.method ?? 'GET'
    const corpo = init?.body ? JSON.parse(String(init.body)) : null
    if (u === '/api/faturamentos/f1' && metodo === 'GET') return resposta(true, faturamento(notas))
    if (u === '/api/faturamentos/f1' && metodo === 'PATCH') return resposta(true, faturamento(notas, corpo))
    if (u === '/api/clientes/c1/contratos') return resposta(true, [{ id: 'k1', numeroTermo: 'TC 142/2021' }])
    if (u === '/api/faturamentos/f1/notas' && metodo === 'POST') {
      if (options.erroNota) return resposta(false, { error: options.erroNota })
      const nova = { ...NOTA, id: 'n2', dataEmissao: null, ...corpo }
      notas = [...notas, nova]
      return resposta(true, nova)
    }
    if (u === '/api/notas-fiscais/n1' && metodo === 'DELETE') {
      notas = notas.filter((n) => n.id !== 'n1')
      return resposta(true, { ok: true })
    }
    return resposta(false, { error: `rota inesperada ${metodo} ${u}` })
  }) as jest.Mock
}

async function renderizar() {
  await act(async () => {
    render(
      <Suspense fallback={null}>
        <FaturamentoDetalhePage params={Promise.resolve({ id: 'c1', faturamentoId: 'f1' })} />
      </Suspense>
    )
  })
}

describe('FaturamentoDetalhePage', () => {
  it('mostra cabeçalho e notas fiscais', async () => {
    mockApi()
    await renderizar()
    expect(await screen.findByRole('heading', { level: 1, name: 'Faturamento 05/2022' })).toBeInTheDocument()
    expect(screen.getByText('TC 142/2021')).toBeInTheDocument()
    expect(screen.getByText('SMS/CTIC')).toBeInTheDocument()
    const notas = screen.getByRole('region', { name: 'Notas fiscais' })
    const linha = within(notas).getByText('37619').closest('tr')!
    expect(within(linha).getByText('R$ 113.119,20')).toBeInTheDocument()
    expect(within(linha).getByText('06/06/2022')).toBeInTheDocument()
    expect(within(linha).getByText('Prod. Customizados')).toBeInTheDocument()
  })

  it('cadastra uma nota fiscal', async () => {
    mockApi()
    await renderizar()
    const notas = await screen.findByRole('region', { name: 'Notas fiscais' })
    fireEvent.click(within(notas).getByRole('button', { name: /Nova nota/ }))
    fireEvent.change(within(notas).getByLabelText('Nº da nota'), { target: { value: '40001' } })
    fireEvent.change(within(notas).getByLabelText('Valor'), { target: { value: '1.000,00' } })
    fireEvent.click(within(notas).getByRole('button', { name: 'Salvar' }))
    expect(await within(notas).findByText('40001')).toBeInTheDocument()
    const post = (global.fetch as jest.Mock).mock.calls.find(([u]) => u === '/api/faturamentos/f1/notas')!
    expect(JSON.parse(post[1].body)).toEqual(expect.objectContaining({ numero: '40001', valor: '1.000,00' }))
  })

  it('mostra o erro da API ao salvar nota', async () => {
    mockApi({ erroNota: 'Valor: valor não pode ser negativo' })
    await renderizar()
    const notas = await screen.findByRole('region', { name: 'Notas fiscais' })
    fireEvent.click(within(notas).getByRole('button', { name: /Nova nota/ }))
    fireEvent.change(within(notas).getByLabelText('Valor'), { target: { value: '-1' } })
    fireEvent.click(within(notas).getByRole('button', { name: 'Salvar' }))
    expect(await within(notas).findByText('Valor: valor não pode ser negativo')).toBeInTheDocument()
  })

  it('exclui uma nota com confirmação inline', async () => {
    mockApi()
    await renderizar()
    const notas = await screen.findByRole('region', { name: 'Notas fiscais' })
    const linha = within(notas).getByText('37619').closest('tr')!
    fireEvent.click(within(linha).getByRole('button', { name: 'Excluir' }))
    fireEvent.click(within(linha).getByRole('button', { name: 'Sim' }))
    await waitFor(() => expect(within(notas).queryByText('37619')).not.toBeInTheDocument())
  })

  it('edita o cabeçalho do faturamento', async () => {
    mockApi()
    await renderizar()
    fireEvent.click(await screen.findByRole('button', { name: /Editar faturamento/ }))
    const form = screen.getByRole('form', { name: 'Editar faturamento' })
    // O select de contrato só aceita o valor atual depois que a lista de contratos carrega.
    await within(form).findByRole('option', { name: 'TC 142/2021' })
    fireEvent.change(within(form).getByLabelText('Unidade destino'), { target: { value: 'SMS/ATTI' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Salvar' }))
    expect(await screen.findByText('SMS/ATTI')).toBeInTheDocument()
  })
})

describe('FaturamentoDetalhePage somente leitura', () => {
  it('sem permissão de edição esconde editar, nova nota e ações da nota', async () => {
    mockApi()
    await act(async () => {
      render(
        <PermissaoContext.Provider value={{ carregando: false, podeEditar: false, gerencia: null }}>
          <Suspense fallback={null}>
            <FaturamentoDetalhePage params={Promise.resolve({ id: 'c1', faturamentoId: 'f1' })} />
          </Suspense>
        </PermissaoContext.Provider>,
      )
    })
    expect(await screen.findByRole('heading', { level: 1, name: 'Faturamento 05/2022' })).toBeInTheDocument()
    expect(screen.getByText('37619')).toBeInTheDocument()
    for (const nome of ['Editar faturamento', 'Nova nota', 'Editar', 'Excluir']) {
      expect(screen.queryByRole('button', { name: nome })).toBeNull()
    }
  })
})
