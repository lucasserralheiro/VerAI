'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

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
    <main className="space-y-6 p-8">
      <h1 className="text-xl font-semibold">Clientes</h1>

      {carregando ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : clientes.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhum cliente disponível. Peça a um admin pra cadastrar em /admin/clientes e liberar acesso.
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {clientes.map((cliente) => (
            <li key={cliente.id}>
              <Link
                href={`/clientes/${cliente.id}`}
                className="block rounded border p-4 text-sm font-medium hover:bg-gray-50"
              >
                {cliente.nome}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
