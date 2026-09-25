import type { AuthUser } from '@/lib/auth'
import { formatarData } from '@/lib/relatorios-clientes/formatacao'
import { descreverContexto, interpretarRota } from './contexto-pagina'

/** Linha de contexto que vai junto da pergunta (nunca no `system`, que é fixo para o cache). */
export async function prepararContexto(entrada: {
  usuario: AuthUser
  pergunta: string
  rota: string | null
  /** `ferramentas` gravadas nas últimas respostas do assistente, da mais recente para a mais antiga. */
  recentes: unknown[]
  hoje?: Date
}): Promise<string> {
  const hoje = entrada.hoje ?? new Date()
  const tela = await descreverContexto(interpretarRota(entrada.rota ?? ''), entrada.usuario)
  return [`Hoje é ${formatarData(hoje.toISOString())}.`, tela?.texto].filter(Boolean).join(' ')
}
