// Indicadores visuais do contrato — semáforo de vencimento e barra de % faturado. Usados na aba
// Contratos da ficha do cliente, no detalhe do contrato e (Task 8) nos relatórios cross-cliente.

import { cn } from '@/lib/utils'
import type { Saldo } from '@/lib/relatorios-clientes/saldo'
import type { SituacaoVencimento } from '@/lib/relatorios-clientes/vencimento'

const ESTILO: Record<SituacaoVencimento['nivel'], string> = {
  vencido: 'bg-red-crit-light text-red-crit',
  critico: 'bg-red-crit-light text-red-crit',
  atencao: 'bg-orange-light text-orange-dark',
  ok: 'bg-green-ok-light text-green-ok',
  'sem-data': 'bg-light-grey text-mid-grey',
}

function texto({ nivel, dias }: SituacaoVencimento): string {
  if (nivel === 'sem-data' || dias === null) return 'sem data'
  if (nivel === 'vencido') return `vencido há ${-dias}d`
  if (nivel === 'ok') return 'vigente'
  return dias === 0 ? 'vence hoje' : `vence em ${dias}d`
}

export function PillVencimento({ vencimento }: { vencimento: SituacaoVencimento }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.72rem] font-bold whitespace-nowrap',
        ESTILO[vencimento.nivel]
      )}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {texto(vencimento)}
    </span>
  )
}

/** `percentualFaturado` null = contrato sem valor (nem histórico nem itens): sem base, nada de barra. */
export function BarraFaturado({ saldo }: { saldo: Saldo }) {
  if (saldo.percentualFaturado === null) return <span className="text-xs text-mid-grey">sem valor</span>
  const percentual = Number(saldo.percentualFaturado)
  return (
    <div className="min-w-24">
      <div className="h-1.5 overflow-hidden rounded-full bg-light-grey">
        <span
          className={cn('block h-full rounded-full', percentual > 100 ? 'bg-red-crit' : 'bg-orange')}
          style={{ width: `${Math.min(percentual, 100)}%` }}
        />
      </div>
      <div className="mt-1 text-[0.7rem] text-mid-grey">{`${Math.round(percentual)}% faturado`}</div>
    </div>
  )
}
