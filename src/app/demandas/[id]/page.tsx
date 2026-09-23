'use client'

import { use, useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { AlertCircle, AlertTriangle, ChevronRight, Loader2, Pencil } from 'lucide-react'
import { BTN_OUTLINE } from '@/lib/ui'
import { formatarData } from '@/lib/relatorios-clientes/formatacao'
import { SeiLink } from '@/components/relatorios-clientes/sei-link'
import {
  FormularioDemanda,
  rotuloCliente,
  type Demanda,
  type OpcaoCliente,
  type SugestoesDemanda,
} from '@/components/relatorios-clientes/formulario-demanda'
import { SecaoTramites, type SugestoesTramite, type Tramite } from './secao-tramites'

interface DemandaDetalhe extends Demanda {
  tramites: Tramite[]
  sugestoes: SugestoesTramite
}

export default function DemandaDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [demanda, setDemanda] = useState<DemandaDetalhe | null>(null)
  const [clientes, setClientes] = useState<OpcaoCliente[] | null>(null)
  const [sugestoesDemanda, setSugestoesDemanda] = useState<SugestoesDemanda | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [editando, setEditando] = useState(false)

  async function carregar() {
    try {
      const response = await fetch(`/api/demandas/${id}`)
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        setErro(body?.error ?? 'Falha ao carregar a demanda.')
        return
      }
      setErro(null)
      setDemanda(await response.json())
    } catch {
      setErro('Falha de conexão ao carregar a demanda.')
    }
  }

  useEffect(() => {
    carregar().finally(() => setCarregando(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  // O formulário de edição precisa da lista de clientes (é por ele que se corrige a atribuição do
  // import) e das sugestões de situação/tipo — carregadas só quando ele abre.
  function abrirEdicao() {
    setEditando(true)
    if (!clientes) {
      fetch('/api/clientes')
        .then(async (response) => {
          if (!response.ok) return
          const lista = await response.json()
          if (Array.isArray(lista)) setClientes(lista)
        })
        .catch(() => {})
    }
    if (!sugestoesDemanda) {
      fetch('/api/demandas')
        .then(async (response) => {
          if (!response.ok) return
          const corpo = await response.json()
          if (corpo?.sugestoes) setSugestoesDemanda(corpo.sugestoes)
        })
        .catch(() => {})
    }
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

  if (!demanda) {
    return (
      <main className="mx-auto max-w-[110rem] px-6 py-8 lg:px-8">
        <p className="flex items-center gap-2 rounded-xl bg-red-crit-light p-4 text-sm text-red-crit">
          <AlertCircle className="size-4 shrink-0" strokeWidth={2.25} />
          {erro ?? 'Demanda não encontrada.'}
        </p>
      </main>
    )
  }

  const detalhes: Array<{ rotulo: string; valor: ReactNode }> = [
    { rotulo: 'Cliente', valor: rotuloCliente(demanda.cliente) },
    { rotulo: 'Situação', valor: demanda.situacao ?? '—' },
    { rotulo: 'Tipo de assunto', valor: demanda.tipoAssunto ?? '—' },
    { rotulo: 'Tipo de documento', valor: demanda.tipo ?? '—' },
    { rotulo: 'Responsável', valor: demanda.responsavel ?? '—' },
    { rotulo: 'Abertura', valor: formatarData(demanda.dataAbertura) },
    { rotulo: 'Documento', valor: demanda.documento ?? '—' },
    { rotulo: 'SEI', valor: <SeiLink numero={demanda.sei} className="text-sm" /> },
  ]

  return (
    <main className="mx-auto max-w-[110rem] space-y-8 px-6 py-8 lg:px-8">
      <div className="space-y-3">
        <nav className="flex items-center gap-1.5 text-xs font-medium text-mid-grey">
          <span>Relatórios</span>
          <ChevronRight className="size-3" strokeWidth={2.5} />
          <Link href="/demandas" className="hover:text-navy hover:underline">
            Demandas
          </Link>
          <ChevronRight className="size-3" strokeWidth={2.5} />
          <span className="max-w-xs truncate font-semibold text-navy">{demanda.assunto ?? '(sem assunto)'}</span>
        </nav>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="min-w-0 text-[1.6rem] leading-tight font-semibold tracking-tight text-navy">
            {demanda.assunto ?? '(sem assunto)'}
          </h1>
          {!editando && (
            <button type="button" onClick={abrirEdicao} className={BTN_OUTLINE}>
              <Pencil className="size-3.5" strokeWidth={2.25} />
              Editar demanda
            </button>
          )}
        </div>
      </div>

      {demanda.notaImportacao && (
        <p className="flex items-start gap-2 rounded-xl bg-orange-light px-4 py-3 text-sm text-orange-dark">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" strokeWidth={2.25} />
          <span>
            {demanda.notaImportacao}. Confira se o cliente está certo e, se não estiver, corrija em &quot;Editar demanda&quot;.
          </span>
        </p>
      )}

      {editando ? (
        <FormularioDemanda
          demanda={demanda}
          clientes={clientes}
          sugestoes={sugestoesDemanda}
          aoSalvar={(salva) => {
            setDemanda((atual) => (atual ? { ...atual, ...salva } : atual))
            setEditando(false)
          }}
          aoCancelar={() => setEditando(false)}
        />
      ) : (
        <dl className="card grid grid-cols-2 gap-4 sm:grid-cols-4">
          {detalhes.map(({ rotulo, valor }) => (
            <div key={rotulo}>
              <dt className="text-xs text-mid-grey">{rotulo}</dt>
              <dd className="text-sm font-semibold break-words text-navy">{valor}</dd>
            </div>
          ))}
        </dl>
      )}

      <SecaoTramites demandaId={demanda.id} tramites={demanda.tramites} sugestoes={demanda.sugestoes} aoMudar={carregar} />
    </main>
  )
}
