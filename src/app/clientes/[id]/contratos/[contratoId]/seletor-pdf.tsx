'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, ExternalLink, FileText, Loader2, Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BTN_OUTLINE_SM, INPUT_BASE } from '@/lib/ui'
import { normalizarNomePdf, type PdfExistente } from '@/lib/relatorios-clientes/pdfs-existentes'
import type { TipoPdfHistorico } from '@/lib/storage'

const ROTULO: Record<TipoPdfHistorico, string> = { proposta: 'PC/PA', termo: 'TC/TA' }

function tamanhoLegivel(bytes: number | null): string | null {
  if (bytes === null) return null
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`
}

/**
 * Escolher, entre os PDFs que JÁ estão no sistema (Propostas comerciais e anexos de outras linhas do
 * mesmo cliente), o que vira o PC/PA ou o TC/TA desta linha — em vez de subir de novo do computador.
 * Os que combinam com o texto da linha vêm em cima, marcados como "Sugerido".
 */
export function SeletorPdf({
  alvo,
  aoFechar,
  aoEscolhido,
}: {
  alvo: { linhaId: string; tipo: TipoPdfHistorico } | null
  aoFechar: () => void
  aoEscolhido: () => Promise<void>
}) {
  const dialogoRef = useRef<HTMLDialogElement>(null)
  const [itens, setItens] = useState<PdfExistente[] | null>(null)
  const [referencia, setReferencia] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [busca, setBusca] = useState('')
  const [usando, setUsando] = useState<string | null>(null)

  const linhaId = alvo?.linhaId
  const tipo = alvo?.tipo
  const aberto = alvo !== null

  useEffect(() => {
    const el = dialogoRef.current
    if (!el) return
    if (aberto && !el.open) el.showModal()
    else if (!aberto && el.open) el.close()
  }, [aberto])

  // Cada vez que o seletor abre (ou muda de linha/coluna), busca a lista atual.
  useEffect(() => {
    if (!linhaId || !tipo) return
    let cancelado = false
    setItens(null)
    setReferencia(null)
    setErro(null)
    setBusca('')
    setUsando(null)
    fetch(`/api/historico-contrato/${linhaId}/pdfs-existentes?tipo=${tipo}`, { cache: 'no-store' })
      .then(async (response) => {
        const corpo = await response.json().catch(() => null)
        if (!response.ok) throw new Error(corpo?.error ?? 'Falha ao listar os PDFs que já estão no sistema.')
        if (cancelado) return
        setItens(corpo.itens as PdfExistente[])
        setReferencia((corpo.referencia as string | null) ?? null)
      })
      .catch((e: unknown) => {
        if (!cancelado) setErro(e instanceof Error ? e.message : 'Falha de conexão ao listar os PDFs.')
      })
    return () => {
      cancelado = true
    }
  }, [linhaId, tipo])

  const filtrados = useMemo(() => {
    if (!itens) return []
    const termo = normalizarNomePdf(busca)
    if (!termo) return itens
    return itens.filter((item) => normalizarNomePdf(`${item.nome} ${item.detalhe}`).includes(termo))
  }, [itens, busca])

  async function usar(item: PdfExistente) {
    if (!linhaId || !tipo) return
    setUsando(item.chave)
    setErro(null)
    try {
      const response = await fetch(`/api/historico-contrato/${linhaId}/pdf/${tipo}/copiar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item.origem),
      })
      if (!response.ok) {
        const corpo = await response.json().catch(() => null)
        setErro(corpo?.error ?? `Falha ao usar o PDF (${ROTULO[tipo]}).`)
        return
      }
      await aoEscolhido()
      aoFechar()
    } catch {
      setErro(`Falha de conexão ao usar o PDF (${ROTULO[tipo]}).`)
    } finally {
      setUsando(null)
    }
  }

  const rotulo = tipo ? ROTULO[tipo] : ''
  const sugeridos = filtrados.filter((item) => item.sugerido).length

  return (
    <dialog
      ref={dialogoRef}
      onClose={aoFechar}
      onClick={(e) => {
        if (e.target === dialogoRef.current) dialogoRef.current?.close()
      }}
      aria-label={`Escolher PDF ${rotulo} já cadastrado`}
      className="w-[min(40rem,calc(100vw-2rem))] border-0 bg-transparent p-0"
    >
      {aberto && (
        <div className="card-flush overflow-hidden">
          <header className="flex items-start justify-between gap-3 bg-navy px-5 py-3 text-white">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold">Escolher {rotulo} já cadastrado</h3>
              <p className="truncate text-xs text-white/70">
                {referencia ? `Linha: ${referencia}` : 'PDFs que já estão no sistema — não precisa subir de novo.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => dialogoRef.current?.close()}
              aria-label="Fechar"
              className="rounded-md p-1 text-white/80 hover:bg-white/10 hover:text-white"
            >
              <X className="size-5" strokeWidth={2.25} />
            </button>
          </header>

          <div className="space-y-3 p-5">
            <label className="relative block">
              <span className="sr-only">Buscar PDF pelo nome</span>
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-mid-grey" strokeWidth={2} aria-hidden />
              <input
                type="search"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar pelo nome do arquivo"
                className={cn(INPUT_BASE, 'w-full pl-9')}
              />
            </label>

            {erro && (
              <p className="flex items-center gap-1.5 rounded-lg bg-red-crit-light px-3 py-2 text-sm text-red-crit">
                <AlertCircle className="size-4 shrink-0" strokeWidth={2.25} />
                {erro}
              </p>
            )}

            {itens === null && !erro && (
              <p className="flex items-center gap-2 py-6 text-sm text-mid-grey">
                <Loader2 className="size-4 animate-spin" strokeWidth={2.25} /> Procurando PDFs no sistema...
              </p>
            )}

            {itens !== null && filtrados.length === 0 && (
              <p className="py-6 text-center text-sm text-mid-grey">
                {itens.length === 0
                  ? 'Nenhum PDF cadastrado ainda nas Propostas comerciais nem em outras linhas deste cliente.'
                  : 'Nenhum PDF combina com a busca.'}
              </p>
            )}

            {filtrados.length > 0 && (
              <>
                {sugeridos > 0 && !busca && (
                  <p className="text-xs text-mid-grey">
                    {sugeridos === 1 ? '1 PDF combina' : `${sugeridos} PDFs combinam`} com o texto desta linha e {sugeridos === 1 ? 'aparece' : 'aparecem'} primeiro.
                  </p>
                )}
                <ul className="max-h-[50vh] divide-y divide-border-grey overflow-y-auto rounded-xl border border-border-grey">
                  {filtrados.map((item) => {
                    const tamanho = tamanhoLegivel(item.tamanhoBytes)
                    return (
                      <li key={item.chave} className="flex items-center gap-3 px-3 py-2.5">
                        <FileText className="size-4 shrink-0 text-mid-grey" strokeWidth={2} aria-hidden />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate font-mono text-xs font-semibold text-navy" title={item.nome}>
                              {item.nome}
                            </span>
                            {item.sugerido && (
                              <span className="shrink-0 rounded-full bg-green-ok-light px-2 py-0.5 text-[0.68rem] font-semibold text-green-ok">
                                Sugerido
                              </span>
                            )}
                          </div>
                          <div className="truncate text-xs text-mid-grey">
                            {item.detalhe}
                            {tamanho ? ` · ${tamanho}` : ''}
                          </div>
                        </div>
                        <a
                          href={item.verUrl}
                          target="_blank"
                          rel="noreferrer"
                          title="Conferir o PDF em outra aba"
                          aria-label={`Ver ${item.nome}`}
                          className="shrink-0 rounded-md p-1 text-mid-grey hover:bg-light-grey hover:text-navy"
                        >
                          <ExternalLink className="size-4" strokeWidth={2} aria-hidden />
                        </a>
                        <button
                          type="button"
                          disabled={usando !== null}
                          onClick={() => void usar(item)}
                          className={cn(BTN_OUTLINE_SM, 'shrink-0')}
                        >
                          {usando === item.chave ? <Loader2 className="size-3.5 animate-spin" strokeWidth={2.25} /> : null}
                          {usando === item.chave ? 'Usando...' : 'Usar este'}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </>
            )}
          </div>
        </div>
      )}
    </dialog>
  )
}
