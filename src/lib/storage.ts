import path from 'node:path'

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

export function getUploadFullPath(relativePath: string): string {
  const uploadDir = process.env.UPLOAD_DIR
  if (!uploadDir) throw new Error('UPLOAD_DIR não configurado')
  return path.join(uploadDir, relativePath)
}

export function getUploadPublicUrl(relativePath: string): string {
  const baseUrl = process.env.UPLOAD_BASE_URL
  if (!baseUrl) throw new Error('UPLOAD_BASE_URL não configurado')
  return `${baseUrl}/${relativePath}`
}
