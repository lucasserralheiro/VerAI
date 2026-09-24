import { Suspense } from 'react'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import ContratoDetalhePage from './page'

const HISTORICO = [
  { id: 'h1', contratoId: 'k1', tipo: 'CONTRATO', numero: 'TC 203/2023', data: '2023-12-28T00:00:00.000Z', valor: '1000000', objeto: null, proposta: null, situacao: 'Assinada', dataInicio: null, dataVencimento: null, dataEnvio: null, observacao: null },
  { id: 'h2', contratoId: 'k1', tipo: 'ADITIVO', numero: '1º TA', data: '2024-06-01T00:00:00.000Z', valor: '250000', objeto: 'Acréscimo de pontos', proposta: null, situacao: null, dataInicio: null, dataVencimento: null, dataEnvio: null, observacao: null, propostaPdfUrl: 'https://blob.example/h2-proposta.pdf', propostaPdfNome: 'PA-01.pdf', termoPdfUrl: null, termoPdfNome: null },
]

const ITEM = { id: 'i1', contratoId: 'k1', contratoTextoLegado: null, descricao: 'Ponto de acesso Wi-fi', quantidade: '10', valorUnitario: '100', valorTotal: '1000' }

function contrato(parcial: Record<string, unknown> = {}) {
  return {
    id: 'k1',
    clienteId: 'c1',
    numeroTermo: 'TC 203/2023',
    descricao: 'Soluções de gerenciamento de Wi-fi',
    seiCliente: '6018.2023/0106013-8',
    seiProdam: '7010.2023/0010021-6',
    situacao: 'Ativo',
    dataInicio: '2023-12-28T00:00:00.000Z',
    dataVencimento: '2032-12-27T00:00:00.000Z',
    vigente: true,
    linkSei: null,
    saldo: { valorItens: '1000', faturado: '250', saldo: '750', percentualFaturado: '25.00' },
    vencimento: { nivel: 'ok', dias: 2287 },
    historico: HISTORICO,
    itens: [ITEM],
    ...parcial,
  }
}

function resposta(ok: boolean, corpo: unknown) {
  return Promise.resolve({ ok, json: () => Promise.resolve(corpo) }) as unknown as Promise<Response>
}

function mockApi(options: { semItens?: boolean; erroHistorico?: string } = {}) {
  let historico: Array<Record<string, unknown>> = [...HISTORICO]
  let itens: Array<Record<string, unknown>> = options.semItens ? [] : [ITEM]
  const soltos = [{ id: 'i7', contratoId: null, contratoTextoLegado: '031/SEME/2017', descricao: 'Licença', quantidade: null, valorUnitario: null, valorTotal: '500' }]
  global.fetch = jest.fn((url: RequestInfo | URL, init?: RequestInit) => {
    const u = String(url)
    const metodo = init?.method ?? 'GET'
    const corpo = init?.body ? JSON.parse(String(init.body)) : null
    if (u === '/api/contratos/k1' && metodo === 'GET') {
      const semSaldo = itens.length === 0
      return resposta(
        true,
        contrato({
          historico,
          itens,
          saldo: semSaldo
            ? { valorItens: '0', faturado: '250', saldo: null, percentualFaturado: null }
            : { valorItens: '1000', faturado: '250', saldo: '750', percentualFaturado: '25.00' },
        })
      )
    }
    if (u === '/api/contratos/k1' && metodo === 'PATCH') return resposta(true, contrato(corpo))
    if (u === '/api/contratos/k1/historico' && metodo === 'POST') {
      if (options.erroHistorico) return resposta(false, { error: options.erroHistorico })
      const nova = { ...HISTORICO[0], id: 'h3', valor: null, ...corpo }
      historico = [...historico, nova]
      return resposta(true, nova)
    }
    if (u === '/api/historico-contrato/h1/pdf/proposta' && metodo === 'POST') {
      historico = historico.map((h) => (h.id === 'h1' ? { ...h, propostaPdfUrl: 'https://blob.example/h1-proposta.pdf', propostaPdfNome: 'PC-01.pdf' } : h))
      return resposta(true, { propostaPdfUrl: 'https://blob.example/h1-proposta.pdf', propostaPdfNome: 'PC-01.pdf' })
    }
    if (u === '/api/historico-contrato/h2/pdf/proposta' && metodo === 'DELETE') {
      historico = historico.map((h) => (h.id === 'h2' ? { ...h, propostaPdfUrl: null, propostaPdfNome: null } : h))
      return resposta(true, { propostaPdfUrl: null, propostaPdfNome: null })
    }
    if (u === '/api/historico-contrato/h2' && metodo === 'DELETE') {
      historico = historico.filter((h) => h.id !== 'h2')
      return resposta(true, { ok: true })
    }
    if (u === '/api/contratos/k1/itens' && metodo === 'POST') {
      const novo = { ...ITEM, id: 'i2', ...corpo, valorTotal: corpo.valorTotal || '0' }
      itens = [...itens, novo]
      return resposta(true, novo)
    }
    if (u.startsWith('/api/itens-contrato?semContrato=1')) return resposta(true, soltos)
    if (u === '/api/itens-contrato/i7' && metodo === 'PATCH') {
      itens = [...itens, { ...soltos[0], contratoId: 'k1' }]
      return resposta(true, { ...soltos[0], contratoId: 'k1' })
    }
    return resposta(false, { error: `rota inesperada ${metodo} ${u}` })
  }) as jest.Mock
}

async function renderizar() {
  await act(async () => {
    render(
      <Suspense fallback={null}>
        <ContratoDetalhePage params={Promise.resolve({ id: 'c1', contratoId: 'k1' })} />
      </Suspense>
    )
  })
}

describe('ContratoDetalhePage', () => {
  it('mostra cabeçalho, saldo, histórico e itens', async () => {
    mockApi()
    await renderizar()
    expect(await screen.findByRole('heading', { level: 1, name: 'TC 203/2023' })).toBeInTheDocument()
    expect(screen.getByText('Soluções de gerenciamento de Wi-fi')).toBeInTheDocument()

    const saldo = screen.getByRole('region', { name: 'Saldo do contrato' })
    expect(within(saldo).getByText('R$ 750,00')).toBeInTheDocument()
    expect(within(saldo).getByText('25% faturado')).toBeInTheDocument()

    const historico = screen.getByRole('region', { name: 'Histórico do contrato' })
    expect(within(historico).getByText('Aditivo')).toBeInTheDocument()
    expect(within(historico).getByText('1º TA')).toBeInTheDocument()
    expect(within(historico).getByText('Acréscimo de pontos')).toBeInTheDocument()

    expect(screen.getByText('Ponto de acesso Wi-fi')).toBeInTheDocument()
  })

  it('avisa que o saldo não é calculável quando não há itens vinculados', async () => {
    mockApi({ semItens: true })
    await renderizar()
    expect(
      await screen.findByText(
        'Sem itens vinculados — saldo não calculável. Vincule os itens importados ou cadastre os itens do contrato.'
      )
    ).toBeInTheDocument()
  })

  it('histórico em grade: botão "Ver" onde há PDF anexado e clipe pra anexar onde falta', async () => {
    mockApi()
    await renderizar()
    const historico = await screen.findByRole('region', { name: 'Histórico do contrato' })

    expect(within(historico).getAllByRole('button', { name: 'Ver PDF PC/PA' })).toHaveLength(1)
    // h1 não tem proposta; h1 e h2 não têm termo.
    expect(within(historico).getAllByLabelText('Anexar PDF PC/PA')).toHaveLength(1)
    expect(within(historico).getAllByLabelText('Anexar PDF TC/TA')).toHaveLength(2)
  })

  it('"Ver" abre o visualizador com o PDF e as ações abrir, baixar, substituir e remover', async () => {
    mockApi()
    await renderizar()
    const historico = await screen.findByRole('region', { name: 'Histórico do contrato' })

    fireEvent.click(within(historico).getByRole('button', { name: 'Ver PDF PC/PA' }))

    const visualizador = await within(historico).findByTitle('Visualização do PDF PC/PA')
    expect(visualizador).toHaveAttribute('src', 'https://blob.example/h2-proposta.pdf')
    expect(within(historico).getByRole('link', { name: /Abrir em nova aba/ })).toHaveAttribute(
      'href',
      'https://blob.example/h2-proposta.pdf'
    )
    expect(within(historico).getByRole('link', { name: /Baixar/ })).toHaveAttribute(
      'href',
      'https://blob.example/h2-proposta.pdf?download=1'
    )
    expect(within(historico).getByText(/PA-01\.pdf/)).toBeInTheDocument()
    expect(within(historico).getByRole('button', { name: /Remover PDF/ })).toBeInTheDocument()
  })

  it('anexa o PDF da proposta direto da grade', async () => {
    mockApi()
    await renderizar()
    const historico = await screen.findByRole('region', { name: 'Histórico do contrato' })

    const arquivo = new File(['%PDF-1.4'], 'PC-01.pdf', { type: 'application/pdf' })
    fireEvent.change(within(historico).getByLabelText('Anexar PDF PC/PA'), { target: { files: [arquivo] } })

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/historico-contrato/h1/pdf/proposta',
        expect.objectContaining({ method: 'POST' })
      )
    )
    await waitFor(() => expect(within(historico).getAllByRole('button', { name: 'Ver PDF PC/PA' })).toHaveLength(2))
  })

  it('remove o PDF pelo visualizador, depois de confirmar', async () => {
    mockApi()
    await renderizar()
    const historico = await screen.findByRole('region', { name: 'Histórico do contrato' })

    fireEvent.click(within(historico).getByRole('button', { name: 'Ver PDF PC/PA' }))
    fireEvent.click(await within(historico).findByRole('button', { name: /Remover PDF/ }))
    fireEvent.click(within(historico).getByRole('button', { name: 'Sim' }))

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/historico-contrato/h2/pdf/proposta',
        expect.objectContaining({ method: 'DELETE' })
      )
    )
    await waitFor(() => expect(within(historico).queryByRole('button', { name: 'Ver PDF PC/PA' })).not.toBeInTheDocument())
  })

  it('adiciona uma linha ao histórico', async () => {
    mockApi()
    await renderizar()
    const historico = await screen.findByRole('region', { name: 'Histórico do contrato' })
    fireEvent.click(within(historico).getByRole('button', { name: /Nova linha/ }))
    fireEvent.change(within(historico).getByLabelText('Tipo'), { target: { value: 'PRORROGACAO' } })
    fireEvent.change(within(historico).getByLabelText('Nº'), { target: { value: '2º TA' } })
    fireEvent.click(within(historico).getByRole('button', { name: 'Salvar' }))
    expect(await within(historico).findByText('2º TA')).toBeInTheDocument()
    const post = (global.fetch as jest.Mock).mock.calls.find(([u]) => u === '/api/contratos/k1/historico')!
    expect(JSON.parse(post[1].body)).toEqual(expect.objectContaining({ tipo: 'PRORROGACAO', numero: '2º TA' }))
  })

  it('mostra o erro da API ao salvar histórico', async () => {
    mockApi({ erroHistorico: 'Tipo: tipo inválido' })
    await renderizar()
    const historico = await screen.findByRole('region', { name: 'Histórico do contrato' })
    fireEvent.click(within(historico).getByRole('button', { name: /Nova linha/ }))
    fireEvent.click(within(historico).getByRole('button', { name: 'Salvar' }))
    expect(await within(historico).findByText('Tipo: tipo inválido')).toBeInTheDocument()
  })

  it('exclui uma linha do histórico com confirmação inline', async () => {
    mockApi()
    await renderizar()
    const historico = await screen.findByRole('region', { name: 'Histórico do contrato' })
    const linha = within(historico).getByText('1º TA').closest('li')!
    fireEvent.click(within(linha).getByRole('button', { name: 'Excluir' }))
    fireEvent.click(within(linha).getByRole('button', { name: 'Sim' }))
    await waitFor(() => expect(within(historico).queryByText('1º TA')).not.toBeInTheDocument())
  })

  it('cadastra um item', async () => {
    mockApi()
    await renderizar()
    const itens = await screen.findByRole('region', { name: 'Itens do contrato' })
    fireEvent.click(within(itens).getByRole('button', { name: /Novo item/ }))
    fireEvent.change(within(itens).getByLabelText('Descrição'), { target: { value: 'Switch' } })
    fireEvent.change(within(itens).getByLabelText('Valor total'), { target: { value: '300' } })
    fireEvent.click(within(itens).getByRole('button', { name: 'Salvar' }))
    expect(await within(itens).findByText('Switch')).toBeInTheDocument()
  })

  it('vincula um item importado sem contrato', async () => {
    mockApi()
    await renderizar()
    const itens = await screen.findByRole('region', { name: 'Itens do contrato' })
    fireEvent.click(within(itens).getByRole('button', { name: /Vincular itens importados/ }))
    fireEvent.change(within(itens).getByLabelText('Buscar item importado'), { target: { value: 'SEME' } })
    fireEvent.submit(within(itens).getByRole('search'))
    const linhaSolta = (await within(itens).findByText('031/SEME/2017')).closest('tr')!
    fireEvent.click(within(linhaSolta).getByRole('button', { name: 'Vincular' }))
    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/itens-contrato/i7',
        expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ contratoId: 'k1' }) })
      )
    )
    expect(global.fetch).toHaveBeenCalledWith('/api/itens-contrato?semContrato=1&q=SEME')
  })

  it('edita o cabeçalho do contrato', async () => {
    mockApi()
    await renderizar()
    fireEvent.click(await screen.findByRole('button', { name: /Editar contrato/ }))
    fireEvent.change(screen.getByLabelText('Situação'), { target: { value: 'Encerrado' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    expect(await screen.findByText('Encerrado')).toBeInTheDocument()
  })
})
