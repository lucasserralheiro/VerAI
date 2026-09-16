import { render, screen, fireEvent } from '@testing-library/react'
import { CardConferenciaTotais } from './card-conferencia-totais'
import { limparConferenciaTotais } from '@/lib/conferenciaTotaisEmAndamento'

function mockFetch(resposta: { ok: boolean; body: unknown }) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: resposta.ok,
    json: () => Promise.resolve(resposta.body),
  }) as jest.Mock
}

describe('CardConferenciaTotais', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    limparConferenciaTotais('p1')
  })

  it('dispara a conferência ao montar e mostra "Conferindo totais..."', () => {
    mockFetch({ ok: true, body: { totais: [] } })

    render(<CardConferenciaTotais propostaId="p1" />)

    expect(screen.getByText(/Conferindo totais/)).toBeInTheDocument()
    expect(global.fetch).toHaveBeenCalledWith('/api/propostas-comerciais/p1/conferir-totais', { method: 'POST' })
  })

  it('sem total detectado mostra mensagem neutra', async () => {
    mockFetch({ ok: true, body: { totais: [] } })

    render(<CardConferenciaTotais propostaId="p1" />)

    expect(await screen.findByText(/Nenhum total detectado automaticamente/)).toBeInTheDocument()
  })

  it('com todos os totais batendo mostra a contagem sem destaque de erro', async () => {
    mockFetch({
      ok: true,
      body: {
        totais: [
          { pagina: 3, rotulo: 'Total Geral', valorNoPdf: 'R$ 279.663,46', encontradoNoDocumento: true, ocorrenciasNoDocumento: 1 },
        ],
      },
    })

    render(<CardConferenciaTotais propostaId="p1" />)

    expect(await screen.findByText('1 total conferido')).toBeInTheDocument()
  })

  it('com divergência mostra quantos não batem e a janela detalha com "Ver no PDF"', async () => {
    mockFetch({
      ok: true,
      body: {
        totais: [
          { pagina: 3, rotulo: 'Total Geral', valorNoPdf: 'R$ 279.663,46', encontradoNoDocumento: false, ocorrenciasNoDocumento: 0 },
          { pagina: 4, rotulo: 'Subtotal', valorNoPdf: 'R$ 100,00', encontradoNoDocumento: true, ocorrenciasNoDocumento: 1 },
        ],
      },
    })
    const onVerPagina = jest.fn()

    render(<CardConferenciaTotais propostaId="p1" onVerPagina={onVerPagina} />)
    fireEvent.click(await screen.findByText('1 de 2 totais não batem'))

    expect(screen.getByText('Total Geral')).toBeInTheDocument()
    expect(screen.getByText('R$ 279.663,46')).toBeInTheDocument()
    expect(screen.getByText('Não achado')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Ver no PDF/ }))
    expect(onVerPagina).toHaveBeenCalledWith(3, 'R$ 279.663,46')
  })

  it('erro na resposta mostra a mensagem e "Tentar de novo"', async () => {
    mockFetch({ ok: false, body: { error: 'falhou' } })

    render(<CardConferenciaTotais propostaId="p1" />)

    expect(await screen.findByText('falhou')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Tentar de novo/ })).toBeInTheDocument()
  })
})
