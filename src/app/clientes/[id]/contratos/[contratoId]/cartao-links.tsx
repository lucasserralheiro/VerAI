'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Network } from 'lucide-react'
import { nomeDaCompetencia, ROTULO_CATEGORIA, type CategoriaLinks } from '@/lib/links-mpls/tipos'

// "Links MPLS" no detalhe do contrato (spec docs/superpowers/specs/2026-09-29-links-mpls-design.md §6.3): quantos
// links ativos o relatório de faturamento mais recente (conferido) mostra, levando para a tela do contrato. Sem
// relatório, não aparece.

export function CartaoLinks({ contratoId }: { contratoId: string }) {
  const [resumo, setResumo] = useState<{ competencia: string; ativos: number; categorias: CategoriaLinks[] } | null>(null)

  useEffect(() => {
    let ativo = true
    fetch(`/api/links-mpls/contrato/${contratoId}?resumo=1`)
      .then((r) => (r.ok ? r.json() : null))
      .then((corpo) => {
        if (ativo && corpo?.competencia) setResumo(corpo)
      })
      .catch(() => {})
    return () => {
      ativo = false
    }
  }, [contratoId])

  if (!resumo) return null
  return (
    <section aria-label="Links MPLS" className="card flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <Network className="size-4 text-navy" aria-hidden="true" />
        <p className="text-sm text-navy">
          <span className="font-semibold">Links MPLS:</span> {resumo.ativos.toLocaleString('pt-BR')} ativo(s) em {nomeDaCompetencia(resumo.competencia)}
          <span className="text-xs text-mid-grey"> · {resumo.categorias.map((c) => ROTULO_CATEGORIA[c]).join(', ')}</span>
        </p>
      </div>
      <Link href={`/links-mpls/contrato/${contratoId}`} className="text-xs font-medium text-navy hover:text-orange hover:underline">
        Ver links e evolução
      </Link>
    </section>
  )
}
