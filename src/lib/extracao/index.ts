import { extrairExcel, lerPlanilhaPreview, converterPlanilhaParaMarkdown, type PreviewPlanilha } from './excel'
import { extrairPdf } from './pdf'
import { extrairDocx, converterDocxParaHtml } from './docx'
import { converterHtmlParaMarkdown } from './htmlMarkdown'

export { lerPlanilhaPreview, type PreviewPlanilha, converterDocxParaHtml }

export async function extrairConteudo(buffer: Buffer, tipo: string): Promise<string> {
  switch (tipo) {
    case 'xlsx':
    case 'csv':
      return extrairExcel(buffer, tipo)
    case 'pdf':
      return extrairPdf(buffer)
    case 'docx':
      return extrairDocx(buffer)
    default:
      throw new Error(`Tipo de arquivo "${tipo}" não suportado para extração`)
  }
}

/** Converte um arquivo original em Markdown de forma 100% determinística —
 *  sem IA, sem interpretar nem resumir nada, só reformata o conteúdo tal
 *  como está no arquivo original. Usado na Proposta Comercial, onde a
 *  fidelidade ao original é obrigatória. */
export async function converterParaMarkdownDeterministico(buffer: Buffer, tipo: string): Promise<string> {
  switch (tipo) {
    case 'xlsx':
    case 'csv':
      return converterPlanilhaParaMarkdown(buffer, tipo)
    case 'docx':
      return converterHtmlParaMarkdown(await converterDocxParaHtml(buffer))
    default:
      throw new Error(`Tipo de arquivo "${tipo}" não suportado para conversão determinística`)
  }
}
