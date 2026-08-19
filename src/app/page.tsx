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
  competenciaAno: number
  competenciaMes: number
  uploadedBy: { nome: string }
  cliente: { id: string; nome: string }
  analise: { id: string } | null
}

interface Cliente {
  id: string
  nome: string
}

interface Filtros {
  tipo: string
  status: string
  busca: string
  de: string
  ate: string
  clienteId: string
}

const FILTROS_VAZIOS: Filtros = { tipo: '', status: '', busca: '', de: '', ate: '', clienteId: '' }

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
  if (filtros.clienteId) params.set('clienteId', filtros.clienteId)
  return params.toString()
}

export default function DashboardPage() {
  const [documentos, setDocumentos] = useState<Documento[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [carregando, setCarregando] = useState(true)
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_VAZIOS)

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
    fetch('/api/clientes')
      .then((r) => (r.ok ? r.json() : []))
      .then(setClientes)
  }, [])

  function handleFiltrar(event: FormEvent) {
    event.preventDefault()
    carregarDocumentos(filtros)
  }

  return (
    <main className="space-y-6 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Documentos</h1>
        <p className="text-sm text-muted-foreground">
          Pra enviar um documento, entre no cliente e no mês em{' '}
          <Link href="/clientes" className="text-blue-600 hover:underline">
            Clientes
          </Link>
          .
        </p>
      </div>

      <form onSubmit={handleFiltrar} className="flex flex-wrap items-end gap-3 text-sm">
        <label className="flex flex-col gap-1">
          Cliente
          <select
            value={filtros.clienteId}
            onChange={(e) => setFiltros({ ...filtros, clienteId: e.target.value })}
            className="rounded border p-1"
          >
            <option value="">Todos</option>
            {clientes.map((cliente) => (
              <option key={cliente.id} value={cliente.id}>
                {cliente.nome}
              </option>
            ))}
          </select>
        </label>
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
            <option value="docx">Word</option>
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
              <th>Cliente</th>
              <th>Competência</th>
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
                <td>{doc.cliente.nome}</td>
                <td>
                  {String(doc.competenciaMes).padStart(2, '0')}/{doc.competenciaAno}
                </td>
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
                  {doc.status === 'concluido' && (
                    <a href={`/api/documentos/${doc.id}/relatorio`} className="text-blue-600 hover:underline">
                      Baixar relatório
                    </a>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  )
}
