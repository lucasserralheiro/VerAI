'use client'

import { useState } from 'react'
import Link from 'next/link'
import { AlertCircle, FileCode2, FileSpreadsheet, FileText, File as FileIcon, Loader2, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { INPUT_BASE } from '@/lib/ui'
import { CATEGORIAS, formatarTamanho, rotuloCategoria } from '@/lib/arquivos/tipos'
import { formatarData } from '@/lib/relatorios-clientes/formatacao'
import { competenciasDoArquivo, contratosDoArquivo, foraDoSharepoint, opcoesDeContrato, rotuloCompetencias, rotuloContratos } from './derivados'
import { conversaoDoArquivo, podeConverter, useConverterArquivo } from './converter-arquivo'
import type { ArquivoRepositorio } from './tipos'

const BTN_ICONE =
  'inline-flex size-7 items-center justify-center rounded-md text-mid-grey hover:bg-orange/10 hover:text-orange disabled:opacity-50'

function IconeArquivo({ extensao }: { extensao: string }) {
  if (['xlsx', 'xls', 'csv'].includes(extensao)) return <FileSpreadsheet className="size-4 shrink-0 text-green-ok" strokeWidth={2} />
  if (extensao === 'pdf') return <FileText className="size-4 shrink-0 text-red-crit" strokeWidth={2} />
  return <FileIcon className="size-4 shrink-0 text-mid-grey" strokeWidth={2} />
}

/** Atalho da linha para a conversão em Markdown — o mesmo do painel, sem precisar abri-lo. */
function AcaoConverter({
  arquivo,
  convertendo,
  ocupado,
  aoConverter,
}: {
  arquivo: ArquivoRepositorio
  convertendo: boolean
  ocupado: boolean
  aoConverter: () => void
}) {
  const conversao = conversaoDoArquivo(arquivo)
  if (conversao) {
    const rotulo = `Abrir ${arquivo.nome} em Markdown`
    return (
      <Link href={conversao.href} aria-label={rotulo} title="Abrir em Markdown" className={cn(BTN_ICONE, 'text-navy')}>
        <FileCode2 className="size-4" strokeWidth={2.25} />
      </Link>
    )
  }
  if (!podeConverter(arquivo)) return null
  return (
    <button
      type="button"
      onClick={aoConverter}
      disabled={ocupado}
      aria-label={`Converter ${arquivo.nome} em Markdown`}
      title={convertendo ? 'Convertendo...' : 'Converter em Markdown'}
      className={BTN_ICONE}
    >
      {convertendo ? <Loader2 className="size-4 animate-spin" strokeWidth={2.25} /> : <FileCode2 className="size-4" strokeWidth={2.25} />}
    </button>
  )
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
  const { converter, convertendoId, erro } = useConverterArquivo()

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

      {erro && (
        <p className="flex items-center gap-1.5 rounded-lg bg-red-crit-light px-3 py-2 text-sm text-red-crit">
          <AlertCircle className="size-4 shrink-0" strokeWidth={2.25} />
          {erro}
        </p>
      )}

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
                <th>
                  <span className="sr-only">Ações</span>
                </th>
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
                      {foraDoSharepoint(a) && (
                        <span className="shrink-0 rounded bg-light-grey px-1.5 py-0.5 text-[0.65rem] font-medium text-mid-grey">
                          fora do SharePoint
                        </span>
                      )}
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
                  <td className="w-px" onClick={(e) => e.stopPropagation()}>
                    <AcaoConverter
                      arquivo={a}
                      convertendo={convertendoId === a.id}
                      ocupado={convertendoId !== null}
                      aoConverter={() => converter(a)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
