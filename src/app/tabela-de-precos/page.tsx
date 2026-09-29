'use client'

// Tabela de preços dos serviços da PRODAM (spec docs/superpowers/specs/2026-09-29-tabela-de-precos-design.md):
// lida da pasta TABELA DE PREÇOS PRODAM-SP do SharePoint pelo agendador; aqui só se consulta.

import { useEffect, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AtualizacaoSharepoint } from '@/components/sharepoint/atualizacao-sharepoint'
import type { ItemSerializado, TabelaSerializada, VersaoResumo } from '@/lib/tabela-precos/tipos'
import { CartaoVersao } from './cartao-versao'
import { ListaPrecos } from './lista-precos'
import { OQueMudou } from './o-que-mudou'

type Carga = { estado: 'carregando' } | { estado: 'erro' } | { estado: 'ok'; tabela: TabelaSerializada | null; itens: ItemSerializado[] }

const ABAS = [
  ['precos', 'Preços'],
  ['mudou', 'O que mudou'],
] as const

export default function TabelaDePrecosPage() {
  const [versoes, setVersoes] = useState<VersaoResumo[]>([])
  const [versao, setVersao] = useState<string | null>(null)
  const [carga, setCarga] = useState<Carga>({ estado: 'carregando' })
  const [aba, setAba] = useState<'precos' | 'mudou'>('precos')

  useEffect(() => {
    fetch('/api/tabela-precos/versoes')
      .then((r) => (r.ok ? r.json() : []))
      .then((lista) => setVersoes(Array.isArray(lista) ? lista : []))
      .catch(() => setVersoes([]))
  }, [])

  useEffect(() => {
    let ativo = true
    setCarga({ estado: 'carregando' })
    fetch(versao ? `/api/tabela-precos?versao=${encodeURIComponent(versao)}` : '/api/tabela-precos')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((corpo) => ativo && setCarga({ estado: 'ok', tabela: corpo.tabela, itens: corpo.itens }))
      .catch(() => ativo && setCarga({ estado: 'erro' }))
    return () => {
      ativo = false
    }
  }, [versao])

  const atual = carga.estado === 'ok' ? carga.tabela : null
  const indice = atual ? versoes.findIndex((v) => v.versao === atual.versao) : -1
  const anterior = indice >= 0 ? (versoes[indice + 1]?.versao ?? null) : null

  return (
    <main className="mx-auto max-w-[110rem] space-y-6 px-6 py-8 lg:px-8">
      <div className="space-y-3">
        <nav className="flex items-center gap-1.5 text-xs font-medium text-mid-grey">
          <span>Relatórios dos clientes</span>
          <ChevronRight className="size-3" strokeWidth={2.5} />
          <span className="font-semibold text-navy">Tabela de preços</span>
        </nav>
        <div>
          <h1 className="text-[1.75rem] leading-tight font-semibold tracking-tight text-navy">Tabela de preços</h1>
          <p className="text-sm text-mid-grey">Preços dos serviços da PRODAM, pela tabela publicada no Diário Oficial</p>
          <AtualizacaoSharepoint url="/api/biblioteca/atualizacao" className="mt-1" />
        </div>
      </div>

      {carga.estado === 'carregando' && (
        <div className="space-y-3" aria-busy="true">
          <div className="h-24 animate-pulse rounded-2xl bg-light-grey" />
          <div className="h-96 animate-pulse rounded-2xl bg-light-grey" />
        </div>
      )}
      {carga.estado === 'erro' && <p className="text-sm text-orange-dark">Não foi possível carregar a tabela agora — tente de novo em instantes.</p>}
      {carga.estado === 'ok' && !carga.tabela && (
        <p className="rounded-2xl border border-dashed border-border-grey p-8 text-center text-sm text-mid-grey">
          A tabela de preços ainda não foi lida da pasta do SharePoint. Ela entra sozinha na próxima passada do agendador.
        </p>
      )}
      {carga.estado === 'ok' && carga.tabela && (
        <>
          <CartaoVersao tabela={carga.tabela} versoes={versoes} onVersao={setVersao} />
          <div role="tablist" className="flex gap-6 border-b border-border-grey">
            {ABAS.map(([id, rotulo]) => {
              const desabilitada = id === 'mudou' && !anterior
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={aba === id}
                  disabled={desabilitada}
                  title={desabilitada ? 'Disponível a partir da próxima versão da tabela' : undefined}
                  onClick={() => setAba(id)}
                  className={cn(
                    'relative py-3 text-[0.8rem] transition-colors disabled:cursor-not-allowed disabled:opacity-40',
                    aba === id ? 'font-semibold text-navy' : 'font-medium text-mid-grey hover:text-navy'
                  )}
                >
                  {rotulo}
                  <span
                    className={cn(
                      'absolute inset-x-0 -bottom-px h-[2.5px] rounded-full bg-orange transition-transform',
                      aba === id ? 'scale-x-100' : 'scale-x-0'
                    )}
                  />
                </button>
              )
            })}
          </div>
          {aba === 'precos' || !anterior ? <ListaPrecos itens={carga.itens} /> : <OQueMudou de={anterior} para={carga.tabela.versao} />}
        </>
      )}
    </main>
  )
}
