'use client'

import { ChevronRight } from 'lucide-react'
import { ListaDemandas } from '@/components/relatorios-clientes/lista-demandas'

export default function DemandasPage() {
  return (
    <main className="mx-auto max-w-7xl space-y-6 px-6 py-8 lg:px-8">
      <div className="space-y-3">
        <nav className="flex items-center gap-1.5 text-xs font-medium text-mid-grey">
          <span>Relatórios</span>
          <ChevronRight className="size-3" strokeWidth={2.5} />
          <span className="font-semibold text-navy">Demandas</span>
        </nav>
        <div>
          <h1 className="text-[1.75rem] leading-tight font-semibold tracking-tight text-navy">Demandas</h1>
          <p className="text-sm text-mid-grey">Assuntos de todos os clientes que você acompanha</p>
        </div>
      </div>
      <ListaDemandas />
    </main>
  )
}
