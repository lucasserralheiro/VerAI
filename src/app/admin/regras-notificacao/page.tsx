'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { Plus, Trash2, BellRing } from 'lucide-react'
import { BTN_PRIMARY, INPUT_BASE, LINK_DANGER } from '@/lib/ui'

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
    <main className="mx-auto max-w-7xl space-y-6 px-6 py-8 lg:px-8">
      <div className="flex items-center gap-2">
        <BellRing className="size-5 text-orange" strokeWidth={2.25} />
        <h1 className="text-2xl font-bold text-navy">Regras de notificação</h1>
      </div>

      <form onSubmit={handleCriar} className="card flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium text-mid-grey">Critério</span>
          <select
            value={criterioTipo}
            onChange={(e) => setCriterioTipo(e.target.value)}
            className={INPUT_BASE}
          >
            <option value="tipoDocumento">Tipo de documento</option>
            <option value="palavraChaveNome">Palavra-chave no nome</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium text-mid-grey">Valor</span>
          <input
            type="text"
            value={criterioValor}
            onChange={(e) => setCriterioValor(e.target.value)}
            placeholder={criterioTipo === 'tipoDocumento' ? 'xlsx, csv ou pdf' : 'ex: faturamento'}
            required
            className={INPUT_BASE}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium text-mid-grey">Destinatários (e-mails, separados por vírgula)</span>
          <input
            type="text"
            value={destinatarios}
            onChange={(e) => setDestinatarios(e.target.value)}
            required
            className={`w-64 ${INPUT_BASE}`}
          />
        </label>
        <button type="submit" className={BTN_PRIMARY}>
          <Plus className="size-3.5" strokeWidth={2.25} />
          Criar regra
        </button>
      </form>

      <div className="card-flush">
        <div className="overflow-x-auto">
          <table className="table-institucional">
            <thead>
              <tr>
                <th>Critério</th>
                <th>Valor</th>
                <th>Destinatários</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {regras.map((regra) => (
                <tr key={regra.id}>
                  <td className="font-medium text-navy">{regra.criterioTipo}</td>
                  <td>{regra.criterioValor}</td>
                  <td className="text-mid-grey">{regra.destinatarios.join(', ')}</td>
                  <td>
                    <button onClick={() => handleExcluir(regra.id)} className={LINK_DANGER}>
                      <Trash2 className="size-3.5" strokeWidth={2.25} />
                      Excluir
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
