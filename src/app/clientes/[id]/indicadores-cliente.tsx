'use client'

// Os 4 cartões do topo da ficha do cliente (mockup: .kpis) — lidos de
// /api/clientes/[clienteId]/indicadores.

import { useEffect, useState } from 'react'
import { formatarMoeda } from '@/lib/relatorios-clientes/formatacao'

interface Indicadores {
  contratosAtivos: number
  vencendoEm30Dias: number
  valorContratado: string
  faturadoUltimoMes: { ano: number; mes: number; valor: string } | null
  demandasAbertas: number
  abertasHaMaisDe30Dias: number
}

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

function Cartao({ rotulo, valor, detalhe }: { rotulo: string; valor: string; detalhe: string }) {
  return (
    <div className="card-flush px-4 py-3">
      <div className="text-[0.7rem] font-semibold tracking-wide text-mid-grey uppercase">{rotulo}</div>
      <div className="mt-1 font-mono text-xl font-semibold text-navy tabular-nums">{valor}</div>
      <div className="mt-0.5 text-xs text-mid-grey">{detalhe}</div>
    </div>
  )
}

export function IndicadoresCliente({ clienteId }: { clienteId: string }) {
  const [indicadores, setIndicadores] = useState<Indicadores | null>(null)

  useEffect(() => {
    fetch(`/api/clientes/${clienteId}/indicadores`)
      .then(async (response) => {
        if (response.ok) setIndicadores(await response.json())
      })
      .catch(() => {})
  }, [clienteId])

  // Indicador é complemento da ficha: falha ou carregamento não ocupa espaço nem mostra erro.
  if (!indicadores) return null

  const ultimo = indicadores.faturadoUltimoMes
  return (
    <section aria-label="Indicadores do cliente" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Cartao
        rotulo="Contratos ativos"
        valor={String(indicadores.contratosAtivos)}
        detalhe={`${indicadores.vencendoEm30Dias} vencendo em 30 dias`}
      />
      <Cartao
        rotulo="Valor contratado"
        valor={formatarMoeda(indicadores.valorContratado)}
        detalhe="itens vinculados aos contratos ativos"
      />
      <Cartao
        rotulo="Faturado (mês)"
        valor={ultimo ? formatarMoeda(ultimo.valor) : '—'}
        detalhe={ultimo ? `${MESES[ultimo.mes - 1]}/${ultimo.ano}` : 'nenhum faturamento'}
      />
      <Cartao
        rotulo="Demandas abertas"
        valor={String(indicadores.demandasAbertas)}
        detalhe={`${indicadores.abertasHaMaisDe30Dias} há mais de 30 dias`}
      />
    </section>
  )
}
