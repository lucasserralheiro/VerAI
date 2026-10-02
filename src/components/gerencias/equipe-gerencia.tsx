'use client'

import { useState } from 'react'
import { UserPlus } from 'lucide-react'
import type { MembroSerializado } from '@/lib/gerencias/tipos'
import type { PapelGerencia } from '@/lib/gerencias/permissao'
import { BTN_OUTLINE_SM, BTN_PRIMARY, INPUT_BASE, LINK_DANGER } from '@/lib/ui'
import { erroDaResposta } from './comum'

interface Candidato {
  id: string
  nome: string
  email: string
}
interface Props {
  gerenciaId: string
  membros: MembroSerializado[]
  podeGerirEquipe: boolean
  podeNomearManager: boolean
  onErro: (mensagem: string | null) => void
  onMudou: () => void
}

const ROTULO: Record<PapelGerencia, string> = { manager: 'Manager', usuario: 'Usuário' }

export function EquipeGerencia({ gerenciaId, membros, podeGerirEquipe, podeNomearManager, onErro, onMudou }: Props) {
  const [aberta, setAberta] = useState(false)
  const [candidatos, setCandidatos] = useState<Candidato[]>([])
  const [usuarioId, setUsuarioId] = useState('')
  const [papel, setPapel] = useState<PapelGerencia>('usuario')
  const base = `/api/gerencias/${gerenciaId}`

  async function abrir() {
    onErro(null)
    const resposta = await fetch(`${base}/candidatos`)
    if (!resposta.ok) return onErro(await erroDaResposta(resposta, 'Falha ao carregar pessoas.'))
    setCandidatos(await resposta.json())
    setUsuarioId('')
    setPapel('usuario')
    setAberta(true)
  }

  async function gravar(id: string, novoPapel: PapelGerencia) {
    onErro(null)
    const resposta = await fetch(`${base}/membros`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuarioId: id, papel: novoPapel }),
    })
    if (!resposta.ok) return onErro(await erroDaResposta(resposta, 'Falha ao gravar a equipe.'))
    setAberta(false)
    onMudou()
  }

  async function remover(id: string) {
    onErro(null)
    const resposta = await fetch(`${base}/membros?usuarioId=${encodeURIComponent(id)}`, { method: 'DELETE' })
    if (!resposta.ok) return onErro(await erroDaResposta(resposta, 'Falha ao remover da equipe.'))
    onMudou()
  }

  const papeis: PapelGerencia[] = podeNomearManager ? ['manager', 'usuario'] : ['usuario']

  return (
    <section className="card space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-navy">Equipe ({membros.length})</h2>
        {podeGerirEquipe && (
          <button type="button" onClick={abrir} className={BTN_OUTLINE_SM}>
            <UserPlus className="size-3.5" strokeWidth={2.25} />
            Adicionar pessoa
          </button>
        )}
      </div>
      {aberta && (
        <div className="flex flex-wrap items-end gap-3 rounded-lg border border-line p-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-medium text-mid-grey">Pessoa</span>
            <select value={usuarioId} onChange={(e) => setUsuarioId(e.target.value)} className={INPUT_BASE}>
              <option value="">Selecione...</option>
              {candidatos.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome} ({c.email})
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-medium text-mid-grey">Papel</span>
            <select value={papel} onChange={(e) => setPapel(e.target.value as PapelGerencia)} className={INPUT_BASE}>
              {papeis.map((p) => (
                <option key={p} value={p}>
                  {ROTULO[p]}
                </option>
              ))}
            </select>
          </label>
          <button type="button" onClick={() => gravar(usuarioId, papel)} disabled={!usuarioId} className={`${BTN_PRIMARY} disabled:opacity-40`}>
            Adicionar
          </button>
          <button type="button" onClick={() => setAberta(false)} className={BTN_OUTLINE_SM}>
            Cancelar
          </button>
        </div>
      )}
      {membros.length === 0 ? (
        <p className="text-sm text-mid-grey">Ninguém na equipe.</p>
      ) : (
        <ul className="divide-y divide-line text-sm">
          {membros.map((m) => {
            // Manager só mexe em quem é usuário; trocar papel de/para manager é do admin.
            const mexe = podeGerirEquipe && (podeNomearManager || m.papel === 'usuario')
            return (
              <li key={m.usuarioId} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
                <span>
                  <span className="text-navy">{m.nome}</span> <span className="text-xs text-mid-grey">{m.email}</span>
                </span>
                <span className="flex items-center gap-3">
                  {podeNomearManager ? (
                    <select
                      aria-label={`Papel de ${m.nome}`}
                      value={m.papel}
                      onChange={(e) => gravar(m.usuarioId, e.target.value as PapelGerencia)}
                      className={INPUT_BASE}
                    >
                      <option value="manager">Manager</option>
                      <option value="usuario">Usuário</option>
                    </select>
                  ) : (
                    <span className="text-mid-grey">{ROTULO[m.papel]}</span>
                  )}
                  {mexe && (
                    <button type="button" onClick={() => remover(m.usuarioId)} className={LINK_DANGER}>
                      Remover
                    </button>
                  )}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
