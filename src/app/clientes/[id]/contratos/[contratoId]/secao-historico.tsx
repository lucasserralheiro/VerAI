'use client'

import { usePermissaoCliente } from '../../permissao-cliente'
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { AlertCircle, Download, ExternalLink, FileText, FolderSearch, History, Loader2, Paperclip, Plus, ShieldCheck, Trash2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BTN_OUTLINE, BTN_OUTLINE_SM, BTN_PRIMARY, INPUT_BASE, LINK_DANGER } from '@/lib/ui'
import { formatarData, formatarMoeda } from '@/lib/relatorios-clientes/formatacao'
import { SeletorPdf } from './seletor-pdf'

export type TipoHistorico = 'CONTRATO' | 'ADITIVO' | 'PRORROGACAO' | 'RESCISAO' | 'PROSPECCAO'

export interface LinhaHistorico {
  id: string
  tipo: TipoHistorico
  numero: string | null
  data: string | null
  valor: string | null
  objeto: string | null
  proposta: string | null
  situacao: string | null
  dataInicio: string | null
  dataVencimento: string | null
  dataEnvio: string | null
  observacao: string | null
  /** Anexos PC/PA (proposta) e TC/TA (termo) — opcionais pra não quebrar quem monta a linha à mão. */
  propostaPdfUrl?: string | null
  propostaPdfNome?: string | null
  termoPdfUrl?: string | null
  termoPdfNome?: string | null
  /** Coluna preenchida pela sincronização com o SharePoint (volta se removida aqui). */
  propostaDoSharepoint?: boolean
  termoDoSharepoint?: boolean
}

const TIPOS: Record<TipoHistorico, { rotulo: string; estilo: string }> = {
  CONTRATO: { rotulo: 'Contrato', estilo: 'bg-navy text-white' },
  ADITIVO: { rotulo: 'Aditivo', estilo: 'bg-orange-light text-orange-dark' },
  PRORROGACAO: { rotulo: 'Prorrogação', estilo: 'bg-green-ok-light text-green-ok' },
  RESCISAO: { rotulo: 'Rescisão', estilo: 'bg-red-crit-light text-red-crit' },
  PROSPECCAO: { rotulo: 'Prospecção', estilo: 'bg-light-grey text-mid-grey' },
}

type CampoTexto = Exclude<
  keyof LinhaHistorico,
  'id' | 'tipo' | 'propostaPdfUrl' | 'propostaPdfNome' | 'termoPdfUrl' | 'termoPdfNome' | 'propostaDoSharepoint' | 'termoDoSharepoint'
>

const CAMPOS: Array<{ campo: CampoTexto; rotulo: string; tipo?: string; largo?: boolean }> = [
  { campo: 'numero', rotulo: 'Nº' },
  { campo: 'data', rotulo: 'Assinada em', tipo: 'date' },
  { campo: 'valor', rotulo: 'Valor' },
  { campo: 'situacao', rotulo: 'Situação' },
  { campo: 'dataInicio', rotulo: 'Início', tipo: 'date' },
  { campo: 'dataVencimento', rotulo: 'Vencimento', tipo: 'date' },
  { campo: 'dataEnvio', rotulo: 'Envio', tipo: 'date' },
  { campo: 'proposta', rotulo: 'Proposta' },
  { campo: 'objeto', rotulo: 'Objeto', largo: true },
  { campo: 'observacao', rotulo: 'Observação', largo: true },
]

type Formulario = { tipo: TipoHistorico } & Record<CampoTexto, string>

const DATAS: CampoTexto[] = ['data', 'dataInicio', 'dataVencimento', 'dataEnvio']

function paraFormulario(linha?: LinhaHistorico): Formulario {
  const formulario = { tipo: linha?.tipo ?? 'CONTRATO' } as Formulario
  for (const { campo } of CAMPOS) {
    const valor = linha?.[campo] ?? ''
    formulario[campo] = DATAS.includes(campo) ? valor.slice(0, 10) : valor
  }
  return formulario
}

async function mensagemDeErro(response: Response, padrao: string) {
  const body = await response.json().catch(() => null)
  return body?.error ?? padrao
}

/** Situação da linha como pill colorida (vigente/vencida/descontinuada...), em vez de texto solto. */
function PillSituacao({ situacao }: { situacao: string | null }) {
  if (!situacao) return <span className="text-mid-grey">—</span>
  const texto = situacao.toLowerCase()
  const estilo =
    texto.includes('vigente') || texto.includes('ativ') || texto.includes('assinad')
      ? 'bg-green-ok-light text-green-ok'
      : texto.includes('vencid') || texto.includes('rescind') || texto.includes('cancel')
        ? 'bg-red-crit-light text-red-crit'
        : 'bg-light-grey text-mid-grey'
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[0.72rem] font-semibold whitespace-nowrap', estilo)}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {situacao}
    </span>
  )
}

type TipoPdf = 'proposta' | 'termo'

const ROTULO_PDF: Record<TipoPdf, string> = { proposta: 'PC/PA', termo: 'TC/TA' }

/** Envio e remoção do PDF de uma linha (POST/DELETE em /api/historico-contrato/[id]/pdf/[tipo]).
 *  Compartilhado pela célula da grade (anexar) e pelo modal de visualização (substituir/remover). */
function useAnexoPdf(linhaId: string, tipo: TipoPdf, aoMudar: () => Promise<void>, aoErro: (mensagem: string | null) => void) {
  const [ocupado, setOcupado] = useState(false)
  const rotulo = ROTULO_PDF[tipo]
  const endpoint = `/api/historico-contrato/${linhaId}/pdf/${tipo}`

  async function executar(requisicao: () => Promise<Response>, padrao: string, falhaDeConexao: string): Promise<boolean> {
    setOcupado(true)
    aoErro(null)
    try {
      const response = await requisicao()
      if (!response.ok) {
        aoErro(await mensagemDeErro(response, padrao))
        return false
      }
      await aoMudar()
      return true
    } catch {
      aoErro(falhaDeConexao)
      return false
    } finally {
      setOcupado(false)
    }
  }

  return {
    ocupado,
    enviar(arquivo: File) {
      const corpo = new FormData()
      corpo.append('arquivo', arquivo)
      return executar(
        () => fetch(endpoint, { method: 'POST', body: corpo }),
        `Falha ao anexar o PDF (${rotulo}).`,
        `Falha de conexão ao anexar o PDF (${rotulo}).`
      )
    },
    remover() {
      return executar(
        () => fetch(endpoint, { method: 'DELETE' }),
        `Falha ao remover o PDF (${rotulo}).`,
        `Falha de conexão ao remover o PDF (${rotulo}).`
      )
    },
  }
}

/** Botão "anexar PDF": rótulo clicável + input de arquivo escondido. */
function BotaoAnexar({ rotulo, aoEscolher, className, children }: { rotulo: string; aoEscolher: (arquivo: File) => void; className?: string; children: ReactNode }) {
  return (
    <label className={cn('cursor-pointer focus-within:ring-2 focus-within:ring-orange/40', className)}>
      {children}
      <span className="sr-only">Anexar PDF {rotulo}</span>
      <input
        type="file"
        accept="application/pdf"
        className="sr-only"
        onChange={(e) => {
          const arquivo = e.target.files?.[0]
          e.target.value = ''
          if (arquivo) aoEscolher(arquivo)
        }}
      />
    </label>
  )
}

/** Célula PC/PA ou TC/TA da grade. Com PDF: botão "Ver" que abre o visualizador; sem PDF: o clipe
 *  sobe um arquivo do computador e a pasta abre a lista de PDFs que já estão no sistema. */
function CelulaPdf({
  linhaId,
  tipo,
  url,
  nome,
  aoVer,
  aoEscolher,
  aoMudar,
  aoErro,
}: {
  linhaId: string
  tipo: TipoPdf
  url: string | null | undefined
  nome: string | null | undefined
  aoVer: () => void
  aoEscolher: () => void
  aoMudar: () => Promise<void>
  aoErro: (mensagem: string | null) => void
}) {
  const rotulo = ROTULO_PDF[tipo]
  const { podeEditar } = usePermissaoCliente()
  const { ocupado, enviar } = useAnexoPdf(linhaId, tipo, aoMudar, aoErro)

  if (ocupado) return <Loader2 className="mx-auto size-4 animate-spin text-mid-grey" strokeWidth={2.25} aria-label="Enviando" />

  if (url) {
    return (
      <button
        type="button"
        onClick={aoVer}
        title={`Ver ${rotulo}${nome ? `: ${nome}` : ''}`}
        aria-label={`Ver PDF ${rotulo}`}
        className="mx-auto flex items-center gap-1 rounded-md bg-orange-light px-2 py-1 text-xs font-semibold text-orange-dark transition-colors hover:bg-orange hover:text-white"
      >
        <FileText className="size-3.5" strokeWidth={2.25} aria-hidden />
        Ver
      </button>
    )
  }

  if (!podeEditar) return <span className="block text-center text-mid-grey/60">—</span>

  return (
    <div className="flex items-center justify-center gap-0.5">
      <BotaoAnexar
        rotulo={rotulo}
        aoEscolher={(arquivo) => void enviar(arquivo)}
        className="flex w-fit items-center rounded-md p-1 text-mid-grey/60 transition-colors hover:bg-light-grey hover:text-navy"
      >
        <Paperclip className="size-4" strokeWidth={2} aria-hidden />
      </BotaoAnexar>
      <button
        type="button"
        onClick={aoEscolher}
        title={`Escolher um PDF ${rotulo} que já está no sistema`}
        aria-label={`Escolher PDF ${rotulo} já cadastrado`}
        className="flex w-fit items-center rounded-md p-1 text-mid-grey/60 transition-colors hover:bg-light-grey hover:text-navy"
      >
        <FolderSearch className="size-4" strokeWidth={2} aria-hidden />
      </button>
    </div>
  )
}

/** Visualizador do PDF anexado: mostra o arquivo na própria tela (sem sair do histórico) e junta
 *  as ações — abrir em nova aba, baixar, substituir e remover (em duas etapas). */
function ModalPdf({
  alvo,
  linha,
  aoFechar,
  erro,
  aoMudar,
  aoErro,
}: {
  alvo: { linhaId: string; tipo: TipoPdf } | null
  linha: LinhaHistorico | undefined
  erro: string | null
  aoFechar: () => void
  aoMudar: () => Promise<void>
  aoErro: (mensagem: string | null) => void
}) {
  const dialogoRef = useRef<HTMLDialogElement>(null)
  const { podeEditar } = usePermissaoCliente()
  const [confirmando, setConfirmando] = useState(false)
  const tipo = alvo?.tipo ?? 'proposta'
  const { ocupado, enviar, remover } = useAnexoPdf(alvo?.linhaId ?? '', tipo, aoMudar, aoErro)
  const rotulo = ROTULO_PDF[tipo]
  const url = linha ? (tipo === 'proposta' ? linha.propostaPdfUrl : linha.termoPdfUrl) : null
  const nome = linha ? (tipo === 'proposta' ? linha.propostaPdfNome : linha.termoPdfNome) : null
  const aberto = alvo !== null && !!url

  useEffect(() => {
    const el = dialogoRef.current
    if (!el) return
    if (aberto && !el.open) el.showModal()
    else if (!aberto && el.open) el.close()
    if (!aberto) setConfirmando(false)
  }, [aberto])

  // Removeu (ou a linha sumiu): o PDF não existe mais, fecha o visualizador.
  useEffect(() => {
    if (alvo && !url) aoFechar()
  }, [alvo, url, aoFechar])

  const referencia = linha ? (tipo === 'proposta' ? linha.proposta : linha.numero) : null
  // /api/arquivos/[id] sem `?modo=inline` responde como anexo (download).
  const urlDownload = url ? url.replace(/\?modo=inline$/, '') : '#'
  const doSharepoint = linha ? (tipo === 'proposta' ? linha.propostaDoSharepoint : linha.termoDoSharepoint) : false

  return (
    <dialog
      ref={dialogoRef}
      onClose={aoFechar}
      onClick={(e) => {
        if (e.target === dialogoRef.current) dialogoRef.current?.close()
      }}
      aria-label={`PDF ${rotulo}`}
      className="w-[min(64rem,calc(100vw-2rem))] border-0 bg-transparent p-0"
    >
      {aberto && url && (
        <div className="card-flush overflow-hidden">
          <header className="flex flex-wrap items-center justify-between gap-3 bg-navy px-5 py-3 text-white">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold">
                {rotulo}
                {referencia ? ` — ${referencia}` : ''}
              </h3>
              {nome && <p className="truncate text-xs text-white/70">{nome}</p>}
            </div>
            <button
              type="button"
              onClick={() => dialogoRef.current?.close()}
              aria-label="Fechar visualizador"
              className="rounded-md p-1 text-white/80 hover:bg-white/10 hover:text-white"
            >
              <X className="size-5" strokeWidth={2.25} />
            </button>
          </header>

          {erro && (
            <p className="flex items-center gap-1.5 bg-red-crit-light px-5 py-2 text-sm text-red-crit">
              <AlertCircle className="size-4 shrink-0" strokeWidth={2.25} />
              {erro}
            </p>
          )}
          <iframe src={url} title={`Visualização do PDF ${rotulo}`} className="h-[70vh] w-full bg-light-grey" />
          {doSharepoint && (
            <p className="bg-light-grey px-5 py-2 text-xs text-mid-grey">
              Este PDF vem do SharePoint e é atualizado sozinho. Removido aqui, ele volta na próxima sincronização —
              para trocar de vez, anexe outro PDF (anexo feito à mão não é substituído).
            </p>
          )}

          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border-grey bg-light-grey/50 px-5 py-3">
            <div>
              {!podeEditar ? null : confirmando ? (
                <span className="flex items-center gap-2 text-xs">
                  <span className="font-medium text-red-crit">Remover este PDF?</span>
                  <button type="button" disabled={ocupado} onClick={() => void remover()} className={LINK_DANGER}>
                    Sim
                  </button>
                  <button type="button" onClick={() => setConfirmando(false)} className="font-medium text-mid-grey hover:text-navy hover:underline">
                    Não
                  </button>
                </span>
              ) : (
                <button type="button" onClick={() => setConfirmando(true)} className={`${LINK_DANGER} text-xs`}>
                  <Trash2 className="size-3.5" strokeWidth={2.25} />
                  Remover PDF
                </button>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {podeEditar && (
                <BotaoAnexar
                  rotulo={`${rotulo} (substituir)`}
                  aoEscolher={(arquivo) => void enviar(arquivo)}
                  className={cn(BTN_OUTLINE, ocupado && 'pointer-events-none opacity-60')}
                >
                  <Paperclip className="size-3.5" strokeWidth={2.25} aria-hidden />
                  {ocupado ? 'Enviando...' : 'Substituir'}
                </BotaoAnexar>
              )}
              <a href={urlDownload} className={BTN_OUTLINE}>
                <Download className="size-3.5" strokeWidth={2.25} aria-hidden />
                Baixar
              </a>
              <a href={url} target="_blank" rel="noreferrer" className={BTN_PRIMARY}>
                <ExternalLink className="size-3.5" strokeWidth={2.25} aria-hidden />
                Abrir em nova aba
              </a>
            </div>
          </footer>
        </div>
      )}
    </dialog>
  )
}

/** Linha do tempo única do contrato (design doc §3.5): contrato, aditivos, prorrogações, rescisão e
 *  prospecção lado a lado, por data. `aoMudar` recarrega a página. */
/** Campo preenchido pelo VerAI com prova (termo, planilha de contratos, controle do faturamento): a frase diz
 *  de onde veio e com o que confere (spec 2026-09-29-valor-vigencia-contratos). */
function MarcaOrigem({ texto }: { texto?: string }) {
  if (!texto) return null
  return (
    <span title={texto} aria-label={texto} role="img" className="ml-1 inline-flex align-middle text-green-ok">
      <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
    </span>
  )
}

type Origens = Record<string, { valor?: string; vigencia?: string; assinatura?: string }>

export function SecaoHistorico({
  contratoId,
  historico,
  aoMudar,
}: {
  contratoId: string
  historico: LinhaHistorico[]
  aoMudar: () => Promise<void>
}) {
  const { podeEditar } = usePermissaoCliente()
  // null = formulário fechado; 'novo' = criando; id = editando aquela linha
  const [editando, setEditando] = useState<string | null>(null)
  const [formulario, setFormulario] = useState<Formulario>(paraFormulario())
  const [erro, setErro] = useState<string | null>(null)
  const [erroExclusao, setErroExclusao] = useState<string | null>(null)
  const [erroPdf, setErroPdf] = useState<string | null>(null)
  const dialogoRef = useRef<HTMLDialogElement>(null)
  const [visualizando, setVisualizando] = useState<{ linhaId: string; tipo: TipoPdf } | null>(null)
  const [escolhendo, setEscolhendo] = useState<{ linhaId: string; tipo: TipoPdf } | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [confirmandoExclusao, setConfirmandoExclusao] = useState<string | null>(null)
  const [origens, setOrigens] = useState<Origens>({})

  // Recarrega junto com o histórico: editar uma linha pode trocar o que estava marcado.
  useEffect(() => {
    let ativo = true
    fetch(`/api/contratos/${contratoId}/origens`)
      .then((r) => (r.ok ? r.json() : {}))
      .then((corpo: Origens) => {
        if (ativo) setOrigens(corpo ?? {})
      })
      .catch(() => {})
    return () => {
      ativo = false
    }
  }, [contratoId, historico])

  // O formulário abre em modal (<dialog> + showModal): antes ele aparecia acima da grade e, com a
  // tabela longa, quem clicava em "Editar" numa linha de baixo nem via que o formulário abriu.
  const formularioAberto = editando !== null
  useEffect(() => {
    const el = dialogoRef.current
    if (!el) return
    if (formularioAberto && !el.open) el.showModal()
    else if (!formularioAberto && el.open) el.close()
  }, [formularioAberto])

  function abrirFormulario(linha?: LinhaHistorico) {
    setErro(null)
    setEditando(linha?.id ?? 'novo')
    setFormulario(paraFormulario(linha))
  }

  async function handleSalvar(event: FormEvent) {
    event.preventDefault()
    setErro(null)
    setSalvando(true)
    const criando = editando === 'novo'
    try {
      const response = await fetch(criando ? `/api/contratos/${contratoId}/historico` : `/api/historico-contrato/${editando}`, {
        method: criando ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formulario),
      })
      if (!response.ok) {
        setErro(await mensagemDeErro(response, 'Falha ao salvar a linha do histórico.'))
        return
      }
      setEditando(null)
      await aoMudar()
    } catch {
      setErro('Falha de conexão ao salvar a linha do histórico.')
    } finally {
      setSalvando(false)
    }
  }

  async function handleExcluir(id: string) {
    setConfirmandoExclusao(null)
    setErroExclusao(null)
    try {
      const response = await fetch(`/api/historico-contrato/${id}`, { method: 'DELETE' })
      if (!response.ok) {
        setErroExclusao(await mensagemDeErro(response, 'Falha ao excluir a linha do histórico.'))
        return
      }
      await aoMudar()
    } catch {
      setErroExclusao('Falha de conexão ao excluir a linha do histórico.')
    }
  }

  return (
    <section aria-label="Histórico do contrato" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[0.95rem] font-semibold text-navy">Histórico</h2>
          <p className="text-xs text-mid-grey">Contrato, aditivos, prorrogações e rescisão numa linha do tempo, com a proposta (PC/PA) e o termo (TC/TA) de cada uma</p>
        </div>
        {podeEditar && (
          <button type="button" onClick={() => abrirFormulario()} className={BTN_PRIMARY}>
            <Plus className="size-3.5" strokeWidth={2.25} />
            Nova linha
          </button>
        )}
      </div>

      <dialog
        ref={dialogoRef}
        onClose={() => setEditando(null)}
        onClick={(e) => {
          if (e.target === dialogoRef.current) dialogoRef.current?.close()
        }}
        aria-label={editando === 'novo' ? 'Nova linha do histórico' : 'Editar linha do histórico'}
        className="w-[min(52rem,calc(100vw-2rem))] border-0 bg-transparent p-0"
      >
        {editando !== null && (
        <form onSubmit={handleSalvar} className="card max-h-[85vh] space-y-4 overflow-y-auto">
          <h3 className="text-sm font-semibold text-navy">{editando === 'novo' ? 'Nova linha do histórico' : 'Editar linha do histórico'}</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs font-medium text-mid-grey">Tipo</span>
              <select
                aria-label="Tipo"
                value={formulario.tipo}
                onChange={(e) => setFormulario((atual) => ({ ...atual, tipo: e.target.value as TipoHistorico }))}
                className={INPUT_BASE}
              >
                {(Object.keys(TIPOS) as TipoHistorico[]).map((tipo) => (
                  <option key={tipo} value={tipo}>
                    {TIPOS[tipo].rotulo}
                  </option>
                ))}
              </select>
            </label>
            {CAMPOS.map(({ campo, rotulo, tipo, largo }) => (
              <label key={campo} className={cn('flex flex-col gap-1 text-sm', largo && 'lg:col-span-2')}>
                <span className="text-xs font-medium text-mid-grey">{rotulo}</span>
                <input
                  aria-label={rotulo}
                  type={tipo ?? 'text'}
                  inputMode={campo === 'valor' ? 'decimal' : undefined}
                  placeholder={campo === 'valor' ? '0,00' : undefined}
                  value={formulario[campo]}
                  onChange={(e) => setFormulario((atual) => ({ ...atual, [campo]: e.target.value }))}
                  className={INPUT_BASE}
                />
              </label>
            ))}
          </div>
          {erro && (
            <p className="flex items-center gap-1.5 rounded-lg bg-red-crit-light px-3 py-2 text-sm text-red-crit">
              <AlertCircle className="size-4 shrink-0" strokeWidth={2.25} />
              {erro}
            </p>
          )}
          <div className="flex justify-end gap-2 border-t border-border-grey pt-4">
            <button type="button" onClick={() => setEditando(null)} className={BTN_OUTLINE}>
              Cancelar
            </button>
            <button type="submit" disabled={salvando} className={BTN_PRIMARY}>
              Salvar
            </button>
          </div>
        </form>
        )}
      </dialog>

      {(erroExclusao ?? erroPdf) && (
        <p className="flex items-center gap-1.5 rounded-lg bg-red-crit-light px-3 py-2 text-sm text-red-crit">
          <AlertCircle className="size-4 shrink-0" strokeWidth={2.25} />
          {erroExclusao ?? erroPdf}
        </p>
      )}

      {historico.length === 0 ? (
        <div className="card-flush flex flex-col items-center gap-2 p-10 text-center">
          <span className="flex size-11 items-center justify-center rounded-full bg-light-grey text-mid-grey">
            <History className="size-5" strokeWidth={1.75} />
          </span>
          <p className="text-sm text-mid-grey">Nenhuma linha no histórico.</p>
        </div>
      ) : (
        <div className="card-flush overflow-x-auto">
          <table className="table-institucional">
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Proposta</th>
                <th>Termo</th>
                <th className="whitespace-nowrap">Assinada em</th>
                <th className="text-right">Valor</th>
                <th>Início</th>
                <th>Vencimento</th>
                <th>Situação</th>
                <th className="text-center" title="Proposta comercial / proposta de aditivo">
                  PC/PA
                </th>
                <th className="text-center" title="Termo de contrato / termo aditivo">
                  TC/TA
                </th>
                <th>
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {historico.map((linha) => (
                <tr key={linha.id}>
                  <td>
                    <span
                      className={cn(
                        'inline-block rounded-md px-2 py-0.5 text-[0.7rem] font-bold tracking-wide whitespace-nowrap uppercase',
                        TIPOS[linha.tipo].estilo
                      )}
                    >
                      {TIPOS[linha.tipo].rotulo}
                    </span>
                  </td>
                  <td className="max-w-[16rem]">
                    <div className="truncate font-mono text-xs font-semibold text-navy" title={linha.proposta ?? undefined}>
                      {linha.proposta ?? '—'}
                    </div>
                    {linha.objeto && (
                      <div className="truncate text-xs text-mid-grey" title={linha.objeto}>
                        {linha.objeto}
                      </div>
                    )}
                  </td>
                  <td className="font-mono text-xs whitespace-nowrap">{linha.numero ?? '—'}</td>
                  <td className="font-mono text-xs whitespace-nowrap">{formatarData(linha.data)}</td>
                  <td className="text-right font-mono text-xs font-semibold whitespace-nowrap text-navy">
                    {linha.valor !== null ? formatarMoeda(linha.valor) : '—'}
                    {linha.valor !== null && <MarcaOrigem texto={origens[linha.id]?.valor} />}
                  </td>
                  <td className="font-mono text-xs whitespace-nowrap">{formatarData(linha.dataInicio)}</td>
                  <td className="font-mono text-xs whitespace-nowrap">
                    {formatarData(linha.dataVencimento)}
                    {linha.dataVencimento && <MarcaOrigem texto={origens[linha.id]?.vigencia} />}
                  </td>
                  <td title={linha.observacao ?? undefined}>
                    <PillSituacao situacao={linha.situacao} />
                    <MarcaOrigem texto={origens[linha.id]?.assinatura} />
                  </td>
                  <td className="w-20">
                    <CelulaPdf
                      linhaId={linha.id}
                      tipo="proposta"
                      url={linha.propostaPdfUrl}
                      nome={linha.propostaPdfNome}
                      aoVer={() => setVisualizando({ linhaId: linha.id, tipo: 'proposta' })}
                      aoEscolher={() => setEscolhendo({ linhaId: linha.id, tipo: 'proposta' })}
                      aoMudar={aoMudar}
                      aoErro={setErroPdf}
                    />
                  </td>
                  <td className="w-20">
                    <CelulaPdf
                      linhaId={linha.id}
                      tipo="termo"
                      url={linha.termoPdfUrl}
                      nome={linha.termoPdfNome}
                      aoVer={() => setVisualizando({ linhaId: linha.id, tipo: 'termo' })}
                      aoEscolher={() => setEscolhendo({ linhaId: linha.id, tipo: 'termo' })}
                      aoMudar={aoMudar}
                      aoErro={setErroPdf}
                    />
                  </td>
                  <td className="whitespace-nowrap">
                    <div className="flex items-center justify-end gap-3 text-xs">
                      {!podeEditar ? null : confirmandoExclusao === linha.id ? (
                        <>
                          <span className="font-medium text-red-crit">Excluir?</span>
                          <button type="button" onClick={() => handleExcluir(linha.id)} className={LINK_DANGER}>
                            Sim
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmandoExclusao(null)}
                            className="font-medium text-mid-grey hover:text-navy hover:underline"
                          >
                            Não
                          </button>
                        </>
                      ) : (
                        <>
                          <button type="button" onClick={() => abrirFormulario(linha)} className={BTN_OUTLINE_SM}>
                            Editar
                          </button>
                          <button type="button" onClick={() => setConfirmandoExclusao(linha.id)} className={LINK_DANGER}>
                            Excluir
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {podeEditar && <SeletorPdf alvo={escolhendo} aoFechar={() => setEscolhendo(null)} aoEscolhido={aoMudar} />}

      <ModalPdf
        alvo={visualizando}
        linha={historico.find((linha) => linha.id === visualizando?.linhaId)}
        erro={erroPdf}
        aoFechar={() => setVisualizando(null)}
        aoMudar={aoMudar}
        aoErro={setErroPdf}
      />
    </section>
  )
}
