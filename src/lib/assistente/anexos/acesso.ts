import type { AuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import type { FichaAnexo } from './tipos'

/** Anexo só existe para quem é dono da conversa; inexistente e alheio dão o mesmo `null`. */
export async function anexoDoUsuario(anexoId: string, usuario: AuthUser) {
  const anexo = await prisma.anexoAssistente.findFirst({
    where: { id: anexoId, conversa: { usuarioId: usuario.id } },
    select: { id: true, nome: true, formato: true, status: true, ficha: true, conversaId: true, chaveR2: true },
  })
  if (!anexo) return null
  return { ...anexo, ficha: (anexo.ficha as FichaAnexo | null) ?? null }
}

/**
 * Texto do anexo vai à IA sempre entre delimitadores (é citação, nunca instrução). Nome e texto não
 * podem fechar o delimitador por conta própria.
 */
export function delimitar(nome: string, pagina: number | null, texto: string): string {
  const nomeSeguro = nome.replace(/>>>/g, ' ').replace(/\s+/g, ' ').trim()
  const textoSeguro = texto.replace(/<<<FIM>>>/g, '<<FIM>>')
  return `<<<ANEXO ${nomeSeguro}${pagina ? ` p.${pagina}` : ''}>>>\n${textoSeguro}\n<<<FIM>>>`
}
