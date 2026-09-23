'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { AlertCircle, Download, X } from 'lucide-react'
import { BTN_OUTLINE, BTN_OUTLINE_SM, BTN_PRIMARY, INPUT_BASE, LINK_DANGER } from '@/lib/ui'
import { CATEGORIAS, formatarTamanho } from '@/lib/arquivos/tipos'
import type { ArquivoRepositorio } from './tipos'

export function PainelArquivo({
  arquivo,
  aoAtualizar,
  aoRemover,
  aoFechar,
}: {
  arquivo: ArquivoRepositorio
  aoAtualizar: (arquivo: ArquivoRepositorio) => void
  aoRemover: (id: string) => void
  aoFechar: () => void
}) {
  const [categoria, setCategoria] = useState(arquivo.categoria)
  const [confirmando, setConfirmando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const emUso = arquivo.usos.length > 0

  async function salvar(event: FormEvent) {
    event.preventDefault()
    setErro(null)
    const response = await fetch(`/api/arquivos/${arquivo.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categoria }),
    }).catch(() => null)
    const corpo = await response?.json().catch(() => null)
    if (!response?.ok) return setErro(corpo?.error ?? 'Falha ao salvar a classificação.')
    aoAtualizar(corpo)
  }

  async function remover() {
    setErro(null)
    const response = await fetch(`/api/arquivos/${arquivo.id}`, { method: 'DELETE' }).catch(() => null)
    if (!response?.ok) {
      const corpo = await response?.json().catch(() => null)
      setConfirmando(false)
      return setErro(corpo?.error ?? 'Falha ao remover o arquivo.')
    }
    aoRemover(arquivo.id)
  }

  return (
    <aside aria-label={arquivo.nome} className="card space-y-4 self-start lg:sticky lg:top-6">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-navy">{arquivo.nome}</h3>
          <p className="text-xs text-mid-grey">
            {arquivo.extensao.toUpperCase() || 'arquivo'} · {formatarTamanho(arquivo.tamanhoBytes)}
          </p>
        </div>
        <button type="button" onClick={aoFechar} aria-label="Fechar painel" className="text-mid-grey hover:text-navy">
          <X className="size-4" strokeWidth={2.25} />
        </button>
      </div>

      {arquivo.extensao === 'pdf' && (
        <iframe
          title={`Pré-visualização de ${arquivo.nome}`}
          src={`/api/arquivos/${arquivo.id}?modo=inline`}
          className="h-80 w-full rounded-lg border border-border-grey"
        />
      )}

      <form onSubmit={salvar} className="space-y-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium text-mid-grey">Categoria</span>
          <select value={categoria} onChange={(e) => setCategoria(e.target.value as typeof categoria)} className={INPUT_BASE}>
            {CATEGORIAS.map((c) => (
              <option key={c.valor} value={c.valor}>
                {c.rotulo}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className={BTN_OUTLINE_SM}>
          Salvar categoria
        </button>
      </form>

      <div className="space-y-1.5">
        <h4 className="text-xs font-semibold tracking-wide text-mid-grey uppercase">Onde é usado</h4>
        {emUso ? (
          <ul className="space-y-1 text-sm">
            {arquivo.usos.map((uso) => (
              <li key={uso.href}>
                <Link href={uso.href} className="text-navy hover:text-orange hover:underline">
                  {uso.rotulo}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-mid-grey">Em nenhum lugar ainda.</p>
        )}
      </div>

      {erro && (
        <p className="flex items-center gap-1.5 rounded-lg bg-red-crit-light px-3 py-2 text-sm text-red-crit">
          <AlertCircle className="size-4 shrink-0" strokeWidth={2.25} />
          {erro}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-border-grey pt-3">
        <a href={`/api/arquivos/${arquivo.id}`} className={BTN_PRIMARY}>
          <Download className="size-3.5" strokeWidth={2.25} />
          Baixar
        </a>
        {confirmando ? (
          <span className="flex items-center gap-2 text-sm">
            Remover?
            <button type="button" onClick={remover} className={LINK_DANGER}>
              Sim
            </button>
            <button type="button" onClick={() => setConfirmando(false)} className={BTN_OUTLINE_SM}>
              Não
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmando(true)}
            disabled={emUso}
            title={emUso ? 'Em uso — remova o vínculo antes' : undefined}
            className={BTN_OUTLINE}
          >
            Remover
          </button>
        )}
      </div>
      {emUso && <p className="text-xs text-mid-grey">Não dá para remover: o arquivo está em uso nos lugares acima.</p>}
    </aside>
  )
}
