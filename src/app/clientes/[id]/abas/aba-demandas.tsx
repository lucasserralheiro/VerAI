'use client'

import { ListaDemandas } from '@/components/relatorios-clientes/lista-demandas'

export function AbaDemandas({ clienteId }: { clienteId: string }) {
  return <ListaDemandas clienteId={clienteId} />
}
