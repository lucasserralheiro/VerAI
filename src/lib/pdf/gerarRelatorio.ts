import { renderToBuffer } from '@react-pdf/renderer'
import type { Documento, Analise } from '@prisma/client'
import { RelatorioDocument } from './RelatorioDocument'

export async function gerarRelatorioPdf(
  documento: Documento & { uploadedBy: { nome: string } },
  analise: Analise
): Promise<Buffer> {
  return renderToBuffer(RelatorioDocument({ documento, analise }))
}
