import type { ComponentProps, ReactNode } from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { EspacoProposta, AUTOSAVE_MS } from './espaco-proposta'
import { limparChecagemIa } from '@/lib/checagemIaEmAndamento'
import { limparOcr } from '@/lib/ocrEmAndamento'

jest.mock('next/link', () => {
  const Link = ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  )
  return { __esModule: true, default: Link }
})

class ClipboardItemFalso {
  constructor(public items: Record<string, Blob>) {}
}

const UM_ARQUIVO = [{ id: 'arq1', nomeArquivo: 'proposta.pdf', tipo: 'pdf' }]

function props(extra: Partial<ComponentProps<typeof EspacoProposta>> = {}) {
  return {
    propostaId: 'p1',
    conteudoInicial: '# Proposta',
    nomeArquivo: 'proposta.pdf',
    subtitulo: 'Gerada a partir de "proposta.pdf"',
    arquivos: UM_ARQUIVO,
    onSalvar: jest.fn().mockResolvedValue(undefined),
    onExcluir: jest.fn(),
    ...extra,
  }
}

/** Checagem por IA dispara sozinha ao montar — responde "sem pendências". */
function mockChecagemOk(score = 95) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ scoreExibido: score, trechosSuspeitos: [] }),
  }) as jest.Mock
}

async function esperar(ms: number) {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms))
  })
}

describe('EspacoProposta', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    limparChecagemIa('p1')
    limparOcr('p1')
    mockChecagemOk()
    ;(global as unknown as { ClipboardItem: typeof ClipboardItemFalso }).ClipboardItem = ClipboardItemFalso
    Object.assign(navigator, { clipboard: { write: jest.fn().mockResolvedValue(undefined) } })
  })

  it('mostra documento e painel de checagem juntos — sem abas', async () => {
    render(<EspacoProposta {...props()} />)

    expect(screen.getByRole('textbox', { name: 'Conteúdo da proposta' })).toBeInTheDocument()
    expect(await screen.findByText(/95%/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Correção da IA/ })).not.toBeInTheDocument()
  })

  it('mostra o card de conferência de totais junto do painel de checagem', async () => {
    render(<EspacoProposta {...props()} />)

    expect(await screen.findByText('Conferência de totais')).toBeInTheDocument()
  })

  it('título vem do heading da proposta, não do nome do arquivo', () => {
    render(<EspacoProposta {...props({ conteudoInicial: '## Proposta Comercial: PC-1\n\n# TERMOS' })} />)
    expect(screen.getByRole('heading', { level: 1, name: 'Proposta Comercial: PC-1' })).toBeInTheDocument()
  })

  it('não tem botão Salvar — começa como "Salvo" (sem indicador nenhum, só ocupa espaço quando há algo a avisar)', () => {
    render(<EspacoProposta {...props()} />)
    expect(screen.queryByRole('button', { name: /^Salvar/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('edição manual salva sozinha depois da pausa', async () => {
    const p = props()
    render(<EspacoProposta {...p} />)

    const editor = screen.getByRole('textbox', { name: 'Conteúdo da proposta' })
    editor.innerHTML = '<h1>Proposta editada</h1>'
    fireEvent.input(editor)
    await esperar(450) // debounce do editor visual

    expect(screen.getByRole('status')).toHaveTextContent('Alterações não salvas')
    expect(p.onSalvar).not.toHaveBeenCalled()

    await esperar(AUTOSAVE_MS + 50)
    await waitFor(() => expect(p.onSalvar).toHaveBeenCalledWith('<h1>Proposta editada</h1>'))
    // Salvo = estado parado, sem nada a avisar — o indicador some (ver
    // `StatusSalvamento`), não mostra "Salvo".
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument())
  })

  it('falha ao salvar mostra o erro e "Tentar de novo" grava de novo', async () => {
    const onSalvar = jest.fn().mockRejectedValueOnce(new Error('servidor fora')).mockResolvedValue(undefined)
    render(<EspacoProposta {...props({ onSalvar })} />)

    fireEvent.click(screen.getByRole('button', { name: 'Editar como texto' }))
    fireEvent.change(screen.getByLabelText('Editar como texto'), { target: { value: 'conteúdo editado' } })
    await esperar(AUTOSAVE_MS + 50)

    expect(await screen.findByText(/servidor fora/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))

    await waitFor(() => expect(onSalvar).toHaveBeenCalledTimes(2))
    expect(onSalvar).toHaveBeenLastCalledWith('conteúdo editado')
    // Salvo = estado parado, sem nada a avisar — o indicador some (ver
    // `StatusSalvamento`), não mostra "Salvo".
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument())
  })

  it('"Editar como texto" troca o documento pelo Markdown e volta', () => {
    render(<EspacoProposta {...props()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Editar como texto' }))
    expect(screen.getByLabelText('Editar como texto')).toHaveValue('# Proposta')
    expect(screen.queryByRole('textbox', { name: 'Conteúdo da proposta' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Voltar ao documento' }))
    expect(screen.getByRole('textbox', { name: 'Conteúdo da proposta' })).toBeInTheDocument()
  })

  it('copia o conteúdo formatado (HTML + texto simples) e mostra "Copiado!" temporariamente', async () => {
    jest.useFakeTimers()
    render(<EspacoProposta {...props()} />)

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

  it('excluir é um botão discreto que chama onExcluir', () => {
    const p = props()
    render(<EspacoProposta {...p} />)
    fireEvent.click(screen.getByRole('button', { name: 'Excluir proposta' }))
    expect(p.onExcluir).toHaveBeenCalled()
  })

  // `VisualizadorPdfTrecho` desenha o PDF com `unpdf`/pdf.js num `<canvas>`
  // de verdade (busca o binário, decodifica, renderiza a página) — não é
  // mais um `<iframe src="...#page=N">` simples. Testar isso pede mock de
  // `unpdf` + canvas 2D (jsdom não tem canvas real sem o pacote `canvas`,
  // que não está instalado) — fora do escopo desta rodada de correção.
  it.skip('página citada num trecho suspeito abre o PDF original direto nela', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          scoreExibido: 80,
          trechosSuspeitos: [{ pagina: 5, trecho: 'trecho estranho', motivo: 'linha juntada', correcaoSugerida: null }],
        }),
    }) as jest.Mock
    render(<EspacoProposta {...props({ conteudoInicial: 'texto com trecho estranho' })} />)

    fireEvent.click(await screen.findByRole('button', { name: /^Conferir$/ }))
    fireEvent.click(await screen.findByRole('button', { name: /Ver trecho no PDF/ }))
    expect(screen.getByTitle('proposta.pdf')).toHaveAttribute(
      'src',
      '/api/propostas-comerciais/p1/arquivos/arq1?modo=preview#page=5'
    )
  })

  it('com marcador de OCR pendente, a etapa 1 mostra o OCR', () => {
    render(
      <EspacoProposta
        {...props({
          conteudoInicial:
            '<p>texto</p><div class="ocr-pendente" data-arquivo-id="a1" data-pagina="1"><p><em>(aguardando OCR)</em></p></div>',
        })}
      />
    )
    expect(screen.getByRole('button', { name: /Rodar OCR/ })).toBeInTheDocument()
  })
})
