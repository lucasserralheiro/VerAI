'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Network } from 'lucide-react'
import type { GerenciaDetalhe } from '@/lib/gerencias/tipos'
import { BTN_OUTLINE_SM, BTN_PRIMARY, INPUT_BASE } from '@/lib/ui'
import { CarteiraGerencia } from './carteira-gerencia'
import { EquipeGerencia } from './equipe-gerencia'
import { MovimentosGerencia } from './movimentos-gerencia'
import { MensagemErro, erroDaResposta } from './comum'

type Detalhe = GerenciaDetalhe & { podeGerirEquipe: boolean; podeNomearManager: boolean }

export function DetalheGerencia({ gerenciaId, modo }: { gerenciaId: string; modo: 'admin' | 'manager' }) {
  const [dados, setDados] = useState<Detalhe | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [editando, setEditando] = useState(false)
  const [nome, setNome] = useState('')
  const [sigla, setSigla] = useState('')
  const admin = modo === 'admin'

  const carregar = useCallback(async () => {
    const resposta = await fetch(`/api/gerencias/${gerenciaId}`)
    if (!resposta.ok) return setErro(await erroDaResposta(resposta, 'Falha ao carregar a gerência.'))
    setDados(await resposta.json())
  }, [gerenciaId])

  useEffect(() => {
    carregar()
  }, [carregar])

  async function alterar(corpo: { nome?: string; sigla?: string | null; ativa?: boolean }) {
    setErro(null)
    const resposta = await fetch(`/api/admin/gerencias/${gerenciaId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corpo),
    })
    if (!resposta.ok) return setErro(await erroDaResposta(resposta, 'Falha ao alterar a gerência.'))
    setEditando(false)
    carregar()
  }

  function salvar(e: FormEvent) {
    e.preventDefault()
    alterar({ nome, sigla: sigla.trim() || null })
  }

  if (!dados) {
    return (
      <main className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
        {erro ? <MensagemErro erro={erro} /> : <p className="text-sm text-mid-grey">Carregando...</p>}
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-6 py-8 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Network className="size-5 text-orange" strokeWidth={2.25} />
          <h1 className="text-2xl font-bold text-navy">{dados.nome}</h1>
          {dados.sigla && <span className="text-sm text-mid-grey">{dados.sigla}</span>}
          {!dados.ativa && <span className="text-xs text-red-crit">desativada</span>}
        </div>
        {admin && !editando && (
          <div className="flex gap-2">
            <button
              type="button"
              className={BTN_OUTLINE_SM}
              onClick={() => {
                setNome(dados.nome)
                setSigla(dados.sigla ?? '')
                setEditando(true)
              }}
            >
              Renomear
            </button>
            <button type="button" className={BTN_OUTLINE_SM} onClick={() => alterar({ ativa: !dados.ativa })}>
              {dados.ativa ? 'Desativar' : 'Reativar'}
            </button>
          </div>
        )}
      </div>
      {admin && editando && (
        <form onSubmit={salvar} className="card flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-medium text-mid-grey">Nome</span>
            <input value={nome} onChange={(e) => setNome(e.target.value)} required className={INPUT_BASE} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-medium text-mid-grey">Sigla</span>
            <input value={sigla} onChange={(e) => setSigla(e.target.value)} className={INPUT_BASE} />
          </label>
          <button type="submit" className={BTN_PRIMARY}>
            Salvar
          </button>
          <button type="button" className={BTN_OUTLINE_SM} onClick={() => setEditando(false)}>
            Cancelar
          </button>
        </form>
      )}
      <MensagemErro erro={erro} />
      <div className="grid gap-6 lg:grid-cols-2">
        <CarteiraGerencia gerenciaId={gerenciaId} carteira={dados.carteira} modoAdmin={admin} onErro={setErro} onMudou={carregar} />
        <EquipeGerencia
          gerenciaId={gerenciaId}
          membros={dados.membros}
          podeGerirEquipe={dados.podeGerirEquipe}
          podeNomearManager={dados.podeNomearManager}
          onErro={setErro}
          onMudou={carregar}
        />
      </div>
      <MovimentosGerencia movimentos={dados.movimentos} />
    </main>
  )
}
