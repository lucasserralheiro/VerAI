'use client'

import { ControleFaturamento } from '@/components/relatorios-clientes/controle-faturamento'

export function AbaControle({ clienteId }: { clienteId: string }) {
  return <ControleFaturamento clienteId={clienteId} />
}
