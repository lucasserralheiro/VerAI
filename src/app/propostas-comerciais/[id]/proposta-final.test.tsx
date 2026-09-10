import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { PropostaFinal } from './proposta-final'
import { limparRevisao } from '@/lib/revisaoPortuguesEmAndamento'

class ClipboardItemFalso {
  constructor(public items: Record<string, Blob>) {}
}

const propsBase = {
  propostaId: 'p1',
  conteudoMarkdown: '# Proposta',
  arquivos: [],
  onSalvar: jest.fn().mockResolvedValue(undefined),
}

describe('PropostaFinal', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    limparRevisao('p1')
    ;(global as unknown as { ClipboardItem: typeof ClipboardItemFalso }).ClipboardItem = ClipboardItemFalso
    Object.assign(navigator, { clipboard: { write: jest.fn().mockResolvedValue(undefined) } })
  })

  it('mostra o conteúdo renderizado e editável na aba Visualizar', () => {
    render(<PropostaFinal {...propsBase} />)
    expect(screen.getByRole('heading', { name: 'Proposta' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Conteúdo da proposta' })).toBeInTheDocument()
  })

  it('não mostra "Salvar alterações" antes de qualquer edição', () => {
    render(<PropostaFinal {...propsBase} />)
    expect(screen.queryByRole('button', { name: /Salvar alterações/ })).not.toBeInTheDocument()
  })

  it('edição faz aparecer "Salvar alterações"; salvar chama onSalvar e o esconde de novo', async () => {
    render(<PropostaFinal {...propsBase} />)

    const editor = screen.getByRole('textbox', { name: 'Conteúdo da proposta' })
    editor.innerHTML = '<h1>Proposta editada</h1>'
    fireEvent.input(editor)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 450))
    })

    const botaoSalvar = await screen.findByRole('button', { name: /Salvar alterações/ })
    fireEvent.click(botaoSalvar)

    await waitFor(() => expect(propsBase.onSalvar).toHaveBeenCalledWith('# Proposta editada'))
    await waitFor(() => expect(screen.queryByRole('button', { name: /Salvar alterações/ })).not.toBeInTheDocument())
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

  it('não mostra mais o botão "Editar novamente"', () => {
    render(<PropostaFinal {...propsBase} />)
    expect(screen.queryByRole('button', { name: /Editar novamente/ })).not.toBeInTheDocument()
  })

  it('com arquivos originais, mostra o menu pra abrir', () => {
    render(<PropostaFinal {...propsBase} arquivos={[{ id: 'a1', nomeArquivo: 'proposta.pdf', tipo: 'pdf' }]} />)
    expect(screen.getByRole('button', { name: 'Arquivo original' })).toBeInTheDocument()
  })

  it('na aba "Correção da IA" mostra o botão "Revisar português"', () => {
    render(<PropostaFinal {...propsBase} />)
    fireEvent.click(screen.getByRole('button', { name: /Correção da IA/ }))
    expect(screen.getByRole('button', { name: /Revisar português/ })).toBeInTheDocument()
  })

  it('"Usar correções" atualiza o conteúdo e marca como sujo (precisa salvar)', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ original: 'A proposta e boa.', corrigido: 'A proposta é boa.' }),
    }) as jest.Mock

    render(<PropostaFinal {...propsBase} conteudoMarkdown="A proposta e boa." />)
    fireEvent.click(screen.getByRole('button', { name: /Correção da IA/ }))
    fireEvent.click(screen.getByRole('button', { name: /Revisar português/ }))
    fireEvent.click(await screen.findByRole('button', { name: /Usar correções/ }))

    expect(await screen.findByRole('button', { name: /Salvar alterações/ })).toBeInTheDocument()
    expect(propsBase.onSalvar).not.toHaveBeenCalled()
  })

  it('"Manter original" volta ao estado inicial sem marcar sujo', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ original: 'A proposta e boa.', corrigido: 'A proposta é boa.' }),
    }) as jest.Mock

    render(<PropostaFinal {...propsBase} conteudoMarkdown="A proposta e boa." />)
    fireEvent.click(screen.getByRole('button', { name: /Correção da IA/ }))
    fireEvent.click(screen.getByRole('button', { name: /Revisar português/ }))
    fireEvent.click(await screen.findByRole('button', { name: /Manter original/ }))

    expect(await screen.findByRole('button', { name: /Revisar português/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Salvar alterações/ })).not.toBeInTheDocument()
  })
})
