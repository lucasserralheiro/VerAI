'use client'

import { useState } from 'react'
import { ClipboardCopy, ClipboardCheck, Pencil, Sparkles } from 'lucide-react'
import { BTN_PRIMARY, BTN_OUTLINE } from '@/lib/ui'
import { cn } from '@/lib/utils'
import { copiarMarkdownFormatado } from '@/lib/copiarMarkdownFormatado'
import { renderizarMarkdownProposta } from '@/lib/renderizarMarkdownProposta'
import { PainelRevisaoPortugues } from './painel-revisao-portugues'

export interface PropostaFinalProps {
  propostaId: string
  conteudoMarkdown: string
  onEditarNovamente: () => void
  onUsarCorrecoes: (markdown: string) => Promise<void>
}

export function PropostaFinal({ propostaId, conteudoMarkdown, onEditarNovamente, onUsarCorrecoes }: PropostaFinalProps) {
  const [copiado, setCopiado] = useState(false)
  const [aba, setAba] = useState<'visualizar' | 'correcao'>('visualizar')

  async function handleCopiarFormatado() {
    await copiarMarkdownFormatado(conteudoMarkdown)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  async function handleUsarCorrecoes(corrigido: string) {
    await onUsarCorrecoes(corrigido)
    setAba('visualizar')
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-lg border border-border-grey bg-light-grey/60 p-0.5">
          <button
            type="button"
            onClick={() => setAba('visualizar')}
            className={cn(
              'rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors',
              aba === 'visualizar' ? 'bg-white text-navy shadow-xs' : 'text-mid-grey hover:text-navy'
            )}
          >
            Visualizar
          </button>
          <button
            type="button"
            onClick={() => setAba('correcao')}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors',
              aba === 'correcao' ? 'bg-white text-navy shadow-xs' : 'text-mid-grey hover:text-navy'
            )}
          >
            <Sparkles className="size-3.5" strokeWidth={2.25} />
            Correção da IA
          </button>
        </div>

        <div className="flex gap-2">
          <button type="button" onClick={onEditarNovamente} className={BTN_OUTLINE}>
            <Pencil className="size-3.5" strokeWidth={2.25} />
            Editar novamente
          </button>
          <button type="button" onClick={handleCopiarFormatado} className={BTN_PRIMARY}>
            {copiado ? (
              <>
                <ClipboardCheck className="size-3.5" strokeWidth={2.25} />
                Copiado!
              </>
            ) : (
              <>
                <ClipboardCopy className="size-3.5" strokeWidth={2.25} />
                Copiar formatado
              </>
            )}
          </button>
        </div>
      </div>

      {aba === 'visualizar' && (
        <div
          className="markdown-preview max-h-[70vh] overflow-auto rounded-lg border border-border-grey bg-white p-4"
          dangerouslySetInnerHTML={{ __html: renderizarMarkdownProposta(conteudoMarkdown) }}
        />
      )}

      {aba === 'correcao' && (
        <PainelRevisaoPortugues
          propostaId={propostaId}
          markdownAtual={conteudoMarkdown}
          onUsarCorrecoes={handleUsarCorrecoes}
        />
      )}
    </div>
  )
}
