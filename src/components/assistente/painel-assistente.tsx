'use client'

import { useEffect, useRef, useState, type DragEvent, type KeyboardEvent } from 'react'
import {
  ArrowUp,
  Building2,
  CalendarClock,
  FileSearch,
  History,
  Loader2,
  MessageSquare,
  Paperclip,
  Plus,
  RotateCcw,
  Sparkles,
  Square,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { BTN_OUTLINE_SM } from '@/lib/ui'
import { ROTULOS_FERRAMENTAS } from '@/lib/assistente/ferramentas/rotulos'
import { RespostaMarkdown } from './resposta-markdown'
import { CartaoAnexo } from './anexos/cartao-anexo'
import { LIMITE_DA_PERGUNTA, arquivoDoTextoColado, perguntaDoTextoColado } from './anexos/enviar-anexo'
import { useConversaAssistente } from './use-conversa-assistente'

/** Mesmos formatos de `FORMATOS_ANEXO` (`lib/assistente/anexos/tipos.ts`). */
const ACEITOS = '.pdf,.docx,.xlsx,.csv,.txt'

const temArquivos = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files')

/** Ícone de cada sugestão, pela posição (as três listas seguem a mesma ordem de intenção). */
const ICONES_SUGESTAO = [CalendarClock, Building2, FileSearch]

const BTN_ICONE =
  'inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-mid-grey transition-colors hover:bg-navy/[0.06] hover:text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange/40'

interface ConversaResumo {
  id: string
  titulo: string
  atualizadaEm: string
}

function sugestoes(rota: string, comContexto: boolean): string[] {
  if (comContexto && /^\/clientes\/[^/]+\/contratos\//.test(rota)) {
    return ['Qual o saldo deste contrato?', 'Quais aditivos este contrato teve?', 'O que diz o último termo aditivo sobre reajuste?']
  }
  if (comContexto && rota.startsWith('/clientes/')) {
    return ['Resumo deste cliente', 'Quais contratos deste cliente estão ativos?', 'Último faturamento deste cliente']
  }
  return ['Contratos vencendo nos próximos 90 dias', 'Me fale tudo do cliente SMIT', 'Onde aparece o processo SEI 7010.2026/0009635-4?']
}

export function PainelAssistente({ rota, onFechar }: { rota: string; onFechar: () => void }) {
  const conversa = useConversaAssistente()
  const [texto, setTexto] = useState('')
  const [rotulo, setRotulo] = useState<string | null>(null)
  const [usarContexto, setUsarContexto] = useState(true)
  const [historicoAberto, setHistoricoAberto] = useState(false)
  const [conversas, setConversas] = useState<ConversaResumo[]>([])
  const [arrastando, setArrastando] = useState(false)
  const fim = useRef<HTMLDivElement>(null)
  const seletor = useRef<HTMLInputElement>(null)
  const campo = useRef<HTMLTextAreaElement>(null)
  /** Muda a cada troca de conversa: o texto colado cujo anexo falhou só volta ao campo da MESMA conversa. */
  const trocasDeConversa = useRef(0)

  useEffect(() => {
    // Arquivo solto fora do painel (enquanto ele está aberto) seria aberto pelo navegador, saindo do
    // VerAI. Só arraste de arquivos: texto e links continuam com o comportamento normal.
    function segurar(e: globalThis.DragEvent) {
      if (Array.from(e.dataTransfer?.types ?? []).includes('Files')) e.preventDefault()
    }
    window.addEventListener('dragover', segurar)
    window.addEventListener('drop', segurar)
    return () => {
      window.removeEventListener('dragover', segurar)
      window.removeEventListener('drop', segurar)
    }
  }, [])

  // Modal: Esc fecha (primeiro o histórico, se aberto) e a página de trás não rola.
  useEffect(() => {
    function aoEsc(e: globalThis.KeyboardEvent) {
      if (e.key !== 'Escape') return
      e.preventDefault()
      if (historicoAberto) setHistoricoAberto(false)
      else onFechar()
    }
    window.addEventListener('keydown', aoEsc)
    return () => window.removeEventListener('keydown', aoEsc)
  }, [historicoAberto, onFechar])

  useEffect(() => {
    const anterior = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    campo.current?.focus()
    return () => {
      document.body.style.overflow = anterior
    }
  }, [])

  // Campo cresce com o texto até ~8 linhas.
  useEffect(() => {
    const el = campo.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }, [texto])

  useEffect(() => {
    setUsarContexto(true)
    let cancelado = false
    fetch(`/api/assistente/contexto?rota=${encodeURIComponent(rota)}`)
      .then((r) => (r.ok ? r.json() : { rotulo: null }))
      .then((d: { rotulo: string | null }) => !cancelado && setRotulo(d.rotulo))
      .catch(() => !cancelado && setRotulo(null))
    return () => {
      cancelado = true
    }
  }, [rota])

  useEffect(() => {
    fim.current?.scrollIntoView?.({ block: 'end' })
  }, [conversa.mensagens])

  const comContexto = usarContexto && rotulo !== null
  const rotaEnviada = comContexto ? rota : ''

  function enviar(pergunta: string) {
    if (!pergunta.trim()) return
    setTexto('')
    // Texto colado longo (e-mail, conversa) não cabe na pergunta: vira anexo .txt e a pergunta,
    // curta, só sai depois que o anexo ficou pronto — senão a IA responderia sem ele.
    if (pergunta.trim().length > LIMITE_DA_PERGUNTA) {
      const minhaTroca = trocasDeConversa.current
      void conversa.anexar([arquivoDoTextoColado(pergunta)], rotaEnviada).then((ok) => {
        if (ok) conversa.enviar(perguntaDoTextoColado(pergunta), rotaEnviada)
        // Falhou: o texto (com a pergunta que o usuário escreveu nele) volta ao campo, se ele ainda
        // está vazio e a conversa é a mesma — nunca por cima do que o usuário digitou depois.
        else if (trocasDeConversa.current === minhaTroca) setTexto((atual) => (atual === '' ? pergunta : atual))
      })
      return
    }
    conversa.enviar(pergunta, rotaEnviada)
  }

  function anexar(arquivos: FileList | File[] | null | undefined) {
    const lista = Array.from(arquivos ?? [])
    if (lista.length) void conversa.anexar(lista, rotaEnviada)
  }

  // Enquanto o assistente responde, não se anexa: a ficha seria gravada entre a pergunta e a resposta.
  const anexoBloqueado = () => conversa.estado === 'respondendo'

  function aoArrastarSobre(e: DragEvent<HTMLElement>) {
    if (!temArquivos(e)) return
    e.preventDefault()
    if (!anexoBloqueado()) setArrastando(true)
  }

  function aoSairDoArraste(e: DragEvent<HTMLElement>) {
    // Passar por cima de um filho também dispara "leave": só some quando sai do painel.
    if (e.relatedTarget instanceof Node && e.currentTarget.contains(e.relatedTarget)) return
    setArrastando(false)
  }

  function aoSoltar(e: DragEvent<HTMLElement>) {
    if (!temArquivos(e)) return
    e.preventDefault()
    setArrastando(false)
    if (!anexoBloqueado()) anexar(e.dataTransfer.files)
  }

  function aoTeclar(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      enviar(texto)
    }
  }

  async function alternarHistorico() {
    const abrir = !historicoAberto
    setHistoricoAberto(abrir)
    if (abrir) {
      const resposta = await fetch('/api/assistente/conversas')
      if (resposta.ok) setConversas(((await resposta.json()) as { conversas: ConversaResumo[] }).conversas)
    }
  }

  const respondendo = conversa.estado === 'respondendo'
  const vazia = conversa.mensagens.length === 0

  function novaConversa() {
    trocasDeConversa.current += 1
    conversa.novaConversa()
    setHistoricoAberto(false)
    campo.current?.focus()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center sm:p-6">
      <div
        aria-hidden
        className="absolute inset-0 bg-navy/45 backdrop-blur-[3px] animate-in fade-in duration-200"
        onClick={onFechar}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Assistente VerAI"
        className="relative flex h-full w-full flex-col overflow-hidden bg-white shadow-2xl shadow-navy/30 ring-1 ring-navy/10 animate-in fade-in zoom-in-[0.98] slide-in-from-bottom-2 duration-200 sm:h-[min(86vh,820px)] sm:max-w-4xl sm:rounded-2xl"
        onDragOver={aoArrastarSobre}
        onDragLeave={aoSairDoArraste}
        onDrop={aoSoltar}
      >
        {arrastando && (
          <div className="pointer-events-none absolute inset-3 z-30 flex items-center justify-center rounded-2xl border-2 border-dashed border-orange bg-white/85 backdrop-blur-sm">
            <p className="flex items-center gap-2 text-sm font-medium text-navy">
              <Paperclip className="size-4 text-orange" aria-hidden /> Solte os arquivos para anexar
            </p>
          </div>
        )}

        <header className="flex items-center gap-3 border-b border-border-grey px-5 py-3.5">
          <span className="flex size-9 items-center justify-center rounded-xl bg-navy shadow-sm shadow-navy/30">
            <Sparkles className="size-4 text-orange" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold leading-tight text-navy">Assistente VerAI</h2>
            <p className="truncate text-xs text-mid-grey">Respostas a partir dos dados e documentos do VerAI</p>
          </div>
          <button
            type="button"
            className={cn(BTN_ICONE, historicoAberto && 'bg-navy/[0.06] text-navy')}
            onClick={alternarHistorico}
            aria-label="Conversas anteriores"
            aria-expanded={historicoAberto}
            title="Conversas anteriores"
          >
            <History className="size-4" aria-hidden />
          </button>
          <button type="button" className={BTN_ICONE} onClick={novaConversa} aria-label="Nova conversa" title="Nova conversa">
            <Plus className="size-4" aria-hidden />
          </button>
          <span className="mx-1 h-5 w-px bg-border-grey" aria-hidden />
          <button type="button" className={BTN_ICONE} onClick={onFechar} aria-label="Fechar assistente" title="Fechar (Esc)">
            <X className="size-4" aria-hidden />
          </button>
        </header>

        <div className="relative flex min-h-0 flex-1">
          {historicoAberto && (
            <nav
              className="absolute inset-y-0 left-0 z-20 flex w-72 flex-col border-r border-border-grey bg-[#fafbfc] shadow-xl animate-in slide-in-from-left-4 fade-in duration-150 md:static md:shadow-none"
              aria-label="Conversas anteriores"
            >
              <p className="px-4 pt-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-mid-grey">Conversas anteriores</p>
              <div className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-3">
                {conversas.length === 0 ? (
                  <p className="px-2 py-1 text-xs text-mid-grey">Nenhuma conversa ainda.</p>
                ) : (
                  conversas.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className="flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left text-xs text-navy transition-colors hover:bg-navy/[0.06]"
                      onClick={() => {
                        trocasDeConversa.current += 1
                        conversa.abrirConversa(c.id)
                        setHistoricoAberto(false)
                      }}
                    >
                      <MessageSquare className="mt-0.5 size-3.5 shrink-0 text-mid-grey" aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{c.titulo}</span>
                        <span className="text-mid-grey">· {new Date(c.atualizadaEm).toLocaleDateString('pt-BR')}</span>
                      </span>
                    </button>
                  ))
                )}
              </div>
            </nav>
          )}

          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex-1 overflow-y-auto">
              <div className="mx-auto w-full max-w-3xl space-y-5 px-5 py-6">
                {vazia && (
                  <div className="flex flex-col items-center pt-6 text-center sm:pt-10">
                    <span className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-orange/10">
                      <Sparkles className="size-6 text-orange" aria-hidden />
                    </span>
                    <h3 className="text-lg font-semibold text-navy">Como posso ajudar?</h3>
                    <p className="mt-1 max-w-md text-sm text-mid-grey">
                      Pergunte sobre clientes, contratos, SEI, faturamento, demandas ou o conteúdo dos documentos — ou anexe um arquivo (PDF, Word, Excel, CSV, texto, e-mail).
                    </p>
                    <div className="mt-6 grid w-full gap-2.5 sm:grid-cols-3">
                      {sugestoes(rota, comContexto).map((s, i) => {
                        const Icone = ICONES_SUGESTAO[i] ?? Sparkles
                        return (
                          <button
                            key={s}
                            type="button"
                            className="group flex flex-col items-start gap-2 rounded-xl border border-border-grey bg-white p-3.5 text-left text-sm text-navy shadow-xs transition-all hover:-translate-y-0.5 hover:border-orange/40 hover:shadow-md"
                            onClick={() => enviar(s)}
                          >
                            <Icone className="size-4 text-mid-grey transition-colors group-hover:text-orange" aria-hidden />
                            {s}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {conversa.mensagens.map((m) =>
                  m.papel === 'usuario' ? (
                    <div key={m.id} className="flex justify-end">
                      <div className="max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-navy px-4 py-2.5 text-sm text-white">
                        {m.conteudo}
                      </div>
                    </div>
                  ) : (
                    <div key={m.id} className="flex gap-3">
                      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-orange/10">
                        <Sparkles className="size-3.5 text-orange" aria-hidden />
                      </span>
                      <div className="min-w-0 flex-1">
                        <RespostaMarkdown texto={m.conteudo} naoConfirmados={m.naoConfirmados} />
                      </div>
                    </div>
                  )
                )}

                {respondendo && (
                  <p className="flex items-center gap-2 pl-10 text-xs text-mid-grey">
                    <Loader2 className="size-3.5 animate-spin text-orange" aria-hidden />
                    {conversa.ferramentaAtual ? `${ROTULOS_FERRAMENTAS[conversa.ferramentaAtual] ?? 'Consultando'}…` : 'Pensando…'}
                  </p>
                )}

                {conversa.estado === 'erro' && conversa.erro && (
                  <div className="rounded-xl border border-red-crit/30 bg-red-crit/[0.04] px-4 py-3 text-sm text-red-crit">
                    <p>{conversa.erro}</p>
                    <button type="button" className={cn(BTN_OUTLINE_SM, 'mt-2')} onClick={() => conversa.tentarDeNovo(rotaEnviada)}>
                      <RotateCcw className="size-3" aria-hidden /> Tentar de novo
                    </button>
                  </div>
                )}
                <div ref={fim} />
              </div>
            </div>

            <footer className="border-t border-border-grey bg-white px-5 pt-3 pb-3">
              <div className="mx-auto w-full max-w-3xl">
                {conversa.anexos.length > 0 && (
                  <section className="mb-2 max-h-40 space-y-1.5 overflow-y-auto" aria-label="Anexos da conversa" aria-live="polite">
                    {conversa.anexos.map((a) => (
                      <CartaoAnexo key={a.id} anexo={a} />
                    ))}
                  </section>
                )}

                <div className="rounded-2xl border border-border-grey bg-white shadow-sm transition-all focus-within:border-orange focus-within:ring-4 focus-within:ring-orange/12">
                  {comContexto && (
                    <div className="flex items-center gap-1.5 px-3 pt-2.5 text-xs">
                      <span className="text-mid-grey">Contexto:</span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-navy/[0.06] py-0.5 pr-1 pl-2.5 font-medium text-navy">
                        {rotulo}
                        <button
                          type="button"
                          aria-label="Remover contexto"
                          className="rounded-full p-0.5 text-mid-grey hover:bg-navy/10 hover:text-navy"
                          onClick={() => setUsarContexto(false)}
                        >
                          <X className="size-3" aria-hidden />
                        </button>
                      </span>
                    </div>
                  )}
                  <textarea
                    ref={campo}
                    className="block max-h-[200px] min-h-[44px] w-full resize-none bg-transparent px-4 pt-3 pb-1 text-sm text-foreground outline-none placeholder:text-mid-grey disabled:opacity-60"
                    rows={1}
                    placeholder="Pergunte ao assistente…"
                    value={texto}
                    onChange={(e) => setTexto(e.target.value)}
                    onKeyDown={aoTeclar}
                    disabled={respondendo}
                  />
                  <div className="flex items-center gap-1 px-2 pb-2">
                    <input
                      ref={seletor}
                      type="file"
                      multiple
                      accept={ACEITOS}
                      hidden
                      disabled={respondendo}
                      data-testid="seletor-de-anexos"
                      onChange={(e) => {
                        anexar(e.target.files)
                        e.target.value = '' // o mesmo arquivo pode ser escolhido de novo
                      }}
                    />
                    <button
                      type="button"
                      className={cn(BTN_ICONE, 'disabled:pointer-events-none disabled:opacity-40')}
                      onClick={() => seletor.current?.click()}
                      aria-label="Anexar arquivo"
                      title="Anexar arquivo (ou arraste para a janela)"
                      disabled={respondendo}
                    >
                      <Paperclip className="size-4" aria-hidden />
                    </button>
                    <span className="flex-1" />
                    {respondendo ? (
                      <button
                        type="button"
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-navy/15 px-3 text-xs font-medium text-navy hover:bg-navy/[0.04]"
                        onClick={conversa.parar}
                        aria-label="Parar"
                      >
                        <Square className="size-3 fill-current" aria-hidden /> Parar
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="inline-flex size-8 items-center justify-center rounded-lg bg-orange text-white shadow-sm shadow-orange/30 transition-colors hover:bg-orange-dark disabled:bg-navy/10 disabled:text-mid-grey disabled:shadow-none"
                        onClick={() => enviar(texto)}
                        disabled={!texto.trim()}
                        aria-label="Enviar"
                      >
                        <ArrowUp className="size-4" aria-hidden />
                      </button>
                    )}
                  </div>
                </div>
                <p className="mt-2 hidden text-center text-[11px] text-mid-grey sm:block">
                  <kbd className="font-sans font-medium">Enter</kbd> envia · <kbd className="font-sans font-medium">Shift+Enter</kbd> quebra linha ·{' '}
                  <kbd className="font-sans font-medium">Esc</kbd> fecha · confira os números marcados com ⚠
                </p>
              </div>
            </footer>
          </div>
        </div>
      </section>
    </div>
  )
}
