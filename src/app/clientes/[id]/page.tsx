'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronRight, AlertCircle, Pencil } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BTN_OUTLINE } from '@/lib/ui'
import { ABAS, abaPorId } from './abas/abas'
import { IndicadoresCliente } from './indicadores-cliente'
import { ModalCliente } from '../modal-cliente'
import { SeloCarteira, usePermissaoCliente } from './permissao-cliente'
import { preCarregar } from '@/lib/relatorios-clientes/prefetch'
import { registrarClienteRecente } from '@/components/clientes-recentes'

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
  const { podeEditar, gerencia } = usePermissaoCliente()
  const searchParams = useSearchParams()
  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [editando, setEditando] = useState(false)

  const abaAtiva = abaPorId(searchParams.get('aba'))

  // Abas já visitadas ficam montadas (só escondidas): trocar de aba e voltar não desmonta o
  // componente, então não refaz a busca nem mostra "Carregando..." de novo. A aba só busca
  // dados na primeira vez que é aberta.
  const [visitadas, setVisitadas] = useState<ReadonlySet<string>>(() => new Set([abaAtiva.id]))
  useEffect(() => {
    setVisitadas((atual) => (atual.has(abaAtiva.id) ? atual : new Set(atual).add(abaAtiva.id)))
  }, [abaAtiva.id])

  // O que cada aba pede na primeira abertura (mesmas URLs/opções que ela usa — ver a carga inicial
  // de cada `aba-*.tsx`). Fica aqui, ao lado da lista de abas, pra não divergir sem ninguém ver.
  const preCargaDaAba: Record<string, Array<[string, RequestInit?]>> = {
    documentos: [[`/api/documentos?clienteId=${id}`]],
    contratos: [[`/api/clientes/${id}/itens-aguardando`, { cache: 'no-store' }], [`/api/clientes/${id}/contratos`]],
    faturamento: [[`/api/clientes/${id}/faturamentos`]],
    fornecedores: [[`/api/termos-confirmacao?clienteId=${id}`]],
    controle: [[`/api/controle-faturamento?clienteId=${id}`]],
    demandas: [[`/api/demandas?clienteId=${id}`]],
    solicitacoes: [[`/api/solicitacoes?clienteId=${id}`]],
    responsaveis: [[`/api/clientes/${id}/responsaveis`]],
  }

  // Entra em "Clientes recentes" do menu lateral (e atualiza o nome se ele foi editado).
  useEffect(() => {
    if (cliente) registrarClienteRecente({ id: cliente.id, nome: cliente.nome, sigla: cliente.siglaLegado })
  }, [cliente])

  useEffect(() => {
    fetch(`/api/clientes/${id}`)
      .then(async (response) => {
        if (response.ok) setCliente(await response.json())
      })
      .finally(() => setCarregando(false))
  }, [id])

  // Depois que a ficha carregou, aquece as outras abas em segundo plano, uma requisição por vez
  // (não disputa conexão com a aba aberta): a primeira abertura de cada aba deixa de mostrar spinner.
  useEffect(() => {
    if (carregando || !cliente) return
    let cancelado = false
    ;(async () => {
      for (const aba of ABAS) {
        if (aba.id === abaAtiva.id) continue
        for (const [url, init] of preCargaDaAba[aba.id] ?? []) {
          if (cancelado) return
          await preCarregar(url, init)
        }
      }
    })()
    return () => {
      cancelado = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carregando, cliente?.id, id])

  if (!carregando && !cliente) {
    return (
      <main className="mx-auto max-w-[96rem] px-6 py-8 lg:px-8">
        <p className="flex items-center gap-2 rounded-xl bg-red-crit-light p-4 text-sm text-red-crit">
          <AlertCircle className="size-4 shrink-0" strokeWidth={2.25} />
          Cliente não encontrado ou sem acesso.
        </p>
      </main>
    )
  }

  const endereco = cliente ? linhaEndereco(cliente) : ''

  return (
    <main className="mx-auto max-w-[96rem] space-y-6 px-6 py-8 lg:px-8">
      <div className="space-y-3">
        <nav className="flex items-center gap-1.5 text-xs font-medium text-mid-grey">
          <span>Relatórios</span>
          <ChevronRight className="size-3" strokeWidth={2.5} />
          <Link href="/clientes" className="hover:text-navy hover:underline">
            Clientes
          </Link>
          <ChevronRight className="size-3" strokeWidth={2.5} />
          {cliente ? (
            <span className="font-semibold text-navy">{cliente.nome}</span>
          ) : (
            <span className="h-3 w-40 animate-pulse rounded bg-border-grey" aria-hidden />
          )}
        </nav>

        {cliente ? (
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              {cliente.siglaLegado && (
                <span className="shrink-0 rounded-lg bg-navy px-3 py-2 font-mono text-[0.95rem] font-semibold tracking-wide text-white">
                  {cliente.siglaLegado}
                </span>
              )}
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-[1.75rem] leading-tight font-semibold tracking-tight text-navy">{cliente.nome}</h1>
                  <SeloCarteira gerencia={gerencia} />
                </div>
                {endereco && <p className="text-sm text-mid-grey">{endereco}</p>}
              </div>
            </div>

            {podeEditar && (
              <button onClick={() => setEditando(true)} className={BTN_OUTLINE}>
                <Pencil className="size-3.5" strokeWidth={2.25} />
                Editar cliente
              </button>
            )}
          </div>
        ) : (
          // Cabeçalho ainda carregando: esqueleto (sem spinner) — o único spinner da tela é o da aba,
          // e a aba já busca os dados em paralelo com a ficha.
          <div className="space-y-2" aria-hidden>
            <div className="h-8 w-96 max-w-full animate-pulse rounded bg-border-grey" />
            <div className="h-4 w-56 animate-pulse rounded bg-border-grey" />
          </div>
        )}
      </div>

      {cliente && (
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
      )}

      <IndicadoresCliente clienteId={id} />

      {/* Fixas no topo ao rolar: com tabela longa (documentos, faturamento) a troca de área continua à mão —
          é a navegação do cliente; o menu lateral não a repete. */}
      <div
        role="tablist"
        className="sticky top-12 z-20 lg:top-0 -mx-6 flex gap-6 overflow-x-auto overflow-y-hidden border-b border-border-grey bg-background/95 px-6 backdrop-blur supports-[backdrop-filter]:bg-background/80 lg:-mx-8 lg:px-8"
      >
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

      {ABAS.filter((aba) => aba.id === abaAtiva.id || visitadas.has(aba.id)).map((aba) => {
        const ConteudoAba = aba.Componente
        return (
          <section key={aba.id} role="tabpanel" aria-label={aba.label} hidden={aba.id !== abaAtiva.id}>
            <ConteudoAba clienteId={id} />
          </section>
        )
      })}
    </main>
  )
}
