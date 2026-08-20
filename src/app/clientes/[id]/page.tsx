'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Plus,
  ChevronRight,
  Loader2,
  AlertCircle,
  Eye,
  Download,
  Trash2,
  ArrowUpRight,
  Inbox,
  X,
} from 'lucide-react'
import { formatarCompetencia, nomeCompetencia } from '@/lib/competencia'
import { Badge } from '@/components/ui/badge'
import { BTN_PRIMARY, BTN_OUTLINE, INPUT_BASE, LINK_DANGER } from '@/lib/ui'
import { cn } from '@/lib/utils'

interface Cliente {
  id: string
  nome: string
}

interface Documento {
  id: string
  nomeArquivo: string
  tipo: string
  status: string
  createdAt: string
  competenciaAno: number
  competenciaMes: number
  uploadedById: string
  uploadedBy: { nome: string }
  analise: { id: string } | null
}

interface Competencia {
  ano: number
  mes: number
  quantidade: number
}

interface UsuarioLogado {
  id: string
  role: string
}

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

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

export default function ClienteDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [documentos, setDocumentos] = useState<Documento[]>([])
  const [usuario, setUsuario] = useState<UsuarioLogado | null>(null)
  const [carregando, setCarregando] = useState(true)
  const hoje = new Date()
  const [novoAno, setNovoAno] = useState(hoje.getFullYear())
  const [novoMes, setNovoMes] = useState(hoje.getMonth() + 1)
  const [aberta, setAberta] = useState<string | null>(null)
  const [seletorAberto, setSeletorAberto] = useState(false)

  async function carregar() {
    const [clienteResponse, documentosResponse] = await Promise.all([
      fetch(`/api/clientes/${id}`),
      fetch(`/api/documentos?clienteId=${id}`),
    ])
    if (clienteResponse.ok) setCliente(await clienteResponse.json())
    if (documentosResponse.ok) setDocumentos(await documentosResponse.json())
    setCarregando(false)
  }

  useEffect(() => {
    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then(setUsuario)
      .catch(() => {})
  }, [])

  const competencias: Competencia[] = (() => {
    const porCompetencia = new Map<string, Competencia>()
    for (const doc of documentos) {
      const chave = formatarCompetencia(doc.competenciaAno, doc.competenciaMes)
      const atual = porCompetencia.get(chave)
      porCompetencia.set(chave, {
        ano: doc.competenciaAno,
        mes: doc.competenciaMes,
        quantidade: (atual?.quantidade ?? 0) + 1,
      })
    }
    return [...porCompetencia.values()].sort((a, b) => b.ano - a.ano || b.mes - a.mes)
  })()

  useEffect(() => {
    if (!carregando) setSeletorAberto(competencias.length === 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carregando])

  function handleNovoMes() {
    router.push(`/clientes/${id}/${formatarCompetencia(novoAno, novoMes)}`)
  }

  function toggleAberta(chave: string) {
    setAberta((atual) => (atual === chave ? null : chave))
  }

  async function handleExcluirDocumento(doc: Documento) {
    if (!confirm(`Excluir "${doc.nomeArquivo}"? Essa ação não pode ser desfeita.`)) return
    const response = await fetch(`/api/documentos/${doc.id}`, { method: 'DELETE' })
    if (!response.ok) {
      const body = await response.json().catch(() => null)
      alert(body?.error ?? 'Falha ao excluir documento.')
      return
    }
    carregar()
  }

  if (carregando) {
    return (
      <main className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
        <p className="flex items-center gap-2 text-sm text-mid-grey">
          <Loader2 className="size-4 animate-spin" strokeWidth={2.25} />
          Carregando...
        </p>
      </main>
    )
  }

  if (!cliente) {
    return (
      <main className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
        <p className="flex items-center gap-2 rounded-xl bg-red-crit-light p-4 text-sm text-red-crit">
          <AlertCircle className="size-4 shrink-0" strokeWidth={2.25} />
          Cliente não encontrado ou sem acesso.
        </p>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-6 py-8 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <nav className="flex items-center gap-1.5 text-xs font-medium text-mid-grey">
            <Link href="/clientes" className="hover:text-navy hover:underline">
              Clientes
            </Link>
            <ChevronRight className="size-3" strokeWidth={2.5} />
            <span className="font-semibold text-navy">{cliente.nome}</span>
          </nav>
          <h1 className="text-[1.75rem] leading-tight font-bold tracking-tight text-navy">{cliente.nome}</h1>
        </div>

        {!seletorAberto && (
          <button onClick={() => setSeletorAberto(true)} className={BTN_OUTLINE}>
            <Plus className="size-3.5" strokeWidth={2.25} />
            Nova competência
          </button>
        )}
      </div>

      {seletorAberto && (
        <div className="card flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-medium text-mid-grey">Mês</span>
            <select value={novoMes} onChange={(e) => setNovoMes(Number(e.target.value))} className={INPUT_BASE}>
              {MESES.map((nome, i) => (
                <option key={nome} value={i + 1}>
                  {nome}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-medium text-mid-grey">Ano</span>
            <input
              type="number"
              value={novoAno}
              onChange={(e) => setNovoAno(Number(e.target.value))}
              className={`w-24 ${INPUT_BASE}`}
            />
          </label>
          <button onClick={handleNovoMes} className={BTN_PRIMARY}>
            Abrir competência
          </button>
          {competencias.length > 0 && (
            <button
              onClick={() => setSeletorAberto(false)}
              aria-label="Fechar"
              className="ml-auto flex items-center gap-1 text-sm font-medium text-mid-grey hover:text-navy"
            >
              <X className="size-4" strokeWidth={2.25} />
            </button>
          )}
        </div>
      )}

      {competencias.length === 0 ? (
        !seletorAberto && (
          <p className="card text-sm text-mid-grey">Nenhum documento ainda. Abra uma competência pra começar.</p>
        )
      ) : (
        <ul className="space-y-2">
          {competencias.map((c) => {
            const chave = formatarCompetencia(c.ano, c.mes)
            const expandida = aberta === chave
            const ehAtual = c.ano === hoje.getFullYear() && c.mes === hoje.getMonth() + 1
            const docsDoMes = documentos
              .filter((d) => d.competenciaAno === c.ano && d.competenciaMes === c.mes)
              .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

            return (
              <li key={chave} className="card-flush overflow-hidden">
                <button
                  onClick={() => toggleAberta(chave)}
                  className="group flex w-full items-center justify-between gap-3 p-4 text-left transition-colors hover:bg-navy/[0.02]"
                >
                  <span className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-navy capitalize">{nomeCompetencia(c.ano, c.mes)}</span>
                    {ehAtual && <Badge variant="navy-soft">Mês atual</Badge>}
                  </span>
                  <span className="flex items-center gap-2 text-sm text-mid-grey">
                    {c.quantidade} documento{c.quantidade === 1 ? '' : 's'}
                    <ChevronRight
                      className={cn('size-4 transition-transform group-hover:text-orange', expandida && 'rotate-90 text-orange')}
                      strokeWidth={2.25}
                    />
                  </span>
                </button>

                {expandida && (
                  <div className="border-t border-black/[0.05] bg-light-grey/40 p-4">
                    {docsDoMes.length === 0 ? (
                      <p className="flex items-center gap-2 text-sm text-mid-grey">
                        <Inbox className="size-4" strokeWidth={2} />
                        Nenhum documento neste mês ainda.
                      </p>
                    ) : (
                      <ul className="space-y-2">
                        {docsDoMes.map((doc) => (
                          <li
                            key={doc.id}
                            className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-white p-3 shadow-xs"
                          >
                            <span className="flex min-w-0 items-center gap-2.5">
                              <span className="truncate text-sm font-medium text-navy">{doc.nomeArquivo}</span>
                              <Badge variant={STATUS_BADGE[doc.status] ?? 'neutral'}>
                                {STATUS_LABEL[doc.status] ?? doc.status}
                              </Badge>
                            </span>
                            <span className="flex shrink-0 items-center gap-3">
                              <Link
                                href={`/documentos/${doc.id}`}
                                title="Ver análise"
                                className="flex items-center gap-1 text-sm font-medium text-navy hover:underline"
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
                              {usuario && (usuario.role === 'admin' || usuario.id === doc.uploadedById) && (
                                <button
                                  onClick={() => handleExcluirDocumento(doc)}
                                  title="Excluir"
                                  className={LINK_DANGER}
                                >
                                  <Trash2 className="size-4" strokeWidth={2.25} />
                                </button>
                              )}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}

                    <Link
                      href={`/clientes/${id}/${chave}`}
                      className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-orange hover:underline"
                    >
                      Ver mês completo (upload, análise consolidada, evolução)
                      <ArrowUpRight className="size-3.5" strokeWidth={2.25} />
                    </Link>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </main>
  )
}
