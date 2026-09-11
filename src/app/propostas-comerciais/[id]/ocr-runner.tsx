'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2, AlertCircle, ScanText } from 'lucide-react'
import { BTN_PRIMARY } from '@/lib/ui'
import { listarBlocosOcrPendente, removerWrapper, type BlocoOcrPendente } from '@/lib/ocr/marcadorOcrPendente'
import { rodarOcrEmBlocos, type DepsRodarOcr } from '@/lib/ocr/rodarOcr'
import { carregarDepsOcrPadrao } from '@/lib/ocr/depsOcrPadrao'
import { ocrAtual, iniciarOcr, limparOcr } from '@/lib/ocrEmAndamento'

export interface OcrRunnerProps {
  propostaId: string
  conteudoMarkdown: string
  onConteudoAtualizado: (markdown: string) => Promise<void>
  /** Só em teste — substitui o carregamento real de tesseract.js/pdf.js. */
  deps?: DepsRodarOcr
}

type Estado =
  | { fase: 'inicial' }
  | { fase: 'rodando'; pagina: number; total: number }
  | { fase: 'revisao' }
  | { fase: 'erro'; mensagem: string }

/**
 * Etapa 1 do fluxo "Proposta Comercial": quando o PDF tem página escaneada
 * (sem camada de texto), roda OCR local (`tesseract.js`, no navegador) sob
 * demanda, com conferência humana obrigatória antes de a página contar como
 * definitiva — ver docs/superpowers/specs/2026-08-31-ocr-fallback-proposta-comercial-design.md.
 */
export function OcrRunner({ propostaId, conteudoMarkdown, onConteudoAtualizado, deps }: OcrRunnerProps) {
  const [estado, setEstado] = useState<Estado>({ fase: 'inicial' })
  const montado = useRef(true)
  const blocosPendentes = listarBlocosOcrPendente(conteudoMarkdown)

  useEffect(() => {
    montado.current = true
    return () => {
      montado.current = false
    }
  }, [])

  // Ao montar (ou trocar de proposta), recupera um OCR que já estava
  // rodando/pronto pra essa proposta — mesmo padrão de
  // `painel-revisao-portugues.tsx`: sair da aba no meio não perde o trabalho.
  useEffect(() => {
    if (blocosPendentes.length === 0) {
      setEstado({ fase: 'inicial' })
      return
    }
    const atual = ocrAtual(propostaId)
    if (!atual) {
      setEstado({ fase: 'inicial' })
    } else if (atual.status === 'rodando') {
      setEstado({ fase: 'rodando', pagina: 0, total: blocosPendentes.length })
      acompanhar(atual.promise)
    } else if (atual.status === 'erro') {
      setEstado({ fase: 'erro', mensagem: atual.mensagem })
    } else {
      setEstado({ fase: 'revisao' })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propostaId, blocosPendentes.length])

  function acompanhar(promise: Promise<string>) {
    promise.then(
      async (resultado) => {
        await onConteudoAtualizado(resultado)
        limparOcr(propostaId)
        if (montado.current) setEstado({ fase: 'revisao' })
      },
      (erro) => {
        if (montado.current) {
          setEstado({ fase: 'erro', mensagem: erro instanceof Error ? erro.message : 'Não foi possível rodar o OCR.' })
        }
      }
    )
  }

  function rodar() {
    setEstado({ fase: 'rodando', pagina: 0, total: blocosPendentes.length })
    const promise = iniciarOcr(propostaId, async () => {
      const depsReais = deps ?? (await carregarDepsOcrPadrao(propostaId))
      return rodarOcrEmBlocos(conteudoMarkdown, {
        ...depsReais,
        onProgresso: (p) => {
          if (montado.current) setEstado({ fase: 'rodando', pagina: p.pagina, total: p.total })
        },
      })
    })
    acompanhar(promise)
  }

  async function conferir(bloco: BlocoOcrPendente, textoFinal: string) {
    await onConteudoAtualizado(removerWrapper(conteudoMarkdown, bloco, textoFinal))
  }

  if (estado.fase === 'inicial' && blocosPendentes.length === 0) return null

  if (estado.fase === 'inicial') {
    return (
      <div className="space-y-3 rounded-lg border border-border-grey bg-white p-4">
        <p className="text-sm text-mid-grey">
          {blocosPendentes.length} página{blocosPendentes.length > 1 ? 's são imagem' : ' é imagem'} — o texto não foi
          extraído automaticamente.
        </p>
        <button type="button" onClick={rodar} className={BTN_PRIMARY}>
          <ScanText className="size-3.5" strokeWidth={2.25} />
          Rodar OCR ({blocosPendentes.length} página{blocosPendentes.length > 1 ? 's' : ''})
        </button>
      </div>
    )
  }

  if (estado.fase === 'rodando') {
    return (
      <p className="flex items-center gap-2 rounded-lg border border-border-grey bg-white p-4 text-sm text-mid-grey">
        <Loader2 className="size-4 animate-spin" strokeWidth={2.25} />
        Rodando OCR... página {estado.pagina} de {estado.total}. Pode sair desta aba, continua rodando.
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

  return <RevisaoOcr blocos={blocosPendentes} onConferir={conferir} />
}

function RevisaoOcr({
  blocos,
  onConferir,
}: {
  blocos: BlocoOcrPendente[]
  onConferir: (bloco: BlocoOcrPendente, textoFinal: string) => Promise<void>
}) {
  const [indice, setIndice] = useState(0)
  const [texto, setTexto] = useState(blocos[0]?.corpo ?? '')
  const [salvando, setSalvando] = useState(false)

  const bloco = blocos[indice]
  if (!bloco) {
    return <p className="text-sm text-navy">Todos os trechos de OCR foram conferidos.</p>
  }

  async function confirmar() {
    setSalvando(true)
    await onConferir(bloco, texto)
    setSalvando(false)
    const proximo = indice + 1
    setIndice(proximo)
    setTexto(blocos[proximo]?.corpo ?? '')
  }

  return (
    <div className="space-y-3 rounded-lg border border-border-grey bg-white p-4">
      <p className="text-sm text-mid-grey">
        Confira o texto reconhecido contra a página original — trecho {indice + 1} de {blocos.length} (página {bloco.pagina}
        ).
      </p>
      <textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        rows={10}
        className="w-full rounded-lg border border-border-grey p-2 text-sm"
      />
      <button type="button" onClick={confirmar} disabled={salvando} className={BTN_PRIMARY}>
        {salvando ? 'Salvando...' : 'Conferi este trecho'}
      </button>
    </div>
  )
}
