'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { fetchComPreCarga } from '@/lib/relatorios-clientes/prefetch'
import Link from 'next/link'
import { AlertCircle, FileText, Loader2, Plus, Receipt, Search, Trash2, Upload, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BTN_PRIMARY, INPUT_BASE, LINK_DANGER, LINK_NAVY } from '@/lib/ui'
import { formatarMoeda } from '@/lib/relatorios-clientes/formatacao'
import { avisarMudancaDeDados } from '@/lib/relatorios-clientes/atualizacao-dados'
import { SeiLink } from '@/components/relatorios-clientes/sei-link'
import { agruparPorCompetencia, resumirFaturamentos } from '@/lib/relatorios-clientes/resumo-faturamento'
import {
  FormularioFaturamento,
  MESES,
  competencia,
  type Faturamento,
  type ModeloFaturamento,
  type OpcaoContrato,
} from '../faturamentos/formulario-faturamento'

/** "Cliente ● sim" / "GFP ● pendente": o rótulo fica fora do pill, que só diz sim ou pendente. */
function EtapaEnvio({ rotulo, enviado }: { rotulo: string; enviado: boolean | null }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-11 text-[0.65rem] font-medium tracking-wide text-mid-grey uppercase">{rotulo}</span>
      <span
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[0.72rem] font-bold whitespace-nowrap',
          enviado ? 'bg-green-ok-light text-green-ok' : 'bg-orange-light text-orange-dark'
        )}
      >
        <span className="size-1.5 rounded-full bg-current" aria-hidden />
        {enviado ? 'sim' : 'pendente'}
      </span>
    </div>
  )
}

function Indicador({ rotulo, valor, detalhe, alerta }: { rotulo: string; valor: string; detalhe?: string; alerta?: boolean }) {
  return (
    <div className="rounded-xl border border-border-grey bg-white px-4 py-3 shadow-xs">
      <div className="text-[0.68rem] font-semibold tracking-wide text-mid-grey uppercase">{rotulo}</div>
      <div className={cn('mt-0.5 font-mono text-lg font-semibold', alerta ? 'text-orange-dark' : 'text-navy')}>{valor}</div>
      {detalhe && <div className="text-xs text-mid-grey">{detalhe}</div>}
    </div>
  )
}

/** Primeiro ano oferecido no filtro, mesmo sem lançamento carregado. */
const ANO_INICIAL_FILTRO = 2015

export function AbaFaturamento({ clienteId }: { clienteId: string }) {
  const [faturamentos, setFaturamentos] = useState<Faturamento[]>([])
  const [contratos, setContratos] = useState<OpcaoContrato[] | null>(null)
  const [filtros, setFiltros] = useState({ ano: '', mes: '', contratoId: '' })
  // Anos que já apareceram nas listas carregadas: o filtro de ano é aplicado no servidor, então a
  // lista atual sozinha faria as outras opções sumirem assim que um ano fosse escolhido.
  const [anosConhecidos, setAnosConhecidos] = useState<number[]>([])
  const [busca, setBusca] = useState('')
  const [soPendentes, setSoPendentes] = useState(false)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  // 'novo' = criando um faturamento; um Faturamento = editando aquela linha; null = modal fechado.
  const [modalFaturamento, setModalFaturamento] = useState<'novo' | Faturamento | null>(null)
  // Pré-preenchimento do 'novo' quando vem do "+ Lançamento" de uma competência.
  const [modelo, setModelo] = useState<ModeloFaturamento | undefined>(undefined)

  async function carregar() {
    const query = new URLSearchParams(Object.entries(filtros).filter(([, valor]) => valor)).toString()
    try {
      const response = await fetchComPreCarga(`/api/clientes/${clienteId}/faturamentos${query ? `?${query}` : ''}`)
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        setErro(body?.error ?? 'Falha ao carregar faturamentos.')
        return
      }
      setErro(null)
      const lista = await response.json()
      const recebidos: Faturamento[] = Array.isArray(lista) ? lista : []
      setFaturamentos(recebidos)
      setAnosConhecidos((atuais) => {
        const anos = new Set(atuais)
        for (const { competenciaAno } of recebidos) {
          // O import trouxe competências com lixo (ano 26, 20252) — só anos plausíveis viram opção.
          if (competenciaAno !== null && competenciaAno >= 2000 && competenciaAno <= 2100) anos.add(competenciaAno)
        }
        return anos.size === atuais.length ? atuais : Array.from(anos)
      })
    } catch {
      setErro('Falha de conexão ao carregar faturamentos.')
    }
  }

  // Faixa fixa (do ano atual + 2 até 2015) unida aos anos que aparecem nos dados: dá pra filtrar
  // um ano ainda sem lançamento ou um ano antigo, e anos fora da faixa que existam no banco não somem.
  const anoAtual = new Date().getFullYear()
  const opcoesAno = (() => {
    const anos = new Set<number>(anosConhecidos)
    if (filtros.ano) anos.add(Number(filtros.ano))
    for (let ano = anoAtual + 2; ano >= ANO_INICIAL_FILTRO; ano--) anos.add(ano)
    return Array.from(anos).sort((a, b) => b - a)
  })()

  useEffect(() => {
    carregar().finally(() => setCarregando(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteId, filtros])

  // Contratos do cliente: alimentam o filtro e o select do formulário.
  useEffect(() => {
    fetch(`/api/clientes/${clienteId}/contratos`)
      .then(async (response) => {
        if (!response.ok) return
        const lista = await response.json()
        if (Array.isArray(lista)) setContratos(lista)
      })
      .catch(() => {})
  }, [clienteId])

  const faturamentosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return faturamentos.filter((faturamento) => {
      if (soPendentes && faturamento.enviadoCliente && faturamento.enviadoGfp) return false
      if (!termo) return true
      return [faturamento.contrato.numeroTermo, faturamento.sei, faturamento.unidadeDestino, faturamento.situacao, faturamento.observacao, ...faturamento.servicos].some(
        (campo) => campo?.toLowerCase().includes(termo)
      )
    })
  }, [faturamentos, busca, soPendentes])

  const resumo = useMemo(() => resumirFaturamentos(faturamentosFiltrados), [faturamentosFiltrados])
  const grupos = useMemo(() => agruparPorCompetencia(faturamentosFiltrados), [faturamentosFiltrados])

  if (carregando) {
    return (
      <p className="flex items-center gap-2 text-sm text-mid-grey">
        <Loader2 className="size-4 animate-spin" strokeWidth={2.25} />
        Carregando...
      </p>
    )
  }

  const filtrar = (campo: keyof typeof filtros, valor: string) => setFiltros((atual) => ({ ...atual, [campo]: valor }))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[0.95rem] font-semibold text-navy">Faturamento</h2>
          <p className="text-xs text-mid-grey">Um lançamento por mês/contrato, com notas fiscais associadas</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative">
            <span className="sr-only">Buscar faturamento</span>
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-mid-grey" strokeWidth={2.25} />
            <input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por contrato, SEI, serviço..."
              className={`${INPUT_BASE} w-64 py-1.5 pl-8 text-sm`}
            />
          </label>
          <button type="button" onClick={() => {
              setModelo(undefined)
              setModalFaturamento('novo')
            }}
            className={BTN_PRIMARY}>
            <Plus className="size-3.5" strokeWidth={2.25} />
            Novo faturamento
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <select aria-label="Filtrar por ano" value={filtros.ano} onChange={(e) => filtrar('ano', e.target.value)} className={INPUT_BASE}>
          <option value="">Todos os anos</option>
          {opcoesAno.map((ano) => (
            <option key={ano} value={String(ano)}>
              {ano}
            </option>
          ))}
        </select>
        <select aria-label="Filtrar por mês" value={filtros.mes} onChange={(e) => filtrar('mes', e.target.value)} className={INPUT_BASE}>
          <option value="">Todos os meses</option>
          {MESES.map((nome, i) => (
            <option key={nome} value={String(i + 1)}>
              {nome}
            </option>
          ))}
        </select>
        <select
          aria-label="Filtrar por contrato"
          value={filtros.contratoId}
          onChange={(e) => filtrar('contratoId', e.target.value)}
          className={INPUT_BASE}
        >
          <option value="">Todos os contratos</option>
          {contratos?.map((contrato) => (
            <option key={contrato.id} value={contrato.id}>
              {contrato.numeroTermo ?? '(sem número)'}
            </option>
          ))}
        </select>
        <button
          type="button"
          aria-pressed={soPendentes}
          onClick={() => setSoPendentes((atual) => !atual)}
          className={cn(
            'rounded-xl border px-3 py-2 text-sm font-medium transition-colors',
            soPendentes
              ? 'border-orange bg-orange-light text-orange-dark'
              : 'border-border-grey bg-white text-mid-grey hover:text-navy'
          )}
        >
          Só pendentes de envio
        </button>
      </div>

      {faturamentos.length > 0 && (
        <dl aria-label="Resumo do faturamento" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Indicador rotulo="Lançamentos" valor={String(resumo.total)} detalhe={`${grupos.length} ${grupos.length === 1 ? 'competência' : 'competências'}`} />
          <Indicador rotulo="Valor faturado" valor={formatarMoeda(resumo.valorTotal)} detalhe="soma das notas fiscais (ou do valor lançado)" />
          <Indicador
            rotulo="Enviado ao cliente"
            valor={`${resumo.enviadoCliente}/${resumo.total}`}
            detalhe={resumo.total - resumo.enviadoCliente > 0 ? `${resumo.total - resumo.enviadoCliente} pendente(s)` : 'tudo enviado'}
            alerta={resumo.total - resumo.enviadoCliente > 0}
          />
          <Indicador
            rotulo="Enviado ao GFP"
            valor={`${resumo.enviadoGfp}/${resumo.total}`}
            detalhe={resumo.total - resumo.enviadoGfp > 0 ? `${resumo.total - resumo.enviadoGfp} pendente(s)` : 'tudo enviado'}
            alerta={resumo.total - resumo.enviadoGfp > 0}
          />
        </dl>
      )}

      {erro ? (
        <p className="flex items-center gap-1.5 rounded-xl bg-red-crit-light p-4 text-sm text-red-crit">
          <AlertCircle className="size-4 shrink-0" strokeWidth={2.25} />
          {erro}
        </p>
      ) : faturamentos.length === 0 ? (
        <div className="card-flush flex flex-col items-center gap-2 p-10 text-center">
          <span className="flex size-11 items-center justify-center rounded-full bg-light-grey text-mid-grey">
            <Receipt className="size-5" strokeWidth={1.75} />
          </span>
          <p className="text-sm text-mid-grey">Nenhum faturamento encontrado.</p>
        </div>
      ) : faturamentosFiltrados.length === 0 ? (
        <div className="card-flush flex flex-col items-center gap-2 p-10 text-center">
          <span className="flex size-11 items-center justify-center rounded-full bg-light-grey text-mid-grey">
            <Search className="size-5" strokeWidth={1.75} />
          </span>
          <p className="text-sm text-mid-grey">Nenhum faturamento encontrado para &quot;{busca}&quot;.</p>
        </div>
      ) : (
        <div className="card-flush overflow-x-auto">
          <table className="table-institucional">
            <thead>
              <tr>
                <th>Contrato</th>
                <th>SEI faturamento</th>
                <th>Serviço e destino</th>
                <th className="text-right">Valor</th>
                <th>Observação</th>
                <th>Envio</th>
                <th>
                  <span className="sr-only">PDF</span>
                </th>
              </tr>
            </thead>
            {grupos.map((grupo) => (
              <tbody key={grupo.chave}>
                {/* Cabeçalho da competência: faixa azulada com filete laranja, bem diferente das linhas
                    de lançamento (que são todas brancas, sem zebra — a zebra contava o cabeçalho
                    como linha e fazia mês e lançamento parecerem a mesma coisa). */}
                <tr className="border-t-2 border-navy/15 bg-navy/[0.08]! hover:bg-navy/[0.08]!">
                  <td colSpan={7} className="border-l-4 border-orange py-2.5!">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                      <h3 className="text-sm font-bold text-navy">{grupo.rotulo}</h3>
                      <div className="flex items-center gap-3">
                        <p className="text-xs text-navy/70">
                          {grupo.itens.length} {grupo.itens.length === 1 ? 'lançamento' : 'lançamentos'}
                          <span className="mx-1.5" aria-hidden>
                            ·
                          </span>
                          <span className="font-mono font-semibold text-navy">{formatarMoeda(grupo.valorTotal)}</span>
                          {grupo.pendentes > 0 && (
                            <>
                              <span className="mx-1.5" aria-hidden>
                                ·
                              </span>
                              <span className="font-semibold text-orange-dark">{grupo.pendentes} com envio pendente</span>
                            </>
                          )}
                        </p>
                        {grupo.chave !== 'sem-competencia' && (
                          <button
                            type="button"
                            onClick={() => {
                              const primeiro = grupo.itens[0]
                              // Contrato vem preenchido só quando a competência tem um contrato só;
                              // com vários, escolher é decisão de quem lança.
                              const unico = grupo.itens.every((item) => item.contratoId === primeiro.contratoId)
                              setModelo({
                                competenciaAno: primeiro.competenciaAno!,
                                competenciaMes: primeiro.competenciaMes!,
                                contratoId: unico ? primeiro.contratoId : undefined,
                              })
                              setModalFaturamento('novo')
                            }}
                            aria-label={`Adicionar lançamento em ${grupo.rotulo}`}
                            className="inline-flex items-center gap-1 rounded-md border border-navy/20 bg-white px-2 py-0.5 text-[0.7rem] font-semibold text-navy hover:border-orange hover:text-orange"
                          >
                            <Plus className="size-3" strokeWidth={2.5} />
                            Lançamento
                          </button>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
                {grupo.itens.map((faturamento) => (
                  <tr
                    key={faturamento.id}
                    onClick={() => setModalFaturamento(faturamento)}
                    className="cursor-pointer bg-white! hover:bg-orange-light/40!"
                  >
                    <td className="font-mono text-xs font-semibold whitespace-nowrap">
                      {faturamento.contrato.numeroTermo ? (
                        <Link
                          href={`/clientes/${clienteId}/contratos/${faturamento.contratoId}`}
                          onClick={(e) => e.stopPropagation()}
                          title="Abrir o contrato"
                          className="text-navy hover:text-orange hover:underline"
                        >
                          {faturamento.contrato.numeroTermo}
                        </Link>
                      ) : (
                        <span className="text-navy">—</span>
                      )}
                    </td>
                    <td className="font-mono text-xs whitespace-nowrap">
                      <div className="flex flex-col items-start gap-0.5">
                        {faturamento.sei ? <SeiLink numero={faturamento.sei} /> : <span className="text-mid-grey">(sem SEI)</span>}
                        <Link
                          href={`/clientes/${clienteId}/faturamentos/${faturamento.id}`}
                          onClick={(e) => e.stopPropagation()}
                          title={`Abrir o faturamento de ${competencia(faturamento)}`}
                          className="font-sans text-[0.68rem] font-medium text-mid-grey hover:text-orange hover:underline"
                        >
                          ver lançamento
                        </Link>
                      </div>
                    </td>
                    <td className="min-w-[12rem]">
                      <div className="text-[0.8rem] leading-snug">
                        {faturamento.servicos.length > 0 ? faturamento.servicos.join(', ') : <span className="text-mid-grey/60">—</span>}
                      </div>
                      {(faturamento.unidadeDestino || faturamento.situacao) && (
                        <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-mid-grey">
                          {faturamento.unidadeDestino && <span>Destino: {faturamento.unidadeDestino}</span>}
                          {faturamento.situacao && <span>Situação: {faturamento.situacao}</span>}
                        </div>
                      )}
                    </td>
                    <td
                      className={cn(
                        'text-right font-mono text-xs whitespace-nowrap',
                        Number(faturamento.valorExibido) === 0 ? 'text-mid-grey/70' : 'font-semibold text-navy'
                      )}
                    >
                      {faturamento.semNota ? (
                        <span className="font-sans" title="Nenhum valor lançado e nenhuma nota fiscal neste lançamento">
                          sem nota
                        </span>
                      ) : (
                        formatarMoeda(faturamento.valorExibido)
                      )}
                    </td>
                    <td className="max-w-[16rem]">
                      {faturamento.observacao ? (
                        <span className="line-clamp-2 text-[0.8rem] leading-snug" title={faturamento.observacao}>
                          {faturamento.observacao}
                        </span>
                      ) : (
                        <span className="text-mid-grey/60">—</span>
                      )}
                    </td>
                    <td>
                      <div className="flex flex-col gap-1">
                        {/* Tudo enviado = um selo só (o caso comum não repete "sim" duas vezes por
                            linha); pendência abre as duas etapas pra mostrar qual falta. */}
                        {faturamento.enviadoCliente && faturamento.enviadoGfp ? (
                          <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-green-ok-light px-2.5 py-0.5 text-[0.72rem] font-bold whitespace-nowrap text-green-ok">
                            <span className="size-1.5 rounded-full bg-current" aria-hidden />
                            Enviado
                          </span>
                        ) : (
                          <>
                            <EtapaEnvio rotulo="Cliente" enviado={faturamento.enviadoCliente} />
                            <EtapaEnvio rotulo="GFP" enviado={faturamento.enviadoGfp} />
                          </>
                        )}
                        {faturamento.complementar && (
                          <span className="w-fit rounded-md bg-navy/10 px-2 py-0.5 text-[0.68rem] font-semibold text-navy">Complementar</span>
                        )}
                      </div>
                    </td>
                    <td>
                      {faturamento.pdfUrl ? (
                        <a
                          href={faturamento.pdfUrl}
                          target="_blank"
                          rel="noreferrer"
                          title={`Ver PDF anexado${faturamento.pdfNomeArquivo ? `: ${faturamento.pdfNomeArquivo}` : ''}`}
                          aria-label="Ver PDF anexado ao faturamento"
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center justify-center rounded-md p-1 text-orange hover:bg-orange-light hover:text-orange-dark"
                        >
                          <FileText className="size-4" strokeWidth={2} />
                        </a>
                      ) : (
                        <span className="block text-center text-mid-grey/60">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
      )}

      <ModalFaturamento
        estado={modalFaturamento}
        modelo={modelo}
        clienteId={clienteId}
        contratos={contratos}
        aoFechar={() => setModalFaturamento(null)}
        aoSalvar={async () => {
          setModalFaturamento(null)
          await carregar()
          avisarMudancaDeDados()
        }}
        aoExcluir={async () => {
          setModalFaturamento(null)
          await carregar()
          avisarMudancaDeDados()
        }}
        aoAtualizarLista={async () => {
          await carregar()
          avisarMudancaDeDados()
        }}
      />
    </div>
  )
}

/** Modal nativo (`<dialog>` + `showModal()`) reaproveitando o mesmo formulário pra criar E
 *  editar — mesmo padrão do modal de contratos em `aba-contratos.tsx`. */
function ModalFaturamento({
  estado,
  modelo,
  clienteId,
  contratos,
  aoFechar,
  aoSalvar,
  aoExcluir,
  aoAtualizarLista,
}: {
  estado: 'novo' | Faturamento | null
  modelo?: ModeloFaturamento
  clienteId: string
  contratos: OpcaoContrato[] | null
  aoFechar: () => void
  aoSalvar: (salvo: Faturamento) => void
  aoExcluir: (excluido: Faturamento) => void
  aoAtualizarLista: () => void
}) {
  const dialogoRef = useRef<HTMLDialogElement>(null)
  const faturamento = estado === 'novo' ? undefined : (estado ?? undefined)
  const aberto = estado !== null

  useEffect(() => {
    const el = dialogoRef.current
    if (!el) return
    if (aberto && !el.open) {
      el.showModal()
    } else if (!aberto && el.open) {
      el.close()
    }
  }, [aberto])

  return (
    <dialog
      ref={dialogoRef}
      onClose={aoFechar}
      onClick={(e) => {
        if (e.target === dialogoRef.current) dialogoRef.current?.close()
      }}
      aria-label={faturamento ? 'Editar faturamento' : 'Novo faturamento'}
      className="w-[min(48rem,calc(100vw-2rem))] border-0 bg-transparent p-0"
    >
      {aberto && (
        <ConteudoModalFaturamento
          key={faturamento?.id ?? `novo-${modelo?.competenciaAno ?? ''}-${modelo?.competenciaMes ?? ''}`}
          clienteId={clienteId}
          contratos={contratos}
          faturamento={faturamento}
          modelo={modelo}
          aoSalvar={aoSalvar}
          aoExcluir={aoExcluir}
          aoCancelar={() => dialogoRef.current?.close()}
          aoAtualizarLista={aoAtualizarLista}
        />
      )}
    </dialog>
  )
}

function ConteudoModalFaturamento({
  clienteId,
  contratos,
  faturamento,
  modelo,
  aoSalvar,
  aoExcluir,
  aoCancelar,
  aoAtualizarLista,
}: {
  clienteId: string
  contratos: OpcaoContrato[] | null
  faturamento: Faturamento | undefined
  modelo?: ModeloFaturamento
  aoSalvar: (salvo: Faturamento) => void
  aoExcluir: (excluido: Faturamento) => void
  aoCancelar: () => void
  aoAtualizarLista: () => void
}) {
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false)
  const [excluindo, setExcluindo] = useState(false)
  const [erroExclusao, setErroExclusao] = useState<string | null>(null)
  const [pdf, setPdf] = useState({ url: faturamento?.pdfUrl ?? null, nome: faturamento?.pdfNomeArquivo ?? null })
  const [enviandoPdf, setEnviandoPdf] = useState(false)
  const [erroPdf, setErroPdf] = useState<string | null>(null)

  async function handleExcluir() {
    if (!faturamento) return
    setExcluindo(true)
    setErroExclusao(null)
    try {
      const response = await fetch(`/api/faturamentos/${faturamento.id}`, { method: 'DELETE' })
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        setErroExclusao(body?.error ?? 'Falha ao excluir o faturamento.')
        setConfirmandoExclusao(false)
        return
      }
      aoExcluir(faturamento)
    } catch {
      setErroExclusao('Falha de conexão ao excluir o faturamento.')
      setConfirmandoExclusao(false)
    } finally {
      setExcluindo(false)
    }
  }

  async function handleAnexarPdf(arquivo: File) {
    if (!faturamento) return
    setEnviandoPdf(true)
    setErroPdf(null)
    try {
      const corpo = new FormData()
      corpo.append('arquivo', arquivo)
      const response = await fetch(`/api/faturamentos/${faturamento.id}/pdf`, { method: 'POST', body: corpo })
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        setErroPdf(body?.error ?? 'Falha ao anexar o PDF.')
        return
      }
      const atualizado = await response.json()
      setPdf({ url: atualizado.pdfUrl ?? null, nome: atualizado.pdfNomeArquivo ?? null })
      aoAtualizarLista()
    } catch {
      setErroPdf('Falha de conexão ao anexar o PDF.')
    } finally {
      setEnviandoPdf(false)
    }
  }

  async function handleRemoverPdf() {
    if (!faturamento) return
    setEnviandoPdf(true)
    setErroPdf(null)
    try {
      const response = await fetch(`/api/faturamentos/${faturamento.id}/pdf`, { method: 'DELETE' })
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        setErroPdf(body?.error ?? 'Falha ao remover o PDF.')
        return
      }
      setPdf({ url: null, nome: null })
      aoAtualizarLista()
    } catch {
      setErroPdf('Falha de conexão ao remover o PDF.')
    } finally {
      setEnviandoPdf(false)
    }
  }

  const rodape = faturamento && (
    <div className="space-y-3 border-t border-border-grey pt-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={`/clientes/${clienteId}/faturamentos/${faturamento.id}`} className={`${LINK_NAVY} text-xs`}>
          <FileText className="size-3.5" strokeWidth={2.25} />
          Ver notas fiscais
        </Link>
        <div className="flex items-center gap-2 text-xs">
          {pdf.url ? (
            <>
              <a href={pdf.url} target="_blank" rel="noreferrer" className={`${LINK_NAVY} text-xs`}>
                <FileText className="size-3.5" strokeWidth={2.25} />
                {pdf.nome ?? 'Ver PDF anexado'}
              </a>
              <button
                type="button"
                disabled={enviandoPdf}
                onClick={handleRemoverPdf}
                title="Remover PDF anexado"
                aria-label="Remover PDF anexado"
                className="text-mid-grey hover:text-red-crit"
              >
                <X className="size-3.5" strokeWidth={2.25} />
              </button>
            </>
          ) : (
            <label className={`${LINK_NAVY} cursor-pointer text-xs`}>
              <Upload className="size-3.5" strokeWidth={2.25} />
              {enviandoPdf ? 'Enviando...' : 'Anexar PDF'}
              <input
                type="file"
                accept="application/pdf"
                disabled={enviandoPdf}
                onChange={(e) => {
                  const arquivo = e.target.files?.[0]
                  e.target.value = ''
                  if (arquivo) void handleAnexarPdf(arquivo)
                }}
                className="hidden"
              />
            </label>
          )}
        </div>
      </div>
      {erroPdf && (
        <p className="flex items-center gap-1.5 rounded-lg bg-red-crit-light px-3 py-2 text-xs text-red-crit">
          <AlertCircle className="size-3.5 shrink-0" strokeWidth={2.25} />
          {erroPdf}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {confirmandoExclusao ? (
          <span className="flex items-center gap-2 text-xs">
            <span className="font-medium text-red-crit">Excluir este faturamento?</span>
            <button type="button" disabled={excluindo} onClick={handleExcluir} className={LINK_DANGER}>
              Sim
            </button>
            <button
              type="button"
              onClick={() => setConfirmandoExclusao(false)}
              className="font-medium text-mid-grey hover:text-navy hover:underline"
            >
              Não
            </button>
          </span>
        ) : (
          <button type="button" onClick={() => setConfirmandoExclusao(true)} className={`${LINK_DANGER} text-xs`}>
            <Trash2 className="size-3.5" strokeWidth={2.25} />
            Excluir faturamento
          </button>
        )}
      </div>
      {erroExclusao && (
        <p className="flex items-center gap-1.5 rounded-lg bg-red-crit-light px-3 py-2 text-xs text-red-crit">
          <AlertCircle className="size-3.5 shrink-0" strokeWidth={2.25} />
          {erroExclusao}
        </p>
      )}
    </div>
  )

  return (
    <FormularioFaturamento
      clienteId={clienteId}
      contratos={contratos}
      faturamento={faturamento}
      modelo={modelo}
      aoSalvar={aoSalvar}
      aoCancelar={aoCancelar}
      rodape={rodape}
    />
  )
}
