'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { AlertCircle, ExternalLink, FileCode2, FileText, Loader2, X } from 'lucide-react'
import { BTN_OUTLINE_SM } from '@/lib/ui'
import { cn } from '@/lib/utils'
import { formatarTamanho, rotuloCategoria } from '@/lib/arquivos/tipos'
import { conversaoDoArquivo, podeConverter, useConverterArquivo } from '../abas/documentos/converter-arquivo'
import { documentosDoContrato, type ColunaDoContrato } from '../abas/documentos/derivados'
import type { ArquivoRepositorio } from '../abas/documentos/tipos'

const TEXTOS: Record<ColunaDoContrato, { sigla: string; escolha: string; procurando: string; nenhum: string }> = {
  proposta: {
    sigla: 'PC/PA',
    escolha: 'Escolha a proposta para abrir ou converter em Markdown.',
    procurando: 'Procurando as propostas...',
    nenhum: 'Nenhuma PC/PA ligada a este contrato.',
  },
  termo: {
    sigla: 'TC/TA',
    escolha: 'Escolha o termo para abrir ou converter em Markdown.',
    procurando: 'Procurando os termos...',
    nenhum: 'Nenhum TC/TA ligado a este contrato.',
  },
}

/** "PC/PA de TA 01" / "TC/TA de Contrato", tirado do uso no histórico; sem ele, a categoria do arquivo. */
function detalheDoDocumento(arquivo: ArquivoRepositorio, contratoId: string, coluna: ColunaDoContrato): string {
  const uso = arquivo.usos.find((u) => u.coluna === coluna && u.contrato?.id === contratoId)
  return uso?.rotulo.split(' · ').pop() ?? rotuloCategoria(arquivo.categoria)
}

/**
 * Todas as PC/PA ou todos os TC/TA de um contrato (a coluna da aba Contratos só guarda o mais recente) —
 * para abrir o PDF ou mandar direto para a conversão em Markdown, como se tivesse sido enviado na
 * Proposta Comercial. A mesma janela serve às duas colunas, para as duas nunca divergirem.
 */
export function DocumentosDoContrato({
  clienteId,
  contrato,
  coluna,
  aoFechar,
}: {
  clienteId: string
  contrato: { id: string; numeroTermo: string | null } | null
  coluna: ColunaDoContrato
  aoFechar: () => void
}) {
  const dialogoRef = useRef<HTMLDialogElement>(null)
  const [documentos, setDocumentos] = useState<ArquivoRepositorio[] | null>(null)
  const [erroLista, setErroLista] = useState<string | null>(null)
  const { converter, convertendoId, erro } = useConverterArquivo()
  const contratoId = contrato?.id
  const textos = TEXTOS[coluna]

  useEffect(() => {
    const el = dialogoRef.current
    if (!el) return
    if (contratoId && !el.open) el.showModal()
    else if (!contratoId && el.open) el.close()
  }, [contratoId])

  // Busca a cada abertura: uma conversão feita há pouco já aparece como "Abrir em Markdown".
  useEffect(() => {
    if (!contratoId) return
    let cancelado = false
    setDocumentos(null)
    setErroLista(null)
    fetch(`/api/clientes/${clienteId}/arquivos`, { cache: 'no-store' })
      .then(async (response) => {
        const corpo = await response.json().catch(() => null)
        if (!response.ok) throw new Error(corpo?.error ?? `Falha ao listar os ${textos.sigla} do contrato.`)
        if (!cancelado) setDocumentos(documentosDoContrato(corpo.arquivos as ArquivoRepositorio[], contratoId, coluna))
      })
      .catch((e: unknown) => {
        if (!cancelado) setErroLista(e instanceof Error ? e.message : `Falha de conexão ao listar os ${textos.sigla}.`)
      })
    return () => {
      cancelado = true
    }
  }, [clienteId, contratoId, coluna, textos.sigla])

  const mensagemErro = erroLista ?? erro

  return (
    <dialog
      ref={dialogoRef}
      onClose={aoFechar}
      onClick={(e) => {
        if (e.target === dialogoRef.current) dialogoRef.current?.close()
      }}
      aria-label={`${textos.sigla} do contrato`}
      className="w-[min(40rem,calc(100vw-2rem))] border-0 bg-transparent p-0"
    >
      {contrato && (
        <div className="card-flush overflow-hidden">
          <header className="flex items-start justify-between gap-3 bg-navy px-5 py-3 text-white">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold">
                {textos.sigla} do {contrato.numeroTermo ?? 'contrato'}
              </h3>
              <p className="truncate text-xs text-white/70">{textos.escolha}</p>
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
            {mensagemErro && (
              <p className="flex items-center gap-1.5 rounded-lg bg-red-crit-light px-3 py-2 text-sm text-red-crit">
                <AlertCircle className="size-4 shrink-0" strokeWidth={2.25} />
                {mensagemErro}
              </p>
            )}

            {documentos === null && !erroLista && (
              <p className="flex items-center gap-2 py-6 text-sm text-mid-grey">
                <Loader2 className="size-4 animate-spin" strokeWidth={2.25} /> {textos.procurando}
              </p>
            )}

            {documentos !== null && documentos.length === 0 && (
              <p className="py-6 text-center text-sm text-mid-grey">{textos.nenhum}</p>
            )}

            {documentos !== null && documentos.length > 0 && (
              <ul className="max-h-[50vh] divide-y divide-border-grey overflow-y-auto rounded-xl border border-border-grey">
                {documentos.map((arquivo) => {
                  const conversao = conversaoDoArquivo(arquivo)
                  const convertendo = convertendoId === arquivo.id
                  return (
                    <li key={arquivo.id} className="flex items-center gap-3 px-3 py-2.5">
                      <FileText className="size-4 shrink-0 text-mid-grey" strokeWidth={2} aria-hidden />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-mono text-xs font-semibold text-navy" title={arquivo.nome}>
                          {arquivo.nome}
                        </div>
                        <div className="truncate text-xs text-mid-grey">
                          {detalheDoDocumento(arquivo, contrato.id, coluna)} · {formatarTamanho(arquivo.tamanhoBytes)}
                        </div>
                      </div>
                      <a
                        href={`/api/arquivos/${arquivo.id}?modo=inline`}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`Abrir PDF ${arquivo.nome}`}
                        title="Abrir PDF"
                        className="rounded-md p-1.5 text-mid-grey hover:bg-orange-light hover:text-orange"
                      >
                        <ExternalLink className="size-4" strokeWidth={2} />
                      </a>
                      {conversao ? (
                        <Link href={conversao.href} aria-label={`Abrir ${arquivo.nome} em Markdown`} className={BTN_OUTLINE_SM}>
                          <FileCode2 className="size-3.5" strokeWidth={2.25} />
                          Abrir em Markdown
                        </Link>
                      ) : (
                        podeConverter(arquivo) && (
                          <button
                            type="button"
                            onClick={() => converter(arquivo)}
                            disabled={convertendoId !== null}
                            aria-label={`Converter ${arquivo.nome} em Markdown`}
                            className={cn(BTN_OUTLINE_SM, 'disabled:opacity-50')}
                          >
                            {convertendo ? (
                              <Loader2 className="size-3.5 animate-spin" strokeWidth={2.25} />
                            ) : (
                              <FileCode2 className="size-3.5" strokeWidth={2.25} />
                            )}
                            {convertendo ? 'Convertendo...' : 'Converter'}
                          </button>
                        )
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </dialog>
  )
}
