import { put, del, list } from '@vercel/blob'

export function buildUploadPath(documentoId: string, extensao: string, data: Date = new Date()): string {
  const ano = String(data.getFullYear())
  const mes = String(data.getMonth() + 1).padStart(2, '0')
  return `${ano}/${mes}/${documentoId}/original.${extensao}`
}

/** Caminho de uma imagem extraída de dentro de um PDF — fica na mesma "pasta"
 *  do original, então apagar o prefixo do documento leva as imagens junto. */
export function buildImagemPath(documentoId: string, nomeArquivo: string, data: Date = new Date()): string {
  const ano = String(data.getFullYear())
  const mes = String(data.getMonth() + 1).padStart(2, '0')
  return `${ano}/${mes}/${documentoId}/imagens/${nomeArquivo}`
}

export function buildRelatorioPath(documentoId: string, data: Date = new Date()): string {
  const ano = String(data.getFullYear())
  const mes = String(data.getMonth() + 1).padStart(2, '0')
  return `${ano}/${mes}/${documentoId}/relatorio.pdf`
}

export function buildRelatorioConsolidadoPath(analiseConsolidadaId: string, data: Date = new Date()): string {
  const ano = String(data.getFullYear())
  const mes = String(data.getMonth() + 1).padStart(2, '0')
  return `${ano}/${mes}/consolidadas/${analiseConsolidadaId}/relatorio.pdf`
}

export function buildRelatorioEvolucaoPath(analiseEvolucaoId: string, data: Date = new Date()): string {
  const ano = String(data.getFullYear())
  const mes = String(data.getMonth() + 1).padStart(2, '0')
  return `${ano}/${mes}/evolucoes/${analiseEvolucaoId}/relatorio.pdf`
}

/** Prefixo (pasta) de todos os blobs de um documento — usado pra apagar tudo de uma vez. */
export function buildRelatorioMedicaoPath(
  clienteId: string,
  competenciaAno: number,
  competenciaMes: number,
  extensao: 'docx' | 'xlsx',
  data: Date = new Date()
): string {
  const ano = String(data.getFullYear())
  const mes = String(data.getMonth() + 1).padStart(2, '0')
  const competencia = `${competenciaAno}-${String(competenciaMes).padStart(2, '0')}`
  return `${ano}/${mes}/medicao/${clienteId}/${competencia}/relatorio.${extensao}`
}

/** Um arquivo de ENTRADA (contrato/levantamento/aditivo) de uma
 *  AnaliseMedicaoContratual — sobrescreve a cada nova tentativa pra essa
 *  competência (mesmo caminho, `papel`+`ordem` distinguem contrato de
 *  levantamento de cada aditivo). */
export function buildArquivoMedicaoPath(
  clienteId: string,
  competenciaAno: number,
  competenciaMes: number,
  papel: string,
  ordem: number,
  nomeArquivo: string,
  data: Date = new Date()
): string {
  const ano = String(data.getFullYear())
  const mes = String(data.getMonth() + 1).padStart(2, '0')
  const competencia = `${competenciaAno}-${String(competenciaMes).padStart(2, '0')}`
  return `${ano}/${mes}/medicao/${clienteId}/${competencia}/entrada/${papel}-${ordem}-${nomeArquivo}`
}

export function buildDocumentoPrefix(documentoId: string, data: Date = new Date()): string {
  const ano = String(data.getFullYear())
  const mes = String(data.getMonth() + 1).padStart(2, '0')
  return `${ano}/${mes}/${documentoId}/`
}

/** Prefixo da pasta de imagens de um arquivo, deduzido da URL do original que
 *  está no banco — sem recalcular ano/mês, que podem ter virado desde o upload.
 *  Devolve `null` quando a URL não tem o formato esperado. */
export function prefixoDeImagensDoOriginal(urlDoOriginal: string): string | null {
  try {
    const caminho = new URL(urlDoOriginal).pathname.replace(/^\//, '')
    const pasta = caminho.replace(/[^/]+$/, '')
    return pasta ? `${pasta}imagens/` : null
  } catch {
    return null
  }
}

/** Sobe um arquivo pro Vercel Blob e retorna a URL pública (não-adivinhável) dele. */
export async function putUpload(pathname: string, data: Buffer, contentType?: string): Promise<string> {
  const blob = await put(pathname, data, {
    access: 'public',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType,
  })
  return blob.url
}

/** Baixa o conteúdo de um blob a partir da URL salva no banco. */
export async function getUpload(url: string): Promise<Buffer> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Falha ao baixar arquivo do storage (${res.status})`)
  return Buffer.from(await res.arrayBuffer())
}

/** Apaga todos os blobs sob um prefixo (equivalente a apagar a "pasta" de um documento). */
export async function deleteUploadPrefix(prefix: string): Promise<void> {
  const { blobs } = await list({ prefix })
  if (blobs.length === 0) return
  await del(blobs.map((b) => b.url))
}

/** Apaga um único blob a partir da URL salva no banco (ex.: um arquivo
 *  específico dentro de uma proposta comercial com vários arquivos). */
export async function deleteUpload(url: string): Promise<void> {
  await del(url)
}
