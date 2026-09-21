import type { DepsRodarOcr, ResultadoReconhecimento } from './rodarOcr'
import { binarizarEContrastar } from './preprocessarImagem'

/** Escala de renderização da página pro OCR — 1 ponto de PDF = 1/72 polegada,
 *  então escala × 72 = DPI efetivo. 300 DPI é o valor oficialmente
 *  recomendado pela documentação do Tesseract pra melhor acurácia
 *  (https://tesseract-ocr.github.io/tessdoc/ImproveQuality.html) — não é
 *  medido contra um corpus deste projeto (mesma ressalva de
 *  `LIMIAR_CHARS_PAGINA_IMAGEM` em pdfHtml.ts); ajustar com cautela.
 *  300/72 ≈ 4.17, arredondado pra 4 (300 DPI ainda dentro da faixa
 *  recomendada, sem gerar bitmap desproporcionalmente grande). */
const ESCALA_RENDER_OCR = 4

/**
 * Implementação de verdade de `DepsRodarOcr`, usando `unpdf`/`tesseract.js`
 * carregados por `import()` dinâmico — só entra em bundle quando alguém roda
 * o OCR de verdade (nunca no carregamento normal do editor). Fica separado
 * de `ocr-runner.tsx` pra o componente poder mockar essa fronteira inteira
 * num `jest.mock` só.
 */
export async function carregarDepsOcrPadrao(propostaId: string): Promise<DepsRodarOcr> {
  const buffersPorArquivo = new Map<string, ArrayBuffer>()

  async function renderizarPagina(arquivoId: string, pagina: number): Promise<string> {
    let buffer = buffersPorArquivo.get(arquivoId)
    if (!buffer) {
      const resposta = await fetch(`/api/propostas-comerciais/${propostaId}/arquivos/${arquivoId}`)
      if (!resposta.ok) throw new Error('falha ao baixar o arquivo original pra OCR')
      buffer = await resposta.arrayBuffer()
      buffersPorArquivo.set(arquivoId, buffer)
    }

    const { getDocumentProxy } = await import('unpdf')
    const pdf = await getDocumentProxy(new Uint8Array(buffer))
    const page = await pdf.getPage(pagina)
    const viewport = page.getViewport({ scale: ESCALA_RENDER_OCR })
    const canvas = document.createElement('canvas')
    canvas.width = viewport.width
    canvas.height = viewport.height
    const contexto = canvas.getContext('2d')
    if (!contexto) throw new Error('não foi possível criar o contexto de canvas')
    await page.render({ canvas, canvasContext: contexto, viewport }).promise

    const imageData = contexto.getImageData(0, 0, canvas.width, canvas.height)
    binarizarEContrastar(imageData)
    contexto.putImageData(imageData, 0, 0)

    return canvas.toDataURL('image/png')
  }

  let workerPromise: ReturnType<typeof criarWorker> | null = null
  async function criarWorker() {
    const { createWorker } = await import('tesseract.js')
    return createWorker('por')
  }
  async function reconhecer(imagemDataUrl: string): Promise<ResultadoReconhecimento> {
    if (!workerPromise) workerPromise = criarWorker()
    let worker: Awaited<ReturnType<typeof criarWorker>>
    try {
      worker = await workerPromise
    } catch (erro) {
      // Sem isto, uma falha na CRIAÇÃO do worker (rede, carregamento do
      // modelo de português) fica guardada nesta promise rejeitada pra
      // sempre — toda página seguinte do mesmo lote herdaria o mesmo erro
      // sem nunca tentar de novo, mesmo que a causa original já tenha
      // passado. `rodarOcrEmBlocos` documenta que falha numa página não
      // aborta as outras; sem resetar aqui, essa garantia vale só na
      // aparência quando quem quebra é o worker, não a página.
      workerPromise = null
      throw erro
    }
    // `{ blocks: true }` é o que faz o tesseract.js devolver
    // `data.blocks[].paragraphs[].lines[].words[]` com bounding box por
    // palavra — sem isso `data.blocks` vem `null` (só o texto corrido em
    // `data.text`).
    const { data } = await worker.recognize(imagemDataUrl, {}, { blocks: true })
    const palavras = (data.blocks ?? []).flatMap((bloco) =>
      bloco.paragraphs.flatMap((paragrafo) =>
        paragrafo.lines.flatMap((linha) =>
          linha.words.map((palavra) => ({
            texto: palavra.text,
            x: palavra.bbox.x0,
            largura: palavra.bbox.x1 - palavra.bbox.x0,
            y: palavra.bbox.y0,
          }))
        )
      )
    )
    return { texto: data.text.trim(), palavras }
  }

  return { renderizarPagina, reconhecer }
}
