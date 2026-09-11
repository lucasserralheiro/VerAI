'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2, AlertCircle, ShieldCheck } from 'lucide-react'
import { temBlocoOcrPendente } from '@/lib/ocr/marcadorOcrPendente'
import {
  checagemIaAtual,
  iniciarChecagemIa,
  limparChecagemIa,
  type ResultadoChecagemIa,
} from '@/lib/checagemIaEmAndamento'
import { OcrRunner } from './ocr-runner'

export interface PainelChecagemConversaoProps {
  propostaId: string
  conteudoMarkdown: string
  onConteudoAtualizado: (markdown: string) => Promise<void>
}

type Estado =
  | { fase: 'carregando' }
  | { fase: 'pronta'; resultado: ResultadoChecagemIa }
  | { fase: 'erro'; mensagem: string }

/**
 * Painel único da Proposta Comercial: OCR (Etapa 1, já existente em
 * `ocr-runner.tsx`) primeiro, se houver `:::ocr-pendente`; depois — sozinha,
 * sem botão — a checagem por IA (Etapa 2), sempre visível no editor e na
 * tela final.
 */
export function PainelChecagemConversao({ propostaId, conteudoMarkdown, onConteudoAtualizado }: PainelChecagemConversaoProps) {
  const temOcrPendente = temBlocoOcrPendente(conteudoMarkdown)
  const [estado, setEstado] = useState<Estado>({ fase: 'carregando' })
  const montado = useRef(true)

  useEffect(() => {
    montado.current = true
    return () => {
      montado.current = false
    }
  }, [])

  useEffect(() => {
    if (temOcrPendente) return

    const atual = checagemIaAtual(propostaId)
    if (atual?.status === 'ok') {
      setEstado({ fase: 'pronta', resultado: atual.resultado })
      return
    }
    if (atual?.status === 'erro') {
      setEstado({ fase: 'erro', mensagem: atual.mensagem })
      return
    }

    setEstado({ fase: 'carregando' })
    iniciarChecagemIa(propostaId).then(
      (resultado) => {
        if (montado.current) setEstado({ fase: 'pronta', resultado })
      },
      (erro) => {
        if (montado.current) {
          setEstado({ fase: 'erro', mensagem: erro instanceof Error ? erro.message : 'Não foi possível checar a conversão.' })
        }
      }
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propostaId, temOcrPendente])

  if (temOcrPendente) {
    return (
      <OcrRunner
        propostaId={propostaId}
        conteudoMarkdown={conteudoMarkdown}
        onConteudoAtualizado={async (novo) => {
          limparChecagemIa(propostaId) // texto mudou (OCR conferido) — a checagem anterior não vale mais
          await onConteudoAtualizado(novo)
        }}
      />
    )
  }

  if (estado.fase === 'carregando') {
    return (
      <p className="flex items-center gap-2 rounded-lg border border-border-grey bg-white p-4 text-sm text-mid-grey">
        <Loader2 className="size-4 animate-spin" strokeWidth={2.25} />
        Verificando com IA... pode sair desta aba, continua rodando.
      </p>
    )
  }

  if (estado.fase === 'erro') {
    return (
      <p className="flex items-center gap-2 rounded-lg border border-red-crit/30 bg-red-crit-light p-4 text-sm text-red-crit">
        <AlertCircle className="size-4 shrink-0" strokeWidth={2.25} />
        {estado.mensagem}
      </p>
    )
  }

  const { scoreExibido, trechosSuspeitos } = estado.resultado

  if (scoreExibido === null) {
    return (
      <p className="rounded-lg border border-border-grey bg-white p-4 text-sm text-mid-grey">
        Sem páginas de texto nativo pra checar automaticamente — revise o conteúdo de OCR manualmente.
      </p>
    )
  }

  return (
    <div className="space-y-3 rounded-lg border border-border-grey bg-white p-4">
      <p className="flex items-center gap-2 text-sm font-medium text-navy">
        <ShieldCheck className="size-4 shrink-0" strokeWidth={2.25} />
        {scoreExibido}% de confiabilidade (estimativa da IA) — confira os trechos abaixo antes de finalizar.
      </p>
      {trechosSuspeitos.length === 0 ? (
        <p className="text-sm text-mid-grey">Nenhum trecho suspeito encontrado.</p>
      ) : (
        <ul className="space-y-2">
          {trechosSuspeitos.map((trecho, indice) => (
            <li key={indice} className="rounded-lg border border-orange/30 bg-orange-light/40 p-2.5 text-sm text-navy">
              <p className="font-medium">Página {trecho.pagina}</p>
              <p className="text-mid-grey">&quot;{trecho.trecho}&quot;</p>
              <p>{trecho.motivo}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
