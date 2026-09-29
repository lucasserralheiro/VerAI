'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { INPUT_BASE } from '@/lib/ui'
import { formatarMoeda } from '@/lib/relatorios-clientes/formatacao'
import { agruparPorSecao, filtrarItens, gruposDosItens, trechosDestacados } from '@/lib/tabela-precos/busca'
import type { ItemSerializado } from '@/lib/tabela-precos/tipos'

function Preco({ item }: { item: ItemSerializado }) {
  if (item.sobDemanda) {
    return <span className="justify-self-start rounded-full bg-light-grey px-2 py-0.5 text-xs text-mid-grey md:justify-self-end">Sob demanda</span>
  }
  if (item.preco === null) return <span className="text-xs text-orange-dark md:text-right">{item.precoTexto ?? 'preço não lido'}</span>
  return (
    <span className="flex flex-col md:items-end">
      <span className="flex items-center gap-1.5 font-mono text-sm font-semibold text-navy">
        {item.conferencia === 'diverge' && <AlertCircle className="size-3.5 text-orange-dark" aria-hidden="true" />}
        {formatarMoeda(item.preco)}
      </span>
      {item.conferencia === 'diverge' && <span className="text-[0.7rem] text-orange-dark">PDF publicado: {formatarMoeda(item.precoNoPdf)}</span>}
      {item.conferencia === 'alterado-pelo-informativo' && <span className="text-[0.7rem] text-orange-dark">alterado pelo informativo</span>}
    </span>
  )
}

/** Busca, filtro por grupo e a lista por seção, na ordem da tabela oficial. */
export function ListaPrecos({ itens }: { itens: ItemSerializado[] }) {
  const [termo, setTermo] = useState('')
  const [grupo, setGrupo] = useState<string | null>(null)
  const [copiado, setCopiado] = useState<string | null>(null)
  const campo = useRef<HTMLInputElement>(null)

  // "/" leva à busca (quando não se está digitando em outro campo); Esc limpa.
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      const digitando = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement
      if (e.key === '/' && !digitando) {
        e.preventDefault()
        campo.current?.focus()
      }
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [])

  const grupos = useMemo(() => gruposDosItens(itens), [itens])
  const visiveis = useMemo(() => filtrarItens(itens, termo, grupo), [itens, termo, grupo])
  const blocos = useMemo(() => agruparPorSecao(visiveis), [visiveis])

  const copiar = async (codigo: string) => {
    await navigator.clipboard?.writeText(codigo)
    setCopiado(codigo)
    setTimeout(() => setCopiado((atual) => (atual === codigo ? null : atual)), 1500)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="relative w-full max-w-md">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-mid-grey" aria-hidden="true" />
          <input
            ref={campo}
            type="search"
            aria-label="Buscar por código ou descrição"
            placeholder="Buscar por código ou descrição  ( / )"
            className={cn(INPUT_BASE, 'w-full pl-9')}
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && setTermo('')}
          />
        </label>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por grupo">
          {grupos.map((g) => (
            <button
              key={g.grupo}
              type="button"
              aria-pressed={grupo === g.grupo}
              onClick={() => setGrupo((atual) => (atual === g.grupo ? null : g.grupo))}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                grupo === g.grupo ? 'border-orange bg-orange text-white' : 'border-border-grey bg-white text-navy hover:border-orange'
              )}
            >
              {g.rotulo} <span className="opacity-70">{g.total}</span>
            </button>
          ))}
        </div>
      </div>

      <p className="text-xs text-mid-grey" aria-live="polite">
        {visiveis.length} de {itens.length} serviços
      </p>

      {visiveis.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border-grey p-8 text-center text-sm text-mid-grey">
          Nenhum serviço com “{termo}”{grupo ? ' neste grupo' : ''}. Tente o código ou outra palavra.
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border-grey bg-white">
          <div className="hidden grid-cols-[10rem_1fr_9rem_10rem] gap-4 border-b border-border-grey bg-light-grey/60 px-4 py-2 text-[0.7rem] font-semibold tracking-wide text-mid-grey uppercase md:grid">
            <span>Código</span>
            <span>Descrição</span>
            <span className="text-right">Unidade</span>
            <span className="text-right">Preço unitário</span>
          </div>
          {blocos.map((b, n) => (
            <section key={`${b.secao}-${n}`}>
              <h2 className="border-b border-border-grey bg-light-grey/30 px-4 py-2 text-xs font-semibold text-navy">{b.secao.split(' > ').join(' › ')}</h2>
              <ul>
                {b.itens.map((item) => (
                  <li
                    key={item.codigo}
                    className="grid grid-cols-1 gap-1 border-b border-border-grey/60 px-4 py-3 last:border-b-0 md:grid-cols-[10rem_1fr_9rem_10rem] md:items-center md:gap-4"
                  >
                    <button
                      type="button"
                      aria-label={`Copiar código ${item.codigo}`}
                      onClick={() => copiar(item.codigo)}
                      className="justify-self-start font-mono text-xs text-navy hover:text-orange"
                    >
                      {copiado === item.codigo ? 'copiado' : item.codigo}
                    </button>
                    <span className="text-sm text-foreground">
                      {trechosDestacados(item.descricao, termo).map((p, k) =>
                        p.destaque ? (
                          <mark key={k} className="rounded bg-orange/20 px-0.5 text-inherit">
                            {p.texto}
                          </mark>
                        ) : (
                          <span key={k}>{p.texto}</span>
                        )
                      )}
                    </span>
                    <span className="text-xs text-mid-grey md:text-right">{item.unidade}</span>
                    <Preco item={item} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
