'use client'

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Check, Eye, EyeOff, Loader2, Search, ShieldCheck, Trash2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BTN_OUTLINE, BTN_PRIMARY, INPUT_BASE } from '@/lib/ui'
import { COR_PERFIL, PERFIS, iniciais, normalizar, type ClienteOpcao, type Usuario } from './tipos'

interface Props {
  /** `null` = novo usuário. */
  usuario: Usuario | null
  clientes: ClienteOpcao[]
  onFechar: () => void
  onSalvo: () => void
}

async function mensagemDeErro(resposta: Response, padrao: string) {
  try {
    const corpo = await resposta.json()
    return typeof corpo?.error === 'string' ? corpo.error : padrao
  } catch {
    return padrao
  }
}

/**
 * Modal (centralizado, padrão do VerAI) de criar/editar usuário. Antes a lista de TODOS os clientes ficava aberta em cada linha
 * da tabela (uma linha virava uma página) e o formulário de criar ficava solto no topo, onde o navegador
 * preenchia e-mail e senha do próprio admin. Aqui: dados, perfil explicado, clientes com busca e
 * "Excluir" com confirmação — tudo num lugar só, salvo de uma vez.
 */
export function PainelUsuario({ usuario, clientes, onFechar, onSalvo }: Props) {
  const novo = usuario === null
  const [nome, setNome] = useState(usuario?.nome ?? '')
  const [email, setEmail] = useState(usuario?.email ?? '')
  const [senha, setSenha] = useState('')
  const [verSenha, setVerSenha] = useState(false)
  const [role, setRole] = useState(usuario?.role ?? 'responsavel')
  const [selecionados, setSelecionados] = useState<string[]>(usuario?.clientesPermitidos.map((c) => c.id) ?? [])
  const [busca, setBusca] = useState('')
  const [soMarcados, setSoMarcados] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [confirmarExclusao, setConfirmarExclusao] = useState(false)
  const primeiroCampo = useRef<HTMLInputElement>(null)

  useEffect(() => {
    primeiroCampo.current?.focus()
    const anterior = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function esc(e: KeyboardEvent) {
      if (e.key === 'Escape') onFechar()
    }
    window.addEventListener('keydown', esc)
    return () => {
      document.body.style.overflow = anterior
      window.removeEventListener('keydown', esc)
    }
  }, [onFechar])

  const visiveis = useMemo(() => {
    const termo = normalizar(busca.trim())
    return clientes.filter(
      (c) => (!soMarcados || selecionados.includes(c.id)) && (!termo || normalizar(c.nome).includes(termo))
    )
  }, [clientes, busca, soMarcados, selecionados])

  const ehAdmin = role === 'admin'

  function alternar(id: string) {
    setSelecionados((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  }

  function marcarVisiveis(marcar: boolean) {
    const ids = visiveis.map((c) => c.id)
    setSelecionados((s) => (marcar ? Array.from(new Set([...s, ...ids])) : s.filter((id) => !ids.includes(id))))
  }

  async function salvar(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    setSalvando(true)
    try {
      let id = usuario?.id
      if (novo) {
        const r = await fetch('/api/admin/usuarios', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nome: nome.trim(), email: email.trim(), senha, role }),
        })
        if (!r.ok) return setErro(await mensagemDeErro(r, 'Não foi possível criar o usuário. O e-mail já está em uso?'))
        id = ((await r.json()) as { id: string }).id
      }
      const r = await fetch('/api/admin/usuarios', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          ...(novo ? {} : { nome: nome.trim(), email: email.trim(), role, ...(senha ? { senha } : {}) }),
          ...(ehAdmin ? {} : { clientesPermitidos: selecionados }),
        }),
      })
      if (!r.ok) return setErro(await mensagemDeErro(r, 'Não foi possível salvar as alterações.'))
      onSalvo()
    } finally {
      setSalvando(false)
    }
  }

  async function excluir() {
    if (!usuario) return
    setErro(null)
    setSalvando(true)
    try {
      const r = await fetch(`/api/admin/usuarios?id=${usuario.id}`, { method: 'DELETE' })
      if (!r.ok) return setErro(await mensagemDeErro(r, 'Não foi possível excluir o usuário.'))
      onSalvo()
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center sm:p-6">
      <div aria-hidden className="absolute inset-0 bg-navy/45 backdrop-blur-[3px] animate-in fade-in duration-150" onClick={onFechar} />
      <form
        onSubmit={salvar}
        role="dialog"
        aria-modal="true"
        aria-label={novo ? 'Novo usuário' : `Editar ${usuario?.nome}`}
        autoComplete="off"
        className="relative flex h-full w-full flex-col overflow-hidden bg-white shadow-2xl shadow-navy/30 ring-1 ring-navy/10 animate-in fade-in zoom-in-[0.98] slide-in-from-bottom-2 duration-200 sm:h-auto sm:max-h-[90vh] sm:max-w-2xl sm:rounded-2xl"
      >
        <header className="flex items-center gap-3 border-b border-border-grey px-6 py-4">
          <span className="flex size-10 items-center justify-center rounded-full bg-navy text-sm font-bold text-white">
            {nome.trim() ? iniciais(nome) : '+'}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-semibold text-navy">{novo ? 'Novo usuário' : nome || usuario?.nome}</h2>
            <p className="truncate text-xs text-mid-grey">{novo ? 'Dados de acesso, perfil e clientes liberados' : usuario?.email}</p>
          </div>
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar"
            className="flex size-8 items-center justify-center rounded-lg text-mid-grey hover:bg-navy/[0.06] hover:text-navy"
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="flex-1 space-y-7 overflow-y-auto px-6 py-6">
          <section className="space-y-4">
            <h3 className="text-xs font-semibold tracking-wide text-mid-grey uppercase">Dados de acesso</h3>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-navy">Nome</span>
              <input
                ref={primeiroCampo}
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                required
                autoComplete="off"
                className={INPUT_BASE}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-navy">E-mail</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="off"
                placeholder="nome@prodam.sp.gov.br"
                className={INPUT_BASE}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-navy">
                {novo ? 'Senha inicial' : 'Nova senha'}
                {!novo && <span className="ml-1 font-normal text-mid-grey">(deixe em branco para manter)</span>}
              </span>
              <span className="relative">
                <input
                  type={verSenha ? 'text' : 'password'}
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  required={novo}
                  autoComplete="new-password"
                  className={cn(INPUT_BASE, 'w-full pr-10')}
                />
                <button
                  type="button"
                  onClick={() => setVerSenha((v) => !v)}
                  aria-label={verSenha ? 'Esconder senha' : 'Mostrar senha'}
                  className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-mid-grey hover:text-navy"
                >
                  {verSenha ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </span>
            </label>
          </section>

          <section className="space-y-3">
            <h3 className="text-xs font-semibold tracking-wide text-mid-grey uppercase">Perfil</h3>
            <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Perfil">
              {PERFIS.map((p) => {
                const ativo = role === p.valor
                return (
                  <button
                    key={p.valor}
                    type="button"
                    role="radio"
                    aria-checked={ativo}
                    onClick={() => setRole(p.valor)}
                    className={cn(
                      'relative flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-all',
                      ativo ? 'border-orange bg-orange/[0.05] ring-2 ring-orange/20' : 'border-border-grey hover:border-navy/30'
                    )}
                  >
                    <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1', COR_PERFIL[p.valor])}>{p.rotulo}</span>
                    <span className="text-xs leading-snug text-mid-grey">{p.descricao}</span>
                    {ativo && <Check className="absolute top-3 right-3 size-4 text-orange" strokeWidth={2.5} />}
                  </button>
                )
              })}
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="text-xs font-semibold tracking-wide text-mid-grey uppercase">Clientes liberados</h3>
              {!ehAdmin && (
                <span className="text-xs text-mid-grey">
                  <strong className="text-navy">{selecionados.length}</strong> de {clientes.length}
                </span>
              )}
            </div>

            {ehAdmin ? (
              <p className="flex items-center gap-2 rounded-xl bg-navy/[0.04] px-4 py-3 text-sm text-navy">
                <ShieldCheck className="size-4 shrink-0" /> Admin vê todos os clientes — não há o que liberar.
              </p>
            ) : (
              <div className="overflow-hidden rounded-xl border border-border-grey">
                <div className="flex flex-wrap items-center gap-2 border-b border-border-grey bg-[#fafbfc] p-2">
                  <span className="relative min-w-40 flex-1">
                    <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-mid-grey" />
                    <input
                      value={busca}
                      onChange={(e) => setBusca(e.target.value)}
                      placeholder="Buscar cliente…"
                      aria-label="Buscar cliente"
                      className="h-8 w-full rounded-lg border border-border-grey bg-white pr-2 pl-8 text-sm outline-none focus:border-orange"
                    />
                  </span>
                  <label className="flex items-center gap-1.5 text-xs text-mid-grey">
                    <input type="checkbox" checked={soMarcados} onChange={(e) => setSoMarcados(e.target.checked)} className="size-3.5 accent-orange" />
                    Só marcados
                  </label>
                  <button type="button" onClick={() => marcarVisiveis(true)} className="text-xs font-medium text-navy hover:text-orange">
                    Marcar {busca ? 'filtrados' : 'todos'}
                  </button>
                  <button type="button" onClick={() => marcarVisiveis(false)} className="text-xs font-medium text-mid-grey hover:text-red-crit">
                    Limpar
                  </button>
                </div>
                <ul className="max-h-72 divide-y divide-border-grey/60 overflow-y-auto">
                  {visiveis.length === 0 && <li className="px-3 py-6 text-center text-sm text-mid-grey">Nenhum cliente encontrado.</li>}
                  {visiveis.map((c) => {
                    const marcado = selecionados.includes(c.id)
                    return (
                      <li key={c.id}>
                        <label
                          className={cn(
                            'flex cursor-pointer items-center gap-3 px-3 py-2 text-sm transition-colors hover:bg-navy/[0.03]',
                            marcado && 'bg-orange/[0.04]'
                          )}
                        >
                          <input type="checkbox" checked={marcado} onChange={() => alternar(c.id)} className="size-4 shrink-0 accent-orange" />
                          <span className={cn('min-w-0 flex-1', marcado ? 'font-medium text-navy' : 'text-foreground')}>{c.nome}</span>
                        </label>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}
          </section>

          {!novo && (
            <section className="space-y-3 rounded-xl border border-red-crit/20 bg-red-crit/[0.02] p-4">
              <div>
                <h3 className="text-sm font-semibold text-red-crit">Excluir usuário</h3>
                <p className="text-xs text-mid-grey">Remove o acesso de vez. Não dá para desfazer.</p>
              </div>
              {confirmarExclusao ? (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={excluir}
                    disabled={salvando}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-red-crit px-3.5 py-1.5 text-sm font-medium text-white hover:bg-red-crit/90 disabled:opacity-50"
                  >
                    <Trash2 className="size-3.5" /> Sim, excluir {usuario?.nome}
                  </button>
                  <button type="button" onClick={() => setConfirmarExclusao(false)} className={BTN_OUTLINE}>
                    Cancelar
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmarExclusao(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-red-crit/30 bg-white px-3.5 py-1.5 text-sm font-medium text-red-crit hover:bg-red-crit/[0.05]"
                >
                  <Trash2 className="size-3.5" /> Excluir usuário
                </button>
              )}
            </section>
          )}
        </div>

        <footer className="flex items-center gap-3 border-t border-border-grey bg-white px-6 py-4">
          {erro ? <p className="min-w-0 flex-1 text-sm text-red-crit">{erro}</p> : <span className="flex-1" />}
          <button type="button" onClick={onFechar} className={BTN_OUTLINE}>
            Cancelar
          </button>
          <button type="submit" disabled={salvando} className={cn(BTN_PRIMARY, 'px-5 py-2')}>
            {salvando && <Loader2 className="size-3.5 animate-spin" />}
            {novo ? 'Criar usuário' : 'Salvar alterações'}
          </button>
        </footer>
      </form>
    </div>
  )
}
