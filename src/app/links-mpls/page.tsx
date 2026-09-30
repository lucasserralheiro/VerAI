'use client'

// "Links MPLS" (spec docs/superpowers/specs/2026-09-29-links-mpls-design.md §6.1): os relatórios de links do mês, por
// contrato, lidos do SharePoint. Números só de relatório conferido (códigos lidos = totais do PDF); o resto
// aparece com o PDF. Entraram/saíram em relação ao mês anterior do mesmo contrato e categoria.

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertCircle, ChevronRight, FileText, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { INPUT_BASE } from '@/lib/ui'
import { normalizarBusca } from '@/lib/tabela-precos/busca'
import { AtualizacaoSharepoint } from '@/components/sharepoint/atualizacao-sharepoint'
import { nomeDaCompetencia, ROTULO_CATEGORIA, type CategoriaLinks, type RelatorioResumo } from '@/lib/links-mpls/tipos'

type Carga = { estado: 'carregando' } | { estado: 'erro' } | { estado: 'ok'; competencias: string[]; competencia: string | null; relatorios: RelatorioResumo[] }

const numero = (n: number) => n.toLocaleString('pt-BR')

export default function LinksMplsPage() {
  const [competencia, setCompetencia] = useState<string | null>(null)
  const [categoria, setCategoria] = useState<CategoriaLinks | ''>('')
  const [termo, setTermo] = useState('')
  const [carga, setCarga] = useState<Carga>({ estado: 'carregando' })

  useEffect(() => {
    let ativo = true
    setCarga({ estado: 'carregando' })
    fetch(competencia ? `/api/links-mpls?competencia=${competencia}` : '/api/links-mpls')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((corpo) => {
        if (ativo) setCarga({ estado: 'ok', ...corpo })
      })
      .catch(() => {
        if (ativo) setCarga({ estado: 'erro' })
      })
    return () => {
      ativo = false
    }
  }, [competencia])

  const visiveis = useMemo(() => {
    if (carga.estado !== 'ok') return []
    const q = normalizarBusca(termo)
    return carga.relatorios.filter(
      (r) => (!categoria || r.categoria === categoria) && (!q || normalizarBusca(`${r.sigla} ${r.clienteNome ?? ''} ${r.contratoTexto ?? ''}`).includes(q))
    )
  }, [carga, termo, categoria])
  const conferidos = visiveis.filter((r) => r.conferido)
  const soma = (f: (r: RelatorioResumo) => number | null) => conferidos.reduce((s, r) => s + (f(r) ?? 0), 0)
  const categorias = [...new Set(carga.estado === 'ok' ? carga.relatorios.map((r) => r.categoria) : [])]
  const porCategoria = categorias.map((c) => `${ROTULO_CATEGORIA[c]} ${numero(conferidos.filter((r) => r.categoria === c).reduce((s, r) => s + (r.ativos ?? 0), 0))}`)

  return (
    <main className="mx-auto max-w-[110rem] space-y-6 px-6 py-8 lg:px-8">
      <div className="space-y-3">
        <nav className="flex items-center gap-1.5 text-xs font-medium text-mid-grey">
          <span>Relatórios dos clientes</span>
          <ChevronRight className="size-3" strokeWidth={2.5} />
          <span className="font-semibold text-navy">Links MPLS</span>
        </nav>
        <div>
          <h1 className="text-[1.75rem] leading-tight font-semibold tracking-tight text-navy">Links MPLS</h1>
          <p className="text-sm text-mid-grey">Links ativos por contrato, pelos relatórios de faturamento</p>
          <AtualizacaoSharepoint url="/api/biblioteca/atualizacao" className="mt-1" />
        </div>
      </div>

      {carga.estado === 'carregando' && <div className="h-96 animate-pulse rounded-2xl bg-light-grey" aria-busy="true" />}
      {carga.estado === 'erro' && <p className="text-sm text-orange-dark">Não foi possível carregar os links agora — tente de novo em instantes.</p>}
      {carga.estado === 'ok' && !carga.competencia && (
        <p className="rounded-2xl border border-dashed border-border-grey p-8 text-center text-sm text-mid-grey">
          Nenhum relatório de links lido ainda da pasta &quot;Links MPLS - Relatórios para Faturamento&quot; do SharePoint.
        </p>
      )}
      {carga.estado === 'ok' && carga.competencia && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-mid-grey">
              Competência
              <select
                className="rounded-lg border border-border-grey bg-white px-2 py-1 text-xs text-navy"
                value={carga.competencia}
                onChange={(e) => setCompetencia(e.target.value)}
              >
                {carga.competencias.map((c) => (
                  <option key={c} value={c}>
                    {nomeDaCompetencia(c)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-xs text-mid-grey">
              Categoria
              <select
                className="rounded-lg border border-border-grey bg-white px-2 py-1 text-xs text-navy"
                value={categoria}
                onChange={(e) => setCategoria(e.target.value as CategoriaLinks | '')}
              >
                <option value="">Todas</option>
                {categorias.map((c) => (
                  <option key={c} value={c}>
                    {ROTULO_CATEGORIA[c]}
                  </option>
                ))}
              </select>
            </label>
            <label className="relative w-full max-w-sm">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-mid-grey" aria-hidden="true" />
              <input
                type="search"
                aria-label="Buscar cliente ou contrato"
                placeholder="Buscar cliente ou contrato"
                className={cn(INPUT_BASE, 'w-full pl-9')}
                value={termo}
                onChange={(e) => setTermo(e.target.value)}
              />
            </label>
          </div>

          <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              [`Links ativos em ${nomeDaCompetencia(carga.competencia)}`, numero(soma((r) => r.ativos)), porCategoria.join(' · ')],
              ['Entraram / saíram no mês', `▲ ${numero(soma((r) => r.entraram))}  ▼ ${numero(soma((r) => r.sairam))}`, 'em relação ao mês anterior'],
              ['Cancelados no mês', numero(soma((r) => r.cancelados)), null],
              [
                'Relatórios',
                `${visiveis.length}`,
                visiveis.length > conferidos.length ? `${visiveis.length - conferidos.length} com leitura não conferida — fora das contas` : 'todos conferidos',
              ],
            ].map(([rotulo, valor, nota]) => (
              <div key={rotulo} className="card">
                <dt className="text-xs text-mid-grey">{rotulo}</dt>
                <dd className="font-mono text-lg font-semibold text-navy">{valor}</dd>
                {nota && <dd className="mt-1 text-xs text-mid-grey">{nota}</dd>}
              </div>
            ))}
          </dl>

          <div className="overflow-x-auto rounded-2xl border border-border-grey bg-white">
            <table className="w-full min-w-[52rem] text-sm">
              <thead className="bg-light-grey/60 text-[0.7rem] tracking-wide text-mid-grey uppercase">
                <tr>
                  <th className="px-3 py-2 text-left">Cliente</th>
                  <th className="px-3 py-2 text-left">Contrato</th>
                  <th className="px-3 py-2 text-left">Categoria</th>
                  <th className="px-3 py-2 text-right">Ativos</th>
                  <th className="px-3 py-2 text-right">Variação</th>
                  <th className="px-3 py-2 text-right">Cancelados</th>
                  <th className="px-3 py-2">
                    <span className="sr-only">PDF</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visiveis.map((r) => (
                  <tr key={r.id} className="border-t border-border-grey/60">
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center gap-1 font-semibold text-navy">
                        {r.sigla}
                        {r.avisos.length > 0 && (
                          <span role="img" aria-label={`${r.avisos.length} aviso(s): ${r.avisos.join(' · ')}`} title={r.avisos.join('\n')} className="text-orange-dark">
                            <AlertCircle className="size-3.5" aria-hidden="true" />
                          </span>
                        )}
                      </span>
                      {r.clienteNome && <span className="block text-xs text-mid-grey">{r.clienteNome}</span>}
                    </td>
                    <td className="px-3 py-2">
                      {r.contratoId ? (
                        <Link href={`/links-mpls/contrato/${r.contratoId}?competencia=${r.competencia}`} className="font-mono text-xs text-navy hover:text-orange hover:underline">
                          {r.contratoTexto ?? '(sem número)'}
                        </Link>
                      ) : (
                        <>
                          <span className="font-mono text-xs">{r.contratoTexto ?? '(sem número)'}</span>
                          <span className="block text-xs text-orange-dark">sem contrato no VerAI</span>
                        </>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs">{ROTULO_CATEGORIA[r.categoria]}</td>
                    {r.conferido ? (
                      <>
                        <td className="px-3 py-2 text-right font-mono text-xs font-semibold text-navy">{numero(r.ativos ?? 0)}</td>
                        <td className="px-3 py-2 text-right font-mono text-xs">
                          {r.entraram === null ? (
                            <span className="text-mid-grey">—</span>
                          ) : (
                            <span title="Em relação ao mês anterior">
                              {r.entraram > 0 && <span className="text-green-ok">▲{r.entraram} </span>}
                              {r.sairam! > 0 && <span className="text-orange-dark">▼{r.sairam}</span>}
                              {r.entraram === 0 && r.sairam === 0 && <span className="text-mid-grey">=</span>}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-xs">{numero(r.cancelados ?? 0)}</td>
                      </>
                    ) : (
                      <td colSpan={3} className="px-3 py-2 text-right text-xs text-orange-dark">
                        leitura não conferida — ver o PDF
                      </td>
                    )}
                    <td className="px-3 py-2 text-right">
                      <a href={`/api/biblioteca/${r.arquivoId}`} target="_blank" rel="noreferrer" aria-label={`PDF de links ${r.contratoTexto ?? r.sigla}`} className="text-mid-grey hover:text-orange">
                        <FileText className="size-4" />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  )
}
