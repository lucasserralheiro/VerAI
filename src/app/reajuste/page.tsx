'use client'

// Reajuste por IPC-Fipe (spec docs/superpowers/specs/2026-09-30-reajuste-ipc-fipe-design.md §2.2):
// arquivo → período → valores → gerar. O servidor recalcula tudo; a tela só mostra a prévia.
// Tela cheia: à esquerda o que se escolhe (arquivo, período, resumo), à direita o arquivo como ele é.
import { type DragEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, Download, FileSpreadsheet, FileText, History, Loader2, Table2, UploadCloud, X } from 'lucide-react'
import { enviarParaR2 } from '@/lib/envio-r2-navegador'
import { calcularPeriodo, fatorCompleto, periodoSugerido } from '@/lib/reajuste/calculo'
import type { Leitura } from '@/lib/reajuste/tipos'
import { BTN_OUTLINE, BTN_OUTLINE_SM, BTN_PRIMARY, BTN_PRIMARY_LG, LINK_NAVY } from '@/lib/ui'
import { Periodo, SemIndice } from './periodo'
import { PreviaPlanilha, chaveDaColuna } from './previa-planilha'
import { PreviaTexto } from './previa-texto'

const EXTENSOES = ['.xlsx', '.csv', '.pdf', '.docx']

type Etapa =
  | { tipo: 'vazio' }
  | { tipo: 'lendo'; arquivo: File }
  | { tipo: 'pronto'; arquivo: File; endereco: string; leitura: Leitura }

const tamanho = (bytes: number) =>
  bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`

const ehPlanilha = (nome: string) => /\.(xlsx|csv)$/i.test(nome)

function Cartao(props: { passo: number; titulo: string; children: React.ReactNode; acao?: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-2xl border border-border-grey bg-white p-4 shadow-xs">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-navy">
          <span className="flex size-5 items-center justify-center rounded-full bg-navy text-[11px] text-white">{props.passo}</span>
          {props.titulo}
        </h2>
        {props.acao}
      </div>
      {props.children}
    </section>
  )
}

export default function ReajustePage() {
  const [meses, setMeses] = useState<Array<{ mes: string; variacao: string }> | null>(null)
  const [atualizandoIndice, setAtualizandoIndice] = useState(false)
  const [inicial, setInicial] = useState('')
  const [final, setFinal] = useState('')
  const [etapa, setEtapa] = useState<Etapa>({ tipo: 'vazio' })
  const [urlLocal, setUrlLocal] = useState<string | null>(null)
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set())
  const [erro, setErro] = useState<string | null>(null)
  const [gerando, setGerando] = useState(false)
  const [gerado, setGerado] = useState<string | null>(null)
  const [arrastando, setArrastando] = useState(false)
  const campo = useRef<HTMLInputElement>(null)
  const profundidade = useRef(0)

  const carregarIndice = useCallback(async () => {
    try {
      const r = await fetch('/api/reajuste/indice')
      if (!r.ok) throw new Error(String(r.status))
      const corpo = (await r.json()) as { meses: Array<{ mes: string; variacao: string }> }
      setMeses(corpo.meses)
      const ultimo = corpo.meses.at(-1)?.mes
      if (ultimo) {
        const sugestao = periodoSugerido(ultimo)
        setInicial(sugestao.inicial)
        setFinal(sugestao.final)
      }
    } catch {
      setErro('Não foi possível carregar o IPC-Fipe.')
    }
  }, [])
  useEffect(() => {
    void carregarIndice()
  }, [carregarIndice])

  async function buscarIndice() {
    setAtualizandoIndice(true)
    setErro(null)
    const r = await fetch('/api/reajuste/indice', { method: 'POST' })
    const corpo = await r.json().catch(() => null)
    setAtualizandoIndice(false)
    if (!r.ok) return setErro(corpo?.error ?? 'Falha ao buscar o índice.')
    await carregarIndice()
  }

  // O PDF abre no visualizador do próprio navegador, direto do arquivo local.
  useEffect(() => {
    const arquivo = etapa.tipo === 'vazio' ? null : etapa.arquivo
    if (!arquivo || !/\.pdf$/i.test(arquivo.name) || typeof URL.createObjectURL !== 'function') {
      setUrlLocal(null)
      return
    }
    const url = URL.createObjectURL(arquivo)
    setUrlLocal(url)
    return () => URL.revokeObjectURL(url)
  }, [etapa.tipo === 'vazio' ? null : etapa.arquivo]) // eslint-disable-line react-hooks/exhaustive-deps

  const indice = useMemo(() => new Map((meses ?? []).map((m) => [m.mes, m.variacao])), [meses])
  const calculo = inicial && final ? calcularPeriodo(inicial, final, indice) : null
  const fator = calculo?.ok ? fatorCompleto(calculo.meses) : null

  async function escolher(arquivo: File) {
    if (!EXTENSOES.some((e) => arquivo.name.toLowerCase().endsWith(e))) {
      setErro(`${arquivo.name} não é planilha (.xlsx, .csv), PDF nem Word (.docx).`)
      return
    }
    setErro(null)
    setGerado(null)
    setEtapa({ tipo: 'lendo', arquivo })
    try {
      const endereco = await enviarParaR2(arquivo, '/api/reajuste/envio')
      const r = await fetch('/api/reajuste/leitura', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endereco }),
      })
      const corpo = await r.json().catch(() => null)
      if (!r.ok) throw new Error(corpo?.error ?? 'Falha ao ler o arquivo.')
      const leitura = corpo as Leitura
      setMarcadas(
        new Set(
          leitura.tipo === 'planilha'
            ? leitura.colunas.filter((c) => c.sugerida).map((c) => chaveDaColuna(c.aba, c.coluna))
            : leitura.valores.map((v) => String(v.indice))
        )
      )
      setEtapa({ tipo: 'pronto', arquivo, endereco, leitura })
    } catch (e) {
      setEtapa({ tipo: 'vazio' })
      setErro(e instanceof Error ? e.message : 'Falha ao enviar o arquivo.')
    }
  }

  function recomecar() {
    setEtapa({ tipo: 'vazio' })
    setMarcadas(new Set())
    setGerado(null)
    setErro(null)
    if (campo.current) campo.current.value = ''
  }

  async function gerar() {
    if (etapa.tipo !== 'pronto') return
    setGerando(true)
    setErro(null)
    const selecao =
      etapa.leitura.tipo === 'planilha'
        ? {
            colunas: etapa.leitura.colunas
              .filter((c) => marcadas.has(chaveDaColuna(c.aba, c.coluna)))
              .map(({ aba, coluna, linhaCabecalho }) => ({ aba, coluna, linhaCabecalho })),
          }
        : { valores: etapa.leitura.valores.filter((v) => marcadas.has(String(v.indice))).map((v) => v.indice) }
    const r = await fetch('/api/reajuste', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endereco: etapa.endereco, nomeArquivo: etapa.arquivo.name, inicial, final, ...selecao }),
    })
    const corpo = await r.json().catch(() => null)
    setGerando(false)
    if (!r.ok) return setErro(corpo?.error ?? 'Falha ao gerar.')
    setGerado(corpo.id)
  }

  const podeGerar = etapa.tipo === 'pronto' && calculo?.ok === true && marcadas.size > 0 && !gerando && !gerado

  // Arrastar o arquivo pra qualquer lugar da tela.
  const temArquivos = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files')
  const alvo = {
    onDragEnter(e: DragEvent) {
      if (!temArquivos(e) || etapa.tipo === 'lendo') return
      e.preventDefault()
      profundidade.current += 1
      setArrastando(true)
    },
    onDragOver(e: DragEvent) {
      if (!temArquivos(e) || etapa.tipo === 'lendo') return
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
    },
    onDragLeave() {
      profundidade.current = Math.max(0, profundidade.current - 1)
      if (profundidade.current === 0) setArrastando(false)
    },
    onDrop(e: DragEvent) {
      e.preventDefault()
      profundidade.current = 0
      setArrastando(false)
      const arquivo = e.dataTransfer?.files?.[0]
      if (arquivo && etapa.tipo !== 'lendo') void escolher(arquivo)
    },
  }

  const resumo =
    etapa.tipo !== 'pronto'
      ? null
      : etapa.leitura.tipo === 'planilha'
        ? (() => {
            const colunas = etapa.leitura.colunas.filter((c) => marcadas.has(chaveDaColuna(c.aba, c.coluna)))
            const valores = colunas.reduce((s, c) => s + c.quantidade, 0)
            return `${colunas.length} ${colunas.length === 1 ? 'coluna' : 'colunas'} · ${valores} ${valores === 1 ? 'valor' : 'valores'}`
          })()
        : `${marcadas.size} de ${etapa.leitura.valores.length} valores`

  return (
    <main {...alvo} className="relative flex min-h-full flex-col gap-5 px-6 py-6 lg:h-screen lg:px-8">
      <input
        ref={campo}
        aria-label="Arquivo"
        type="file"
        accept={EXTENSOES.join(',')}
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          const arquivo = e.target.files?.[0]
          if (arquivo) void escolher(arquivo)
        }}
      />

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[1.75rem] leading-tight font-semibold tracking-tight text-navy">Reajuste IPC-Fipe</h1>
          <p className="text-sm text-mid-grey">Corrija os valores de uma planilha, PDF ou Word pelo IPC-Fipe acumulado.</p>
        </div>
        <div className="flex gap-2">
          <Link className={BTN_OUTLINE} href="/reajuste/historico">
            <History className="size-4" /> Histórico
          </Link>
          <Link className={BTN_OUTLINE} href="/reajuste/indice">
            <Table2 className="size-4" /> Tabela do índice
          </Link>
        </div>
      </header>

      {erro && (
        <p className="flex items-start justify-between gap-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {erro}
          <button type="button" aria-label="Fechar aviso" onClick={() => setErro(null)}>
            <X className="size-4" />
          </button>
        </p>
      )}

      <div className="grid min-h-0 flex-1 gap-5 lg:grid-cols-[minmax(300px,360px)_minmax(0,1fr)]">
        <aside className="space-y-4 lg:min-h-0 lg:overflow-y-auto lg:pb-2">
          <Cartao
            passo={1}
            titulo="Arquivo"
            acao={
              etapa.tipo === 'pronto' && (
                <button type="button" className={BTN_OUTLINE_SM} onClick={() => campo.current?.click()}>
                  Trocar
                </button>
              )
            }
          >
            {etapa.tipo === 'vazio' ? (
              <button
                type="button"
                onClick={() => campo.current?.click()}
                className="flex w-full items-center gap-3 rounded-xl border border-dashed border-border-grey px-3 py-3 text-left text-sm text-mid-grey transition-colors hover:border-orange hover:bg-orange/[0.04]"
              >
                <UploadCloud className="size-5 shrink-0 text-orange" />
                <span>
                  <span className="font-medium text-navy">Escolher arquivo</span> ou arraste para a tela
                </span>
              </button>
            ) : (
              <div className="flex items-center gap-3 rounded-xl bg-light-grey/70 px-3 py-2.5">
                {ehPlanilha(etapa.arquivo.name) ? (
                  <FileSpreadsheet className="size-8 shrink-0 text-green-ok" strokeWidth={1.5} />
                ) : (
                  <FileText className="size-8 shrink-0 text-red-crit" strokeWidth={1.5} />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-navy" title={etapa.arquivo.name}>
                    {etapa.arquivo.name}
                  </p>
                  <p className="text-xs text-mid-grey">
                    {tamanho(etapa.arquivo.size)}
                    {etapa.tipo === 'lendo' && ' · lendo…'}
                  </p>
                </div>
                {etapa.tipo === 'lendo' ? (
                  <Loader2 className="size-4 shrink-0 animate-spin text-mid-grey" />
                ) : (
                  <button type="button" aria-label="Remover arquivo" className="text-mid-grey hover:text-navy" onClick={recomecar}>
                    <X className="size-4" />
                  </button>
                )}
              </div>
            )}
          </Cartao>

          <Cartao passo={2} titulo="Período">
            {meses === null ? (
              <p className="flex items-center gap-2 text-sm text-mid-grey">
                <Loader2 className="size-4 animate-spin" /> Carregando o índice…
              </p>
            ) : meses.length === 0 ? (
              <SemIndice atualizando={atualizandoIndice} onAtualizar={buscarIndice} />
            ) : (
              <Periodo
                indice={indice}
                meses={meses.map((m) => m.mes)}
                inicial={inicial}
                final={final}
                onMudar={(i, f) => {
                  setInicial(i)
                  setFinal(f)
                  setGerado(null)
                }}
              />
            )}
          </Cartao>

          <Cartao passo={3} titulo="Gerar">
            {resumo ? (
              <p className="text-sm text-navy">
                <strong>{resumo}</strong> a corrigir
              </p>
            ) : (
              <p className="text-sm text-mid-grey">Escolha o arquivo e marque os valores na pré-visualização.</p>
            )}
            {etapa.tipo === 'pronto' && etapa.leitura.tipo === 'texto' && (
              <p className="text-xs text-mid-grey">
                PDF e Word não são reescritos: o resultado é uma planilha com cada valor original e corrigido.
              </p>
            )}
            {gerado ? (
              <div className="space-y-3 rounded-xl bg-green-ok-light px-3 py-3">
                <p className="flex items-center gap-2 text-sm font-medium text-green-ok">
                  <CheckCircle2 className="size-4" /> Planilha gerada
                </p>
                <a className={`${BTN_PRIMARY_LG}`} href={`/api/reajuste/${gerado}/arquivo/resultado`}>
                  <Download className="size-4" /> Baixar resultado
                </a>
                <div className="flex items-center justify-between text-sm">
                  <Link className={LINK_NAVY} href="/reajuste/historico">
                    Ver no histórico
                  </Link>
                  <button type="button" className={LINK_NAVY} onClick={recomecar}>
                    Corrigir outro arquivo
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" className={BTN_PRIMARY_LG} disabled={!podeGerar} onClick={gerar}>
                {gerando ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Gerando…
                  </>
                ) : (
                  'Gerar planilha'
                )}
              </button>
            )}
          </Cartao>
        </aside>

        <section
          aria-label="Pré-visualização"
          className="flex min-h-[70vh] flex-col overflow-hidden rounded-2xl border border-border-grey bg-white shadow-xs lg:min-h-0"
        >
          {etapa.tipo === 'vazio' && (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-12 text-center">
              <span className="flex size-12 items-center justify-center rounded-xl bg-orange/10 text-orange">
                <UploadCloud className="size-6" />
              </span>
              <div className="space-y-1">
                <p className="font-semibold text-navy">Nenhum arquivo ainda</p>
                <p className="max-w-sm text-sm text-mid-grey">
                  Arraste uma planilha (.xlsx, .csv), PDF ou Word (.docx) para esta tela — a prévia mostra os valores já
                  corrigidos antes de gerar.
                </p>
              </div>
              <button type="button" className={BTN_PRIMARY} onClick={() => campo.current?.click()}>
                <UploadCloud className="size-4" /> Escolher arquivo
              </button>
            </div>
          )}

          {etapa.tipo === 'lendo' && (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-sm text-mid-grey">
              <Loader2 className="size-8 animate-spin text-orange" />
              <p>
                Lendo <span className="font-medium text-navy">{etapa.arquivo.name}</span>…
              </p>
            </div>
          )}

          {etapa.tipo === 'pronto' &&
            (etapa.leitura.tipo === 'planilha' ? (
              <PreviaPlanilha
                key={etapa.endereco}
                leitura={etapa.leitura}
                fator={fator}
                marcadas={marcadas}
                onMudar={(m) => {
                  setMarcadas(m)
                  setGerado(null)
                }}
              />
            ) : (
              <PreviaTexto
                leitura={etapa.leitura}
                fator={fator}
                marcadas={marcadas}
                urlDoPdf={urlLocal}
                onMudar={(m) => {
                  setMarcadas(m)
                  setGerado(null)
                }}
              />
            ))}
        </section>
      </div>

      {arrastando && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-3 z-40 flex items-center justify-center rounded-2xl border-2 border-dashed border-orange bg-white/90 text-lg font-semibold text-navy backdrop-blur-sm"
        >
          <UploadCloud className="mr-3 size-7 text-orange" /> Solte o arquivo para corrigir
        </div>
      )}
    </main>
  )
}
