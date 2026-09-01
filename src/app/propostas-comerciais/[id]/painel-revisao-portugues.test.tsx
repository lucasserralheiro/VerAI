import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { PainelRevisaoPortugues } from './painel-revisao-portugues'

function mockFetch(resposta: { ok: boolean; body: unknown }) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: resposta.ok,
    json: () => Promise.resolve(resposta.body),
  }) as jest.Mock
}

const props = {
  propostaId: 'p1',
  markdownAtual: 'A proposta e boa.',
  onUsarCorrecoes: jest.fn().mockResolvedValue(undefined),
}

describe('PainelRevisaoPortugues', () => {
  beforeEach(() => {
    jest.clearAllMocks()
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

    expect(await screen.findByText(/Não foi possível revisar o texto/)).toBeInTheDocument()
  })
})
