'use client'

import { useEffect, useRef } from 'react'
import { renderizarMarkdownProposta } from '@/lib/renderizarMarkdownProposta'
import { htmlEditavelParaMarkdown } from '@/lib/propostaEditavel/htmlEditavelParaMarkdown'

export interface ConteudoEditavelPropostaProps {
  markdown: string
  onChange: (markdown: string) => void
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
 */
export function ConteudoEditavelProposta({ markdown, onChange }: ConteudoEditavelPropostaProps) {
  const ref = useRef<HTMLDivElement>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mudancaInternaRef = useRef(false)

  useEffect(() => {
    if (mudancaInternaRef.current) {
      mudancaInternaRef.current = false
      return
    }
    if (ref.current) ref.current.innerHTML = renderizarMarkdownProposta(markdown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      onChange(htmlEditavelParaMarkdown(ref.current.innerHTML))
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
      className="markdown-preview max-h-[70vh] min-h-[200px] overflow-auto rounded-lg border border-border-grey bg-white p-4 outline-none focus:border-orange"
    />
  )
}
