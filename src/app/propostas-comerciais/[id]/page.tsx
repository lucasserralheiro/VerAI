'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, AlertCircle, Trash2 } from 'lucide-react'
import { EditorMarkdown } from './editor-markdown'
import { PropostaFinal } from './proposta-final'
import { extrairTituloProposta } from '@/lib/extrairTituloProposta'

interface ArquivoOriginal {
  id: string
  nomeArquivo: string
  tipo: string
}

interface PropostaComercialDetalhe {
  id: string
  nomeArquivo: string
  status: 'rascunho' | 'concluido' | 'erro'
  mensagemErro: string | null
  conteudoMarkdown: string | null
  arquivos: ArquivoOriginal[]
}

export default function PropostaComercialDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [proposta, setProposta] = useState<PropostaComercialDetalhe | null>(null)
  const [modoEdicao, setModoEdicao] = useState(false)
  const [excluindo, setExcluindo] = useState(false)

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

  async function handleExcluir() {
    if (!proposta) return
    const titulo = extrairTituloProposta(proposta.conteudoMarkdown, proposta.nomeArquivo)
    if (!confirm(`Excluir "${titulo}"? Essa ação não pode ser desfeita.`)) return
    setExcluindo(true)
    const response = await fetch(`/api/propostas-comerciais/${id}`, { method: 'DELETE' })
    setExcluindo(false)
    if (!response.ok) {
      const body = await response.json().catch(() => null)
      alert(body?.error ?? 'Falha ao excluir proposta.')
      return
    }
    router.push('/propostas-comerciais')
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
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-0.5">
          <h1 className="text-xl font-bold text-navy">
            {extrairTituloProposta(proposta.conteudoMarkdown, proposta.nomeArquivo)}
          </h1>
          <p className="text-xs text-mid-grey">
            {proposta.arquivos.length > 1
              ? `Gerada a partir de ${proposta.arquivos.length} arquivos enviados`
              : `Gerada a partir de "${proposta.nomeArquivo}"`}
          </p>
        </div>
        <button
          type="button"
          onClick={handleExcluir}
          disabled={excluindo}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-red-crit/30 bg-white px-3.5 py-2 text-sm font-medium text-red-crit shadow-xs transition-all duration-150 hover:border-red-crit hover:bg-red-crit-light disabled:pointer-events-none disabled:opacity-50"
        >
          <Trash2 className="size-3.5" strokeWidth={2.25} />
          {excluindo ? 'Excluindo...' : 'Excluir proposta'}
        </button>
      </div>

      {proposta.status === 'erro' && (
        <p className="flex items-center gap-2 rounded-lg bg-red-crit-light p-3 text-sm text-red-crit">
          <AlertCircle className="size-4 shrink-0" strokeWidth={2.25} />
          {proposta.mensagemErro}
        </p>
      )}

      {mostrarEditor && (
        <EditorMarkdown
          propostaId={proposta.id}
          conteudoInicial={proposta.conteudoMarkdown ?? ''}
          arquivosOriginais={proposta.arquivos}
          onSalvar={handleSalvar}
        />
      )}

      {mostrarFinal && (
        <PropostaFinal
          propostaId={proposta.id}
          conteudoMarkdown={proposta.conteudoMarkdown ?? ''}
          onEditarNovamente={() => setModoEdicao(true)}
          onUsarCorrecoes={handleSalvar}
        />
      )}
    </main>
  )
}
