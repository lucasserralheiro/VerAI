'use client'

// Período do reajuste (spec §2.2 passo 2): sugestão = últimos 12 publicados; o usuário muda os dois meses.
import { calcularPeriodo } from '@/lib/reajuste/calculo'
import { nomeDoMes } from '@/lib/reajuste/meses'
import { INPUT_BASE } from '@/lib/ui'

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
  return (
    <section className="space-y-3 rounded-lg border p-4">
      <h2 className="font-semibold text-navy">2. Período</h2>
      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex flex-col gap-1">
          Mês inicial
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
        <label className="flex flex-col gap-1">
          Mês final
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
      {calculo.ok ? (
        <>
          <p className="text-sm text-navy">
            {nomeDoMes(props.inicial)} a {nomeDoMes(props.final)} ({calculo.meses.length}{' '}
            {calculo.meses.length === 1 ? 'mês' : 'meses'}): <strong>{pct(calculo.acumuladoPct)} %</strong> — fator{' '}
            {calculo.fator.replace('.', ',')}
          </p>
          <p className="text-xs text-mid-grey">{calculo.meses.map((m) => `${nomeDoMes(m.mes)} ${pct(m.variacao)}`).join(' · ')}</p>
        </>
      ) : (
        <p className="text-sm text-red-700">
          {'faltando' in calculo ? `Índice ainda não publicado: ${calculo.faltando.map(nomeDoMes).join(', ')}` : calculo.erro}
        </p>
      )}
    </section>
  )
}
