import { z } from 'zod'
import { prisma } from '@/lib/prisma'

export const LIMITE_POR_HORA = 30
export const MAX_PERGUNTA = 2000

export const esquemaPergunta = z.object({
  pergunta: z.string().trim().min(1, 'escreva a pergunta').max(MAX_PERGUNTA, `pergunta com mais de ${MAX_PERGUNTA} caracteres`),
  rota: z.string().max(300).optional(),
})

/** Título sem IA (não gasta token): começo da primeira pergunta, cortado em palavra. */
export function tituloDaPergunta(pergunta: string): string {
  const texto = pergunta.trim().replace(/\s+/g, ' ')
  if (texto.length <= 60) return texto
  const corte = texto.slice(0, 60)
  const espaco = corte.lastIndexOf(' ')
  return `${(espaco > 30 ? corte.slice(0, espaco) : corte).trimEnd()}…`
}

export async function excedeuLimite(usuarioId: string, agora: Date = new Date()): Promise<boolean> {
  const desde = new Date(agora.getTime() - 60 * 60 * 1000)
  const total = await prisma.mensagemAssistente.count({
    where: { papel: 'usuario', createdAt: { gte: desde }, conversa: { usuarioId } },
  })
  return total >= LIMITE_POR_HORA
}
