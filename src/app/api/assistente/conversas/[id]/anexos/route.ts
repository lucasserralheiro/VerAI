import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { AnexoForaDoR2, enderecoValido, nomeDoArquivo, registrarAnexo } from '@/lib/assistente/anexos/registrar'
import type { AuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { exigirUsuario } from '@/lib/relatorios-clientes/acesso'

// PDF grande: extração + HTML das tabelas cabem no teto do Hobby com Fluid.
export const maxDuration = 300

type Contexto = { params: Promise<{ id: string }> }

const Corpo = z.object({
  endereco: z.string().max(200),
  nome: z
    .string()
    .min(1)
    .max(200)
    .refine((n) => nomeDoArquivo(n).length > 0),
  paginasOcr: z
    .array(z.object({ pagina: z.number().int().min(1), texto: z.string().max(200_000) }))
    .max(2_000)
    .optional(),
})

/** Usuário logado e dono da conversa; de outro usuário responde igual a inexistente. */
async function donoDaConversa(request: NextRequest, { params }: Contexto): Promise<{ erro: NextResponse } | { usuario: AuthUser; id: string }> {
  const autenticado = await exigirUsuario(request)
  if ('erro' in autenticado) return { erro: autenticado.erro }
  const { id } = await params
  const conversa = await prisma.conversaAssistente.findUnique({ where: { id }, select: { usuarioId: true } })
  if (!conversa || conversa.usuarioId !== autenticado.usuario.id) {
    return { erro: NextResponse.json({ error: 'conversa não encontrada' }, { status: 404 }) }
  }
  return { usuario: autenticado.usuario, id }
}

/**
 * Registra o anexo que o navegador já subiu ao R2: lê, grava o texto por página e a ficha (sem IA), e
 * grava a ficha como resposta direta do assistente (não conta no limite por hora).
 */
export async function POST(request: NextRequest, contexto: Contexto) {
  const r = await donoDaConversa(request, contexto)
  if ('erro' in r) return r.erro

  const lido = Corpo.safeParse(await request.json().catch(() => null))
  if (!lido.success) return NextResponse.json({ error: 'dados do anexo inválidos' }, { status: 400 })
  const { endereco, paginasOcr } = lido.data
  if (!enderecoValido(endereco, r.id)) return NextResponse.json({ error: 'endereço do anexo inválido' }, { status: 400 })

  let resultado: Awaited<ReturnType<typeof registrarAnexo>>
  try {
    resultado = await registrarAnexo({ conversaId: r.id, usuario: r.usuario, endereco, nome: nomeDoArquivo(lido.data.nome), paginasOcr })
  } catch (erro) {
    if (erro instanceof AnexoForaDoR2) return NextResponse.json({ error: 'arquivo não encontrado; envie de novo' }, { status: 400 })
    throw erro
  }

  await prisma.mensagemAssistente.create({
    data: { conversaId: r.id, papel: 'assistente', conteudo: resultado.texto, origem: 'direta', tipos: ['verai'] },
  })
  await prisma.conversaAssistente.update({ where: { id: r.id }, data: { atualizadaEm: new Date() } })
  return NextResponse.json(resultado)
}

export async function GET(request: NextRequest, contexto: Contexto) {
  const r = await donoDaConversa(request, contexto)
  if ('erro' in r) return r.erro
  const anexos = await prisma.anexoAssistente.findMany({
    where: { conversaId: r.id },
    orderBy: { createdAt: 'asc' },
    select: { id: true, nome: true, formato: true, status: true, paginas: true, ocr: true, ficha: true },
  })
  return NextResponse.json({ anexos })
}
