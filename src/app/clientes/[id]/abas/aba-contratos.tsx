'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { fetchComPreCarga } from '@/lib/relatorios-clientes/prefetch'
import Link from 'next/link'
import { AlertCircle, FileSignature, FileText, History, Loader2, Plus, Search, Trash2 } from 'lucide-react'
import { BTN_PRIMARY, INPUT_BASE, LINK_DANGER, LINK_NAVY } from '@/lib/ui'
import { formatarData, formatarMoeda } from '@/lib/relatorios-clientes/formatacao'
import { avisarMudancaDeDados } from '@/lib/relatorios-clientes/atualizacao-dados'
import { BarraFaturado, PillVencimento } from '@/components/relatorios-clientes/indicadores-contrato'
import { SeiLink } from '@/components/relatorios-clientes/sei-link'
import { FormularioContrato, type Contrato } from '../contratos/formulario-contrato'
import { DocumentosDoContrato } from '../contratos/documentos-do-contrato'
import type { ColunaDoContrato } from './documentos/derivados'
import type { GrupoItensAguardando } from '@/lib/relatorios-clientes/itens-aguardando'

/** "2 aditivos · 1 prorrog." embaixo do nº do termo; some quando o contrato não tem nenhum. */
function ResumoAditivos({ resumo }: { resumo: Contrato['resumoHistorico'] }) {
  if (!resumo || (resumo.aditivos === 0 && resumo.prorrogacoes === 0)) return null
  const partes = [
    resumo.aditivos > 0 && `${resumo.aditivos} ${resumo.aditivos === 1 ? 'aditivo' : 'aditivos'}`,
    resumo.prorrogacoes > 0 && `${resumo.prorrogacoes} prorrog.`,
  ].filter(Boolean)
  return <div className="mt-0.5 font-sans text-[0.68rem] font-medium text-mid-grey">{partes.join(' · ')}</div>
}

const ROTULO_TIPO_VALOR = {
  CONTRATO: 'Contrato',
  ADITIVO: 'Aditivo',
  PRORROGACAO: 'Prorrogação',
  RESCISAO: 'Rescisão',
  PROSPECCAO: 'Prospecção',
} as const

/** Valor atual do contrato (o da última linha do histórico que tem valor). A dica diz de onde veio. */
function ValorContrato({ valorAtual }: { valorAtual: NonNullable<Contrato['resumoHistorico']>['valorAtual'] }) {
  if (!valorAtual) return <span className="text-mid-grey/60">—</span>
  const origem = `${ROTULO_TIPO_VALOR[valorAtual.tipo]}${valorAtual.data ? ` de ${formatarData(valorAtual.data)}` : ''}`
  return (
    <div title={`Valor atual do contrato — conforme ${origem}`} className="whitespace-nowrap">
      <div className="font-mono text-xs font-semibold text-navy">{formatarMoeda(valorAtual.valor)}</div>
      <div className="text-[0.68rem] text-mid-grey">{origem}</div>
    </div>
  )
}

/** Ícone da coluna PC/PA ou TC/TA: abre a janela com todos os documentos daquela coluna do contrato
 *  (abrir PDF ou converter em Markdown). Sem nenhum anexo na coluna, um traço. */
function BotaoDocumentos({
  contrato,
  coluna,
  aoAbrir,
}: {
  contrato: Contrato
  coluna: ColunaDoContrato
  aoAbrir: (contrato: Contrato, coluna: ColunaDoContrato) => void
}) {
  if (!contrato.resumoHistorico?.[coluna]) return <span className="block text-center text-mid-grey/60">—</span>
  const [artigo, sigla] = coluna === 'proposta' ? ['a', 'PC/PA'] : ['o', 'TC/TA']
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        aoAbrir(contrato, coluna)
      }}
      title={`Escolher ${artigo} ${sigla} para abrir ou converter em Markdown`}
      aria-label={`${sigla} do ${contrato.numeroTermo ?? 'contrato'}`}
      className="mx-auto flex w-fit rounded-md p-1 text-orange hover:bg-orange-light hover:text-orange-dark"
    >
      <FileText className="size-[1.1rem]" strokeWidth={2} />
    </button>
  )
}

/** Código SEI com o rótulo de quem é — o clique segue o padrão único de `SeiLink`. */
function CodigoSei({ rotulo, valor, link }: { rotulo: string; valor: string | null; link: string | null }) {
  return (
    <div className="flex items-baseline gap-1.5 font-mono text-xs whitespace-nowrap">
      <span className="w-[3.4rem] shrink-0 font-sans text-[0.65rem] font-medium tracking-wide text-mid-grey uppercase">{rotulo}</span>
      <SeiLink numero={valor} link={link} />
    </div>
  )
}

export function AbaContratos({ clienteId }: { clienteId: string }) {
  const [contratos, setContratos] = useState<Contrato[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  // 'novo' = criando um contrato; um Contrato = editando aquela linha; null = modal fechado.
  const [modalContrato, setModalContrato] = useState<'novo' | Contrato | null>(null)
  const [busca, setBusca] = useState('')
  // Contrato e coluna (PC/PA ou TC/TA) cuja lista está aberta, para abrir ou converter um dos
  // documentos; null = fechada.
  const [documentosDe, setDocumentosDe] = useState<{ contrato: Contrato; coluna: ColunaDoContrato } | null>(null)
  const abrirDocumentos = (contrato: Contrato, coluna: ColunaDoContrato) => setDocumentosDe({ contrato, coluna })
  // Itens do legado deste cliente (pela sigla) que esperam um contrato com o mesmo número.
  const [aguardando, setAguardando] = useState<GrupoItensAguardando[]>([])
  const [numeroSugerido, setNumeroSugerido] = useState<string | null>(null)

  async function carregar() {
    fetchComPreCarga(`/api/clientes/${clienteId}/itens-aguardando`, { cache: 'no-store' })
      .then(async (response) => {
        const lista = response.ok ? await response.json() : []
        setAguardando(Array.isArray(lista) ? lista : [])
      })
      .catch(() => {})
    try {
      const response = await fetchComPreCarga(`/api/clientes/${clienteId}/contratos`)
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        setErro(body?.error ?? 'Falha ao carregar contratos.')
        return
      }
      setErro(null)
      const lista = await response.json()
      setContratos(Array.isArray(lista) ? lista : [])
    } catch {
      setErro('Falha de conexão ao carregar contratos.')
    }
  }

  useEffect(() => {
    carregar().finally(() => setCarregando(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteId])

  const contratosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    if (!termo) return contratos
    return contratos.filter((contrato) =>
      [contrato.numeroTermo, contrato.descricao, contrato.seiCliente, contrato.seiProdam, contrato.situacao].some((campo) =>
        campo?.toLowerCase().includes(termo)
      )
    )
  }, [contratos, busca])

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
          <h2 className="text-[0.95rem] font-semibold text-navy">Contratos de receita</h2>
          <p className="text-xs text-mid-grey">
            Cabeçalho + histórico (contrato, aditivo, prorrogação, rescisão) numa linha do tempo só
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative">
            <span className="sr-only">Buscar contrato</span>
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-mid-grey" strokeWidth={2.25} />
            <input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar nº, descrição ou SEI"
              className={`${INPUT_BASE} w-72 py-1.5 pl-8 text-sm`}
            />
          </label>
          <button
            type="button"
            onClick={() => {
              setNumeroSugerido(null)
              setModalContrato('novo')
            }}
            className={BTN_PRIMARY}
          >
            <Plus className="size-3.5" strokeWidth={2.25} />
            Novo contrato
          </button>
        </div>
      </div>

      {aguardando.length > 0 && (
        <section aria-label="Itens do legado aguardando contrato" className="space-y-2 rounded-xl border border-orange/30 bg-orange-light/60 px-4 py-3">
          <p className="text-sm font-semibold text-orange-dark">
            {aguardando.reduce((soma, g) => soma + g.itens, 0)} itens do legado deste cliente aguardam contrato
          </p>
          <p className="text-xs text-orange-dark/90">
            Crie o contrato com o mesmo número abaixo e os itens (e o valor) são ligados a ele automaticamente.
          </p>
          <ul className="flex flex-wrap gap-2">
            {aguardando.slice(0, 8).map((grupo) => (
              <li key={grupo.texto}>
                <button
                  type="button"
                  onClick={() => {
                    setNumeroSugerido(grupo.texto)
                    setModalContrato('novo')
                  }}
                  title="Criar o contrato com este número"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-orange/40 bg-white px-2.5 py-1 text-xs font-medium text-navy hover:border-orange hover:text-orange"
                >
                  <Plus className="size-3" strokeWidth={2.5} />
                  <span className="font-mono">{grupo.texto}</span>
                  <span className="text-mid-grey">
                    · {grupo.itens} {grupo.itens === 1 ? 'item' : 'itens'} · {formatarMoeda(grupo.valor)}
                  </span>
                </button>
              </li>
            ))}
            {aguardando.length > 8 && <li className="self-center text-xs text-orange-dark">e mais {aguardando.length - 8}</li>}
          </ul>
        </section>
      )}

      {erro ? (
        <p className="flex items-center gap-1.5 rounded-xl bg-red-crit-light p-4 text-sm text-red-crit">
          <AlertCircle className="size-4 shrink-0" strokeWidth={2.25} />
          {erro}
        </p>
      ) : contratos.length === 0 ? (
        <div className="card-flush flex flex-col items-center gap-2 p-10 text-center">
          <span className="flex size-11 items-center justify-center rounded-full bg-light-grey text-mid-grey">
            <FileSignature className="size-5" strokeWidth={1.75} />
          </span>
          <p className="text-sm text-mid-grey">Nenhum contrato cadastrado.</p>
        </div>
      ) : contratosFiltrados.length === 0 ? (
        <div className="card-flush flex flex-col items-center gap-2 p-10 text-center">
          <span className="flex size-11 items-center justify-center rounded-full bg-light-grey text-mid-grey">
            <Search className="size-5" strokeWidth={1.75} />
          </span>
          <p className="text-sm text-mid-grey">Nenhum contrato encontrado para &quot;{busca}&quot;.</p>
        </div>
      ) : (
        <div className="card-flush overflow-x-auto">
          <table className="table-institucional">
            <thead>
              <tr>
                <th className="whitespace-nowrap">Nº do termo</th>
                <th>Descrição</th>
                <th>SEI</th>
                <th>Situação</th>
                <th>Vigência</th>
                <th className="text-right whitespace-nowrap">Valor</th>
                <th className="whitespace-nowrap">Faturado</th>
                <th className="text-center" title="Proposta comercial / proposta de aditivo — clique para escolher qual abrir ou converter">
                  PC/PA
                </th>
                <th className="text-center" title="Termo de contrato / termo aditivo — o mais recente com PDF anexado">
                  TC/TA
                </th>
              </tr>
            </thead>
            <tbody>
              {contratosFiltrados.map((contrato) => (
                <tr key={contrato.id} onClick={() => setModalContrato(contrato)} className="cursor-pointer">
                  <td className="font-mono text-xs whitespace-nowrap">
                    <Link
                      href={`/clientes/${clienteId}/contratos/${contrato.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="font-semibold text-navy hover:text-orange hover:underline"
                    >
                      {contrato.numeroTermo ?? '(sem número)'}
                    </Link>
                    <ResumoAditivos resumo={contrato.resumoHistorico} />
                  </td>
                  <td className="min-w-[11rem]">
                    <span className="line-clamp-2 text-[0.8rem] leading-snug" title={contrato.descricao ?? undefined}>
                      {contrato.descricao ?? '—'}
                    </span>
                  </td>
                  <td>
                    {/* Os dois SEI empilhados numa coluna só: ganha ~250px de largura e ainda
                        deixa claro qual é de quem. */}
                    <div className="flex flex-col gap-1">
                      <CodigoSei rotulo="Cliente" valor={contrato.seiCliente} link={contrato.linkSei} />
                      <CodigoSei rotulo="PRODAM" valor={contrato.seiProdam} link={contrato.linkSei} />
                    </div>
                  </td>
                  <td>
                    <div className="flex flex-col items-start gap-1">
                      <PillVencimento vencimento={contrato.vencimento} />
                      {contrato.situacao && <span className="text-xs text-mid-grey">{contrato.situacao}</span>}
                      {contrato.rescindido && <span className="text-xs font-semibold text-red-crit">Rescindido</span>}
                      {contrato.ativo === false &&
                        !contrato.vazio &&
                        !contrato.rescindido &&
                        ['ok', 'atencao', 'critico'].includes(contrato.vencimento.nivel) && (
                          <span
                            className="text-xs font-semibold text-orange-dark"
                            title="A situação cadastrada diz que o contrato acabou, mas a vigência ainda está em curso. Confira o cadastro."
                          >
                            Situação × vigência: conferir
                          </span>
                        )}
                      {contrato.vazio && (
                        <span className="text-xs font-semibold text-orange-dark" title="Linha vazia vinda do legado: não conta nos indicadores. Preencha ou exclua.">
                          Cadastro vazio
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="font-mono text-xs whitespace-nowrap">
                    <div>{formatarData(contrato.dataInicio)}</div>
                    <div
                      className="text-mid-grey"
                      title={
                        contrato.vigenciaFim && contrato.vigenciaFim !== contrato.dataVencimento
                          ? `Cadastro: ${formatarData(contrato.dataVencimento)} — prazo estendido pelo histórico (aditivo/prorrogação)`
                          : undefined
                      }
                    >
                      até {formatarData(contrato.vigenciaFim ?? contrato.dataVencimento)}
                    </div>
                  </td>
                  <td className="text-right">
                    <ValorContrato valorAtual={contrato.resumoHistorico?.valorAtual ?? null} />
                  </td>
                  <td className="min-w-[7.5rem]">
                    <BarraFaturado saldo={contrato.saldo} />
                  </td>
                  <td className="w-16">
                    <BotaoDocumentos contrato={contrato} coluna="proposta" aoAbrir={abrirDocumentos} />
                  </td>
                  <td className="w-16">
                    <BotaoDocumentos contrato={contrato} coluna="termo" aoAbrir={abrirDocumentos} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <DocumentosDoContrato
        clienteId={clienteId}
        contrato={documentosDe?.contrato ?? null}
        coluna={documentosDe?.coluna ?? 'proposta'}
        aoFechar={() => setDocumentosDe(null)}
      />

      <ModalContrato
        estado={modalContrato}
        clienteId={clienteId}
        numeroSugerido={numeroSugerido ?? undefined}
        aoFechar={() => setModalContrato(null)}
        aoSalvar={async () => {
          setModalContrato(null)
          await carregar()
          avisarMudancaDeDados()
        }}
        aoExcluir={async () => {
          setModalContrato(null)
          await carregar()
          avisarMudancaDeDados()
        }}
      />
    </div>
  )
}

/** Modal nativo (`<dialog>` + `showModal()`) reaproveitando o mesmo formulário pra criar E
 *  editar: "Novo contrato" e clicar numa linha da tabela abrem o mesmo diálogo, só trocando se o
 *  `FormularioContrato` recebe um `contrato` ou não. Segue o padrão de diálogo já usado em
 *  `src/app/confere/components/ConfirmarLimpeza.tsx` (`dialog::backdrop` e
 *  `dialog[open] { margin: auto }` já ficam definidos globalmente em `globals.css`). */
function ModalContrato({
  estado,
  clienteId,
  numeroSugerido,
  aoFechar,
  aoSalvar,
  aoExcluir,
}: {
  estado: 'novo' | Contrato | null
  clienteId: string
  numeroSugerido?: string
  aoFechar: () => void
  aoSalvar: (salvo: Contrato) => void
  aoExcluir: (excluido: Contrato) => void
}) {
  const dialogoRef = useRef<HTMLDialogElement>(null)
  const contrato = estado === 'novo' ? undefined : (estado ?? undefined)
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
      // Clique no `::backdrop` (fora do card) dispara `click` com `target` sendo o próprio
      // `<dialog>` — clique em qualquer conteúdo de dentro tem um descendente como alvo. É o jeito
      // padrão de fechar ao clicar fora sem precisar medir geometria.
      onClick={(e) => {
        if (e.target === dialogoRef.current) dialogoRef.current?.close()
      }}
      aria-label={contrato ? 'Editar contrato' : 'Novo contrato'}
      className="w-[min(48rem,calc(100vw-2rem))] border-0 bg-transparent p-0"
    >
      {aberto && (
        <ConteudoModalContrato
          key={contrato?.id ?? `novo-${numeroSugerido ?? ''}`}
          clienteId={clienteId}
          numeroSugerido={numeroSugerido}
          contrato={contrato}
          aoSalvar={aoSalvar}
          aoExcluir={aoExcluir}
          aoCancelar={() => dialogoRef.current?.close()}
        />
      )}
    </dialog>
  )
}

/** Corpo do modal — form + link pro histórico + exclusão (as duas últimas só quando `contrato`
 *  já existe). Componente próprio (montado com `key={contrato?.id ?? 'novo'}` pelo `ModalContrato`
 *  acima) pra que o "Excluir?" de confirmação comece sempre fechado ao trocar de linha, sem
 *  precisar zerar esse estado manualmente. */
function ConteudoModalContrato({
  clienteId,
  numeroSugerido,
  contrato,
  aoSalvar,
  aoExcluir,
  aoCancelar,
}: {
  clienteId: string
  numeroSugerido?: string
  contrato: Contrato | undefined
  aoSalvar: (salvo: Contrato) => void
  aoExcluir: (excluido: Contrato) => void
  aoCancelar: () => void
}) {
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false)
  const [excluindo, setExcluindo] = useState(false)
  const [erroExclusao, setErroExclusao] = useState<string | null>(null)

  async function handleExcluir() {
    if (!contrato) return
    setExcluindo(true)
    setErroExclusao(null)
    try {
      const response = await fetch(`/api/contratos/${contrato.id}`, { method: 'DELETE' })
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        setErroExclusao(body?.error ?? 'Falha ao excluir o contrato.')
        setConfirmandoExclusao(false)
        return
      }
      aoExcluir(contrato)
    } catch {
      setErroExclusao('Falha de conexão ao excluir o contrato.')
      setConfirmandoExclusao(false)
    } finally {
      setExcluindo(false)
    }
  }

  const rodape = contrato && (
    <div className="space-y-2 border-t border-border-grey pt-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={`/clientes/${clienteId}/contratos/${contrato.id}`} className={`${LINK_NAVY} text-xs`}>
          <History className="size-3.5" strokeWidth={2.25} />
          Ver histórico completo (aditivos, prorrogações, rescisão)
        </Link>
        {confirmandoExclusao ? (
          <span className="flex items-center gap-2 text-xs">
            <span className="font-medium text-red-crit">Excluir este contrato?</span>
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
            Excluir contrato
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
    <FormularioContrato
      clienteId={clienteId}
      contrato={contrato}
      numeroSugerido={numeroSugerido}
      aoSalvar={aoSalvar}
      aoCancelar={aoCancelar}
      rodape={rodape}
    />
  )
}
