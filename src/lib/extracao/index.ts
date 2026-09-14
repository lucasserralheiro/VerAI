import { extrairExcel, lerPlanilhaPreview, converterPlanilhaParaHtml, type PreviewPlanilha } from './excel'
import { extrairPdf } from './pdf'
import { extrairDocx, converterDocxParaHtml } from './docx'
import { sanitizarHtmlMammoth } from './sanitizarHtmlMammoth'

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

/** Converte um arquivo original em HTML de forma 100% determinística — sem
 *  IA, sem interpretar nem resumir nada, só reformata o conteúdo tal como
 *  está no arquivo original. Usado na Proposta Comercial, onde a fidelidade
 *  ao original é obrigatória. */
export async function converterParaHtmlDeterministico(buffer: Buffer, tipo: string): Promise<string> {
  switch (tipo) {
    case 'xlsx':
    case 'csv':
      return converterPlanilhaParaHtml(buffer, tipo)
    case 'docx':
      return sanitizarHtmlMammoth(await converterDocxParaHtml(buffer))
    default:
      throw new Error(`Tipo de arquivo "${tipo}" não suportado para conversão determinística`)
  }
}
