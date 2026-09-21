'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Eye, FileSpreadsheet, FileText, Inbox, Search, Trash2 } from 'lucide-react'
import { BTN_OUTLINE, LINK_DANGER, LINK_NAVY } from '@/lib/ui'

// Histórico do ConfereAI. A geração em si continua sem estado — o que esta
// tela lista é o registro do que passou pela ferramenta: o NOME dos arquivos
// submetidos (os arquivos não são guardados) e os dois documentos gerados,
// pra rebaixar sem repetir os ~25s de processamento.
interface ConfereExecucao {
  id: string
  nomeContrato: string
  nomeLevantamento: string
  nomesAditivos: string[]
  /** Execuções gravadas antes da migração `20260921190000` não têm o
   *  detalhamento guardado — só os dois relatórios. */
  temResultado: boolean
  createdAt: string
}

export default function ConfereHistoricoPage() {
  const [execucoes, setExecucoes] = useState<ConfereExecucao[]>([])
  const [carregando, setCarregando] = useState(true)
  const [excluindoId, setExcluindoId] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/confere/execucoes')
      .then((r) => (r.ok ? r.json() : []))
      .then(setExecucoes)
      .finally(() => setCarregando(false))
  }, [])

  async function handleExcluir(execucao: ConfereExecucao) {
    if (!confirm(`Excluir a geração de "${execucao.nomeContrato}"? Os dois relatórios serão apagados junto.`)) return
    setExcluindoId(execucao.id)
    const response = await fetch(`/api/confere/execucoes/${execucao.id}`, { method: 'DELETE' })
    setExcluindoId(null)
    if (!response.ok) {
      const body = await response.json().catch(() => null)
      alert(body?.error ?? 'Falha ao excluir do histórico.')
      return
    }
    setExecucoes((prev) => prev.filter((e) => e.id !== execucao.id))
  }

  return (
    <main id="conteudo" className="mx-auto w-full max-w-7xl flex-1 space-y-6 scroll-mt-4 px-6 py-8 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <span className="text-xs font-semibold tracking-wide text-orange uppercase">ConfereAI</span>
          <h1 className="text-2xl font-bold text-navy">Histórico</h1>
        </div>
        <Link href="/confere" className={BTN_OUTLINE}>
          <Search className="size-3.5" strokeWidth={2.25} />
          Nova conferência
        </Link>
      </div>

      <div className="card-flush">
        {carregando ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="skeleton h-10 w-full" />
            ))}
          </div>
        ) : execucoes.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-10 text-center">
            <span className="flex size-11 items-center justify-center rounded-full bg-light-grey text-mid-grey">
              <Inbox className="size-5" strokeWidth={1.75} />
            </span>
            <p className="text-sm text-mid-grey">Nenhuma conferência gerada ainda.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-institucional">
              <thead>
                <tr>
                  <th>Contrato</th>
                  <th>Levantamento</th>
                  <th>Aditivos</th>
                  <th>Data</th>
                  <th>Relatórios</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {execucoes.map((execucao) => (
                  <tr key={execucao.id}>
                    <td className="font-medium text-navy">
                      {execucao.temResultado ? (
                        <Link
                          href={`/confere/historico/${execucao.id}`}
                          className="transition-colors hover:text-orange hover:underline"
                        >
                          {execucao.nomeContrato}
                        </Link>
                      ) : (
                        execucao.nomeContrato
                      )}
                    </td>
                    <td className="text-mid-grey">{execucao.nomeLevantamento}</td>
                    {/* Os nomes inteiros no `title`: a coluna corta, e o nome
                        do aditivo é o que identifica a peça. */}
                    <td className="text-mid-grey" title={execucao.nomesAditivos.join('\n')}>
                      {execucao.nomesAditivos.length === 0
                        ? '—'
                        : execucao.nomesAditivos.length === 1
                          ? execucao.nomesAditivos[0]
                          : `${execucao.nomesAditivos.length} aditivos`}
                    </td>
                    <td className="text-mid-grey">{new Date(execucao.createdAt).toLocaleString('pt-BR')}</td>
                    <td>
                      {/* O `.docx` continua sendo o entregável formal e a
                          análise é papel de trabalho — a mesma hierarquia da
                          tela de resultado. */}
                      <div className="flex items-center gap-3">
                        <a href={`/api/confere/execucoes/${execucao.id}/arquivo?tipo=docx`} className={LINK_NAVY}>
                          <FileText className="size-3.5" strokeWidth={2.25} />
                          DOCX
                        </a>
                        <a href={`/api/confere/execucoes/${execucao.id}/arquivo?tipo=xlsx`} className={LINK_NAVY}>
                          <FileSpreadsheet className="size-3.5" strokeWidth={2.25} />
                          XLSX
                        </a>
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-3">
                        {/* "Ver" abre o mesmo grid de divergências da tela de
                            geração, a partir do resultado guardado — e só
                            existe quando há o que abrir. Link que leva a um
                            aviso de "não guardamos isso" é pior que link
                            nenhum: ele promete e não entrega. */}
                        {execucao.temResultado ? (
                          <Link href={`/confere/historico/${execucao.id}`} className={LINK_NAVY}>
                            <Eye className="size-3.5" strokeWidth={2.25} />
                            Ver
                          </Link>
                        ) : (
                          <span
                            title="Gerada antes de o detalhamento passar a ser guardado — só os relatórios estão disponíveis"
                            className="inline-flex items-center gap-1 text-sm text-mid-grey"
                          >
                            <Eye className="size-3.5" strokeWidth={2.25} />
                            Ver
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => handleExcluir(execucao)}
                          disabled={excluindoId === execucao.id}
                          title="Excluir"
                          className={LINK_DANGER}
                        >
                          <Trash2 className="size-3.5" strokeWidth={2.25} />
                          {excluindoId === execucao.id ? 'Excluindo...' : 'Excluir'}
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
