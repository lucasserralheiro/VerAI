'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Check, Loader2, Network, Pencil, Plus, X } from 'lucide-react'
import type { ClienteCarteira, GerenciaResumo } from '@/lib/gerencias/tipos'
import { BTN_OUTLINE_SM, BTN_PRIMARY, INPUT_BASE, LINK_NAVY } from '@/lib/ui'
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
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [nomeEdit, setNomeEdit] = useState('')
  const [siglaEdit, setSiglaEdit] = useState('')
  const [salvando, setSalvando] = useState(false)

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

  function editar(g: GerenciaResumo) {
    setErro(null)
    setEditandoId(g.id)
    setNomeEdit(g.nome)
    setSiglaEdit(g.sigla ?? '')
  }

  async function alterar(id: string, corpo: { nome?: string; sigla?: string | null; ativa?: boolean }) {
    setErro(null)
    setSalvando(true)
    try {
      const resposta = await fetch(`/api/admin/gerencias/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corpo),
      })
      if (!resposta.ok) {
        setErro(await erroDaResposta(resposta, 'Falha ao alterar a gerência.'))
        return false
      }
      await carregar()
      return true
    } finally {
      setSalvando(false)
    }
  }

  async function salvarEdicao() {
    if (!editandoId || !nomeEdit.trim()) return
    const ok = await alterar(editandoId, { nome: nomeEdit.trim(), sigla: siglaEdit.trim() || null })
    if (ok) setEditandoId(null)
  }

  function teclasDaEdicao(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      salvarEdicao()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setEditandoId(null)
    }
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
              {gerencias.map((g) => {
                const emEdicao = editandoId === g.id
                return (
                  <tr key={g.id} className={emEdicao ? 'bg-orange/[0.04]' : undefined}>
                    <td className="font-medium text-navy">
                      {emEdicao ? (
                        <input
                          autoFocus
                          aria-label="Nome da gerência"
                          value={nomeEdit}
                          onChange={(e) => setNomeEdit(e.target.value)}
                          onKeyDown={teclasDaEdicao}
                          className={`${INPUT_BASE} w-full min-w-40 py-1.5`}
                        />
                      ) : (
                        g.nome
                      )}
                    </td>
                    <td className="text-mid-grey">
                      {emEdicao ? (
                        <input
                          aria-label="Sigla da gerência"
                          value={siglaEdit}
                          onChange={(e) => setSiglaEdit(e.target.value)}
                          onKeyDown={teclasDaEdicao}
                          className={`${INPUT_BASE} w-28 py-1.5`}
                        />
                      ) : (
                        (g.sigla ?? '—')
                      )}
                    </td>
                    <td className="text-mid-grey">{g.clientes}</td>
                    <td className="text-mid-grey">{g.managers.join(', ') || '—'}</td>
                    <td>
                      <button
                        type="button"
                        disabled={salvando}
                        title={g.ativa ? 'Clique para desativar' : 'Clique para reativar'}
                        onClick={() => alterar(g.id, { ativa: !g.ativa })}
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                          g.ativa
                            ? 'bg-green-ok/10 text-green-ok hover:bg-green-ok/20'
                            : 'bg-red-crit/10 text-red-crit hover:bg-red-crit/20'
                        }`}
                      >
                        {g.ativa ? 'Ativa' : 'Desativada'}
                      </button>
                    </td>
                    <td>
                      <div className="flex items-center justify-end gap-2">
                        {emEdicao ? (
                          <>
                            <button
                              type="button"
                              onClick={salvarEdicao}
                              disabled={salvando || !nomeEdit.trim()}
                              className={`${BTN_PRIMARY} py-1 text-xs`}
                            >
                              {salvando ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                              Salvar
                            </button>
                            <button type="button" onClick={() => setEditandoId(null)} className={BTN_OUTLINE_SM}>
                              <X className="size-3.5" />
                              Cancelar
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => editar(g)}
                              aria-label={`Editar ${g.nome}`}
                              title="Editar nome e sigla"
                              className="inline-flex size-8 items-center justify-center rounded-lg text-mid-grey transition-colors hover:bg-navy/[0.06] hover:text-navy"
                            >
                              <Pencil className="size-3.5" />
                            </button>
                            <Link href={`/admin/gerencias/${g.id}`} className={LINK_NAVY}>
                              Abrir
                            </Link>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
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
