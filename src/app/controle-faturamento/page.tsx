'use client'

// "Controle de faturamento" (spec docs/superpowers/specs/2026-09-29-controles-de-contratos-design.md §6.2): o
// controle mensal da equipe do faturamento, contrato por contrato, lido do SharePoint. Números só de leitura
// conferida pela soma; o resto aparece com o PDF. Faturado = só até o mês do controle: o que a tabela lança para
// os meses seguintes é previsão e aparece à parte, fora do % e do saldo (spec §9).

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertCircle, ChevronRight, FileText, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { INPUT_BASE } from '@/lib/ui'
import { formatarMoeda } from '@/lib/relatorios-clientes/formatacao'
import { normalizarBusca } from '@/lib/tabela-precos/busca'
import { AtualizacaoSharepoint } from '@/components/sharepoint/atualizacao-sharepoint'
import { nomeDoMes, type ControleSerializado } from '@/lib/controles-contratos/tipos'

type Carga = { estado: 'carregando' } | { estado: 'erro' } | { estado: 'ok'; meses: string[]; mes: string | null; controles: ControleSerializado[] }

const pct = (v: number) => `${v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
const soma = (valores: (string | null | undefined)[]) => (valores.reduce((s, v) => s + Math.round(Number(v ?? 0) * 100), 0) / 100).toFixed(2)

export default function ControleFaturamentoPage() {
  const [mes, setMes] = useState<string | null>(null)
  const [carga, setCarga] = useState<Carga>({ estado: 'carregando' })
  const [termo, setTermo] = useState('')

  useEffect(() => {
    let ativo = true
    setCarga({ estado: 'carregando' })
    fetch(mes ? `/api/controle-faturamento?mes=${mes}` : '/api/controle-faturamento')
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
  }, [mes])

  const visiveis = useMemo(() => {
    if (carga.estado !== 'ok') return []
    const q = normalizarBusca(termo)
    if (!q) return carga.controles
    return carga.controles.filter((c) => normalizarBusca(`${c.sigla} ${c.clienteNome ?? ''} ${c.contratoTexto ?? ''}`).includes(q))
  }, [carga, termo])
  const conferidos = visiveis.filter((c) => c.conferido)
  const previstoTotal = soma(conferidos.map((c) => c.previsto))
  const faturadoTotal = soma(conferidos.map((c) => c.faturado))
  const comAFrente = conferidos.filter((c) => c.aFrente)
  const aFrenteTotal = soma(comAFrente.map((c) => c.aFrente?.total))
  const ate = carga.estado === 'ok' && carga.mes ? nomeDoMes(carga.mes) : ''

  return (
    <main className="mx-auto max-w-[110rem] space-y-6 px-6 py-8 lg:px-8">
      <div className="space-y-3">
        <nav className="flex items-center gap-1.5 text-xs font-medium text-mid-grey">
          <span>Relatórios dos clientes</span>
          <ChevronRight className="size-3" strokeWidth={2.5} />
          <span className="font-semibold text-navy">Controle de faturamento</span>
        </nav>
        <div>
          <h1 className="text-[1.75rem] leading-tight font-semibold tracking-tight text-navy">Controle de faturamento</h1>
          <p className="text-sm text-mid-grey">Previsto × faturado de cada contrato, pelo controle mensal da equipe do faturamento</p>
          <AtualizacaoSharepoint url="/api/biblioteca/atualizacao" className="mt-1" />
        </div>
      </div>

      {carga.estado === 'carregando' && <div className="h-96 animate-pulse rounded-2xl bg-light-grey" aria-busy="true" />}
      {carga.estado === 'erro' && <p className="text-sm text-orange-dark">Não foi possível carregar o controle agora — tente de novo em instantes.</p>}
      {carga.estado === 'ok' && !carga.mes && (
        <p className="rounded-2xl border border-dashed border-border-grey p-8 text-center text-sm text-mid-grey">
          Nenhum controle lido ainda da pasta &quot;Controles de Contratos&quot; do SharePoint.
        </p>
      )}
      {carga.estado === 'ok' && carga.mes && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-mid-grey">
              Mês do controle
              <select
                className="rounded-lg border border-border-grey bg-white px-2 py-1 text-xs text-navy"
                value={carga.mes}
                onChange={(e) => setMes(e.target.value)}
              >
                {carga.meses.map((m) => (
                  <option key={m} value={m}>
                    {nomeDoMes(m)}
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
              ['Contratos no controle', `${visiveis.length} contratos`, null],
              ['Previsto (conferidos)', formatarMoeda(previstoTotal), null],
              [
                `Faturado até ${ate} (conferidos)`,
                formatarMoeda(faturadoTotal),
                comAFrente.length > 0
                  ? `+ ${formatarMoeda(aFrenteTotal)} lançados para depois de ${ate} em ${comAFrente.length} contrato(s) — previsão, fora da conta`
                  : null,
              ],
              ['Faturado do previsto', Number(previstoTotal) > 0 ? pct((Number(faturadoTotal) / Number(previstoTotal)) * 100) : '—', null],
            ].map(([rotulo, valor, nota]) => (
              <div key={rotulo} className="card">
                <dt className="text-xs text-mid-grey">{rotulo}</dt>
                <dd className="font-mono text-lg font-semibold text-navy">{valor}</dd>
                {nota && <dd className="mt-1 text-xs text-orange-dark">{nota}</dd>}
              </div>
            ))}
          </dl>

          <div className="overflow-x-auto rounded-2xl border border-border-grey bg-white">
            <table className="w-full min-w-[56rem] text-sm">
              <thead className="bg-light-grey/60 text-[0.7rem] tracking-wide text-mid-grey uppercase">
                <tr>
                  <th className="px-3 py-2 text-left">Cliente</th>
                  <th className="px-3 py-2 text-left">Contrato</th>
                  <th className="px-3 py-2 text-left">Vigência</th>
                  <th className="px-3 py-2 text-right">Previsto</th>
                  <th className="px-3 py-2 text-right">Faturado até {ate}</th>
                  <th className="px-3 py-2 text-right">%</th>
                  <th className="px-3 py-2 text-right">Saldo</th>
                  <th className="px-3 py-2 text-left">Último faturado</th>
                  <th className="px-3 py-2">
                    <span className="sr-only">PDF</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visiveis.map((c) => (
                  <tr key={c.arquivoId} className="border-t border-border-grey/60">
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center gap-1 font-semibold text-navy">
                        {c.sigla}
                        {c.avisos.length > 0 && (
                          <span
                            role="img"
                            aria-label={`${c.avisos.length} aviso(s): ${c.avisos.join(' · ')}`}
                            title={c.avisos.join('\n')}
                            className="text-orange-dark"
                          >
                            <AlertCircle className="size-3.5" aria-hidden="true" />
                          </span>
                        )}
                      </span>
                      {c.clienteNome && <span className="block text-xs text-mid-grey">{c.clienteNome}</span>}
                    </td>
                    <td className="px-3 py-2">
                      {c.contratoId && c.clienteId ? (
                        <Link href={`/clientes/${c.clienteId}/contratos/${c.contratoId}`} className="font-mono text-xs text-navy hover:text-orange hover:underline">
                          {c.contratoTexto ?? '(sem número)'}
                        </Link>
                      ) : (
                        <span className="font-mono text-xs">{c.contratoTexto ?? '(sem número)'}</span>
                      )}
                      {c.termoTexto && <span className="block text-xs text-mid-grey">{c.termoTexto}</span>}
                      {!c.contratoId && <span className="block text-xs text-orange-dark">sem contrato no VerAI</span>}
                    </td>
                    <td className="px-3 py-2 text-xs text-mid-grey">{c.vigenciaTexto ?? '—'}</td>
                    {c.conferido ? (
                      <>
                        <td className="px-3 py-2 text-right font-mono text-xs">{formatarMoeda(c.previsto)}</td>
                        <td className="px-3 py-2 text-right font-mono text-xs">
                          {formatarMoeda(c.faturado)}
                          {c.aFrente && (
                            <span
                              className="block font-sans text-[0.7rem] text-orange-dark"
                              title={`Lançado na tabela para depois de ${ate} (previsão, fora do faturado): ${c.aFrente.periodos.join(', ')}`}
                            >
                              + {formatarMoeda(c.aFrente.total)} à frente
                            </span>
                          )}
                        </td>
                        <td className={cn('px-3 py-2 text-right font-mono text-xs', (c.percentual ?? 0) > 100 ? 'text-orange-dark' : 'text-navy')}>
                          {c.percentual !== null ? pct(c.percentual) : '—'}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-xs">{formatarMoeda(c.saldoCalculado)}</td>
                      </>
                    ) : (
                      <td colSpan={4} className="px-3 py-2 text-right text-xs text-orange-dark">
                        leitura não conferida — ver o PDF
                      </td>
                    )}
                    <td className="px-3 py-2 text-xs">{c.ultimoFaturado ?? '—'}</td>
                    <td className="px-3 py-2 text-right">
                      <a
                        href={`/api/biblioteca/${c.arquivoId}`}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`PDF do controle ${c.contratoTexto ?? c.sigla}`}
                        className="text-mid-grey hover:text-orange"
                      >
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
