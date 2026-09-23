'use client'

import { useEffect, useRef, useState, type FormEvent, type MouseEvent } from 'react'
import { AlertCircle, Check, Copy, ExternalLink, Link2, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BTN_OUTLINE, BTN_PRIMARY, INPUT_BASE, LINK_DANGER } from '@/lib/ui'
import { formatarSei, urlDoSei } from '@/lib/relatorios-clientes/sei'
import { salvarLinkSei, useLinkSei } from '@/lib/relatorios-clientes/links-sei-cliente'

/**
 * PADRÃO ÚNICO de número SEI em qualquer tela: sempre clicável, sempre com o lugar de cadastrar o link.
 *  - o link do processo é cadastrado POR NÚMERO (ícone de corrente ao lado): quem cadastra uma vez vê
 *    o mesmo link em todo lugar onde o número aparece;
 *  - com link (o cadastrado, o do contrato vindo do legado ou o modelo `NEXT_PUBLIC_SEI_URL_TEMPLATE`):
 *    o clique abre o processo em outra aba;
 *  - sem link: o clique copia o número — nunca fica texto morto.
 * Dentro de linha clicável (tabela que abre modal) o clique não propaga.
 */
export function SeiLink({
  numero,
  link,
  className,
}: {
  numero: string | null | undefined
  /** Endereço herdado de outro cadastro (hoje `Contrato.linkSei`), usado quando ninguém cadastrou o do número. */
  link?: string | null
  className?: string
}) {
  const [copiado, setCopiado] = useState(false)
  const [editando, setEditando] = useState(false)
  const cadastrado = useLinkSei(numero)
  const texto = formatarSei(numero)
  if (!texto || !numero) return <span className="text-mid-grey/60">—</span>

  const estilo = cn(
    'inline-flex items-center gap-1 font-mono text-xs font-semibold text-navy hover:text-orange hover:underline',
    className
  )
  const url = urlDoSei(numero, cadastrado ?? link)

  async function copiar(e: MouseEvent) {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(texto)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 1500)
    } catch {
      // Sem permissão de área de transferência: o número continua visível pra copiar à mão.
    }
  }

  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap">
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          title="Abrir processo no SEI"
          onClick={(e) => e.stopPropagation()}
          className={estilo}
        >
          {texto}
          <ExternalLink className="size-3 shrink-0" strokeWidth={2.25} />
        </a>
      ) : (
        <button type="button" onClick={copiar} title="Copiar nº do SEI" className={cn(estilo, 'cursor-pointer')}>
          {texto}
          {copiado ? (
            <Check className="size-3 shrink-0 text-green-ok" strokeWidth={2.5} />
          ) : (
            <Copy className="size-3 shrink-0" strokeWidth={2.25} />
          )}
        </button>
      )}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setEditando(true)
        }}
        title={cadastrado ? 'Editar o link deste processo SEI' : 'Cadastrar o link deste processo SEI'}
        aria-label={`${cadastrado ? 'Editar' : 'Cadastrar'} link do SEI ${texto}`}
        className={cn(
          'cursor-pointer rounded p-0.5 hover:bg-orange-light hover:text-orange-dark',
          cadastrado ? 'text-navy/60' : 'text-mid-grey/70'
        )}
      >
        <Link2 className="size-3" strokeWidth={2.25} />
      </button>
      {editando && <DialogoLinkSei numero={numero} atual={cadastrado ?? ''} aoFechar={() => setEditando(false)} />}
    </span>
  )
}

/** Modal nativo (`<dialog>` + `showModal()`), o mesmo padrão dos outros diálogos do sistema. */
function DialogoLinkSei({ numero, atual, aoFechar }: { numero: string; atual: string; aoFechar: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const [url, setUrl] = useState(atual)
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (el && !el.open) el.showModal()
  }, [])

  async function salvar(valor: string) {
    setErro(null)
    setSalvando(true)
    const falha = await salvarLinkSei(numero, valor)
    setSalvando(false)
    if (falha) setErro(falha)
    else ref.current?.close()
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    e.stopPropagation()
    void salvar(url)
  }

  return (
    <dialog
      ref={ref}
      onClose={aoFechar}
      onClick={(e) => {
        e.stopPropagation()
        if (e.target === ref.current) ref.current?.close()
      }}
      aria-label="Link do processo SEI"
      className="w-[min(32rem,calc(100vw-2rem))] border-0 bg-transparent p-0"
    >
      <form onSubmit={handleSubmit} className="card space-y-3 font-sans">
        <div>
          <h2 className="text-[0.95rem] font-semibold text-navy">Link do processo SEI</h2>
          <p className="mt-0.5 font-mono text-xs text-mid-grey">{formatarSei(numero)}</p>
        </div>
        <label className="block space-y-1">
          <span className="text-xs font-medium text-navy">Endereço (URL) do processo</span>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://sei.…"
            autoFocus
            className={cn(INPUT_BASE, 'w-full text-sm')}
          />
          <span className="block text-[0.7rem] text-mid-grey">
            Vale para todo lugar onde este número aparece (contrato, faturamento, demanda, fornecedor, termo).
          </span>
        </label>
        {erro && (
          <p className="flex items-center gap-1.5 rounded-lg bg-red-crit-light px-3 py-2 text-xs text-red-crit">
            <AlertCircle className="size-3.5 shrink-0" strokeWidth={2.25} />
            {erro}
          </p>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2">
          {atual ? (
            <button type="button" disabled={salvando} onClick={() => void salvar('')} className={`${LINK_DANGER} text-xs`}>
              Remover link
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button type="button" onClick={() => ref.current?.close()} className={BTN_OUTLINE}>
              Cancelar
            </button>
            <button type="submit" disabled={salvando} className={BTN_PRIMARY}>
              {salvando && <Loader2 className="size-3.5 animate-spin" strokeWidth={2.25} />}
              Salvar
            </button>
          </div>
        </div>
      </form>
    </dialog>
  )
}
