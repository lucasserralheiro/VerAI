'use client'

import { useState } from 'react'
import { marked } from 'marked'
import { ClipboardCopy, ClipboardCheck, Pencil } from 'lucide-react'
import { BTN_PRIMARY, BTN_OUTLINE } from '@/lib/ui'

export interface PropostaFinalProps {
  conteudoMarkdown: string
  onEditarNovamente: () => void
}

export function PropostaFinal({ conteudoMarkdown, onEditarNovamente }: PropostaFinalProps) {
  const [copiado, setCopiado] = useState(false)

  async function handleCopiarFormatado() {
    const html = marked.parse(conteudoMarkdown) as string
    const textoSimples = new DOMParser().parseFromString(html, 'text/html').body.textContent ?? conteudoMarkdown

    await navigator.clipboard.write([
      new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([textoSimples], { type: 'text/plain' }),
      }),
    ])
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end gap-2">
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
      <div
        className="max-h-[70vh] overflow-auto rounded-lg border border-border-grey bg-white p-4 text-sm"
        dangerouslySetInnerHTML={{ __html: marked.parse(conteudoMarkdown) as string }}
      />
    </div>
  )
}
