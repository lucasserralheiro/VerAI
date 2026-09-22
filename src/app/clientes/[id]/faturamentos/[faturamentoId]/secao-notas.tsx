'use client'

import { useState, type FormEvent } from 'react'
import { AlertCircle, FileText, Plus } from 'lucide-react'
import { BTN_OUTLINE, BTN_OUTLINE_SM, BTN_PRIMARY, INPUT_BASE, LINK_DANGER } from '@/lib/ui'
import { formatarData, formatarMoeda } from '@/lib/relatorios-clientes/formatacao'

export interface Nota {
  id: string
  numero: string | null
  valor: string | null
  dataEmissao: string | null
  servico: string | null
  quantidade: string | null
  complementar: boolean | null
}

type CampoNota = 'numero' | 'valor' | 'dataEmissao' | 'servico' | 'quantidade'

const CAMPOS: Array<{ campo: CampoNota; rotulo: string; tipo?: string }> = [
  { campo: 'numero', rotulo: 'Nº da nota' },
  { campo: 'valor', rotulo: 'Valor' },
  { campo: 'dataEmissao', rotulo: 'Data de emissão', tipo: 'date' },
  { campo: 'servico', rotulo: 'Serviço' },
  { campo: 'quantidade', rotulo: 'Quantidade' },
]

const FORMULARIO_VAZIO: Record<CampoNota, string> = { numero: '', valor: '', dataEmissao: '', servico: '', quantidade: '' }

async function mensagemDeErro(response: Response, padrao: string) {
  const body = await response.json().catch(() => null)
  return body?.error ?? padrao
}

/** Notas fiscais do faturamento. `aoMudar` recarrega a página (o valor exibido depende da soma). */
export function SecaoNotas({ faturamentoId, notas, aoMudar }: { faturamentoId: string; notas: Nota[]; aoMudar: () => Promise<void> }) {
  // null = formulário fechado; 'novo' = criando; id = editando aquela nota
  const [editando, setEditando] = useState<string | null>(null)
  const [formulario, setFormulario] = useState(FORMULARIO_VAZIO)
  const [erro, setErro] = useState<string | null>(null)
  const [erroExclusao, setErroExclusao] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [confirmandoExclusao, setConfirmandoExclusao] = useState<string | null>(null)

  function abrirFormulario(nota?: Nota) {
    setErro(null)
    setEditando(nota?.id ?? 'novo')
    setFormulario(
      nota
        ? {
            numero: nota.numero ?? '',
            valor: nota.valor ?? '',
            dataEmissao: nota.dataEmissao?.slice(0, 10) ?? '',
            servico: nota.servico ?? '',
            quantidade: nota.quantidade ?? '',
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
      const response = await fetch(criando ? `/api/faturamentos/${faturamentoId}/notas` : `/api/notas-fiscais/${editando}`, {
        method: criando ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formulario),
      })
      if (!response.ok) {
        setErro(await mensagemDeErro(response, 'Falha ao salvar a nota fiscal.'))
        return
      }
      setEditando(null)
      await aoMudar()
    } catch {
      setErro('Falha de conexão ao salvar a nota fiscal.')
    } finally {
      setSalvando(false)
    }
  }

  async function handleExcluir(id: string) {
    setConfirmandoExclusao(null)
    setErroExclusao(null)
    try {
      const response = await fetch(`/api/notas-fiscais/${id}`, { method: 'DELETE' })
      if (!response.ok) {
        setErroExclusao(await mensagemDeErro(response, 'Falha ao excluir a nota fiscal.'))
        return
      }
      await aoMudar()
    } catch {
      setErroExclusao('Falha de conexão ao excluir a nota fiscal.')
    }
  }

  return (
    <section aria-label="Notas fiscais" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[0.95rem] font-semibold text-navy">Notas fiscais</h2>
          <p className="text-xs text-mid-grey">A soma das notas é o valor do faturamento quando ele não tem valor próprio</p>
        </div>
        {editando === null && (
          <button type="button" onClick={() => abrirFormulario()} className={BTN_PRIMARY}>
            <Plus className="size-3.5" strokeWidth={2.25} />
            Nova nota
          </button>
        )}
      </div>

      {editando !== null && (
        <form onSubmit={handleSalvar} className="card space-y-3">
          <h3 className="text-sm font-semibold text-navy">{editando === 'novo' ? 'Nova nota fiscal' : 'Editar nota fiscal'}</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {CAMPOS.map(({ campo, rotulo, tipo }) => (
              <label key={campo} className="flex flex-col gap-1 text-sm">
                <span className="text-xs font-medium text-mid-grey">{rotulo}</span>
                <input
                  aria-label={rotulo}
                  type={tipo ?? 'text'}
                  inputMode={campo === 'valor' || campo === 'quantidade' ? 'decimal' : undefined}
                  placeholder={campo === 'valor' ? '0,00' : undefined}
                  value={formulario[campo]}
                  onChange={(e) => setFormulario((atual) => ({ ...atual, [campo]: e.target.value }))}
                  required={campo === 'valor'}
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

      {notas.length === 0 ? (
        <div className="card-flush flex flex-col items-center gap-2 p-10 text-center">
          <span className="flex size-11 items-center justify-center rounded-full bg-light-grey text-mid-grey">
            <FileText className="size-5" strokeWidth={1.75} />
          </span>
          <p className="text-sm text-mid-grey">Nenhuma nota fiscal neste faturamento.</p>
        </div>
      ) : (
        <div className="card-flush overflow-x-auto">
          <table className="table-institucional">
            <thead>
              <tr>
                <th>Nº</th>
                <th>Emissão</th>
                <th>Serviço</th>
                <th>Qtd</th>
                <th>Valor</th>
                <th>
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {notas.map((nota) => (
                <tr key={nota.id}>
                  <td className="font-mono text-xs font-semibold text-navy">{nota.numero ?? '—'}</td>
                  <td className="font-mono text-xs whitespace-nowrap">{formatarData(nota.dataEmissao)}</td>
                  <td>{nota.servico ?? '—'}</td>
                  <td className="font-mono text-xs">{nota.quantidade ?? '—'}</td>
                  <td className="font-mono text-xs font-semibold whitespace-nowrap text-navy">{formatarMoeda(nota.valor)}</td>
                  <td>
                    <div className="flex items-center justify-end gap-3 text-xs">
                      {confirmandoExclusao === nota.id ? (
                        <>
                          <span className="font-medium text-red-crit">Excluir?</span>
                          <button type="button" onClick={() => handleExcluir(nota.id)} className={LINK_DANGER}>
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
                          <button type="button" onClick={() => abrirFormulario(nota)} className={BTN_OUTLINE_SM}>
                            Editar
                          </button>
                          <button type="button" onClick={() => setConfirmandoExclusao(nota.id)} className={LINK_DANGER}>
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
    </section>
  )
}
