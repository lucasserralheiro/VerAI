import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { PainelRevisaoPortugues } from './painel-revisao-portugues'
import { limparRevisao } from '@/lib/revisaoPortuguesEmAndamento'

function mockFetch(resposta: { ok: boolean; body: unknown }) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: resposta.ok,
    json: () => Promise.resolve(resposta.body),
  }) as jest.Mock
}

/** fetch que só resolve quando a gente mandar — pra testar o estado "rodando". */
function mockFetchPendente() {
  let resolver!: (v: unknown) => void
  const pendente = new Promise((r) => {
    resolver = r
  })
  global.fetch = jest.fn().mockReturnValue(pendente) as jest.Mock
  return (body: unknown) => resolver({ ok: true, json: () => Promise.resolve(body) })
}

const props = {
  propostaId: 'p1',
  markdownAtual: 'A proposta e boa.',
  onUsarCorrecoes: jest.fn().mockResolvedValue(undefined),
}

describe('PainelRevisaoPortugues', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    limparRevisao('p1')
  })

  it('começa com o botão "Revisar português" e a explicação do que a IA faz', () => {
    render(<PainelRevisaoPortugues {...props} />)
    expect(screen.getByRole('button', { name: /Revisar português/ })).toBeInTheDocument()
    expect(screen.getByText(/apenas ortografia e acentuação/)).toBeInTheDocument()
  })

  it('manda o markdown atual no corpo da requisição', async () => {
    mockFetch({ ok: true, body: { original: 'A proposta e boa.', corrigido: 'A proposta é boa.' } })
    render(<PainelRevisaoPortugues {...props} />)

    fireEvent.click(screen.getByRole('button', { name: /Revisar português/ }))

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/propostas-comerciais/p1/revisao-portugues',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ conteudoMarkdown: 'A proposta e boa.' }),
        })
      )
    )
  })

  it('mostra o diff e, ao aceitar, chama onUsarCorrecoes com a versão corrigida', async () => {
    mockFetch({ ok: true, body: { original: 'A proposta e boa.', corrigido: 'A proposta é boa.' } })
    render(<PainelRevisaoPortugues {...props} />)

    fireEvent.click(screen.getByRole('button', { name: /Revisar português/ }))
    fireEvent.click(await screen.findByRole('button', { name: /Usar correções/ }))

    await waitFor(() => expect(props.onUsarCorrecoes).toHaveBeenCalledWith('A proposta é boa.'))
  })

  it('"Manter original" volta ao estado inicial sem chamar onUsarCorrecoes', async () => {
    mockFetch({ ok: true, body: { original: 'A proposta e boa.', corrigido: 'A proposta é boa.' } })
    render(<PainelRevisaoPortugues {...props} />)

    fireEvent.click(screen.getByRole('button', { name: /Revisar português/ }))
    fireEvent.click(await screen.findByRole('button', { name: /Manter original/ }))

    expect(await screen.findByRole('button', { name: /Revisar português/ })).toBeInTheDocument()
    expect(props.onUsarCorrecoes).not.toHaveBeenCalled()
  })

  it('mostra a mensagem do guardrail quando a resposta é 422', async () => {
    mockFetch({ ok: false, body: { error: 'a revisão alterou números do documento — não é seguro aplicar.' } })
    render(<PainelRevisaoPortugues {...props} />)

    fireEvent.click(screen.getByRole('button', { name: /Revisar português/ }))

    expect(await screen.findByText(/alterou números do documento/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Usar correções/ })).not.toBeInTheDocument()
  })

  it('quando não há mudanças, informa que nenhum erro foi encontrado', async () => {
    mockFetch({ ok: true, body: { original: 'A proposta e boa.', corrigido: 'A proposta e boa.' } })
    render(<PainelRevisaoPortugues {...props} />)

    fireEvent.click(screen.getByRole('button', { name: /Revisar português/ }))

    expect(await screen.findByText(/Nenhum erro de português encontrado/)).toBeInTheDocument()
  })

  it('mostra erro genérico quando a requisição falha', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('rede caiu')) as jest.Mock
    render(<PainelRevisaoPortugues {...props} />)

    fireEvent.click(screen.getByRole('button', { name: /Revisar português/ }))

    expect(await screen.findByText(/rede caiu|Não foi possível revisar o texto/)).toBeInTheDocument()
  })

  it('não cancela ao desmontar: ao voltar, a revisão continua e o resultado aparece', async () => {
    const concluir = mockFetchPendente()
    const { unmount } = render(<PainelRevisaoPortugues {...props} />)

    fireEvent.click(screen.getByRole('button', { name: /Revisar português/ }))
    expect(await screen.findByText(/Revisando/)).toBeInTheDocument()

    // usuário troca de aba — painel desmonta enquanto a chamada roda
    unmount()

    // e a resposta chega com o painel desmontado
    concluir({ original: 'A proposta e boa.', corrigido: 'A proposta é boa.' })

    // volta pra aba: remonta e recupera o resultado, sem nova chamada
    render(<PainelRevisaoPortugues {...props} />)
    expect(await screen.findByRole('button', { name: /Usar correções/ })).toBeInTheDocument()
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it('clicar em "Revisar" enquanto já roda não dispara segunda chamada', async () => {
    mockFetchPendente()
    render(<PainelRevisaoPortugues {...props} />)

    fireEvent.click(screen.getByRole('button', { name: /Revisar português/ }))
    await screen.findByText(/Revisando/)

    // remonta e a nova instância não deve refazer a chamada
    render(<PainelRevisaoPortugues {...props} />)
    await waitFor(() => expect(screen.getAllByText(/Revisando/).length).toBeGreaterThan(0))

    expect(global.fetch).toHaveBeenCalledTimes(1)
  })
})
