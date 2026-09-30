// Onde o reajuste guarda arquivos no R2 (spec §3) e como lê o temporário da "Nova conversão".
import { getR2 } from '@/lib/r2'

export const CONTENT_TYPE_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
export const chaveDoTemporario = (endereco: string) => endereco.slice('r2:'.length)
export const chaveDoOriginal = (id: string, ext: string) => `reajustes/${id}/original.${ext}`
export const chaveDoResultado = (id: string) => `reajustes/${id}/resultado.xlsx`

export async function lerDoR2(chave: string): Promise<Buffer> {
  const resposta = await getR2(chave)
  if (!resposta.ok) throw new Error(`R2 respondeu ${resposta.status} para ${chave}`)
  return Buffer.from(await resposta.arrayBuffer())
}
