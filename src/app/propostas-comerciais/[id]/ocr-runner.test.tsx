import { useState } from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { OcrRunner, type OcrRunnerProps } from './ocr-runner'
import { limparOcr } from '@/lib/ocrEmAndamento'

const markdownComPendente =
  '<p>X</p><div class="ocr-pendente" data-arquivo-id="a1" data-pagina="1"><p><em>(aguardando OCR)</em></p></div><p>Y</p>'

/** `OcrRunner` é controlado por prop — o `conteudoMarkdown` só reflete o
 *  texto reconhecido depois que o PAI re-renderiza com o valor atualizado
 *  (é isso que `espaco-proposta.tsx` faz de verdade via `setTexto`). Este
 *  wrapper simula esse pai, guardando o estado e repassando pro spy. */
function ControlledOcrRunner({
  onConteudoAtualizado,
  ...props
}: Omit<OcrRunnerProps, 'conteudoMarkdown'> & { conteudoMarkdown: string }) {
  const [texto, setTexto] = useState(props.conteudoMarkdown)
  return (
    <OcrRunner
      {...props}
      conteudoMarkdown={texto}
      onConteudoAtualizado={async (novo) => {
        setTexto(novo)
        await onConteudoAtualizado(novo)
      }}
    />
  )
}

describe('OcrRunner', () => {
  beforeEach(() => limparOcr('p1'))

  it('sem bloco pendente não renderiza nada', () => {
    const { container } = render(
      <OcrRunner propostaId="p1" conteudoMarkdown="texto normal" onConteudoAtualizado={jest.fn()} />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('mostra o botão "Rodar OCR" com a contagem de páginas', () => {
    render(<OcrRunner propostaId="p1" conteudoMarkdown={markdownComPendente} onConteudoAtualizado={jest.fn()} />)
    expect(screen.getByRole('button', { name: /Rodar OCR \(1 página\)/ })).toBeInTheDocument()
  })

  it('ao clicar, roda o OCR injetado, salva o resultado e entra em modo revisão', async () => {
    const onConteudoAtualizado = jest.fn().mockResolvedValue(undefined)
    const deps = {
      renderizarPagina: jest.fn().mockResolvedValue('data:image/png;base64,fake'),
      reconhecer: jest.fn().mockResolvedValue({ texto: 'Texto reconhecido.', palavras: [] }),
    }

    render(
      <ControlledOcrRunner
        propostaId="p1"
        conteudoMarkdown={markdownComPendente}
        onConteudoAtualizado={onConteudoAtualizado}
        deps={deps}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /Rodar OCR/ }))

    await waitFor(() =>
      expect(onConteudoAtualizado).toHaveBeenCalledWith(
        '<p>X</p><div class="ocr-pendente" data-arquivo-id="a1" data-pagina="1"><p>Texto reconhecido.</p></div><p>Y</p>'
      )
    )
    expect(await screen.findByRole('button', { name: /Conferi este trecho/ })).toBeInTheDocument()
  })

  it('"Conferi este trecho" remove o wrapper e salva o texto final', async () => {
    const onConteudoAtualizado = jest.fn().mockResolvedValue(undefined)
    const deps = {
      renderizarPagina: jest.fn().mockResolvedValue('data:image/png;base64,fake'),
      reconhecer: jest.fn().mockResolvedValue({ texto: 'Texto reconhecido.', palavras: [] }),
    }
    render(
      <ControlledOcrRunner
        propostaId="p1"
        conteudoMarkdown={markdownComPendente}
        onConteudoAtualizado={onConteudoAtualizado}
        deps={deps}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /Rodar OCR/ }))
    await screen.findByRole('button', { name: /Conferi este trecho/ })

    fireEvent.click(screen.getByRole('button', { name: /Conferi este trecho/ }))

    await waitFor(() =>
      expect(onConteudoAtualizado).toHaveBeenLastCalledWith('<p>X</p><p>Texto reconhecido.</p><p>Y</p>')
    )
  })

  it('erro numa página vira aviso de falha, mas segue pro modo revisão', async () => {
    const deps = {
      renderizarPagina: jest.fn().mockRejectedValue(new Error('sem rede')),
      reconhecer: jest.fn(),
    }
    render(<OcrRunner propostaId="p1" conteudoMarkdown={markdownComPendente} onConteudoAtualizado={jest.fn()} deps={deps} />)

    fireEvent.click(screen.getByRole('button', { name: /Rodar OCR/ }))

    // erro é por-página (rodarOcrEmBlocos absorve), então o fluxo segue pra
    // revisão com o aviso de falha no corpo do bloco
    expect(await screen.findByRole('button', { name: /Conferi este trecho/ })).toBeInTheDocument()
  })
})
