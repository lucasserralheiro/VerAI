'use client'

import { useEffect, useRef, useState, type DragEvent, type KeyboardEvent } from 'react'
import { History, Loader2, Paperclip, Plus, RotateCcw, Send, Sparkles, Square, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BTN_OUTLINE_SM, BTN_PRIMARY, INPUT_BASE } from '@/lib/ui'
import { ROTULOS_FERRAMENTAS } from '@/lib/assistente/ferramentas/rotulos'
import { RespostaMarkdown } from './resposta-markdown'
import { CartaoAnexo } from './anexos/cartao-anexo'
import { LIMITE_DA_PERGUNTA, arquivoDoTextoColado, perguntaDoTextoColado } from './anexos/enviar-anexo'
import { useConversaAssistente } from './use-conversa-assistente'

/** Mesmos formatos de `FORMATOS_ANEXO` (`lib/assistente/anexos/tipos.ts`). */
const ACEITOS = '.pdf,.docx,.xlsx,.csv,.txt,.eml'

const temArquivos = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files')

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

  return (
    <aside
      role="dialog"
      aria-label="Assistente VerAI"
      className="fixed inset-0 z-50 flex flex-col bg-white shadow-2xl sm:inset-y-0 sm:left-auto sm:right-0 sm:w-[420px] sm:border-l sm:border-border-grey"
      onDragOver={aoArrastarSobre}
      onDragLeave={aoSairDoArraste}
      onDrop={aoSoltar}
    >
      {arrastando && (
        <div className="pointer-events-none absolute inset-2 z-10 flex items-center justify-center rounded-2xl border-2 border-dashed border-orange bg-orange/[0.06]">
          <p className="flex items-center gap-2 text-sm font-medium text-navy">
            <Paperclip className="size-4 text-orange" aria-hidden /> Solte os arquivos para anexar
          </p>
        </div>
      )}
      <header className="flex items-center gap-2 border-b border-border-grey px-4 py-3">
        <Sparkles className="size-4 text-orange" aria-hidden />
        <h2 className="flex-1 text-sm font-semibold text-navy">Assistente VerAI</h2>
        <button type="button" className={BTN_OUTLINE_SM} onClick={alternarHistorico} aria-label="Conversas anteriores">
          <History className="size-3.5" aria-hidden />
        </button>
        <button
          type="button"
          className={BTN_OUTLINE_SM}
          onClick={() => {
            trocasDeConversa.current += 1
            conversa.novaConversa()
          }}
          aria-label="Nova conversa"
        >
          <Plus className="size-3.5" aria-hidden />
        </button>
        <button type="button" className={BTN_OUTLINE_SM} onClick={onFechar} aria-label="Fechar assistente">
          <X className="size-3.5" aria-hidden />
        </button>
      </header>

      {historicoAberto && (
        <nav className="max-h-60 overflow-y-auto border-b border-border-grey bg-navy/[0.02] px-2 py-2" aria-label="Conversas anteriores">
          {conversas.length === 0 ? (
            <p className="px-2 py-1 text-xs text-mid-grey">Nenhuma conversa ainda.</p>
          ) : (
            conversas.map((c) => (
              <button
                key={c.id}
                type="button"
                className="block w-full truncate rounded-lg px-2 py-1.5 text-left text-xs text-navy hover:bg-navy/[0.06]"
                onClick={() => {
                  trocasDeConversa.current += 1
                  conversa.abrirConversa(c.id)
                  setHistoricoAberto(false)
                }}
              >
                {c.titulo} <span className="text-mid-grey">· {new Date(c.atualizadaEm).toLocaleDateString('pt-BR')}</span>
              </button>
            ))
          )}
        </nav>
      )}

      {comContexto && (
        <div className="flex items-center gap-2 border-b border-border-grey px-4 py-2 text-xs">
          <span className="text-mid-grey">Contexto:</span>
          <span className="rounded-full bg-navy/[0.06] px-2 py-0.5 font-medium text-navy">{rotulo}</span>
          <button type="button" aria-label="Remover contexto" className="text-mid-grey hover:text-navy" onClick={() => setUsarContexto(false)}>
            <X className="size-3" aria-hidden />
          </button>
        </div>
      )}

      {conversa.anexos.length > 0 && (
        <section className="max-h-48 space-y-1.5 overflow-y-auto border-b border-border-grey px-4 py-2" aria-label="Anexos da conversa" aria-live="polite">
          {conversa.anexos.map((a) => (
            <CartaoAnexo key={a.id} anexo={a} />
          ))}
        </section>
      )}

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {conversa.mensagens.length === 0 && (
          <div className="space-y-2">
            <p className="text-sm text-mid-grey">Pergunte sobre clientes, contratos, SEI, faturamento, demandas ou o conteúdo dos documentos — ou anexe um arquivo (PDF, Word, Excel, CSV, texto, e-mail).</p>
            {sugestoes(rota, comContexto).map((s) => (
              <button key={s} type="button" className="block w-full rounded-xl border border-navy/15 px-3 py-2 text-left text-sm text-navy hover:border-navy/35 hover:bg-navy/[0.04]" onClick={() => enviar(s)}>
                {s}
              </button>
            ))}
          </div>
        )}

        {conversa.mensagens.map((m) =>
          m.papel === 'usuario' ? (
            <div key={m.id} className="ml-8 rounded-2xl rounded-br-sm bg-navy px-3 py-2 text-sm text-white">
              {m.conteudo}
            </div>
          ) : (
            <div key={m.id} className="mr-4">
              <RespostaMarkdown texto={m.conteudo} naoConfirmados={m.naoConfirmados} />
            </div>
          )
        )}

        {respondendo && (
          <p className="flex items-center gap-2 text-xs text-mid-grey">
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
            {conversa.ferramentaAtual ? `${ROTULOS_FERRAMENTAS[conversa.ferramentaAtual] ?? 'Consultando'}…` : 'Pensando…'}
          </p>
        )}

        {conversa.estado === 'erro' && conversa.erro && (
          <div className="rounded-xl border border-red-crit/30 bg-red-crit/[0.04] px-3 py-2 text-sm text-red-crit">
            <p>{conversa.erro}</p>
            <button type="button" className={cn(BTN_OUTLINE_SM, 'mt-2')} onClick={() => conversa.tentarDeNovo(rotaEnviada)}>
              <RotateCcw className="size-3" aria-hidden /> Tentar de novo
            </button>
          </div>
        )}
        <div ref={fim} />
      </div>

      <footer className="flex items-end gap-2 border-t border-border-grey px-4 py-3">
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
          className={cn(BTN_OUTLINE_SM, 'h-[42px] px-2.5')}
          onClick={() => seletor.current?.click()}
          aria-label="Anexar arquivo"
          title="Anexar arquivo (ou arraste para o painel)"
          disabled={respondendo}
        >
          <Paperclip className="size-3.5" aria-hidden />
        </button>
        <textarea
          className={cn(INPUT_BASE, 'max-h-40 min-h-[42px] flex-1 resize-none')}
          rows={1}
          placeholder="Pergunte ao assistente…"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={aoTeclar}
          disabled={respondendo}
        />
        {respondendo ? (
          <button type="button" className={BTN_OUTLINE_SM} onClick={conversa.parar} aria-label="Parar">
            <Square className="size-3.5" aria-hidden /> Parar
          </button>
        ) : (
          <button type="button" className={BTN_PRIMARY} onClick={() => enviar(texto)} disabled={!texto.trim()} aria-label="Enviar">
            <Send className="size-3.5" aria-hidden />
          </button>
        )}
      </footer>
    </aside>
  )
}
