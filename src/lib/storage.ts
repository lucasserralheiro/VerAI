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

export function buildDocumentoPrefix(documentoId: string, data: Date = new Date()): string {
  const ano = String(data.getFullYear())
  const mes = String(data.getMonth() + 1).padStart(2, '0')
  return `${ano}/${mes}/${documentoId}/`
}

/** PDF anexado manualmente a um faturamento (aba Faturamento). Caminho fixo (sem ano/mês) pra
 *  re-anexar sempre sobrescrever o mesmo blob, sem precisar apagar o antigo à parte. */
export function buildFaturamentoPdfPath(faturamentoId: string): string {
  return `faturamentos/${faturamentoId}/anexo.pdf`
}

/** PDF anexado a uma linha do histórico do contrato: `proposta` (PC/PA) ou `termo` (TC/TA).
 *  Caminho fixo por linha e tipo, então reanexar sobrescreve o mesmo blob. */
export type TipoPdfHistorico = 'proposta' | 'termo'

export function buildHistoricoContratoPdfPath(historicoId: string, tipo: TipoPdfHistorico): string {
  return `historico-contrato/${historicoId}/${tipo}.pdf`
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

/** Apaga todos os blobs sob um prefixo (equivalente a apagar a "pasta" de um documento).
 *  `exceto` tira URLs específicas da lista antes de apagar — usado quando um `ArquivoCliente`
 *  migrado aponta pro mesmo blob de um `Documento` antigo (dedupe do repositório de arquivos:
 *  outro `Documento` pode compartilhar o mesmo conteúdo/URL). */
export async function deleteUploadPrefix(prefix: string, exceto: string[] = []): Promise<void> {
  const { blobs } = await list({ prefix })
  const paraApagar = blobs.filter((b) => !exceto.includes(b.url))
  if (paraApagar.length === 0) return
  await del(paraApagar.map((b) => b.url))
}

/** Apaga um único blob a partir da URL salva no banco (ex.: um arquivo
 *  específico dentro de uma proposta comercial com vários arquivos). */
export async function deleteUpload(url: string): Promise<void> {
  await del(url)
}

/** Os dois documentos gerados por uma execução do ConfereAI (`/confere`).
 *  Mesma "pasta" por execução, então apagar o prefixo leva os dois junto. */
export function buildConfereExecucaoPath(
  execucaoId: string,
  tipo: 'docx' | 'xlsx',
  data: Date = new Date()
): string {
  const ano = String(data.getFullYear())
  const mes = String(data.getMonth() + 1).padStart(2, '0')
  const nome = tipo === 'docx' ? 'relatorio.docx' : 'analise.xlsx'
  return `${ano}/${mes}/confere/${execucaoId}/${nome}`
}
