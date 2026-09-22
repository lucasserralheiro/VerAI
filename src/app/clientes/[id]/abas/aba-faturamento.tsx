'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertCircle, Loader2, Plus, Receipt } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BTN_PRIMARY, INPUT_BASE } from '@/lib/ui'
import { formatarMoeda } from '@/lib/relatorios-clientes/formatacao'
import {
  FormularioFaturamento,
  MESES,
  competencia,
  type Faturamento,
  type OpcaoContrato,
} from '../faturamentos/formulario-faturamento'

function PillEnviado({ enviado }: { enviado: boolean | null }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.72rem] font-bold whitespace-nowrap',
        enviado ? 'bg-green-ok-light text-green-ok' : 'bg-light-grey text-mid-grey'
      )}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {enviado ? 'sim' : 'pendente'}
    </span>
  )
}

export function AbaFaturamento({ clienteId }: { clienteId: string }) {
  const [faturamentos, setFaturamentos] = useState<Faturamento[]>([])
  const [contratos, setContratos] = useState<OpcaoContrato[] | null>(null)
  const [filtros, setFiltros] = useState({ ano: '', mes: '', contratoId: '' })
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [criando, setCriando] = useState(false)

  async function carregar() {
    const query = new URLSearchParams(Object.entries(filtros).filter(([, valor]) => valor)).toString()
    try {
      const response = await fetch(`/api/clientes/${clienteId}/faturamentos${query ? `?${query}` : ''}`)
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        setErro(body?.error ?? 'Falha ao carregar faturamentos.')
        return
      }
      setErro(null)
      const lista = await response.json()
      setFaturamentos(Array.isArray(lista) ? lista : [])
    } catch {
      setErro('Falha de conexão ao carregar faturamentos.')
    }
  }

  useEffect(() => {
    carregar().finally(() => setCarregando(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteId, filtros])

  // Contratos do cliente: alimentam o filtro e o select do formulário.
  useEffect(() => {
    fetch(`/api/clientes/${clienteId}/contratos`)
      .then(async (response) => {
        if (!response.ok) return
        const lista = await response.json()
        if (Array.isArray(lista)) setContratos(lista)
      })
      .catch(() => {})
  }, [clienteId])

  if (carregando) {
    return (
      <p className="flex items-center gap-2 text-sm text-mid-grey">
        <Loader2 className="size-4 animate-spin" strokeWidth={2.25} />
        Carregando...
      </p>
    )
  }

  const filtrar = (campo: keyof typeof filtros, valor: string) => setFiltros((atual) => ({ ...atual, [campo]: valor }))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[0.95rem] font-semibold text-navy">Faturamento</h2>
          <p className="text-xs text-mid-grey">Um lançamento por mês/contrato, com notas fiscais associadas</p>
        </div>
        {!criando && (
          <button type="button" onClick={() => setCriando(true)} className={BTN_PRIMARY}>
            <Plus className="size-3.5" strokeWidth={2.25} />
            Novo faturamento
          </button>
        )}
      </div>

      {criando && (
        <FormularioFaturamento
          clienteId={clienteId}
          contratos={contratos}
          aoSalvar={async () => {
            setCriando(false)
            await carregar()
          }}
          aoCancelar={() => setCriando(false)}
        />
      )}

      <div className="flex flex-wrap gap-2">
        <input
          aria-label="Filtrar por ano"
          type="text"
          inputMode="numeric"
          placeholder="Ano"
          value={filtros.ano}
          onChange={(e) => filtrar('ano', e.target.value.replace(/\D/g, '').slice(0, 4))}
          className={`${INPUT_BASE} w-24`}
        />
        <select aria-label="Filtrar por mês" value={filtros.mes} onChange={(e) => filtrar('mes', e.target.value)} className={INPUT_BASE}>
          <option value="">Todos os meses</option>
          {MESES.map((nome, i) => (
            <option key={nome} value={String(i + 1)}>
              {nome}
            </option>
          ))}
        </select>
        <select
          aria-label="Filtrar por contrato"
          value={filtros.contratoId}
          onChange={(e) => filtrar('contratoId', e.target.value)}
          className={INPUT_BASE}
        >
          <option value="">Todos os contratos</option>
          {contratos?.map((contrato) => (
            <option key={contrato.id} value={contrato.id}>
              {contrato.numeroTermo ?? '(sem número)'}
            </option>
          ))}
        </select>
      </div>

      {erro ? (
        <p className="flex items-center gap-1.5 rounded-xl bg-red-crit-light p-4 text-sm text-red-crit">
          <AlertCircle className="size-4 shrink-0" strokeWidth={2.25} />
          {erro}
        </p>
      ) : faturamentos.length === 0 ? (
        <div className="card-flush flex flex-col items-center gap-2 p-10 text-center">
          <span className="flex size-11 items-center justify-center rounded-full bg-light-grey text-mid-grey">
            <Receipt className="size-5" strokeWidth={1.75} />
          </span>
          <p className="text-sm text-mid-grey">Nenhum faturamento encontrado.</p>
        </div>
      ) : (
        <div className="card-flush overflow-x-auto">
          <table className="table-institucional">
            <thead>
              <tr>
                <th>Contrato</th>
                <th>Competência</th>
                <th>SEI faturamento</th>
                <th>Serviço</th>
                <th>Valor</th>
                <th>Enviado cliente</th>
                <th>Enviado GFP</th>
              </tr>
            </thead>
            <tbody>
              {faturamentos.map((faturamento) => (
                <tr key={faturamento.id}>
                  <td className="font-mono text-xs font-semibold text-navy">{faturamento.contrato.numeroTermo ?? '—'}</td>
                  <td className="font-mono text-xs">
                    <Link
                      href={`/clientes/${clienteId}/faturamentos/${faturamento.id}`}
                      className="font-semibold text-navy hover:text-orange hover:underline"
                    >
                      {competencia(faturamento)}
                    </Link>
                  </td>
                  <td className="font-mono text-xs">{faturamento.sei ?? '—'}</td>
                  <td>{faturamento.servicos.length > 0 ? faturamento.servicos.join(', ') : '—'}</td>
                  <td className="font-mono text-xs whitespace-nowrap">{formatarMoeda(faturamento.valorExibido)}</td>
                  <td>
                    <PillEnviado enviado={faturamento.enviadoCliente} />
                  </td>
                  <td>
                    <PillEnviado enviado={faturamento.enviadoGfp} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
