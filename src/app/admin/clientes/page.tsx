'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { Plus, GitMerge, Trash2, AlertCircle, Building2 } from 'lucide-react'
import { BTN_PRIMARY, INPUT_BASE, LINK_NAVY, LINK_DANGER } from '@/lib/ui'

interface Cliente {
  id: string
  nome: string
  createdAt: string
  _count: { documentos: number }
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

  async function handleExcluir(cliente: Cliente) {
    const totalDocumentos = cliente._count.documentos
    const forcar = totalDocumentos > 0
    const mensagem = forcar
      ? `Isso vai excluir o cliente "${cliente.nome}" E os ${totalDocumentos} documento(s) vinculados (análises, PDFs, tudo) PERMANENTEMENTE. Não dá pra desfazer. Confirma?`
      : `Excluir o cliente "${cliente.nome}"? Não dá pra desfazer.`
    if (!confirm(mensagem)) return

    setErro(null)
    const response = await fetch(
      `/api/admin/clientes/${cliente.id}${forcar ? '?forcar=true' : ''}`,
      { method: 'DELETE' }
    )
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
    <main className="mx-auto max-w-7xl space-y-6 px-6 py-8 lg:px-8">
      <div className="flex items-center gap-2">
        <Building2 className="size-5 text-orange" strokeWidth={2.25} />
        <h1 className="text-2xl font-bold text-navy">Gerenciar clientes</h1>
      </div>

      <form onSubmit={handleCriar} className="card flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium text-mid-grey">Nome</span>
          <input
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            required
            className={INPUT_BASE}
          />
        </label>
        <button type="submit" className={BTN_PRIMARY}>
          <Plus className="size-3.5" strokeWidth={2.25} />
          Criar cliente
        </button>
      </form>
      {erro && (
        <p className="flex items-center gap-1.5 rounded-lg bg-red-crit-light px-3 py-2 text-sm text-red-crit">
          <AlertCircle className="size-4 shrink-0" strokeWidth={2.25} />
          {erro}
        </p>
      )}

      <div className="card-flush">
        <div className="overflow-x-auto">
          <table className="table-institucional">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Criado em</th>
                <th>Documentos</th>
                <th>Mesclar com</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {clientes.map((cliente) => (
                <tr key={cliente.id}>
                  <td className="font-medium text-navy">{cliente.nome}</td>
                  <td className="text-mid-grey">{new Date(cliente.createdAt).toLocaleDateString('pt-BR')}</td>
                  <td className="text-mid-grey">{cliente._count.documentos}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <select
                        value={destinoMesclagem[cliente.id] ?? ''}
                        onChange={(e) =>
                          setDestinoMesclagem({ ...destinoMesclagem, [cliente.id]: e.target.value })
                        }
                        className={INPUT_BASE}
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
                        className={`${LINK_NAVY} disabled:opacity-40`}
                      >
                        <GitMerge className="size-3.5" strokeWidth={2.25} />
                        Mesclar
                      </button>
                    </div>
                  </td>
                  <td>
                    <button onClick={() => handleExcluir(cliente)} className={LINK_DANGER}>
                      <Trash2 className="size-3.5" strokeWidth={2.25} />
                      {cliente._count.documentos > 0 ? `Excluir tudo (${cliente._count.documentos})` : 'Excluir'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  )
}
