'use client'

// Reajuste por IPC-Fipe (spec docs/superpowers/specs/2026-09-30-reajuste-ipc-fipe-design.md §2.2):
// arquivo → período → valores → gerar. O servidor recalcula tudo; a tela só mostra a prévia.
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Download, Loader2 } from 'lucide-react'
import { enviarParaR2 } from '@/lib/envio-r2-navegador'
import { calcularPeriodo, fatorCompleto, periodoSugerido } from '@/lib/reajuste/calculo'
import type { Leitura } from '@/lib/reajuste/tipos'
import { BTN_OUTLINE, BTN_PRIMARY, LINK_NAVY } from '@/lib/ui'
import { Periodo } from './periodo'
import { Selecao, chaveDaColuna } from './selecao'

type Etapa =
  | { tipo: 'vazio' }
  | { tipo: 'lendo'; nome: string }
  | { tipo: 'pronto'; nome: string; endereco: string; leitura: Leitura }

export default function ReajustePage() {
  const [meses, setMeses] = useState<Array<{ mes: string; variacao: string }> | null>(null)
  const [inicial, setInicial] = useState('')
  const [final, setFinal] = useState('')
  const [etapa, setEtapa] = useState<Etapa>({ tipo: 'vazio' })
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set())
  const [erro, setErro] = useState<string | null>(null)
  const [gerando, setGerando] = useState(false)
  const [gerado, setGerado] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/reajuste/indice')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((corpo: { meses: Array<{ mes: string; variacao: string }> }) => {
        setMeses(corpo.meses)
        const ultimo = corpo.meses.at(-1)?.mes
        if (ultimo) {
          const sugestao = periodoSugerido(ultimo)
          setInicial(sugestao.inicial)
          setFinal(sugestao.final)
        }
      })
      .catch(() => setErro('Não foi possível carregar o IPC-Fipe.'))
  }, [])

  const indice = useMemo(() => new Map((meses ?? []).map((m) => [m.mes, m.variacao])), [meses])
  const calculo = inicial && final ? calcularPeriodo(inicial, final, indice) : null
  const fator = calculo?.ok ? fatorCompleto(calculo.meses) : null

  async function escolher(arquivo: File) {
    setErro(null)
    setGerado(null)
    setEtapa({ tipo: 'lendo', nome: arquivo.name })
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
      setEtapa({ tipo: 'pronto', nome: arquivo.name, endereco, leitura })
    } catch (e) {
      setEtapa({ tipo: 'vazio' })
      setErro(e instanceof Error ? e.message : 'Falha ao enviar o arquivo.')
    }
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
      body: JSON.stringify({ endereco: etapa.endereco, nomeArquivo: etapa.nome, inicial, final, ...selecao }),
    })
    const corpo = await r.json().catch(() => null)
    setGerando(false)
    if (!r.ok) return setErro(corpo?.error ?? 'Falha ao gerar.')
    setGerado(corpo.id)
  }

  const podeGerar = etapa.tipo === 'pronto' && calculo?.ok === true && marcadas.size > 0 && !gerando && !gerado

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-6 py-8 lg:px-8">
      <div>
        <h1 className="text-[1.75rem] leading-tight font-semibold tracking-tight text-navy">Reajuste IPC-Fipe</h1>
        <p className="text-sm text-mid-grey">Corrija os valores de uma planilha, PDF ou Word pelo IPC-Fipe acumulado.</p>
      </div>

      {erro && <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</p>}

      <section className="space-y-3 rounded-lg border p-4">
        <h2 className="font-semibold text-navy">1. Arquivo</h2>
        <label className="flex flex-col gap-1 text-sm">
          Planilha (.xlsx, .csv), PDF ou Word (.docx)
          <input
            aria-label="Arquivo"
            type="file"
            accept=".xlsx,.csv,.pdf,.docx"
            onChange={(e) => {
              const arquivo = e.target.files?.[0]
              if (arquivo) void escolher(arquivo)
            }}
          />
        </label>
        {etapa.tipo === 'lendo' && (
          <p className="flex items-center gap-2 text-sm text-mid-grey">
            <Loader2 className="size-4 animate-spin" /> Lendo {etapa.nome}…
          </p>
        )}
        {etapa.tipo === 'pronto' && etapa.leitura.tipo === 'texto' && (
          <p className="text-xs text-mid-grey">
            PDF e Word não são reescritos: o resultado é uma planilha com cada valor original e corrigido.
          </p>
        )}
      </section>

      {meses && inicial && (
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

      {etapa.tipo === 'pronto' && (
        <section className="space-y-3 rounded-lg border p-4">
          <h2 className="font-semibold text-navy">3. Valores</h2>
          <Selecao
            leitura={etapa.leitura}
            fator={fator}
            marcadas={marcadas}
            onMudar={(m) => {
              setMarcadas(m)
              setGerado(null)
            }}
          />
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className={BTN_PRIMARY} disabled={!podeGerar} onClick={gerar}>
              {gerando ? 'Gerando…' : 'Gerar planilha'}
            </button>
            {gerado && (
              <>
                <a className={BTN_OUTLINE} href={`/api/reajuste/${gerado}/arquivo/resultado`}>
                  <Download className="size-4" /> Baixar resultado
                </a>
                <Link className={LINK_NAVY} href="/reajuste/historico">
                  Ver no histórico
                </Link>
              </>
            )}
          </div>
        </section>
      )}
    </main>
  )
}
