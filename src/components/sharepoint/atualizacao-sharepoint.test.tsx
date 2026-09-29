import { render, screen, waitFor } from '@testing-library/react'
import { AtualizacaoSharepoint } from './atualizacao-sharepoint'

function responder(ok: boolean, corpo: unknown) {
  global.fetch = jest.fn(() => Promise.resolve({ ok, json: () => Promise.resolve(corpo) })) as unknown as jest.Mock
}

const haMinutos = (n: number) => new Date(Date.now() - n * 60 * 1000).toISOString()

describe('AtualizacaoSharepoint', () => {
  it('mostra a data da última atualização em cinza', async () => {
    responder(true, { atualizadoEm: haMinutos(10) })
    render(<AtualizacaoSharepoint />)
    const linha = await screen.findByText(/^Documentos do SharePoint atualizados em \d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/)
    expect(linha).toHaveClass('text-mid-grey')
    expect(linha).toHaveAttribute('title', expect.stringContaining('a cada 30 minutos'))
    expect(global.fetch).toHaveBeenCalledWith('/api/sharepoint/atualizacao')
  })

  it('atrasada fica laranja', async () => {
    responder(true, { atualizadoEm: haMinutos(3 * 60) })
    render(<AtualizacaoSharepoint />)
    expect(await screen.findByText(/— atualização atrasada$/)).toHaveClass('text-orange-dark')
  })

  it('nunca sincronizado avisa', async () => {
    responder(true, { atualizadoEm: null })
    render(<AtualizacaoSharepoint />)
    expect(await screen.findByText('Ainda não sincronizado com o SharePoint')).toHaveClass('text-orange-dark')
  })

  it('busca na URL recebida — as telas da biblioteca Documentos usam a delas', async () => {
    responder(true, { atualizadoEm: null })
    render(<AtualizacaoSharepoint url="/api/biblioteca/atualizacao" />)
    expect(global.fetch).toHaveBeenCalledWith('/api/biblioteca/atualizacao')
    expect(await screen.findByText('Ainda não sincronizado com o SharePoint')).toBeInTheDocument()
  })

  it('API com erro (ex.: produção antes da migração): não mostra nada', async () => {
    responder(false, { error: 'falhou' })
    const { container } = render(<AtualizacaoSharepoint />)
    await waitFor(() => expect(global.fetch).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
  })
})
