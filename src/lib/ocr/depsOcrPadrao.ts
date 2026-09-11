import type { DepsRodarOcr } from './rodarOcr'

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
    const viewport = page.getViewport({ scale: 2 })
    const canvas = document.createElement('canvas')
    canvas.width = viewport.width
    canvas.height = viewport.height
    const contexto = canvas.getContext('2d')
    if (!contexto) throw new Error('não foi possível criar o contexto de canvas')
    await page.render({ canvas, canvasContext: contexto, viewport }).promise
    return canvas.toDataURL('image/png')
  }

  let workerPromise: ReturnType<typeof criarWorker> | null = null
  async function criarWorker() {
    const { createWorker } = await import('tesseract.js')
    return createWorker('por')
  }
  async function reconhecer(imagemDataUrl: string): Promise<string> {
    if (!workerPromise) workerPromise = criarWorker()
    const worker = await workerPromise
    const { data } = await worker.recognize(imagemDataUrl)
    return data.text.trim()
  }

  return { renderizarPagina, reconhecer }
}
