import { converterPdfParaHtml } from '@/lib/extracao/pdfHtml'
import { converterParaHtmlDeterministico } from '@/lib/extracao'
import { extrairPaginas } from '../indexacao/extrair'
import type { PaginaDeTexto } from '../indexacao/trechos'
import { lerEml } from './eml'
import type { FormatoAnexo } from './tipos'

/** Teto do tamanho descomprimido de DOCX/XLSX (zip): acima disso é recusado antes de extrair. */
export const MAX_DESCOMPRIMIDO_ANEXO = 200 * 1024 * 1024

export class ZipGrandeDemais extends Error {
  constructor() {
    super('arquivo compactado grande demais')
    this.name = 'ZipGrandeDemais'
  }
}

/**
 * Soma dos tamanhos descomprimidos declarados no diretório central do zip, sem descomprimir nada.
 * Entrada zip64 (tamanho 0xFFFFFFFF) conta como infinito. `null` quando não acha o diretório (não é
 * zip): a extração falha sozinha depois.
 */
export function tamanhoDescomprimido(buffer: Buffer): number | null {
  // Fim do diretório central: assinatura 0x06054b50, nos últimos 22 + 65535 bytes (comentário).
  const inicio = Math.max(0, buffer.length - 22 - 0xffff)
  let fim = -1
  for (let i = buffer.length - 22; i >= inicio; i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) { fim = i; break }
  }
  if (fim < 0) return null
  const entradas = buffer.readUInt16LE(fim + 10)
  let pos = buffer.readUInt32LE(fim + 16)
  let total = 0
  for (let n = 0; n < entradas; n++) {
    if (pos + 46 > buffer.length || buffer.readUInt32LE(pos) !== 0x02014b50) return null
    const tamanho = buffer.readUInt32LE(pos + 24)
    if (tamanho === 0xffffffff) return Infinity
    total += tamanho
    pos += 46 + buffer.readUInt16LE(pos + 28) + buffer.readUInt16LE(pos + 30) + buffer.readUInt16LE(pos + 32)
  }
  return total
}

/** Texto do anexo página a página. E-mail vira uma página só (cabeçalho + corpo); os anexos do e-mail
 *  não são lidos, só listados pelo nome. */
export async function paginasDoAnexo(buffer: Buffer, formato: FormatoAnexo): Promise<{ paginas: PaginaDeTexto[]; anexosDoEmail: string[] }> {
  if (formato === 'eml') {
    const e = lerEml(buffer)
    const cab = [e.de && `De: ${e.de}`, e.para && `Para: ${e.para}`, e.data && `Data: ${e.data}`, e.assunto && `Assunto: ${e.assunto}`].filter(Boolean).join('\n')
    return { paginas: [{ pagina: null, texto: `${cab}\n\n${e.corpo}`.trim() }], anexosDoEmail: e.anexos }
  }
  if ((formato === 'docx' || formato === 'xlsx') && (tamanhoDescomprimido(buffer) ?? 0) > MAX_DESCOMPRIMIDO_ANEXO) {
    throw new ZipGrandeDemais()
  }
  return { paginas: await extrairPaginas(buffer, formato), anexosDoEmail: [] }
}

/** HTML com tabelas (de onde saem os itens com código de serviço). `''` para txt/eml. */
export async function htmlDoAnexo(buffer: Buffer, formato: FormatoAnexo): Promise<string> {
  if (formato === 'pdf') return (await converterPdfParaHtml(buffer)).html
  if (formato === 'docx' || formato === 'xlsx' || formato === 'csv') return converterParaHtmlDeterministico(buffer, formato)
  return ''
}
