import { put, del, list } from '@vercel/blob'

export function buildUploadPath(documentoId: string, extensao: string, data: Date = new Date()): string {
  const ano = String(data.getFullYear())
  const mes = String(data.getMonth() + 1).padStart(2, '0')
  return `${ano}/${mes}/${documentoId}/original.${extensao}`
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
export function buildDocumentoPrefix(documentoId: string, data: Date = new Date()): string {
  const ano = String(data.getFullYear())
  const mes = String(data.getMonth() + 1).padStart(2, '0')
  return `${ano}/${mes}/${documentoId}/`
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
