'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { AlertCircle, Loader2, Mail, Phone, Plus, Smartphone, Users } from 'lucide-react'
import { BTN_OUTLINE, BTN_OUTLINE_SM, BTN_PRIMARY, INPUT_BASE, LINK_DANGER } from '@/lib/ui'

interface Responsavel {
  id: string
  nome: string
  area: string | null
  email: string | null
  telefone: string | null
  celular: string | null
}

type Formulario = Record<'nome' | 'area' | 'email' | 'telefone' | 'celular', string>

const FORMULARIO_VAZIO: Formulario = { nome: '', area: '', email: '', telefone: '', celular: '' }

const CAMPOS: Array<{ campo: keyof Formulario; rotulo: string; tipo?: string }> = [
  { campo: 'nome', rotulo: 'Nome' },
  { campo: 'area', rotulo: 'Área' },
  { campo: 'email', rotulo: 'E-mail', tipo: 'email' },
  { campo: 'telefone', rotulo: 'Telefone' },
  { campo: 'celular', rotulo: 'Celular' },
]

export function AbaResponsaveis({ clienteId }: { clienteId: string }) {
  const [responsaveis, setResponsaveis] = useState<Responsavel[]>([])
  const [carregando, setCarregando] = useState(true)
  // null = formulário fechado; 'novo' = criando; id = editando aquele responsável
  const [editando, setEditando] = useState<string | null>(null)
  const [formulario, setFormulario] = useState<Formulario>(FORMULARIO_VAZIO)
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [confirmandoExclusao, setConfirmandoExclusao] = useState<string | null>(null)

  async function carregar() {
    const response = await fetch(`/api/clientes/${clienteId}/responsaveis`)
    if (response.ok) setResponsaveis(await response.json())
  }

  useEffect(() => {
    carregar().finally(() => setCarregando(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteId])

  function abrirFormulario(responsavel?: Responsavel) {
    setErro(null)
    setEditando(responsavel?.id ?? 'novo')
    setFormulario(
      responsavel
        ? {
            nome: responsavel.nome,
            area: responsavel.area ?? '',
            email: responsavel.email ?? '',
            telefone: responsavel.telefone ?? '',
            celular: responsavel.celular ?? '',
          }
        : FORMULARIO_VAZIO
    )
  }

  async function handleSalvar(event: FormEvent) {
    event.preventDefault()
    setErro(null)
    setSalvando(true)
    const criando = editando === 'novo'
    const response = await fetch(criando ? `/api/clientes/${clienteId}/responsaveis` : `/api/responsaveis/${editando}`, {
      method: criando ? 'POST' : 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formulario),
    }).finally(() => setSalvando(false))
    if (!response.ok) {
      const body = await response.json().catch(() => null)
      setErro(body?.error ?? 'Falha ao salvar responsável.')
      return
    }
    setEditando(null)
    await carregar()
  }

  async function handleExcluir(id: string) {
    setConfirmandoExclusao(null)
    const response = await fetch(`/api/responsaveis/${id}`, { method: 'DELETE' })
    if (response.ok) await carregar()
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
          <h2 className="text-[0.95rem] font-semibold text-navy">Responsáveis de contato</h2>
          <p className="text-xs text-mid-grey">Ponto focal do cliente para essa conta</p>
        </div>
        {editando === null && (
          <button onClick={() => abrirFormulario()} className={BTN_PRIMARY}>
            <Plus className="size-3.5" strokeWidth={2.25} />
            Novo responsável
          </button>
        )}
      </div>

      {editando !== null && (
        <form onSubmit={handleSalvar} className="card space-y-3">
          <h3 className="text-sm font-semibold text-navy">
            {editando === 'novo' ? 'Novo responsável' : 'Editar responsável'}
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {CAMPOS.map(({ campo, rotulo, tipo }) => (
              <label key={campo} className="flex flex-col gap-1 text-sm">
                <span className="text-xs font-medium text-mid-grey">{rotulo}</span>
                <input
                  type={tipo ?? 'text'}
                  value={formulario[campo]}
                  onChange={(e) => setFormulario((atual) => ({ ...atual, [campo]: e.target.value }))}
                  required={campo === 'nome'}
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

      {responsaveis.length === 0 ? (
        <div className="card-flush flex flex-col items-center gap-2 p-10 text-center">
          <span className="flex size-11 items-center justify-center rounded-full bg-light-grey text-mid-grey">
            <Users className="size-5" strokeWidth={1.75} />
          </span>
          <p className="text-sm text-mid-grey">Nenhum responsável cadastrado.</p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {responsaveis.map((responsavel) => (
            <li key={responsavel.id} className="card flex flex-col gap-1">
              <span className="text-sm font-semibold text-navy">{responsavel.nome}</span>
              {responsavel.area && <span className="text-xs text-mid-grey">{responsavel.area}</span>}
              {[
                { valor: responsavel.email, Icone: Mail },
                { valor: responsavel.telefone, Icone: Phone },
                { valor: responsavel.celular, Icone: Smartphone },
              ].map(
                ({ valor, Icone }, i) =>
                  valor && (
                    <span key={i} className="mt-1 flex items-center gap-1.5 text-xs break-all text-mid-grey">
                      <Icone className="size-3.5 shrink-0" strokeWidth={2} />
                      {valor}
                    </span>
                  )
              )}
              <div className="mt-3 flex items-center gap-3 text-xs">
                {confirmandoExclusao === responsavel.id ? (
                  <>
                    <span className="font-medium text-red-crit">Excluir?</span>
                    <button onClick={() => handleExcluir(responsavel.id)} className={LINK_DANGER}>
                      Sim
                    </button>
                    <button
                      onClick={() => setConfirmandoExclusao(null)}
                      className="font-medium text-mid-grey hover:text-navy hover:underline"
                    >
                      Não
                    </button>
                  </>
                ) : (
                  <>
                    <button onClick={() => abrirFormulario(responsavel)} className={BTN_OUTLINE_SM}>
                      Editar
                    </button>
                    <button onClick={() => setConfirmandoExclusao(responsavel.id)} className={LINK_DANGER}>
                      Excluir
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
