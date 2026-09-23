'use client'

import { use, useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronRight, Loader2, AlertCircle, Pencil } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BTN_PRIMARY, BTN_OUTLINE, INPUT_BASE } from '@/lib/ui'
import { ABAS, abaPorId } from './abas/abas'
import { IndicadoresCliente } from './indicadores-cliente'

interface Cliente {
  id: string
  nome: string
  siglaLegado: string | null
  endereco: string | null
  numero: string | null
  bairro: string | null
}

type CamposCliente = Record<'nome' | 'siglaLegado' | 'endereco' | 'numero' | 'bairro', string>

const CAMPOS_CLIENTE: Array<{ campo: keyof CamposCliente; rotulo: string }> = [
  { campo: 'nome', rotulo: 'Nome' },
  { campo: 'siglaLegado', rotulo: 'Sigla' },
  { campo: 'endereco', rotulo: 'Endereço' },
  { campo: 'numero', rotulo: 'Número' },
  { campo: 'bairro', rotulo: 'Bairro' },
]

/** `endereco, numero — bairro`, pulando o que estiver vazio. */
function linhaEndereco(cliente: Cliente): string {
  const rua = [cliente.endereco, cliente.numero].filter(Boolean).join(', ')
  return [rua, cliente.bairro].filter(Boolean).join(' — ')
}

function FormularioCliente({
  cliente,
  aoSalvar,
  aoCancelar,
}: {
  cliente: Cliente
  aoSalvar: (atualizado: Cliente) => void
  aoCancelar: () => void
}) {
  const [campos, setCampos] = useState<CamposCliente>({
    nome: cliente.nome,
    siglaLegado: cliente.siglaLegado ?? '',
    endereco: cliente.endereco ?? '',
    numero: cliente.numero ?? '',
    bairro: cliente.bairro ?? '',
  })
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setErro(null)
    setSalvando(true)
    const response = await fetch(`/api/clientes/${cliente.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(campos),
    }).finally(() => setSalvando(false))
    if (!response.ok) {
      const body = await response.json().catch(() => null)
      setErro(body?.error ?? 'Falha ao salvar cliente.')
      return
    }
    aoSalvar(await response.json())
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {CAMPOS_CLIENTE.map(({ campo, rotulo }) => (
          <label key={campo} className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-medium text-mid-grey">{rotulo}</span>
            <input
              type="text"
              value={campos[campo]}
              onChange={(e) => setCampos((atual) => ({ ...atual, [campo]: e.target.value }))}
              required={campo === 'nome'}
              className={INPUT_BASE}
            />
          </label>
        ))}
      </div>
      {erro && (
        <p className="flex items-center gap-1.5 rounded-lg bg-red-crit-light px-3 py-2 text-sm text-red-crit">
          <AlertCircle className="size-4 shrink-0" strokeWidth={2.25} />
          {erro}
        </p>
      )}
      <div className="flex gap-2">
        <button type="submit" disabled={salvando} className={BTN_PRIMARY}>
          Salvar
        </button>
        <button type="button" onClick={aoCancelar} className={BTN_OUTLINE}>
          Cancelar
        </button>
      </div>
    </form>
  )
}

export default function ClienteDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const searchParams = useSearchParams()
  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [editando, setEditando] = useState(false)

  const abaAtiva = abaPorId(searchParams.get('aba'))
  const ConteudoAba = abaAtiva.Componente

  useEffect(() => {
    fetch(`/api/clientes/${id}`)
      .then(async (response) => {
        if (response.ok) setCliente(await response.json())
      })
      .finally(() => setCarregando(false))
  }, [id])

  if (carregando) {
    return (
      <main className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
        <p className="flex items-center gap-2 text-sm text-mid-grey">
          <Loader2 className="size-4 animate-spin" strokeWidth={2.25} />
          Carregando...
        </p>
      </main>
    )
  }

  if (!cliente) {
    return (
      <main className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
        <p className="flex items-center gap-2 rounded-xl bg-red-crit-light p-4 text-sm text-red-crit">
          <AlertCircle className="size-4 shrink-0" strokeWidth={2.25} />
          Cliente não encontrado ou sem acesso.
        </p>
      </main>
    )
  }

  const endereco = linhaEndereco(cliente)

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-6 py-8 lg:px-8">
      <div className="space-y-3">
        <nav className="flex items-center gap-1.5 text-xs font-medium text-mid-grey">
          <span>Relatórios</span>
          <ChevronRight className="size-3" strokeWidth={2.5} />
          <Link href="/clientes" className="hover:text-navy hover:underline">
            Clientes
          </Link>
          <ChevronRight className="size-3" strokeWidth={2.5} />
          <span className="font-semibold text-navy">{cliente.nome}</span>
        </nav>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            {cliente.siglaLegado && (
              <span className="shrink-0 rounded-lg bg-navy px-3 py-2 font-mono text-[0.95rem] font-semibold tracking-wide text-white">
                {cliente.siglaLegado}
              </span>
            )}
            <div className="min-w-0">
              <h1 className="text-[1.75rem] leading-tight font-semibold tracking-tight text-navy">{cliente.nome}</h1>
              {endereco && <p className="text-sm text-mid-grey">{endereco}</p>}
            </div>
          </div>

          {!editando && (
            <button onClick={() => setEditando(true)} className={BTN_OUTLINE}>
              <Pencil className="size-3.5" strokeWidth={2.25} />
              Editar cliente
            </button>
          )}
        </div>
      </div>

      {editando && (
        <FormularioCliente
          cliente={cliente}
          aoSalvar={(atualizado) => {
            setCliente(atualizado)
            setEditando(false)
          }}
          aoCancelar={() => setEditando(false)}
        />
      )}

      <IndicadoresCliente clienteId={id} />

      <div role="tablist" className="flex gap-6 overflow-x-auto border-b border-border-grey">
        {ABAS.map((aba) => {
          const Icon = aba.icon
          const ativa = aba.id === abaAtiva.id
          return (
            <button
              key={aba.id}
              role="tab"
              aria-selected={ativa}
              onClick={() => router.replace(`/clientes/${id}?aba=${aba.id}`, { scroll: false })}
              className={cn(
                'group relative flex shrink-0 items-center gap-2 py-3 text-[0.8rem] whitespace-nowrap transition-colors',
                ativa ? 'font-semibold text-navy' : 'font-medium text-mid-grey hover:text-navy'
              )}
            >
              <Icon
                className={cn('size-3.5 transition-colors', ativa ? 'text-orange' : 'text-mid-grey/70 group-hover:text-navy')}
                strokeWidth={2.25}
              />
              {aba.label}
              <span
                className={cn(
                  'absolute inset-x-0 -bottom-px h-[2.5px] rounded-full bg-orange transition-transform duration-200 ease-out',
                  ativa ? 'scale-x-100' : 'scale-x-0'
                )}
              />
            </button>
          )
        })}
      </div>

      <section role="tabpanel" aria-label={abaAtiva.label}>
        <ConteudoAba clienteId={id} />
      </section>
    </main>
  )
}
