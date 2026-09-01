'use client'

import { useEffect, useState } from 'react'
import { ChevronDown, Download, FileSpreadsheet, FileText, File as FileIcon, Loader2, X } from 'lucide-react'
import { BTN_OUTLINE } from '@/lib/ui'
import { cn } from '@/lib/utils'

export interface ArquivoOriginal {
  id: string
  nomeArquivo: string
  tipo: string
}

export function IconePorTipo({ tipo }: { tipo: string }) {
  if (tipo === 'xlsx' || tipo === 'csv') return <FileSpreadsheet className="size-4 shrink-0" strokeWidth={2.25} />
  if (tipo === 'docx') return <FileIcon className="size-4 shrink-0" strokeWidth={2.25} />
  return <FileText className="size-4 shrink-0" strokeWidth={2.25} />
}

interface PreviewPlanilha {
  cabecalho: string[]
  linhas: string[][]
  totalLinhas: number
  truncado: boolean
}

/** Conteúdo do modal de arquivo original — cada tipo tem seu jeito de
 *  pré-visualizar: PDF abre a rota que já serve o binário inline, Word vira
 *  HTML renderizado (mesmo endpoint/lib já usados em "Relatórios dos
 *  clientes"), planilha vira uma tabela a partir do preview estruturado. */
function ConteudoArquivoOriginal({ propostaId, arquivo }: { propostaId: string; arquivo: ArquivoOriginal }) {
  const [preview, setPreview] = useState<PreviewPlanilha | null>(null)

  useEffect(() => {
    setPreview(null)
    if (arquivo.tipo === 'xlsx' || arquivo.tipo === 'csv') {
      fetch(`/api/propostas-comerciais/${propostaId}/arquivos/${arquivo.id}/preview`)
        .then((r) => r.json())
        .then(setPreview)
    }
  }, [propostaId, arquivo.id, arquivo.tipo])

  if (arquivo.tipo === 'pdf') {
    return (
      <iframe
        src={`/api/propostas-comerciais/${propostaId}/arquivos/${arquivo.id}?modo=preview`}
        className="h-full w-full rounded-lg border border-border-grey"
        title={arquivo.nomeArquivo}
      />
    )
  }

  if (arquivo.tipo === 'docx') {
    return (
      <iframe
        src={`/api/propostas-comerciais/${propostaId}/arquivos/${arquivo.id}/preview`}
        className="h-full w-full rounded-lg border border-border-grey bg-white"
        title={arquivo.nomeArquivo}
      />
    )
  }

  // xlsx / csv
  if (!preview) {
    return (
      <div className="flex flex-1 items-center justify-center gap-2 text-sm text-mid-grey">
        <Loader2 className="size-4 animate-spin" strokeWidth={2.25} />
        Carregando pré-visualização...
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden rounded-lg border border-border-grey">
      {preview.truncado && (
        <p className="border-b border-border-grey bg-orange-light px-3 py-2 text-xs text-orange-dark">
          Mostrando as primeiras {preview.linhas.length} de {preview.totalLinhas} linhas — baixe o arquivo pra
          ver tudo.
        </p>
      )}
      <div className="overflow-auto">
        <table className="table-institucional">
          <thead>
            <tr>
              {preview.cabecalho.map((coluna, i) => (
                <th key={i}>{coluna}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {preview.linhas.map((linha, i) => (
              <tr key={i}>
                {linha.map((valor, j) => (
                  <td key={j}>{valor}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/** Botão que abre os arquivos originais — um único arquivo abre direto; mais
 *  de um vira um menu (não faz sentido listar tudo permanentemente na tela,
 *  isso só ocupava espaço sem servir de navegação de verdade). */
export function MenuArquivosOriginais({
  arquivos,
  onAbrir,
  onRemover,
}: {
  arquivos: ArquivoOriginal[]
  onAbrir: (arquivo: ArquivoOriginal) => void
  onRemover?: (arquivo: ArquivoOriginal) => void
}) {
  const [aberto, setAberto] = useState(false)

  if (arquivos.length === 0) return null

  if (arquivos.length === 1) {
    return (
      <button type="button" onClick={() => onAbrir(arquivos[0])} className={BTN_OUTLINE}>
        <FileText className="size-3.5" strokeWidth={2.25} />
        Arquivo original
      </button>
    )
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setAberto((a) => !a)}
        aria-haspopup="menu"
        aria-expanded={aberto}
        className={BTN_OUTLINE}
      >
        <FileText className="size-3.5" strokeWidth={2.25} />
        Arquivos originais ({arquivos.length})
        <ChevronDown className={cn('size-3.5 transition-transform duration-150', aberto && 'rotate-180')} strokeWidth={2.25} />
      </button>

      {aberto && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setAberto(false)} />
          <div
            role="menu"
            className="absolute right-0 top-full z-50 mt-1.5 w-72 rounded-xl border border-border-grey bg-white p-1.5 shadow-lg"
          >
            {arquivos.map((arquivo) => (
              <div
                key={arquivo.id}
                role="menuitem"
                tabIndex={0}
                onClick={() => {
                  onAbrir(arquivo)
                  setAberto(false)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    onAbrir(arquivo)
                    setAberto(false)
                  }
                }}
                className="group flex cursor-pointer items-center gap-1 rounded-lg pr-1 text-sm text-navy transition-colors hover:bg-orange-light/40"
              >
                <span className="flex min-w-0 flex-1 items-center gap-2.5 py-2 pl-2.5">
                  <IconePorTipo tipo={arquivo.tipo} />
                  <span className="min-w-0 flex-1 truncate">{arquivo.nomeArquivo}</span>
                </span>
                {onRemover && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onRemover(arquivo)
                    }}
                    aria-label={`Remover ${arquivo.nomeArquivo}`}
                    title="Remover arquivo"
                    className="flex size-6 shrink-0 items-center justify-center rounded-md text-mid-grey opacity-0 transition-colors group-hover:opacity-100 hover:bg-red-crit-light hover:text-red-crit focus-visible:opacity-100"
                  >
                    <X className="size-3.5" strokeWidth={2.25} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

/** Modal que abre um arquivo original — usado tanto pelo editor de rascunho
 *  quanto pela tela final. */
export function ModalArquivoOriginal({
  propostaId,
  arquivo,
  onFechar,
}: {
  propostaId: string
  arquivo: ArquivoOriginal
  onFechar: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/50 p-4 backdrop-blur-sm">
      <div className="flex h-[85vh] w-full max-w-4xl flex-col gap-3 rounded-2xl bg-white p-4 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-navy">
            <IconePorTipo tipo={arquivo.tipo} />
            {arquivo.nomeArquivo}
          </h2>
          <div className="flex items-center gap-1">
            <a
              href={`/api/propostas-comerciais/${propostaId}/arquivos/${arquivo.id}`}
              download={arquivo.nomeArquivo}
              aria-label={`Baixar ${arquivo.nomeArquivo}`}
              title="Baixar arquivo original"
              className="flex size-7 items-center justify-center rounded-md text-mid-grey transition-colors hover:bg-navy/[0.06] hover:text-navy"
            >
              <Download className="size-4" strokeWidth={2.25} />
            </a>
            <button
              type="button"
              onClick={onFechar}
              aria-label="Fechar"
              className="flex size-7 items-center justify-center rounded-md text-mid-grey transition-colors hover:bg-navy/[0.06] hover:text-navy"
            >
              <X className="size-4" strokeWidth={2.25} />
            </button>
          </div>
        </div>
        <ConteudoArquivoOriginal propostaId={propostaId} arquivo={arquivo} />
      </div>
    </div>
  )
}
