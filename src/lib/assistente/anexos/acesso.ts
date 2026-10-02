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
  const nomeSeguro = nome.replace(/[<>]{3,}/g, ' ').replace(/\s+/g, ' ').trim()
  // Neutraliza por classe (não por palavra): nenhuma sequência de 3+ `<` ou `>` sobra no conteúdo.
  const textoSeguro = texto.replace(/<{3,}/g, (m) => '‹'.repeat(m.length)).replace(/>{3,}/g, (m) => '›'.repeat(m.length))
  return `<<<ANEXO ${nomeSeguro}${pagina ? ` p.${pagina}` : ''}>>>\n${textoSeguro}\n<<<FIM>>>`
}
