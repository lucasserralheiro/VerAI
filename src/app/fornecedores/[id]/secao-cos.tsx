'use client'

import { useState, type FormEvent } from 'react'
import { AlertCircle, FileStack, Plus } from 'lucide-react'
import { BTN_OUTLINE, BTN_OUTLINE_SM, BTN_PRIMARY, INPUT_BASE, LINK_DANGER } from '@/lib/ui'
import { formatarData, formatarMoeda } from '@/lib/relatorios-clientes/formatacao'
import { SeiLink } from '@/components/relatorios-clientes/sei-link'

export interface Co {
  id: string
  numero: string | null
  dataInicio: string | null
  dataFim: string | null
  valor: string | null
  sei: string | null
}

type CampoCo = Exclude<keyof Co, 'id'>

const FORMULARIO_VAZIO: Record<CampoCo, string> = { numero: '', dataInicio: '', dataFim: '', valor: '', sei: '' }

const CAMPOS: Array<{ campo: CampoCo; rotulo: string; tipo?: string }> = [
  { campo: 'numero', rotulo: 'Nº do CO' },
  { campo: 'dataInicio', rotulo: 'Início da vigência', tipo: 'date' },
  { campo: 'dataFim', rotulo: 'Fim da vigência', tipo: 'date' },
  { campo: 'valor', rotulo: 'Valor' },
  { campo: 'sei', rotulo: 'Processo SEI' },
]

function vigencia(co: Co): string {
  if (!co.dataInicio && !co.dataFim) return '—'
  return `${formatarData(co.dataInicio)} – ${formatarData(co.dataFim)}`
}

async function mensagemDeErro(response: Response, padrao: string) {
  const body = await response.json().catch(() => null)
  return body?.error ?? padrao
}

/** CO (contrato de operacionalização) vive na ficha do fornecedor. `aoMudar` recarrega a ficha. */
export function SecaoCos({ fornecedorId, cos, aoMudar }: { fornecedorId: string; cos: Co[]; aoMudar: () => Promise<void> }) {
  // null = formulário fechado; 'novo' = criando; id = editando aquele CO
  const [editando, setEditando] = useState<string | null>(null)
  const [formulario, setFormulario] = useState(FORMULARIO_VAZIO)
  const [erro, setErro] = useState<string | null>(null)
  const [erroExclusao, setErroExclusao] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [confirmandoExclusao, setConfirmandoExclusao] = useState<string | null>(null)

  function abrirFormulario(co?: Co) {
    setErro(null)
    setEditando(co?.id ?? 'novo')
    setFormulario(
      co
        ? {
            numero: co.numero ?? '',
            dataInicio: co.dataInicio?.slice(0, 10) ?? '',
            dataFim: co.dataFim?.slice(0, 10) ?? '',
            valor: co.valor ?? '',
            sei: co.sei ?? '',
          }
        : FORMULARIO_VAZIO
    )
  }

  async function handleSalvar(event: FormEvent) {
    event.preventDefault()
    setErro(null)
    setSalvando(true)
    const criando = editando === 'novo'
    try {
      const response = await fetch(criando ? `/api/fornecedores/${fornecedorId}/cos` : `/api/cos/${editando}`, {
        method: criando ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formulario),
      })
      if (!response.ok) {
        setErro(await mensagemDeErro(response, 'Falha ao salvar o CO.'))
        return
      }
      setEditando(null)
      await aoMudar()
    } catch {
      setErro('Falha de conexão ao salvar o CO.')
    } finally {
      setSalvando(false)
    }
  }

  async function handleExcluir(id: string) {
    setConfirmandoExclusao(null)
    setErroExclusao(null)
    try {
      const response = await fetch(`/api/cos/${id}`, { method: 'DELETE' })
      if (!response.ok) {
        setErroExclusao(await mensagemDeErro(response, 'Falha ao excluir o CO.'))
        return
      }
      await aoMudar()
    } catch {
      setErroExclusao('Falha de conexão ao excluir o CO.')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[0.95rem] font-semibold text-navy">Contratos de operacionalização (CO)</h2>
          <p className="text-xs text-mid-grey">Lado do fornecedor: vigência, valor e processo SEI</p>
        </div>
        {editando === null && (
          <button type="button" onClick={() => abrirFormulario()} className={BTN_PRIMARY}>
            <Plus className="size-3.5" strokeWidth={2.25} />
            Novo CO
          </button>
        )}
      </div>

      {editando !== null && (
        <form onSubmit={handleSalvar} className="card space-y-3">
          <h3 className="text-sm font-semibold text-navy">{editando === 'novo' ? 'Novo CO' : 'Editar CO'}</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {CAMPOS.map(({ campo, rotulo, tipo }) => (
              <label key={campo} className="flex flex-col gap-1 text-sm">
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

      {cos.length === 0 ? (
        <div className="card-flush flex flex-col items-center gap-2 p-10 text-center">
          <span className="flex size-11 items-center justify-center rounded-full bg-light-grey text-mid-grey">
            <FileStack className="size-5" strokeWidth={1.75} />
          </span>
          <p className="text-sm text-mid-grey">Nenhum CO cadastrado.</p>
        </div>
      ) : (
        <div className="card-flush overflow-x-auto">
          <table className="table-institucional">
            <thead>
              <tr>
                <th>Nº do CO</th>
                <th>Vigência</th>
                <th>Valor</th>
                <th>Processo SEI</th>
                <th>
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {cos.map((co) => (
                <tr key={co.id}>
                  <td className="font-mono text-xs font-semibold text-navy">{co.numero ?? '—'}</td>
                  <td className="font-mono text-xs whitespace-nowrap">{vigencia(co)}</td>
                  <td className="font-mono text-xs whitespace-nowrap">{formatarMoeda(co.valor)}</td>
                  <td>
                    <SeiLink numero={co.sei} />
                  </td>
                  <td>
                    <div className="flex items-center justify-end gap-3 text-xs">
                      {confirmandoExclusao === co.id ? (
                        <>
                          <span className="font-medium text-red-crit">Excluir?</span>
                          <button type="button" onClick={() => handleExcluir(co.id)} className={LINK_DANGER}>
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
                          <button type="button" onClick={() => abrirFormulario(co)} className={BTN_OUTLINE_SM}>
                            Editar
                          </button>
                          <button type="button" onClick={() => setConfirmandoExclusao(co.id)} className={LINK_DANGER}>
                            Excluir
                          </button>
                        </>
                      )}
                    </div>
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
