import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { PropostaFinal } from './proposta-final'
import { limparRevisao } from '@/lib/revisaoPortuguesEmAndamento'

class ClipboardItemFalso {
  constructor(public items: Record<string, Blob>) {}
}

const propsBase = {
  propostaId: 'p1',
  conteudoMarkdown: '# Proposta',
  onEditarNovamente: jest.fn(),
  onUsarCorrecoes: jest.fn().mockResolvedValue(undefined),
}

describe('PropostaFinal', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    limparRevisao('p1')
    ;(global as unknown as { ClipboardItem: typeof ClipboardItemFalso }).ClipboardItem = ClipboardItemFalso
    Object.assign(navigator, { clipboard: { write: jest.fn().mockResolvedValue(undefined) } })
  })

  it('mostra o preview renderizado do markdown na aba Visualizar', () => {
    render(<PropostaFinal {...propsBase} />)
    expect(screen.getByRole('heading', { name: 'Proposta' })).toBeInTheDocument()
  })

  it('copia o conteúdo formatado (HTML + texto simples) e mostra "Copiado!" temporariamente', async () => {
    jest.useFakeTimers()
    render(<PropostaFinal {...propsBase} />)

    fireEvent.click(screen.getByRole('button', { name: /Copiar formatado/ }))

    await waitFor(() => expect(navigator.clipboard.write).toHaveBeenCalled())
    const itemCopiado = (navigator.clipboard.write as jest.Mock).mock.calls[0][0][0] as ClipboardItemFalso
    expect(itemCopiado.items['text/html']).toBeInstanceOf(Blob)
    expect(itemCopiado.items['text/plain']).toBeInstanceOf(Blob)
    expect(await screen.findByRole('button', { name: /Copiado!/ })).toBeInTheDocument()

    act(() => {
      jest.advanceTimersByTime(2000)
    })
    expect(screen.getByRole('button', { name: /Copiar formatado/ })).toBeInTheDocument()
    jest.useRealTimers()
  })

  it('chama onEditarNovamente ao clicar em "Editar novamente"', () => {
    render(<PropostaFinal {...propsBase} />)
    fireEvent.click(screen.getByRole('button', { name: 'Editar novamente' }))
    expect(propsBase.onEditarNovamente).toHaveBeenCalled()
  })

  it('na aba "Correção da IA" mostra o botão "Revisar português"', () => {
    render(<PropostaFinal {...propsBase} />)
    fireEvent.click(screen.getByRole('button', { name: /Correção da IA/ }))
    expect(screen.getByRole('button', { name: /Revisar português/ })).toBeInTheDocument()
  })

  it('revisa e mostra o diff com botões de aceitar/recusar', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ original: 'A proposta e boa.', corrigido: 'A proposta é boa.' }),
    }) as jest.Mock

    render(<PropostaFinal {...propsBase} conteudoMarkdown="A proposta e boa." />)
    fireEvent.click(screen.getByRole('button', { name: /Correção da IA/ }))
    fireEvent.click(screen.getByRole('button', { name: /Revisar português/ }))

    expect(await screen.findByRole('button', { name: /Usar correções/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Manter original/ })).toBeInTheDocument()
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/propostas-comerciais/p1/revisao-portugues',
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('"Usar correções" chama onUsarCorrecoes com a versão corrigida', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ original: 'A proposta e boa.', corrigido: 'A proposta é boa.' }),
    }) as jest.Mock

    render(<PropostaFinal {...propsBase} conteudoMarkdown="A proposta e boa." />)
    fireEvent.click(screen.getByRole('button', { name: /Correção da IA/ }))
    fireEvent.click(screen.getByRole('button', { name: /Revisar português/ }))
    fireEvent.click(await screen.findByRole('button', { name: /Usar correções/ }))

    await waitFor(() => expect(propsBase.onUsarCorrecoes).toHaveBeenCalledWith('A proposta é boa.'))
  })

  it('"Manter original" volta ao estado inicial sem chamar onUsarCorrecoes', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ original: 'A proposta e boa.', corrigido: 'A proposta é boa.' }),
    }) as jest.Mock

    render(<PropostaFinal {...propsBase} conteudoMarkdown="A proposta e boa." />)
    fireEvent.click(screen.getByRole('button', { name: /Correção da IA/ }))
    fireEvent.click(screen.getByRole('button', { name: /Revisar português/ }))
    fireEvent.click(await screen.findByRole('button', { name: /Manter original/ }))

    expect(await screen.findByRole('button', { name: /Revisar português/ })).toBeInTheDocument()
    expect(propsBase.onUsarCorrecoes).not.toHaveBeenCalled()
  })

  it('mostra a mensagem do guardrail quando a resposta é 422', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 422,
      json: () => Promise.resolve({ error: 'a revisão alterou números do documento — não é seguro aplicar.' }),
    }) as jest.Mock

    render(<PropostaFinal {...propsBase} />)
    fireEvent.click(screen.getByRole('button', { name: /Correção da IA/ }))
    fireEvent.click(screen.getByRole('button', { name: /Revisar português/ }))

    expect(await screen.findByText(/alterou números do documento/)).toBeInTheDocument()
  })

  it('mostra "Nenhum erro de português encontrado" quando original e corrigido são iguais', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ original: '# Proposta', corrigido: '# Proposta' }),
    }) as jest.Mock

    render(<PropostaFinal {...propsBase} />)
    fireEvent.click(screen.getByRole('button', { name: /Correção da IA/ }))
    fireEvent.click(screen.getByRole('button', { name: /Revisar português/ }))

    expect(await screen.findByText(/Nenhum erro de português encontrado/)).toBeInTheDocument()
  })
})
