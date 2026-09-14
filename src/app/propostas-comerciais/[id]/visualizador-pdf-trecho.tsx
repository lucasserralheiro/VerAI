'use client'

import { useEffect, useRef, useState } from 'react'
import { AlertCircle, ChevronLeft, ChevronRight, ClipboardCheck, ExternalLink, Loader2, Minus, Plus } from 'lucide-react'
import { BTN_OUTLINE_SM } from '@/lib/ui'
import { cn } from '@/lib/utils'

type DocumentoPdf = Awaited<ReturnType<(typeof import('unpdf'))['getDocumentProxy']>>
type ItemTexto = { str: string; transform: number[]; width: number; height: number }
type Retangulo = { x: number; y: number; w: number; h: number }

const ZOOM_MIN = 0.5
const ZOOM_MAX = 3
const BOTAO_ICONE =
  'flex size-8 items-center justify-center rounded-md text-navy transition-colors hover:bg-navy/[0.06] disabled:pointer-events-none disabled:opacity-30'

export interface VisualizadorPdfTrechoProps {
  /** Rota que serve o PDF (binário). */
  url: string
  pagina: number
  /** Texto a destacar na página — normalmente o "no PDF" do trecho suspeito. */
  destaque?: string
  /** Troca pro leitor de PDF do navegador (também usado se isto falhar). */
  onAbrirLeitorCompleto: () => void
  /** Quando passado, mostra o botão "Usar texto selecionado" — pega o que
   *  a pessoa selecionou na página e devolve pra fora (ex.: preencher o
   *  "No PDF" da checagem quando a extração automática não achou nada). */
  onUsarSelecao?: (texto: string) => void
}

/**
 * Mostra UMA página do PDF desenhada pelo próprio app (pdf.js que já vem no
 * `unpdf`) e pinta de laranja o trecho procurado — o leitor do navegador só
 * sabe abrir numa página, não achar nem destacar texto.
 *
 * A busca compara só letras e números (mesma ideia da checagem no servidor):
 * a extração do PDF quebra linha, hifeniza e separa palavras em pedaços, e
 * isso não pode impedir de achar o trecho. Se o trecho inteiro não bater,
 * tenta pelo começo e pelo fim dele.
 */
export function VisualizadorPdfTrecho({
  url,
  pagina: paginaInicial,
  destaque,
  onAbrirLeitorCompleto,
  onUsarSelecao,
}: VisualizadorPdfTrechoProps) {
  const rolagemRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const camadaTextoRef = useRef<HTMLDivElement>(null)
  const [documento, setDocumento] = useState<DocumentoPdf | null>(null)
  const [pagina, setPagina] = useState(paginaInicial)
  const [zoom, setZoom] = useState(1)
  const [fase, setFase] = useState<'carregando' | 'pronto' | 'erro'>('carregando')
  const [tamanho, setTamanho] = useState<{ w: number; h: number } | null>(null)
  const [destaques, setDestaques] = useState<Retangulo[]>([])
  const [temSelecao, setTemSelecao] = useState(false)

  useEffect(() => {
    setPagina(paginaInicial)
  }, [paginaInicial])

  // Carrega o PDF uma vez por arquivo.
  useEffect(() => {
    let cancelado = false
    let carregado: DocumentoPdf | null = null
    setFase('carregando')
    ;(async () => {
      try {
        const [{ getDocumentProxy }, resposta] = await Promise.all([import('unpdf'), fetch(url)])
        if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`)
        const dados = new Uint8Array(await resposta.arrayBuffer())
        carregado = await getDocumentProxy(dados)
        if (cancelado) {
          liberar(carregado)
          return
        }
        setDocumento(carregado)
      } catch (erro) {
        console.error('visualizador de PDF: não carregou —', erro)
        if (!cancelado) setFase('erro')
      }
    })()
    return () => {
      cancelado = true
      liberar(carregado)
    }
  }, [url])

  // Desenha a página e procura o trecho.
  useEffect(() => {
    const canvas = canvasRef.current
    const rolagem = rolagemRef.current
    if (!documento || !canvas || !rolagem) return
    let cancelado = false
    let tarefa: { cancel: () => void; promise: Promise<unknown> } | null = null
    let camadaTexto: { cancel: () => void } | null = null
    setFase('carregando')
    ;(async () => {
      try {
        const numero = Math.min(Math.max(pagina, 1), documento.numPages)
        const pag = await documento.getPage(numero)
        const base = pag.getViewport({ scale: 1 })
        const larguraUtil = Math.max(rolagem.clientWidth - 32, 200)
        const viewport = pag.getViewport({ scale: (larguraUtil / base.width) * zoom })
        const dpr = window.devicePixelRatio || 1
        canvas.width = Math.floor(viewport.width * dpr)
        canvas.height = Math.floor(viewport.height * dpr)
        canvas.style.width = `${viewport.width}px`
        canvas.style.height = `${viewport.height}px`
        const contexto = canvas.getContext('2d')
        if (!contexto) throw new Error('canvas sem contexto 2d')
        tarefa = pag.render({
          canvasContext: contexto,
          canvas,
          viewport,
          transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined,
        } as unknown as Parameters<typeof pag.render>[0])
        await tarefa.promise
        if (cancelado) return

        const conteudo = await pag.getTextContent()
        const itens = (conteudo.items as unknown[]).filter(
          (i): i is ItemTexto => typeof i === 'object' && i !== null && 'str' in i && 'transform' in i
        )
        const achados = destaque ? localizarTrecho(destaque, itens, viewport.transform, viewport.scale) : []
        if (cancelado) return

        // Mesmo texto do getTextContent acima, só que virando <span> transparente em
        // cima do canvas — assim dá pra selecionar e copiar o texto de verdade da
        // página em vez de só enxergar os pixels desenhados.
        const elementoCamada = camadaTextoRef.current
        if (elementoCamada) {
          elementoCamada.replaceChildren()
          const { getResolvedPDFJS } = await import('unpdf')
          const pdfjs = await getResolvedPDFJS()
          const novaCamada = new pdfjs.TextLayer({ textContentSource: conteudo, container: elementoCamada, viewport })
          camadaTexto = novaCamada
          await novaCamada.render()
          estilizarCamadaDeTexto(elementoCamada, viewport.scale)
        }
        if (cancelado) return

        setTamanho({ w: viewport.width, h: viewport.height })
        setDestaques(achados)
        setFase('pronto')
      } catch (erro) {
        if (cancelado || (erro instanceof Error && erro.name === 'RenderingCancelledException')) return
        console.error('visualizador de PDF: não desenhou a página —', erro)
        setFase('erro')
      }
    })()
    return () => {
      cancelado = true
      tarefa?.cancel()
      camadaTexto?.cancel()
    }
  }, [documento, pagina, zoom, destaque])

  // Liga o botão "Usar texto selecionado" só quando a seleção atual está
  // dentro da própria camada de texto — não quando é de outra parte da tela.
  useEffect(() => {
    if (!onUsarSelecao) return
    function verificarSelecao() {
      const selecao = window.getSelection()
      const texto = selecao?.toString().trim() ?? ''
      const dentro = !!texto && !!selecao?.anchorNode && !!camadaTextoRef.current?.contains(selecao.anchorNode)
      setTemSelecao(dentro)
    }
    document.addEventListener('selectionchange', verificarSelecao)
    return () => document.removeEventListener('selectionchange', verificarSelecao)
  }, [onUsarSelecao])

  function usarSelecao() {
    const texto = window.getSelection()?.toString().trim()
    if (!texto) return
    onUsarSelecao?.(texto)
    window.getSelection()?.removeAllRanges()
    setTemSelecao(false)
  }

  // Leva o destaque pra perto do topo da área visível.
  useEffect(() => {
    const rolagem = rolagemRef.current
    if (!rolagem || destaques.length === 0) return
    const topo = Math.min(...destaques.map((r) => r.y))
    rolagem.scrollTo({ top: Math.max(topo - 80, 0), behavior: 'smooth' })
  }, [destaques])

  const total = documento?.numPages ?? null
  const naPaginaCitada = pagina === paginaInicial

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-border-grey bg-light-grey">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border-grey bg-white px-3 py-1.5">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setPagina((p) => Math.max(p - 1, 1))}
            disabled={pagina <= 1}
            aria-label="Página anterior"
            className={BOTAO_ICONE}
          >
            <ChevronLeft className="size-4" strokeWidth={2.25} />
          </button>
          <span className="px-1 text-sm text-navy tabular-nums">
            Página <span className="font-semibold">{pagina}</span>
            {total !== null && <span className="text-mid-grey"> de {total}</span>}
          </span>
          <button
            type="button"
            onClick={() => setPagina((p) => (total ? Math.min(p + 1, total) : p + 1))}
            disabled={total !== null && pagina >= total}
            aria-label="Próxima página"
            className={BOTAO_ICONE}
          >
            <ChevronRight className="size-4" strokeWidth={2.25} />
          </button>
        </div>

        {destaque && fase === 'pronto' && (
          <p className="text-sm" aria-live="polite">
            {destaques.length > 0 ? (
              <span className="inline-flex items-center gap-1.5 font-medium text-navy">
                <span aria-hidden className="size-3 rounded-sm bg-orange/50 ring-1 ring-orange" />
                Trecho destacado
              </span>
            ) : naPaginaCitada ? (
              <span className="text-mid-grey">Não achei o trecho exato nesta página — confira a página inteira.</span>
            ) : null}
          </p>
        )}

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(ZOOM_MIN, +(z - 0.25).toFixed(2)))}
            disabled={zoom <= ZOOM_MIN}
            aria-label="Diminuir zoom"
            className={BOTAO_ICONE}
          >
            <Minus className="size-4" strokeWidth={2.25} />
          </button>
          <span className="w-12 text-center text-sm text-navy tabular-nums">{Math.round(zoom * 100)}%</span>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(ZOOM_MAX, +(z + 0.25).toFixed(2)))}
            disabled={zoom >= ZOOM_MAX}
            aria-label="Aumentar zoom"
            className={BOTAO_ICONE}
          >
            <Plus className="size-4" strokeWidth={2.25} />
          </button>
          {onUsarSelecao && (
            <button
              type="button"
              onClick={usarSelecao}
              disabled={!temSelecao}
              title={temSelecao ? 'Usa o texto selecionado na página' : 'Selecione um texto na página primeiro'}
              className={cn(BTN_OUTLINE_SM, 'ml-1')}
            >
              <ClipboardCheck className="size-3.5" strokeWidth={2.25} />
              Usar texto selecionado
            </button>
          )}
          <button
            type="button"
            onClick={onAbrirLeitorCompleto}
            title="Abrir no leitor de PDF do navegador (busca, impressão, todas as páginas)"
            className="ml-1 inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm font-medium text-navy transition-colors hover:bg-navy/[0.06]"
          >
            <ExternalLink className="size-3.5" strokeWidth={2.25} />
            Leitor completo
          </button>
        </div>
      </div>

      <div ref={rolagemRef} className="relative min-h-0 flex-1 overflow-auto p-4">
        <div
          className="relative mx-auto bg-white shadow-md"
          style={tamanho ? { width: tamanho.w, height: tamanho.h } : undefined}
        >
          <canvas ref={canvasRef} className="block" />
          <div ref={camadaTextoRef} className="absolute inset-0 overflow-hidden" />
          {destaques.map((r, i) => (
            <div
              key={i}
              aria-hidden
              className="pointer-events-none absolute rounded-[2px] bg-orange/30 mix-blend-multiply ring-1 ring-orange/70"
              style={{ left: r.x - 2, top: r.y - 1, width: r.w + 4, height: r.h + 2 }}
            />
          ))}
        </div>

        {fase === 'carregando' && (
          <div className="absolute inset-0 flex items-center justify-center gap-2 bg-light-grey/70 text-sm text-mid-grey">
            <Loader2 className="size-4 animate-spin" strokeWidth={2.25} />
            Carregando a página...
          </div>
        )}
        {fase === 'erro' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-light-grey p-6 text-center">
            <p className="flex items-center gap-2 text-[15px] text-navy">
              <AlertCircle className="size-4 shrink-0 text-red-crit" strokeWidth={2.25} />
              Não deu pra desenhar a página aqui.
            </p>
            <button
              type="button"
              onClick={onAbrirLeitorCompleto}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-xl bg-navy px-3.5 py-1.5 text-sm font-medium text-white hover:bg-navy/90'
              )}
            >
              <ExternalLink className="size-3.5" strokeWidth={2.25} />
              Abrir no leitor do navegador
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

/** Solta a memória do PDF. O pdf.js que vem no `unpdf` nem sempre expõe
 *  `destroy` no documento (depende do build) — por isso tudo opcional, e
 *  nunca pode derrubar a tela. */
function liberar(documento: DocumentoPdf | null) {
  try {
    const alvo = documento as unknown as { destroy?: () => unknown; cleanup?: () => unknown } | null
    const retorno = alvo?.destroy?.() ?? alvo?.cleanup?.()
    if (retorno instanceof Promise) retorno.catch(() => {})
  } catch {
    // sem problema — o coletor de lixo resolve
  }
}

/**
 * O pdf.js monta os <span>/<br> da camada de texto direto via `document.
 * createElement`, sem classe nem estilo — normalmente isso é resolvido pelo
 * CSS oficial do leitor (`.textLayer span`), mas aqui não dá pra confiar que
 * um `:global()` de CSS module vai bater com elemento criado assim fora do
 * React. Por isso aplica à mão, igual ao CSS oficial: cor transparente (o
 * texto de verdade é só o do canvas, essa camada é pra selecionar/copiar) e
 * a escala/rotação que o pdf.js manda via `--scale-x`/`--rotate`. Sem isso a
 * palavra aparece em cima do canvas com a fonte do navegador — texto opaco
 * duplicado, borrado.
 */
function estilizarCamadaDeTexto(container: HTMLElement, escalaViewport: number): void {
  for (const elemento of container.querySelectorAll<HTMLElement>('span, br')) {
    elemento.style.position = 'absolute'
    elemento.style.color = 'transparent'
    elemento.style.whiteSpace = 'pre'
    elemento.style.cursor = 'text'
    elemento.style.transformOrigin = '0% 0%'
    if (elemento.classList.contains('markedContent')) {
      elemento.style.top = '0'
      elemento.style.height = '0'
    }
    // O pdf.js grava a altura da fonte em `--font-height`, mas em unidade
    // "crua" do PDF (independente do zoom/escala atual) — o CSS oficial dele
    // (que não importamos aqui, só reimplementamos um subconjunto à mão)
    // é quem faria essa conversão pra px de tela. Sem isto, TODO <span> fica
    // com o tamanho de fonte HERDADO (bem maior que o número minúsculo de
    // uma tabela) — a camada continua "transparente" no estado normal, mas
    // vira uma bagunça enorme assim que a pessoa seleciona/copia texto (a
    // área realçada da seleção fica muito maior que o texto de verdade,
    // dando a impressão de "zoom" estranho ao copiar).
    const alturaFonte = elemento.style.getPropertyValue('--font-height')
    if (alturaFonte) {
      const pontos = parseFloat(alturaFonte)
      if (!Number.isNaN(pontos)) elemento.style.fontSize = `${(pontos * escalaViewport).toFixed(2)}px`
    }
    const escalaX = elemento.style.getPropertyValue('--scale-x')
    const rotacao = elemento.style.getPropertyValue('--rotate')
    if (escalaX || rotacao) elemento.style.transform = `scale(${escalaX || 1}) rotate(${rotacao || '0deg'})`
  }
}

function soLetrasENumeros(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

/** Mesma conta do `Util.transform` do pdf.js: combina duas matrizes 2D. */
function multiplicar(m1: number[], m2: number[]): number[] {
  return [
    m1[0] * m2[0] + m1[2] * m2[1],
    m1[1] * m2[0] + m1[3] * m2[1],
    m1[0] * m2[2] + m1[2] * m2[3],
    m1[1] * m2[2] + m1[3] * m2[3],
    m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
    m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
  ]
}

/**
 * Acha `alvo` nos pedaços de texto da página e devolve os retângulos (em
 * pixels da página desenhada) dos pedaços que ele cobre. Junta tudo só com
 * letras e números, procura o trecho inteiro e, se não achar, procura pelo
 * começo (120/60/30 caracteres) e estende até onde o fim do trecho aparece.
 */
export function localizarTrecho(
  alvo: string,
  itens: ItemTexto[],
  transformViewport: number[],
  escala: number
): Retangulo[] {
  const partes = itens.map((item) => soLetrasENumeros(item.str))
  const inicios: number[] = []
  let texto = ''
  for (const parte of partes) {
    inicios.push(texto.length)
    texto += parte
  }

  const procurado = soLetrasENumeros(alvo)
  if (procurado.length < 4) return []

  let de = texto.indexOf(procurado)
  let ate = de === -1 ? -1 : de + procurado.length
  if (de === -1) {
    for (const tamanho of [120, 60, 30]) {
      if (tamanho >= procurado.length) continue
      const posicao = texto.indexOf(procurado.slice(0, tamanho))
      if (posicao === -1) continue
      de = posicao
      ate = posicao + tamanho
      const fim = procurado.slice(-30)
      const posFim = texto.indexOf(fim, posicao)
      if (posFim !== -1 && posFim - posicao < procurado.length * 2) ate = posFim + fim.length
      break
    }
  }
  if (de === -1) return []

  const retangulos: Retangulo[] = []
  itens.forEach((item, i) => {
    const inicio = inicios[i]
    const fim = inicio + partes[i].length
    if (partes[i].length === 0 || fim <= de || inicio >= ate) return
    const m = multiplicar(transformViewport, item.transform)
    const alturaFonte = Math.hypot(m[2], m[3]) || item.height * escala
    retangulos.push({ x: m[4], y: m[5] - alturaFonte, w: item.width * escala, h: alturaFonte * 1.15 })
  })
  return mesclarRetangulosDaMesmaLinha(retangulos)
}

/** Funde retângulos vizinhos da mesma linha visual num único retângulo. Uma
 *  tabela quebra cada célula em vários itens de texto separados (o rótulo
 *  "R$" isolado do número, cada coluna um item) — quando o trecho encontrado
 *  cobre vários desses itens adjacentes, sem isto cada um ganha sua própria
 *  caixinha com borda própria (`ring-1`), e a fileira inteira vira uma grade
 *  de retângulos colados e sobrepostos — poluído visualmente, dá impressão
 *  de "zoom"/bagunça em vez de um destaque contínuo e legível. */
function mesclarRetangulosDaMesmaLinha(retangulos: Retangulo[]): Retangulo[] {
  const TOLERANCIA_Y = 4 // px — mesma linha, com folga pra arredondamento/baseline
  const LACUNA_MAXIMA_X = 14 // px — funde só vizinhos próximos, não a linha toda por acidente
  const ordenados = [...retangulos].sort((a, b) => a.y - b.y || a.x - b.x)
  const mesclados: Retangulo[] = []
  for (const r of ordenados) {
    const ultimo = mesclados[mesclados.length - 1]
    if (ultimo && Math.abs(ultimo.y - r.y) <= TOLERANCIA_Y && r.x <= ultimo.x + ultimo.w + LACUNA_MAXIMA_X) {
      const direita = Math.max(ultimo.x + ultimo.w, r.x + r.w)
      const baixo = Math.max(ultimo.y + ultimo.h, r.y + r.h)
      ultimo.w = direita - ultimo.x
      ultimo.h = baixo - ultimo.y
    } else {
      mesclados.push({ ...r })
    }
  }
  return mesclados
}
