'use client'

import { AlertCircle } from 'lucide-react'
import type { ClienteCarteira } from '@/lib/gerencias/tipos'
import { INPUT_BASE } from '@/lib/ui'

export async function erroDaResposta(resposta: Response, padrao: string): Promise<string> {
  const corpo = await resposta.json().catch(() => null)
  return corpo?.error ?? padrao
}

export function MensagemErro({ erro }: { erro: string | null }) {
  if (!erro) return null
  return (
    <p className="flex items-center gap-1.5 rounded-lg bg-red-crit-light px-3 py-2 text-sm text-red-crit">
      <AlertCircle className="size-4 shrink-0" strokeWidth={2.25} />
      {erro}
    </p>
  )
}

export function filtrarClientes<T extends ClienteCarteira>(lista: T[], busca: string): T[] {
  const termo = busca.trim().toLowerCase()
  if (!termo) return lista
  return lista.filter((c) => c.nome.toLowerCase().includes(termo) || (c.siglaLegado ?? '').toLowerCase().includes(termo))
}

interface SelecionaveisProps {
  clientes: (ClienteCarteira & { rotulo?: string })[]
  selecionados: string[]
  onAlternar: (id: string) => void
  busca: string
  onBusca: (valor: string) => void
}

/** Lista de clientes com busca por nome/sigla e caixas de seleção. */
export function ClientesSelecionaveis({ clientes, selecionados, onAlternar, busca, onBusca }: SelecionaveisProps) {
  const visiveis = filtrarClientes(clientes, busca)
  return (
    <div className="space-y-2">
      <input
        type="search"
        value={busca}
        onChange={(e) => onBusca(e.target.value)}
        placeholder="Buscar por nome ou sigla"
        aria-label="Buscar cliente"
        className={INPUT_BASE}
      />
      <ul className="max-h-72 divide-y divide-line overflow-y-auto rounded-lg border border-line">
        {visiveis.map((c) => (
          <li key={c.id} className="px-3 py-1.5 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                aria-label={`Selecionar ${c.nome}`}
                checked={selecionados.includes(c.id)}
                onChange={() => onAlternar(c.id)}
              />
              <span className="text-navy">{c.nome}</span>
              {c.siglaLegado && <span className="text-xs text-mid-grey">{c.siglaLegado}</span>}
              {c.rotulo && <span className="text-xs text-orange">{c.rotulo}</span>}
            </label>
          </li>
        ))}
        {visiveis.length === 0 && <li className="px-3 py-2 text-sm text-mid-grey">Nenhum cliente.</li>}
      </ul>
    </div>
  )
}
