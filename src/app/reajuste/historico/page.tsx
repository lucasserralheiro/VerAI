'use client'

// Histórico do reajuste por IPC-Fipe (spec docs/superpowers/specs/2026-09-30-reajuste-ipc-fipe-design.md §2.4):
// todo mundo vê tudo, como no ConfereAI.
import { useEffect, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { nomeDoMes } from '@/lib/reajuste/meses'
import { LINK_NAVY } from '@/lib/ui'

interface Execucao {
  id: string
  nomeArquivo: string
  tipoArquivo: string
  mesInicial: string
  mesFinal: string
  acumuladoPct: string
  fator: string
  quantidadeValores: number
  usuario: string
  createdAt: string
}

const pct = (v: string) => Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function HistoricoReajustePage() {
  const [lista, setLista] = useState<Execucao[] | null>(null)
  const [erro, setErro] = useState(false)

  useEffect(() => {
    fetch('/api/reajuste')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(setLista)
      .catch(() => setErro(true))
  }, [])

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-6 py-8 lg:px-8">
      <div className="space-y-3">
        <nav className="flex items-center gap-1.5 text-xs font-medium text-mid-grey">
          <span>Reajuste IPC-Fipe</span>
          <ChevronRight className="size-3" strokeWidth={2.5} />
          <span className="font-semibold text-navy">Histórico</span>
        </nav>
        <h1 className="text-[1.75rem] leading-tight font-semibold tracking-tight text-navy">Histórico de reajustes</h1>
      </div>
      {erro && <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">Não foi possível carregar o histórico.</p>}
      {lista?.length === 0 && <p className="text-sm text-mid-grey">Nenhum reajuste ainda.</p>}
      {lista && lista.length > 0 && (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-mid-grey">
              <th className="py-2">Quando</th>
              <th className="py-2">Quem</th>
              <th className="py-2">Arquivo</th>
              <th className="py-2">Período</th>
              <th className="py-2 text-right">Acumulado</th>
              <th className="py-2 text-right">Valores</th>
              <th className="py-2">Baixar</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((e) => (
              <tr key={e.id} className="border-b last:border-0">
                <td className="py-1.5">{new Date(e.createdAt).toLocaleString('pt-BR')}</td>
                <td className="py-1.5">{e.usuario}</td>
                <td className="py-1.5 text-navy">{e.nomeArquivo}</td>
                <td className="py-1.5">{`${nomeDoMes(e.mesInicial)} a ${nomeDoMes(e.mesFinal)}`}</td>
                <td className="py-1.5 text-right tabular-nums">{`${pct(e.acumuladoPct)} %`}</td>
                <td className="py-1.5 text-right tabular-nums">{e.quantidadeValores}</td>
                <td className="space-x-3 py-1.5">
                  <a className={LINK_NAVY} href={`/api/reajuste/${e.id}/arquivo/original`}>
                    Original
                  </a>
                  <a className={LINK_NAVY} href={`/api/reajuste/${e.id}/arquivo/resultado`}>
                    Resultado
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  )
}
