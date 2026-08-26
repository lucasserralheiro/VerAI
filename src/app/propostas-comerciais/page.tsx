'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, Eye, Inbox } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { BTN_PRIMARY } from '@/lib/ui'

interface PropostaComercial {
  id: string
  nomeArquivo: string
  status: string
  createdAt: string
}

const STATUS_BADGE: Record<string, 'success' | 'neutral' | 'critical'> = {
  concluido: 'success',
  rascunho: 'neutral',
  erro: 'critical',
}

const STATUS_LABEL: Record<string, string> = {
  concluido: 'Concluído',
  rascunho: 'Rascunho',
  erro: 'Erro',
}

export default function PropostasComerciaisPage() {
  const [propostas, setPropostas] = useState<PropostaComercial[]>([])
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    fetch('/api/propostas-comerciais')
      .then((r) => (r.ok ? r.json() : []))
      .then(setPropostas)
      .finally(() => setCarregando(false))
  }, [])

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-6 py-8 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <span className="text-xs font-semibold tracking-wide text-orange uppercase">Proposta Comercial</span>
          <h1 className="text-2xl font-bold text-navy">Proposta Comercial (Conversão SEI)</h1>
        </div>
        <Link href="/propostas-comerciais/novo" className={BTN_PRIMARY}>
          <Plus className="size-3.5" strokeWidth={2.25} />
          Nova conversão
        </Link>
      </div>

      <div className="card-flush">
        {carregando ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="skeleton h-10 w-full" />
            ))}
          </div>
        ) : propostas.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-10 text-center">
            <span className="flex size-11 items-center justify-center rounded-full bg-light-grey text-mid-grey">
              <Inbox className="size-5" strokeWidth={1.75} />
            </span>
            <p className="text-sm text-mid-grey">Nenhuma conversão ainda.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-institucional">
              <thead>
                <tr>
                  <th>Arquivo</th>
                  <th>Data</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {propostas.map((proposta) => (
                  <tr key={proposta.id}>
                    <td className="font-medium text-navy">{proposta.nomeArquivo}</td>
                    <td className="text-mid-grey">{new Date(proposta.createdAt).toLocaleString('pt-BR')}</td>
                    <td>
                      <Badge variant={STATUS_BADGE[proposta.status] ?? 'neutral'}>
                        {STATUS_LABEL[proposta.status] ?? proposta.status}
                      </Badge>
                    </td>
                    <td>
                      <Link
                        href={`/propostas-comerciais/${proposta.id}`}
                        className="flex items-center gap-1 text-sm font-medium text-navy transition-colors hover:text-orange hover:underline"
                      >
                        <Eye className="size-3.5" strokeWidth={2.25} />
                        Ver
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  )
}
