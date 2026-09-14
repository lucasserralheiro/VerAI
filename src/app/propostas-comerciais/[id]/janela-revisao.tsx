'use client'

import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface JanelaRevisaoProps {
  titulo: string
  subtitulo?: ReactNode
  onFechar: () => void
  /** Botões do rodapé — ficam sempre visíveis, fora da rolagem. */
  rodape?: ReactNode
  /** A janela ocupa a altura toda e o corpo NÃO rola — o conteúdo divide o
   *  espaço (colunas que rolam por dentro). Em tela estreita volta a rolar. */
  corpoSemRolagem?: boolean
  children: ReactNode
}

/**
 * Janela larga pra conferir comparações da revisão (prévia de correções,
 * correções aplicadas, trechos pra conferir, revisão de português).
 *
 * O painel lateral é estreito demais pra "como está × como fica": lá fica só
 * o resumo e o botão que abre isto aqui. Uma rolagem só (o corpo), texto
 * grande e os botões de decisão presos no rodapé.
 *
 * Vai por portal pro `body` — o painel é `sticky`, e um `fixed` dentro dele
 * ficaria preso no contexto de empilhamento do painel. z-[45] deixa o modal
 * do PDF original (z-50) abrir por cima quando a pessoa pede a página.
 */
export function JanelaRevisao({ titulo, subtitulo, onFechar, rodape, corpoSemRolagem, children }: JanelaRevisaoProps) {
  const idTitulo = useId()
  const fecharRef = useRef<HTMLButtonElement>(null)
  const onFecharRef = useRef(onFechar)

  useEffect(() => {
    onFecharRef.current = onFechar
  }, [onFechar])

  useEffect(() => {
    const overflowAnterior = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    fecharRef.current?.focus()
    function tecla(e: KeyboardEvent) {
      if (e.key === 'Escape') onFecharRef.current()
    }
    window.addEventListener('keydown', tecla)
    return () => {
      document.body.style.overflow = overflowAnterior
      window.removeEventListener('keydown', tecla)
    }
  }, [])

  return createPortal(
    <div
      className="fixed inset-0 z-[45] flex items-center justify-center bg-navy/50 p-3 backdrop-blur-sm sm:p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onFechar()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        className={cn(
          'flex max-h-full w-full flex-col overflow-hidden rounded-2xl bg-white shadow-2xl',
          corpoSemRolagem ? 'max-w-[1400px] md:h-full' : 'max-w-6xl'
        )}
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-border-grey px-6 py-3">
          <div className="min-w-0 space-y-0.5">
            <h2 id={idTitulo} className="text-xl font-semibold text-navy">
              {titulo}
            </h2>
            {subtitulo && <p className="text-sm leading-snug text-mid-grey">{subtitulo}</p>}
          </div>
          <button
            ref={fecharRef}
            type="button"
            onClick={onFechar}
            aria-label="Fechar"
            className="flex size-10 shrink-0 items-center justify-center rounded-lg text-mid-grey transition-colors hover:bg-navy/[0.06] hover:text-navy"
          >
            <X className="size-5" strokeWidth={2.25} />
          </button>
        </header>

        <div
          className={cn(
            'min-h-0 flex-1 overflow-y-auto overscroll-contain px-6',
            corpoSemRolagem ? 'py-4 md:overflow-hidden' : 'py-5'
          )}
        >
          {children}
        </div>

        {rodape && (
          <footer className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-border-grey bg-light-grey/50 px-6 py-3">
            {rodape}
          </footer>
        )}
      </div>
    </div>,
    document.body
  )
}
