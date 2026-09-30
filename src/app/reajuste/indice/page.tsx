'use client'

// Tabela do IPC-Fipe guardada no VerAI (spec docs/superpowers/specs/2026-09-30-reajuste-ipc-fipe-design.md §2.5).
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronRight, RefreshCw } from 'lucide-react'
import { calcularPeriodo } from '@/lib/reajuste/calculo'
import { nomeDoMes, somarMeses } from '@/lib/reajuste/meses'
import { BTN_OUTLINE } from '@/lib/ui'

interface Indice {
  meses: Array<{ mes: string; variacao: string }>
  atualizadoEm: string | null
}
interface Sincronizacao {
  novos: number
  confirmados: number
  divergentes: Array<{ mes: string; gravado: string; fonte: string }>
}

const pct = (valor: string) => Number(valor).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function TabelaDoIndicePage() {
  const [indice, setIndice] = useState<Indice | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [atualizando, setAtualizando] = useState(false)
  const [sincronizacao, setSincronizacao] = useState<Sincronizacao | null>(null)

  const carregar = useCallback(() => {
    fetch('/api/reajuste/indice')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(setIndice)
      .catch(() => setErro('Não foi possível carregar o índice.'))
  }, [])
  useEffect(carregar, [carregar])

  async function atualizar() {
    setAtualizando(true)
    setErro(null)
    const r = await fetch('/api/reajuste/indice', { method: 'POST' })
    const corpo = await r.json().catch(() => null)
    setAtualizando(false)
    if (!r.ok) return setErro(corpo?.error ?? 'Falha ao atualizar.')
    setSincronizacao(corpo)
    carregar()
  }

  const linhas = useMemo(() => {
    if (!indice) return []
    const mapa = new Map(indice.meses.map((m) => [m.mes, m.variacao]))
    return [...indice.meses].reverse().map((m) => {
      const doze = calcularPeriodo(somarMeses(m.mes, -11), m.mes, mapa)
      return { ...m, acumulado12: doze.ok ? doze.acumuladoPct : null }
    })
  }, [indice])

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-6 py-8 lg:px-8">
      <div className="space-y-3">
        <nav className="flex items-center gap-1.5 text-xs font-medium text-mid-grey">
          <span>Reajuste IPC-Fipe</span>
          <ChevronRight className="size-3" strokeWidth={2.5} />
          <span className="font-semibold text-navy">Tabela do índice</span>
        </nav>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-[1.75rem] leading-tight font-semibold tracking-tight text-navy">Tabela do índice</h1>
            <p className="text-sm text-mid-grey">
              IPC-Fipe mensal, do Banco Central (série 193).
              {indice?.atualizadoEm && ` Atualizado em ${new Date(indice.atualizadoEm).toLocaleString('pt-BR')}.`}
            </p>
          </div>
          <button type="button" className={BTN_OUTLINE} onClick={atualizar} disabled={atualizando}>
            <RefreshCw className={atualizando ? 'size-4 animate-spin' : 'size-4'} /> Atualizar agora
          </button>
        </div>
      </div>

      {erro && <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</p>}
      {sincronizacao && (
        <div className="rounded-md bg-slate-50 px-4 py-3 text-sm text-navy">
          {sincronizacao.novos === 1 ? '1 mês novo' : `${sincronizacao.novos} meses novos`}, {sincronizacao.confirmados} confirmados.
          {sincronizacao.divergentes.map((d) => (
            <p key={d.mes} className="mt-1 text-orange-dark">
              {nomeDoMes(d.mes)}: gravado {pct(d.gravado)} %, o Banco Central agora diz {pct(d.fonte)} % — mantido o gravado; confira.
            </p>
          ))}
        </div>
      )}

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-mid-grey">
            <th className="py-2">Mês</th>
            <th className="py-2 text-right">Variação (%)</th>
            <th className="py-2 text-right">Acumulado 12 meses (%)</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => (
            <tr key={l.mes} className="border-b last:border-0">
              <td className="py-1.5 text-navy">{nomeDoMes(l.mes)}</td>
              <td className="py-1.5 text-right tabular-nums">{pct(l.variacao)}</td>
              <td className="py-1.5 text-right tabular-nums">{l.acumulado12 === null ? '—' : pct(l.acumulado12)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  )
}
