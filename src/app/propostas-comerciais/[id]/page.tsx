'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, AlertCircle } from 'lucide-react'
import { extrairTituloProposta } from '@/lib/extrairTituloProposta'
import { EspacoProposta } from './espaco-proposta'
import { BotaoExcluirProposta, CabecalhoProposta } from './cabecalho-proposta'

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
  const [excluindo, setExcluindo] = useState(false)

  useEffect(() => {
    let ativo = true
    fetch(`/api/propostas-comerciais/${id}`).then(async (response) => {
      if (ativo && response.ok) setProposta(await response.json())
    })
    return () => {
      ativo = false
    }
  }, [id])

  /**
   * Chamado pelo salvamento automático do `EspacoProposta`. Não recarrega a
   * proposta inteira: o editor já tem o texto (e pode ter mais digitação
   * depois do que foi enviado) — aqui só guarda o que o servidor devolveu
   * (status pode ir de rascunho pra concluído quando o OCR termina).
   * Rejeita em caso de falha, pro indicador de salvamento mostrar o erro.
   */
  async function handleSalvar(markdown: string) {
    const response = await fetch(`/api/propostas-comerciais/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conteudoMarkdown: markdown }),
    })
    if (!response.ok) {
      const body = await response.json().catch(() => null)
      throw new Error(body?.error ?? 'Não foi possível salvar.')
    }
    const atualizada = await response.json().catch(() => null)
    setProposta((atual) =>
      atual
        ? {
            ...atual,
            status: atualizada?.status ?? atual.status,
            conteudoMarkdown: atualizada?.conteudoMarkdown ?? markdown,
          }
        : atual
    )
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

  const subtitulo =
    proposta.arquivos.length > 1
      ? `Gerada a partir de ${proposta.arquivos.length} arquivos enviados`
      : `Gerada a partir de "${proposta.nomeArquivo}"`

  if (proposta.status === 'erro') {
    return (
      <main className="mx-auto max-w-5xl space-y-5 px-6 py-6 lg:px-8">
        <CabecalhoProposta
          titulo={extrairTituloProposta(proposta.conteudoMarkdown, proposta.nomeArquivo)}
          subtitulo={subtitulo}
          acoes={<BotaoExcluirProposta onExcluir={handleExcluir} excluindo={excluindo} />}
        />
        <p className="flex items-center gap-2 rounded-lg border border-red-crit/30 bg-red-crit-light p-4 text-sm text-red-crit">
          <AlertCircle className="size-4 shrink-0" strokeWidth={2.25} />
          {proposta.mensagemErro ?? 'Não foi possível processar esta proposta.'}
        </p>
      </main>
    )
  }

  return (
    <EspacoProposta
      key={proposta.id}
      propostaId={proposta.id}
      conteudoInicial={proposta.conteudoMarkdown ?? ''}
      subtitulo={subtitulo}
      nomeArquivo={proposta.nomeArquivo}
      arquivos={proposta.arquivos}
      onSalvar={handleSalvar}
      onExcluir={handleExcluir}
      excluindo={excluindo}
    />
  )
}
