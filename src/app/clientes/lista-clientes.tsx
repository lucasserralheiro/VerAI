'use client'

// Implementação da lista de clientes. Fica fora do page.tsx enquanto a tela
// está marcada como "em desenvolvimento" — quando for liberar, é só trocar
// a flag EM_DESENVOLVIMENTO em ./page.tsx.

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronRight, Loader2, Inbox, Plus, Search } from 'lucide-react'
import { BTN_OUTLINE, INPUT_BASE } from '@/lib/ui'
import { ModalCliente } from './modal-cliente'

interface Cliente {
  id: string
  nome: string
  siglaLegado?: string | null
}

interface UsuarioLogado {
  id: string
  role: string
}

// Normaliza pra busca: minúsculas e sem acentos ("gestao" encontra "GESTÃO").
function normalizar(texto: string) {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

export function ListaClientes() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [carregando, setCarregando] = useState(true)
  const [usuario, setUsuario] = useState<UsuarioLogado | null>(null)
  const [modalAberto, setModalAberto] = useState(false)
  const [busca, setBusca] = useState('')

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

  const ehAdmin = usuario?.role === 'admin'

  const clientesFiltrados = useMemo(() => {
    const termo = normalizar(busca)
    if (!termo) return clientes
    return clientes.filter(
      (c) => normalizar(c.nome).includes(termo) || normalizar(c.siglaLegado ?? '').includes(termo),
    )
  }, [clientes, busca])

  return (
    <main className="mx-auto max-w-[110rem] space-y-6 px-6 py-8 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <span className="text-xs font-semibold tracking-wide text-orange uppercase">Painel</span>
          <h1 className="text-[1.75rem] leading-tight font-semibold tracking-tight text-navy">
            Relatórios dos clientes
          </h1>
        </div>

        {ehAdmin && (
          <button onClick={() => setModalAberto(true)} className={BTN_OUTLINE}>
            <Plus className="size-3.5" strokeWidth={2.25} />
            Novo cliente
          </button>
        )}
      </div>

      {!carregando && clientes.length > 0 && (
        <div className="relative max-w-md">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-mid-grey"
            strokeWidth={2.25}
          />
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar cliente por nome ou sigla"
            aria-label="Buscar cliente"
            className={`${INPUT_BASE} w-full pl-9`}
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
            <p className="text-sm text-mid-grey">Nenhum cliente cadastrado ainda. Use o botão &ldquo;Novo cliente&rdquo;.</p>
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
      ) : clientesFiltrados.length === 0 ? (
        <div className="card-flush flex flex-col items-center gap-2 p-10 text-center">
          <span className="flex size-11 items-center justify-center rounded-full bg-light-grey text-mid-grey">
            <Search className="size-5" strokeWidth={1.75} />
          </span>
          <p className="text-sm text-mid-grey">Nenhum cliente encontrado para &ldquo;{busca.trim()}&rdquo;.</p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {clientesFiltrados.map((cliente) => (
            <li key={cliente.id}>
              <Link
                href={`/clientes/${cliente.id}`}
                className="card card-interactive group flex items-center gap-3"
              >
                {cliente.siglaLegado && (
                  <span className="shrink-0 rounded-md bg-orange px-2 py-0.5 font-mono text-xs font-semibold tracking-wide text-white">
                    {cliente.siglaLegado}
                  </span>
                )}
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

      {ehAdmin && (
        <ModalCliente
          aberto={modalAberto}
          aoFechar={() => setModalAberto(false)}
          aoSalvar={() => {
            setModalAberto(false)
            setBusca('')
            carregar()
          }}
        />
      )}
    </main>
  )
}
