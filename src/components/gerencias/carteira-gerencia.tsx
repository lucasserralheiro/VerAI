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

type ClienteAdicionavel = ClienteCarteira & { gerencia?: { id: string; nome: string } | null }

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
  const [todos, setTodos] = useState<ClienteAdicionavel[]>([])
  const [selecionados, setSelecionados] = useState<string[]>([])
  const [busca, setBusca] = useState('')
  const [confirmando, setConfirmando] = useState(false)

  async function abrir() {
    onErro(null)
    const resposta = await fetch('/api/clientes')
    if (!resposta.ok) return onErro(await erroDaResposta(resposta, 'Falha ao carregar clientes.'))
    const lista = (await resposta.json()) as ClienteAdicionavel[]
    const naCarteira = new Set(carteira.map((c) => c.id))
    setTodos(lista.filter((c) => !naCarteira.has(c.id)))
    setSelecionados([])
    setBusca('')
    setConfirmando(false)
    setAberta(true)
  }

  const deOutraGerencia = todos.filter((c) => selecionados.includes(c.id) && c.gerencia && c.gerencia.id !== gerenciaId)

  async function mover() {
    if (await moverCarteira(selecionados, gerenciaId, onErro)) {
      setAberta(false)
      setConfirmando(false)
      onMudou()
    }
  }

  function adicionar() {
    if (selecionados.length === 0) return
    if (deOutraGerencia.length > 0) return setConfirmando(true)
    void mover()
  }

  async function tirar(id: string) {
    onErro(null)
    if (await moverCarteira([id], null, onErro)) onMudou()
  }

  const opcoes = todos.map((c) => ({
    ...c,
    rotulo: c.gerencia ? `está na ${c.gerencia.nome} — mover para cá` : undefined,
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
            onAlternar={(id) => {
              setConfirmando(false)
              setSelecionados((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
            }}
            busca={busca}
            onBusca={setBusca}
          />
          {confirmando ? (
            <div role="alert" className="space-y-2 rounded-lg border border-orange/30 bg-orange/5 px-3 py-2 text-sm text-navy">
              <p>
                {deOutraGerencia.length} cliente(s) sairão de outra gerência:{' '}
                {deOutraGerencia.map((c) => `${c.siglaLegado ?? c.nome} (${c.gerencia?.nome})`).join(', ')}.
              </p>
              <div className="flex gap-2">
                <button type="button" onClick={mover} className={BTN_PRIMARY}>
                  Confirmar mudança
                </button>
                <button type="button" onClick={() => setConfirmando(false)} className={BTN_OUTLINE_SM}>
                  Cancelar mudança
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <button type="button" onClick={adicionar} disabled={selecionados.length === 0} className={`${BTN_PRIMARY} disabled:opacity-40`}>
                Adicionar à carteira
              </button>
              <button type="button" onClick={() => setAberta(false)} className={BTN_OUTLINE_SM}>
                Cancelar
              </button>
            </div>
          )}
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
