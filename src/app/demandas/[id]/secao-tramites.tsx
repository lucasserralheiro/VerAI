'use client'

import { useState, type FormEvent } from 'react'
import { AlertCircle, GitCommitVertical, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BTN_OUTLINE, BTN_OUTLINE_SM, BTN_PRIMARY, INPUT_BASE, LINK_DANGER } from '@/lib/ui'
import { formatarData } from '@/lib/relatorios-clientes/formatacao'

export interface Tramite {
  id: string
  data: string | null
  posicao: string | null
  acao: string | null
  observacao: string | null
  responsavelAtual: string | null
  dataRetorno: string | null
  comApresentacao: boolean | null
  assinado: boolean | null
}

export interface SugestoesTramite {
  responsavelAtual: string[]
  acao: string[]
}

type CampoTexto = 'data' | 'posicao' | 'acao' | 'responsavelAtual' | 'dataRetorno' | 'observacao'
type CampoMarca = 'comApresentacao' | 'assinado'

const CAMPOS: Array<{ campo: CampoTexto; rotulo: string; tipo?: string; sugestao?: keyof SugestoesTramite; largo?: boolean }> = [
  { campo: 'data', rotulo: 'Desde', tipo: 'date' },
  { campo: 'responsavelAtual', rotulo: 'Com quem está', sugestao: 'responsavelAtual' },
  { campo: 'dataRetorno', rotulo: 'Retorno', tipo: 'date' },
  { campo: 'posicao', rotulo: 'Posição', largo: true },
  { campo: 'acao', rotulo: 'Ação', sugestao: 'acao', largo: true },
  { campo: 'observacao', rotulo: 'Observação', largo: true },
]

const MARCAS: Array<{ campo: CampoMarca; rotulo: string }> = [
  { campo: 'comApresentacao', rotulo: 'Com apresentação' },
  { campo: 'assinado', rotulo: 'Assinado' },
]

type Formulario = Record<CampoTexto, string> & Record<CampoMarca, boolean>

function paraFormulario(tramite?: Tramite): Formulario {
  return {
    data: tramite?.data?.slice(0, 10) ?? '',
    posicao: tramite?.posicao ?? '',
    acao: tramite?.acao ?? '',
    responsavelAtual: tramite?.responsavelAtual ?? '',
    dataRetorno: tramite?.dataRetorno?.slice(0, 10) ?? '',
    observacao: tramite?.observacao ?? '',
    comApresentacao: tramite?.comApresentacao ?? false,
    assinado: tramite?.assinado ?? false,
  }
}

async function mensagemDeErro(response: Response, padrao: string) {
  const body = await response.json().catch(() => null)
  return body?.error ?? padrao
}

/** Trâmite da demanda em linha do tempo. `aoMudar` recarrega a página. */
export function SecaoTramites({
  demandaId,
  tramites,
  sugestoes,
  aoMudar,
}: {
  demandaId: string
  tramites: Tramite[]
  sugestoes: SugestoesTramite | null
  aoMudar: () => Promise<void>
}) {
  // null = formulário fechado; 'novo' = criando; id = editando aquele trâmite
  const [editando, setEditando] = useState<string | null>(null)
  const [formulario, setFormulario] = useState<Formulario>(paraFormulario())
  const [erro, setErro] = useState<string | null>(null)
  const [erroExclusao, setErroExclusao] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [confirmandoExclusao, setConfirmandoExclusao] = useState<string | null>(null)

  function abrirFormulario(tramite?: Tramite) {
    setErro(null)
    setEditando(tramite?.id ?? 'novo')
    setFormulario(paraFormulario(tramite))
  }

  async function handleSalvar(event: FormEvent) {
    event.preventDefault()
    setErro(null)
    setSalvando(true)
    const criando = editando === 'novo'
    try {
      const response = await fetch(criando ? `/api/demandas/${demandaId}/tramites` : `/api/tramites-demanda/${editando}`, {
        method: criando ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formulario),
      })
      if (!response.ok) {
        setErro(await mensagemDeErro(response, 'Falha ao salvar o trâmite.'))
        return
      }
      setEditando(null)
      await aoMudar()
    } catch {
      setErro('Falha de conexão ao salvar o trâmite.')
    } finally {
      setSalvando(false)
    }
  }

  async function handleExcluir(id: string) {
    setConfirmandoExclusao(null)
    setErroExclusao(null)
    try {
      const response = await fetch(`/api/tramites-demanda/${id}`, { method: 'DELETE' })
      if (!response.ok) {
        setErroExclusao(await mensagemDeErro(response, 'Falha ao excluir o trâmite.'))
        return
      }
      await aoMudar()
    } catch {
      setErroExclusao('Falha de conexão ao excluir o trâmite.')
    }
  }

  return (
    <section aria-label="Trâmite" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[0.95rem] font-semibold text-navy">Trâmite</h2>
          <p className="text-xs text-mid-grey">Por onde a demanda passou: posição, ação e retorno</p>
        </div>
        {editando === null && (
          <button type="button" onClick={() => abrirFormulario()} className={BTN_PRIMARY}>
            <Plus className="size-3.5" strokeWidth={2.25} />
            Novo trâmite
          </button>
        )}
      </div>

      {editando !== null && (
        <form onSubmit={handleSalvar} className="card space-y-3">
          <h3 className="text-sm font-semibold text-navy">{editando === 'novo' ? 'Novo trâmite' : 'Editar trâmite'}</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {CAMPOS.map(({ campo, rotulo, tipo, sugestao, largo }) => (
              <label key={campo} className={cn('flex flex-col gap-1 text-sm', largo && 'lg:col-span-3')}>
                <span className="text-xs font-medium text-mid-grey">{rotulo}</span>
                <input
                  aria-label={rotulo}
                  type={tipo ?? 'text'}
                  list={sugestao ? `sugestoes-tramite-${sugestao}` : undefined}
                  value={formulario[campo]}
                  onChange={(e) => setFormulario((atual) => ({ ...atual, [campo]: e.target.value }))}
                  required={campo === 'data'}
                  className={INPUT_BASE}
                />
              </label>
            ))}
          </div>
          {sugestoes &&
            (Object.keys(sugestoes) as Array<keyof SugestoesTramite>).map((chave) => (
              <datalist key={chave} id={`sugestoes-tramite-${chave}`}>
                {sugestoes[chave].map((valor) => (
                  <option key={valor} value={valor} />
                ))}
              </datalist>
            ))}
          <div className="flex flex-wrap gap-5">
            {MARCAS.map(({ campo, rotulo }) => (
              <label key={campo} className="flex items-center gap-2 text-sm text-navy">
                <input
                  type="checkbox"
                  checked={formulario[campo]}
                  onChange={(e) => setFormulario((atual) => ({ ...atual, [campo]: e.target.checked }))}
                  className="size-4 accent-orange"
                />
                {rotulo}
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

      {tramites.length === 0 ? (
        <div className="card-flush flex flex-col items-center gap-2 p-10 text-center">
          <span className="flex size-11 items-center justify-center rounded-full bg-light-grey text-mid-grey">
            <GitCommitVertical className="size-5" strokeWidth={1.75} />
          </span>
          <p className="text-sm text-mid-grey">Nenhum trâmite registrado.</p>
        </div>
      ) : (
        <ol className="relative space-y-3 border-l-2 border-border-grey pl-5">
          {tramites.map((tramite) => (
            <li key={tramite.id} className="card relative">
              <span className="absolute top-5 -left-[1.72rem] size-3 rounded-full border-2 border-white bg-orange" aria-hidden />
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <p className="flex flex-wrap items-center gap-x-3 font-mono text-xs text-mid-grey">
                    <span className="font-semibold text-navy">{formatarData(tramite.data)}</span>
                    {tramite.responsavelAtual && <span>com {tramite.responsavelAtual}</span>}
                    {tramite.dataRetorno && <span>retorno {formatarData(tramite.dataRetorno)}</span>}
                    {tramite.comApresentacao && <span>com apresentação</span>}
                    {tramite.assinado && <span>assinado</span>}
                  </p>
                  {tramite.posicao && <p className="text-sm font-medium text-foreground">{tramite.posicao}</p>}
                  {tramite.acao && <p className="text-sm text-mid-grey">{tramite.acao}</p>}
                  {tramite.observacao && <p className="text-xs text-mid-grey">{tramite.observacao}</p>}
                </div>
                <div className="flex items-center gap-3 text-xs">
                  {confirmandoExclusao === tramite.id ? (
                    <>
                      <span className="font-medium text-red-crit">Excluir?</span>
                      <button type="button" onClick={() => handleExcluir(tramite.id)} className={LINK_DANGER}>
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
                      <button type="button" onClick={() => abrirFormulario(tramite)} className={BTN_OUTLINE_SM}>
                        Editar
                      </button>
                      <button type="button" onClick={() => setConfirmandoExclusao(tramite.id)} className={LINK_DANGER}>
                        Excluir
                      </button>
                    </>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
