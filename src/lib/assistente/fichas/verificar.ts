import type { PaginaDeTexto } from '@/lib/assistente/indexacao/trechos'
import type { CampoFicha } from './campos'

const normalizar = (texto: string) => texto.replace(/\s+/g, ' ').trim()
const digitos = (texto: string) => texto.replace(/\D/g, '')

/**
 * Verificação sem exceção (spec fase 2 §5.2): o trecho precisa aparecer literalmente na página citada
 * (espaços normalizados) e todo número do valor precisa estar no trecho. Número nunca vem de outro
 * lugar que não o texto — a mesma regra do reparo de PDF.
 */
export function verificarCampo(campo: CampoFicha, paginas: PaginaDeTexto[]): boolean {
  if (campo.trecho === null) return campo.fonte === 'regra'
  const trecho = normalizar(campo.trecho)
  if (!trecho) return false
  const onde = campo.pagina === null ? paginas : paginas.filter((p) => p.pagina === campo.pagina)
  if (!onde.some((p) => normalizar(p.texto).includes(trecho))) return false
  const noTrecho = digitos(trecho)
  return (campo.valor.match(/\d+/g) ?? []).every((n) => noTrecho.includes(n))
}
