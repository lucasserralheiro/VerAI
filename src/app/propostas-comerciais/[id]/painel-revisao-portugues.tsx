'use client'

import { useEffect, useRef, useState } from 'react'
import { Sparkles, Loader2, AlertCircle } from 'lucide-react'
import { BTN_PRIMARY, BTN_OUTLINE } from '@/lib/ui'
import { diffPropostaRenderizada } from '@/lib/diffPropostaRenderizada'
import {
  iniciarRevisao,
  limparRevisao,
  revisaoAtual,
  type ResultadoRevisao,
} from '@/lib/revisaoPortuguesEmAndamento'

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
 * quanto na tela final. A revisão em si roda no cache de módulo
 * (`revisaoPortuguesEmAndamento`), então sair da aba não cancela nada: ao
 * voltar, o painel recupera o "carregando" ou o resultado.
 */
export function PainelRevisaoPortugues({ propostaId, markdownAtual, onUsarCorrecoes }: PainelRevisaoPortuguesProps) {
  const [estado, setEstado] = useState<EstadoRevisao>({ fase: 'inicial' })
  const [aplicando, setAplicando] = useState(false)
  const montado = useRef(true)

  useEffect(() => {
    montado.current = true
    return () => {
      montado.current = false
    }
  }, [])

  // Ao montar (ou trocar de proposta), recupera uma revisão que já estava
  // rodando/pronta pra essa proposta.
  useEffect(() => {
    const atual = revisaoAtual(propostaId)
    if (!atual) {
      setEstado({ fase: 'inicial' })
      return
    }
    if (atual.status === 'ok') {
      setEstado({ fase: 'pronta', ...atual.resultado })
    } else if (atual.status === 'erro') {
      setEstado({ fase: 'erro', mensagem: atual.mensagem })
    } else {
      setEstado({ fase: 'carregando' })
      acompanhar(atual.promise)
    }
  }, [propostaId])

  function acompanhar(promise: Promise<ResultadoRevisao>) {
    promise.then(
      (resultado) => {
        if (montado.current) setEstado({ fase: 'pronta', ...resultado })
      },
      (erro) => {
        if (montado.current) {
          setEstado({ fase: 'erro', mensagem: erro instanceof Error ? erro.message : 'Não foi possível revisar o texto.' })
        }
      }
    )
  }

  function revisar() {
    setEstado({ fase: 'carregando' })
    acompanhar(iniciarRevisao(propostaId, markdownAtual))
  }

  async function usar() {
    if (estado.fase !== 'pronta') return
    setAplicando(true)
    await onUsarCorrecoes(estado.corrigido)
    if (montado.current) setAplicando(false)
    limparRevisao(propostaId)
    if (montado.current) setEstado({ fase: 'inicial' })
  }

  function voltar() {
    limparRevisao(propostaId)
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
        Revisando... pode sair desta aba, a revisão continua rodando.
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
