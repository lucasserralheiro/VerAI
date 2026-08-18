'use client'

import { useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'

interface Documento {
  id: string
  nomeArquivo: string
  tipo: string
  status: string
  mensagemErro: string | null
  tamanhoBytes: number
  createdAt: string
  uploadedBy: { nome: string }
  analise: { id: string } | null
}

interface Filtros {
  tipo: string
  status: string
  busca: string
  de: string
  ate: string
}

const FILTROS_VAZIOS: Filtros = { tipo: '', status: '', busca: '', de: '', ate: '' }

const STATUS_BADGE: Record<string, string> = {
  concluido: 'bg-green-100 text-green-800',
  processando: 'bg-gray-100 text-gray-800',
  erro: 'bg-red-100 text-red-800',
}

function montarQuery(filtros: Filtros): string {
  const params = new URLSearchParams()
  if (filtros.tipo) params.set('tipo', filtros.tipo)
  if (filtros.status) params.set('status', filtros.status)
  if (filtros.busca) params.set('busca', filtros.busca)
  if (filtros.de) params.set('de', filtros.de)
  if (filtros.ate) params.set('ate', filtros.ate)
  return params.toString()
}

export default function DashboardPage() {
  const [documentos, setDocumentos] = useState<Documento[]>([])
  const [carregando, setCarregando] = useState(true)
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_VAZIOS)
  const [enviando, setEnviando] = useState(false)
  const [erroUpload, setErroUpload] = useState<string | null>(null)

  async function carregarDocumentos(filtrosAtuais: Filtros) {
    setCarregando(true)
    const query = montarQuery(filtrosAtuais)
    const response = await fetch(`/api/documentos${query ? `?${query}` : ''}`)
    if (response.ok) {
      setDocumentos(await response.json())
    }
    setCarregando(false)
  }

  useEffect(() => {
    carregarDocumentos(FILTROS_VAZIOS)
  }, [])

  function handleFiltrar(event: FormEvent) {
    event.preventDefault()
    carregarDocumentos(filtros)
  }

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErroUpload(null)
    const form = event.currentTarget
    const input = form.elements.namedItem('arquivo') as HTMLInputElement
    const arquivo = input.files?.[0]
    if (!arquivo) return

    setEnviando(true)
    const formData = new FormData()
    formData.set('arquivo', arquivo)

    const response = await fetch('/api/documentos', { method: 'POST', body: formData })
    setEnviando(false)

    if (!response.ok) {
      setErroUpload('Falha ao enviar o documento.')
      return
    }
    form.reset()
    carregarDocumentos(filtros)
  }

  return (
    <main className="space-y-6 p-8">
      <h1 className="text-xl font-semibold">Documentos</h1>

      <form onSubmit={handleUpload} className="flex items-center gap-3">
        <input type="file" name="arquivo" accept=".xlsx,.csv,.pdf" required className="text-sm" />
        <button
          type="submit"
          disabled={enviando}
          className="rounded bg-black px-3 py-1.5 text-sm text-white disabled:opacity-50"
        >
          {enviando ? 'Enviando...' : 'Enviar documento'}
        </button>
        {erroUpload && <span className="text-sm text-red-600">{erroUpload}</span>}
      </form>

      <form onSubmit={handleFiltrar} className="flex flex-wrap items-end gap-3 text-sm">
        <label className="flex flex-col gap-1">
          Tipo
          <select
            value={filtros.tipo}
            onChange={(e) => setFiltros({ ...filtros, tipo: e.target.value })}
            className="rounded border p-1"
          >
            <option value="">Todos</option>
            <option value="xlsx">Excel</option>
            <option value="csv">CSV</option>
            <option value="pdf">PDF</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          Status
          <select
            value={filtros.status}
            onChange={(e) => setFiltros({ ...filtros, status: e.target.value })}
            className="rounded border p-1"
          >
            <option value="">Todos</option>
            <option value="processando">Processando</option>
            <option value="concluido">Concluído</option>
            <option value="erro">Erro</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          Busca (nome)
          <input
            type="text"
            value={filtros.busca}
            onChange={(e) => setFiltros({ ...filtros, busca: e.target.value })}
            className="rounded border p-1"
          />
        </label>
        <label className="flex flex-col gap-1">
          De
          <input
            type="date"
            value={filtros.de}
            onChange={(e) => setFiltros({ ...filtros, de: e.target.value })}
            className="rounded border p-1"
          />
        </label>
        <label className="flex flex-col gap-1">
          Até
          <input
            type="date"
            value={filtros.ate}
            onChange={(e) => setFiltros({ ...filtros, ate: e.target.value })}
            className="rounded border p-1"
          />
        </label>
        <button type="submit" className="rounded border px-3 py-1.5">
          Filtrar
        </button>
      </form>

      {carregando ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : documentos.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum documento encontrado.</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b">
              <th className="py-2">Arquivo</th>
              <th>Tipo</th>
              <th>Data</th>
              <th>Quem subiu</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {documentos.map((doc) => (
              <tr key={doc.id} className="border-b">
                <td className="py-2">{doc.nomeArquivo}</td>
                <td>{doc.tipo}</td>
                <td>{new Date(doc.createdAt).toLocaleString('pt-BR')}</td>
                <td>{doc.uploadedBy.nome}</td>
                <td>
                  <span className={`rounded px-2 py-0.5 text-xs ${STATUS_BADGE[doc.status] ?? ''}`}>
                    {doc.status}
                  </span>
                </td>
                <td className="space-x-3">
                  <Link href={`/documentos/${doc.id}`} className="text-blue-600 hover:underline">
                    Ver análise
                  </Link>
                  <a href={`/api/documentos/${doc.id}/original`} className="text-blue-600 hover:underline">
                    Baixar original
                  </a>
                  <span className="text-muted-foreground" title="Módulo de relatório PDF ainda não implementado">
                    Baixar relatório (em breve)
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  )
}
