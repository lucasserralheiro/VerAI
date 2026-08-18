'use client'

import { useEffect, useState, type FormEvent } from 'react'

interface RegraNotificacao {
  id: string
  criterioTipo: string
  criterioValor: string
  destinatarios: string[]
}

export default function AdminRegrasNotificacaoPage() {
  const [regras, setRegras] = useState<RegraNotificacao[]>([])
  const [criterioTipo, setCriterioTipo] = useState('tipoDocumento')
  const [criterioValor, setCriterioValor] = useState('')
  const [destinatarios, setDestinatarios] = useState('')

  async function carregar() {
    const response = await fetch('/api/admin/regras-notificacao')
    if (response.ok) {
      setRegras(await response.json())
    }
  }

  useEffect(() => {
    carregar()
  }, [])

  async function handleCriar(event: FormEvent) {
    event.preventDefault()
    await fetch('/api/admin/regras-notificacao', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        criterioTipo,
        criterioValor,
        destinatarios: destinatarios
          .split(',')
          .map((email) => email.trim())
          .filter(Boolean),
      }),
    })
    setCriterioValor('')
    setDestinatarios('')
    carregar()
  }

  async function handleExcluir(id: string) {
    await fetch(`/api/admin/regras-notificacao?id=${id}`, { method: 'DELETE' })
    carregar()
  }

  return (
    <main className="space-y-6 p-8">
      <h1 className="text-xl font-semibold">Regras de notificação</h1>

      <form onSubmit={handleCriar} className="flex flex-wrap items-end gap-3 text-sm">
        <label className="flex flex-col gap-1">
          Critério
          <select
            value={criterioTipo}
            onChange={(e) => setCriterioTipo(e.target.value)}
            className="rounded border p-1"
          >
            <option value="tipoDocumento">Tipo de documento</option>
            <option value="palavraChaveNome">Palavra-chave no nome</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          Valor
          <input
            type="text"
            value={criterioValor}
            onChange={(e) => setCriterioValor(e.target.value)}
            placeholder={criterioTipo === 'tipoDocumento' ? 'xlsx, csv ou pdf' : 'ex: faturamento'}
            required
            className="rounded border p-1"
          />
        </label>
        <label className="flex flex-col gap-1">
          Destinatários (e-mails, separados por vírgula)
          <input
            type="text"
            value={destinatarios}
            onChange={(e) => setDestinatarios(e.target.value)}
            required
            className="w-64 rounded border p-1"
          />
        </label>
        <button type="submit" className="rounded bg-black px-3 py-1.5 text-white">
          Criar regra
        </button>
      </form>

      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b">
            <th className="py-2">Critério</th>
            <th>Valor</th>
            <th>Destinatários</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          {regras.map((regra) => (
            <tr key={regra.id} className="border-b">
              <td className="py-2">{regra.criterioTipo}</td>
              <td>{regra.criterioValor}</td>
              <td>{regra.destinatarios.join(', ')}</td>
              <td>
                <button onClick={() => handleExcluir(regra.id)} className="text-red-600 hover:underline">
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
