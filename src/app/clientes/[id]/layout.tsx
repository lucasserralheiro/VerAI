'use client'

import { use } from 'react'
import { FaixaSomenteLeitura, PermissaoClienteProvider } from './permissao-cliente'

export default function ClienteLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  return (
    <PermissaoClienteProvider clienteId={id}>
      <FaixaSomenteLeitura />
      {children}
    </PermissaoClienteProvider>
  )
}
