import { extrairExcel, lerPlanilhaPreview, type PreviewPlanilha } from './excel'
import { extrairPdf } from './pdf'
import { extrairDocx, converterDocxParaHtml } from './docx'

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
