import { renderToBuffer } from '@react-pdf/renderer'
import type { AnaliseConsolidada, Cliente, Documento } from '@prisma/client'
import { ConsolidadoDocument } from './ConsolidadoDocument'

export async function gerarRelatorioConsolidadoPdf(
  cliente: Pick<Cliente, 'nome'>,
  documentos: Array<Pick<Documento, 'nomeArquivo'>>,
  analise: AnaliseConsolidada
): Promise<Buffer> {
  return renderToBuffer(ConsolidadoDocument({ cliente, documentos, analise }))
}
