'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ChevronRight, Loader2, Inbox } from 'lucide-react'

interface Cliente {
  id: string
  nome: string
}

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    fetch('/api/clientes')
      .then((r) => (r.ok ? r.json() : []))
      .then(setClientes)
      .finally(() => setCarregando(false))
  }, [])

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-6 py-8 lg:px-8">
      <div className="space-y-1">
        <span className="text-xs font-semibold tracking-wide text-orange uppercase">Painel</span>
        <h1 className="text-[1.75rem] leading-tight font-semibold tracking-tight text-navy">Clientes</h1>
      </div>

      {carregando ? (
        <p className="flex items-center gap-2 text-sm text-mid-grey">
          <Loader2 className="size-4 animate-spin" strokeWidth={2.25} />
          Carregando...
        </p>
      ) : clientes.length === 0 ? (
        <div className="card-flush flex flex-col items-center gap-2 p-10 text-center">
          <span className="flex size-11 items-center justify-center rounded-full bg-light-grey text-mid-grey">
            <Inbox className="size-5" strokeWidth={1.75} />
          </span>
          <p className="text-sm text-mid-grey">
            Nenhum cliente disponível. Peça a um admin pra cadastrar em /admin/clientes e liberar acesso.
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {clientes.map((cliente) => (
            <li key={cliente.id}>
              <Link
                href={`/clientes/${cliente.id}`}
                className="card card-interactive group flex items-center gap-3"
              >
                <span className="flex-1 text-sm font-semibold text-navy">{cliente.nome}</span>
                <ChevronRight className="size-4 text-mid-grey transition-transform group-hover:translate-x-0.5 group-hover:text-orange" strokeWidth={2.25} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
