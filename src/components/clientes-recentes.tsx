'use client'

// "Clientes recentes" no menu lateral: os últimos clientes abertos neste navegador, para trocar de um
// cliente para outro sem voltar à lista. A ficha registra (`registrarClienteRecente`); a navegação DENTRO
// do cliente fica só nas abas da ficha — o menu não repete as abas.
// Guardado em localStorage: é conveniência de quem usa, não dado do sistema. Falha de storage = lista vazia.

import { useEffect, useState } from 'react'
import Link from 'next/link'
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
    <div className="mt-1 ml-[19px] flex flex-col gap-px border-l border-white/[0.10] pl-2.5">
      <span className="px-3 pt-1 pb-0.5 text-[11px] font-medium text-white/50">Recentes</span>
      {recentes.map((c) => {
        const ativo = aberto === c.id
        // A sigla é como a equipe chama o cliente; o nome inteiro vai no balão. Sem sigla, o nome.
        const rotulo = c.sigla?.trim() || c.nome
        return (
          <Link
            key={c.id}
            href={`/clientes/${c.id}`}
            title={c.nome}
            aria-label={c.sigla?.trim() ? `${c.sigla.trim()} · ${c.nome}` : c.nome}
            aria-current={ativo ? 'page' : undefined}
            className={cn(
              'relative flex h-8 min-w-0 items-center rounded-md pr-2 pl-3 text-[13.5px] text-light-blue/75 transition-colors',
              'hover:bg-white/[0.05] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange/60',
              ativo && 'bg-white/[0.06] font-semibold text-white'
            )}
          >
            {ativo && <span className="absolute top-1/2 -left-[13px] size-[7px] -translate-y-1/2 rounded-full bg-orange ring-[3px] ring-navy" aria-hidden />}
            <span className="truncate">{rotulo}</span>
          </Link>
        )
      })}
    </div>
  )
}
