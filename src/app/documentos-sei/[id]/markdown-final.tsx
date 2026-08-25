'use client'

import { useState } from 'react'
import { ClipboardCopy, ClipboardCheck } from 'lucide-react'
import { BTN_PRIMARY } from '@/lib/ui'

export interface MarkdownFinalProps {
  conteudoMarkdown: string
}

export function MarkdownFinal({ conteudoMarkdown }: MarkdownFinalProps) {
  const [copiado, setCopiado] = useState(false)

  async function handleCopiar() {
    await navigator.clipboard.writeText(conteudoMarkdown)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button type="button" onClick={handleCopiar} className={BTN_PRIMARY}>
          {copiado ? (
            <>
              <ClipboardCheck className="size-3.5" strokeWidth={2.25} />
              Copiado!
            </>
          ) : (
            <>
              <ClipboardCopy className="size-3.5" strokeWidth={2.25} />
              Copiar tudo
            </>
          )}
        </button>
      </div>
      <pre className="max-h-[70vh] overflow-auto whitespace-pre-wrap rounded-lg border border-border-grey bg-light-grey p-4 text-sm">
        {conteudoMarkdown}
      </pre>
    </div>
  )
}
