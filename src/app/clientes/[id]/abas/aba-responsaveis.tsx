'use client'

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { fetchComPreCarga } from '@/lib/relatorios-clientes/prefetch'
import { AlertCircle, Loader2, Mail, Phone, Plus, Search, Smartphone, Trash2, Users } from 'lucide-react'
import { BTN_OUTLINE, BTN_PRIMARY, INPUT_BASE, LINK_DANGER } from '@/lib/ui'

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
  const [busca, setBusca] = useState('')
  // 'novo' = criando um responsável; um Responsavel = editando aquele card; null = modal fechado.
  const [modalResponsavel, setModalResponsavel] = useState<'novo' | Responsavel | null>(null)

  async function carregar() {
    const response = await fetchComPreCarga(`/api/clientes/${clienteId}/responsaveis`)
    if (response.ok) setResponsaveis(await response.json())
  }

  useEffect(() => {
    carregar().finally(() => setCarregando(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteId])

  const responsaveisFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    if (!termo) return responsaveis
    return responsaveis.filter((responsavel) =>
      [responsavel.nome, responsavel.area, responsavel.email, responsavel.telefone, responsavel.celular].some((campo) =>
        campo?.toLowerCase().includes(termo)
      )
    )
  }, [responsaveis, busca])

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
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative">
            <span className="sr-only">Buscar responsável</span>
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-mid-grey" strokeWidth={2.25} />
            <input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome, área, e-mail..."
              className={`${INPUT_BASE} w-64 py-1.5 pl-8 text-sm`}
            />
          </label>
          <button type="button" onClick={() => setModalResponsavel('novo')} className={BTN_PRIMARY}>
            <Plus className="size-3.5" strokeWidth={2.25} />
            Novo responsável
          </button>
        </div>
      </div>

      {responsaveis.length === 0 ? (
        <div className="card-flush flex flex-col items-center gap-2 p-10 text-center">
          <span className="flex size-11 items-center justify-center rounded-full bg-light-grey text-mid-grey">
            <Users className="size-5" strokeWidth={1.75} />
          </span>
          <p className="text-sm text-mid-grey">Nenhum responsável cadastrado.</p>
        </div>
      ) : responsaveisFiltrados.length === 0 ? (
        <div className="card-flush flex flex-col items-center gap-2 p-10 text-center">
          <span className="flex size-11 items-center justify-center rounded-full bg-light-grey text-mid-grey">
            <Search className="size-5" strokeWidth={1.75} />
          </span>
          <p className="text-sm text-mid-grey">Nenhum responsável encontrado para &quot;{busca}&quot;.</p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {responsaveisFiltrados.map((responsavel) => (
            <li
              key={responsavel.id}
              onClick={() => setModalResponsavel(responsavel)}
              className="card flex cursor-pointer flex-col gap-1"
            >
              <span className="text-sm font-semibold text-navy">{responsavel.nome}</span>
              {responsavel.area && <span className="text-xs text-mid-grey">{responsavel.area}</span>}
              {responsavel.email && (
                <a
                  href={`mailto:${responsavel.email}`}
                  onClick={(e) => e.stopPropagation()}
                  className="mt-1 flex items-center gap-1.5 text-xs break-all text-mid-grey hover:text-orange hover:underline"
                >
                  <Mail className="size-3.5 shrink-0" strokeWidth={2} />
                  {responsavel.email}
                </a>
              )}
              {responsavel.telefone && (
                <a
                  href={`tel:${responsavel.telefone}`}
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-1.5 text-xs break-all text-mid-grey hover:text-orange hover:underline"
                >
                  <Phone className="size-3.5 shrink-0" strokeWidth={2} />
                  {responsavel.telefone}
                </a>
              )}
              {responsavel.celular && (
                <a
                  href={`tel:${responsavel.celular}`}
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-1.5 text-xs break-all text-mid-grey hover:text-orange hover:underline"
                >
                  <Smartphone className="size-3.5 shrink-0" strokeWidth={2} />
                  {responsavel.celular}
                </a>
              )}
            </li>
          ))}
        </ul>
      )}

      <ModalResponsavel
        estado={modalResponsavel}
        clienteId={clienteId}
        aoFechar={() => setModalResponsavel(null)}
        aoSalvar={async () => {
          setModalResponsavel(null)
          await carregar()
        }}
        aoExcluir={async () => {
          setModalResponsavel(null)
          await carregar()
        }}
      />
    </div>
  )
}

/** Modal nativo (`<dialog>` + `showModal()`) reaproveitando o mesmo formulário pra criar E
 *  editar — mesmo padrão do modal de contratos em `aba-contratos.tsx`. */
function ModalResponsavel({
  estado,
  clienteId,
  aoFechar,
  aoSalvar,
  aoExcluir,
}: {
  estado: 'novo' | Responsavel | null
  clienteId: string
  aoFechar: () => void
  aoSalvar: () => void
  aoExcluir: () => void
}) {
  const dialogoRef = useRef<HTMLDialogElement>(null)
  const responsavel = estado === 'novo' ? undefined : (estado ?? undefined)
  const aberto = estado !== null

  useEffect(() => {
    const el = dialogoRef.current
    if (!el) return
    if (aberto && !el.open) {
      el.showModal()
    } else if (!aberto && el.open) {
      el.close()
    }
  }, [aberto])

  return (
    <dialog
      ref={dialogoRef}
      onClose={aoFechar}
      onClick={(e) => {
        if (e.target === dialogoRef.current) dialogoRef.current?.close()
      }}
      aria-label={responsavel ? 'Editar responsável' : 'Novo responsável'}
      className="w-[min(32rem,calc(100vw-2rem))] border-0 bg-transparent p-0"
    >
      {aberto && (
        <ConteudoModalResponsavel
          key={responsavel?.id ?? 'novo'}
          clienteId={clienteId}
          responsavel={responsavel}
          aoSalvar={aoSalvar}
          aoExcluir={aoExcluir}
          aoCancelar={() => dialogoRef.current?.close()}
        />
      )}
    </dialog>
  )
}

function ConteudoModalResponsavel({
  clienteId,
  responsavel,
  aoSalvar,
  aoExcluir,
  aoCancelar,
}: {
  clienteId: string
  responsavel: Responsavel | undefined
  aoSalvar: () => void
  aoExcluir: () => void
  aoCancelar: () => void
}) {
  const [formulario, setFormulario] = useState<Formulario>(
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
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false)
  const [excluindo, setExcluindo] = useState(false)
  const [erroExclusao, setErroExclusao] = useState<string | null>(null)

  async function handleSalvar(event: FormEvent) {
    event.preventDefault()
    setErro(null)
    setSalvando(true)
    const criando = !responsavel
    try {
      const response = await fetch(
        criando ? `/api/clientes/${clienteId}/responsaveis` : `/api/responsaveis/${responsavel.id}`,
        {
          method: criando ? 'POST' : 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formulario),
        }
      )
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        setErro(body?.error ?? 'Falha ao salvar responsável.')
        return
      }
      aoSalvar()
    } catch {
      setErro('Falha de conexão ao salvar responsável.')
    } finally {
      setSalvando(false)
    }
  }

  async function handleExcluir() {
    if (!responsavel) return
    setExcluindo(true)
    setErroExclusao(null)
    try {
      const response = await fetch(`/api/responsaveis/${responsavel.id}`, { method: 'DELETE' })
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        setErroExclusao(body?.error ?? 'Falha ao excluir o responsável.')
        setConfirmandoExclusao(false)
        return
      }
      aoExcluir()
    } catch {
      setErroExclusao('Falha de conexão ao excluir o responsável.')
      setConfirmandoExclusao(false)
    } finally {
      setExcluindo(false)
    }
  }

  return (
    <form onSubmit={handleSalvar} className="card space-y-3">
      <h3 className="text-sm font-semibold text-navy">{responsavel ? 'Editar responsável' : 'Novo responsável'}</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
        <button type="button" onClick={aoCancelar} className={BTN_OUTLINE}>
          Cancelar
        </button>
      </div>

      {responsavel && (
        <div className="space-y-2 border-t border-border-grey pt-3">
          <div className="flex items-center justify-between gap-3">
            {confirmandoExclusao ? (
              <span className="flex items-center gap-2 text-xs">
                <span className="font-medium text-red-crit">Excluir este responsável?</span>
                <button type="button" disabled={excluindo} onClick={handleExcluir} className={LINK_DANGER}>
                  Sim
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmandoExclusao(false)}
                  className="font-medium text-mid-grey hover:text-navy hover:underline"
                >
                  Não
                </button>
              </span>
            ) : (
              <button type="button" onClick={() => setConfirmandoExclusao(true)} className={`${LINK_DANGER} text-xs`}>
                <Trash2 className="size-3.5" strokeWidth={2.25} />
                Excluir responsável
              </button>
            )}
          </div>
          {erroExclusao && (
            <p className="flex items-center gap-1.5 rounded-lg bg-red-crit-light px-3 py-2 text-xs text-red-crit">
              <AlertCircle className="size-3.5 shrink-0" strokeWidth={2.25} />
              {erroExclusao}
            </p>
          )}
        </div>
      )}
    </form>
  )
}
