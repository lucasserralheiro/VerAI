'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, Eye, Inbox } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { BTN_PRIMARY, INPUT_BASE } from '@/lib/ui'

interface DocumentoSei {
  id: string
  nomeArquivo: string
  status: string
  createdAt: string
  uploadedBy: { nome: string }
  cliente: { id: string; nome: string }
}

interface Cliente {
  id: string
  nome: string
}

const STATUS_BADGE: Record<string, 'success' | 'neutral' | 'critical'> = {
  concluido: 'success',
  rascunho: 'neutral',
  erro: 'critical',
}

const STATUS_LABEL: Record<string, string> = {
  concluido: 'Concluído',
  rascunho: 'Rascunho',
  erro: 'Erro',
}

export default function DocumentosSeiPage() {
  const [documentosSei, setDocumentosSei] = useState<DocumentoSei[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [clienteId, setClienteId] = useState('')
  const [carregando, setCarregando] = useState(true)

  async function carregar(clienteIdAtual: string) {
    setCarregando(true)
    const query = clienteIdAtual ? `?clienteId=${clienteIdAtual}` : ''
    const response = await fetch(`/api/documentos-sei${query}`)
    if (response.ok) setDocumentosSei(await response.json())
    setCarregando(false)
  }

  useEffect(() => {
    carregar('')
    fetch('/api/clientes')
      .then((r) => (r.ok ? r.json() : []))
      .then(setClientes)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleFiltrarCliente(novoClienteId: string) {
    setClienteId(novoClienteId)
    carregar(novoClienteId)
  }

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-6 py-8 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <span className="text-xs font-semibold tracking-wide text-orange uppercase">Relatórios</span>
          <h1 className="text-2xl font-bold text-navy">Documento SEI</h1>
        </div>
        <Link href="/documentos-sei/novo" className={BTN_PRIMARY}>
          <Plus className="size-3.5" strokeWidth={2.25} />
          Novo documento SEI
        </Link>
      </div>

      <label className="flex max-w-xs flex-col gap-1 text-sm">
        <span className="text-xs font-medium text-mid-grey">Cliente</span>
        <select value={clienteId} onChange={(e) => handleFiltrarCliente(e.target.value)} className={INPUT_BASE}>
          <option value="">Todos</option>
          {clientes.map((cliente) => (
            <option key={cliente.id} value={cliente.id}>
              {cliente.nome}
            </option>
          ))}
        </select>
      </label>

      <div className="card-flush">
        {carregando ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="skeleton h-10 w-full" />
            ))}
          </div>
        ) : documentosSei.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-10 text-center">
            <span className="flex size-11 items-center justify-center rounded-full bg-light-grey text-mid-grey">
              <Inbox className="size-5" strokeWidth={1.75} />
            </span>
            <p className="text-sm text-mid-grey">Nenhum documento SEI ainda.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-institucional">
              <thead>
                <tr>
                  <th>Arquivo</th>
                  <th>Cliente</th>
                  <th>Data</th>
                  <th>Quem subiu</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {documentosSei.map((doc) => (
                  <tr key={doc.id}>
                    <td className="font-medium text-navy">{doc.nomeArquivo}</td>
                    <td>{doc.cliente.nome}</td>
                    <td className="text-mid-grey">{new Date(doc.createdAt).toLocaleString('pt-BR')}</td>
                    <td className="text-mid-grey">{doc.uploadedBy.nome}</td>
                    <td>
                      <Badge variant={STATUS_BADGE[doc.status] ?? 'neutral'}>
                        {STATUS_LABEL[doc.status] ?? doc.status}
                      </Badge>
                    </td>
                    <td>
                      <Link
                        href={`/documentos-sei/${doc.id}`}
                        className="flex items-center gap-1 text-sm font-medium text-navy transition-colors hover:text-orange hover:underline"
                      >
                        <Eye className="size-3.5" strokeWidth={2.25} />
                        Ver
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  )
}
