'use client'

import { useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'
import {
  Search,
  Eye,
  Download,
  FileDown,
  Inbox,
  ArrowRight,
  FileStack,
  CheckCircle2,
  Clock,
  AlertCircle,
  Trash2,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { BTN_PRIMARY, INPUT_BASE, LINK_DANGER } from '@/lib/ui'

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
  uploadedById: string
  uploadedBy: { nome: string }
  cliente: { id: string; nome: string }
  analise: { id: string } | null
}

interface Cliente {
  id: string
  nome: string
}

interface UsuarioLogado {
  id: string
  role: string
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

const STATUS_BADGE: Record<string, 'success' | 'neutral' | 'critical'> = {
  concluido: 'success',
  processando: 'neutral',
  erro: 'critical',
}

const STATUS_LABEL: Record<string, string> = {
  concluido: 'Concluído',
  processando: 'Processando',
  erro: 'Erro',
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
  const [usuario, setUsuario] = useState<UsuarioLogado | null>(null)
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
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then(setUsuario)
  }, [])

  function handleFiltrar(event: FormEvent) {
    event.preventDefault()
    carregarDocumentos(filtros)
  }

  async function handleExcluir(doc: Documento) {
    if (!confirm(`Excluir "${doc.nomeArquivo}"? Essa ação não pode ser desfeita.`)) return
    const response = await fetch(`/api/documentos/${doc.id}`, { method: 'DELETE' })
    if (!response.ok) {
      const body = await response.json().catch(() => null)
      alert(body?.error ?? 'Falha ao excluir documento.')
      return
    }
    carregarDocumentos(filtros)
  }

  const totalDocs = documentos.length
  const totalConcluidos = documentos.filter((d) => d.status === 'concluido').length
  const totalProcessando = documentos.filter((d) => d.status === 'processando').length
  const totalErros = documentos.filter((d) => d.status === 'erro').length

  const stats = [
    { label: 'Total no filtro', value: totalDocs, icon: FileStack },
    { label: 'Concluídos', value: totalConcluidos, icon: CheckCircle2 },
    { label: 'Processando', value: totalProcessando, icon: Clock },
    { label: 'Com erro', value: totalErros, icon: AlertCircle },
  ]

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-6 py-8 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <span className="text-xs font-semibold tracking-wide text-orange uppercase">Painel</span>
          <h1 className="text-2xl font-bold text-navy">Documentos</h1>
        </div>
        <p className="text-sm text-mid-grey">
          Pra enviar um documento, entre no cliente e no mês em{' '}
          <Link href="/clientes" className="inline-flex items-center gap-0.5 font-medium text-navy hover:underline">
            Clientes <ArrowRight className="size-3.5" strokeWidth={2.25} />
          </Link>
          .
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map(({ label, value, icon: Icon }) => (
          <div key={label} className="relative overflow-hidden rounded-2xl bg-navy-2 p-4 shadow-md">
            <Icon className="icon-watermark size-20" strokeWidth={1.5} />
            <p className="text-[0.7rem] font-semibold tracking-wide text-white/70 uppercase">{label}</p>
            <p className="mt-1 text-3xl font-bold tabular-nums text-orange">{value}</p>
          </div>
        ))}
      </div>

      <form onSubmit={handleFiltrar} className="card flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium text-mid-grey">Cliente</span>
          <select
            value={filtros.clienteId}
            onChange={(e) => setFiltros({ ...filtros, clienteId: e.target.value })}
            className={INPUT_BASE}
          >
            <option value="">Todos</option>
            {clientes.map((cliente) => (
              <option key={cliente.id} value={cliente.id}>
                {cliente.nome}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium text-mid-grey">Tipo</span>
          <select
            value={filtros.tipo}
            onChange={(e) => setFiltros({ ...filtros, tipo: e.target.value })}
            className={INPUT_BASE}
          >
            <option value="">Todos</option>
            <option value="xlsx">Excel</option>
            <option value="csv">CSV</option>
            <option value="pdf">PDF</option>
            <option value="docx">Word</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium text-mid-grey">Status</span>
          <select
            value={filtros.status}
            onChange={(e) => setFiltros({ ...filtros, status: e.target.value })}
            className={INPUT_BASE}
          >
            <option value="">Todos</option>
            <option value="processando">Processando</option>
            <option value="concluido">Concluído</option>
            <option value="erro">Erro</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium text-mid-grey">Busca (nome)</span>
          <input
            type="text"
            value={filtros.busca}
            onChange={(e) => setFiltros({ ...filtros, busca: e.target.value })}
            className={INPUT_BASE}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium text-mid-grey">De</span>
          <input
            type="date"
            value={filtros.de}
            onChange={(e) => setFiltros({ ...filtros, de: e.target.value })}
            className={INPUT_BASE}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium text-mid-grey">Até</span>
          <input
            type="date"
            value={filtros.ate}
            onChange={(e) => setFiltros({ ...filtros, ate: e.target.value })}
            className={INPUT_BASE}
          />
        </label>
        <button type="submit" className={BTN_PRIMARY}>
          <Search className="size-3.5" strokeWidth={2.25} />
          Filtrar
        </button>
      </form>

      <div className="card-flush">
        {carregando ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="skeleton h-10 w-full" />
            ))}
          </div>
        ) : documentos.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-10 text-center">
            <span className="flex size-11 items-center justify-center rounded-full bg-light-grey text-mid-grey">
              <Inbox className="size-5" strokeWidth={1.75} />
            </span>
            <p className="text-sm text-mid-grey">Nenhum documento encontrado.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-institucional">
              <thead>
                <tr>
                  <th>Arquivo</th>
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
                  <tr key={doc.id}>
                    <td className="font-medium text-navy">{doc.nomeArquivo}</td>
                    <td>{doc.cliente.nome}</td>
                    <td>
                      {String(doc.competenciaMes).padStart(2, '0')}/{doc.competenciaAno}
                    </td>
                    <td className="uppercase text-mid-grey">{doc.tipo}</td>
                    <td className="text-mid-grey">{new Date(doc.createdAt).toLocaleString('pt-BR')}</td>
                    <td className="text-mid-grey">{doc.uploadedBy.nome}</td>
                    <td>
                      <Badge variant={STATUS_BADGE[doc.status] ?? 'neutral'}>
                        {STATUS_LABEL[doc.status] ?? doc.status}
                      </Badge>
                    </td>
                    <td>
                      <div className="flex items-center gap-3">
                        <Link
                          href={`/documentos/${doc.id}`}
                          title="Ver análise"
                          className="flex items-center gap-1 text-sm font-medium text-navy transition-colors hover:text-orange hover:underline"
                        >
                          <Eye className="size-3.5" strokeWidth={2.25} />
                          Ver
                        </Link>
                        <a
                          href={`/api/documentos/${doc.id}/original`}
                          title="Baixar original"
                          className="text-mid-grey transition-colors hover:text-navy"
                        >
                          <Download className="size-4" strokeWidth={2.25} />
                        </a>
                        {doc.status === 'concluido' && (
                          <a
                            href={`/api/documentos/${doc.id}/relatorio`}
                            title="Baixar relatório"
                            className="text-mid-grey transition-colors hover:text-navy"
                          >
                            <FileDown className="size-4" strokeWidth={2.25} />
                          </a>
                        )}
                        {usuario && (usuario.role === 'admin' || usuario.id === doc.uploadedById) && (
                          <button onClick={() => handleExcluir(doc)} title="Excluir" className={LINK_DANGER}>
                            <Trash2 className="size-4" strokeWidth={2.25} />
                          </button>
                        )}
                      </div>
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
