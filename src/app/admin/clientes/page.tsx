'use client'

import { useEffect, useState, type FormEvent } from 'react'

interface Cliente {
  id: string
  nome: string
  createdAt: string
}

export default function AdminClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [nome, setNome] = useState('')
  const [erro, setErro] = useState<string | null>(null)

  async function carregar() {
    const response = await fetch('/api/admin/clientes')
    if (response.ok) {
      setClientes(await response.json())
    }
  }

  useEffect(() => {
    carregar()
  }, [])

  async function handleCriar(event: FormEvent) {
    event.preventDefault()
    setErro(null)
    const response = await fetch('/api/admin/clientes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome }),
    })
    if (!response.ok) {
      const body = await response.json().catch(() => null)
      setErro(body?.error ?? 'Falha ao criar cliente.')
      return
    }
    setNome('')
    carregar()
  }

  return (
    <main className="space-y-6 p-8">
      <h1 className="text-xl font-semibold">Clientes</h1>

      <form onSubmit={handleCriar} className="flex flex-wrap items-end gap-3 text-sm">
        <label className="flex flex-col gap-1">
          Nome
          <input
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            required
            className="rounded border p-1"
          />
        </label>
        <button type="submit" className="rounded bg-black px-3 py-1.5 text-white">
          Criar cliente
        </button>
        {erro && <span className="text-sm text-red-600">{erro}</span>}
      </form>

      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b">
            <th className="py-2">Nome</th>
            <th>Criado em</th>
          </tr>
        </thead>
        <tbody>
          {clientes.map((cliente) => (
            <tr key={cliente.id} className="border-b">
              <td className="py-2">{cliente.nome}</td>
              <td>{new Date(cliente.createdAt).toLocaleDateString('pt-BR')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  )
}
