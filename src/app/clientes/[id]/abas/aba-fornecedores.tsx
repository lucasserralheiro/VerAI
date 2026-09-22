'use client'

import { SecaoTermos } from '@/components/relatorios-clientes/secao-termos'

export function AbaFornecedores({ clienteId }: { clienteId: string }) {
  return <SecaoTermos por="cliente" id={clienteId} />
}
