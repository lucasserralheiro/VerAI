import type { AuthUser } from '@/lib/auth'
import { hojeEmBrasilia } from '@/lib/calendario/tipos'
import { formatarData } from '@/lib/relatorios-clientes/formatacao'
import { descreverContexto, interpretarRota } from './contexto-pagina'
import { identificarEntidades } from './entidades'
import { periodoDaPergunta } from './periodos'

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
  const hojeEmBrasil = hojeEmBrasilia(hoje)
  const [tela, entidades] = await Promise.all([
    descreverContexto(interpretarRota(entrada.rota ?? ''), entrada.usuario),
    identificarEntidades({ pergunta: entrada.pergunta, usuario: entrada.usuario, recentes: entrada.recentes }),
  ])
  return [`Hoje é ${formatarData(hojeEmBrasil.toISOString())}.`, tela?.texto, periodoDaPergunta(entrada.pergunta, hojeEmBrasil)?.texto, entidades.texto].filter(Boolean).join(' ')
}
