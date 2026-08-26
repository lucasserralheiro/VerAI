'use client'

import { use, useEffect, useState } from 'react'
import { Loader2, AlertCircle } from 'lucide-react'
import { EditorMarkdown } from './editor-markdown'
import { PropostaFinal } from './proposta-final'

interface PropostaComercialDetalhe {
  id: string
  nomeArquivo: string
  status: 'rascunho' | 'concluido' | 'erro'
  mensagemErro: string | null
  conteudoMarkdown: string | null
}

export default function PropostaComercialDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [proposta, setProposta] = useState<PropostaComercialDetalhe | null>(null)
  const [modoEdicao, setModoEdicao] = useState(false)

  async function carregar() {
    const response = await fetch(`/api/propostas-comerciais/${id}`)
    if (response.ok) setProposta(await response.json())
  }

  useEffect(() => {
    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function handleSalvar(markdown: string) {
    const response = await fetch(`/api/propostas-comerciais/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conteudoMarkdown: markdown }),
    })
    if (response.ok) {
      await carregar()
      setModoEdicao(false)
    }
  }

  if (!proposta) {
    return (
      <main className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
        <p className="flex items-center gap-2 text-sm text-mid-grey">
          <Loader2 className="size-4 animate-spin" strokeWidth={2.25} />
          Carregando...
        </p>
      </main>
    )
  }

  const mostrarEditor = proposta.status === 'rascunho' || (proposta.status === 'concluido' && modoEdicao)
  const mostrarFinal = proposta.status === 'concluido' && !modoEdicao

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-6 py-8 lg:px-8">
      <div>
        <h1 className="text-xl font-bold text-navy">{proposta.nomeArquivo}</h1>
      </div>

      {proposta.status === 'erro' && (
        <p className="flex items-center gap-2 rounded-lg bg-red-crit-light p-3 text-sm text-red-crit">
          <AlertCircle className="size-4 shrink-0" strokeWidth={2.25} />
          {proposta.mensagemErro}
        </p>
      )}

      {mostrarEditor && (
        <EditorMarkdown propostaId={proposta.id} conteudoInicial={proposta.conteudoMarkdown ?? ''} onSalvar={handleSalvar} />
      )}

      {mostrarFinal && (
        <PropostaFinal conteudoMarkdown={proposta.conteudoMarkdown ?? ''} onEditarNovamente={() => setModoEdicao(true)} />
      )}
    </main>
  )
}
