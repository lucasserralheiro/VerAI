'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Network, Plus } from 'lucide-react'
import type { ClienteCarteira, GerenciaResumo } from '@/lib/gerencias/tipos'
import { BTN_PRIMARY, INPUT_BASE, LINK_NAVY } from '@/lib/ui'
import { ClientesSelecionaveis, MensagemErro, erroDaResposta } from '@/components/gerencias/comum'

export default function AdminGerenciasPage() {
  const [gerencias, setGerencias] = useState<GerenciaResumo[]>([])
  const [semGerencia, setSemGerencia] = useState(0)
  const [erro, setErro] = useState<string | null>(null)
  const [nome, setNome] = useState('')
  const [sigla, setSigla] = useState('')
  const [soltosAbertos, setSoltosAbertos] = useState(false)
  const [soltos, setSoltos] = useState<ClienteCarteira[]>([])
  const [selecionados, setSelecionados] = useState<string[]>([])
  const [busca, setBusca] = useState('')
  const [destino, setDestino] = useState('')

  const carregar = useCallback(async () => {
    const resposta = await fetch('/api/admin/gerencias')
    if (!resposta.ok) return setErro(await erroDaResposta(resposta, 'Falha ao carregar as gerências.'))
    const corpo = await resposta.json()
    setGerencias(corpo.gerencias)
    setSemGerencia(corpo.semGerencia)
  }, [])

  const carregarSoltos = useCallback(async () => {
    const resposta = await fetch('/api/admin/gerencias/sem-gerencia')
    if (!resposta.ok) return setErro(await erroDaResposta(resposta, 'Falha ao carregar os clientes.'))
    setSoltos(await resposta.json())
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  async function criar(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    const resposta = await fetch('/api/admin/gerencias', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome, sigla: sigla.trim() || undefined }),
    })
    if (!resposta.ok) return setErro(await erroDaResposta(resposta, 'Falha ao criar a gerência.'))
    setNome('')
    setSigla('')
    carregar()
  }

  async function alternarSoltos() {
    if (!soltosAbertos) await carregarSoltos()
    setSoltosAbertos(!soltosAbertos)
  }

  async function mover() {
    if (!destino || selecionados.length === 0) return
    setErro(null)
    const resposta = await fetch('/api/admin/gerencias/carteira', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clienteIds: selecionados, gerenciaId: destino }),
    })
    if (!resposta.ok) return setErro(await erroDaResposta(resposta, 'Falha ao mover clientes.'))
    setSelecionados([])
    await Promise.all([carregar(), carregarSoltos()])
  }

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-6 py-8 lg:px-8">
      <div className="flex items-center gap-2">
        <Network className="size-5 text-orange" strokeWidth={2.25} />
        <h1 className="text-2xl font-bold text-navy">Gerências e carteiras</h1>
      </div>

      <form onSubmit={criar} className="card flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium text-mid-grey">Nome</span>
          <input value={nome} onChange={(e) => setNome(e.target.value)} required className={INPUT_BASE} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium text-mid-grey">Sigla</span>
          <input value={sigla} onChange={(e) => setSigla(e.target.value)} className={INPUT_BASE} />
        </label>
        <button type="submit" className={BTN_PRIMARY}>
          <Plus className="size-3.5" strokeWidth={2.25} />
          Criar gerência
        </button>
      </form>
      <MensagemErro erro={erro} />

      <div className="card-flush">
        <div className="overflow-x-auto">
          <table className="table-institucional">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Sigla</th>
                <th>Clientes</th>
                <th>Managers</th>
                <th>Situação</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {gerencias.map((g) => (
                <tr key={g.id}>
                  <td className="font-medium text-navy">{g.nome}</td>
                  <td className="text-mid-grey">{g.sigla ?? '—'}</td>
                  <td className="text-mid-grey">{g.clientes}</td>
                  <td className="text-mid-grey">{g.managers.join(', ') || '—'}</td>
                  <td className="text-mid-grey">{g.ativa ? 'Ativa' : 'Desativada'}</td>
                  <td>
                    <Link href={`/admin/gerencias/${g.id}`} className={LINK_NAVY}>
                      Abrir
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <section className="card space-y-3">
        <button type="button" onClick={alternarSoltos} className="text-left text-lg font-semibold text-navy">
          Clientes sem gerência ({semGerencia})
        </button>
        {soltosAbertos && (
          <div className="space-y-3">
            <ClientesSelecionaveis
              clientes={soltos}
              selecionados={selecionados}
              onAlternar={(id) => setSelecionados((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))}
              busca={busca}
              onBusca={setBusca}
            />
            <div className="flex flex-wrap items-end gap-3">
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-xs font-medium text-mid-grey">Mover para</span>
                <select value={destino} onChange={(e) => setDestino(e.target.value)} className={INPUT_BASE}>
                  <option value="">Selecione...</option>
                  {gerencias
                    .filter((g) => g.ativa)
                    .map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.nome}
                      </option>
                    ))}
                </select>
              </label>
              <button
                type="button"
                onClick={mover}
                disabled={!destino || selecionados.length === 0}
                className={`${BTN_PRIMARY} disabled:opacity-40`}
              >
                Mover
              </button>
            </div>
          </div>
        )}
      </section>
    </main>
  )
}
