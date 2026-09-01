'use client'

import { useState } from 'react'
import { ClipboardCopy, ClipboardCheck, Pencil, Sparkles, Loader2, AlertCircle } from 'lucide-react'
import { BTN_PRIMARY, BTN_OUTLINE } from '@/lib/ui'
import { cn } from '@/lib/utils'
import { copiarMarkdownFormatado } from '@/lib/copiarMarkdownFormatado'
import { renderizarMarkdownProposta } from '@/lib/renderizarMarkdownProposta'
import { diffPropostaRenderizada } from '@/lib/diffPropostaRenderizada'

export interface PropostaFinalProps {
  propostaId: string
  conteudoMarkdown: string
  onEditarNovamente: () => void
  onUsarCorrecoes: (markdown: string) => Promise<void>
}

type EstadoRevisao =
  | { fase: 'inicial' }
  | { fase: 'carregando' }
  | { fase: 'erro'; mensagem: string }
  | { fase: 'pronta'; original: string; corrigido: string }

export function PropostaFinal({ propostaId, conteudoMarkdown, onEditarNovamente, onUsarCorrecoes }: PropostaFinalProps) {
  const [copiado, setCopiado] = useState(false)
  const [aba, setAba] = useState<'visualizar' | 'correcao'>('visualizar')
  const [revisao, setRevisao] = useState<EstadoRevisao>({ fase: 'inicial' })
  const [aplicando, setAplicando] = useState(false)

  async function handleCopiarFormatado() {
    await copiarMarkdownFormatado(conteudoMarkdown)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  async function handleRevisar() {
    setRevisao({ fase: 'carregando' })
    try {
      const resposta = await fetch(`/api/propostas-comerciais/${propostaId}/revisao-portugues`, { method: 'POST' })
      const corpo = await resposta.json().catch(() => null)
      if (!resposta.ok) {
        setRevisao({ fase: 'erro', mensagem: corpo?.error ?? 'Não foi possível revisar o texto.' })
        return
      }
      setRevisao({ fase: 'pronta', original: corpo.original, corrigido: corpo.corrigido })
    } catch {
      setRevisao({ fase: 'erro', mensagem: 'Não foi possível revisar o texto.' })
    }
  }

  async function handleUsarCorrecoes() {
    if (revisao.fase !== 'pronta') return
    setAplicando(true)
    await onUsarCorrecoes(revisao.corrigido)
    setAplicando(false)
    setRevisao({ fase: 'inicial' })
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
        <RevisaoPortugues
          estado={revisao}
          aplicando={aplicando}
          onRevisar={handleRevisar}
          onUsar={handleUsarCorrecoes}
          onVoltar={() => setRevisao({ fase: 'inicial' })}
        />
      )}
    </div>
  )
}

function RevisaoPortugues({
  estado,
  aplicando,
  onRevisar,
  onUsar,
  onVoltar,
}: {
  estado: EstadoRevisao
  aplicando: boolean
  onRevisar: () => void
  onUsar: () => void
  onVoltar: () => void
}) {
  if (estado.fase === 'inicial') {
    return (
      <div className="space-y-3 rounded-lg border border-border-grey bg-white p-4">
        <p className="text-sm text-mid-grey">
          A IA revisa apenas ortografia e acentuação do texto — não reescreve frases, não muda números nem a
          estrutura. Você confere o que mudou e decide se aplica.
        </p>
        <button type="button" onClick={onRevisar} className={BTN_PRIMARY}>
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
        <button type="button" onClick={onVoltar} className={BTN_OUTLINE}>
          Voltar
        </button>
      </div>
    )
  }

  if (estado.original === estado.corrigido) {
    return (
      <div className="space-y-3 rounded-lg border border-border-grey bg-white p-4">
        <p className="text-sm text-navy">Nenhum erro de português encontrado.</p>
        <button type="button" onClick={onVoltar} className={BTN_OUTLINE}>
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
          <button type="button" onClick={onVoltar} className={BTN_OUTLINE} disabled={aplicando}>
            Manter original
          </button>
          <button type="button" onClick={onUsar} className={BTN_PRIMARY} disabled={aplicando}>
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
