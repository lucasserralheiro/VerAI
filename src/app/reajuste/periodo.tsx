'use client'

// Período do reajuste (spec §2.2 passo 2): sugestão = últimos 12 publicados; o usuário muda os dois meses.
import { RefreshCw } from 'lucide-react'
import { calcularPeriodo, periodoSugerido } from '@/lib/reajuste/calculo'
import { nomeDoMes, somarMeses } from '@/lib/reajuste/meses'
import { BTN_OUTLINE, INPUT_BASE } from '@/lib/ui'

const pct = (v: string) => Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function Periodo(props: {
  indice: Map<string, string>
  meses: string[] // publicados, em ordem crescente — opções dos seletores
  inicial: string
  final: string
  onMudar: (inicial: string, final: string) => void
}) {
  const calculo = calcularPeriodo(props.inicial, props.final, props.indice)
  const opcoes = [...props.meses].reverse()
  const ultimo = props.meses.at(-1)
  const atalhos = ultimo
    ? [
        { rotulo: '12 meses', ...periodoSugerido(ultimo) },
        { rotulo: '6 meses', inicial: somarMeses(ultimo, -5), final: ultimo },
        { rotulo: '24 meses', inicial: somarMeses(ultimo, -23), final: ultimo },
      ].filter((a) => props.indice.has(a.inicial))
    : []
  const maior = calculo.ok ? Math.max(...calculo.meses.map((m) => Math.abs(Number(m.variacao))), 0.01) : 1

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 text-sm">
        <label className="flex flex-col gap-1 text-xs font-medium text-mid-grey">
          De
          <select
            aria-label="Mês inicial"
            className={INPUT_BASE}
            value={props.inicial}
            onChange={(e) => props.onMudar(e.target.value, props.final)}
          >
            {opcoes.map((m) => (
              <option key={m} value={m}>
                {nomeDoMes(m)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-mid-grey">
          Até
          <select
            aria-label="Mês final"
            className={INPUT_BASE}
            value={props.final}
            onChange={(e) => props.onMudar(props.inicial, e.target.value)}
          >
            {opcoes.map((m) => (
              <option key={m} value={m}>
                {nomeDoMes(m)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {atalhos.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {atalhos.map((a) => {
            const ativo = a.inicial === props.inicial && a.final === props.final
            return (
              <button
                key={a.rotulo}
                type="button"
                onClick={() => props.onMudar(a.inicial, a.final)}
                className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors ${
                  ativo ? 'border-navy bg-navy text-white' : 'border-border-grey text-navy hover:border-navy/35'
                }`}
              >
                Últimos {a.rotulo}
              </button>
            )
          })}
        </div>
      )}

      {calculo.ok ? (
        <div className="rounded-xl bg-navy px-4 py-3 text-white">
          <p className="text-xs text-white/70">
            {nomeDoMes(props.inicial)} a {nomeDoMes(props.final)} · {calculo.meses.length}{' '}
            {calculo.meses.length === 1 ? 'mês' : 'meses'}
          </p>
          <p className="mt-0.5 text-3xl font-semibold tracking-tight tabular-nums">{pct(calculo.acumuladoPct)} %</p>
          <p className="text-xs text-white/70 tabular-nums">fator {calculo.fator.replace('.', ',')}</p>
          {/* Cada mês do período, pra ver de onde vem o acumulado. */}
          <div className="mt-3 flex h-10 items-end gap-0.5" aria-hidden="true">
            {calculo.meses.map((m) => {
              const v = Number(m.variacao)
              return (
                <div
                  key={m.mes}
                  title={`${nomeDoMes(m.mes)}: ${pct(m.variacao)} %`}
                  className={`min-w-1 flex-1 rounded-sm ${v < 0 ? 'bg-red-300' : 'bg-orange'}`}
                  style={{ height: `${Math.max(6, (Math.abs(v) / maior) * 100)}%` }}
                />
              )
            })}
          </div>
        </div>
      ) : (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {'faltando' in calculo ? `Índice ainda não publicado: ${calculo.faltando.map(nomeDoMes).join(', ')}` : calculo.erro}
        </p>
      )}
    </div>
  )
}

/** Sem nenhum mês gravado ainda (banco novo): busca no Banco Central aqui mesmo. */
export function SemIndice(props: { atualizando: boolean; onAtualizar: () => void }) {
  return (
    <div className="space-y-3 rounded-xl border border-dashed border-border-grey p-4 text-sm">
      <p className="text-navy">Nenhum mês do IPC-Fipe gravado ainda.</p>
      <button type="button" className={BTN_OUTLINE} onClick={props.onAtualizar} disabled={props.atualizando}>
        <RefreshCw className={props.atualizando ? 'size-4 animate-spin' : 'size-4'} /> Buscar no Banco Central
      </button>
    </div>
  )
}
