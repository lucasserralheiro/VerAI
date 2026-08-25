'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, UploadCloud } from 'lucide-react'
import { BTN_PRIMARY, INPUT_BASE } from '@/lib/ui'

interface Cliente {
  id: string
  nome: string
}

export default function NovoDocumentoSeiPage() {
  const router = useRouter()
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [clienteId, setClienteId] = useState('')
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/clientes')
      .then((r) => (r.ok ? r.json() : []))
      .then(setClientes)
  }, [])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!clienteId || !arquivo) {
      setErro('Escolha um cliente e um arquivo PDF.')
      return
    }

    setEnviando(true)
    setErro(null)

    const formData = new FormData()
    formData.set('clienteId', clienteId)
    formData.set('arquivo', arquivo)

    const response = await fetch('/api/documentos-sei', { method: 'POST', body: formData })
    const resultado = await response.json().catch(() => null)

    if (!response.ok) {
      setEnviando(false)
      setErro(resultado?.error ?? 'Falha ao enviar o PDF.')
      return
    }

    router.push(`/documentos-sei/${resultado.id}`)
  }

  return (
    <main className="mx-auto max-w-2xl space-y-6 px-6 py-8 lg:px-8">
      <div className="space-y-1">
        <span className="text-xs font-semibold tracking-wide text-orange uppercase">Relatórios</span>
        <h1 className="text-2xl font-bold text-navy">Novo documento SEI</h1>
      </div>

      <form onSubmit={handleSubmit} className="card space-y-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium text-mid-grey">Cliente</span>
          <select value={clienteId} onChange={(e) => setClienteId(e.target.value)} className={INPUT_BASE}>
            <option value="">Escolha um cliente</option>
            {clientes.map((cliente) => (
              <option key={cliente.id} value={cliente.id}>
                {cliente.nome}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium text-mid-grey">Proposta em PDF</span>
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
            className={INPUT_BASE}
          />
        </label>

        {erro && (
          <p className="flex items-center gap-2 rounded-lg bg-red-crit-light p-3 text-sm text-red-crit">
            <AlertCircle className="size-4 shrink-0" strokeWidth={2.25} />
            {erro}
          </p>
        )}

        <button type="submit" disabled={enviando} className={BTN_PRIMARY}>
          <UploadCloud className="size-3.5" strokeWidth={2.25} />
          {enviando ? 'Enviando...' : 'Enviar'}
        </button>
      </form>
    </main>
  )
}
