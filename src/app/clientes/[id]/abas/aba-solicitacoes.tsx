'use client'

import { ListaSolicitacoes } from '@/components/relatorios-clientes/lista-solicitacoes'

export function AbaSolicitacoes({ clienteId }: { clienteId: string }) {
  return <ListaSolicitacoes clienteId={clienteId} />
}
