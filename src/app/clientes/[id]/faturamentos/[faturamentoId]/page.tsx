'use client'

import { use, useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { AlertCircle, ChevronRight, Loader2, Pencil } from 'lucide-react'
import { BTN_OUTLINE } from '@/lib/ui'
import { formatarMoeda } from '@/lib/relatorios-clientes/formatacao'
import { SeiLink } from '@/components/relatorios-clientes/sei-link'
import { FormularioFaturamento, competencia, type Faturamento, type OpcaoContrato } from '../formulario-faturamento'
import { SecaoNotas, type Nota } from './secao-notas'

interface FaturamentoDetalhe extends Faturamento {
  notas: Nota[]
}

function simNao(valor: boolean | null) {
  return valor ? 'sim' : 'não'
}

export default function FaturamentoDetalhePage({ params }: { params: Promise<{ id: string; faturamentoId: string }> }) {
  const { id: clienteId, faturamentoId } = use(params)
  const [faturamento, setFaturamento] = useState<FaturamentoDetalhe | null>(null)
  const [contratos, setContratos] = useState<OpcaoContrato[] | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [editando, setEditando] = useState(false)

  async function carregar() {
    try {
      const response = await fetch(`/api/faturamentos/${faturamentoId}`)
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        setErro(body?.error ?? 'Falha ao carregar o faturamento.')
        return
      }
      setErro(null)
      setFaturamento(await response.json())
    } catch {
      setErro('Falha de conexão ao carregar o faturamento.')
    }
  }

  useEffect(() => {
    carregar().finally(() => setCarregando(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [faturamentoId])

  function abrirEdicao() {
    setEditando(true)
    if (contratos) return
    fetch(`/api/clientes/${clienteId}/contratos`)
      .then(async (response) => {
        if (!response.ok) return
        const lista = await response.json()
        if (Array.isArray(lista)) setContratos(lista)
      })
      .catch(() => {})
  }

  if (carregando) {
    return (
      <main className="mx-auto max-w-[110rem] px-6 py-8 lg:px-8">
        <p className="flex items-center gap-2 text-sm text-mid-grey">
          <Loader2 className="size-4 animate-spin" strokeWidth={2.25} />
          Carregando...
        </p>
      </main>
    )
  }

  if (!faturamento) {
    return (
      <main className="mx-auto max-w-[110rem] px-6 py-8 lg:px-8">
        <p className="flex items-center gap-2 rounded-xl bg-red-crit-light p-4 text-sm text-red-crit">
          <AlertCircle className="size-4 shrink-0" strokeWidth={2.25} />
          {erro ?? 'Faturamento não encontrado.'}
        </p>
      </main>
    )
  }

  const titulo = `Faturamento ${competencia(faturamento)}`
  const detalhes: Array<{ rotulo: string; valor: ReactNode }> = [
    { rotulo: 'Contrato', valor: faturamento.contrato.numeroTermo ?? '—' },
    { rotulo: 'SEI', valor: <SeiLink numero={faturamento.sei} className="text-sm" /> },
    { rotulo: 'Unidade destino', valor: faturamento.unidadeDestino ?? '—' },
    { rotulo: 'Valor', valor: faturamento.semNota ? 'sem nota' : formatarMoeda(faturamento.valorExibido) },
    { rotulo: 'Enviado ao cliente', valor: simNao(faturamento.enviadoCliente) },
    { rotulo: 'Enviado à GFP', valor: simNao(faturamento.enviadoGfp) },
  ]

  return (
    <main className="mx-auto max-w-[110rem] space-y-8 px-6 py-8 lg:px-8">
      <div className="space-y-3">
        <nav className="flex items-center gap-1.5 text-xs font-medium text-mid-grey">
          <span>Relatórios</span>
          <ChevronRight className="size-3" strokeWidth={2.5} />
          <Link href="/clientes" className="hover:text-navy hover:underline">
            Clientes
          </Link>
          <ChevronRight className="size-3" strokeWidth={2.5} />
          <Link href={`/clientes/${clienteId}?aba=faturamento`} className="hover:text-navy hover:underline">
            Faturamento
          </Link>
          <ChevronRight className="size-3" strokeWidth={2.5} />
          <span className="font-semibold text-navy">{competencia(faturamento)}</span>
        </nav>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <h1 className="text-[1.75rem] leading-tight font-semibold tracking-tight text-navy">{titulo}</h1>
            {faturamento.servicos.length > 0 && <p className="text-sm text-mid-grey">{faturamento.servicos.join(', ')}</p>}
          </div>
          {!editando && (
            <button type="button" onClick={abrirEdicao} className={BTN_OUTLINE}>
              <Pencil className="size-3.5" strokeWidth={2.25} />
              Editar faturamento
            </button>
          )}
        </div>
      </div>

      {editando ? (
        <FormularioFaturamento
          clienteId={clienteId}
          contratos={contratos}
          faturamento={faturamento}
          aoSalvar={(salvo) => {
            setFaturamento((atual) => (atual ? { ...atual, ...salvo } : atual))
            setEditando(false)
          }}
          aoCancelar={() => setEditando(false)}
        />
      ) : (
        <dl className="card grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {detalhes.map(({ rotulo, valor }) => (
            <div key={rotulo}>
              <dt className="text-xs text-mid-grey">{rotulo}</dt>
              <dd className="font-mono text-sm font-semibold break-words text-navy">{valor}</dd>
            </div>
          ))}
          {faturamento.observacao && (
            <div className="col-span-full">
              <dt className="text-xs text-mid-grey">Observação</dt>
              <dd className="text-sm">{faturamento.observacao}</dd>
            </div>
          )}
        </dl>
      )}

      <SecaoNotas faturamentoId={faturamento.id} notas={faturamento.notas} aoMudar={carregar} />
    </main>
  )
}
