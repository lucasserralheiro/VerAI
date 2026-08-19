import { renderToBuffer } from '@react-pdf/renderer'
import type { AnaliseEvolucao, Cliente } from '@prisma/client'
import { EvolucaoDocument } from './EvolucaoDocument'

export async function gerarRelatorioEvolucaoPdf(
  cliente: Pick<Cliente, 'nome'>,
  analise: AnaliseEvolucao
): Promise<Buffer> {
  return renderToBuffer(EvolucaoDocument({ cliente, analise }))
}
