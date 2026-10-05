import { binarizarEContrastar } from '@/lib/ocr/preprocessarImagem'
import { TAMANHO_MAXIMO_ANEXO, formatoDoNome } from '@/lib/assistente/anexos/tipos'

// Envio de um anexo do chat do assistente, do navegador (spec 2026-10-02-assistente-anexos):
// PDF escaneado passa pelo OCR aqui (o servidor não tem OCR) → PUT pré-assinado direto no R2 →
// registro na conversa, que devolve a ficha em markdown (já gravada como mensagem do assistente).

export type EtapaAnexo = 'fila' | 'enviando' | 'ocr' | 'lendo' | 'pronto' | 'erro'

export type EstadoAnexo = {
  id: string
  nome: string
  etapa: EtapaAnexo
  progresso?: { pagina: number; total: number }
  erro?: string
  anexoId?: string
}

export type ProgressoOcr = { pagina: number; total: number }
export type PaginaOcr = { pagina: number; texto: string }
export type FuncaoOcr = (arquivo: File, aoProgredir: (p: ProgressoOcr) => void, signal?: AbortSignal) => Promise<PaginaOcr[] | null>

/** O mesmo `MAX_PERGUNTA` do servidor (`lib/assistente/conversas.ts`, que importa o Prisma e não
 *  entra na tela) — o teste garante que os dois não se separam. */
export const LIMITE_DA_PERGUNTA = 2000

/** Página com menos que isso de caracteres não-brancos não tem camada de texto — a mesma regra de
 *  `semCamadaDeTexto` (`lib/assistente/indexacao/extrair.ts`), que o servidor usa no registro. */
const MINIMO_DE_CARACTERES = 20
/** 300 DPI, o mesmo do OCR da conversão de proposta (`lib/ocr/depsOcrPadrao.ts`). */
const ESCALA_RENDER_OCR = 4

class Cancelado extends Error {
  constructor() {
    super('cancelado')
    this.name = 'AbortError'
  }
}

function pararSeCancelado(signal?: AbortSignal) {
  if (signal?.aborted) throw new Cancelado()
}

/** A promessa ou o cancelamento, o que vier primeiro. */
function comAbort<T>(promessa: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promessa
  if (signal.aborted) return Promise.reject(new Cancelado())
  return new Promise<T>((resolve, reject) => {
    const aoAbortar = () => reject(new Cancelado())
    signal.addEventListener('abort', aoAbortar, { once: true })
    promessa.then(resolve, reject).finally(() => signal.removeEventListener('abort', aoAbortar))
  })
}

/**
 * Lê a camada de texto do PDF; se nenhuma página tem texto (escaneado), reconhece cada página com o
 * tesseract (um worker por arquivo, encerrado no fim ou ao abortar). `null` = o PDF já tem texto e o
 * servidor lê sozinho. `unpdf`/`tesseract.js` por `import()` dinâmico: só carregam quando alguém anexa.
 */
export async function ocrSeEscaneado(arquivo: File, aoProgredir: (p: ProgressoOcr) => void, signal?: AbortSignal): Promise<PaginaOcr[] | null> {
  const { getDocumentProxy, extractTextItems } = await import('unpdf')
  pararSeCancelado(signal)
  const pdf = await getDocumentProxy(new Uint8Array(await arquivo.arrayBuffer()))
  try {
    const { items } = await extractTextItems(pdf)
    const temTexto = items.some(
      (pagina) => pagina.map((item) => item.str ?? '').join('').replace(/\s/g, '').length >= MINIMO_DE_CARACTERES
    )
    if (temTexto) return null
    pararSeCancelado(signal)

    const { createWorker } = await import('tesseract.js')
    const worker = await createWorker('por')
    let encerrado = false
    const encerrar = () => {
      if (encerrado) return
      encerrado = true
      void worker.terminate().catch(() => {})
    }
    signal?.addEventListener('abort', encerrar)
    try {
      const paginas: PaginaOcr[] = []
      const total = pdf.numPages
      for (let numero = 1; numero <= total; numero++) {
        pararSeCancelado(signal)
        aoProgredir({ pagina: numero, total })
        const pagina = await pdf.getPage(numero)
        const viewport = pagina.getViewport({ scale: ESCALA_RENDER_OCR })
        const canvas = document.createElement('canvas')
        try {
          canvas.width = viewport.width
          canvas.height = viewport.height
          const contexto = canvas.getContext('2d')
          if (!contexto) throw new Error('não foi possível criar o contexto de canvas')
          await pagina.render({ canvas, canvasContext: contexto, viewport }).promise
          const imagem = contexto.getImageData(0, 0, canvas.width, canvas.height)
          binarizarEContrastar(imagem)
          contexto.putImageData(imagem, 0, 0)
          // O terminate() do tesseract não rejeita o job em curso: sem a corrida com o abort, cancelar
          // no meio de uma página deixaria esta promessa pendente para sempre.
          const { data } = await comAbort(worker.recognize(canvas.toDataURL('image/png')), signal)
          pararSeCancelado(signal)
          paginas.push({ pagina: numero, texto: data.text.trim() })
        } finally {
          // Libera o bitmap da página (escala 4 pesa), inclusive quando cancelou ou falhou.
          canvas.width = 0
          canvas.height = 0
        }
      }
      return paginas
    } finally {
      signal?.removeEventListener('abort', encerrar)
      encerrar()
    }
  } finally {
    // O tipo do unpdf não declara o destroy, mas o PDFDocumentProxy do pdf.js tem.
    try {
      await (pdf as { destroy?: () => Promise<void> }).destroy?.()
    } catch {
      // liberar é best-effort: o resultado do OCR (ou o erro original) é o que importa
    }
  }
}

/** Por que o arquivo não pode ser anexado (`null` = pode). Conferido antes de criar conversa e de enviar. */
export function motivoDeRecusa(arquivo: File): string | null {
  if (!formatoDoNome(arquivo.name)) return 'formato não aceito'
  if (arquivo.size > TAMANHO_MAXIMO_ANEXO) return 'arquivo acima de 50 MB'
  return null
}

/**
 * Envia um anexo e o registra na conversa. Chama `aoMudar` a cada etapa (o cartão da tela) e devolve
 * a ficha; `null` quando deu erro (já avisado em `aoMudar`) ou quando `signal` abortou — nesse caso o
 * anexo NÃO é registrado e nenhuma etapa de erro é emitida (quem abortou já trocou de conversa).
 */
export async function enviarAnexo(
  arquivo: File,
  conversaId: string,
  aoMudar: (e: Partial<EstadoAnexo>) => void,
  deps: { ocr?: FuncaoOcr; fetch?: typeof fetch; signal?: AbortSignal } = {}
): Promise<{ anexoId: string; texto: string } | null> {
  const buscar = deps.fetch ?? ((...a: Parameters<typeof fetch>) => fetch(...a))
  const { signal } = deps
  const recusa = motivoDeRecusa(arquivo)
  if (recusa) {
    aoMudar({ etapa: 'erro', erro: recusa })
    return null
  }
  const formato = formatoDoNome(arquivo.name)

  try {
    let paginasOcr: PaginaOcr[] | null = null
    if (formato === 'pdf') {
      paginasOcr = await (deps.ocr ?? ocrSeEscaneado)(arquivo, (progresso) => aoMudar({ etapa: 'ocr', progresso }), signal)
    }
    pararSeCancelado(signal)

    aoMudar({ etapa: 'enviando' })
    const pedido = await buscar(`/api/assistente/conversas/${conversaId}/anexos/envio`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome: arquivo.name, tamanhoBytes: arquivo.size }),
      signal,
    })
    const link = (await pedido.json().catch(() => null)) as { url?: string; endereco?: string; contentType?: string; error?: string } | null
    if (!pedido.ok || !link?.url || !link.endereco) throw new Error(link?.error ?? `Falha ao preparar o envio de "${arquivo.name}".`)

    let envio: Response
    try {
      // O link amarra o tipo: o Content-Type tem de ser exatamente o que a rota assinou.
      envio = await buscar(link.url, { method: 'PUT', headers: { 'Content-Type': link.contentType ?? '' }, body: arquivo, signal })
    } catch (e) {
      if (signal?.aborted) throw e
      // Erro de rede aqui é quase sempre o bucket sem CORS para esta origem.
      throw new Error(`Não foi possível enviar "${arquivo.name}" para o armazenamento.`)
    }
    if (!envio.ok) throw new Error(`O armazenamento recusou "${arquivo.name}" (${envio.status}).`)
    pararSeCancelado(signal)

    aoMudar({ etapa: 'lendo' })
    const registro = await buscar(`/api/assistente/conversas/${conversaId}/anexos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endereco: link.endereco, nome: arquivo.name, ...(paginasOcr ? { paginasOcr } : {}) }),
      signal,
    })
    const corpo = (await registro.json().catch(() => null)) as { anexo?: { id: string }; texto?: string; error?: string } | null
    if (!registro.ok || !corpo?.anexo || typeof corpo.texto !== 'string') throw new Error(corpo?.error ?? `Não foi possível ler "${arquivo.name}".`)
    aoMudar({ etapa: 'pronto', anexoId: corpo.anexo.id })
    return { anexoId: corpo.anexo.id, texto: corpo.texto }
  } catch (e) {
    if (signal?.aborted) return null
    aoMudar({ etapa: 'erro', erro: e instanceof Error ? e.message : 'falha no envio' })
    return null
  }
}

/** Texto colado longo vira um .txt com a data e a hora de Brasília no nome. */
export function arquivoDoTextoColado(texto: string, agora: Date = new Date()): File {
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(agora)
      .map((p) => [p.type, p.value])
  )
  const nome = `texto-colado-${partes.year}-${partes.month}-${partes.day}-${partes.hour}${partes.minute}.txt`
  return new File([texto], nome, { type: 'text/plain' })
}

/** Pergunta que acompanha o texto colado: a primeira linha não vazia, se couber. */
export function perguntaDoTextoColado(texto: string): string {
  const primeira = texto.split(/\r?\n/).map((l) => l.trim()).find((l) => l.length > 0)
  return primeira && primeira.length <= LIMITE_DA_PERGUNTA ? primeira : 'Analise o texto colado.'
}
