'use client'

import { useEffect, useState } from 'react'
import { AlertCircle, FileText } from 'lucide-react'
import { formatarMoeda } from '@/lib/relatorios-clientes/formatacao'
import { nomeDoMes, type ControleSerializado, type LinhaControle } from '@/lib/controles-contratos/tipos'

// Cartão "Controle do faturamento" no detalhe do contrato (spec
// docs/superpowers/specs/2026-09-29-controles-de-contratos-design.md §6.1): o controle mensal da equipe do
// faturamento, lido do SharePoint. Sem controle, não aparece; leitura não conferida não mostra número.

const pct = (v: number) => `${v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
const centavos = (v: string) => Math.round(Number(v) * 100)

export function CartaoControle({ contratoId }: { contratoId: string }) {
  const [dados, setDados] = useState<{ controle: ControleSerializado; linhas: LinhaControle[] } | null>(null)

  useEffect(() => {
    let ativo = true
    fetch(`/api/contratos/${contratoId}/controle`)
      .then((r) => (r.ok ? r.json() : null))
      .then((corpo) => {
        if (ativo && corpo?.controle) setDados(corpo)
      })
      .catch(() => {})
    return () => {
      ativo = false
    }
  }, [contratoId])

  if (!dados) return null
  const { controle: c, linhas } = dados
  const previstos = linhas.filter((l) => l.tipo === 'previsto')
  const faturados = linhas.filter((l) => l.tipo === 'faturado')
  const lado = previstos.length === faturados.length
  const saldoDiferente = c.saldoCalculado !== null && c.saldoDocumento !== null && Math.abs(centavos(c.saldoCalculado) - centavos(c.saldoDocumento)) > 5
  const avisos = [...c.avisos, ...(saldoDiferente ? [`o controle informa saldo de ${formatarMoeda(c.saldoDocumento)}; previsto − faturado dá ${formatarMoeda(c.saldoCalculado)}`] : [])]

  return (
    <section aria-label="Controle do faturamento" className="card space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-[0.95rem] font-semibold text-navy">Controle do faturamento</h2>
          <p className="text-xs text-mid-grey">
            Controle de {nomeDoMes(c.mes)}
            {c.termoTexto ? ` · ${c.termoTexto}` : ''}
            {c.vigenciaTexto ? ` · vigência ${c.vigenciaTexto}` : ''} — planilha da equipe do faturamento, lida do SharePoint
          </p>
        </div>
        <a
          href={`/api/biblioteca/${c.arquivoId}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-navy hover:text-orange"
        >
          <FileText className="size-3.5" />
          Abrir o controle (PDF)
        </a>
      </div>

      {!c.conferido && (
        <p className="flex items-center gap-2 rounded-xl border border-orange/30 bg-orange/5 px-3 py-2 text-xs text-orange-dark">
          <AlertCircle className="size-4 shrink-0" />
          Leitura não conferida: as contas deste controle não fecharam — confira no PDF.
        </p>
      )}

      {c.conferido && c.previsto !== null && c.faturado !== null && (
        <>
          <dl className="grid grid-cols-3 gap-3">
            <div>
              <dt className="text-xs text-mid-grey">Previsto no período</dt>
              <dd className="font-mono text-sm font-semibold text-navy">{formatarMoeda(c.previsto)}</dd>
            </div>
            <div>
              <dt className="text-xs text-mid-grey">Faturado</dt>
              <dd className="font-mono text-sm font-semibold text-navy">{formatarMoeda(c.faturado)}</dd>
              {c.percentual !== null && <dd className="text-xs text-mid-grey">{pct(c.percentual)}</dd>}
            </div>
            <div>
              <dt className="text-xs text-mid-grey">Saldo a faturar</dt>
              <dd className="font-mono text-sm font-semibold text-navy">{formatarMoeda(c.saldoCalculado)}</dd>
            </div>
          </dl>
          {c.percentual !== null && (
            <div className="h-2 overflow-hidden rounded-full bg-light-grey" aria-hidden="true">
              <div className={c.percentual > 100 ? 'h-full bg-orange' : 'h-full bg-navy'} style={{ width: `${Math.min(100, c.percentual)}%` }} />
            </div>
          )}
          {faturados.length > 0 && (
            <table className="w-full text-xs">
              <thead className="text-mid-grey">
                <tr>
                  <th className="py-1 text-left font-medium">Período</th>
                  {lado && <th className="py-1 text-right font-medium">Previsto</th>}
                  <th className="py-1 text-right font-medium">Faturado</th>
                </tr>
              </thead>
              <tbody>
                {faturados.map((l, i) => (
                  <tr key={`${l.rotulo}-${i}`} className={Number(l.valor) === 0 ? 'text-mid-grey' : 'text-foreground'}>
                    <td className="py-1">{l.rotulo}</td>
                    {lado && <td className="py-1 text-right font-mono">{formatarMoeda(previstos[i].valor)}</td>}
                    <td className="py-1 text-right font-mono">{formatarMoeda(l.valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}

      {avisos.length > 0 && (
        <ul className="space-y-1 text-xs text-orange-dark">
          {avisos.map((a) => (
            <li key={a} className="flex items-start gap-1.5">
              <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              {a}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
