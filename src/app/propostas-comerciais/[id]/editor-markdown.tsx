'use client'

import { useState } from 'react'
import { marked } from 'marked'
import { FileText, X } from 'lucide-react'
import { BTN_PRIMARY, BTN_OUTLINE } from '@/lib/ui'

export interface EditorMarkdownProps {
  propostaId: string
  conteudoInicial: string
  onSalvar: (markdown: string) => Promise<void>
}

export function EditorMarkdown({ propostaId, conteudoInicial, onSalvar }: EditorMarkdownProps) {
  const [markdown, setMarkdown] = useState(conteudoInicial)
  const [modalAberto, setModalAberto] = useState(false)
  const [salvando, setSalvando] = useState(false)

  async function handleSalvar() {
    setSalvando(true)
    await onSalvar(markdown)
    setSalvando(false)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-mid-grey">Ajuste o Markdown gerado a partir do PDF antes de salvar.</p>
        <div className="flex gap-2">
          <button type="button" onClick={() => setModalAberto(true)} className={BTN_OUTLINE}>
            <FileText className="size-3.5" strokeWidth={2.25} />
            Ver PDF original
          </button>
          <button type="button" onClick={handleSalvar} disabled={salvando} className={BTN_PRIMARY}>
            {salvando ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <textarea
          aria-label="Markdown"
          value={markdown}
          onChange={(e) => setMarkdown(e.target.value)}
          className="h-[60vh] w-full rounded-lg border border-border-grey p-3 font-mono text-sm outline-none focus:border-orange"
        />
        <div
          aria-label="Preview"
          className="h-[60vh] overflow-auto rounded-lg border border-border-grey p-3 text-sm"
          dangerouslySetInnerHTML={{ __html: marked.parse(markdown) as string }}
        />
      </div>

      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/50 p-4 backdrop-blur-sm">
          <div className="flex h-[85vh] w-full max-w-4xl flex-col gap-3 rounded-2xl bg-white p-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-navy">PDF original</h2>
              <button type="button" onClick={() => setModalAberto(false)} aria-label="Fechar">
                <X className="size-4" strokeWidth={2.25} />
              </button>
            </div>
            <iframe
              src={`/api/propostas-comerciais/${propostaId}/original?modo=preview`}
              className="h-full w-full rounded-lg border border-border-grey"
              title="PDF original"
            />
          </div>
        </div>
      )}
    </div>
  )
}
