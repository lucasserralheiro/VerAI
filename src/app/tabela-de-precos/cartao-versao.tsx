'use client'

import { AlertCircle, FileSpreadsheet, FileText, Newspaper } from 'lucide-react'
import { formatarData } from '@/lib/relatorios-clientes/formatacao'
import type { TabelaSerializada, VersaoResumo } from '@/lib/tabela-precos/tipos'

const BOTAO =
  'inline-flex items-center gap-1.5 rounded-xl border border-border-grey bg-white px-3 py-1.5 text-xs font-medium text-navy transition-colors hover:border-orange hover:text-orange'
const arquivo = (id: string) => `/api/biblioteca/${id}`

function textoDaConferencia(t: TabelaSerializada): string {
  if (!t.arquivos.pdf) return 'sem PDF oficial para conferir'
  return t.divergencias === 0 ? 'conferida com o PDF publicado' : `${t.divergencias} preço(s) diferente(s) do PDF publicado`
}

/** Versão da tabela, publicação no DOC, conferência e os arquivos de origem (spec 2026-09-29-tabela-de-precos §6). */
export function CartaoVersao({ tabela, versoes, onVersao }: { tabela: TabelaSerializada; versoes: VersaoResumo[]; onVersao: (versao: string) => void }) {
  return (
    <section className="space-y-3 rounded-2xl border border-border-grey bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="flex items-center gap-2 text-lg font-semibold text-navy">
            {tabela.versao}
            {tabela.vigente && <span className="rounded-full bg-navy/5 px-2 py-0.5 text-xs font-medium text-navy">vigente</span>}
          </p>
          <p className="text-sm text-mid-grey">
            {tabela.publicadaEm ? `publicada no DOC em ${formatarData(tabela.publicadaEm)}` : 'data de publicação não encontrada'} · {tabela.totalItens} serviços ·{' '}
            <span className={tabela.divergencias > 0 ? 'font-medium text-orange-dark' : ''}>{textoDaConferencia(tabela)}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {tabela.arquivos.pdf && (
            <a className={BOTAO} href={arquivo(tabela.arquivos.pdf)} target="_blank" rel="noreferrer">
              <FileText className="size-3.5" />
              Tabela oficial (PDF)
            </a>
          )}
          {tabela.arquivos.publicacao && (
            <a className={BOTAO} href={arquivo(tabela.arquivos.publicacao)} target="_blank" rel="noreferrer">
              <Newspaper className="size-3.5" />
              Publicação no DOC
            </a>
          )}
          {tabela.arquivos.planilha && (
            <a className={BOTAO} href={`${arquivo(tabela.arquivos.planilha)}?baixar=1`}>
              <FileSpreadsheet className="size-3.5" />
              Memória de cálculo
            </a>
          )}
        </div>
      </div>
      {tabela.arquivos.informativo && (
        <a
          href={arquivo(tabela.arquivos.informativo)}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 rounded-xl border border-orange/30 bg-orange/5 px-3 py-2 text-sm text-orange-dark hover:bg-orange/10"
        >
          <AlertCircle className="size-4 shrink-0" />
          Há alterações depois da publicação (informativo interno) — confira antes de usar o preço
        </a>
      )}
      {versoes.length > 1 && (
        <label className="flex items-center gap-2 text-xs text-mid-grey">
          Versão
          <select
            className="rounded-lg border border-border-grey bg-white px-2 py-1 text-xs text-navy"
            value={tabela.versao}
            onChange={(e) => onVersao(e.target.value)}
          >
            {versoes.map((v) => (
              <option key={v.versao} value={v.versao}>
                {v.versao}
                {v.vigente ? ' (vigente)' : ''}
              </option>
            ))}
          </select>
        </label>
      )}
    </section>
  )
}
