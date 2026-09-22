'use client'

// Aba "Documentos" da ficha do cliente: o conteúdo que a página /clientes/[id]
// tinha antes de virar ficha com abas (competências + abrir nova competência),
// movido sem mudança de comportamento.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, ChevronRight, Loader2, Calendar, Inbox, X } from 'lucide-react'
import { formatarCompetencia, nomeCompetencia } from '@/lib/competencia'
import { Badge } from '@/components/ui/badge'
import { BTN_PRIMARY, BTN_OUTLINE, INPUT_BASE } from '@/lib/ui'

interface Documento {
  id: string
  status: string
  competenciaAno: number
  competenciaMes: number
}

interface Competencia {
  ano: number
  mes: number
  quantidade: number
  erros: number
  processando: number
}

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

export function AbaDocumentos({ clienteId }: { clienteId: string }) {
  const router = useRouter()
  const [documentos, setDocumentos] = useState<Documento[]>([])
  const [carregando, setCarregando] = useState(true)
  const hoje = new Date()
  const [novoAno, setNovoAno] = useState(hoje.getFullYear())
  const [novoMes, setNovoMes] = useState(hoje.getMonth() + 1)
  const [seletorAberto, setSeletorAberto] = useState(false)

  useEffect(() => {
    fetch(`/api/documentos?clienteId=${clienteId}`)
      .then(async (response) => {
        if (response.ok) setDocumentos(await response.json())
      })
      .finally(() => setCarregando(false))
  }, [clienteId])

  const competencias: Competencia[] = (() => {
    const porCompetencia = new Map<string, Competencia>()
    for (const doc of documentos) {
      const chave = formatarCompetencia(doc.competenciaAno, doc.competenciaMes)
      const atual = porCompetencia.get(chave)
      porCompetencia.set(chave, {
        ano: doc.competenciaAno,
        mes: doc.competenciaMes,
        quantidade: (atual?.quantidade ?? 0) + 1,
        erros: (atual?.erros ?? 0) + (doc.status === 'erro' ? 1 : 0),
        processando: (atual?.processando ?? 0) + (doc.status === 'processando' ? 1 : 0),
      })
    }
    return [...porCompetencia.values()].sort((a, b) => b.ano - a.ano || b.mes - a.mes)
  })()

  useEffect(() => {
    if (!carregando) setSeletorAberto(competencias.length === 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carregando])

  function handleNovoMes() {
    router.push(`/clientes/${clienteId}/${formatarCompetencia(novoAno, novoMes)}`)
  }

  if (carregando) {
    return (
      <p className="flex items-center gap-2 text-sm text-mid-grey">
        <Loader2 className="size-4 animate-spin" strokeWidth={2.25} />
        Carregando...
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[0.95rem] font-semibold text-navy">Competências</h2>
          <p className="text-xs text-mid-grey">
            {competencias.length > 0
              ? `${competencias.length} competência${competencias.length === 1 ? '' : 's'} registrada${competencias.length === 1 ? '' : 's'}`
              : 'Documentos analisados, agrupados por mês de competência'}
          </p>
        </div>

        {!seletorAberto && (
          <button onClick={() => setSeletorAberto(true)} className={BTN_OUTLINE}>
            <Plus className="size-3.5" strokeWidth={2.25} />
            Nova competência
          </button>
        )}
      </div>

      {seletorAberto && (
        <div className="card flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-medium text-mid-grey">Mês</span>
            <select value={novoMes} onChange={(e) => setNovoMes(Number(e.target.value))} className={INPUT_BASE}>
              {MESES.map((nome, i) => (
                <option key={nome} value={i + 1}>
                  {nome}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-medium text-mid-grey">Ano</span>
            <input
              type="number"
              value={novoAno}
              onChange={(e) => setNovoAno(Number(e.target.value))}
              className={`w-24 ${INPUT_BASE}`}
            />
          </label>
          <button onClick={handleNovoMes} className={BTN_PRIMARY}>
            Abrir competência
          </button>
          {competencias.length > 0 && (
            <button
              onClick={() => setSeletorAberto(false)}
              aria-label="Fechar"
              className="ml-auto flex items-center gap-1 text-sm font-medium text-mid-grey hover:text-navy"
            >
              <X className="size-4" strokeWidth={2.25} />
            </button>
          )}
        </div>
      )}

      {competencias.length === 0 ? (
        !seletorAberto && (
          <div className="card-flush flex flex-col items-center gap-2 p-10 text-center">
            <span className="flex size-11 items-center justify-center rounded-full bg-light-grey text-mid-grey">
              <Inbox className="size-5" strokeWidth={1.75} />
            </span>
            <p className="text-sm text-mid-grey">Nenhum documento ainda. Abra uma competência pra começar.</p>
          </div>
        )
      ) : (
        <ul className="space-y-2.5">
          {competencias.map((c) => {
            const chave = formatarCompetencia(c.ano, c.mes)
            const ehAtual = c.ano === hoje.getFullYear() && c.mes === hoje.getMonth() + 1

            return (
              <li key={chave}>
                <Link
                  href={`/clientes/${clienteId}/${chave}`}
                  className="card card-interactive group flex flex-wrap items-center justify-between gap-3"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-navy/[0.05] text-navy/60 transition-colors duration-200 group-hover:bg-orange-light group-hover:text-orange">
                      <Calendar className="size-4.5" strokeWidth={1.75} />
                    </span>
                    <span className="min-w-0 space-y-0.5">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-navy capitalize">{nomeCompetencia(c.ano, c.mes)}</span>
                        {ehAtual && <Badge variant="navy-soft">Mês atual</Badge>}
                        {c.erros > 0 && (
                          <Badge variant="critical">
                            {c.erros} erro{c.erros === 1 ? '' : 's'}
                          </Badge>
                        )}
                        {c.processando > 0 && <Badge variant="neutral">{c.processando} processando</Badge>}
                      </span>
                      <span className="block text-xs text-mid-grey">
                        {c.quantidade} documento{c.quantidade === 1 ? '' : 's'}
                      </span>
                    </span>
                  </span>

                  <span className="flex shrink-0 items-center gap-1 text-sm font-medium text-mid-grey transition-colors duration-200 group-hover:text-orange">
                    Ver mês completo
                    <ChevronRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" strokeWidth={2.25} />
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
