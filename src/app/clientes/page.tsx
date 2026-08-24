'use client'

import { useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { ChevronRight, Loader2, Inbox, Plus, AlertCircle, X } from 'lucide-react'
import { BTN_PRIMARY, BTN_OUTLINE, INPUT_BASE } from '@/lib/ui'

interface Cliente {
  id: string
  nome: string
}

interface UsuarioLogado {
  id: string
  role: string
}

function FormularioNovoCliente({
  nome,
  onChangeNome,
  onSubmit,
  erro,
  aoFechar,
}: {
  nome: string
  onChangeNome: (valor: string) => void
  onSubmit: (event: FormEvent) => void
  erro: string | null
  aoFechar?: () => void
}) {
  return (
    <form onSubmit={onSubmit} className="flex w-full flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs font-medium text-mid-grey">Nome</span>
        <input
          type="text"
          value={nome}
          onChange={(e) => onChangeNome(e.target.value)}
          required
          className={INPUT_BASE}
        />
      </label>
      <button type="submit" className={BTN_PRIMARY}>
        <Plus className="size-3.5" strokeWidth={2.25} />
        Criar cliente
      </button>
      {aoFechar && (
        <button
          type="button"
          onClick={aoFechar}
          aria-label="Fechar"
          className="ml-auto flex items-center gap-1 text-sm font-medium text-mid-grey hover:text-navy"
        >
          <X className="size-4" strokeWidth={2.25} />
        </button>
      )}
      {erro && (
        <p className="flex w-full items-center gap-1.5 rounded-lg bg-red-crit-light px-3 py-2 text-sm text-red-crit">
          <AlertCircle className="size-4 shrink-0" strokeWidth={2.25} />
          {erro}
        </p>
      )}
    </form>
  )
}

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [carregando, setCarregando] = useState(true)
  const [usuario, setUsuario] = useState<UsuarioLogado | null>(null)
  const [abrirFormulario, setAbrirFormulario] = useState(false)
  const [nome, setNome] = useState('')
  const [erro, setErro] = useState<string | null>(null)

  async function carregar() {
    const response = await fetch('/api/clientes')
    if (response.ok) setClientes(await response.json())
  }

  useEffect(() => {
    carregar().finally(() => setCarregando(false))
  }, [])

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then(setUsuario)
      .catch(() => {})
  }, [])

  async function handleCriar(event: FormEvent) {
    event.preventDefault()
    setErro(null)
    const response = await fetch('/api/admin/clientes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome }),
    })
    if (!response.ok) {
      const body = await response.json().catch(() => null)
      setErro(body?.error ?? 'Falha ao criar cliente.')
      return
    }
    setNome('')
    setAbrirFormulario(false)
    carregar()
  }

  const ehAdmin = usuario?.role === 'admin'

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-6 py-8 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <span className="text-xs font-semibold tracking-wide text-orange uppercase">Painel</span>
          <h1 className="text-[1.75rem] leading-tight font-semibold tracking-tight text-navy">
            Relatórios dos clientes
          </h1>
        </div>

        {ehAdmin && !abrirFormulario && clientes.length > 0 && (
          <button
            onClick={() => {
              setErro(null)
              setAbrirFormulario(true)
            }}
            className={BTN_OUTLINE}
          >
            <Plus className="size-3.5" strokeWidth={2.25} />
            Novo cliente
          </button>
        )}
      </div>

      {ehAdmin && abrirFormulario && clientes.length > 0 && (
        <div className="card">
          <FormularioNovoCliente
            nome={nome}
            onChangeNome={setNome}
            onSubmit={handleCriar}
            erro={erro}
            aoFechar={() => {
              setErro(null)
              setAbrirFormulario(false)
            }}
          />
        </div>
      )}

      {carregando ? (
        <p className="flex items-center gap-2 text-sm text-mid-grey">
          <Loader2 className="size-4 animate-spin" strokeWidth={2.25} />
          Carregando...
        </p>
      ) : clientes.length === 0 ? (
        ehAdmin ? (
          <div className="card-flush flex flex-col items-center gap-3 p-10 text-center">
            <span className="flex size-11 items-center justify-center rounded-full bg-light-grey text-mid-grey">
              <Inbox className="size-5" strokeWidth={1.75} />
            </span>
            <p className="text-sm text-mid-grey">Nenhum cliente cadastrado ainda.</p>
            <div className="w-full max-w-sm">
              <FormularioNovoCliente nome={nome} onChangeNome={setNome} onSubmit={handleCriar} erro={erro} />
            </div>
          </div>
        ) : (
          <div className="card-flush flex flex-col items-center gap-2 p-10 text-center">
            <span className="flex size-11 items-center justify-center rounded-full bg-light-grey text-mid-grey">
              <Inbox className="size-5" strokeWidth={1.75} />
            </span>
            <p className="text-sm text-mid-grey">
              Nenhum cliente disponível. Peça a um admin pra cadastrar em /admin/clientes e liberar acesso.
            </p>
          </div>
        )
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {clientes.map((cliente) => (
            <li key={cliente.id}>
              <Link
                href={`/clientes/${cliente.id}`}
                className="card card-interactive group flex items-center gap-3"
              >
                <span className="flex-1 text-sm font-semibold text-navy">{cliente.nome}</span>
                <ChevronRight
                  className="size-4 text-mid-grey transition-transform group-hover:translate-x-0.5 group-hover:text-orange"
                  strokeWidth={2.25}
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
