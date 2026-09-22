'use client'

import { useState, type FormEvent } from 'react'
import { AlertCircle } from 'lucide-react'
import { BTN_OUTLINE, BTN_PRIMARY, INPUT_BASE } from '@/lib/ui'

export interface Demanda {
  id: string
  clienteId: string
  assunto: string | null
  tipoAssunto: string | null
  tipo: string | null
  responsavel: string | null
  situacao: string | null
  dataAbertura: string | null
  documento: string | null
  sei: string | null
  notaImportacao: string | null
  cliente: { id: string; nome: string; siglaLegado: string | null }
}

export interface SugestoesDemanda {
  situacao: string[]
  tipo: string[]
  tipoAssunto: string[]
  responsavel: string[]
}

export interface OpcaoCliente {
  id: string
  nome: string
  siglaLegado: string | null
}

export function rotuloCliente(cliente: Pick<OpcaoCliente, 'nome' | 'siglaLegado'>) {
  return cliente.siglaLegado ? `${cliente.siglaLegado} — ${cliente.nome}` : cliente.nome
}

type Campo = 'clienteId' | 'assunto' | 'tipoAssunto' | 'tipo' | 'responsavel' | 'situacao' | 'dataAbertura' | 'documento' | 'sei'

const CAMPOS: Array<{ campo: Exclude<Campo, 'clienteId'>; rotulo: string; tipo?: string; sugestao?: keyof SugestoesDemanda; largo?: boolean }> = [
  { campo: 'assunto', rotulo: 'Assunto', largo: true },
  { campo: 'tipoAssunto', rotulo: 'Tipo de assunto', sugestao: 'tipoAssunto' },
  { campo: 'tipo', rotulo: 'Tipo de documento', sugestao: 'tipo' },
  { campo: 'responsavel', rotulo: 'Responsável', sugestao: 'responsavel' },
  { campo: 'situacao', rotulo: 'Situação', sugestao: 'situacao' },
  { campo: 'dataAbertura', rotulo: 'Abertura', tipo: 'date' },
  { campo: 'documento', rotulo: 'Documento' },
  { campo: 'sei', rotulo: 'SEI' },
]

/** Criar (`demanda` ausente → POST /api/demandas) ou editar (PATCH /api/demandas/[id]). Com
 *  `clienteFixo`, o cliente não aparece no formulário (aba da ficha do cliente); sem ele, é um
 *  select — e na edição é como se corrige a atribuição feita pelo import. */
export function FormularioDemanda({
  demanda,
  clienteFixo,
  clientes,
  sugestoes,
  aoSalvar,
  aoCancelar,
}: {
  demanda?: Demanda
  clienteFixo?: string
  clientes: OpcaoCliente[] | null
  sugestoes: SugestoesDemanda | null
  aoSalvar: (salva: Demanda) => void
  aoCancelar: () => void
}) {
  const titulo = demanda ? 'Editar demanda' : 'Nova demanda'
  const [campos, setCampos] = useState<Record<Campo, string>>(() => ({
    clienteId: demanda?.clienteId ?? clienteFixo ?? '',
    assunto: demanda?.assunto ?? '',
    tipoAssunto: demanda?.tipoAssunto ?? '',
    tipo: demanda?.tipo ?? '',
    responsavel: demanda?.responsavel ?? '',
    situacao: demanda?.situacao ?? '',
    dataAbertura: demanda?.dataAbertura?.slice(0, 10) ?? '',
    documento: demanda?.documento ?? '',
    sei: demanda?.sei ?? '',
  }))
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setErro(null)
    setSalvando(true)
    try {
      const response = await fetch(demanda ? `/api/demandas/${demanda.id}` : '/api/demandas', {
        method: demanda ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(campos),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        setErro(body?.error ?? 'Falha ao salvar demanda.')
        return
      }
      aoSalvar(await response.json())
    } catch {
      setErro('Falha de conexão ao salvar demanda.')
    } finally {
      setSalvando(false)
    }
  }

  const alterar = (campo: Campo, valor: string) => setCampos((atual) => ({ ...atual, [campo]: valor }))

  return (
    <form aria-label={titulo} onSubmit={handleSubmit} className="card space-y-3">
      <h3 className="text-sm font-semibold text-navy">{titulo}</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {!clienteFixo && (
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-medium text-mid-grey">Cliente</span>
            <select
              aria-label="Cliente"
              value={campos.clienteId}
              onChange={(e) => alterar('clienteId', e.target.value)}
              required
              className={INPUT_BASE}
            >
              <option value="">{clientes ? 'Selecione...' : 'Carregando...'}</option>
              {clientes?.map((cliente) => (
                <option key={cliente.id} value={cliente.id}>
                  {rotuloCliente(cliente)}
                </option>
              ))}
            </select>
          </label>
        )}
        {CAMPOS.map(({ campo, rotulo, tipo, sugestao, largo }) => (
          <label key={campo} className={`flex flex-col gap-1 text-sm ${largo ? 'lg:col-span-2' : ''}`}>
            <span className="text-xs font-medium text-mid-grey">{rotulo}</span>
            <input
              aria-label={rotulo}
              type={tipo ?? 'text'}
              list={sugestao ? `sugestoes-demanda-${sugestao}` : undefined}
              value={campos[campo]}
              onChange={(e) => alterar(campo, e.target.value)}
              required={campo === 'assunto'}
              className={INPUT_BASE}
            />
          </label>
        ))}
      </div>
      {sugestoes &&
        (Object.keys(sugestoes) as Array<keyof SugestoesDemanda>).map((chave) => (
          <datalist key={chave} id={`sugestoes-demanda-${chave}`}>
            {sugestoes[chave].map((valor) => (
              <option key={valor} value={valor} />
            ))}
          </datalist>
        ))}
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
