'use client'

import { useEffect, useState } from 'react'
import { ClipboardCopy, ClipboardCheck, Sparkles } from 'lucide-react'
import { BTN_PRIMARY, BTN_OUTLINE } from '@/lib/ui'
import { cn } from '@/lib/utils'
import { copiarMarkdownFormatado } from '@/lib/copiarMarkdownFormatado'
import {
  carregarPreferenciaFonte,
  pilhaDaFonte,
  salvarPreferenciaFonte,
  PREFERENCIA_PADRAO,
  type PreferenciaFonte,
  type TamanhoCorpo,
} from '@/lib/preferenciaFonteProposta'
import { ConteudoEditavelProposta } from './conteudo-editavel-proposta'
import { EditarComoTexto } from './editar-como-texto'
import { PainelRevisaoPortugues } from './painel-revisao-portugues'
import { SeletorFonteProposta } from './seletor-fonte-proposta'
import { ArquivoOriginal, MenuArquivosOriginais, ModalArquivoOriginal } from './arquivos-originais'

export interface PropostaFinalProps {
  propostaId: string
  conteudoMarkdown: string
  arquivos: ArquivoOriginal[]
  onSalvar: (markdown: string) => Promise<void>
}

export function PropostaFinal({ propostaId, conteudoMarkdown, arquivos, onSalvar }: PropostaFinalProps) {
  const [markdown, setMarkdown] = useState(conteudoMarkdown)
  const [sujo, setSujo] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [copiado, setCopiado] = useState(false)
  const [aba, setAba] = useState<'visualizar' | 'correcao'>('visualizar')
  const [arquivoAberto, setArquivoAberto] = useState<ArquivoOriginal | null>(null)
  const [preferenciaFonte, setPreferenciaFonte] = useState<PreferenciaFonte>(PREFERENCIA_PADRAO)

  // Carrega a preferência salva só depois de montar (localStorage não existe
  // no SSR) — evita divergência entre o HTML do servidor e o do cliente.
  useEffect(() => {
    setPreferenciaFonte(carregarPreferenciaFonte())
  }, [])

  useEffect(() => {
    setMarkdown(conteudoMarkdown)
    setSujo(false)
  }, [conteudoMarkdown])

  useEffect(() => {
    if (!sujo) return
    function handler(e: BeforeUnloadEvent) {
      e.preventDefault()
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [sujo])

  function handleMudarTexto(novoMarkdown: string) {
    setMarkdown(novoMarkdown)
    setSujo(true)
  }

  async function handleSalvar() {
    setSalvando(true)
    await onSalvar(markdown)
    setSalvando(false)
    setSujo(false)
  }

  async function handleCopiarFormatado() {
    await copiarMarkdownFormatado(markdown, {
      familia: pilhaDaFonte(preferenciaFonte.fonte),
      tamanhoCorpo: preferenciaFonte.tamanhoCorpo,
    })
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  function handleMudarFonte(fonte: string) {
    const nova = { ...preferenciaFonte, fonte }
    setPreferenciaFonte(nova)
    salvarPreferenciaFonte(nova)
  }

  function handleMudarTamanho(tamanhoCorpo: TamanhoCorpo) {
    const nova = { ...preferenciaFonte, tamanhoCorpo }
    setPreferenciaFonte(nova)
    salvarPreferenciaFonte(nova)
  }

  function handleUsarCorrecoes(corrigido: string) {
    setMarkdown(corrigido)
    setSujo(true)
    setAba('visualizar')
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
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

        <div className="flex flex-wrap items-center gap-2">
          <SeletorFonteProposta
            preferencia={preferenciaFonte}
            onMudarFonte={handleMudarFonte}
            onMudarTamanho={handleMudarTamanho}
          />
          <MenuArquivosOriginais arquivos={arquivos} onAbrir={setArquivoAberto} />
          <button type="button" onClick={handleCopiarFormatado} className={BTN_OUTLINE}>
            {copiado ? (
              <>
                <ClipboardCheck className="size-3.5" strokeWidth={2.25} />
                Copiado!
              </>
            ) : (
              <>
                <ClipboardCopy className="size-3.5" strokeWidth={2.25} />
                Copiar formatado
              </>
            )}
          </button>
          {sujo && (
            <button type="button" onClick={handleSalvar} disabled={salvando} className={BTN_PRIMARY}>
              {salvando ? 'Salvando...' : 'Salvar alterações'}
            </button>
          )}
        </div>
      </div>

      {aba === 'visualizar' && (
        <div className="space-y-1.5">
          <ConteudoEditavelProposta
            markdown={markdown}
            onChange={handleMudarTexto}
            fonte={pilhaDaFonte(preferenciaFonte.fonte)}
            tamanhoCorpo={preferenciaFonte.tamanhoCorpo}
          />
          <EditarComoTexto markdown={markdown} onChange={handleMudarTexto} />
        </div>
      )}

      {aba === 'correcao' && (
        <PainelRevisaoPortugues propostaId={propostaId} markdownAtual={markdown} onUsarCorrecoes={handleUsarCorrecoes} />
      )}

      {arquivoAberto && (
        <ModalArquivoOriginal propostaId={propostaId} arquivo={arquivoAberto} onFechar={() => setArquivoAberto(null)} />
      )}
    </div>
  )
}
