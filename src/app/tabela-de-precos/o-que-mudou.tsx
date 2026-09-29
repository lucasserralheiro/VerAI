'use client'

import { useEffect, useState } from 'react'
import { formatarMoeda } from '@/lib/relatorios-clientes/formatacao'
import type { Diferencas, ItemSerializado } from '@/lib/tabela-precos/tipos'

function ListaSimples({ titulo, itens }: { titulo: string; itens: ItemSerializado[] }) {
  if (itens.length === 0) return null
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold text-navy">{titulo}</h3>
      <ul className="divide-y divide-border-grey rounded-2xl border border-border-grey bg-white">
        {itens.map((i) => (
          <li key={i.codigo} className="flex gap-4 px-4 py-2 text-sm">
            <span className="font-mono text-xs text-navy">{i.codigo}</span>
            {i.descricao}
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Aba "O que mudou" entre a versão escolhida e a anterior (spec 2026-09-29-tabela-de-precos §6). */
export function OQueMudou({ de, para }: { de: string; para: string }) {
  const [d, setD] = useState<Diferencas | null | 'erro'>(null)
  useEffect(() => {
    let ativo = true
    setD(null)
    fetch(`/api/tabela-precos/diferencas?de=${encodeURIComponent(de)}&para=${encodeURIComponent(para)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((corpo) => ativo && setD(corpo))
      .catch(() => ativo && setD('erro'))
    return () => {
      ativo = false
    }
  }, [de, para])

  if (d === null) return <div className="h-40 animate-pulse rounded-2xl bg-light-grey" aria-busy="true" />
  if (d === 'erro') return <p className="text-sm text-orange-dark">Não foi possível comparar as versões agora.</p>
  return (
    <div className="space-y-6">
      <p className="text-sm text-mid-grey">
        De {de} para {para}: {d.precoMudou.length} preço(s) mudaram, {d.novos.length} serviço(s) novo(s), {d.retirados.length} retirado(s).
      </p>
      {d.precoMudou.length > 0 && (
        <ul className="divide-y divide-border-grey rounded-2xl border border-border-grey bg-white">
          {d.precoMudou.map((m) => (
            <li key={m.codigo} className="grid grid-cols-1 gap-1 px-4 py-3 md:grid-cols-[10rem_1fr_16rem] md:items-center">
              <span className="font-mono text-xs text-navy">{m.codigo}</span>
              <span className="text-sm">{m.descricao}</span>
              <span className="font-mono text-sm md:text-right">
                {m.antes ? formatarMoeda(m.antes) : 'sob demanda'} → {m.depois ? formatarMoeda(m.depois) : 'sob demanda'}
                {m.percentual !== null && (
                  <span className={m.percentual > 0 ? 'ml-2 text-orange-dark' : 'ml-2 text-emerald-700'}>
                    {m.percentual > 0 ? '+' : ''}
                    {m.percentual}%
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
      <ListaSimples titulo="Novos" itens={d.novos} />
      <ListaSimples titulo="Retirados" itens={d.retirados} />
    </div>
  )
}
