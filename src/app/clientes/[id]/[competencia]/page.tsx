'use client'

import { use, useEffect, useMemo, useRef, useState, type DragEvent, type FormEvent } from 'react'
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
  ChevronRight,
  FileStack,
  History,
  FileUp,
  X,
  Sparkles,
} from 'lucide-react'
import { nomeCompetencia, parseCompetencia } from '@/lib/competencia'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { BTN_PRIMARY, BTN_OUTLINE, LINK_DANGER } from '@/lib/ui'

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

type Aba = 'documentos' | 'consolidada' | 'evolucao'

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

const EXTENSOES_ACEITAS = '.xlsx,.csv,.pdf,.docx'

function formatarTamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-2xl border border-black/[0.05] bg-white p-4 shadow-sm', className)}>
      {children}
    </div>
  )
}

function Stat({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'critical' | 'success' }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-sm font-medium',
        tone === 'neutral' && 'text-mid-grey',
        tone === 'critical' && 'text-red-crit',
        tone === 'success' && 'text-green-ok'
      )}
    >
      {children}
    </span>
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
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [arrastando, setArrastando] = useState(false)
  const [selecionados, setSelecionados] = useState<string[]>([])
  const [gerandoConsolidada, setGerandoConsolidada] = useState(false)
  const [erroConsolidada, setErroConsolidada] = useState<string | null>(null)
  const [analiseEvolucao, setAnaliseEvolucao] = useState<AnaliseEvolucao | null>(null)
  const [gerandoEvolucao, setGerandoEvolucao] = useState(false)
  const [erroEvolucao, setErroEvolucao] = useState<string | null>(null)
  const [aba, setAba] = useState<Aba>('documentos')
  const [historicoAberto, setHistoricoAberto] = useState(false)
  // Por padrão, toda vez que a lista de documentos muda, selecionamos automaticamente
  // todos os concluídos — a ação óbvia é comparar tudo que já foi enviado no mês.
  // Assim que a pessoa mexe manualmente numa seleção, paramos de sobrescrever a escolha dela.
  const selecaoManualRef = useRef(false)

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
    if (documentosResponse.ok) {
      const docs: Documento[] = await documentosResponse.json()
      setDocumentos(docs)
      if (!selecaoManualRef.current) {
        setSelecionados(docs.filter((d) => d.status === 'concluido').map((d) => d.id))
      }
    }
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

  const analiseAtual = analisesConsolidadas[0] ?? null
  const analisesAnteriores = analisesConsolidadas.slice(1)
  const divergenciasAtuais = useMemo(
    () => analiseAtual?.metricasComparadas.filter((m) => m.divergencia) ?? [],
    [analiseAtual]
  )

  const TABS: Array<{ key: Aba; label: string; icon: typeof FileStack; count?: number }> = [
    { key: 'documentos', label: 'Documentos', icon: FileStack, count: documentos.length },
    { key: 'consolidada', label: 'Relatório consolidado', icon: Layers, count: analisesConsolidadas.length },
    { key: 'evolucao', label: 'Relatório de evolução', icon: GitCompare },
  ]

  async function handleExcluirDocumento(doc: Documento) {
    if (!confirm(`Excluir "${doc.nomeArquivo}"? Essa ação não pode ser desfeita.`)) return
    const response = await fetch(`/api/documentos/${doc.id}`, { method: 'DELETE' })
    if (!response.ok) {
      const body = await response.json().catch(() => null)
      alert(body?.error ?? 'Falha ao excluir documento.')
      return
    }
    setSelecionados((atual) => atual.filter((docId) => docId !== doc.id))
    carregar()
  }

  async function enviarArquivo(arquivoParaEnviar: File) {
    if (!parsed) return
    setErroUpload(null)
    setEnviando(true)
    const formData = new FormData()
    formData.set('arquivo', arquivoParaEnviar)
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
    setArquivo(null)
    carregar()
  }

  function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!arquivo) return
    enviarArquivo(arquivo)
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault()
    setArrastando(false)
    const arquivoSolto = event.dataTransfer.files?.[0]
    if (arquivoSolto) {
      setErroUpload(null)
      setArquivo(arquivoSolto)
    }
  }

  function toggleSelecionado(docId: string) {
    selecaoManualRef.current = true
    setSelecionados((atual) => (atual.includes(docId) ? atual.filter((x) => x !== docId) : [...atual, docId]))
  }

  async function handleGerarConsolidada() {
    if (selecionados.length < 2) return
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
      setErroConsolidada(body?.error ?? 'Falha ao gerar o relatório consolidado.')
      return
    }
    selecaoManualRef.current = false
    setSelecionados([])
    setAba('consolidada')
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
    <main className="mx-auto max-w-7xl space-y-6 px-6 py-8 lg:px-8">
      {enviando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/50 p-4 backdrop-blur-sm">
          <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-2xl bg-white p-8 text-center shadow-xl">
            <Loader2 className="size-8 animate-spin text-orange" strokeWidth={2} />
            <div className="space-y-1.5">
              <p className="text-base font-semibold text-navy">Analisando documento com IA</p>
              <p className="text-sm text-mid-grey">
                Estamos lendo e validando os dados de <span className="font-medium text-navy">{arquivo?.name}</span>. Isso pode levar
                alguns segundos — não feche esta página.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <nav className="flex items-center gap-1.5 text-xs font-medium text-mid-grey">
          <span>Análise de Documentos</span>
          <ChevronRight className="size-3" strokeWidth={2.5} />
          <Link href="/clientes" className="hover:text-navy hover:underline">
            Clientes
          </Link>
          <ChevronRight className="size-3" strokeWidth={2.5} />
          <Link href={`/clientes/${id}`} className="hover:text-navy hover:underline">
            {cliente?.nome ?? '...'}
          </Link>
          <ChevronRight className="size-3" strokeWidth={2.5} />
          <span className="font-semibold text-navy capitalize">{nomeCompetencia(parsed.ano, parsed.mes)}</span>
        </nav>

        <div className="flex flex-wrap items-end justify-between gap-3">
          <h1 className="text-[1.75rem] leading-tight font-semibold tracking-tight text-navy capitalize">
            {nomeCompetencia(parsed.ano, parsed.mes)}
          </h1>

          {!carregando && (
            <div className="flex flex-wrap items-center divide-x divide-border-grey">
              <div className="pr-3.5">
                <Stat>
                  {documentos.length} documento{documentos.length === 1 ? '' : 's'}
                </Stat>
              </div>
              {(divergenciasAtuais.length > 0 || analiseAtual) && (
                <div className="px-3.5">
                  {divergenciasAtuais.length > 0 ? (
                    <Stat tone="critical">
                      <AlertTriangle className="size-3.5" strokeWidth={2.5} />
                      {divergenciasAtuais.length} divergência{divergenciasAtuais.length === 1 ? '' : 's'}
                    </Stat>
                  ) : (
                    <Stat tone="success">
                      <CheckCircle2 className="size-3.5" strokeWidth={2.5} />
                      Sem divergências
                    </Stat>
                  )}
                </div>
              )}
              {analiseEvolucao && (
                <div className="pl-3.5">
                  <Stat>Comparado com o mês anterior</Stat>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {carregando ? (
        <p className="flex items-center gap-2 text-sm text-mid-grey">
          <Loader2 className="size-4 animate-spin" strokeWidth={2.25} />
          Carregando...
        </p>
      ) : (
        <>
          <div className="flex gap-6 overflow-x-auto border-b border-border-grey">
            {TABS.map((tab) => {
              const Icon = tab.icon
              const ativa = aba === tab.key
              return (
                <button
                  key={tab.key}
                  onClick={() => setAba(tab.key)}
                  className={cn(
                    'group relative flex shrink-0 items-center gap-2 py-3 text-[0.8rem] font-semibold whitespace-nowrap tracking-wide uppercase transition-colors',
                    ativa ? 'text-navy' : 'text-mid-grey hover:text-navy'
                  )}
                >
                  <Icon className={cn('size-3.5 transition-colors', ativa ? 'text-orange' : 'text-mid-grey/70 group-hover:text-navy')} strokeWidth={2.25} />
                  {tab.label}
                  {typeof tab.count === 'number' && tab.count > 0 && (
                    <span className={cn('text-[0.7rem] font-medium normal-case', ativa ? 'text-orange' : 'text-mid-grey/70')}>
                      {tab.count}
                    </span>
                  )}
                  <span
                    className={cn(
                      'absolute inset-x-0 -bottom-px h-[2.5px] rounded-full bg-orange transition-transform duration-200 ease-out',
                      ativa ? 'scale-x-100' : 'scale-x-0'
                    )}
                  />
                </button>
              )
            })}
          </div>

          {aba === 'documentos' && (
            <div className="space-y-4">
              <Card className="p-0">
                <form onSubmit={handleUpload} className="p-4">
                  {arquivo ? (
                    <div className="flex items-center gap-3 rounded-xl border border-light-blue bg-light-blue/20 p-3.5">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-white text-navy shadow-xs">
                        <FileUp className="size-4.5" strokeWidth={1.75} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-navy" title={arquivo.name}>
                          {arquivo.name}
                        </p>
                        <p className="text-xs text-mid-grey">{formatarTamanho(arquivo.size)} · pronto para enviar</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setArquivo(null)}
                        aria-label="Remover arquivo selecionado"
                        className="flex size-7 shrink-0 items-center justify-center rounded-full text-mid-grey transition-colors hover:bg-white hover:text-red-crit"
                      >
                        <X className="size-4" strokeWidth={2.25} />
                      </button>
                    </div>
                  ) : (
                    <label
                      onDragOver={(e) => {
                        e.preventDefault()
                        setArrastando(true)
                      }}
                      onDragLeave={() => setArrastando(false)}
                      onDrop={handleDrop}
                      className={cn(
                        'flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-all duration-150',
                        arrastando
                          ? 'border-orange bg-orange-light/50'
                          : 'border-light-blue bg-light-blue/25 hover:border-navy/30 hover:bg-light-blue/40'
                      )}
                    >
                      <input
                        type="file"
                        name="arquivo"
                        accept={EXTENSOES_ACEITAS}
                        className="sr-only"
                        onChange={(e) => {
                          setErroUpload(null)
                          setArquivo(e.target.files?.[0] ?? null)
                        }}
                      />
                      <span className="flex size-11 items-center justify-center rounded-full bg-white text-navy/70 shadow-xs">
                        <FileUp className="size-5" strokeWidth={1.75} />
                      </span>
                      <p className="text-sm text-navy">
                        Arraste um arquivo aqui ou{' '}
                        <span className="font-semibold underline decoration-orange/50 decoration-2 underline-offset-4">
                          escolha no computador
                        </span>
                      </p>
                      <p className="text-xs tracking-wide text-mid-grey/70 uppercase">XLSX · CSV · PDF · DOCX</p>
                    </label>
                  )}

                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <button type="submit" disabled={enviando || !arquivo} className={BTN_PRIMARY}>
                      {enviando ? (
                        <Loader2 className="size-3.5 animate-spin" strokeWidth={2.25} />
                      ) : (
                        <Upload className="size-3.5" strokeWidth={2.25} />
                      )}
                      {enviando ? 'Enviando...' : 'Enviar documento'}
                    </button>
                    {arquivo && !enviando && (
                      <button
                        type="button"
                        onClick={() => setArquivo(null)}
                        className="text-sm font-medium text-mid-grey hover:text-navy"
                      >
                        Escolher outro arquivo
                      </button>
                    )}
                    {erroUpload && (
                      <span className="flex items-center gap-1 text-sm text-red-crit">
                        <AlertCircle className="size-3.5 shrink-0" strokeWidth={2.25} />
                        {erroUpload}
                      </span>
                    )}
                  </div>
                </form>
              </Card>

              {documentos.filter((d) => d.status === 'concluido').length >= 2 && (
                <p className="flex items-center gap-1.5 text-xs text-mid-grey">
                  <Layers className="size-3.5 shrink-0 text-mid-grey/70" strokeWidth={2.25} />
                  Todos os documentos concluídos vêm marcados pra comparação — desmarque os que não devem entrar na análise consolidada.
                </p>
              )}

              {documentos.length > 0 && (
                <div className={cn('card-flush', selecionados.length > 0 && 'pb-16')}>
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
                                  <button onClick={() => handleExcluirDocumento(doc)} title="Excluir" className={LINK_DANGER}>
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
              )}

              {selecionados.length > 0 && (
                <div className="sticky bottom-4 z-10 flex flex-wrap items-center gap-3 rounded-2xl border border-navy/10 bg-white/95 p-3 pl-4 shadow-xl backdrop-blur-sm">
                  {selecionados.length === 1 ? (
                    <span className="text-sm text-mid-grey">
                      1 documento selecionado — marque pelo menos mais 1 pra comparar valores entre eles.
                    </span>
                  ) : (
                    <span className="text-sm font-medium text-navy">
                      {selecionados.length} documentos selecionados pra comparar
                    </span>
                  )}
                  <button
                    onClick={handleGerarConsolidada}
                    disabled={gerandoConsolidada || selecionados.length < 2}
                    title={selecionados.length < 2 ? 'Selecione pelo menos 2 documentos' : undefined}
                    className={cn(BTN_PRIMARY, 'ml-auto')}
                  >
                    {gerandoConsolidada ? (
                      <Loader2 className="size-3.5 animate-spin" strokeWidth={2.25} />
                    ) : (
                      <Layers className="size-3.5" strokeWidth={2.25} />
                    )}
                    {gerandoConsolidada ? 'Gerando...' : 'Gerar análise consolidada'}
                  </button>
                  <button onClick={() => setSelecionados([])} className="text-sm font-medium text-mid-grey hover:text-navy">
                    Limpar
                  </button>
                  {erroConsolidada && (
                    <span className="flex w-full items-center gap-1 text-sm text-red-crit">
                      <AlertCircle className="size-3.5 shrink-0" strokeWidth={2.25} />
                      {erroConsolidada}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {aba === 'consolidada' && (
            <div className="space-y-3">
              {analisesConsolidadas.length === 0 ? (
                <div className="card flex flex-col items-center gap-2 py-10 text-center">
                  <Layers className="size-6 text-mid-grey" strokeWidth={1.75} />
                  <p className="max-w-sm text-sm text-mid-grey">
                    Serve pra comparar números que deveriam bater entre fontes diferentes do mesmo mês — por exemplo, a fatura da nuvem
                    e o controle interno — e pegar divergência antes de fechar a competência.
                  </p>
                  <p className="max-w-sm text-xs text-mid-grey/80">
                    Precisa de pelo menos 2 documentos concluídos no mesmo mês pra comparar.
                  </p>
                  <button onClick={() => setAba('documentos')} className={BTN_OUTLINE}>
                    Ir para Documentos
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm text-mid-grey">
                      Números que deveriam bater entre os documentos deste mês, lado a lado — pra pegar divergência antes de fechar a
                      competência.
                    </p>
                    <button onClick={() => setAba('documentos')} className={BTN_OUTLINE}>
                      <Layers className="size-3.5" strokeWidth={2.25} />
                      Gerar nova análise
                    </button>
                  </div>

                  <Card className="space-y-3 border-l-[3px] border-l-orange text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[0.7rem] font-semibold tracking-wide text-orange uppercase">Análise mais recente</p>
                      <p className="text-xs text-mid-grey">{new Date(analiseAtual!.createdAt).toLocaleString('pt-BR')}</p>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {analiseAtual!.documentos.map((d) => (
                        <Badge key={d.id} variant="outline">
                          {d.nomeArquivo}
                        </Badge>
                      ))}
                    </div>

                    <div className="overflow-hidden overflow-x-auto rounded-lg border border-border-grey">
                      <table className="table-institucional">
                        <thead>
                          <tr>
                            <th>Métrica</th>
                            {analiseAtual!.documentos.map((d) => (
                              <th key={d.id} className="truncate normal-case" title={d.nomeArquivo}>
                                {d.nomeArquivo}
                              </th>
                            ))}
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {analiseAtual!.metricasComparadas.map((m) => (
                            <tr key={m.label}>
                              <td className="font-medium text-navy">{m.label}</td>
                              {analiseAtual!.documentos.map((d) => {
                                const valor = m.valores.find((v) => v.documentoId === d.id)
                                return (
                                  <td key={d.id} className="text-mid-grey">
                                    {valor?.valorExibicao ?? '—'}
                                  </td>
                                )
                              })}
                              <td>
                                {m.divergencia ? (
                                  <Badge variant="critical">
                                    Divergência
                                    {m.divergencia.diferencaPercentual != null
                                      ? ` (${(m.divergencia.diferencaPercentual * 100).toFixed(1)}%)`
                                      : ''}
                                  </Badge>
                                ) : (
                                  <Badge variant="success">OK</Badge>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex items-start gap-2 rounded-lg bg-navy/[0.03] p-3">
                      <Sparkles className="size-4 shrink-0 translate-y-0.5 text-orange" strokeWidth={1.75} />
                      <p className="text-foreground">{analiseAtual!.resumo}</p>
                    </div>

                    <a
                      href={`/api/analises-consolidadas/${analiseAtual!.id}/relatorio`}
                      className="inline-flex items-center gap-1.5 font-medium text-navy hover:underline"
                    >
                      <FileDown className="size-3.5" strokeWidth={2.25} />
                      Baixar relatório consolidado
                    </a>
                  </Card>

                  {analisesAnteriores.length > 0 && (
                    <div>
                      <button
                        onClick={() => setHistoricoAberto((v) => !v)}
                        className="flex items-center gap-1.5 text-sm font-medium text-mid-grey hover:text-navy"
                      >
                        <History className="size-3.5" strokeWidth={2.25} />
                        {historicoAberto ? 'Ocultar' : 'Ver'} histórico ({analisesAnteriores.length} anterior
                        {analisesAnteriores.length === 1 ? '' : 'es'})
                        <ChevronRight className={cn('size-3.5 transition-transform', historicoAberto && 'rotate-90')} strokeWidth={2.25} />
                      </button>

                      {historicoAberto && (
                        <ul className="mt-2 space-y-2">
                          {analisesAnteriores.map((analise) => {
                            const divergenciasAnalise = analise.metricasComparadas.filter((m) => m.divergencia)
                            return (
                              <li key={analise.id} className="card flex flex-wrap items-center justify-between gap-3 py-3 text-xs">
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="text-mid-grey">{new Date(analise.createdAt).toLocaleString('pt-BR')}</p>
                                    {divergenciasAnalise.length > 0 ? (
                                      <Badge variant="critical">
                                        {divergenciasAnalise.length} divergência{divergenciasAnalise.length === 1 ? '' : 's'}
                                      </Badge>
                                    ) : (
                                      <Badge variant="success">OK</Badge>
                                    )}
                                  </div>
                                  <p className="mt-1 truncate text-foreground">{analise.resumo}</p>
                                </div>
                                <a
                                  href={`/api/analises-consolidadas/${analise.id}/relatorio`}
                                  className="flex shrink-0 items-center gap-1.5 font-medium text-navy hover:underline"
                                >
                                  <FileDown className="size-3.5" strokeWidth={2.25} />
                                  Relatório
                                </a>
                              </li>
                            )
                          })}
                        </ul>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {aba === 'evolucao' && (
            <div className="space-y-3">
              {!analiseEvolucao ? (
                <div className="card flex flex-col items-center gap-3 py-10 text-center">
                  <GitCompare className="size-6 text-mid-grey" strokeWidth={1.75} />
                  <p className="text-sm text-mid-grey">Compare os números deste mês com os do mês anterior.</p>
                  <button onClick={handleGerarEvolucao} disabled={gerandoEvolucao} className={BTN_OUTLINE}>
                    {gerandoEvolucao ? (
                      <Loader2 className="size-3.5 animate-spin" strokeWidth={2.25} />
                    ) : (
                      <GitCompare className="size-3.5" strokeWidth={2.25} />
                    )}
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

                  {(analiseEvolucao.pontosAtencao.length > 0 || analiseEvolucao.melhorias.length > 0) && (
                    <div className="grid gap-3 sm:grid-cols-2">
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
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-4 pt-1">
                    <a
                      href={`/api/analises-evolucao/${analiseEvolucao.id}/relatorio`}
                      className="inline-flex items-center gap-1.5 font-medium text-navy hover:underline"
                    >
                      <FileDown className="size-3.5" strokeWidth={2.25} />
                      Baixar PDF
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
            </div>
          )}
        </>
      )}
    </main>
  )
}
