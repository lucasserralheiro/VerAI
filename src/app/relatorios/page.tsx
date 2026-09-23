'use client'

// Consultas cross-cliente (Task 8): vencimento dos contratos, valor total por cliente, SEIs por
// cliente e status do faturamento do mês. Tudo de /api/relatorios/*, já filtrado pelos clientes
// que o usuário pode ver.

import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { AlertCircle, CalendarClock, Check, ChevronRight, Hash, Loader2, Receipt, Wallet, X, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { INPUT_BASE } from '@/lib/ui'
import { formatarData, formatarMoeda } from '@/lib/relatorios-clientes/formatacao'
import type { Saldo } from '@/lib/relatorios-clientes/saldo'
import type { SituacaoVencimento } from '@/lib/relatorios-clientes/vencimento'
import { BarraFaturado, PillVencimento } from '@/components/relatorios-clientes/indicadores-contrato'
import { rotuloCliente, type OpcaoCliente } from '@/components/relatorios-clientes/formulario-demanda'

type ClienteResumo = Pick<OpcaoCliente, 'id' | 'nome' | 'siglaLegado'>

/** GET com estado de carregamento/erro, refeito quando a `url` muda. */
function useConsulta<T>(url: string) {
  const [estado, setEstado] = useState<{ dados: T | null; erro: string | null; carregando: boolean }>({
    dados: null,
    erro: null,
    carregando: true,
  })
  useEffect(() => {
    let ativo = true
    setEstado((atual) => ({ ...atual, carregando: true, erro: null }))
    fetch(url)
      .then(async (response) => {
        const corpo = await response.json().catch(() => null)
        if (!ativo) return
        if (!response.ok) setEstado({ dados: null, erro: corpo?.error ?? 'Falha ao carregar o relatório.', carregando: false })
        else setEstado({ dados: corpo as T, erro: null, carregando: false })
      })
      .catch(() => ativo && setEstado({ dados: null, erro: 'Falha ao carregar o relatório.', carregando: false }))
    return () => {
      ativo = false
    }
  }, [url])
  return estado
}

function Estado({ carregando, erro, vazio, children }: { carregando: boolean; erro: string | null; vazio: boolean; children: ReactNode }) {
  if (carregando) {
    return (
      <p className="flex items-center gap-2 text-sm text-mid-grey">
        <Loader2 className="size-4 animate-spin" strokeWidth={2.25} />
        Carregando...
      </p>
    )
  }
  if (erro) {
    return (
      <p className="flex items-center gap-1.5 rounded-xl bg-red-crit-light p-4 text-sm text-red-crit">
        <AlertCircle className="size-4 shrink-0" strokeWidth={2.25} />
        {erro}
      </p>
    )
  }
  if (vazio) return <div className="card-flush p-10 text-center text-sm text-mid-grey">Nada para mostrar.</div>
  return <div className="card-flush overflow-x-auto">{children}</div>
}

function CelulaCliente({ cliente }: { cliente: ClienteResumo }) {
  return (
    <Link href={`/clientes/${cliente.id}`} className="font-semibold whitespace-nowrap text-navy hover:text-orange hover:underline">
      {rotuloCliente(cliente)}
    </Link>
  )
}

function LinkContrato({ cliente, contrato }: { cliente: ClienteResumo; contrato: { id: string; numeroTermo: string | null } }) {
  return (
    <Link
      href={`/clientes/${cliente.id}/contratos/${contrato.id}`}
      className="font-mono text-xs font-semibold text-navy hover:text-orange hover:underline"
    >
      {contrato.numeroTermo ?? '(sem número)'}
    </Link>
  )
}

// ---------------------------------------------------------------------------

interface LinhaVencimento {
  id: string
  numeroTermo: string | null
  descricao: string | null
  situacao: string | null
  dataVencimento: string | null
  ativo: boolean
  vencimento: SituacaoVencimento
  saldo: Saldo
  cliente: ClienteResumo
}

function AbaVencimento() {
  const { dados, erro, carregando } = useConsulta<LinhaVencimento[]>('/api/relatorios/vencimentos')
  const [soAtivos, setSoAtivos] = useState(true)
  const linhas = (dados ?? []).filter((linha) => !soAtivos || linha.ativo)

  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 text-sm text-navy">
        <input type="checkbox" checked={soAtivos} onChange={(e) => setSoAtivos(e.target.checked)} />
        Só contratos ativos
      </label>
      <Estado carregando={carregando} erro={erro} vazio={linhas.length === 0}>
        <table className="table-institucional">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Nº do termo</th>
              <th>Descrição</th>
              <th>Situação</th>
              <th>Vencimento</th>
              <th>Prazo</th>
              <th>Faturado</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((linha) => (
              <tr key={linha.id}>
                <td>
                  <CelulaCliente cliente={linha.cliente} />
                </td>
                <td>
                  <LinkContrato cliente={linha.cliente} contrato={linha} />
                </td>
                <td>{linha.descricao ?? '—'}</td>
                <td>{linha.situacao ?? '—'}</td>
                <td className="font-mono text-xs whitespace-nowrap">{formatarData(linha.dataVencimento)}</td>
                <td>
                  <PillVencimento vencimento={linha.vencimento} />
                </td>
                <td>
                  <BarraFaturado saldo={linha.saldo} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Estado>
    </div>
  )
}

// ---------------------------------------------------------------------------

interface LinhaValorTotal extends ClienteResumo {
  contratos: number
  contratosAtivos: number
  saldo: Saldo
}

function AbaValorTotal() {
  const { dados, erro, carregando } = useConsulta<LinhaValorTotal[]>('/api/relatorios/valor-total')
  return (
    <div className="space-y-3">
      <p className="text-xs text-mid-grey">
        Valor = soma dos itens vinculados aos contratos; itens importados sem vínculo não entram até serem reconciliados.
      </p>
      <Estado carregando={carregando} erro={erro} vazio={!dados?.length}>
        <table className="table-institucional">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Contratos</th>
              <th>Ativos</th>
              <th>Valor dos itens</th>
              <th>Faturado</th>
              <th>Saldo</th>
              <th>% faturado</th>
            </tr>
          </thead>
          <tbody>
            {dados?.map((linha) => (
              <tr key={linha.id}>
                <td>
                  <CelulaCliente cliente={linha} />
                </td>
                <td className="font-mono text-xs">{linha.contratos}</td>
                <td className="font-mono text-xs">{linha.contratosAtivos}</td>
                <td className="font-mono text-xs whitespace-nowrap">{formatarMoeda(linha.saldo.valorItens)}</td>
                <td className="font-mono text-xs whitespace-nowrap">{formatarMoeda(linha.saldo.faturado)}</td>
                <td className="font-mono text-xs font-semibold whitespace-nowrap text-navy">{formatarMoeda(linha.saldo.saldo)}</td>
                <td>
                  <BarraFaturado saldo={linha.saldo} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Estado>
    </div>
  )
}

// ---------------------------------------------------------------------------

interface RespostaSeis {
  contratos: Array<{
    id: string
    numeroTermo: string | null
    seiCliente: string | null
    seiProdam: string | null
    linkSei: string | null
    cliente: ClienteResumo
  }>
  faturamentos: Array<{
    id: string
    competenciaAno: number | null
    competenciaMes: number | null
    sei: string
    contrato: { id: string; numeroTermo: string | null }
    cliente: ClienteResumo
  }>
}

function competencia(ano: number | null, mes: number | null) {
  return ano && mes ? `${String(mes).padStart(2, '0')}/${ano}` : '—'
}

function AbaSeis() {
  const clientes = useConsulta<ClienteResumo[]>('/api/clientes')
  const [clienteId, setClienteId] = useState('')
  const { dados, erro, carregando } = useConsulta<RespostaSeis>(
    `/api/relatorios/seis${clienteId ? `?clienteId=${encodeURIComponent(clienteId)}` : ''}`
  )

  return (
    <div className="space-y-5">
      <select
        aria-label="Filtrar por cliente"
        value={clienteId}
        onChange={(e) => setClienteId(e.target.value)}
        className={cn(INPUT_BASE, 'max-w-xs')}
      >
        <option value="">Todos os clientes</option>
        {clientes.dados?.map((cliente) => (
          <option key={cliente.id} value={cliente.id}>
            {rotuloCliente(cliente)}
          </option>
        ))}
      </select>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-navy">SEIs dos contratos</h2>
        <Estado carregando={carregando} erro={erro} vazio={!dados?.contratos.length}>
          <table className="table-institucional">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Nº do termo</th>
                <th>SEI cliente</th>
                <th>SEI PRODAM</th>
                <th>Link</th>
              </tr>
            </thead>
            <tbody>
              {dados?.contratos.map((linha) => (
                <tr key={linha.id}>
                  <td>
                    <CelulaCliente cliente={linha.cliente} />
                  </td>
                  <td>
                    <LinkContrato cliente={linha.cliente} contrato={linha} />
                  </td>
                  <td className="font-mono text-xs">{linha.seiCliente ?? '—'}</td>
                  <td className="font-mono text-xs">{linha.seiProdam ?? '—'}</td>
                  <td className="text-xs">
                    {linha.linkSei ? (
                      <a href={linha.linkSei} target="_blank" rel="noreferrer" className="text-navy hover:text-orange hover:underline">
                        abrir
                      </a>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Estado>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-navy">SEIs dos faturamentos</h2>
        <Estado carregando={carregando} erro={erro} vazio={!dados?.faturamentos.length}>
          <table className="table-institucional">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Contrato</th>
                <th>Competência</th>
                <th>SEI</th>
              </tr>
            </thead>
            <tbody>
              {dados?.faturamentos.map((linha) => (
                <tr key={linha.id}>
                  <td>
                    <CelulaCliente cliente={linha.cliente} />
                  </td>
                  <td>
                    <LinkContrato cliente={linha.cliente} contrato={linha.contrato} />
                  </td>
                  <td className="font-mono text-xs">{competencia(linha.competenciaAno, linha.competenciaMes)}</td>
                  <td className="font-mono text-xs">{linha.sei}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Estado>
      </section>
    </div>
  )
}

// ---------------------------------------------------------------------------

interface LinhaStatus {
  id: string
  numeroTermo: string | null
  descricao: string | null
  cliente: ClienteResumo
  faturamentos: Array<{
    id: string
    situacao: string | null
    sei: string | null
    complementar: boolean | null
    enviadoCliente: boolean | null
    enviadoGfp: boolean | null
    valorExibido: string
  }>
}

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

function Enviado({ valor, rotulo }: { valor: boolean | null; rotulo: string }) {
  return valor ? (
    <Check className="size-4 text-green-ok" strokeWidth={2.5} aria-label={`${rotulo}: sim`} />
  ) : (
    <X className="size-4 text-mid-grey/60" strokeWidth={2.5} aria-label={`${rotulo}: não`} />
  )
}

/** Mês anterior ao de hoje — o faturamento de um mês é lançado no mês seguinte. */
function competenciaPadrao() {
  const hoje = new Date()
  return hoje.getMonth() === 0
    ? { ano: hoje.getFullYear() - 1, mes: 12 }
    : { ano: hoje.getFullYear(), mes: hoje.getMonth() }
}

function AbaStatusFaturamento() {
  const [{ ano, mes }, setCompetencia] = useState(competenciaPadrao)
  const { dados, erro, carregando } = useConsulta<LinhaStatus[]>(`/api/relatorios/status-faturamento?ano=${ano}&mes=${mes}`)
  const anoAtual = new Date().getFullYear()
  const anos = Array.from({ length: anoAtual - 2020 + 1 }, (_, i) => anoAtual - i)
  const semFaturamento = dados?.filter((linha) => linha.faturamentos.length === 0).length ?? 0

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select
          aria-label="Mês"
          value={mes}
          onChange={(e) => setCompetencia({ ano, mes: Number(e.target.value) })}
          className={cn(INPUT_BASE, 'w-40')}
        >
          {MESES.map((nome, i) => (
            <option key={nome} value={i + 1}>
              {nome}
            </option>
          ))}
        </select>
        <select
          aria-label="Ano"
          value={ano}
          onChange={(e) => setCompetencia({ ano: Number(e.target.value), mes })}
          className={cn(INPUT_BASE, 'w-28')}
        >
          {anos.map((valor) => (
            <option key={valor} value={valor}>
              {valor}
            </option>
          ))}
        </select>
        {dados && (
          <span className="text-xs text-mid-grey">
            {semFaturamento} de {dados.length} contratos sem faturamento lançado
          </span>
        )}
      </div>
      <Estado carregando={carregando} erro={erro} vazio={!dados?.length}>
        <table className="table-institucional">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Nº do termo</th>
              <th>Descrição</th>
              <th>Valor</th>
              <th>SEI</th>
              <th>Enviado cliente</th>
              <th>Enviado GFP</th>
            </tr>
          </thead>
          <tbody>
            {dados?.flatMap((linha) =>
              linha.faturamentos.length === 0
                ? [
                    <tr key={linha.id}>
                      <td>
                        <CelulaCliente cliente={linha.cliente} />
                      </td>
                      <td>
                        <LinkContrato cliente={linha.cliente} contrato={linha} />
                      </td>
                      <td>{linha.descricao ?? '—'}</td>
                      <td colSpan={4}>
                        <span className="rounded-full bg-orange-light px-2.5 py-1 text-[0.72rem] font-bold text-orange-dark">
                          sem faturamento
                        </span>
                      </td>
                    </tr>,
                  ]
                : linha.faturamentos.map((faturamento) => (
                    <tr key={faturamento.id}>
                      <td>
                        <CelulaCliente cliente={linha.cliente} />
                      </td>
                      <td>
                        <LinkContrato cliente={linha.cliente} contrato={linha} />
                        {faturamento.complementar && <span className="ml-1.5 text-[0.7rem] text-mid-grey">(complementar)</span>}
                      </td>
                      <td>{linha.descricao ?? '—'}</td>
                      <td className="font-mono text-xs font-semibold whitespace-nowrap text-navy">
                        <Link
                          href={`/clientes/${linha.cliente.id}/faturamentos/${faturamento.id}`}
                          className="hover:text-orange hover:underline">
                          {formatarMoeda(faturamento.valorExibido)}
                        </Link>
                      </td>
                      <td className="font-mono text-xs">{faturamento.sei ?? '—'}</td>
                      <td>
                        <Enviado valor={faturamento.enviadoCliente} rotulo="Enviado cliente" />
                      </td>
                      <td>
                        <Enviado valor={faturamento.enviadoGfp} rotulo="Enviado GFP" />
                      </td>
                    </tr>
                  ))
            )}
          </tbody>
        </table>
      </Estado>
    </div>
  )
}

// ---------------------------------------------------------------------------

const ABAS: Array<{ id: string; label: string; icon: LucideIcon; Componente: () => ReactNode }> = [
  { id: 'vencimento', label: 'Vencimento', icon: CalendarClock, Componente: AbaVencimento },
  { id: 'valor-total', label: 'Valor total por cliente', icon: Wallet, Componente: AbaValorTotal },
  { id: 'seis', label: 'SEIs por cliente', icon: Hash, Componente: AbaSeis },
  { id: 'status-faturamento', label: 'Status do faturamento', icon: Receipt, Componente: AbaStatusFaturamento },
]

export default function RelatoriosPage() {
  const [abaId, setAbaId] = useState(ABAS[0].id)
  const aba = ABAS.find((item) => item.id === abaId)!
  const Conteudo = aba.Componente

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-6 py-8 lg:px-8">
      <div className="space-y-3">
        <nav className="flex items-center gap-1.5 text-xs font-medium text-mid-grey">
          <span>Relatórios</span>
          <ChevronRight className="size-3" strokeWidth={2.5} />
          <span className="font-semibold text-navy">Consultas</span>
        </nav>
        <div>
          <h1 className="text-[1.75rem] leading-tight font-semibold tracking-tight text-navy">Relatórios</h1>
          <p className="text-sm text-mid-grey">Consultas sobre todos os clientes que você acompanha</p>
        </div>
      </div>

      <div role="tablist" className="flex gap-6 overflow-x-auto border-b border-border-grey">
        {ABAS.map((item) => {
          const Icon = item.icon
          const ativa = item.id === abaId
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={ativa}
              onClick={() => setAbaId(item.id)}
              className={cn(
                'group relative flex shrink-0 items-center gap-2 py-3 text-[0.8rem] whitespace-nowrap transition-colors',
                ativa ? 'font-semibold text-navy' : 'font-medium text-mid-grey hover:text-navy'
              )}
            >
              <Icon
                className={cn('size-3.5 transition-colors', ativa ? 'text-orange' : 'text-mid-grey/70 group-hover:text-navy')}
                strokeWidth={2.25}
              />
              {item.label}
              <span
                className={cn(
                  'absolute inset-x-0 -bottom-px h-[2.5px] rounded-full bg-orange transition-transform duration-200 ease-out',
                  ativa ? 'scale-x-100' : 'scale-x-0'
                )}
              />
            </button>
          )
        })}
      </div>

      <section role="tabpanel" aria-label={aba.label}>
        <Conteudo />
      </section>
    </main>
  )
}
