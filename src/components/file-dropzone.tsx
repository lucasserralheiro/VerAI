'use client'

import { useId, useRef, useState, type DragEvent } from 'react'
import { FileText, Loader2, UploadCloud, X } from 'lucide-react'
import { cn } from '@/lib/utils'

function formatarTamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

interface FileDropzoneProps {
  arquivo: File | null
  onChange: (arquivo: File | null) => void
  accept?: string
  tipoLabel?: string
  tamanhoMaximoMb?: number
  disabled?: boolean
  /** Card do arquivo mostra spinner no lugar do ícone e perde a opção de remover — usado durante o envio. */
  carregando?: boolean
}

/**
 * Área de upload por arraste-e-solte ou clique — substitui o
 * `<input type="file">` nu (que renderiza o botão feio nativo do navegador,
 * tipo "Escolher ficheiro / Nenhum ficheiro selecionado"). O input real fica
 * escondido; toda a área visível é clicável e reage ao arrastar um arquivo
 * por cima, e o arquivo escolhido vira um card com nome, tamanho e opção de
 * remover — em vez de só um texto solto ao lado do botão do SO.
 */
export function FileDropzone({
  arquivo,
  onChange,
  accept = 'application/pdf',
  tipoLabel = 'PDF',
  tamanhoMaximoMb,
  disabled = false,
  carregando = false,
}: FileDropzoneProps) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [arrastando, setArrastando] = useState(false)

  function selecionar(file: File | null) {
    onChange(file)
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setArrastando(false)
    if (disabled) return
    const file = event.dataTransfer.files?.[0]
    if (file) selecionar(file)
  }

  function abrirSeletor() {
    if (!disabled) inputRef.current?.click()
  }

  if (arquivo) {
    return (
      <div
        className={cn(
          'flex items-center gap-3 rounded-xl border border-border-grey bg-white px-4 py-3 shadow-xs transition-opacity duration-150',
          carregando && 'opacity-70'
        )}
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-orange/10 text-orange">
          {carregando ? (
            <Loader2 className="size-5 animate-spin" strokeWidth={2} />
          ) : (
            <FileText className="size-5" strokeWidth={2} />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-navy">{arquivo.name}</p>
          <p className="text-xs text-mid-grey">
            {carregando ? 'Enviando...' : formatarTamanho(arquivo.size)}
          </p>
        </div>
        {!disabled && (
          <button
            type="button"
            onClick={() => selecionar(null)}
            aria-label="Remover arquivo"
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-mid-grey transition-colors hover:bg-red-crit-light hover:text-red-crit"
          >
            <X className="size-4" strokeWidth={2.25} />
          </button>
        )}
      </div>
    )
  }

  return (
    <div>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={accept}
        disabled={disabled}
        onChange={(e) => selecionar(e.target.files?.[0] ?? null)}
        className="sr-only"
      />
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        onClick={abrirSeletor}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            abrirSeletor()
          }
        }}
        onDragOver={(e) => {
          e.preventDefault()
          if (!disabled) setArrastando(true)
        }}
        onDragLeave={() => setArrastando(false)}
        onDrop={handleDrop}
        className={cn(
          'flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed px-6 py-8 text-center transition-all duration-150',
          disabled && 'cursor-not-allowed opacity-50',
          arrastando
            ? 'border-orange bg-orange/[0.06]'
            : 'border-border-grey bg-navy/[0.015] hover:border-orange/50 hover:bg-orange/[0.03]'
        )}
      >
        <span
          className={cn(
            'flex size-11 items-center justify-center rounded-full transition-colors duration-150',
            arrastando ? 'bg-orange/15 text-orange' : 'bg-navy/[0.06] text-mid-grey'
          )}
        >
          <UploadCloud className="size-5" strokeWidth={2} />
        </span>
        <p className="text-sm font-medium text-navy">
          <span className="text-orange">Clique para enviar</span> ou arraste o arquivo aqui
        </p>
        <p className="text-xs text-mid-grey">
          {tipoLabel}
          {tamanhoMaximoMb ? ` · até ${tamanhoMaximoMb}MB` : ''}
        </p>
      </div>
    </div>
  )
}
