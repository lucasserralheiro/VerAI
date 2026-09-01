'use client'

import { useState } from 'react'

export interface EditarComoTextoProps {
  markdown: string
  onChange: (markdown: string) => void
}

/**
 * Saída de emergência discreta pra quando a edição visual não dá conta
 * (round-trip HTML↔Markdown é melhor esforço, não perfeito). Deliberadamente
 * secundária — um link, não uma aba — pra não voltar a ser o fluxo padrão.
 */
export function EditarComoTexto({ markdown, onChange }: EditarComoTextoProps) {
  const [aberto, setAberto] = useState(false)

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="text-xs text-mid-grey underline underline-offset-2 hover:text-navy"
      >
        Editar como texto
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-1.5">
      <textarea
        aria-label="Editar como texto"
        value={markdown}
        onChange={(e) => onChange(e.target.value)}
        className="h-[40vh] w-full rounded-lg border border-border-grey p-3.5 font-mono text-sm leading-relaxed outline-none focus:border-orange"
      />
      <button
        type="button"
        onClick={() => setAberto(false)}
        className="self-start text-xs text-mid-grey underline underline-offset-2 hover:text-navy"
      >
        Voltar pra edição normal
      </button>
    </div>
  )
}
