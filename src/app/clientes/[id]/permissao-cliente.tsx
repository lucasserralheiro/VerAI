'use client'

// Permissão de edição do cliente aberto. A API é quem barra de verdade (403); isto só
// esconde os controles de gravação e mostra de quem é a carteira. Sem provider (componente
// usado fora da ficha), `podeEditar` é true — a API continua barrando.

import { createContext, useContext, useEffect, useState } from 'react'

export interface GerenciaDoCliente {
  id: string
  nome: string
}

interface Permissao {
  carregando: boolean
  podeEditar: boolean
  gerencia: GerenciaDoCliente | null
}

const SEM_PROVIDER: Permissao = { carregando: false, podeEditar: true, gerencia: null }
export const PermissaoContext = createContext<Permissao>(SEM_PROVIDER)

export function PermissaoClienteProvider({ clienteId, children }: { clienteId: string; children: React.ReactNode }) {
  const [valor, setValor] = useState<Permissao>({ carregando: true, podeEditar: false, gerencia: null })

  useEffect(() => {
    let cancelado = false
    setValor({ carregando: true, podeEditar: false, gerencia: null })
    fetch(`/api/clientes/${clienteId}/permissao`)
      .then((r) => (r.ok ? r.json() : null))
      .then((dados) => {
        if (cancelado) return
        setValor({
          carregando: false,
          podeEditar: dados?.podeEditar === true,
          gerencia: dados?.gerencia ?? null,
        })
      })
      .catch(() => {
        if (!cancelado) setValor({ carregando: false, podeEditar: false, gerencia: null })
      })
    return () => {
      cancelado = true
    }
  }, [clienteId])

  return <PermissaoContext.Provider value={valor}>{children}</PermissaoContext.Provider>
}

export function usePermissaoCliente(): Permissao {
  return useContext(PermissaoContext)
}

export function SeloCarteira({ gerencia }: { gerencia: GerenciaDoCliente | null }) {
  const { carregando, gerencia: doContexto } = usePermissaoCliente()
  const g = gerencia ?? doContexto
  if (!g) return carregando ? null : <span className="text-xs text-mid-grey">Sem gerência</span>
  return (
    <span className="rounded-full bg-navy/10 px-2 py-0.5 text-xs font-medium text-navy">Carteira: {g.nome}</span>
  )
}

export function FaixaSomenteLeitura() {
  const { carregando, podeEditar, gerencia } = usePermissaoCliente()
  if (carregando || podeEditar) return null
  return (
    <div role="status" className="border-b border-orange/30 bg-orange/10 px-6 py-2 text-sm text-navy">
      {gerencia
        ? `Somente leitura: este cliente é da ${gerencia.nome}.`
        : 'Somente leitura: cliente sem gerência — só o administrador edita.'}
    </div>
  )
}
