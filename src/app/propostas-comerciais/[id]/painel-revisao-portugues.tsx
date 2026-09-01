'use client'

import { useState } from 'react'
import { Sparkles, Loader2, AlertCircle } from 'lucide-react'
import { BTN_PRIMARY, BTN_OUTLINE } from '@/lib/ui'
import { diffPropostaRenderizada } from '@/lib/diffPropostaRenderizada'

type EstadoRevisao =
  | { fase: 'inicial' }
  | { fase: 'carregando' }
  | { fase: 'erro'; mensagem: string }
  | { fase: 'pronta'; original: string; corrigido: string }

export interface PainelRevisaoPortuguesProps {
  propostaId: string
  /** Texto que vai ser revisado — pode ser o conteúdo salvo ou o texto em
   *  edição no editor, ainda não salvo. */
  markdownAtual: string
  /** Chamado quando o usuário aceita as correções. Na tela final grava via
   *  PATCH; no editor só substitui o texto em edição. */
  onUsarCorrecoes: (corrigido: string) => void | Promise<void>
}

/**
 * Painel da revisão ortográfica sob demanda — usado tanto no editor (rascunho)
 * quanto na tela final. Roda o endpoint stateless, mostra o diff destacado e
 * deixa o usuário aceitar ou recusar. Nada é aplicado sem a escolha dele.
 */
export function PainelRevisaoPortugues({ propostaId, markdownAtual, onUsarCorrecoes }: PainelRevisaoPortuguesProps) {
  const [estado, setEstado] = useState<EstadoRevisao>({ fase: 'inicial' })
  const [aplicando, setAplicando] = useState(false)

  async function revisar() {
    setEstado({ fase: 'carregando' })
    try {
      const resposta = await fetch(`/api/propostas-comerciais/${propostaId}/revisao-portugues`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conteudoMarkdown: markdownAtual }),
      })
      const corpo = await resposta.json().catch(() => null)
      if (!resposta.ok) {
        setEstado({ fase: 'erro', mensagem: corpo?.error ?? 'Não foi possível revisar o texto.' })
        return
      }
      setEstado({ fase: 'pronta', original: corpo.original, corrigido: corpo.corrigido })
    } catch {
      setEstado({ fase: 'erro', mensagem: 'Não foi possível revisar o texto.' })
    }
  }

  async function usar() {
    if (estado.fase !== 'pronta') return
    setAplicando(true)
    await onUsarCorrecoes(estado.corrigido)
    setAplicando(false)
    setEstado({ fase: 'inicial' })
  }

  function voltar() {
    setEstado({ fase: 'inicial' })
  }

  if (estado.fase === 'inicial') {
    return (
      <div className="space-y-3 rounded-lg border border-border-grey bg-white p-4">
        <p className="text-sm text-mid-grey">
          A IA revisa apenas ortografia e acentuação do texto — não reescreve frases, não muda números nem a
          estrutura. Você confere o que mudou e decide se aplica.
        </p>
        <button type="button" onClick={revisar} className={BTN_PRIMARY}>
          <Sparkles className="size-3.5" strokeWidth={2.25} />
          Revisar português
        </button>
      </div>
    )
  }

  if (estado.fase === 'carregando') {
    return (
      <p className="flex items-center gap-2 rounded-lg border border-border-grey bg-white p-4 text-sm text-mid-grey">
        <Loader2 className="size-4 animate-spin" strokeWidth={2.25} />
        Revisando...
      </p>
    )
  }

  if (estado.fase === 'erro') {
    return (
      <div className="space-y-3 rounded-lg border border-red-crit/30 bg-red-crit-light p-4">
        <p className="flex items-start gap-2 text-sm text-red-crit">
          <AlertCircle className="size-4 shrink-0" strokeWidth={2.25} />
          {estado.mensagem}
        </p>
        <button type="button" onClick={voltar} className={BTN_OUTLINE}>
          Voltar
        </button>
      </div>
    )
  }

  if (estado.original === estado.corrigido) {
    return (
      <div className="space-y-3 rounded-lg border border-border-grey bg-white p-4">
        <p className="text-sm text-navy">Nenhum erro de português encontrado.</p>
        <button type="button" onClick={voltar} className={BTN_OUTLINE}>
          Voltar
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-mid-grey">
          <del className="rounded bg-red-crit-light px-0.5 text-red-crit">riscado</del> = removido{' · '}
          <ins className="rounded bg-green-ok-light px-0.5 text-green-ok no-underline">grifado</ins> = adicionado
        </p>
        <div className="flex gap-2">
          <button type="button" onClick={voltar} className={BTN_OUTLINE} disabled={aplicando}>
            Manter original
          </button>
          <button type="button" onClick={usar} className={BTN_PRIMARY} disabled={aplicando}>
            {aplicando ? 'Aplicando...' : 'Usar correções'}
          </button>
        </div>
      </div>
      <div
        className="markdown-preview max-h-[70vh] overflow-auto rounded-lg border border-border-grey bg-white p-4"
        dangerouslySetInnerHTML={{ __html: diffPropostaRenderizada(estado.original, estado.corrigido) }}
      />
    </div>
  )
}
