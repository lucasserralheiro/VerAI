'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronRight, Loader2, AlertCircle, Pencil } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BTN_OUTLINE } from '@/lib/ui'
import { ABAS, abaPorId } from './abas/abas'
import { IndicadoresCliente } from './indicadores-cliente'
import { ModalCliente } from '../modal-cliente'

interface Cliente {
  id: string
  nome: string
  siglaLegado: string | null
  endereco: string | null
  numero: string | null
  bairro: string | null
}

/** `endereco, numero — bairro`, pulando o que estiver vazio. */
function linhaEndereco(cliente: Cliente): string {
  // O legado grava "0" quando não há número — não é dado, é ausência.
  const numero = cliente.numero?.trim() === '0' ? null : cliente.numero
  const rua = [cliente.endereco, numero].filter(Boolean).join(', ')
  return [rua, cliente.bairro].filter(Boolean).join(' — ')
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
      <main className="mx-auto max-w-[110rem] px-6 py-8 lg:px-8">
        <p className="flex items-center gap-2 text-sm text-mid-grey">
          <Loader2 className="size-4 animate-spin" strokeWidth={2.25} />
          Carregando...
        </p>
      </main>
    )
  }

  if (!cliente) {
    return (
      <main className="mx-auto max-w-[110rem] px-6 py-8 lg:px-8">
        <p className="flex items-center gap-2 rounded-xl bg-red-crit-light p-4 text-sm text-red-crit">
          <AlertCircle className="size-4 shrink-0" strokeWidth={2.25} />
          Cliente não encontrado ou sem acesso.
        </p>
      </main>
    )
  }

  const endereco = linhaEndereco(cliente)

  return (
    <main className="mx-auto max-w-[110rem] space-y-6 px-6 py-8 lg:px-8">
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

          <button onClick={() => setEditando(true)} className={BTN_OUTLINE}>
            <Pencil className="size-3.5" strokeWidth={2.25} />
            Editar cliente
          </button>
        </div>
      </div>

      <ModalCliente
        aberto={editando}
        cliente={cliente}
        aoFechar={() => setEditando(false)}
        aoSalvar={(atualizado) => {
          if (atualizado) setCliente(atualizado)
          setEditando(false)
        }}
        aoExcluir={() => router.push('/clientes')}
      />

      <IndicadoresCliente clienteId={id} />

      <div role="tablist" className="flex gap-6 overflow-x-auto overflow-y-hidden border-b border-border-grey">
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
