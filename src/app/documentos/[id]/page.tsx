'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Download,
  FileDown,
  RefreshCw,
  Loader2,
  AlertCircle,
  FileWarning,
  CheckCircle2,
  Gauge,
  ListChecks,
  Trash2,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { BTN_PRIMARY, BTN_OUTLINE } from '@/lib/ui'

interface PontoCritico {
  texto: string
  severidade: 'alto' | 'medio' | 'baixo'
}

interface PontoPositivo {
  texto: string
}

interface MetricaChave {
  label: string
  valorNumerico: number | null
  unidade: string | null
  valorExibicao: string
}

interface Analise {
  resumo: string
  pontosCriticos: PontoCritico[]
  pontosPositivos: PontoPositivo[]
  metricasChave: MetricaChave[] | null
  recomendacoes: string[] | null
  promptVersion: string
}

interface Documento {
  id: string
  nomeArquivo: string
  tipo: string
  status: string
  mensagemErro: string | null
  uploadedById: string
  uploadedBy: { nome: string }
  analise: Analise | null
}

interface UsuarioLogado {
  id: string
  role: string
}

interface PreviewPlanilha {
  cabecalho: string[]
  linhas: string[][]
  totalLinhas: number
  truncado: boolean
}

const SEVERIDADE_BADGE: Record<PontoCritico['severidade'], 'critical' | 'alert' | 'low'> = {
  alto: 'critical',
  medio: 'alert',
  baixo: 'low',
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ElementType
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-2 border-b border-border-grey pb-4 last:border-b-0 last:pb-0">
      <h2 className="flex items-center gap-1.5 text-sm font-semibold text-navy">
        <Icon className="size-4 text-orange" strokeWidth={2.25} />
        {title}
      </h2>
      {children}
    </section>
  )
}

function DocumentoOriginal({ documento }: { documento: Documento }) {
  const [preview, setPreview] = useState<PreviewPlanilha | null>(null)

  useEffect(() => {
    if (documento.tipo === 'xlsx' || documento.tipo === 'csv') {
      fetch(`/api/documentos/${documento.id}/preview`)
        .then((r) => r.json())
        .then(setPreview)
    }
  }, [documento.id, documento.tipo])

  if (documento.tipo === 'pdf') {
    return (
      <iframe
        src={`/api/documentos/${documento.id}/original?modo=preview`}
        className="h-[70vh] w-full rounded-lg border border-border-grey"
        title="Documento original"
      />
    )
  }

  if (documento.tipo === 'docx') {
    return (
      <iframe
        src={`/api/documentos/${documento.id}/preview`}
        className="h-[70vh] w-full rounded-lg border border-border-grey"
        title="Documento original"
      />
    )
  }

  if (!preview) {
    return (
      <p className="flex items-center gap-2 text-sm text-mid-grey">
        <Loader2 className="size-4 animate-spin" strokeWidth={2.25} />
        Carregando preview...
      </p>
    )
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border-grey">
      {preview.truncado && (
        <p className="border-b border-border-grey bg-orange-light px-3 py-2 text-xs text-orange-dark">
          Mostrando as primeiras {preview.linhas.length} de {preview.totalLinhas} linhas. Baixe o
          original pra ver tudo.
        </p>
      )}
      <div className="max-h-[65vh] overflow-auto">
        <table className="table-institucional">
          <thead>
            <tr>
              {preview.cabecalho.map((coluna, i) => (
                <th key={i}>{coluna}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {preview.linhas.map((linha, i) => (
              <tr key={i}>
                {linha.map((valor, j) => (
                  <td key={j}>{valor}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function AnaliseIA({ documento }: { documento: Documento }) {
  if (documento.status === 'processando') {
    return (
      <p className="flex items-center gap-2 text-sm text-mid-grey">
        <Loader2 className="size-4 animate-spin" strokeWidth={2.25} />
        Processando...
      </p>
    )
  }
  if (documento.status === 'erro') {
    return (
      <p className="flex items-center gap-2 rounded-lg bg-red-crit-light p-3 text-sm text-red-crit">
        <AlertCircle className="size-4 shrink-0" strokeWidth={2.25} />
        Erro ao analisar: {documento.mensagemErro}
      </p>
    )
  }
  if (!documento.analise) {
    return <p className="text-sm text-mid-grey">Sem análise disponível.</p>
  }

  const { analise } = documento

  return (
    <div className="space-y-4">
      <Section icon={Gauge} title="Resumo">
        <p className="text-sm leading-relaxed text-foreground">{analise.resumo}</p>
      </Section>

      <Section icon={FileWarning} title="Pontos críticos">
        {analise.pontosCriticos.length === 0 ? (
          <p className="text-sm text-mid-grey">Nenhum ponto crítico identificado.</p>
        ) : (
          <ul className="space-y-1.5">
            {analise.pontosCriticos.map((ponto, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <Badge variant={SEVERIDADE_BADGE[ponto.severidade]} className="mt-0.5 shrink-0 capitalize">
                  {ponto.severidade}
                </Badge>
                <span>{ponto.texto}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section icon={CheckCircle2} title="Pontos positivos">
        {analise.pontosPositivos.length === 0 ? (
          <p className="text-sm text-mid-grey">Nenhum ponto positivo identificado.</p>
        ) : (
          <ul className="space-y-1.5">
            {analise.pontosPositivos.map((ponto, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-green-ok" strokeWidth={2.25} />
                <span>{ponto.texto}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {analise.metricasChave && analise.metricasChave.length > 0 && (
        <Section icon={Gauge} title="Métricas-chave">
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {analise.metricasChave.map((metrica, i) => (
              <div key={i} className="rounded-xl bg-navy-2 p-3.5 shadow-sm">
                <p className="text-[0.68rem] font-semibold tracking-wide text-white/70 uppercase">{metrica.label}</p>
                <p className="mt-0.5 text-xl font-bold tabular-nums text-orange">{metrica.valorExibicao}</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {analise.recomendacoes && analise.recomendacoes.length > 0 && (
        <Section icon={ListChecks} title="Recomendações">
          <ul className="space-y-1.5">
            {analise.recomendacoes.map((recomendacao, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-orange" />
                <span>{recomendacao}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  )
}

export default function DocumentoDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [documento, setDocumento] = useState<Documento | null>(null)
  const [usuario, setUsuario] = useState<UsuarioLogado | null>(null)
  const [reprocessando, setReprocessando] = useState(false)
  const [excluindo, setExcluindo] = useState(false)

  async function carregar() {
    const response = await fetch(`/api/documentos/${id}`)
    if (response.ok) {
      setDocumento(await response.json())
    }
  }

  useEffect(() => {
    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then(setUsuario)
  }, [])

  async function handleReprocessar() {
    setReprocessando(true)
    await fetch(`/api/documentos/${id}/reprocessar`, { method: 'POST' })
    await carregar()
    setReprocessando(false)
  }

  async function handleExcluir() {
    if (!documento) return
    if (!confirm(`Excluir "${documento.nomeArquivo}"? Essa ação não pode ser desfeita.`)) return
    setExcluindo(true)
    const response = await fetch(`/api/documentos/${id}`, { method: 'DELETE' })
    setExcluindo(false)
    if (!response.ok) {
      const body = await response.json().catch(() => null)
      alert(body?.error ?? 'Falha ao excluir documento.')
      return
    }
    router.push('/')
  }

  if (!documento) {
    return (
      <main className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
        <p className="flex items-center gap-2 text-sm text-mid-grey">
          <Loader2 className="size-4 animate-spin" strokeWidth={2.25} />
          Carregando...
        </p>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-6 py-8 lg:px-8">
      <div className="card flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-navy">{documento.nomeArquivo}</h1>
          <p className="text-sm text-mid-grey">Enviado por {documento.uploadedBy.nome}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={`/api/documentos/${documento.id}/original`} className={BTN_OUTLINE}>
            <Download className="size-3.5" strokeWidth={2.25} />
            Baixar original
          </a>
          {documento.status === 'concluido' && (
            <a href={`/api/documentos/${documento.id}/relatorio`} className={BTN_OUTLINE}>
              <FileDown className="size-3.5" strokeWidth={2.25} />
              Baixar relatório
            </a>
          )}
          <button onClick={handleReprocessar} disabled={reprocessando} className={BTN_PRIMARY}>
            <RefreshCw className={`size-3.5 ${reprocessando ? 'animate-spin' : ''}`} strokeWidth={2.25} />
            {reprocessando ? 'Reprocessando...' : 'Reprocessar'}
          </button>
          {usuario && (usuario.role === 'admin' || usuario.id === documento.uploadedById) && (
            <button
              onClick={handleExcluir}
              disabled={excluindo}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-red-crit/30 bg-white px-3.5 py-2 text-sm font-medium text-red-crit shadow-xs transition-all duration-150 hover:border-red-crit hover:bg-red-crit-light disabled:pointer-events-none disabled:opacity-50"
            >
              <Trash2 className="size-3.5" strokeWidth={2.25} />
              {excluindo ? 'Excluindo...' : 'Excluir'}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card">
          <h2 className="mb-3 text-sm font-semibold text-navy uppercase tracking-wide">Documento original</h2>
          <DocumentoOriginal documento={documento} />
        </div>
        <div className="card">
          <h2 className="mb-3 text-sm font-semibold text-navy uppercase tracking-wide">Análise da IA</h2>
          <AnaliseIA documento={documento} />
        </div>
      </div>
    </main>
  )
}
