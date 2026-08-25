'use client'

import { use, useEffect, useState } from 'react'
import { Loader2, AlertCircle } from 'lucide-react'
import { EditorMarkdown } from './editor-markdown'
import { MarkdownFinal } from './markdown-final'

interface DocumentoSeiDetalhe {
  id: string
  nomeArquivo: string
  status: 'rascunho' | 'concluido' | 'erro'
  mensagemErro: string | null
  conteudoMarkdown: string | null
  cliente: { nome: string }
  uploadedBy: { nome: string }
}

export default function DocumentoSeiDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [documentoSei, setDocumentoSei] = useState<DocumentoSeiDetalhe | null>(null)

  async function carregar() {
    const response = await fetch(`/api/documentos-sei/${id}`)
    if (response.ok) setDocumentoSei(await response.json())
  }

  useEffect(() => {
    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function handleSalvar(markdown: string) {
    const response = await fetch(`/api/documentos-sei/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conteudoMarkdown: markdown }),
    })
    if (response.ok) await carregar()
  }

  if (!documentoSei) {
    return (
      <main className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
        <p className="flex items-center gap-2 text-sm text-mid-grey">
          <Loader2 className="size-4 animate-spin" strokeWidth={2.25} />
          Carregando...
        </p>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-6 py-8 lg:px-8">
      <div>
        <h1 className="text-xl font-bold text-navy">{documentoSei.nomeArquivo}</h1>
        <p className="text-sm text-mid-grey">
          {documentoSei.cliente.nome} · enviado por {documentoSei.uploadedBy.nome}
        </p>
      </div>

      {documentoSei.status === 'erro' && (
        <p className="flex items-center gap-2 rounded-lg bg-red-crit-light p-3 text-sm text-red-crit">
          <AlertCircle className="size-4 shrink-0" strokeWidth={2.25} />
          {documentoSei.mensagemErro}
        </p>
      )}

      {documentoSei.status === 'rascunho' && (
        <EditorMarkdown
          documentoId={documentoSei.id}
          conteudoInicial={documentoSei.conteudoMarkdown ?? ''}
          onSalvar={handleSalvar}
        />
      )}

      {documentoSei.status === 'concluido' && (
        <MarkdownFinal conteudoMarkdown={documentoSei.conteudoMarkdown ?? ''} />
      )}
    </main>
  )
}
