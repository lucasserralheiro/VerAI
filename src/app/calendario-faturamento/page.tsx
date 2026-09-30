'use client'

// "Calendário de faturamento" (spec docs/superpowers/specs/2026-09-29-calendario-faturamento-design.md §6): os prazos
// do faturamento da PRODAM lidos do PDF oficial, com a prova da leitura. Sem prova, só os feriados e o PDF — nunca uma
// data inventada. Cores da paleta do VerAI (não as do PDF), uma por tipo, com legenda.

import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, CalendarDays, ChevronLeft, ChevronRight, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatarData } from '@/lib/relatorios-clientes/formatacao'
import { AtualizacaoSharepoint } from '@/components/sharepoint/atualizacao-sharepoint'
import { hojeEmBrasilia, PRAZOS, quandoTexto, ROTULO_TIPO, type DataSerializada, type ProximoPrazo, type TipoDataFaturamento } from '@/lib/calendario/tipos'

interface Carga {
  anos: number[]
  ano: number | null
  anoAtualSemCalendario: boolean
  calendario: { status: 'ok' | 'so-feriados'; avisos: string[]; arquivoId: string; lidoEm: string } | null
  datas: DataSerializada[]
}

const COR: Record<TipoDataFaturamento, string> = {
  EMISSAO_NFSE: 'bg-navy',
  ENCERRAMENTO: 'bg-orange',
  ENVIO_RELATORIO: 'bg-green-ok',
  RECEBIMENTO_CONTRATOS: 'bg-sky-600',
  RECEBIMENTO_PROCESSOS_SEI: 'bg-violet-600',
  EXPEDIENTE_SUSPENSO: 'bg-mid-grey',
  FERIADO: 'bg-red-600',
  OUTRO: 'bg-slate-400',
}
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
const SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']
const dia = (d: Date) => d.toISOString().slice(0, 10)

/** Cada dia (AAAA-MM-DD) → o que acontece nele. */
function porDia(datas: DataSerializada[]) {
  const mapa = new Map<string, DataSerializada[]>()
  for (const d of datas) {
    for (let t = new Date(d.inicio).getTime(); t <= new Date(d.fim).getTime(); t += 86_400_000) {
      const k = dia(new Date(t))
      mapa.set(k, [...(mapa.get(k) ?? []), d])
    }
  }
  return mapa
}

function Marcador({ tipo }: { tipo: TipoDataFaturamento }) {
  return <span className={cn('inline-block h-1.5 w-full rounded-full', COR[tipo])} aria-hidden="true" />
}

export default function CalendarioFaturamentoPage() {
  const [ano, setAno] = useState<number | null>(null)
  const [carga, setCarga] = useState<Carga | null | 'erro'>(null)
  const [proximos, setProximos] = useState<ProximoPrazo[]>([])
  const hoje = hojeEmBrasilia()
  const [mes, setMes] = useState(hoje.getUTCMonth() + 1)
  const [escolhido, setEscolhido] = useState<string | null>(null)
  const [filtro, setFiltro] = useState<TipoDataFaturamento | ''>('')

  useEffect(() => {
    let ativo = true
    fetch(ano ? `/api/calendario-faturamento?ano=${ano}` : '/api/calendario-faturamento')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((c: Carga) => {
        if (!ativo) return
        setCarga(c)
        if (c.ano && c.ano !== hoje.getUTCFullYear()) setMes(1)
      })
      .catch(() => ativo && setCarga('erro'))
    return () => {
      ativo = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ano])

  useEffect(() => {
    fetch('/api/calendario-faturamento/proximos?n=3')
      .then((r) => (r.ok ? r.json() : { proximos: [] }))
      .then((c) => setProximos(c.proximos ?? []))
      .catch(() => {})
  }, [])

  const datas = useMemo(() => (carga && carga !== 'erro' ? carga.datas : []), [carga])
  const doDia = useMemo(() => porDia(datas), [datas])
  const tipos = [...new Set(datas.map((d) => d.tipo))]

  if (carga === 'erro') return <main className="px-6 py-8 text-sm text-orange-dark">Não foi possível carregar o calendário agora — tente de novo em instantes.</main>
  if (!carga) return <main className="mx-auto max-w-[110rem] px-6 py-8"><div className="h-96 animate-pulse rounded-2xl bg-light-grey" aria-busy="true" /></main>

  const anoVisto = carga.ano ?? hoje.getUTCFullYear()
  const primeiro = new Date(Date.UTC(anoVisto, mes - 1, 1))
  const diasNoMes = new Date(Date.UTC(anoVisto, mes, 0)).getUTCDate()
  const celulas: (number | null)[] = [...Array(primeiro.getUTCDay()).fill(null), ...Array.from({ length: diasNoMes }, (_, i) => i + 1)]
  const chave = (d: number) => dia(new Date(Date.UTC(anoVisto, mes - 1, d)))
  const lista = datas.filter((d) => (filtro ? d.tipo === filtro : d.tipo !== 'FERIADO'))

  return (
    <main className="mx-auto max-w-[110rem] space-y-6 px-6 py-8 lg:px-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-3">
          <nav className="flex items-center gap-1.5 text-xs font-medium text-mid-grey">
            <span>Relatórios dos clientes</span>
            <ChevronRight className="size-3" strokeWidth={2.5} />
            <span className="font-semibold text-navy">Calendário de faturamento</span>
          </nav>
          <div>
            <h1 className="text-[1.75rem] leading-tight font-semibold tracking-tight text-navy">Calendário de faturamento</h1>
            <p className="text-sm text-mid-grey">Prazos do faturamento da PRODAM (DAF/GFP)</p>
            <AtualizacaoSharepoint url="/api/biblioteca/atualizacao" className="mt-1" />
          </div>
        </div>
        <div className="flex items-center gap-3">
          {carga.anos.length > 1 && (
            <label className="flex items-center gap-2 text-xs text-mid-grey">
              Ano
              <select className="rounded-lg border border-border-grey bg-white px-2 py-1 text-xs text-navy" value={anoVisto} onChange={(e) => setAno(Number(e.target.value))}>
                {carga.anos.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </label>
          )}
          {carga.calendario && (
            <a href={`/api/biblioteca/${carga.calendario.arquivoId}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-border-grey px-3 py-1.5 text-xs font-medium text-navy hover:border-orange hover:text-orange">
              <FileText className="size-3.5" />
              Calendário oficial (PDF)
            </a>
          )}
        </div>
      </div>

      {!carga.calendario && (
        <p className="rounded-2xl border border-dashed border-border-grey p-8 text-center text-sm text-mid-grey">
          Nenhum calendário de faturamento lido ainda da pasta &quot;CALENDÁRIO FATURAMENTO&quot; do SharePoint.
        </p>
      )}
      {carga.anoAtualSemCalendario && carga.calendario && (
        <p className="text-xs text-mid-grey">O calendário de {hoje.getUTCFullYear()} ainda não está na pasta do SharePoint — mostrando o de {anoVisto}.</p>
      )}
      {carga.calendario?.status === 'so-feriados' && (
        <p className="flex items-center gap-2 rounded-xl border border-orange/30 bg-orange/5 px-3 py-2 text-sm text-orange-dark">
          <AlertCircle className="size-4 shrink-0" />
          Os prazos deste calendário não puderam ser lidos com segurança — veja o PDF. Abaixo, só os feriados.
        </p>
      )}
      {carga.calendario && carga.calendario.avisos.length > 0 && (
        <ul className="space-y-1 text-xs text-orange-dark">
          {carga.calendario.avisos.map((a) => (
            <li key={a} className="flex items-start gap-1.5">
              <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              {a}
            </li>
          ))}
        </ul>
      )}

      {proximos.length > 0 && (
        <section aria-label="Próximos prazos" className="grid gap-3 md:grid-cols-3">
          {proximos.map((p) => {
            const urgente = p.emDiasUteis <= 3
            return (
              <div key={`${p.tipo}-${p.inicio}`} className={cn('card space-y-1', urgente && 'border-orange/60')}>
                <p className="flex items-center gap-2 text-xs text-mid-grey">
                  <span className={cn('inline-block size-2.5 rounded-sm', COR[p.tipo])} aria-hidden="true" />
                  {ROTULO_TIPO[p.tipo]}
                </p>
                <p className="font-mono text-lg font-semibold text-navy">
                  {formatarData(p.inicio)}
                  {p.fim !== p.inicio && ` a ${formatarData(p.fim)}`}
                </p>
                <p className={cn('text-xs', urgente ? 'font-semibold text-orange-dark' : 'text-mid-grey')}>{p.emDias === 0 && p.fim !== p.inicio ? 'em curso' : quandoTexto(p)}</p>
              </div>
            )
          })}
        </section>
      )}

      {carga.calendario && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
          <section aria-label={`Mês de ${MESES[mes - 1]}`} className="card space-y-3">
            <div className="flex items-center justify-between">
              <button type="button" aria-label="Mês anterior" disabled={mes === 1} onClick={() => setMes(mes - 1)} className="rounded p-1 text-navy hover:text-orange disabled:opacity-30">
                <ChevronLeft className="size-4" />
              </button>
              <h2 className="text-[0.95rem] font-semibold text-navy capitalize">
                {MESES[mes - 1]} de {anoVisto}
              </h2>
              <button type="button" aria-label="Próximo mês" disabled={mes === 12} onClick={() => setMes(mes + 1)} className="rounded p-1 text-navy hover:text-orange disabled:opacity-30">
                <ChevronRight className="size-4" />
              </button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-[0.65rem] text-mid-grey">
              {SEMANA.map((s, i) => (
                <span key={i}>{s}</span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {celulas.map((d, i) => {
                if (d === null) return <span key={`v${i}`} />
                const eventos = doDia.get(chave(d)) ?? []
                const feriado = eventos.find((e) => e.tipo === 'FERIADO')
                const fimDeSemana = i % 7 === 0 || i % 7 === 6
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setEscolhido(chave(d))}
                    title={eventos.map((e) => (e.tipo === 'FERIADO' ? e.descricao : ROTULO_TIPO[e.tipo])).join(' · ') || undefined}
                    aria-label={`${d} de ${MESES[mes - 1]}${eventos.length ? `: ${eventos.map((e) => (e.tipo === 'FERIADO' ? e.descricao : ROTULO_TIPO[e.tipo])).join(', ')}` : ''}`}
                    className={cn(
                      'flex min-h-11 flex-col items-stretch gap-0.5 rounded-md border px-1 py-0.5 text-left',
                      escolhido === chave(d) ? 'border-orange' : 'border-border-grey/60',
                      chave(d) === dia(hoje) && 'ring-1 ring-navy'
                    )}
                  >
                    <span className={cn('text-xs', feriado || fimDeSemana ? 'text-red-600' : 'text-navy', feriado && 'font-bold')}>{d}</span>
                    {eventos.filter((e) => e.tipo !== 'FERIADO').map((e) => (
                      <Marcador key={e.tipo} tipo={e.tipo} />
                    ))}
                  </button>
                )
              })}
            </div>
            {escolhido && (
              <div className="rounded-lg bg-light-grey/60 p-2 text-xs">
                <p className="font-semibold text-navy">{formatarData(`${escolhido}T00:00:00.000Z`)}</p>
                {(doDia.get(escolhido) ?? []).length === 0 && <p className="text-mid-grey">Nenhum prazo neste dia.</p>}
                {(doDia.get(escolhido) ?? []).map((e) => (
                  <p key={e.tipo} className="flex items-center gap-1.5">
                    <span className={cn('inline-block size-2 rounded-sm', COR[e.tipo])} aria-hidden="true" />
                    {e.tipo === 'FERIADO' ? `Feriado: ${e.descricao}` : ROTULO_TIPO[e.tipo]}
                  </p>
                ))}
              </div>
            )}
            <ul className="grid grid-cols-2 gap-1 text-[0.65rem] text-mid-grey" aria-label="Legenda">
              {tipos.map((t) => (
                <li key={t} className="flex items-center gap-1.5">
                  <span className={cn('inline-block size-2 rounded-sm', COR[t])} aria-hidden="true" />
                  {ROTULO_TIPO[t]}
                </li>
              ))}
            </ul>
          </section>

          <section aria-label="Prazos do ano" className="card space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-[0.95rem] font-semibold text-navy">
                <CalendarDays className="size-4" />
                Prazos de {anoVisto}
              </h2>
              <label className="flex items-center gap-2 text-xs text-mid-grey">
                Tipo
                <select className="rounded-lg border border-border-grey bg-white px-2 py-1 text-xs text-navy" value={filtro} onChange={(e) => setFiltro(e.target.value as TipoDataFaturamento | '')}>
                  <option value="">Todos os prazos</option>
                  {[...PRAZOS, 'EXPEDIENTE_SUSPENSO' as const, 'FERIADO' as const].filter((t) => tipos.includes(t)).map((t) => (
                    <option key={t} value={t}>
                      {ROTULO_TIPO[t]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="max-h-[32rem] overflow-y-auto">
              <table className="w-full text-xs">
                <tbody>
                  {lista.map((d) => (
                    <tr key={`${d.tipo}-${d.inicio}`} className={cn('border-t border-border-grey/60', new Date(d.fim) < hoje && 'text-mid-grey')}>
                      <td className="py-1.5 pr-2 font-mono whitespace-nowrap">
                        {formatarData(d.inicio)}
                        {d.fim !== d.inicio && ` a ${formatarData(d.fim)}`}
                      </td>
                      <td className="py-1.5">
                        <span className="inline-flex items-center gap-1.5">
                          <span className={cn('inline-block size-2 rounded-sm', COR[d.tipo])} aria-hidden="true" />
                          {d.tipo === 'FERIADO' ? d.descricao : ROTULO_TIPO[d.tipo]}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </main>
  )
}
