'use client'

import { use, useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { nomeCompetencia, parseCompetencia } from '@/lib/competencia'

interface Documento {
  id: string
  nomeArquivo: string
  tipo: string
  status: string
  createdAt: string
  uploadedBy: { nome: string }
  analise: { id: string } | null
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

const STATUS_BADGE: Record<string, string> = {
  concluido: 'bg-green-100 text-green-800',
  processando: 'bg-gray-100 text-gray-800',
  erro: 'bg-red-100 text-red-800',
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
      <main className="p-8">
        <p className="text-sm text-red-600">Competência inválida na URL (esperado AAAA-MM).</p>
      </main>
    )
  }

  return (
    <main className="space-y-6 p-8">
      <div>
        <p className="text-sm text-muted-foreground">
          <Link href={`/clientes/${id}`} className="hover:underline">
            {cliente?.nome ?? '...'}
          </Link>
        </p>
        <h1 className="text-xl font-semibold">{nomeCompetencia(parsed.ano, parsed.mes)}</h1>
      </div>

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

      {carregando ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : documentos.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum documento neste mês ainda.</p>
      ) : (
        <>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-2"></th>
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
                <tr key={doc.id} className="border-b">
                  <td className="py-2">
                    <input
                      type="checkbox"
                      disabled={doc.status !== 'concluido'}
                      checked={selecionados.includes(doc.id)}
                      onChange={() => toggleSelecionado(doc.id)}
                    />
                  </td>
                  <td>{doc.nomeArquivo}</td>
                  <td>{doc.tipo}</td>
                  <td>{doc.uploadedBy.nome}</td>
                  <td>{new Date(doc.createdAt).toLocaleString('pt-BR')}</td>
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

          <div className="flex items-center gap-3">
            <button
              onClick={handleGerarConsolidada}
              disabled={selecionados.length === 0 || gerandoConsolidada}
              className="rounded bg-black px-3 py-1.5 text-sm text-white disabled:opacity-50"
            >
              {gerandoConsolidada
                ? 'Gerando...'
                : `Gerar análise consolidada (${selecionados.length} selecionado(s))`}
            </button>
            {erroConsolidada && <span className="text-sm text-red-600">{erroConsolidada}</span>}
          </div>
        </>
      )}

      {analisesConsolidadas.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-medium">Análises consolidadas geradas</h2>
          {analisesConsolidadas.map((analise) => (
            <div key={analise.id} className="space-y-2 rounded border p-4 text-sm">
              <p className="text-xs text-muted-foreground">
                {analise.documentos.map((d) => d.nomeArquivo).join(', ')} —{' '}
                {new Date(analise.createdAt).toLocaleString('pt-BR')}
              </p>
              <p>{analise.resumo}</p>
              {analise.metricasComparadas.some((m) => m.divergencia) && (
                <ul className="list-disc space-y-1 pl-5 text-xs text-red-700">
                  {analise.metricasComparadas
                    .filter((m) => m.divergencia)
                    .map((m) => (
                      <li key={m.label}>
                        Divergência em &quot;{m.label}&quot;:{' '}
                        {m.valores.map((v) => `${v.nomeArquivo} = ${v.valorExibicao}`).join(' vs. ')}
                      </li>
                    ))}
                </ul>
              )}
              <a
                href={`/api/analises-consolidadas/${analise.id}/relatorio`}
                className="text-blue-600 hover:underline"
              >
                Baixar relatório consolidado
              </a>
            </div>
          ))}
        </section>
      )}

      <section className="space-y-3">
        <h2 className="font-medium">Evolução vs. mês anterior</h2>
        {!analiseEvolucao ? (
          <div className="flex items-center gap-3">
            <button
              onClick={handleGerarEvolucao}
              disabled={gerandoEvolucao}
              className="rounded border px-3 py-1.5 text-sm disabled:opacity-50"
            >
              {gerandoEvolucao ? 'Comparando...' : 'Comparar com mês anterior'}
            </button>
            {erroEvolucao && <span className="text-sm text-red-600">{erroEvolucao}</span>}
          </div>
        ) : (
          <div className="space-y-2 rounded border p-4 text-sm">
            <p className="text-xs text-muted-foreground">
              Comparado com {String(analiseEvolucao.competenciaAnteriorMes).padStart(2, '0')}/
              {analiseEvolucao.competenciaAnteriorAno} — gerado em{' '}
              {new Date(analiseEvolucao.createdAt).toLocaleString('pt-BR')}
            </p>
            <p>{analiseEvolucao.resumo}</p>

            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b">
                  <th className="py-1">Métrica</th>
                  <th>Anterior</th>
                  <th>Atual</th>
                  <th>Variação</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {analiseEvolucao.metricasComparadas.map((m) => (
                  <tr key={m.label} className="border-b">
                    <td className="py-1">{m.label}</td>
                    <td>{m.valorAnterior ?? '—'}</td>
                    <td>{m.valorAtual ?? '—'}</td>
                    <td>{m.deltaPercentual != null ? `${(m.deltaPercentual * 100).toFixed(1)}%` : '—'}</td>
                    <td>{STATUS_EVOLUCAO_LABEL[m.status]}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {analiseEvolucao.pontosAtencao.length > 0 && (
              <div>
                <p className="font-medium">Pontos de atenção</p>
                <ul className="list-disc space-y-1 pl-5 text-red-700">
                  {analiseEvolucao.pontosAtencao.map((p, i) => (
                    <li key={i}>{p.texto}</li>
                  ))}
                </ul>
              </div>
            )}

            {analiseEvolucao.melhorias.length > 0 && (
              <div>
                <p className="font-medium">Melhorias</p>
                <ul className="list-disc space-y-1 pl-5 text-green-700">
                  {analiseEvolucao.melhorias.map((p, i) => (
                    <li key={i}>{p.texto}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex items-center gap-3">
              <a
                href={`/api/analises-evolucao/${analiseEvolucao.id}/relatorio`}
                className="text-blue-600 hover:underline"
              >
                Baixar relatório de evolução
              </a>
              <button
                onClick={handleGerarEvolucao}
                disabled={gerandoEvolucao}
                className="text-blue-600 hover:underline disabled:opacity-50"
              >
                {gerandoEvolucao ? 'Atualizando...' : 'Atualizar comparação'}
              </button>
              {erroEvolucao && <span className="text-sm text-red-600">{erroEvolucao}</span>}
            </div>
          </div>
        )}
      </section>
    </main>
  )
}
