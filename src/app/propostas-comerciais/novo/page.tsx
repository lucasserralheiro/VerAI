'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, Loader2, UploadCloud } from 'lucide-react'
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

    const formData = new FormData()
    for (const { file } of arquivos) {
      formData.append('arquivos', file)
    }

    const response = await fetch('/api/propostas-comerciais', { method: 'POST', body: formData })
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
