import { render, screen, waitFor } from '@testing-library/react'
import { PainelChecagemConversao } from './painel-checagem-conversao'
import { limparChecagemIa } from '@/lib/checagemIaEmAndamento'
import { limparOcr } from '@/lib/ocrEmAndamento'

function mockFetch(resposta: { ok: boolean; body: unknown }) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: resposta.ok,
    json: () => Promise.resolve(resposta.body),
  }) as jest.Mock
}

describe('PainelChecagemConversao', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    limparChecagemIa('p1')
    limparOcr('p1')
  })

  it('com :::ocr-pendente mostra o OcrRunner e NÃO inicia a checagem por IA', () => {
    mockFetch({ ok: true, body: { scoreExibido: 90, trechosSuspeitos: [] } })

    render(
      <PainelChecagemConversao
        propostaId="p1"
        conteudoMarkdown={'texto\n\n:::ocr-pendente[arquivoId=a1 pagina=1]\n_(aguardando OCR)_\n:::'}
        onConteudoAtualizado={jest.fn()}
      />
    )

    expect(screen.getByRole('button', { name: /Rodar OCR/ })).toBeInTheDocument()
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('sem marcador pendente, inicia a checagem sozinha e mostra "Verificando com IA..."', () => {
    mockFetch({ ok: true, body: { scoreExibido: 90, trechosSuspeitos: [] } })

    render(<PainelChecagemConversao propostaId="p1" conteudoMarkdown="texto normal" onConteudoAtualizado={jest.fn()} />)

    expect(screen.getByText(/Verificando com IA/)).toBeInTheDocument()
    expect(global.fetch).toHaveBeenCalledWith('/api/propostas-comerciais/p1/checagem-ia', { method: 'POST' })
  })

  it('mostra o score (nunca 100%) e a lista de trechos suspeitos quando pronto', async () => {
    mockFetch({
      ok: true,
      body: { scoreExibido: 87, trechosSuspeitos: [{ pagina: 2, trecho: 'Valor: R$ 100', motivo: 'número suspeito' }] },
    })

    render(<PainelChecagemConversao propostaId="p1" conteudoMarkdown="texto normal" onConteudoAtualizado={jest.fn()} />)

    expect(await screen.findByText(/87%/)).toBeInTheDocument()
    expect(screen.getByText(/número suspeito/)).toBeInTheDocument()
    expect(screen.getByText(/estimativa da IA/i)).toBeInTheDocument()
  })

  it('score null mostra a mensagem de "sem páginas de texto nativo"', async () => {
    mockFetch({ ok: true, body: { scoreExibido: null, trechosSuspeitos: [] } })

    render(<PainelChecagemConversao propostaId="p1" conteudoMarkdown="texto normal" onConteudoAtualizado={jest.fn()} />)

    expect(await screen.findByText(/Sem páginas de texto nativo/)).toBeInTheDocument()
  })

  it('erro na checagem mostra mensagem', async () => {
    mockFetch({ ok: false, body: { error: 'modelo indisponível' } })

    render(<PainelChecagemConversao propostaId="p1" conteudoMarkdown="texto normal" onConteudoAtualizado={jest.fn()} />)

    await waitFor(() => expect(screen.getByText(/modelo indisponível/)).toBeInTheDocument())
  })

  it('mostra aviso de página com imagem embutida quando paginasComImagem não é vazio', async () => {
    mockFetch({
      ok: true,
      body: { scoreExibido: 90, trechosSuspeitos: [], paginasComImagem: [3, 8] },
    })

    render(<PainelChecagemConversao propostaId="p1" conteudoMarkdown="texto normal" onConteudoAtualizado={jest.fn()} />)

    expect(await screen.findByText(/3, 8/)).toBeInTheDocument()
    expect(screen.getByText(/imagem embutida/i)).toBeInTheDocument()
  })

  it('sem paginasComImagem, não mostra o aviso', async () => {
    mockFetch({ ok: true, body: { scoreExibido: 90, trechosSuspeitos: [], paginasComImagem: [] } })

    render(<PainelChecagemConversao propostaId="p1" conteudoMarkdown="texto normal" onConteudoAtualizado={jest.fn()} />)

    await screen.findByText(/90%/)
    expect(screen.queryByText(/imagem embutida/i)).not.toBeInTheDocument()
  })
})
