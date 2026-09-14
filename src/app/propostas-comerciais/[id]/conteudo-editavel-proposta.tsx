'use client'

import { useEffect, useRef } from 'react'
import type { CSSProperties } from 'react'
import { renderizarHtmlProposta } from '@/lib/renderizarHtmlProposta'
import { sanitizarHtmlEditavel } from '@/lib/propostaEditavel/sanitizarHtmlEditavel'
import { cn } from '@/lib/utils'

export interface ConteudoEditavelPropostaProps {
  markdown: string
  onChange: (markdown: string) => void
  /** Pilha de font-family CSS (ex.: `pilhaDaFonte('aptos')`) — se omitida,
   *  `.markdown-preview` usa o padrão institucional (Aptos). */
  fonte?: string
  /** Tamanho do corpo do texto em pontos — o título usa `tamanhoCorpo + 2`.
   *  Se omitido, `.markdown-preview` usa o padrão institucional (12pt/14pt). */
  tamanhoCorpo?: number
  /** Classes de moldura (borda, padding, altura). Sem isso, fica a caixa
   *  com borda e rolagem própria de antes. */
  className?: string
}

const DEBOUNCE_MS = 400

/**
 * O conteúdo renderizado da proposta, editável direto — o usuário clica no
 * texto e digita, sem ver Markdown. `onChange` é chamado (com debounce)
 * convertendo o HTML atual de volta pra Markdown via `htmlEditavelParaMarkdown`.
 *
 * O HTML interno só é regerado quando `markdown` muda por uma fonte EXTERNA
 * a este componente (ex.: "Usar correções" aplicou um texto novo) — uma
 * mudança que veio do próprio `onChange` não força um re-render, senão o
 * cursor pula pro início a cada tecla.
 *
 * `fonte`/`tamanhoCorpo` viram variáveis CSS (`--fonte-proposta`,
 * `--tamanho-corpo-proposta`, `--tamanho-titulo-proposta`) que
 * `.markdown-preview` em globals.css lê com fallback pro padrão
 * institucional — assim o preview muda ao vivo conforme a pessoa escolhe a
 * fonte/tamanho em `SeletorFonteProposta`, sem precisar duplicar a folha de
 * estilos inteira por combinação de fonte.
 */
export function ConteudoEditavelProposta({
  markdown,
  onChange,
  fonte,
  tamanhoCorpo,
  className,
}: ConteudoEditavelPropostaProps) {
  const ref = useRef<HTMLDivElement>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mudancaInternaRef = useRef(false)

  useEffect(() => {
    if (mudancaInternaRef.current) {
      mudancaInternaRef.current = false
      return
    }
    if (ref.current) ref.current.innerHTML = renderizarHtmlProposta(markdown)
  }, [markdown])

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  function handleInput() {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => {
      if (!ref.current) return
      mudancaInternaRef.current = true
      onChange(sanitizarHtmlEditavel(ref.current.innerHTML))
    }, DEBOUNCE_MS)
  }

  function handlePaste(e: React.ClipboardEvent<HTMLDivElement>) {
    e.preventDefault()
    document.execCommand('insertText', false, e.clipboardData.getData('text/plain'))
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key !== 'Enter') return
    const no = window.getSelection()?.anchorNode
    const elemento = no instanceof Element ? no : (no?.parentElement ?? null)
    if (elemento?.closest('td, th')) e.preventDefault()
  }

  const estiloFonte: CSSProperties & Record<string, string> = {}
  if (fonte) estiloFonte['--fonte-proposta'] = fonte
  if (tamanhoCorpo != null) {
    estiloFonte['--tamanho-corpo-proposta'] = `${tamanhoCorpo}pt`
    estiloFonte['--tamanho-titulo-proposta'] = `${tamanhoCorpo + 2}pt`
  }

  return (
    <div
      ref={ref}
      role="textbox"
      aria-multiline="true"
      aria-label="Conteúdo da proposta"
      contentEditable
      suppressContentEditableWarning
      onInput={handleInput}
      onPaste={handlePaste}
      onKeyDown={handleKeyDown}
      style={estiloFonte}
      className={cn(
        'markdown-preview min-h-[200px] outline-none',
        className ?? 'max-h-[70vh] overflow-auto rounded-lg border border-border-grey bg-white p-4 focus:border-orange'
      )}
    />
  )
}
