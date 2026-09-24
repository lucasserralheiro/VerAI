'use client'

// Os 4 cartões do topo da ficha do cliente (mockup: .kpis) — lidos de
// /api/clientes/[clienteId]/indicadores.

import { useEffect, useState } from 'react'
import { formatarMoeda } from '@/lib/relatorios-clientes/formatacao'
import { aoMudarDados } from '@/lib/relatorios-clientes/atualizacao-dados'

interface Indicadores {
  contratosAtivos: number
  vencendoEm30Dias: number
  /** Ativos (situação "Ativo") cuja vigência já passou sem prorrogação: aviso de cadastro
   *  desatualizado — continuam ativos e na soma (decisão do usuário, 23/09/2026). */
  vencidos?: number
  valorContratado: string
  contratosSemValor?: number
  faturadoUltimoMes: { ano: number; mes: number; valor: string; semValor?: boolean } | null
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
    let ativo = true
    const carregar = () =>
      fetch(`/api/clientes/${clienteId}/indicadores`, { cache: 'no-store' })
        .then(async (response) => {
          if (response.ok && ativo) setIndicadores(await response.json())
        })
        .catch(() => {})
    carregar()
    // Recalcula quando algo muda nesta ficha (contrato, faturamento, demanda) e quando a aba volta ao foco.
    const parar = aoMudarDados(carregar)
    return () => {
      ativo = false
      parar()
    }
  }, [clienteId])

  // Indicador é complemento da ficha: falha ou carregamento não ocupa espaço nem mostra erro.
  if (!indicadores) return null

  const ultimo = indicadores.faturadoUltimoMes
  const semValor = indicadores.contratosSemValor ?? 0
  return (
    <section aria-label="Indicadores do cliente" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Cartao
        rotulo="Contratos ativos"
        valor={String(indicadores.contratosAtivos)}
        detalhe={`${indicadores.vencendoEm30Dias} vencendo em 30 dias${(indicadores.vencidos ?? 0) > 0 ? ` · ${indicadores.vencidos} com situação desatualizada (prazo vencido) — confira o cadastro` : ''}`}
      />
      <Cartao
        rotulo="Valor contratado"
        valor={
          semValor > 0 && semValor === indicadores.contratosAtivos ? '—' : formatarMoeda(indicadores.valorContratado)
        }
        detalhe={
          semValor === 0
            ? 'valor atual dos contratos ativos'
            : semValor === indicadores.contratosAtivos
              ? 'nenhum contrato ativo tem valor'
              : `${semValor} ${semValor === 1 ? 'contrato ativo sem valor' : 'contratos ativos sem valor'} (fora da soma)`
        }
      />
      <Cartao
        rotulo="Faturado (mês)"
        valor={ultimo && !ultimo.semValor ? formatarMoeda(ultimo.valor) : '—'}
        detalhe={
          ultimo
            ? `${MESES[ultimo.mes - 1]}/${ultimo.ano}${ultimo.semValor ? ' · nenhum lançamento com valor' : ''}`
            : 'nenhum faturamento'
        }
      />
      <Cartao
        rotulo="Demandas abertas"
        valor={String(indicadores.demandasAbertas)}
        detalhe={`${indicadores.abertasHaMaisDe30Dias} há mais de 30 dias`}
      />
    </section>
  )
}
