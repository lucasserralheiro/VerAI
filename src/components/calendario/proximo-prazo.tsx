'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CalendarDays } from 'lucide-react'
import { formatarData } from '@/lib/relatorios-clientes/formatacao'
import { quandoTexto, ROTULO_TIPO, type ProximoPrazo } from '@/lib/calendario/tipos'

/** "Próximo prazo do faturamento: encerramento — 08/10 (em 9 dias)", levando ao calendário (spec
 *  2026-09-29-calendario-faturamento §6). Sem calendário lido com prova, não aparece. */
export function ProximoPrazoFaturamento() {
  const [p, setP] = useState<ProximoPrazo | null>(null)
  useEffect(() => {
    let ativo = true
    fetch('/api/calendario-faturamento/proximos?n=1')
      .then((r) => (r.ok ? r.json() : null))
      .then((c) => {
        if (ativo && c?.proximos?.[0]) setP(c.proximos[0])
      })
      .catch(() => {})
    return () => {
      ativo = false
    }
  }, [])
  if (!p) return null
  return (
    <Link href="/calendario-faturamento" className="inline-flex items-center gap-1.5 text-xs text-navy hover:text-orange hover:underline">
      <CalendarDays className="size-3.5" aria-hidden="true" />
      Próximo prazo do faturamento: {ROTULO_TIPO[p.tipo].toLowerCase()} — {formatarData(p.inicio).slice(0, 5)} ({quandoTexto(p)})
    </Link>
  )
}
