'use client'

import { useEffect, useState } from 'react'
import { Download, FileSpreadsheet, FileText, File as FileIcon, Loader2, X } from 'lucide-react'
import { VisualizadorPdfTrecho } from './visualizador-pdf-trecho'

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
function ConteudoArquivoOriginal({
  propostaId,
  arquivo,
  pagina,
  destaque,
  onUsarSelecao,
}: {
  propostaId: string
  arquivo: ArquivoOriginal
  pagina?: number
  destaque?: string
  /** Repassado pro visualizador — ver `VisualizadorPdfTrechoProps.onUsarSelecao`. */
  onUsarSelecao?: (texto: string) => void
}) {
  const [preview, setPreview] = useState<PreviewPlanilha | null>(null)
  // Com página citada, o PDF abre no visualizador do app (acha e destaca o
  // trecho); "Leitor completo" troca pro leitor do navegador.
  const [leitorNavegador, setLeitorNavegador] = useState(false)

  useEffect(() => {
    setPreview(null)
    if (arquivo.tipo === 'xlsx' || arquivo.tipo === 'csv') {
      fetch(`/api/propostas-comerciais/${propostaId}/arquivos/${arquivo.id}/preview`)
        .then((r) => r.json())
        .then(setPreview)
    }
  }, [propostaId, arquivo.id, arquivo.tipo])

  if (arquivo.tipo === 'pdf') {
    if (pagina && !leitorNavegador) {
      return (
        <VisualizadorPdfTrecho
          url={`/api/propostas-comerciais/${propostaId}/arquivos/${arquivo.id}?modo=preview`}
          pagina={pagina}
          destaque={destaque}
          onAbrirLeitorCompleto={() => setLeitorNavegador(true)}
          onUsarSelecao={onUsarSelecao}
        />
      )
    }
    return (
      <iframe
        src={`/api/propostas-comerciais/${propostaId}/arquivos/${arquivo.id}?modo=preview${pagina ? `#page=${pagina}` : ''}`}
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

/** Modal que abre um arquivo original. `pagina` (só PDF) abre direto na
 *  página citada pela checagem — o visualizador do navegador entende `#page=N`. */
export function ModalArquivoOriginal({
  propostaId,
  arquivo,
  pagina,
  destaque,
  onUsarSelecao,
  onFechar,
}: {
  propostaId: string
  arquivo: ArquivoOriginal
  pagina?: number
  /** Texto a destacar na página (trecho suspeito da checagem). */
  destaque?: string
  /** Repassado pro visualizador — ver `VisualizadorPdfTrechoProps.onUsarSelecao`. */
  onUsarSelecao?: (texto: string) => void
  onFechar: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/50 p-4 backdrop-blur-sm">
      <div className="flex h-[90vh] w-full max-w-5xl flex-col gap-3 rounded-2xl bg-white p-4 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-navy">
            <IconePorTipo tipo={arquivo.tipo} />
            {arquivo.nomeArquivo}
            {pagina && arquivo.tipo === 'pdf' && <span className="font-normal text-mid-grey">· página {pagina}</span>}
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
        <ConteudoArquivoOriginal
          propostaId={propostaId}
          arquivo={arquivo}
          pagina={pagina}
          destaque={destaque}
          onUsarSelecao={onUsarSelecao}
        />
      </div>
    </div>
  )
}
