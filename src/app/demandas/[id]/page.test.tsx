import { Suspense } from 'react'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import DemandaDetalhePage from './page'

const TRAMITE = {
  id: 't1',
  demandaId: 'd1',
  data: '2022-06-14T03:00:00.000Z',
  posicao: 'Alteração de velocidade link HSPM de 34 p/ 100mb',
  acao: 'solicitação foi incluída no portal da VIVO',
  observacao: null,
  responsavelAtual: 'DIT',
  dataRetorno: '2022-06-15T03:00:00.000Z',
  comApresentacao: false,
  assinado: false,
}

function demanda(tramites: unknown[] = [TRAMITE], parcial: Record<string, unknown> = {}) {
  return {
    id: 'd1',
    clienteId: 'c1',
    assunto: 'Liberação VPN SMTUR',
    tipoAssunto: 'Outros',
    tipo: 'E-mail',
    responsavel: 'Vera',
    situacao: 'Em andamento',
    dataAbertura: '2022-05-21T03:00:00.000Z',
    documento: null,
    sei: null,
    notaImportacao: 'cliente atribuído no import (SMS): cliente vazio no GRC-1',
    cliente: { id: 'c1', nome: 'Secretaria da Saúde', siglaLegado: 'SMS' },
    tramites,
    sugestoes: { responsavelAtual: ['SMS', 'DIT'], acao: ['e-mail enviado'] },
    ...parcial,
  }
}

function resposta(ok: boolean, corpo: unknown) {
  return Promise.resolve({ ok, json: () => Promise.resolve(corpo) }) as unknown as Promise<Response>
}

function mockApi(options: { erroTramite?: string } = {}) {
  let tramites: Array<Record<string, unknown>> = [TRAMITE]
  let atual = demanda()
  global.fetch = jest.fn((url: RequestInfo | URL, init?: RequestInit) => {
    const u = String(url)
    const metodo = init?.method ?? 'GET'
    const corpo = init?.body ? JSON.parse(String(init.body)) : null
    if (u === '/api/demandas/d1' && metodo === 'GET') return resposta(true, { ...atual, tramites })
    if (u === '/api/demandas/d1' && metodo === 'PATCH') {
      const trocou = corpo.clienteId && corpo.clienteId !== atual.clienteId
      atual = {
        ...atual,
        ...corpo,
        notaImportacao: trocou ? null : atual.notaImportacao,
        cliente: trocou ? { id: 'c2', nome: 'Secretaria de Turismo', siglaLegado: 'SMTUR' } : atual.cliente,
      }
      return resposta(true, atual)
    }
    if (u === '/api/clientes') {
      return resposta(true, [
        { id: 'c1', nome: 'Secretaria da Saúde', siglaLegado: 'SMS' },
        { id: 'c2', nome: 'Secretaria de Turismo', siglaLegado: 'SMTUR' },
      ])
    }
    if (u === '/api/demandas') return resposta(true, { demandas: [], sugestoes: { situacao: [], tipo: [], tipoAssunto: [], responsavel: [] } })
    if (u === '/api/demandas/d1/tramites' && metodo === 'POST') {
      if (options.erroTramite) return resposta(false, { error: options.erroTramite })
      const novo = { ...TRAMITE, id: 't2', ...corpo }
      tramites = [...tramites, novo]
      return resposta(true, novo)
    }
    if (u === '/api/tramites-demanda/t1' && metodo === 'DELETE') {
      tramites = tramites.filter((t) => t.id !== 't1')
      return resposta(true, { ok: true })
    }
    return resposta(false, { error: `rota inesperada ${metodo} ${u}` })
  }) as jest.Mock
}

async function renderizar() {
  await act(async () => {
    render(
      <Suspense fallback={null}>
        <DemandaDetalhePage params={Promise.resolve({ id: 'd1' })} />
      </Suspense>
    )
  })
}

describe('DemandaDetalhePage', () => {
  it('mostra cabeçalho, aviso de cliente atribuído no import e trâmites', async () => {
    mockApi()
    await renderizar()
    expect(await screen.findByRole('heading', { level: 1, name: 'Liberação VPN SMTUR' })).toBeInTheDocument()
    expect(screen.getByText(/cliente atribuído no import \(SMS\): cliente vazio no GRC-1/)).toBeInTheDocument()
    const tramites = screen.getByRole('region', { name: 'Trâmite' })
    expect(within(tramites).getByText('Alteração de velocidade link HSPM de 34 p/ 100mb')).toBeInTheDocument()
    expect(within(tramites).getByText('solicitação foi incluída no portal da VIVO')).toBeInTheDocument()
    expect(within(tramites).getByText(/DIT/)).toBeInTheDocument()
  })

  it('corrige o cliente pelo "Editar demanda" e o aviso some', async () => {
    mockApi()
    await renderizar()
    fireEvent.click(await screen.findByRole('button', { name: /Editar demanda/ }))
    const form = screen.getByRole('form', { name: 'Editar demanda' })
    await within(form).findByRole('option', { name: 'SMTUR — Secretaria de Turismo' })
    fireEvent.change(within(form).getByLabelText('Cliente'), { target: { value: 'c2' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Salvar' }))
    await waitFor(() => expect(screen.queryByText(/cliente atribuído no import/)).not.toBeInTheDocument())
    expect(screen.getByText('SMTUR — Secretaria de Turismo')).toBeInTheDocument()
  })

  it('adiciona um trâmite', async () => {
    mockApi()
    await renderizar()
    const tramites = await screen.findByRole('region', { name: 'Trâmite' })
    fireEvent.click(within(tramites).getByRole('button', { name: /Novo trâmite/ }))
    fireEvent.change(within(tramites).getByLabelText('Desde'), { target: { value: '2026-09-22' } })
    fireEvent.change(within(tramites).getByLabelText('Posição'), { target: { value: 'Aguardando assinatura do TA' } })
    fireEvent.click(within(tramites).getByRole('button', { name: 'Salvar' }))
    expect(await within(tramites).findByText('Aguardando assinatura do TA')).toBeInTheDocument()
    const post = (global.fetch as jest.Mock).mock.calls.find(([u]) => u === '/api/demandas/d1/tramites')!
    expect(JSON.parse(post[1].body)).toEqual(expect.objectContaining({ data: '2026-09-22', posicao: 'Aguardando assinatura do TA' }))
  })

  it('mostra o erro da API ao salvar trâmite', async () => {
    mockApi({ erroTramite: 'Desde: data inválida (use AAAA-MM-DD)' })
    await renderizar()
    const tramites = await screen.findByRole('region', { name: 'Trâmite' })
    fireEvent.click(within(tramites).getByRole('button', { name: /Novo trâmite/ }))
    fireEvent.change(within(tramites).getByLabelText('Desde'), { target: { value: '2026-09-22' } })
    fireEvent.click(within(tramites).getByRole('button', { name: 'Salvar' }))
    expect(await within(tramites).findByText('Desde: data inválida (use AAAA-MM-DD)')).toBeInTheDocument()
  })

  it('exclui um trâmite com confirmação inline', async () => {
    mockApi()
    await renderizar()
    const tramites = await screen.findByRole('region', { name: 'Trâmite' })
    const item = within(tramites).getByText('Alteração de velocidade link HSPM de 34 p/ 100mb').closest('li')!
    fireEvent.click(within(item).getByRole('button', { name: 'Excluir' }))
    fireEvent.click(within(item).getByRole('button', { name: 'Sim' }))
    await waitFor(() =>
      expect(within(tramites).queryByText('Alteração de velocidade link HSPM de 34 p/ 100mb')).not.toBeInTheDocument()
    )
  })
})
