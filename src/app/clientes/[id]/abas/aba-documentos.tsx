'use client'

// Aba "Documentos" da ficha do cliente: o repositório de arquivos do cliente
// (docs/superpowers/specs/2026-09-23-repositorio-documentos-cliente-design.md §3.5). O fluxo antigo
// de competência + análise por IA saiu da ficha, mas as páginas /clientes/[id]/[competencia]
// continuam existindo — o painel do arquivo leva até elas pelo "onde é usado".

import { useCallback, useEffect, useState } from 'react'
import { AlertCircle, Loader2, Upload } from 'lucide-react'
import { BTN_PRIMARY } from '@/lib/ui'
import { formatarTamanho } from '@/lib/arquivos/tipos'
import { AtualizacaoSharepoint } from '@/components/sharepoint/atualizacao-sharepoint'
import { ListaArquivos } from './documentos/lista-arquivos'
import { PainelArquivo } from './documentos/painel-arquivo'
import { EnvioArquivos } from './documentos/envio-arquivos'
import type { ArquivoRepositorio } from './documentos/tipos'

export function AbaDocumentos({ clienteId }: { clienteId: string }) {
  const [arquivos, setArquivos] = useState<ArquivoRepositorio[]>([])
  const [resumo, setResumo] = useState({ total: 0, bytes: 0 })
  const [selecionado, setSelecionado] = useState<ArquivoRepositorio | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  const carregar = useCallback(async () => {
    const response = await fetch(`/api/clientes/${clienteId}/arquivos`).catch(() => null)
    const corpo = await response?.json().catch(() => null)
    if (!response?.ok) {
      setErro(corpo?.error ?? 'Falha ao carregar os documentos.')
    } else {
      setArquivos(corpo.arquivos)
      setResumo(corpo.resumo)
      setErro(null)
    }
    setCarregando(false)
  }, [clienteId])

  useEffect(() => {
    carregar()
  }, [carregar])

  if (carregando) {
    return (
      <p className="flex items-center gap-2 text-sm text-mid-grey">
        <Loader2 className="size-4 animate-spin" strokeWidth={2.25} />
        Carregando...
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[0.95rem] font-semibold text-navy">Documentos do cliente</h2>
          <p className="text-xs text-mid-grey">
            {resumo.total} arquivo{resumo.total === 1 ? '' : 's'} · {formatarTamanho(resumo.bytes)}
          </p>
          <AtualizacaoSharepoint className="mt-0.5" />
        </div>
        {!enviando && (
          <button type="button" onClick={() => setEnviando(true)} className={BTN_PRIMARY}>
            <Upload className="size-3.5" strokeWidth={2.25} />
            Enviar arquivos
          </button>
        )}
      </div>

      {enviando && (
        <EnvioArquivos
          clienteId={clienteId}
          aoCancelar={() => setEnviando(false)}
          aoConcluir={() => {
            setEnviando(false)
            carregar()
          }}
        />
      )}

      {erro && (
        <p className="flex items-center gap-1.5 rounded-xl bg-red-crit-light p-4 text-sm text-red-crit">
          <AlertCircle className="size-4 shrink-0" strokeWidth={2.25} />
          {erro}
        </p>
      )}

      <div className={selecionado ? 'grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]' : undefined}>
        <ListaArquivos
          arquivos={arquivos}
          selecionadoId={selecionado?.id ?? null}
          aoSelecionar={setSelecionado}
        />
        {selecionado && (
          <PainelArquivo
            key={selecionado.id}
            arquivo={selecionado}
            aoFechar={() => setSelecionado(null)}
            aoAtualizar={(atualizado) => {
              setArquivos((lista) => lista.map((a) => (a.id === atualizado.id ? atualizado : a)))
              setSelecionado(atualizado)
            }}
            aoRemover={(id) => {
              setSelecionado(null)
              carregar()
              setArquivos((lista) => lista.filter((a) => a.id !== id))
            }}
          />
        )}
      </div>
    </div>
  )
}
