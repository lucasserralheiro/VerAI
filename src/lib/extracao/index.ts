import { extrairExcel, lerPlanilhaPreview, type PreviewPlanilha } from './excel'
import { extrairPdf } from './pdf'

export { lerPlanilhaPreview, type PreviewPlanilha }

export async function extrairConteudo(buffer: Buffer, tipo: string): Promise<string> {
  switch (tipo) {
    case 'xlsx':
    case 'csv':
      return extrairExcel(buffer, tipo)
    case 'pdf':
      return extrairPdf(buffer)
    default:
      throw new Error(`Tipo de arquivo "${tipo}" não suportado para extração`)
  }
}
