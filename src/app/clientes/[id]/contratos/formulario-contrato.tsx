'use client'

import { useState, type FormEvent } from 'react'
import { AlertCircle } from 'lucide-react'
import { BTN_OUTLINE, BTN_PRIMARY, INPUT_BASE } from '@/lib/ui'
import type { Saldo } from '@/lib/relatorios-clientes/saldo'
import type { SituacaoVencimento } from '@/lib/relatorios-clientes/vencimento'

export interface Contrato {
  id: string
  clienteId: string
  numeroTermo: string | null
  descricao: string | null
  seiCliente: string | null
  seiProdam: string | null
  situacao: string | null
  dataInicio: string | null
  dataVencimento: string | null
  vigente: boolean | null
  linkSei: string | null
  saldo: Saldo
  vencimento: SituacaoVencimento
}

type CampoTexto = 'numeroTermo' | 'descricao' | 'seiCliente' | 'seiProdam' | 'situacao' | 'dataInicio' | 'dataVencimento' | 'linkSei'

const CAMPOS: Array<{ campo: CampoTexto; rotulo: string; tipo?: string; largo?: boolean }> = [
  { campo: 'numeroTermo', rotulo: 'Nº do termo' },
  { campo: 'descricao', rotulo: 'Descrição', largo: true },
  { campo: 'situacao', rotulo: 'Situação' },
  { campo: 'seiCliente', rotulo: 'SEI cliente' },
  { campo: 'seiProdam', rotulo: 'SEI PRODAM' },
  { campo: 'dataInicio', rotulo: 'Início', tipo: 'date' },
  { campo: 'dataVencimento', rotulo: 'Vencimento', tipo: 'date' },
  { campo: 'linkSei', rotulo: 'Link do SEI', tipo: 'url', largo: true },
]

/** Criar (`contrato` ausente → POST no cliente) ou editar (PATCH /api/contratos/[id]). */
export function FormularioContrato({
  clienteId,
  contrato,
  aoSalvar,
  aoCancelar,
}: {
  clienteId: string
  contrato?: Contrato
  aoSalvar: (salvo: Contrato) => void
  aoCancelar: () => void
}) {
  const [campos, setCampos] = useState<Record<CampoTexto, string>>(() => ({
    numeroTermo: contrato?.numeroTermo ?? '',
    descricao: contrato?.descricao ?? '',
    seiCliente: contrato?.seiCliente ?? '',
    seiProdam: contrato?.seiProdam ?? '',
    situacao: contrato?.situacao ?? '',
    dataInicio: contrato?.dataInicio?.slice(0, 10) ?? '',
    dataVencimento: contrato?.dataVencimento?.slice(0, 10) ?? '',
    linkSei: contrato?.linkSei ?? '',
  }))
  const [vigente, setVigente] = useState(contrato?.vigente ?? false)
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setErro(null)
    setSalvando(true)
    try {
      const response = await fetch(contrato ? `/api/contratos/${contrato.id}` : `/api/clientes/${clienteId}/contratos`, {
        method: contrato ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...campos, vigente }),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        setErro(body?.error ?? 'Falha ao salvar contrato.')
        return
      }
      aoSalvar(await response.json())
    } catch {
      setErro('Falha de conexão ao salvar contrato.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-3">
      <h3 className="text-sm font-semibold text-navy">{contrato ? 'Editar contrato' : 'Novo contrato'}</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {CAMPOS.map(({ campo, rotulo, tipo, largo }) => (
          <label key={campo} className={`flex flex-col gap-1 text-sm ${largo ? 'lg:col-span-2' : ''}`}>
            <span className="text-xs font-medium text-mid-grey">{rotulo}</span>
            <input
              aria-label={rotulo}
              type={tipo ?? 'text'}
              value={campos[campo]}
              onChange={(e) => setCampos((atual) => ({ ...atual, [campo]: e.target.value }))}
              required={campo === 'numeroTermo'}
              className={INPUT_BASE}
            />
          </label>
        ))}
        <label className="flex items-center gap-2 self-end pb-2 text-sm text-navy">
          <input type="checkbox" checked={vigente} onChange={(e) => setVigente(e.target.checked)} className="size-4 accent-orange" />
          Vigente
        </label>
      </div>
      {erro && (
        <p className="flex items-center gap-1.5 rounded-lg bg-red-crit-light px-3 py-2 text-sm text-red-crit">
          <AlertCircle className="size-4 shrink-0" strokeWidth={2.25} />
          {erro}
        </p>
      )}
      <div className="flex gap-2">
        <button type="submit" disabled={salvando} className={BTN_PRIMARY}>
          Salvar
        </button>
        <button type="button" onClick={aoCancelar} className={BTN_OUTLINE}>
          Cancelar
        </button>
      </div>
    </form>
  )
}
