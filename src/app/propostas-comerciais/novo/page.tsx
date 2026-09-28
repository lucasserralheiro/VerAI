'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, Loader2, UploadCloud } from 'lucide-react'
import { enviarParaR2 } from '@/lib/envio-r2-navegador'
import { BTN_PRIMARY_LG } from '@/lib/ui'
import { MultiFileDropzone, type ArquivoProposta } from '@/components/multi-file-dropzone'

export default function NovaPropostaComercialPage() {
  const router = useRouter()
  const [arquivos, setArquivos] = useState<ArquivoProposta[]>([])
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (arquivos.length === 0) {
      setErro('Adicione ao menos um arquivo (PDF, Excel ou Word).')
      return
    }

    setEnviando(true)
    setErro(null)

    // Cada arquivo sobe DIRETO pro Cloudflare R2, do navegador — nunca passa
    // pelo corpo desta (ou de qualquer) requisição pro nosso servidor. Isso
    // existe porque uma função serverless da Vercel rejeita (413) qualquer
    // corpo de requisição acima de 4,5 MB, e PDF de proposta real passa
    // disso com frequência (caso real: 413 num PDF de ~6 MB). O link pra
    // esse envio direto vem de `/api/propostas-comerciais/envio`; quem
    // processa o arquivo de verdade (`/api/propostas-comerciais`, abaixo)
    // só recebe o endereço de onde baixá-lo, não o binário. (Até 09/2026 era
    // o Vercel Blob, suspenso por cota.)
    let arquivosEnviados: { nomeArquivo: string; url: string; tamanhoBytes: number }[]
    try {
      arquivosEnviados = await Promise.all(
        arquivos.map(async ({ file }) => {
          const endereco = await enviarParaR2(file, '/api/propostas-comerciais/envio')
          return { nomeArquivo: file.name, url: endereco, tamanhoBytes: file.size }
        })
      )
    } catch (error) {
      setEnviando(false)
      setErro(error instanceof Error ? error.message : 'Falha ao enviar os arquivos.')
      return
    }

    const response = await fetch('/api/propostas-comerciais', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ arquivos: arquivosEnviados }),
    })
    const resultado = await response.json().catch(() => null)

    if (!response.ok) {
      setEnviando(false)
      setErro(resultado?.error ?? 'Falha ao enviar os arquivos.')
      return
    }

    router.push(`/propostas-comerciais/${resultado.id}`)
  }

  return (
    <main className="mx-auto max-w-2xl space-y-6 px-6 py-8 lg:px-8">
      <div className="space-y-1">
        <span className="text-xs font-semibold tracking-wide text-orange uppercase">Proposta Comercial</span>
        <h1 className="text-2xl font-bold text-navy">Nova conversão</h1>
        <p className="text-sm text-mid-grey">
          Envie um ou mais arquivos da mesma proposta — PDF, planilha (Excel/CSV) e Word podem se
          complementar. Tudo é convertido e consolidado num único documento em Markdown.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="card space-y-4">
        <div className="flex flex-col gap-1.5 text-sm">
          <span className="text-xs font-medium text-mid-grey">Arquivos da proposta</span>
          <MultiFileDropzone
            arquivos={arquivos}
            onChange={(novos) => {
              setArquivos(novos)
              if (novos.length > 0) setErro(null)
            }}
            accept=".pdf,.xlsx,.csv,.docx"
            tipoLabel="PDF, Excel (.xlsx/.csv) ou Word (.docx)"
            tamanhoMaximoMb={20}
            disabled={enviando}
          />
        </div>

        {erro && (
          <p className="flex items-center gap-2 rounded-lg bg-red-crit-light p-3 text-sm text-red-crit">
            <AlertCircle className="size-4 shrink-0" strokeWidth={2.25} />
            {erro}
          </p>
        )}

        <div className="space-y-2 border-t border-border-grey pt-4">
          <button type="submit" disabled={enviando || arquivos.length === 0} className={BTN_PRIMARY_LG}>
            {enviando ? (
              <Loader2 className="size-4 animate-spin" strokeWidth={2.25} />
            ) : (
              <UploadCloud className="size-4" strokeWidth={2.25} />
            )}
            {enviando
              ? 'Enviando e consolidando...'
              : `Enviar proposta${arquivos.length > 1 ? ` (${arquivos.length} arquivos)` : ''}`}
          </button>

          {enviando && (
            <div className="space-y-1.5">
              <div className="progress-indeterminate h-1 w-full rounded-full" />
              <p className="text-center text-xs text-mid-grey">
                {arquivos.length > 1
                  ? 'Extraindo e consolidando os arquivos — pode levar um pouco mais com vários documentos.'
                  : 'Isso pode levar alguns segundos'}{' '}
                — não feche esta página.
              </p>
            </div>
          )}
        </div>
      </form>
    </main>
  )
}
