'use client'

import { useEffect, useState } from 'react'
import { ClipboardCheck, ClipboardCopy, Sparkles } from 'lucide-react'
import { BTN_PRIMARY } from '@/lib/ui'
import { cn } from '@/lib/utils'
import { copiarMarkdownFormatado } from '@/lib/copiarMarkdownFormatado'
import { PainelRevisaoPortugues } from './painel-revisao-portugues'
import { ArquivoOriginal, MenuArquivosOriginais, ModalArquivoOriginal } from './arquivos-originais'
import { ConteudoEditavelProposta } from './conteudo-editavel-proposta'
import { EditarComoTexto } from './editar-como-texto'

export interface EditorMarkdownProps {
  propostaId: string
  conteudoInicial: string
  arquivosOriginais: ArquivoOriginal[]
  onSalvar: (markdown: string) => Promise<void>
}

export function EditorMarkdown({ propostaId, conteudoInicial, arquivosOriginais, onSalvar }: EditorMarkdownProps) {
  const [texto, setTexto] = useState(conteudoInicial)
  const [arquivos, setArquivos] = useState(arquivosOriginais)
  const [aba, setAba] = useState<'visualizar' | 'correcao'>('visualizar')
  const [arquivoAberto, setArquivoAberto] = useState<ArquivoOriginal | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [copiado, setCopiado] = useState(false)

  useEffect(() => {
    setArquivos(arquivosOriginais)
  }, [arquivosOriginais])

  async function handleSalvar() {
    setSalvando(true)
    await onSalvar(texto)
    setSalvando(false)
  }

  async function handleCopiarFormatado() {
    await copiarMarkdownFormatado(texto)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  async function handleRemoverArquivo(arquivo: ArquivoOriginal) {
    if (
      !confirm(
        `Remover "${arquivo.nomeArquivo}" dos arquivos originais desta proposta? O texto já gerado não é alterado automaticamente — se precisar, ajuste manualmente o conteúdo.`
      )
    ) {
      return
    }
    const response = await fetch(`/api/propostas-comerciais/${propostaId}/arquivos/${arquivo.id}`, {
      method: 'DELETE',
    })
    if (!response.ok) {
      const body = await response.json().catch(() => null)
      alert(body?.error ?? 'Falha ao remover arquivo.')
      return
    }
    setArquivos((prev) => prev.filter((a) => a.id !== arquivo.id))
    setArquivoAberto((atual) => (atual?.id === arquivo.id ? null : atual))
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-mid-grey">Revise o conteúdo da proposta e ajuste o que precisar antes de salvar.</p>
        <div className="flex flex-wrap gap-2">
          <MenuArquivosOriginais
            arquivos={arquivos}
            onAbrir={setArquivoAberto}
            onRemover={arquivos.length > 1 ? handleRemoverArquivo : undefined}
          />
          <button type="button" onClick={handleSalvar} disabled={salvando} className={BTN_PRIMARY}>
            {salvando ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border border-border-grey bg-light-grey/60 p-0.5">
          <button
            type="button"
            onClick={() => setAba('visualizar')}
            className={cn(
              'rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors',
              aba === 'visualizar' ? 'bg-white text-navy shadow-xs' : 'text-mid-grey hover:text-navy'
            )}
          >
            Visualizar
          </button>
          <button
            type="button"
            onClick={() => setAba('correcao')}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors',
              aba === 'correcao' ? 'bg-white text-navy shadow-xs' : 'text-mid-grey hover:text-navy'
            )}
          >
            <Sparkles className="size-3.5" strokeWidth={2.25} />
            Correção da IA
          </button>
        </div>

        <button
          type="button"
          onClick={handleCopiarFormatado}
          className={cn(
            'inline-flex shrink-0 items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-md transition-all duration-150 active:scale-[0.98]',
            copiado
              ? 'bg-green-ok shadow-green-ok/25'
              : 'bg-orange shadow-orange/25 hover:bg-orange-dark hover:shadow-lg hover:shadow-orange/35'
          )}
        >
          {copiado ? (
            <>
              <ClipboardCheck className="size-4" strokeWidth={2.25} />
              Copiado!
            </>
          ) : (
            <>
              <ClipboardCopy className="size-4" strokeWidth={2.25} />
              Copiar formatado
            </>
          )}
        </button>
      </div>

      {aba === 'visualizar' && (
        <div className="space-y-1.5">
          <ConteudoEditavelProposta markdown={texto} onChange={setTexto} />
          <EditarComoTexto markdown={texto} onChange={setTexto} />
        </div>
      )}

      {aba === 'correcao' && (
        <PainelRevisaoPortugues
          propostaId={propostaId}
          markdownAtual={texto}
          onUsarCorrecoes={(corrigido) => {
            setTexto(corrigido)
            setAba('visualizar')
          }}
        />
      )}

      {arquivoAberto && (
        <ModalArquivoOriginal propostaId={propostaId} arquivo={arquivoAberto} onFechar={() => setArquivoAberto(null)} />
      )}
    </div>
  )
}
