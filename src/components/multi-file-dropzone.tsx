'use client'

import { useId, useRef, useState, type DragEvent } from 'react'
import { File as FileIcon, FileSpreadsheet, FileText, UploadCloud, X } from 'lucide-react'
import { cn } from '@/lib/utils'

function formatarTamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function extensao(nome: string): string {
  return nome.split('.').pop()?.toLowerCase() ?? ''
}

function IconePorTipo({ nome }: { nome: string }) {
  const ext = extensao(nome)
  if (ext === 'xlsx' || ext === 'csv') return <FileSpreadsheet className="size-5" strokeWidth={2} />
  if (ext === 'docx') return <FileIcon className="size-5" strokeWidth={2} />
  return <FileText className="size-5" strokeWidth={2} />
}

export interface ArquivoProposta {
  /** id local (crypto.randomUUID()) — só pra key/remoção na UI, não é persistido. */
  id: string
  file: File
}

interface MultiFileDropzoneProps {
  arquivos: ArquivoProposta[]
  onChange: (arquivos: ArquivoProposta[]) => void
  accept?: string
  tipoLabel?: string
  tamanhoMaximoMb?: number
  disabled?: boolean
}

/**
 * Área de upload por arraste-e-solte ou clique que aceita VÁRIOS arquivos de
 * uma vez (PDF, planilha, Word) — cada um vira um card numa lista, com opção
 * de remover individualmente e de continuar adicionando mais depois. Uma
 * proposta comercial pode juntar várias fontes que se complementam (ex.: o
 * PDF da proposta + a planilha de preços + o escopo em Word).
 */
export function MultiFileDropzone({
  arquivos,
  onChange,
  accept = '.pdf,.xlsx,.csv,.docx',
  tipoLabel = 'PDF, Excel (.xlsx/.csv) ou Word (.docx)',
  tamanhoMaximoMb,
  disabled = false,
}: MultiFileDropzoneProps) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [arrastando, setArrastando] = useState(false)

  function adicionar(files: FileList | File[]) {
    const novos = Array.from(files).map((file) => ({ id: crypto.randomUUID(), file }))
    onChange([...arquivos, ...novos])
  }

  function remover(id: string) {
    onChange(arquivos.filter((a) => a.id !== id))
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setArrastando(false)
    if (disabled) return
    if (event.dataTransfer.files?.length) adicionar(event.dataTransfer.files)
  }

  function abrirSeletor() {
    if (!disabled) inputRef.current?.click()
  }

  return (
    <div className="flex flex-col gap-3">
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={accept}
        multiple
        disabled={disabled}
        onChange={(e) => {
          if (e.target.files?.length) adicionar(e.target.files)
          e.target.value = ''
        }}
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
          <span className="text-orange">Clique para enviar</span> ou arraste os arquivos aqui
        </p>
        <p className="text-xs text-mid-grey">
          {tipoLabel}
          {tamanhoMaximoMb ? ` · até ${tamanhoMaximoMb}MB cada` : ''} · pode selecionar mais de um
        </p>
      </div>

      {arquivos.length > 0 && (
        <ul className="flex flex-col gap-2">
          {arquivos.map(({ id, file }) => (
            <li
              key={id}
              className="flex items-center gap-3 rounded-xl border border-border-grey bg-white px-4 py-3 shadow-xs"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-orange/10 text-orange">
                <IconePorTipo nome={file.name} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-navy">{file.name}</p>
                <p className="text-xs text-mid-grey">{formatarTamanho(file.size)}</p>
              </div>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => remover(id)}
                  aria-label={`Remover ${file.name}`}
                  className="flex size-8 shrink-0 items-center justify-center rounded-lg text-mid-grey transition-colors hover:bg-red-crit-light hover:text-red-crit"
                >
                  <X className="size-4" strokeWidth={2.25} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
