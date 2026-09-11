import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { EditorMarkdown } from './editor-markdown'
import { limparChecagemIa } from '@/lib/checagemIaEmAndamento'
import { limparOcr } from '@/lib/ocrEmAndamento'

const UM_ARQUIVO = [{ id: 'arq1', nomeArquivo: 'proposta.pdf', tipo: 'pdf' }]

describe('EditorMarkdown', () => {
  beforeEach(() => {
    // O painel de checagem por IA dispara sozinho ao montar (ver
    // painel-checagem-conversao.tsx) — sem limpar o cache de sessão entre
    // testes, um resultado (ou erro) de um teste anterior vazaria pro
    // próximo, já que todos usam o mesmo propostaId "prop1".
    limparChecagemIa('prop1')
    limparOcr('prop1')
  })

  it('abre na aba Visualizar mostrando o conteúdo renderizado', () => {
    render(
      <EditorMarkdown
        propostaId="prop1"
        conteudoInicial="# Título"
        arquivosOriginais={UM_ARQUIVO}
        onSalvar={jest.fn()}
      />
    )
    expect(screen.getByRole('heading', { name: 'Título' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Conteúdo da proposta' })).toBeInTheDocument()
  })

  it('abre e fecha o modal do arquivo original quando há só um arquivo', () => {
    render(
      <EditorMarkdown
        propostaId="prop1"
        conteudoInicial="texto"
        arquivosOriginais={UM_ARQUIVO}
        onSalvar={jest.fn()}
      />
    )

    expect(screen.queryByTitle('proposta.pdf')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Arquivo original' }))
    const iframe = screen.getByTitle('proposta.pdf')
    expect(iframe).toHaveAttribute('src', '/api/propostas-comerciais/prop1/arquivos/arq1?modo=preview')

    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }))
    expect(screen.queryByTitle('proposta.pdf')).not.toBeInTheDocument()
  })

  it('com vários arquivos, abre um menu pra escolher qual ver', () => {
    const arquivos = [
      { id: 'arq1', nomeArquivo: 'proposta.pdf', tipo: 'pdf' },
      { id: 'arq2', nomeArquivo: 'precos.xlsx', tipo: 'xlsx' },
    ]
    render(
      <EditorMarkdown propostaId="prop1" conteudoInicial="texto" arquivosOriginais={arquivos} onSalvar={jest.fn()} />
    )

    expect(screen.queryByRole('menuitem', { name: /precos\.xlsx/ })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Arquivos originais (2)' }))
    expect(screen.getByRole('menuitem', { name: /proposta\.pdf/ })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('menuitem', { name: /precos\.xlsx/ }))
    expect(screen.getByRole('heading', { name: /precos\.xlsx/ })).toBeInTheDocument()
  })

  it('chama onSalvar com o texto atual ao clicar em Salvar', () => {
    const onSalvar = jest.fn().mockResolvedValue(undefined)
    render(
      <EditorMarkdown
        propostaId="prop1"
        conteudoInicial="conteúdo original"
        arquivosOriginais={UM_ARQUIVO}
        onSalvar={onSalvar}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Editar como texto' }))
    fireEvent.change(screen.getByLabelText('Editar como texto'), { target: { value: 'conteúdo editado' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))

    expect(onSalvar).toHaveBeenCalledWith('conteúdo editado')
  })

  it('com um único arquivo, não oferece a opção de remover', () => {
    render(
      <EditorMarkdown
        propostaId="prop1"
        conteudoInicial="texto"
        arquivosOriginais={UM_ARQUIVO}
        onSalvar={jest.fn()}
      />
    )

    expect(screen.queryByRole('button', { name: /Remover/ })).not.toBeInTheDocument()
  })

  it('com vários arquivos, remove um arquivo da lista ao confirmar', async () => {
    const arquivos = [
      { id: 'arq1', nomeArquivo: 'proposta.pdf', tipo: 'pdf' },
      { id: 'arq2', nomeArquivo: 'precos.xlsx', tipo: 'xlsx' },
    ]
    jest.spyOn(window, 'confirm').mockReturnValue(true)
    global.fetch = jest.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true }) })) as unknown as typeof fetch

    render(
      <EditorMarkdown propostaId="prop1" conteudoInicial="texto" arquivosOriginais={arquivos} onSalvar={jest.fn()} />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Arquivos originais (2)' }))
    fireEvent.click(screen.getByRole('button', { name: 'Remover precos.xlsx' }))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/propostas-comerciais/prop1/arquivos/arq2', {
        method: 'DELETE',
      })
    })

    // Sobrou 1 arquivo só — o menu vira o botão direto de "Arquivo original".
    expect(screen.getByRole('button', { name: 'Arquivo original' })).toBeInTheDocument()
    expect(screen.queryByText('precos.xlsx')).not.toBeInTheDocument()
  })

  it('mostra o OcrRunner quando o conteúdo tem :::ocr-pendente', () => {
    render(
      <EditorMarkdown
        propostaId="prop1"
        conteudoInicial={'texto\n\n:::ocr-pendente[arquivoId=a1 pagina=1]\n_(aguardando OCR)_\n:::'}
        arquivosOriginais={[]}
        onSalvar={jest.fn()}
      />
    )
    expect(screen.getByRole('button', { name: /Rodar OCR/ })).toBeInTheDocument()
  })

  it('sem :::ocr-pendente não mostra o OcrRunner', () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ scoreExibido: 90, trechosSuspeitos: [] }),
    }) as jest.Mock

    render(<EditorMarkdown propostaId="prop1" conteudoInicial="texto normal" arquivosOriginais={[]} onSalvar={jest.fn()} />)
    expect(screen.queryByRole('button', { name: /Rodar OCR/ })).not.toBeInTheDocument()
  })

  it('mostra o resultado da checagem por IA quando não há OCR pendente', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ scoreExibido: 95, trechosSuspeitos: [] }),
    }) as jest.Mock

    render(<EditorMarkdown propostaId="prop1" conteudoInicial="texto normal" arquivosOriginais={[]} onSalvar={jest.fn()} />)

    expect(await screen.findByText(/95%/)).toBeInTheDocument()
  })
})
