'use client'

import { useEffect, useRef, useState } from 'react'
import { AlertCircle, ClipboardCheck, ClipboardCopy, FileCode2, FileText, Loader2 } from 'lucide-react'
import { BTN_OUTLINE, BTN_PRIMARY } from '@/lib/ui'
import { cn } from '@/lib/utils'
import { copiarMarkdownFormatado } from '@/lib/copiarMarkdownFormatado'
import { extrairTituloProposta } from '@/lib/extrairTituloProposta'
import {
  carregarPreferenciaFonte,
  pilhaDaFonte,
  salvarPreferenciaFonte,
  PREFERENCIA_PADRAO,
  type PreferenciaFonte,
  type TamanhoCorpo,
} from '@/lib/preferenciaFonteProposta'
import { ArquivoOriginal, ModalArquivoOriginal } from './arquivos-originais'
import { BotaoExcluirProposta, CabecalhoProposta } from './cabecalho-proposta'
import { ConteudoEditavelProposta } from './conteudo-editavel-proposta'
import { PainelChecagemConversao } from './painel-checagem-conversao'
import { SeletorFonteProposta } from './seletor-fonte-proposta'

/** Espera depois da última mudança antes de gravar sozinho. */
export const AUTOSAVE_MS = 1500

type Salvamento =
  | { fase: 'salvo'; em: Date | null }
  | { fase: 'pendente' }
  | { fase: 'salvando' }
  | { fase: 'erro'; mensagem: string }

export interface EspacoPropostaProps {
  propostaId: string
  conteudoInicial: string
  nomeArquivo: string
  /** Linha abaixo do título ("Gerada a partir de ..."). */
  subtitulo: string
  arquivos: ArquivoOriginal[]
  /** Grava o Markdown. Tem que REJEITAR quando falhar — é assim que o
   *  indicador de salvamento sabe que deu erro. */
  onSalvar: (markdown: string) => Promise<void>
  onExcluir: () => void
  excluindo?: boolean
}

/**
 * Tela única da Proposta Comercial (rascunho e concluída usam a mesma):
 *
 * - à esquerda, o documento — é o que a pessoa está produzindo, então ocupa
 *   a coluna principal e rola com a página (sem caixa com rolagem própria);
 * - à direita, o painel de revisão, fixo ao rolar: checagem da conversão
 *   (OCR, correções prontas, pontos pra conferir) e revisão de português,
 *   juntas no mesmo card por serem o mesmo padrão de "achou, confere, aplica".
 *
 * Salvamento é sempre automático: edição manual grava `AUTOSAVE_MS` depois
 * da última tecla; correção da IA, revisão de português e OCR gravam na hora.
 * O indicador na barra do documento mostra Salvando / Salvo / erro com
 * "Tentar de novo" — não existe mais botão Salvar.
 */
export function EspacoProposta({
  propostaId,
  conteudoInicial,
  nomeArquivo,
  subtitulo,
  arquivos,
  onSalvar,
  onExcluir,
  excluindo,
}: EspacoPropostaProps) {
  const [markdown, setMarkdown] = useState(conteudoInicial)
  const [salvamento, setSalvamento] = useState<Salvamento>({ fase: 'salvo', em: null })
  const [arquivoAberto, setArquivoAberto] = useState<{
    arquivo: ArquivoOriginal
    pagina?: number
    destaque?: string
    /** Some ao fechar o modal — quem abriu (a checagem) recebe o texto selecionado. */
    onUsarSelecao?: (texto: string) => void
  } | null>(null)
  const [modoTexto, setModoTexto] = useState(false)
  const [copiado, setCopiado] = useState(false)
  const [preferenciaFonte, setPreferenciaFonte] = useState<PreferenciaFonte>(PREFERENCIA_PADRAO)

  const markdownRef = useRef(conteudoInicial)
  const ultimoSalvoRef = useRef(conteudoInicial)
  const filaRef = useRef<Promise<void>>(Promise.resolve())
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onSalvarRef = useRef(onSalvar)
  const montado = useRef(true)

  useEffect(() => {
    onSalvarRef.current = onSalvar
  }, [onSalvar])

  // Carrega a preferência salva só depois de montar (localStorage não existe
  // no SSR) — evita divergência entre o HTML do servidor e o do cliente.
  useEffect(() => {
    setPreferenciaFonte(carregarPreferenciaFonte())
  }, [])

  useEffect(() => {
    montado.current = true
    return () => {
      montado.current = false
      // Saiu da tela com edição esperando o debounce: grava na hora.
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
        const texto = markdownRef.current
        if (texto !== ultimoSalvoRef.current && texto.trim()) onSalvarRef.current(texto).catch(() => {})
      }
    }
  }, [])

  const temPendencia = salvamento.fase !== 'salvo'
  useEffect(() => {
    if (!temPendencia) return
    function handler(e: BeforeUnloadEvent) {
      e.preventDefault()
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [temPendencia])

  /** Grava `texto` agora. As gravações entram numa fila — nunca duas ao
   *  mesmo tempo, e a mais nova sempre chega por último no servidor. */
  function salvar(texto: string): Promise<void> {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    const execucao = filaRef.current.then(async () => {
      if (texto === ultimoSalvoRef.current) {
        if (montado.current && markdownRef.current === texto) {
          setSalvamento((s) => (s.fase === 'salvo' ? s : { fase: 'salvo', em: null }))
        }
        return
      }
      if (!texto.trim()) {
        const mensagem = 'Documento vazio não é salvo.'
        if (montado.current) setSalvamento({ fase: 'erro', mensagem })
        throw new Error(mensagem)
      }
      if (montado.current) setSalvamento({ fase: 'salvando' })
      try {
        await onSalvarRef.current(texto)
      } catch (erro) {
        if (montado.current) {
          setSalvamento({ fase: 'erro', mensagem: erro instanceof Error ? erro.message : 'Não foi possível salvar.' })
        }
        throw erro
      }
      ultimoSalvoRef.current = texto
      if (montado.current) {
        // Se a pessoa continuou digitando enquanto gravava, ainda tem pendência.
        setSalvamento(markdownRef.current === texto ? { fase: 'salvo', em: new Date() } : { fase: 'pendente' })
      }
    })
    filaRef.current = execucao.catch(() => {})
    return execucao
  }

  /** Edição manual: atualiza na hora e grava depois de uma pausa. */
  function mudar(texto: string) {
    setMarkdown(texto)
    markdownRef.current = texto
    if (timerRef.current) clearTimeout(timerRef.current)
    setSalvamento({ fase: 'pendente' })
    timerRef.current = setTimeout(() => {
      timerRef.current = null
      salvar(markdownRef.current).catch(() => {})
    }, AUTOSAVE_MS)
  }

  /** Mudança vinda da IA/OCR: atualiza e grava na hora. Rejeita se falhar. */
  function mudarESalvar(texto: string): Promise<void> {
    setMarkdown(texto)
    markdownRef.current = texto
    return salvar(texto)
  }

  async function handleCopiarFormatado() {
    await copiarMarkdownFormatado(markdown, {
      familia: pilhaDaFonte(preferenciaFonte.fonte),
      tamanhoCorpo: preferenciaFonte.tamanhoCorpo,
    })
    setCopiado(true)
    setTimeout(() => {
      if (montado.current) setCopiado(false)
    }, 2000)
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

  // Página citada pela checagem abre direto no PDF, com o trecho destacado —
  // só quando dá pra saber de qual arquivo é (um PDF só).
  const pdfs = arquivos.filter((a) => a.tipo === 'pdf')
  const verPaginaNoOriginal =
    pdfs.length === 1
      ? (pagina: number, destaque?: string, onUsarSelecao?: (texto: string) => void) =>
          setArquivoAberto({ arquivo: pdfs[0], pagina, destaque, onUsarSelecao })
      : undefined

  return (
    <main className="@container mx-auto max-w-[1600px] space-y-4 px-5 py-5 lg:px-6">
      <CabecalhoProposta
        titulo={extrairTituloProposta(markdown, nomeArquivo)}
        subtitulo={subtitulo}
        acoes={
          <>
            <button type="button" onClick={handleCopiarFormatado} className={BTN_PRIMARY}>
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
            <BotaoExcluirProposta onExcluir={onExcluir} excluindo={excluindo} />
          </>
        }
      />

      <div className="grid items-start gap-4 @4xl:grid-cols-[minmax(0,1fr)_380px] @6xl:grid-cols-[minmax(0,1fr)_440px]">
        <section
          aria-label="Documento"
          className="min-w-0 rounded-lg border border-border-grey bg-white transition-colors focus-within:border-navy/30"
        >
          <div className="sticky top-0 z-10 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-t-lg border-b border-border-grey bg-white/95 px-5 py-3 backdrop-blur-sm">
            <StatusSalvamento
              salvamento={salvamento}
              onTentarDeNovo={() => salvar(markdownRef.current).catch(() => {})}
            />
            <div className="ml-auto flex shrink-0 items-center gap-4">
              <SeletorFonteProposta
                preferencia={preferenciaFonte}
                onMudarFonte={handleMudarFonte}
                onMudarTamanho={handleMudarTamanho}
              />
              <span aria-hidden className="h-5 w-px bg-border-grey" />
              <button
                type="button"
                onClick={() => setModoTexto((v) => !v)}
                aria-pressed={modoTexto}
                title={modoTexto ? 'Voltar pra edição visual' : 'Editar o Markdown direto — quando a edição visual não der conta'}
                className={cn(BTN_OUTLINE, 'h-8 py-0', modoTexto && 'border-navy/35 bg-navy/[0.06]')}
              >
                {modoTexto ? (
                  <FileText className="size-3.5" strokeWidth={2.25} />
                ) : (
                  <FileCode2 className="size-3.5" strokeWidth={2.25} />
                )}
                {modoTexto ? 'Voltar ao documento' : 'Editar como texto'}
              </button>
            </div>
          </div>

          {modoTexto ? (
            <textarea
              aria-label="Editar como texto"
              value={markdown}
              onChange={(e) => mudar(e.target.value)}
              spellCheck={false}
              className="block min-h-[70vh] w-full resize-y rounded-b-lg px-5 py-4 font-mono text-sm leading-relaxed text-navy outline-none"
            />
          ) : (
            <ConteudoEditavelProposta
              markdown={markdown}
              onChange={mudar}
              fonte={pilhaDaFonte(preferenciaFonte.fonte)}
              tamanhoCorpo={preferenciaFonte.tamanhoCorpo}
              className="overflow-x-auto rounded-b-lg px-6 py-6 sm:px-10 sm:py-8"
            />
          )}
        </section>

        {/* Painel só com resumo e botões — as comparações abrem numa janela
            larga (JanelaRevisao). A checagem por IA cobre fidelidade ao PDF
            E ortografia/acentuação numa chamada só (antes a revisão de
            português era uma tela e uma chamada à parte). */}
        <aside
          aria-label="Revisão"
          className="order-first flex min-w-0 flex-col overflow-y-auto overscroll-contain rounded-lg border border-border-grey bg-white p-4 @4xl:sticky @4xl:top-4 @4xl:order-none @4xl:max-h-[calc(100vh-2rem)]"
        >
          <div className="space-y-4">
            <PainelChecagemConversao
              propostaId={propostaId}
              conteudoMarkdown={markdown}
              onConteudoAtualizado={mudarESalvar}
              onVerPagina={verPaginaNoOriginal}
            />
          </div>
        </aside>
      </div>

      {arquivoAberto && (
        <ModalArquivoOriginal
          propostaId={propostaId}
          arquivo={arquivoAberto.arquivo}
          pagina={arquivoAberto.pagina}
          destaque={arquivoAberto.destaque}
          onUsarSelecao={
            arquivoAberto.onUsarSelecao &&
            ((texto: string) => {
              // Fecha o modal do PDF na hora — a pessoa volta pra checagem já com o texto.
              arquivoAberto.onUsarSelecao?.(texto)
              setArquivoAberto(null)
            })
          }
          onFechar={() => setArquivoAberto(null)}
        />
      )}
    </main>
  )
}

function StatusSalvamento({ salvamento, onTentarDeNovo }: { salvamento: Salvamento; onTentarDeNovo: () => void }) {
  // "Salvo" parado não avisa nada de útil (é o estado normal, a maior parte
  // do tempo) — só ocupa espaço na barra. Só aparece o que precisa de
  // atenção: salvando, alteração pendente ou erro.
  if (salvamento.fase === 'salvo') return null

  return (
    <p role="status" aria-live="polite" className="flex min-w-0 flex-1 items-center gap-1.5 px-1 text-xs">
      {salvamento.fase === 'salvando' && (
        <span className="inline-flex items-center gap-1.5 text-mid-grey">
          <Loader2 className="size-3.5 animate-spin" strokeWidth={2.25} />
          Salvando...
        </span>
      )}
      {salvamento.fase === 'pendente' && (
        <span className="inline-flex items-center gap-1.5 text-mid-grey">
          <span aria-hidden className="size-1.5 rounded-full bg-orange" />
          Alterações não salvas
        </span>
      )}
      {salvamento.fase === 'erro' && (
        <span className="inline-flex flex-wrap items-center gap-x-1.5 text-red-crit">
          <AlertCircle className="size-3.5 shrink-0" strokeWidth={2.25} />
          {salvamento.mensagem}
          <button type="button" onClick={onTentarDeNovo} className="font-semibold underline underline-offset-2">
            Tentar de novo
          </button>
        </span>
      )}
    </p>
  )
}
