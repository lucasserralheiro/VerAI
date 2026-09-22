'use client'

import { useState, type FormEvent } from 'react'
import { AlertCircle } from 'lucide-react'
import { BTN_OUTLINE, BTN_PRIMARY, INPUT_BASE } from '@/lib/ui'

export interface Fornecedor {
  id: string
  razaoSocial: string
  cnpj: string | null
  contato: string | null
  acordo: string | null
  numeroAcordo: string | null
  dataAssinatura: string | null
  sei: string | null
}

type CampoFornecedor = Exclude<keyof Fornecedor, 'id'>

const CAMPOS: Array<{ campo: CampoFornecedor; rotulo: string; tipo?: string }> = [
  { campo: 'razaoSocial', rotulo: 'Razão social' },
  { campo: 'cnpj', rotulo: 'CNPJ' },
  { campo: 'acordo', rotulo: 'Acordo' },
  { campo: 'numeroAcordo', rotulo: 'Nº do acordo' },
  { campo: 'dataAssinatura', rotulo: 'Data de assinatura', tipo: 'date' },
  { campo: 'sei', rotulo: 'Processo SEI' },
  { campo: 'contato', rotulo: 'Contato' },
]

/** Criar (`fornecedor` ausente → POST /api/fornecedores) ou editar (PATCH /api/fornecedores/[id]). */
export function FormularioFornecedor({
  fornecedor,
  aoSalvar,
  aoCancelar,
}: {
  fornecedor?: Fornecedor
  aoSalvar: (salvo: Fornecedor) => void
  aoCancelar: () => void
}) {
  const [campos, setCampos] = useState<Record<CampoFornecedor, string>>(() => ({
    razaoSocial: fornecedor?.razaoSocial ?? '',
    cnpj: fornecedor?.cnpj ?? '',
    contato: fornecedor?.contato ?? '',
    acordo: fornecedor?.acordo ?? '',
    numeroAcordo: fornecedor?.numeroAcordo ?? '',
    dataAssinatura: fornecedor?.dataAssinatura?.slice(0, 10) ?? '',
    sei: fornecedor?.sei ?? '',
  }))
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setErro(null)
    setSalvando(true)
    try {
      const response = await fetch(fornecedor ? `/api/fornecedores/${fornecedor.id}` : '/api/fornecedores', {
        method: fornecedor ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(campos),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        setErro(body?.error ?? 'Falha ao salvar fornecedor.')
        return
      }
      aoSalvar(await response.json())
    } catch {
      setErro('Falha de conexão ao salvar fornecedor.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-3">
      <h3 className="text-sm font-semibold text-navy">{fornecedor ? 'Editar fornecedor' : 'Novo fornecedor'}</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {CAMPOS.map(({ campo, rotulo, tipo }) => (
          <label key={campo} className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-medium text-mid-grey">{rotulo}</span>
            <input
              aria-label={rotulo}
              type={tipo ?? 'text'}
              value={campos[campo]}
              onChange={(e) => setCampos((atual) => ({ ...atual, [campo]: e.target.value }))}
              required={campo === 'razaoSocial'}
              className={INPUT_BASE}
            />
          </label>
        ))}
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
