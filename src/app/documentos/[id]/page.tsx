'use client'

import { use, useEffect, useState } from 'react'

interface PontoCritico {
  texto: string
  severidade: 'alto' | 'medio' | 'baixo'
}

interface PontoPositivo {
  texto: string
}

interface MetricaChave {
  label: string
  valor: string
}

interface Analise {
  resumo: string
  pontosCriticos: PontoCritico[]
  pontosPositivos: PontoPositivo[]
  metricasChave: MetricaChave[] | null
  promptVersion: string
}

interface Documento {
  id: string
  nomeArquivo: string
  tipo: string
  status: string
  mensagemErro: string | null
  uploadedBy: { nome: string }
  analise: Analise | null
}

interface PreviewPlanilha {
  cabecalho: string[]
  linhas: string[][]
  totalLinhas: number
  truncado: boolean
}

const SEVERIDADE_BADGE: Record<PontoCritico['severidade'], string> = {
  alto: 'bg-red-100 text-red-800',
  medio: 'bg-orange-100 text-orange-800',
  baixo: 'bg-gray-100 text-gray-800',
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
        className="h-[70vh] w-full rounded border"
        title="Documento original"
      />
    )
  }

  if (!preview) {
    return <p className="text-sm text-muted-foreground">Carregando preview...</p>
  }

  return (
    <div className="overflow-auto rounded border">
      {preview.truncado && (
        <p className="border-b bg-yellow-50 p-2 text-xs text-yellow-800">
          Mostrando as primeiras {preview.linhas.length} de {preview.totalLinhas} linhas. Baixe o
          original pra ver tudo.
        </p>
      )}
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b bg-gray-50">
            {preview.cabecalho.map((coluna, i) => (
              <th key={i} className="p-2">
                {coluna}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {preview.linhas.map((linha, i) => (
            <tr key={i} className="border-b">
              {linha.map((valor, j) => (
                <td key={j} className="p-2">
                  {valor}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function AnaliseIA({ documento }: { documento: Documento }) {
  if (documento.status === 'processando') {
    return <p className="text-sm text-muted-foreground">Processando...</p>
  }
  if (documento.status === 'erro') {
    return <p className="text-sm text-red-600">Erro ao analisar: {documento.mensagemErro}</p>
  }
  if (!documento.analise) {
    return <p className="text-sm text-muted-foreground">Sem análise disponível.</p>
  }

  const { analise } = documento

  return (
    <div className="space-y-4">
      <section>
        <h2 className="font-medium">Resumo</h2>
        <p className="text-sm">{analise.resumo}</p>
      </section>

      <section>
        <h2 className="font-medium">Pontos críticos</h2>
        <ul className="space-y-1">
          {analise.pontosCriticos.map((ponto, i) => (
            <li key={i} className="text-sm">
              <span className={`mr-2 rounded px-2 py-0.5 text-xs ${SEVERIDADE_BADGE[ponto.severidade]}`}>
                {ponto.severidade}
              </span>
              {ponto.texto}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="font-medium">Pontos positivos</h2>
        <ul className="space-y-1">
          {analise.pontosPositivos.map((ponto, i) => (
            <li key={i} className="text-sm">
              <span className="mr-2 rounded bg-green-100 px-2 py-0.5 text-xs text-green-800">✓</span>
              {ponto.texto}
            </li>
          ))}
        </ul>
      </section>

      {analise.metricasChave && analise.metricasChave.length > 0 && (
        <section>
          <h2 className="font-medium">Métricas-chave</h2>
          <table className="w-full text-left text-sm">
            <tbody>
              {analise.metricasChave.map((metrica, i) => (
                <tr key={i} className="border-b">
                  <td className="py-1 font-medium">{metrica.label}</td>
                  <td className="py-1">{metrica.valor}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  )
}

export default function DocumentoDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [documento, setDocumento] = useState<Documento | null>(null)
  const [reprocessando, setReprocessando] = useState(false)

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

  async function handleReprocessar() {
    setReprocessando(true)
    await fetch(`/api/documentos/${id}/reprocessar`, { method: 'POST' })
    await carregar()
    setReprocessando(false)
  }

  if (!documento) {
    return (
      <main className="p-8">
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </main>
    )
  }

  return (
    <main className="space-y-4 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">{documento.nomeArquivo}</h1>
          <p className="text-sm text-muted-foreground">Enviado por {documento.uploadedBy.nome}</p>
        </div>
        <div className="flex gap-3">
          <a
            href={`/api/documentos/${documento.id}/original`}
            className="rounded border px-3 py-1.5 text-sm hover:bg-gray-50"
          >
            Baixar original
          </a>
          <button
            onClick={handleReprocessar}
            disabled={reprocessando}
            className="rounded bg-black px-3 py-1.5 text-sm text-white disabled:opacity-50"
          >
            {reprocessando ? 'Reprocessando...' : 'Reprocessar'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-2 font-medium">Documento original</h2>
          <DocumentoOriginal documento={documento} />
        </div>
        <div>
          <h2 className="mb-2 font-medium">Análise da IA</h2>
          <AnaliseIA documento={documento} />
        </div>
      </div>
    </main>
  )
}
