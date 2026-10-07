'use client'

// "Clientes recentes" no menu lateral: os últimos clientes abertos neste navegador, para trocar de um
// cliente para outro sem voltar à lista. A ficha registra (`registrarClienteRecente`); a navegação DENTRO
// do cliente fica só nas abas da ficha — o menu não repete as abas.
// Guardado em localStorage: é conveniência de quem usa, não dado do sistema. Falha de storage = lista vazia.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { History } from 'lucide-react'
import { cn } from '@/lib/utils'

const CHAVE = 'verai:clientes-recentes'
const EVENTO = 'verai:clientes-recentes'
const MAXIMO = 5

export interface ClienteRecente {
  id: string
  nome: string
  sigla: string | null
}

function ler(): ClienteRecente[] {
  try {
    const lista = JSON.parse(localStorage.getItem(CHAVE) ?? '[]')
    return Array.isArray(lista) ? lista.filter((c) => c && typeof c.id === 'string' && typeof c.nome === 'string').slice(0, MAXIMO) : []
  } catch {
    return []
  }
}

/** Põe o cliente no topo da lista (sem repetir) e avisa o menu. */
export function registrarClienteRecente(cliente: ClienteRecente) {
  try {
    const lista = [cliente, ...ler().filter((c) => c.id !== cliente.id)].slice(0, MAXIMO)
    localStorage.setItem(CHAVE, JSON.stringify(lista))
    window.dispatchEvent(new Event(EVENTO))
  } catch {
    // sem storage (aba anônima, bloqueio): o menu só não mostra recentes
  }
}

/** Id do cliente quando a rota é a ficha ou uma página dentro dela; `null` fora. */
export function clienteDaRota(pathname: string): string | null {
  const m = /^\/clientes\/([^/]+)/.exec(pathname)
  return m ? decodeURIComponent(m[1]) : null
}

export function ClientesRecentes({ pathname, expandida }: { pathname: string; expandida: boolean }) {
  const [recentes, setRecentes] = useState<ClienteRecente[]>([])

  useEffect(() => {
    const atualizar = () => setRecentes(ler())
    atualizar()
    window.addEventListener(EVENTO, atualizar)
    window.addEventListener('storage', atualizar)
    return () => {
      window.removeEventListener(EVENTO, atualizar)
      window.removeEventListener('storage', atualizar)
    }
  }, [])

  // Recolhida, a barra só tem ícones — siglas soltas não ajudam; os recentes aparecem com a barra aberta.
  if (!expandida || recentes.length === 0) return null
  const aberto = clienteDaRota(pathname)

  return (
    <div className="mt-2 flex flex-col gap-px">
      <span className="flex items-center gap-1.5 px-2.5 pb-1 text-[11px] font-medium text-white/35">
        <History className="size-3" strokeWidth={2.25} />
        Recentes
      </span>
      {recentes.map((c) => {
        const ativo = aberto === c.id
        return (
          <Link
            key={c.id}
            href={`/clientes/${c.id}`}
            title={c.nome}
            aria-current={ativo ? 'page' : undefined}
            className={cn(
              'flex h-8 min-w-0 items-center gap-2 rounded-lg pr-2 pl-2 text-[12.5px] text-light-blue/80 transition-colors hover:bg-white/[0.06] hover:text-white',
              ativo && 'bg-white/[0.08] text-white'
            )}
          >
            <span
              className={cn(
                'flex h-5 min-w-10 shrink-0 items-center justify-center rounded-md px-1 text-[9.5px] font-bold tracking-wide',
                ativo ? 'bg-orange text-white' : 'bg-white/[0.08] text-white/70'
              )}
            >
              {(c.sigla ?? c.nome.slice(0, 3)).slice(0, 6).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1 truncate">{c.nome}</span>
          </Link>
        )
      })}
    </div>
  )
}
