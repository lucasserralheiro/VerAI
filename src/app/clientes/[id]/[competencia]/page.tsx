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
  const [carregando, setCarregando] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [erroUpload, setErroUpload] = useState<string | null>(null)

  async function carregar() {
    if (!parsed) return
    setCarregando(true)
    const [clienteResponse, documentosResponse] = await Promise.all([
      fetch(`/api/clientes/${id}`),
      fetch(`/api/documentos?clienteId=${id}&competenciaAno=${parsed.ano}&competenciaMes=${parsed.mes}`),
    ])
    if (clienteResponse.ok) setCliente(await clienteResponse.json())
    if (documentosResponse.ok) setDocumentos(await documentosResponse.json())
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
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b">
              <th className="py-2">Arquivo</th>
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
                <td className="py-2">{doc.nomeArquivo}</td>
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
      )}
    </main>
  )
}
