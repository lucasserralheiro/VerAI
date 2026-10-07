'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronRight, Plus, Search, ShieldCheck, UserCog, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BTN_PRIMARY } from '@/lib/ui'
import { PainelUsuario } from './painel-usuario'
import { COR_PERFIL, PERFIS, ROTULO_PERFIL, iniciais, normalizar, type ClienteOpcao, type Usuario } from './tipos'

const PAPEL_GERENCIA: Record<string, string> = { manager: 'manager', membro: 'membro' }

export default function AdminUsuariosPage() {
  const [usuarios, setUsuarios] = useState<Usuario[] | null>(null)
  const [clientes, setClientes] = useState<ClienteOpcao[]>([])
  const [busca, setBusca] = useState('')
  const [filtroPerfil, setFiltroPerfil] = useState<string | null>(null)
  /** `undefined` = painel fechado; `null` = novo usuário. */
  const [editando, setEditando] = useState<Usuario | null | undefined>(undefined)

  const carregar = useCallback(async () => {
    const [ru, rc] = await Promise.all([fetch('/api/admin/usuarios'), fetch('/api/admin/clientes')])
    if (ru.ok) setUsuarios(await ru.json())
    else setUsuarios([])
    if (rc.ok) setClientes(((await rc.json()) as ClienteOpcao[]).map((c) => ({ id: c.id, nome: c.nome })))
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  const contagem = useMemo(() => {
    const c: Record<string, number> = {}
    for (const u of usuarios ?? []) c[u.role] = (c[u.role] ?? 0) + 1
    return c
  }, [usuarios])

  const visiveis = useMemo(() => {
    const termo = normalizar(busca.trim())
    return (usuarios ?? []).filter(
      (u) =>
        (!filtroPerfil || u.role === filtroPerfil) &&
        (!termo || normalizar(`${u.nome} ${u.email}`).includes(termo))
    )
  }, [usuarios, busca, filtroPerfil])

  const fecharPainel = useCallback(() => setEditando(undefined), [])

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-6 py-8 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <UserCog className="size-5 text-orange" strokeWidth={2.25} />
            <h1 className="text-2xl font-bold text-navy">Usuários</h1>
          </div>
          <p className="mt-1 text-sm text-mid-grey">Quem acessa o VerAI, com que perfil e em quais clientes.</p>
        </div>
        <button type="button" onClick={() => setEditando(null)} className={cn(BTN_PRIMARY, 'px-4 py-2')}>
          <Plus className="size-4" strokeWidth={2.25} />
          Novo usuário
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <span className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-mid-grey" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome ou e-mail…"
            aria-label="Buscar usuário"
            className="h-10 w-full rounded-xl border border-border-grey bg-white pr-3 pl-9 text-sm shadow-xs outline-none transition focus:border-orange focus:ring-4 focus:ring-orange/12"
          />
        </span>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar por perfil">
          {[{ valor: null as string | null, rotulo: 'Todos', n: usuarios?.length ?? 0 }, ...PERFIS.map((p) => ({ valor: p.valor as string | null, rotulo: p.rotulo, n: contagem[p.valor] ?? 0 }))].map((f) => {
            const ativo = filtroPerfil === f.valor
            return (
              <button
                key={f.rotulo}
                type="button"
                aria-pressed={ativo}
                onClick={() => setFiltroPerfil(f.valor)}
                className={cn(
                  'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors',
                  ativo ? 'border-navy bg-navy text-white' : 'border-border-grey bg-white text-navy hover:border-navy/30'
                )}
              >
                {f.rotulo}
                <span className={cn('rounded-full px-1.5 text-[10px]', ativo ? 'bg-white/20' : 'bg-navy/[0.06] text-mid-grey')}>{f.n}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="card-flush overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table-institucional">
            <thead>
              <tr>
                <th>Usuário</th>
                <th>Perfil</th>
                <th>Gerências</th>
                <th>Clientes liberados</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {usuarios === null &&
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={5}>
                      <div className="h-9 animate-pulse rounded-lg bg-navy/[0.04]" />
                    </td>
                  </tr>
                ))}

              {usuarios !== null && visiveis.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-12 text-center">
                    <Users className="mx-auto mb-2 size-6 text-mid-grey/60" />
                    <p className="text-sm text-mid-grey">
                      {usuarios.length === 0 ? 'Nenhum usuário cadastrado.' : 'Nenhum usuário com esse filtro.'}
                    </p>
                  </td>
                </tr>
              )}

              {visiveis.map((u) => {
                const permitidos = u.clientesPermitidos
                return (
                  <tr
                    key={u.id}
                    onClick={() => setEditando(u)}
                    className="group cursor-pointer transition-colors hover:bg-orange/[0.03]"
                  >
                    <td>
                      <div className="flex items-center gap-3">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-navy/[0.08] text-xs font-bold text-navy">
                          {iniciais(u.nome)}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-navy">{u.nome}</span>
                          <span className="block truncate text-xs text-mid-grey">{u.email}</span>
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1', COR_PERFIL[u.role] ?? COR_PERFIL.uploader)}>
                        {ROTULO_PERFIL[u.role] ?? u.role}
                      </span>
                    </td>
                    <td>
                      {(u.gerencias ?? []).length === 0 ? (
                        <span className="text-mid-grey">—</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {(u.gerencias ?? []).map((g) => (
                            <span key={g.gerencia.nome} className="rounded-md bg-navy/[0.05] px-2 py-0.5 text-xs text-navy">
                              {g.gerencia.nome}
                              <span className="ml-1 text-mid-grey">· {PAPEL_GERENCIA[g.papel] ?? g.papel}</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="max-w-md">
                      {u.role === 'admin' ? (
                        <span className="inline-flex items-center gap-1.5 text-xs text-mid-grey">
                          <ShieldCheck className="size-3.5 text-navy" /> Todos (admin)
                        </span>
                      ) : permitidos.length === 0 ? (
                        <span className="text-xs font-medium text-orange-dark">Nenhum — sem acesso a clientes</span>
                      ) : (
                        <div className="flex flex-wrap items-center gap-1" title={permitidos.map((c) => c.nome).join('\n')}>
                          {permitidos.slice(0, 2).map((c) => (
                            <span key={c.id} className="max-w-52 truncate rounded-md border border-border-grey bg-white px-2 py-0.5 text-xs text-foreground">
                              {c.nome}
                            </span>
                          ))}
                          {permitidos.length > 2 && (
                            <span className="rounded-md bg-navy/[0.06] px-2 py-0.5 text-xs font-medium text-navy">+{permitidos.length - 2}</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td>
                      <button
                        type="button"
                        aria-label={`Editar ${u.nome}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          setEditando(u)
                        }}
                        className="flex size-8 items-center justify-center rounded-lg text-mid-grey transition-colors group-hover:bg-navy/[0.06] group-hover:text-navy"
                      >
                        <ChevronRight className="size-4" />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {editando !== undefined && (
        <PainelUsuario
          key={editando?.id ?? 'novo'}
          usuario={editando}
          clientes={clientes}
          onFechar={fecharPainel}
          onSalvo={() => {
            setEditando(undefined)
            carregar()
          }}
        />
      )}
    </main>
  )
}
