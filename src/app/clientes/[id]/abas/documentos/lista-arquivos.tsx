'use client'

import { useState } from 'react'
import { FileSpreadsheet, FileText, File as FileIcon, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { INPUT_BASE } from '@/lib/ui'
import { CATEGORIAS, formatarTamanho, rotuloCategoria } from '@/lib/arquivos/tipos'
import { formatarData } from '@/lib/relatorios-clientes/formatacao'
import { competenciasDoArquivo, contratosDoArquivo, opcoesDeContrato, rotuloCompetencias, rotuloContratos } from './derivados'
import type { ArquivoRepositorio } from './tipos'

function IconeArquivo({ extensao }: { extensao: string }) {
  if (['xlsx', 'xls', 'csv'].includes(extensao)) return <FileSpreadsheet className="size-4 shrink-0 text-green-ok" strokeWidth={2} />
  if (extensao === 'pdf') return <FileText className="size-4 shrink-0 text-red-crit" strokeWidth={2} />
  return <FileIcon className="size-4 shrink-0 text-mid-grey" strokeWidth={2} />
}

export function ListaArquivos({
  arquivos,
  selecionadoId,
  aoSelecionar,
}: {
  arquivos: ArquivoRepositorio[]
  selecionadoId: string | null
  aoSelecionar: (arquivo: ArquivoRepositorio) => void
}) {
  const [categoria, setCategoria] = useState('')
  const [contratoId, setContratoId] = useState('')
  const [tipo, setTipo] = useState('')
  const [competencia, setCompetencia] = useState('') // AAAA-MM do <input type="month">
  const [busca, setBusca] = useState('')

  const contratos = opcoesDeContrato(arquivos)
  const tipos = [...new Set(arquivos.map((a) => a.extensao).filter(Boolean))].sort()
  const termo = busca.trim().toLowerCase()
  const [anoFiltro, mesFiltro] = competencia ? competencia.split('-').map(Number) : [null, null]
  const visiveis = arquivos.filter(
    (a) =>
      (!categoria || a.categoria === categoria) &&
      (!contratoId || contratosDoArquivo(a).some((c) => c.id === contratoId)) &&
      (!tipo || a.extensao === tipo) &&
      (!competencia || competenciasDoArquivo(a).some((c) => c.ano === anoFiltro && c.mes === mesFiltro)) &&
      (!termo || a.nome.toLowerCase().includes(termo))
  )

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-mid-grey" strokeWidth={2.25} />
          <input
            aria-label="Buscar por nome"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome"
            className={cn(INPUT_BASE, 'w-56 pl-8')}
          />
        </label>
        <select aria-label="Filtrar por categoria" value={categoria} onChange={(e) => setCategoria(e.target.value)} className={cn(INPUT_BASE, 'w-48')}>
          <option value="">Todas as categorias</option>
          {CATEGORIAS.map((c) => (
            <option key={c.valor} value={c.valor}>
              {c.rotulo}
            </option>
          ))}
        </select>
        <select aria-label="Filtrar por contrato" value={contratoId} onChange={(e) => setContratoId(e.target.value)} className={cn(INPUT_BASE, 'w-44')}>
          <option value="">Todos os contratos</option>
          {contratos.map((c) => (
            <option key={c.id} value={c.id}>
              {c.numeroTermo ?? '(sem número)'}
            </option>
          ))}
        </select>
        <select aria-label="Filtrar por tipo" value={tipo} onChange={(e) => setTipo(e.target.value)} className={cn(INPUT_BASE, 'w-28')}>
          <option value="">Todos os tipos</option>
          {tipos.map((t) => (
            <option key={t} value={t}>
              {t.toUpperCase()}
            </option>
          ))}
        </select>
        <input
          type="month"
          aria-label="Filtrar por competência"
          value={competencia}
          onChange={(e) => setCompetencia(e.target.value)}
          className={cn(INPUT_BASE, 'w-40')}
        />
      </div>

      {visiveis.length === 0 ? (
        <div className="card-flush p-10 text-center text-sm text-mid-grey">
          {arquivos.length === 0 ? 'Nenhum arquivo neste cliente ainda.' : 'Nenhum arquivo com esses filtros.'}
        </div>
      ) : (
        <div className="card-flush overflow-x-auto">
          <table className="table-institucional">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Categoria</th>
                <th>Contrato</th>
                <th>Competência</th>
                <th>Tamanho</th>
                <th>Enviado</th>
                <th>Usado em</th>
              </tr>
            </thead>
            <tbody>
              {visiveis.map((a) => (
                <tr
                  key={a.id}
                  onClick={() => aoSelecionar(a)}
                  className={cn('cursor-pointer', a.id === selecionadoId && 'bg-orange/[0.06]')}
                >
                  <td>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        aoSelecionar(a)
                      }}
                      aria-current={a.id === selecionadoId ? 'true' : undefined}
                      className="flex items-center gap-2 text-left font-medium text-navy hover:text-orange hover:underline"
                    >
                      <IconeArquivo extensao={a.extensao} />
                      <span className="truncate">{a.nome}</span>
                    </button>
                  </td>
                  <td className="whitespace-nowrap">{rotuloCategoria(a.categoria)}</td>
                  <td className="font-mono text-xs whitespace-nowrap">{rotuloContratos(a)}</td>
                  <td className="whitespace-nowrap">{rotuloCompetencias(a)}</td>
                  <td className="font-mono text-xs whitespace-nowrap">{formatarTamanho(a.tamanhoBytes)}</td>
                  <td className="text-xs whitespace-nowrap text-mid-grey">
                    {a.enviadoPor?.nome ?? (a.origem === 'migrado' ? 'migrado' : a.origem === 'sharepoint' ? 'SharePoint' : '—')} · {formatarData(a.createdAt)}
                  </td>
                  <td className="font-mono text-xs">{a.usos.length || <span className="font-sans text-mid-grey">não usado</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
