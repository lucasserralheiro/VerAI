'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import type { ClienteCarteira } from '@/lib/gerencias/tipos'
import { BTN_OUTLINE_SM, BTN_PRIMARY, LINK_DANGER } from '@/lib/ui'
import { ClientesSelecionaveis, erroDaResposta } from './comum'

interface Props {
  gerenciaId: string
  carteira: ClienteCarteira[]
  modoAdmin: boolean
  onErro: (mensagem: string | null) => void
  onMudou: () => void
}

async function moverCarteira(clienteIds: string[], gerenciaId: string | null, onErro: Props['onErro']) {
  const resposta = await fetch('/api/admin/gerencias/carteira', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clienteIds, gerenciaId }),
  })
  if (!resposta.ok) {
    onErro(await erroDaResposta(resposta, 'Falha ao mover clientes.'))
    return false
  }
  return true
}

export function CarteiraGerencia({ gerenciaId, carteira, modoAdmin, onErro, onMudou }: Props) {
  const [aberta, setAberta] = useState(false)
  const [todos, setTodos] = useState<ClienteCarteira[]>([])
  const [soltos, setSoltos] = useState<string[]>([])
  const [selecionados, setSelecionados] = useState<string[]>([])
  const [busca, setBusca] = useState('')

  async function abrir() {
    onErro(null)
    const [rc, rs] = await Promise.all([fetch('/api/clientes'), fetch('/api/admin/gerencias/sem-gerencia')])
    if (!rc.ok) return onErro(await erroDaResposta(rc, 'Falha ao carregar clientes.'))
    const lista = (await rc.json()) as ClienteCarteira[]
    const semGerencia = rs.ok ? ((await rs.json()) as ClienteCarteira[]) : []
    const naCarteira = new Set(carteira.map((c) => c.id))
    setTodos(lista.filter((c) => !naCarteira.has(c.id)))
    setSoltos(semGerencia.map((c) => c.id))
    setSelecionados([])
    setBusca('')
    setAberta(true)
  }

  async function adicionar() {
    if (selecionados.length === 0) return
    if (await moverCarteira(selecionados, gerenciaId, onErro)) {
      setAberta(false)
      onMudou()
    }
  }

  async function tirar(id: string) {
    onErro(null)
    if (await moverCarteira([id], null, onErro)) onMudou()
  }

  const opcoes = todos.map((c) => ({
    ...c,
    // O nome da outra gerência só chega com a Task 14; por ora o rótulo é genérico.
    rotulo: soltos.includes(c.id) ? undefined : 'está em outra gerência — mover para cá',
  }))

  return (
    <section className="card space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-navy">Carteira ({carteira.length})</h2>
        {modoAdmin && (
          <button type="button" onClick={abrir} className={BTN_OUTLINE_SM}>
            <Plus className="size-3.5" strokeWidth={2.25} />
            Adicionar clientes
          </button>
        )}
      </div>
      {aberta && (
        <div className="space-y-2 rounded-lg border border-line p-3">
          <ClientesSelecionaveis
            clientes={opcoes}
            selecionados={selecionados}
            onAlternar={(id) => setSelecionados((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))}
            busca={busca}
            onBusca={setBusca}
          />
          <div className="flex gap-2">
            <button type="button" onClick={adicionar} disabled={selecionados.length === 0} className={`${BTN_PRIMARY} disabled:opacity-40`}>
              Adicionar à carteira
            </button>
            <button type="button" onClick={() => setAberta(false)} className={BTN_OUTLINE_SM}>
              Cancelar
            </button>
          </div>
        </div>
      )}
      {carteira.length === 0 ? (
        <p className="text-sm text-mid-grey">Nenhum cliente na carteira.</p>
      ) : (
        <ul className="divide-y divide-line text-sm">
          {carteira.map((c) => (
            <li key={c.id} className="flex items-center justify-between py-1.5">
              <span className="text-navy">
                {c.nome} {c.siglaLegado && <span className="text-xs text-mid-grey">{c.siglaLegado}</span>}
              </span>
              {modoAdmin && (
                <button type="button" onClick={() => tirar(c.id)} className={LINK_DANGER}>
                  Tirar da carteira
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
