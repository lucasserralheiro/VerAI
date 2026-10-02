import { converterPdfParaHtml } from '@/lib/extracao/pdfHtml'
import { converterParaHtmlDeterministico } from '@/lib/extracao'
import { extrairPaginas } from '../indexacao/extrair'
import type { PaginaDeTexto } from '../indexacao/trechos'
import { lerEml } from './eml'
import type { FormatoAnexo } from './tipos'

/** Texto do anexo página a página. E-mail vira uma página só (cabeçalho + corpo); os anexos do e-mail
 *  não são lidos, só listados pelo nome. */
export async function paginasDoAnexo(buffer: Buffer, formato: FormatoAnexo): Promise<{ paginas: PaginaDeTexto[]; anexosDoEmail: string[] }> {
  if (formato === 'eml') {
    const e = lerEml(buffer)
    const cab = [e.de && `De: ${e.de}`, e.para && `Para: ${e.para}`, e.data && `Data: ${e.data}`, e.assunto && `Assunto: ${e.assunto}`].filter(Boolean).join('\n')
    return { paginas: [{ pagina: null, texto: `${cab}\n\n${e.corpo}`.trim() }], anexosDoEmail: e.anexos }
  }
  return { paginas: await extrairPaginas(buffer, formato), anexosDoEmail: [] }
}

/** HTML com tabelas (de onde saem os itens com código de serviço). `''` para txt/eml. */
export async function htmlDoAnexo(buffer: Buffer, formato: FormatoAnexo): Promise<string> {
  if (formato === 'pdf') return (await converterPdfParaHtml(buffer)).html
  if (formato === 'docx' || formato === 'xlsx' || formato === 'csv') return converterParaHtmlDeterministico(buffer, formato)
  return ''
}
