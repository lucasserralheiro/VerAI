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
  const [destinoMesclagem, setDestinoMesclagem] = useState<Record<string, string>>({})

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

  async function handleExcluir(id: string) {
    setErro(null)
    const response = await fetch(`/api/admin/clientes/${id}`, { method: 'DELETE' })
    if (!response.ok) {
      const body = await response.json().catch(() => null)
      setErro(body?.error ?? 'Falha ao excluir cliente.')
      return
    }
    carregar()
  }

  async function handleMesclar(id: string) {
    const destinoClienteId = destinoMesclagem[id]
    if (!destinoClienteId) return
    setErro(null)
    const response = await fetch(`/api/admin/clientes/${id}/mesclar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ destinoClienteId }),
    })
    if (!response.ok) {
      const body = await response.json().catch(() => null)
      setErro(body?.error ?? 'Falha ao mesclar cliente.')
      return
    }
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
      </form>
      {erro && <p className="text-sm text-red-600">{erro}</p>}

      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b">
            <th className="py-2">Nome</th>
            <th>Criado em</th>
            <th>Mesclar com</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          {clientes.map((cliente) => (
            <tr key={cliente.id} className="border-b">
              <td className="py-2">{cliente.nome}</td>
              <td>{new Date(cliente.createdAt).toLocaleDateString('pt-BR')}</td>
              <td>
                <div className="flex items-center gap-2">
                  <select
                    value={destinoMesclagem[cliente.id] ?? ''}
                    onChange={(e) =>
                      setDestinoMesclagem({ ...destinoMesclagem, [cliente.id]: e.target.value })
                    }
                    className="rounded border p-1"
                  >
                    <option value="">Selecione...</option>
                    {clientes
                      .filter((c) => c.id !== cliente.id)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nome}
                        </option>
                      ))}
                  </select>
                  <button
                    onClick={() => handleMesclar(cliente.id)}
                    disabled={!destinoMesclagem[cliente.id]}
                    className="text-blue-600 hover:underline disabled:opacity-50"
                  >
                    Mesclar
                  </button>
                </div>
              </td>
              <td>
                <button onClick={() => handleExcluir(cliente.id)} className="text-red-600 hover:underline">
                  Excluir
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  )
}
