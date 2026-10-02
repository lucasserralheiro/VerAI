'use client'

import { use } from 'react'
import { DetalheGerencia } from '@/components/gerencias/detalhe-gerencia'

export default function AdminGerenciaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return <DetalheGerencia gerenciaId={id} modo="admin" />
}
