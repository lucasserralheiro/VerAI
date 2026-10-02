'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { LINK_NAVY } from '@/lib/ui'

interface Resumo {
  usuarios: number
  gerencias: number
  clientes: number
  semGerencia: number
}

const CARTOES = [
  { href: '/admin/usuarios', titulo: 'Usuários', texto: 'Cria usuários, define o perfil e vê a quais gerências cada um pertence.' },
  { href: '/admin/gerencias', titulo: 'Gerências e carteiras', texto: 'Cria gerências, nomeia os managers e distribui os clientes de cada carteira.' },
  { href: '/admin/clientes', titulo: 'Clientes', texto: 'Cadastra, mescla e exclui clientes.' },
  { href: '/admin/regras-notificacao', titulo: 'Regras de notificação', texto: 'Define quando e para quem o sistema avisa.' },
  { href: '/admin/assistente', titulo: 'Assistente de IA', texto: 'Acompanha o índice de documentos e o uso do assistente.' },
]

export default function AdminPage() {
  const [resumo, setResumo] = useState<Resumo | null>(null)

  useEffect(() => {
    fetch('/api/admin/resumo')
      .then((r) => (r.ok ? r.json() : null))
      .then((corpo: Resumo | null) => setResumo(corpo))
      .catch(() => {})
  }, [])

  const numeros: Array<{ rotulo: string; valor?: number; alerta?: boolean }> = [
    { rotulo: 'Usuários', valor: resumo?.usuarios },
    { rotulo: 'Gerências', valor: resumo?.gerencias },
    { rotulo: 'Clientes', valor: resumo?.clientes },
    { rotulo: 'Clientes sem gerência', valor: resumo?.semGerencia, alerta: (resumo?.semGerencia ?? 0) > 0 },
  ]

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-6 py-8 lg:px-8">
      <div className="flex items-center gap-2">
        <ShieldCheck className="size-5 text-orange" strokeWidth={2.25} />
        <h1 className="text-2xl font-bold text-navy">Administração</h1>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {numeros.map((n) => {
          const valor = (
            <span className={`text-2xl font-bold ${n.alerta ? 'text-orange' : 'text-navy'}`}>{n.valor ?? '—'}</span>
          )
          return (
            <div key={n.rotulo} className="card flex flex-col gap-1">
              {n.alerta ? <Link href="/admin/gerencias">{valor}</Link> : valor}
              <span className="text-xs font-medium text-mid-grey">{n.rotulo}</span>
            </div>
          )
        })}
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {CARTOES.map((c) => (
          <div key={c.href} className="card flex flex-col gap-2">
            <h2 className="text-base font-semibold text-navy">{c.titulo}</h2>
            <p className="text-sm text-mid-grey">{c.texto}</p>
            <Link href={c.href} className={`${LINK_NAVY} mt-auto text-sm`}>
              Abrir
            </Link>
          </div>
        ))}
      </div>
    </main>
  )
}
