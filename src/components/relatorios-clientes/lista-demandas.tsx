'use client'

// Lista de demandas: a mesma tela serve à aba "Demandas" da ficha do cliente (`clienteId` fixo) e
// à lista geral /demandas (cross-cliente, com coluna e filtro de cliente).

import { useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { AlertCircle, AlertTriangle, ClipboardList, Loader2, Plus, Search } from 'lucide-react'
import { BTN_OUTLINE, BTN_PRIMARY, INPUT_BASE } from '@/lib/ui'
import { formatarData } from '@/lib/relatorios-clientes/formatacao'
import {
  FormularioDemanda,
  rotuloCliente,
  type Demanda,
  type OpcaoCliente,
  type SugestoesDemanda,
} from './formulario-demanda'

interface DemandaNaLista extends Demanda {
  ultimoTramite: { posicao: string | null; responsavelAtual: string | null; data: string | null } | null
}

export function ListaDemandas({ clienteId }: { clienteId?: string }) {
  const geral = !clienteId
  const [demandas, setDemandas] = useState<DemandaNaLista[]>([])
  const [sugestoes, setSugestoes] = useState<SugestoesDemanda | null>(null)
  const [clientes, setClientes] = useState<OpcaoCliente[] | null>(null)
  const [filtros, setFiltros] = useState({ clienteId: clienteId ?? '', situacao: '', atribuidaNoImport: false })
  const [busca, setBusca] = useState('')
  const [q, setQ] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [criando, setCriando] = useState(false)

  async function carregar() {
    const params = new URLSearchParams()
    if (filtros.clienteId) params.set('clienteId', filtros.clienteId)
    if (filtros.situacao) params.set('situacao', filtros.situacao)
    if (filtros.atribuidaNoImport) params.set('atribuidaNoImport', '1')
    if (q) params.set('q', q)
    const query = params.toString()
    try {
      const response = await fetch(`/api/demandas${query ? `?${query}` : ''}`)
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        setErro(body?.error ?? 'Falha ao carregar demandas.')
        return
      }
      setErro(null)
      const corpo = await response.json()
      setDemandas(Array.isArray(corpo?.demandas) ? corpo.demandas : [])
      setSugestoes(corpo?.sugestoes ?? null)
    } catch {
      setErro('Falha de conexão ao carregar demandas.')
    }
  }

  useEffect(() => {
    carregar().finally(() => setCarregando(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtros, q])

  // Lista de clientes só na lista geral (filtro e select do formulário).
  useEffect(() => {
    if (!geral) return
    fetch('/api/clientes')
      .then(async (response) => {
        if (!response.ok) return
        const lista = await response.json()
        if (Array.isArray(lista)) setClientes(lista)
      })
      .catch(() => {})
  }, [geral])

  function handleBuscar(event: FormEvent) {
    event.preventDefault()
    setQ(busca.trim())
  }

  if (carregando) {
    return (
      <p className="flex items-center gap-2 text-sm text-mid-grey">
        <Loader2 className="size-4 animate-spin" strokeWidth={2.25} />
        Carregando...
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[0.95rem] font-semibold text-navy">Demandas</h2>
          <p className="text-xs text-mid-grey">Assuntos em aberto, com trâmite (posição/ação/retorno)</p>
        </div>
        {!criando && (
          <button type="button" onClick={() => setCriando(true)} className={BTN_PRIMARY}>
            <Plus className="size-3.5" strokeWidth={2.25} />
            Nova demanda
          </button>
        )}
      </div>

      {criando && (
        <FormularioDemanda
          clienteFixo={clienteId}
          clientes={clientes}
          sugestoes={sugestoes}
          aoSalvar={async () => {
            setCriando(false)
            await carregar()
          }}
          aoCancelar={() => setCriando(false)}
        />
      )}

      <div className="flex flex-wrap items-center gap-2">
        {geral && (
          <select
            aria-label="Filtrar por cliente"
            value={filtros.clienteId}
            onChange={(e) => setFiltros((atual) => ({ ...atual, clienteId: e.target.value }))}
            className={INPUT_BASE}
          >
            <option value="">Todos os clientes</option>
            {clientes?.map((cliente) => (
              <option key={cliente.id} value={cliente.id}>
                {rotuloCliente(cliente)}
              </option>
            ))}
          </select>
        )}
        <select
          aria-label="Filtrar por situação"
          value={filtros.situacao}
          onChange={(e) => setFiltros((atual) => ({ ...atual, situacao: e.target.value }))}
          className={INPUT_BASE}
        >
          <option value="">Todas as situações</option>
          {sugestoes?.situacao.map((situacao) => (
            <option key={situacao} value={situacao}>
              {situacao}
            </option>
          ))}
        </select>
        <form role="search" onSubmit={handleBuscar} className="flex gap-2">
          <input
            aria-label="Buscar demanda"
            type="search"
            placeholder="Assunto, documento, SEI, responsável"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className={`${INPUT_BASE} w-64`}
          />
          <button type="submit" className={BTN_OUTLINE}>
            <Search className="size-3.5" strokeWidth={2.25} />
            Buscar
          </button>
        </form>
        <label className="flex items-center gap-2 text-sm text-navy">
          <input
            type="checkbox"
            checked={filtros.atribuidaNoImport}
            onChange={(e) => setFiltros((atual) => ({ ...atual, atribuidaNoImport: e.target.checked }))}
            className="size-4 accent-orange"
          />
          Só com cliente atribuído no import
        </label>
      </div>

      {erro ? (
        <p className="flex items-center gap-1.5 rounded-xl bg-red-crit-light p-4 text-sm text-red-crit">
          <AlertCircle className="size-4 shrink-0" strokeWidth={2.25} />
          {erro}
        </p>
      ) : demandas.length === 0 ? (
        <div className="card-flush flex flex-col items-center gap-2 p-10 text-center">
          <span className="flex size-11 items-center justify-center rounded-full bg-light-grey text-mid-grey">
            <ClipboardList className="size-5" strokeWidth={1.75} />
          </span>
          <p className="text-sm text-mid-grey">Nenhuma demanda encontrada.</p>
        </div>
      ) : (
        <div className="card-flush overflow-x-auto">
          <table className="table-institucional">
            <thead>
              <tr>
                {geral && <th>Cliente</th>}
                <th>Assunto</th>
                <th>Tipo</th>
                <th>Responsável</th>
                <th>Posição atual</th>
                <th>Desde</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {demandas.map((demanda) => (
                <tr key={demanda.id}>
                  {geral && <td className="font-mono text-xs font-semibold">{demanda.cliente.siglaLegado ?? demanda.cliente.nome}</td>}
                  <td>
                    <span className="flex items-start gap-1.5">
                      {demanda.notaImportacao && (
                        <span title={demanda.notaImportacao} className="mt-0.5 text-orange-dark">
                          <AlertTriangle className="size-3.5" strokeWidth={2.25} aria-hidden />
                        </span>
                      )}
                      <Link href={`/demandas/${demanda.id}`} className="font-semibold text-navy hover:text-orange hover:underline">
                        {demanda.assunto ?? '(sem assunto)'}
                      </Link>
                    </span>
                  </td>
                  <td>{demanda.tipo ?? '—'}</td>
                  <td>{demanda.responsavel ?? '—'}</td>
                  <td className="max-w-xs">{demanda.ultimoTramite?.posicao ?? '—'}</td>
                  <td className="font-mono text-xs whitespace-nowrap">{formatarData(demanda.ultimoTramite?.data ?? null)}</td>
                  <td>{demanda.situacao ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
