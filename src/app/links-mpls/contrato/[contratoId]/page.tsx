'use client'

// Links MPLS de um contrato (spec docs/superpowers/specs/2026-09-29-links-mpls-design.md §6.2): evolução mês a mês
// (só relatórios conferidos), os links do mês escolhido com busca, e o que entrou e saiu em relação ao mês anterior.

import { use, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { AlertCircle, ChevronRight, FileText, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { INPUT_BASE } from '@/lib/ui'
import { normalizarBusca } from '@/lib/tabela-precos/busca'
import { formatarData } from '@/lib/relatorios-clientes/formatacao'
import { SeiLink } from '@/components/relatorios-clientes/sei-link'
import { nomeDaCompetencia, ROTULO_CATEGORIA, type CategoriaLinks, type LinkSerializado, type RelatorioDoContrato } from '@/lib/links-mpls/tipos'

interface Dados {
  contrato: { id: string; clienteId: string; numeroTermo: string | null; seiProdam: string | null; cliente: { nome: string; siglaLegado: string | null } }
  serie: { competencia: string; categoria: CategoriaLinks; ativos: number }[]
  competencias: string[]
  competencia: string | null
  relatorios: RelatorioDoContrato[]
}

// Uma cor por categoria, da paleta do VerAI.
const COR: Record<CategoriaLinks, string> = { SOLUCAO: 'var(--color-navy)', SOCIAL: 'var(--color-orange)', GERENCIAMENTO: 'var(--color-green-ok)', OUTRA: 'var(--color-mid-grey)' }

function Evolucao({ serie, escolhida, aoEscolher }: { serie: Dados['serie']; escolhida: string | null; aoEscolher: (c: string) => void }) {
  const meses = [...new Set(serie.map((s) => s.competencia))].slice(-18)
  const categorias = [...new Set(serie.map((s) => s.categoria))]
  const total = (c: string) => serie.filter((s) => s.competencia === c).reduce((t, s) => t + s.ativos, 0)
  const maximo = Math.max(1, ...meses.map(total))
  if (meses.length === 0) return null
  const largura = 44
  const altura = 140
  return (
    <figure className="card space-y-2" aria-label="Evolução dos links ativos por mês">
      <figcaption className="flex flex-wrap items-center gap-3 text-xs text-mid-grey">
        <span className="font-semibold text-navy">Links ativos por mês</span>
        {categorias.map((c) => (
          <span key={c} className="inline-flex items-center gap-1">
            <span className="inline-block size-2.5 rounded-sm" style={{ background: COR[c] }} aria-hidden="true" />
            {ROTULO_CATEGORIA[c]}
          </span>
        ))}
      </figcaption>
      <div className="overflow-x-auto">
        <svg width={meses.length * largura} height={altura + 34} role="img" aria-label="Barras de links ativos por mês e categoria">
          {meses.map((m, i) => {
            let topo = altura
            return (
              <g key={m} className="cursor-pointer" onClick={() => aoEscolher(m)}>
                <title>{`${nomeDaCompetencia(m)}: ${total(m)} ativo(s)`}</title>
                {categorias.map((c) => {
                  const v = serie.find((s) => s.competencia === m && s.categoria === c)?.ativos ?? 0
                  const h = (v / maximo) * (altura - 16)
                  topo -= h
                  return <rect key={c} x={i * largura + 8} y={topo} width={largura - 16} height={h} fill={COR[c]} rx={2} />
                })}
                <text x={i * largura + largura / 2} y={topo - 4} textAnchor="middle" className="fill-navy text-[10px] font-semibold">
                  {total(m)}
                </text>
                <text x={i * largura + largura / 2} y={altura + 14} textAnchor="middle" className={cn('text-[10px]', m === escolhida ? 'fill-orange font-bold' : 'fill-mid-grey')}>
                  {nomeDaCompetencia(m).replace(/\/20/, '/')}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
    </figure>
  )
}

function TabelaLinks({ links, rotulo }: { links: LinkSerializado[]; rotulo: string }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border-grey">
      <table className="w-full min-w-[46rem] text-xs" aria-label={rotulo}>
        <thead className="bg-light-grey/60 text-[0.65rem] tracking-wide text-mid-grey uppercase">
          <tr>
            <th className="px-2 py-1.5 text-left">Código</th>
            <th className="px-2 py-1.5 text-right">Kbit/s</th>
            <th className="px-2 py-1.5 text-left">Redundância</th>
            <th className="px-2 py-1.5 text-left">Entidade</th>
            <th className="px-2 py-1.5 text-left">Endereço</th>
            <th className="px-2 py-1.5 text-left">Aceite</th>
          </tr>
        </thead>
        <tbody>
          {links.map((l) => (
            <tr key={`${l.codigo}-${l.situacao}`} className="border-t border-border-grey/60">
              <td className="px-2 py-1.5 font-mono">{l.codigo}</td>
              <td className="px-2 py-1.5 text-right font-mono">{l.kbps?.toLocaleString('pt-BR') ?? '—'}</td>
              <td className="px-2 py-1.5">{l.redundancia ?? '—'}</td>
              <td className="px-2 py-1.5">{l.entidade ?? '—'}</td>
              <td className="px-2 py-1.5">{l.endereco ?? '—'}</td>
              <td className="px-2 py-1.5 font-mono">{formatarData(l.dataAceite)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function LinksDoContratoPage({ params }: { params: Promise<{ contratoId: string }> }) {
  const { contratoId } = use(params)
  const inicial = useSearchParams().get('competencia')
  const [competencia, setCompetencia] = useState<string | null>(inicial)
  const [termo, setTermo] = useState('')
  const [dados, setDados] = useState<Dados | null | 'erro'>(null)

  useEffect(() => {
    let ativo = true
    fetch(`/api/links-mpls/contrato/${contratoId}${competencia ? `?competencia=${competencia}` : ''}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((corpo) => {
        if (ativo) setDados(corpo)
      })
      .catch(() => {
        if (ativo) setDados('erro')
      })
    return () => {
      ativo = false
    }
  }, [contratoId, competencia])

  const q = normalizarBusca(termo)
  const filtrar = useMemo(
    () => (links: LinkSerializado[]) => (q ? links.filter((l) => normalizarBusca(`${l.codigo} ${l.entidade ?? ''} ${l.endereco ?? ''}`).includes(q)) : links),
    [q]
  )

  if (dados === 'erro') return <main className="px-6 py-8 text-sm text-orange-dark">Não foi possível carregar os links deste contrato.</main>
  if (!dados) return <main className="mx-auto max-w-[110rem] px-6 py-8"><div className="h-96 animate-pulse rounded-2xl bg-light-grey" aria-busy="true" /></main>
  const { contrato } = dados

  return (
    <main className="mx-auto max-w-[110rem] space-y-6 px-6 py-8 lg:px-8">
      <div className="space-y-3">
        <nav className="flex items-center gap-1.5 text-xs font-medium text-mid-grey">
          <span>Relatórios dos clientes</span>
          <ChevronRight className="size-3" strokeWidth={2.5} />
          <Link href={`/clientes/${contrato.clienteId}/contratos/${contrato.id}`} className="hover:text-orange">
            {contrato.numeroTermo ?? 'Contrato'}
          </Link>
          <ChevronRight className="size-3" strokeWidth={2.5} />
          <span className="font-semibold text-navy">Links MPLS</span>
        </nav>
        <div>
          <h1 className="text-[1.75rem] leading-tight font-semibold tracking-tight text-navy">Links MPLS — {contrato.numeroTermo ?? '(sem número)'}</h1>
          <p className="flex flex-wrap items-center gap-2 text-sm text-mid-grey">
            <Link href={`/clientes/${contrato.clienteId}/contratos/${contrato.id}`} className="font-medium text-navy hover:text-orange hover:underline">
              {contrato.cliente.siglaLegado ?? contrato.cliente.nome}
            </Link>
            <span>{contrato.cliente.nome}</span>
            {contrato.seiProdam && <SeiLink numero={contrato.seiProdam} />}
          </p>
        </div>
      </div>

      <Evolucao serie={dados.serie} escolhida={dados.competencia} aoEscolher={setCompetencia} />

      {dados.competencia && (
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-mid-grey">
            Competência
            <select className="rounded-lg border border-border-grey bg-white px-2 py-1 text-xs text-navy" value={dados.competencia} onChange={(e) => setCompetencia(e.target.value)}>
              {dados.competencias.map((c) => (
                <option key={c} value={c}>
                  {nomeDaCompetencia(c)}
                </option>
              ))}
            </select>
          </label>
          <label className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-mid-grey" aria-hidden="true" />
            <input type="search" aria-label="Buscar código, entidade ou endereço" placeholder="Buscar código, entidade ou endereço" className={cn(INPUT_BASE, 'w-full pl-9')} value={termo} onChange={(e) => setTermo(e.target.value)} />
          </label>
        </div>
      )}

      {dados.relatorios.map((r) => {
        const ativos = r.links.filter((l) => l.situacao === 'ATIVO')
        const cancelados = r.links.filter((l) => l.situacao === 'CANCELADO')
        return (
          <section key={r.id} aria-label={`Links ${ROTULO_CATEGORIA[r.categoria]}`} className="card space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="text-[0.95rem] font-semibold text-navy">
                  {ROTULO_CATEGORIA[r.categoria]} · {nomeDaCompetencia(r.competencia)}
                </h2>
                <p className="text-xs text-mid-grey">
                  {r.conferido ? `${r.ativos} ativo(s)` : 'Leitura não conferida: os totais do PDF não batem com os links lidos — confira no PDF.'}
                  {r.entraram !== null && ` · ▲${r.entraram} entraram ▼${r.sairam} saíram em relação ao mês anterior`}
                </p>
              </div>
              <a href={`/api/biblioteca/${r.arquivoId}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs font-medium text-navy hover:text-orange">
                <FileText className="size-3.5" />
                Abrir o relatório (PDF)
              </a>
            </div>
            {r.avisos.length > 0 && (
              <ul className="space-y-1 text-xs text-orange-dark">
                {r.avisos.map((a) => (
                  <li key={a} className="flex items-start gap-1.5">
                    <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                    {a}
                  </li>
                ))}
              </ul>
            )}
            {r.entraramLinks.length > 0 && (
              <div className="space-y-1">
                <h3 className="text-xs font-semibold text-green-ok">Entraram ({r.entraramLinks.length})</h3>
                <TabelaLinks links={filtrar(r.entraramLinks)} rotulo="Links que entraram" />
              </div>
            )}
            {r.sairamLinks.length > 0 && (
              <div className="space-y-1">
                <h3 className="text-xs font-semibold text-orange-dark">Saíram ({r.sairamLinks.length})</h3>
                <TabelaLinks links={filtrar(r.sairamLinks)} rotulo="Links que saíram" />
              </div>
            )}
            {ativos.length > 0 && (
              <details open={ativos.length <= 30}>
                <summary className="cursor-pointer text-xs font-semibold text-navy">Links ativos ({ativos.length})</summary>
                <div className="mt-2">
                  <TabelaLinks links={filtrar(ativos)} rotulo="Links ativos" />
                </div>
              </details>
            )}
            {cancelados.length > 0 && (
              <details>
                {/* A lista do PDF traz cancelamentos de meses anteriores: o que saiu neste mês é o bloco "Saíram". */}
                <summary className="cursor-pointer text-xs font-semibold text-navy">Lista de cancelados do relatório ({cancelados.length}) — inclui meses anteriores</summary>
                <div className="mt-2">
                  <TabelaLinks links={filtrar(cancelados)} rotulo="Links cancelados" />
                </div>
              </details>
            )}
          </section>
        )
      })}
    </main>
  )
}
