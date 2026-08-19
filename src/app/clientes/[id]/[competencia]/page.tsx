'use client'

import { use, useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'
import {
  Upload,
  Eye,
  Download,
  FileDown,
  Layers,
  GitCompare,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Trash2,
} from 'lucide-react'
import { nomeCompetencia, parseCompetencia } from '@/lib/competencia'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface Documento {
  id: string
  nomeArquivo: string
  tipo: string
  status: string
  createdAt: string
  uploadedById: string
  uploadedBy: { nome: string }
  analise: { id: string } | null
}

interface UsuarioLogado {
  id: string
  role: string
}

interface Cliente {
  id: string
  nome: string
}

interface MetricaComparada {
  label: string
  valores: Array<{ documentoId: string; nomeArquivo: string; valorExibicao: string }>
  divergencia: { diferencaPercentual: number | null } | null
}

interface AnaliseConsolidada {
  id: string
  resumo: string
  metricasComparadas: MetricaComparada[]
  createdAt: string
  documentos: Array<{ id: string; nomeArquivo: string }>
}

interface MetricaEvoluida {
  label: string
  valorAtual: number | null
  valorAnterior: number | null
  deltaAbsoluto: number | null
  deltaPercentual: number | null
  status: 'novo' | 'removido' | 'estavel' | 'alta' | 'baixa'
}

interface AnaliseEvolucao {
  id: string
  competenciaAnteriorAno: number
  competenciaAnteriorMes: number
  metricasComparadas: MetricaEvoluida[]
  resumo: string
  pontosAtencao: Array<{ texto: string }>
  melhorias: Array<{ texto: string }>
  createdAt: string
}

const STATUS_EVOLUCAO_LABEL: Record<MetricaEvoluida['status'], string> = {
  novo: 'Novo',
  removido: 'Removido',
  estavel: 'Estável',
  alta: 'Alta',
  baixa: 'Baixa',
}

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

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-xl border border-border-grey bg-white p-4 shadow-sm', className)}>
      {children}
    </div>
  )
}

export default function ClienteCompetenciaPage({
  params,
}: {
  params: Promise<{ id: string; competencia: string }>
}) {
  const { id, competencia } = use(params)
  const parsed = parseCompetencia(competencia)
  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [documentos, setDocumentos] = useState<Documento[]>([])
  const [usuario, setUsuario] = useState<UsuarioLogado | null>(null)
  const [analisesConsolidadas, setAnalisesConsolidadas] = useState<AnaliseConsolidada[]>([])
  const [carregando, setCarregando] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [erroUpload, setErroUpload] = useState<string | null>(null)
  const [selecionados, setSelecionados] = useState<string[]>([])
  const [gerandoConsolidada, setGerandoConsolidada] = useState(false)
  const [erroConsolidada, setErroConsolidada] = useState<string | null>(null)
  const [analiseEvolucao, setAnaliseEvolucao] = useState<AnaliseEvolucao | null>(null)
  const [gerandoEvolucao, setGerandoEvolucao] = useState(false)
  const [erroEvolucao, setErroEvolucao] = useState<string | null>(null)

  async function carregar() {
    if (!parsed) return
    setCarregando(true)
    const [clienteResponse, documentosResponse, consolidadasResponse, evolucaoResponse] = await Promise.all([
      fetch(`/api/clientes/${id}`),
      fetch(`/api/documentos?clienteId=${id}&competenciaAno=${parsed.ano}&competenciaMes=${parsed.mes}`),
      fetch(`/api/clientes/${id}/competencias/${competencia}/analise-consolidada`),
      fetch(`/api/clientes/${id}/competencias/${competencia}/analise-evolucao`),
    ])
    if (clienteResponse.ok) setCliente(await clienteResponse.json())
    if (documentosResponse.ok) setDocumentos(await documentosResponse.json())
    if (consolidadasResponse.ok) setAnalisesConsolidadas(await consolidadasResponse.json())
    if (evolucaoResponse.ok) setAnaliseEvolucao(await evolucaoResponse.json())
    setCarregando(false)
  }

  useEffect(() => {
    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, competencia])

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then(setUsuario)
  }, [])

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!parsed) return
    setErroUpload(null)
    const form = event.currentTarget
    const input = form.elements.namedItem('arquivo') as HTMLInputElement
    const arquivo = input.files?.[0]
    if (!arquivo) return

    setEnviando(true)
    const formData = new FormData()
    formData.set('arquivo', arquivo)
    formData.set('clienteId', id)
    formData.set('competenciaAno', String(parsed.ano))
    formData.set('competenciaMes', String(parsed.mes))

    const response = await fetch('/api/documentos', { method: 'POST', body: formData })
    setEnviando(false)

    if (!response.ok) {
      const body = await response.json().catch(() => null)
      setErroUpload(body?.error ?? 'Falha ao enviar o documento.')
      return
    }
    form.reset()
    carregar()
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

  function toggleSelecionado(docId: string) {
    setSelecionados((atual) => (atual.includes(docId) ? atual.filter((x) => x !== docId) : [...atual, docId]))
  }

  async function handleGerarConsolidada() {
    setErroConsolidada(null)
    setGerandoConsolidada(true)
    const response = await fetch(`/api/clientes/${id}/competencias/${competencia}/analise-consolidada`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documentoIds: selecionados }),
    })
    setGerandoConsolidada(false)
    if (!response.ok) {
      const body = await response.json().catch(() => null)
      setErroConsolidada(body?.error ?? 'Falha ao gerar a análise consolidada.')
      return
    }
    setSelecionados([])
    carregar()
  }

  async function handleGerarEvolucao() {
    setErroEvolucao(null)
    setGerandoEvolucao(true)
    const response = await fetch(`/api/clientes/${id}/competencias/${competencia}/analise-evolucao`, {
      method: 'POST',
    })
    setGerandoEvolucao(false)
    if (!response.ok) {
      const body = await response.json().catch(() => null)
      setErroEvolucao(body?.error ?? 'Falha ao gerar a comparação com o mês anterior.')
      return
    }
    carregar()
  }

  if (!parsed) {
    return (
      <main className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
        <p className="flex items-center gap-2 rounded-xl bg-red-crit-light p-4 text-sm text-red-crit">
          <AlertCircle className="size-4 shrink-0" strokeWidth={2.25} />
          Competência inválida na URL (esperado AAAA-MM).
        </p>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-7xl space-y-8 px-6 py-8 lg:px-8">
      <div className="space-y-1">
        <Link href={`/clientes/${id}`} className="text-xs font-semibold tracking-wide text-orange uppercase hover:underline">
          {cliente?.nome ?? '...'}
        </Link>
        <h1 className="text-2xl font-bold text-navy capitalize">{nomeCompetencia(parsed.ano, parsed.mes)}</h1>
      </div>

      <Card className="p-0">
        <form onSubmit={handleUpload} className="flex flex-wrap items-center gap-3 p-4">
          <label className="flex flex-1 items-center gap-2">
            <Upload className="size-4 shrink-0 text-mid-grey" strokeWidth={2.25} />
            <input type="file" name="arquivo" accept=".xlsx,.csv,.pdf,.docx" required className="text-sm" />
          </label>
          <button
            type="submit"
            disabled={enviando}
            className="flex items-center gap-1.5 rounded-lg bg-orange px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-orange-dark disabled:opacity-50"
          >
            {enviando ? <Loader2 className="size-3.5 animate-spin" strokeWidth={2.25} /> : <Upload className="size-3.5" strokeWidth={2.25} />}
            {enviando ? 'Enviando...' : 'Enviar documento'}
          </button>
          {erroUpload && (
            <span className="flex items-center gap-1 text-sm text-red-crit">
              <AlertCircle className="size-3.5 shrink-0" strokeWidth={2.25} />
              {erroUpload}
            </span>
          )}
        </form>
      </Card>

      {carregando ? (
        <p className="flex items-center gap-2 text-sm text-mid-grey">
          <Loader2 className="size-4 animate-spin" strokeWidth={2.25} />
          Carregando...
        </p>
      ) : documentos.length === 0 ? (
        <p className="rounded-xl border border-border-grey bg-white p-6 text-sm text-mid-grey">
          Nenhum documento neste mês ainda.
        </p>
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border border-border-grey shadow-sm">
            <div className="overflow-x-auto">
              <table className="table-institucional">
                <thead>
                  <tr>
                    <th></th>
                    <th>Arquivo</th>
                    <th>Tipo</th>
                    <th>Enviado por</th>
                    <th>Quando</th>
                    <th>Status</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {documentos.map((doc) => (
                    <tr key={doc.id}>
                      <td>
                        <input
                          type="checkbox"
                          disabled={doc.status !== 'concluido'}
                          checked={selecionados.includes(doc.id)}
                          onChange={() => toggleSelecionado(doc.id)}
                          className="size-4 accent-orange"
                        />
                      </td>
                      <td className="font-medium text-navy">{doc.nomeArquivo}</td>
                      <td className="uppercase text-mid-grey">{doc.tipo}</td>
                      <td className="text-mid-grey">{doc.uploadedBy.nome}</td>
                      <td className="text-mid-grey">{new Date(doc.createdAt).toLocaleString('pt-BR')}</td>
                      <td>
                        <Badge variant={STATUS_BADGE[doc.status] ?? 'neutral'}>
                          {STATUS_LABEL[doc.status] ?? doc.status}
                        </Badge>
                      </td>
                      <td>
                        <div className="flex items-center gap-3">
                          <Link href={`/documentos/${doc.id}`} title="Ver análise" className="flex items-center gap-1 text-sm font-medium text-navy hover:underline">
                            <Eye className="size-3.5" strokeWidth={2.25} />
                            Ver
                          </Link>
                          <a href={`/api/documentos/${doc.id}/original`} title="Baixar original" className="text-mid-grey transition-colors hover:text-navy">
                            <Download className="size-4" strokeWidth={2.25} />
                          </a>
                          {doc.status === 'concluido' && (
                            <a href={`/api/documentos/${doc.id}/relatorio`} title="Baixar relatório" className="text-mid-grey transition-colors hover:text-navy">
                              <FileDown className="size-4" strokeWidth={2.25} />
                            </a>
                          )}
                          {usuario && (usuario.role === 'admin' || usuario.id === doc.uploadedById) && (
                            <button
                              onClick={() => handleExcluirDocumento(doc)}
                              title="Excluir"
                              className="text-mid-grey transition-colors hover:text-red-crit"
                            >
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
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleGerarConsolidada}
              disabled={selecionados.length === 0 || gerandoConsolidada}
              className="flex items-center gap-1.5 rounded-lg bg-orange px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-orange-dark disabled:opacity-50"
            >
              {gerandoConsolidada ? <Loader2 className="size-3.5 animate-spin" strokeWidth={2.25} /> : <Layers className="size-3.5" strokeWidth={2.25} />}
              {gerandoConsolidada
                ? 'Gerando...'
                : `Gerar análise consolidada (${selecionados.length} selecionado(s))`}
            </button>
            {erroConsolidada && (
              <span className="flex items-center gap-1 text-sm text-red-crit">
                <AlertCircle className="size-3.5 shrink-0" strokeWidth={2.25} />
                {erroConsolidada}
              </span>
            )}
          </div>
        </>
      )}

      {analisesConsolidadas.length > 0 && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-base font-semibold text-navy">
            <Layers className="size-4.5 text-orange" strokeWidth={2.25} />
            Análises consolidadas geradas
          </h2>
          {analisesConsolidadas.map((analise) => (
            <Card key={analise.id} className="space-y-2 text-sm">
              <p className="text-xs text-mid-grey">
                {analise.documentos.map((d) => d.nomeArquivo).join(', ')} —{' '}
                {new Date(analise.createdAt).toLocaleString('pt-BR')}
              </p>
              <p>{analise.resumo}</p>
              {analise.metricasComparadas.some((m) => m.divergencia) && (
                <ul className="space-y-1 rounded-lg bg-red-crit-light p-3 text-xs text-red-crit">
                  {analise.metricasComparadas
                    .filter((m) => m.divergencia)
                    .map((m) => (
                      <li key={m.label} className="flex gap-1.5">
                        <AlertTriangle className="size-3.5 shrink-0 translate-y-0.5" strokeWidth={2.25} />
                        <span>
                          Divergência em &quot;{m.label}&quot;:{' '}
                          {m.valores.map((v) => `${v.nomeArquivo} = ${v.valorExibicao}`).join(' vs. ')}
                        </span>
                      </li>
                    ))}
                </ul>
              )}
              <a
                href={`/api/analises-consolidadas/${analise.id}/relatorio`}
                className="inline-flex items-center gap-1.5 font-medium text-navy hover:underline"
              >
                <FileDown className="size-3.5" strokeWidth={2.25} />
                Baixar relatório consolidado
              </a>
            </Card>
          ))}
        </section>
      )}

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-base font-semibold text-navy">
          <GitCompare className="size-4.5 text-orange" strokeWidth={2.25} />
          Evolução vs. mês anterior
        </h2>
        {!analiseEvolucao ? (
          <div className="flex items-center gap-3">
            <button
              onClick={handleGerarEvolucao}
              disabled={gerandoEvolucao}
              className="flex items-center gap-1.5 rounded-lg border border-navy/25 bg-white px-3 py-1.5 text-sm font-medium text-navy transition-colors hover:border-navy hover:bg-navy/5 disabled:opacity-50"
            >
              {gerandoEvolucao ? <Loader2 className="size-3.5 animate-spin" strokeWidth={2.25} /> : <GitCompare className="size-3.5" strokeWidth={2.25} />}
              {gerandoEvolucao ? 'Comparando...' : 'Comparar com mês anterior'}
            </button>
            {erroEvolucao && (
              <span className="flex items-center gap-1 text-sm text-red-crit">
                <AlertCircle className="size-3.5 shrink-0" strokeWidth={2.25} />
                {erroEvolucao}
              </span>
            )}
          </div>
        ) : (
          <Card className="space-y-3 text-sm">
            <p className="text-xs text-mid-grey">
              Comparado com {String(analiseEvolucao.competenciaAnteriorMes).padStart(2, '0')}/
              {analiseEvolucao.competenciaAnteriorAno} — gerado em{' '}
              {new Date(analiseEvolucao.createdAt).toLocaleString('pt-BR')}
            </p>
            <p>{analiseEvolucao.resumo}</p>

            <div className="overflow-hidden rounded-lg border border-border-grey">
              <table className="table-institucional">
                <thead>
                  <tr>
                    <th>Métrica</th>
                    <th>Anterior</th>
                    <th>Atual</th>
                    <th>Variação</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {analiseEvolucao.metricasComparadas.map((m) => (
                    <tr key={m.label}>
                      <td className="font-medium text-navy">{m.label}</td>
                      <td className="text-mid-grey">{m.valorAnterior ?? '—'}</td>
                      <td className="text-mid-grey">{m.valorAtual ?? '—'}</td>
                      <td className="text-mid-grey">
                        {m.deltaPercentual != null ? `${(m.deltaPercentual * 100).toFixed(1)}%` : '—'}
                      </td>
                      <td>
                        <Badge
                          variant={
                            m.status === 'alta'
                              ? 'success'
                              : m.status === 'baixa'
                                ? 'critical'
                                : m.status === 'novo'
                                  ? 'alert'
                                  : 'outline'
                          }
                        >
                          {STATUS_EVOLUCAO_LABEL[m.status]}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {analiseEvolucao.pontosAtencao.length > 0 && (
              <div className="rounded-lg bg-red-crit-light p-3">
                <p className="mb-1 flex items-center gap-1.5 font-medium text-red-crit">
                  <AlertTriangle className="size-4" strokeWidth={2.25} />
                  Pontos de atenção
                </p>
                <ul className="space-y-1 pl-1 text-red-crit">
                  {analiseEvolucao.pontosAtencao.map((p, i) => (
                    <li key={i}>{p.texto}</li>
                  ))}
                </ul>
              </div>
            )}

            {analiseEvolucao.melhorias.length > 0 && (
              <div className="rounded-lg bg-green-ok-light p-3">
                <p className="mb-1 flex items-center gap-1.5 font-medium text-green-ok">
                  <CheckCircle2 className="size-4" strokeWidth={2.25} />
                  Melhorias
                </p>
                <ul className="space-y-1 pl-1 text-green-ok">
                  {analiseEvolucao.melhorias.map((p, i) => (
                    <li key={i}>{p.texto}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex items-center gap-4 pt-1">
              <a
                href={`/api/analises-evolucao/${analiseEvolucao.id}/relatorio`}
                className="inline-flex items-center gap-1.5 font-medium text-navy hover:underline"
              >
                <FileDown className="size-3.5" strokeWidth={2.25} />
                Baixar relatório de evolução
              </a>
              <button
                onClick={handleGerarEvolucao}
                disabled={gerandoEvolucao}
                className="inline-flex items-center gap-1.5 font-medium text-navy hover:underline disabled:opacity-50"
              >
                <RefreshCw className={`size-3.5 ${gerandoEvolucao ? 'animate-spin' : ''}`} strokeWidth={2.25} />
                {gerandoEvolucao ? 'Atualizando...' : 'Atualizar comparação'}
              </button>
              {erroEvolucao && (
                <span className="flex items-center gap-1 text-red-crit">
                  <AlertCircle className="size-3.5 shrink-0" strokeWidth={2.25} />
                  {erroEvolucao}
                </span>
              )}
            </div>
          </Card>
        )}
      </section>
    </main>
  )
}
