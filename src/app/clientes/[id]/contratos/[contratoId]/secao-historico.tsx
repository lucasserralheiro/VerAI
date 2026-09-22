'use client'

import { useState, type FormEvent } from 'react'
import { AlertCircle, History, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BTN_OUTLINE, BTN_OUTLINE_SM, BTN_PRIMARY, INPUT_BASE, LINK_DANGER } from '@/lib/ui'
import { formatarData, formatarMoeda } from '@/lib/relatorios-clientes/formatacao'

export type TipoHistorico = 'CONTRATO' | 'ADITIVO' | 'PRORROGACAO' | 'RESCISAO' | 'PROSPECCAO'

export interface LinhaHistorico {
  id: string
  tipo: TipoHistorico
  numero: string | null
  data: string | null
  valor: string | null
  objeto: string | null
  proposta: string | null
  situacao: string | null
  dataInicio: string | null
  dataVencimento: string | null
  dataEnvio: string | null
  observacao: string | null
}

const TIPOS: Record<TipoHistorico, { rotulo: string; estilo: string }> = {
  CONTRATO: { rotulo: 'Contrato', estilo: 'bg-navy text-white' },
  ADITIVO: { rotulo: 'Aditivo', estilo: 'bg-orange-light text-orange-dark' },
  PRORROGACAO: { rotulo: 'Prorrogação', estilo: 'bg-green-ok-light text-green-ok' },
  RESCISAO: { rotulo: 'Rescisão', estilo: 'bg-red-crit-light text-red-crit' },
  PROSPECCAO: { rotulo: 'Prospecção', estilo: 'bg-light-grey text-mid-grey' },
}

type CampoTexto = Exclude<keyof LinhaHistorico, 'id' | 'tipo'>

const CAMPOS: Array<{ campo: CampoTexto; rotulo: string; tipo?: string; largo?: boolean }> = [
  { campo: 'numero', rotulo: 'Nº' },
  { campo: 'data', rotulo: 'Assinada em', tipo: 'date' },
  { campo: 'valor', rotulo: 'Valor' },
  { campo: 'situacao', rotulo: 'Situação' },
  { campo: 'dataInicio', rotulo: 'Início', tipo: 'date' },
  { campo: 'dataVencimento', rotulo: 'Vencimento', tipo: 'date' },
  { campo: 'dataEnvio', rotulo: 'Envio', tipo: 'date' },
  { campo: 'proposta', rotulo: 'Proposta' },
  { campo: 'objeto', rotulo: 'Objeto', largo: true },
  { campo: 'observacao', rotulo: 'Observação', largo: true },
]

type Formulario = { tipo: TipoHistorico } & Record<CampoTexto, string>

const DATAS: CampoTexto[] = ['data', 'dataInicio', 'dataVencimento', 'dataEnvio']

function paraFormulario(linha?: LinhaHistorico): Formulario {
  const formulario = { tipo: linha?.tipo ?? 'CONTRATO' } as Formulario
  for (const { campo } of CAMPOS) {
    const valor = linha?.[campo] ?? ''
    formulario[campo] = DATAS.includes(campo) ? valor.slice(0, 10) : valor
  }
  return formulario
}

async function mensagemDeErro(response: Response, padrao: string) {
  const body = await response.json().catch(() => null)
  return body?.error ?? padrao
}

/** Linha do tempo única do contrato (design doc §3.5): contrato, aditivos, prorrogações, rescisão e
 *  prospecção lado a lado, por data. `aoMudar` recarrega a página. */
export function SecaoHistorico({
  contratoId,
  historico,
  aoMudar,
}: {
  contratoId: string
  historico: LinhaHistorico[]
  aoMudar: () => Promise<void>
}) {
  // null = formulário fechado; 'novo' = criando; id = editando aquela linha
  const [editando, setEditando] = useState<string | null>(null)
  const [formulario, setFormulario] = useState<Formulario>(paraFormulario())
  const [erro, setErro] = useState<string | null>(null)
  const [erroExclusao, setErroExclusao] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [confirmandoExclusao, setConfirmandoExclusao] = useState<string | null>(null)

  function abrirFormulario(linha?: LinhaHistorico) {
    setErro(null)
    setEditando(linha?.id ?? 'novo')
    setFormulario(paraFormulario(linha))
  }

  async function handleSalvar(event: FormEvent) {
    event.preventDefault()
    setErro(null)
    setSalvando(true)
    const criando = editando === 'novo'
    try {
      const response = await fetch(criando ? `/api/contratos/${contratoId}/historico` : `/api/historico-contrato/${editando}`, {
        method: criando ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formulario),
      })
      if (!response.ok) {
        setErro(await mensagemDeErro(response, 'Falha ao salvar a linha do histórico.'))
        return
      }
      setEditando(null)
      await aoMudar()
    } catch {
      setErro('Falha de conexão ao salvar a linha do histórico.')
    } finally {
      setSalvando(false)
    }
  }

  async function handleExcluir(id: string) {
    setConfirmandoExclusao(null)
    setErroExclusao(null)
    try {
      const response = await fetch(`/api/historico-contrato/${id}`, { method: 'DELETE' })
      if (!response.ok) {
        setErroExclusao(await mensagemDeErro(response, 'Falha ao excluir a linha do histórico.'))
        return
      }
      await aoMudar()
    } catch {
      setErroExclusao('Falha de conexão ao excluir a linha do histórico.')
    }
  }

  return (
    <section aria-label="Histórico do contrato" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[0.95rem] font-semibold text-navy">Histórico</h2>
          <p className="text-xs text-mid-grey">Contrato, aditivos, prorrogações e rescisão numa linha do tempo só</p>
        </div>
        {editando === null && (
          <button type="button" onClick={() => abrirFormulario()} className={BTN_PRIMARY}>
            <Plus className="size-3.5" strokeWidth={2.25} />
            Nova linha
          </button>
        )}
      </div>

      {editando !== null && (
        <form onSubmit={handleSalvar} className="card space-y-3">
          <h3 className="text-sm font-semibold text-navy">{editando === 'novo' ? 'Nova linha do histórico' : 'Editar linha do histórico'}</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs font-medium text-mid-grey">Tipo</span>
              <select
                aria-label="Tipo"
                value={formulario.tipo}
                onChange={(e) => setFormulario((atual) => ({ ...atual, tipo: e.target.value as TipoHistorico }))}
                className={INPUT_BASE}
              >
                {(Object.keys(TIPOS) as TipoHistorico[]).map((tipo) => (
                  <option key={tipo} value={tipo}>
                    {TIPOS[tipo].rotulo}
                  </option>
                ))}
              </select>
            </label>
            {CAMPOS.map(({ campo, rotulo, tipo, largo }) => (
              <label key={campo} className={cn('flex flex-col gap-1 text-sm', largo && 'lg:col-span-2')}>
                <span className="text-xs font-medium text-mid-grey">{rotulo}</span>
                <input
                  aria-label={rotulo}
                  type={tipo ?? 'text'}
                  inputMode={campo === 'valor' ? 'decimal' : undefined}
                  placeholder={campo === 'valor' ? '0,00' : undefined}
                  value={formulario[campo]}
                  onChange={(e) => setFormulario((atual) => ({ ...atual, [campo]: e.target.value }))}
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
            <button type="button" onClick={() => setEditando(null)} className={BTN_OUTLINE}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      {erroExclusao && (
        <p className="flex items-center gap-1.5 rounded-lg bg-red-crit-light px-3 py-2 text-sm text-red-crit">
          <AlertCircle className="size-4 shrink-0" strokeWidth={2.25} />
          {erroExclusao}
        </p>
      )}

      {historico.length === 0 ? (
        <div className="card-flush flex flex-col items-center gap-2 p-10 text-center">
          <span className="flex size-11 items-center justify-center rounded-full bg-light-grey text-mid-grey">
            <History className="size-5" strokeWidth={1.75} />
          </span>
          <p className="text-sm text-mid-grey">Nenhuma linha no histórico.</p>
        </div>
      ) : (
        <ol className="relative space-y-3 border-l-2 border-border-grey pl-5">
          {historico.map((linha) => (
            <li key={linha.id} className="card relative">
              <span className="absolute top-5 -left-[1.72rem] size-3 rounded-full border-2 border-white bg-orange" aria-hidden />
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cn('rounded-md px-2 py-0.5 text-[0.7rem] font-bold uppercase tracking-wide', TIPOS[linha.tipo].estilo)}>
                      {TIPOS[linha.tipo].rotulo}
                    </span>
                    {linha.numero && <span className="font-mono text-sm font-semibold text-navy">{linha.numero}</span>}
                    {linha.situacao && <span className="text-xs text-mid-grey">{linha.situacao}</span>}
                  </div>
                  {linha.objeto && <p className="text-sm text-foreground">{linha.objeto}</p>}
                  <p className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs text-mid-grey">
                    {linha.data && <span>assinada {formatarData(linha.data)}</span>}
                    {(linha.dataInicio || linha.dataVencimento) && (
                      <span>
                        vigência {formatarData(linha.dataInicio)} – {formatarData(linha.dataVencimento)}
                      </span>
                    )}
                    {linha.dataEnvio && <span>enviada {formatarData(linha.dataEnvio)}</span>}
                    {linha.proposta && <span>proposta {linha.proposta}</span>}
                  </p>
                  {linha.observacao && <p className="text-xs text-mid-grey">{linha.observacao}</p>}
                </div>
                <div className="flex flex-col items-end gap-2">
                  {linha.valor !== null && (
                    <span className="font-mono text-sm font-semibold whitespace-nowrap text-navy">{formatarMoeda(linha.valor)}</span>
                  )}
                  <div className="flex items-center gap-3 text-xs">
                    {confirmandoExclusao === linha.id ? (
                      <>
                        <span className="font-medium text-red-crit">Excluir?</span>
                        <button type="button" onClick={() => handleExcluir(linha.id)} className={LINK_DANGER}>
                          Sim
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmandoExclusao(null)}
                          className="font-medium text-mid-grey hover:text-navy hover:underline"
                        >
                          Não
                        </button>
                      </>
                    ) : (
                      <>
                        <button type="button" onClick={() => abrirFormulario(linha)} className={BTN_OUTLINE_SM}>
                          Editar
                        </button>
                        <button type="button" onClick={() => setConfirmandoExclusao(linha.id)} className={LINK_DANGER}>
                          Excluir
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
