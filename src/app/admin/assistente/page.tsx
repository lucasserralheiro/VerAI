'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, RefreshCw } from 'lucide-react'
import { BTN_PRIMARY } from '@/lib/ui'

interface LinhaUso {
  mes: string
  usuario: string
  perguntas: number
  entrada: number
  cache: number
  saida: number
  custoUsd: number | null
}

const numero = new Intl.NumberFormat('pt-BR')
const dolar = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'USD', maximumFractionDigits: 4 })

export default function AdminAssistentePage() {
  const [linhas, setLinhas] = useState<LinhaUso[]>([])
  const [precosConfigurados, setPrecosConfigurados] = useState(true)
  const [porStatus, setPorStatus] = useState<Record<string, number>>({})
  const [indexando, setIndexando] = useState(false)
  const [progresso, setProgresso] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    const [uso, indice] = await Promise.all([fetch('/api/admin/assistente/uso'), fetch('/api/admin/assistente/indexar')])
    if (uso.ok) {
      const dados = (await uso.json()) as { linhas: LinhaUso[]; precosConfigurados: boolean }
      setLinhas(dados.linhas)
      setPrecosConfigurados(dados.precosConfigurados)
    }
    if (indice.ok) setPorStatus(((await indice.json()) as { porStatus: Record<string, number> }).porStatus)
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  async function atualizarIndice() {
    setIndexando(true)
    let total = 0
    try {
      for (;;) {
        const resposta = await fetch('/api/admin/assistente/indexar', { method: 'POST' })
        if (!resposta.ok) {
          setProgresso('Falha ao atualizar o índice.')
          break
        }
        const r = (await resposta.json()) as { ok: number; sem_texto: number; erro: number; restantes: number; porStatus: Record<string, number> }
        total += r.ok + r.sem_texto + r.erro
        setPorStatus(r.porStatus)
        setProgresso(`${total} arquivo(s) processado(s)${r.restantes ? `, faltam ${r.restantes}` : ''}.`)
        if (r.restantes === 0 || r.ok + r.sem_texto + r.erro === 0) break
      }
    } finally {
      setIndexando(false)
    }
  }

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-6 py-8">
      <h1 className="text-2xl font-semibold text-navy">Assistente de IA</h1>

      <section className="card space-y-3">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-base font-semibold text-navy">Documentos pesquisáveis</h2>
          <button type="button" className={BTN_PRIMARY} onClick={atualizarIndice} disabled={indexando}>
            {indexando ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <RefreshCw className="size-4" aria-hidden />}
            Atualizar índice agora
          </button>
        </div>
        <p className="text-sm text-mid-grey">
          Lidos: <strong>{porStatus.ok ?? 0}</strong> · Imagem escaneada (sem texto): <strong>{porStatus.sem_texto ?? 0}</strong> · Com erro:{' '}
          <strong>{porStatus.erro ?? 0}</strong>. O índice também é atualizado todo dia às 6h.
        </p>
        {progresso && <p className="text-sm text-navy">{progresso}</p>}
      </section>

      <section className="card-flush overflow-x-auto">
        <h2 className="px-4 pt-4 text-base font-semibold text-navy">Uso nos últimos 6 meses</h2>
        {!precosConfigurados && (
          <p className="px-4 pt-1 text-xs text-mid-grey">
            Custo não calculado: configure ASSISTENTE_PRECO_ENTRADA, ASSISTENTE_PRECO_ENTRADA_CACHE e ASSISTENTE_PRECO_SAIDA.
          </p>
        )}
        <table className="table-institucional mt-3 w-full">
          <thead>
            <tr>
              <th>Mês</th>
              <th>Usuário</th>
              <th className="text-right">Perguntas</th>
              <th className="text-right">Tokens de entrada</th>
              <th className="text-right">Em cache</th>
              <th className="text-right">Tokens de saída</th>
              <th className="text-right">Custo estimado</th>
            </tr>
          </thead>
          <tbody>
            {linhas.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center text-mid-grey">
                  Nenhuma pergunta ainda.
                </td>
              </tr>
            ) : (
              linhas.map((l) => (
                <tr key={`${l.mes}-${l.usuario}`}>
                  <td>{l.mes}</td>
                  <td>{l.usuario}</td>
                  <td className="text-right">{numero.format(l.perguntas)}</td>
                  <td className="text-right">{numero.format(l.entrada)}</td>
                  <td className="text-right">{numero.format(l.cache)}</td>
                  <td className="text-right">{numero.format(l.saida)}</td>
                  <td className="text-right">{l.custoUsd === null ? '—' : dolar.format(l.custoUsd)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </main>
  )
}
