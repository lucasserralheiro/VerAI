'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, Eye, Inbox, Trash2, Download } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { BTN_PRIMARY, LINK_DANGER } from '@/lib/ui'

interface PropostaComercial {
  id: string
  nomeArquivo: string
  status: string
  createdAt: string
}

const STATUS_BADGE: Record<string, 'success' | 'neutral' | 'critical'> = {
  concluido: 'success',
  rascunho: 'neutral',
  erro: 'critical',
}

const STATUS_LABEL: Record<string, string> = {
  concluido: 'Concluído',
  rascunho: 'Rascunho',
  erro: 'Erro',
}

export default function PropostasComerciaisPage() {
  const [propostas, setPropostas] = useState<PropostaComercial[]>([])
  const [carregando, setCarregando] = useState(true)
  const [excluindoId, setExcluindoId] = useState<string | null>(null)
  const [baixandoId, setBaixandoId] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/propostas-comerciais')
      .then((r) => (r.ok ? r.json() : []))
      .then(setPropostas)
      .finally(() => setCarregando(false))
  }, [])

  /** Baixa o(s) arquivo(s) original(is) da proposta — uma proposta pode juntar vários, então busca
   *  a lista e dispara um download por arquivo (mesma rota do botão de baixar da tela de detalhe). */
  async function handleBaixar(proposta: PropostaComercial) {
    setBaixandoId(proposta.id)
    try {
      const response = await fetch(`/api/propostas-comerciais/${proposta.id}`)
      if (!response.ok) throw new Error()
      const detalhe: { arquivos: Array<{ id: string; nomeArquivo: string }> } = await response.json()
      for (const arquivo of detalhe.arquivos) {
        const link = document.createElement('a')
        link.href = `/api/propostas-comerciais/${proposta.id}/arquivos/${arquivo.id}`
        link.download = arquivo.nomeArquivo
        document.body.appendChild(link)
        link.click()
        link.remove()
        // Respiro entre downloads: o navegador descarta cliques em sequência imediata.
        if (detalhe.arquivos.length > 1) await new Promise((resolve) => setTimeout(resolve, 400))
      }
    } catch {
      alert('Falha ao baixar o arquivo da proposta.')
    } finally {
      setBaixandoId(null)
    }
  }

  async function handleExcluir(proposta: PropostaComercial) {
    if (!confirm(`Excluir "${proposta.nomeArquivo}"? Essa ação não pode ser desfeita.`)) return
    setExcluindoId(proposta.id)
    const response = await fetch(`/api/propostas-comerciais/${proposta.id}`, { method: 'DELETE' })
    setExcluindoId(null)
    if (!response.ok) {
      const body = await response.json().catch(() => null)
      alert(body?.error ?? 'Falha ao excluir proposta.')
      return
    }
    setPropostas((prev) => prev.filter((p) => p.id !== proposta.id))
  }

  return (
    <main className="mx-auto max-w-[96rem] space-y-6 px-6 py-8 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <span className="text-xs font-semibold tracking-wide text-orange uppercase">Proposta Comercial</span>
          <h1 className="text-2xl font-bold text-navy">Proposta Comercial (Conversão SEI)</h1>
        </div>
        <Link href="/propostas-comerciais/novo" className={BTN_PRIMARY}>
          <Plus className="size-3.5" strokeWidth={2.25} />
          Nova conversão
        </Link>
      </div>

      <div className="card-flush">
        {carregando ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="skeleton h-10 w-full" />
            ))}
          </div>
        ) : propostas.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-10 text-center">
            <span className="flex size-11 items-center justify-center rounded-full bg-light-grey text-mid-grey">
              <Inbox className="size-5" strokeWidth={1.75} />
            </span>
            <p className="text-sm text-mid-grey">Nenhuma conversão ainda.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-institucional">
              <thead>
                <tr>
                  <th>Arquivo</th>
                  <th>Data</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {propostas.map((proposta) => (
                  <tr key={proposta.id}>
                    <td className="font-medium text-navy">{proposta.nomeArquivo}</td>
                    <td className="text-mid-grey">{new Date(proposta.createdAt).toLocaleString('pt-BR')}</td>
                    <td>
                      <Badge variant={STATUS_BADGE[proposta.status] ?? 'neutral'}>
                        {STATUS_LABEL[proposta.status] ?? proposta.status}
                      </Badge>
                    </td>
                    <td>
                      <div className="flex items-center gap-3">
                        <Link
                          href={`/propostas-comerciais/${proposta.id}`}
                          className="flex items-center gap-1 text-sm font-medium text-navy transition-colors hover:text-orange hover:underline"
                        >
                          <Eye className="size-3.5" strokeWidth={2.25} />
                          Ver
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleBaixar(proposta)}
                          disabled={baixandoId === proposta.id}
                          title="Baixar arquivo original"
                          className="flex items-center gap-1 text-sm font-medium text-navy transition-colors hover:text-orange hover:underline disabled:opacity-50"
                        >
                          <Download className="size-3.5" strokeWidth={2.25} />
                          {baixandoId === proposta.id ? 'Baixando...' : 'Baixar'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleExcluir(proposta)}
                          disabled={excluindoId === proposta.id}
                          title="Excluir"
                          className={LINK_DANGER}
                        >
                          <Trash2 className="size-3.5" strokeWidth={2.25} />
                          {excluindoId === proposta.id ? 'Excluindo...' : 'Excluir'}
                        </button>
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
