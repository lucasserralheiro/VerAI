import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { exigirUsuario } from '@/lib/relatorios-clientes/acesso'
import { configuracaoDoAssistente } from '@/lib/assistente/configuracao'
import { executarAgente, MAX_HISTORICO, type MensagemHistorico } from '@/lib/assistente/agente'
import { prepararContexto } from '@/lib/assistente/preparar'
import { respostaDireta } from '@/lib/assistente/resposta-cliente'
import { streamDeTexto } from '@/lib/assistente/stream-texto'
import { esquemaPergunta, excedeuLimite, LIMITE_POR_HORA } from '@/lib/assistente/conversas'

export const maxDuration = 90
const TIMEOUT_MS = 90_000

type Contexto = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: Contexto) {
  const autenticado = await exigirUsuario(request)
  if ('erro' in autenticado) return autenticado.erro
  const { usuario } = autenticado

  if (!configuracaoDoAssistente()) return NextResponse.json({ error: 'Assistente não configurado' }, { status: 503 })

  const corpo = esquemaPergunta.safeParse(await request.json().catch(() => null))
  if (!corpo.success) return NextResponse.json({ error: corpo.error.issues[0]?.message ?? 'pergunta inválida' }, { status: 400 })
  const { pergunta, rota } = corpo.data

  const { id } = await params
  const conversa = await prisma.conversaAssistente.findUnique({ where: { id }, select: { usuarioId: true } })
  if (!conversa || conversa.usuarioId !== usuario.id) return NextResponse.json({ error: 'conversa não encontrada' }, { status: 404 })

  // Mensagem que é só um cliente: texto montado pelo código, sem IA e fora do limite por hora.
  let direta: Awaited<ReturnType<typeof respostaDireta>> = null
  try {
    direta = await respostaDireta(pergunta, usuario, new Date())
  } catch (erro) {
    console.error('[assistente] resposta direta falhou; seguindo para a IA', erro)
  }
  if (direta) {
    await prisma.mensagemAssistente.create({ data: { conversaId: id, papel: 'usuario', conteudo: pergunta, origem: 'direta' } })
    await prisma.mensagemAssistente.create({
      data: {
        conversaId: id, papel: 'assistente', conteudo: direta.texto, origem: 'direta', tipos: ['verai'],
        ...(direta.clienteId ? { ferramentas: [{ nome: 'resumoDoCliente', entrada: { clienteId: direta.clienteId } }] } : {}),
      },
    })
    await prisma.conversaAssistente.update({ where: { id }, data: { atualizadaEm: new Date() } })
    return streamDeTexto(direta.texto)
  }

  if (await excedeuLimite(usuario.id)) {
    return NextResponse.json({ error: `Limite de ${LIMITE_POR_HORA} perguntas por hora atingido. Tente de novo mais tarde.` }, { status: 429 })
  }

  const anteriores = await prisma.mensagemAssistente.findMany({
    where: { conversaId: id },
    orderBy: { createdAt: 'desc' },
    take: MAX_HISTORICO,
    select: { papel: true, conteudo: true, ferramentas: true },
  })
  // Da mais recente para a mais antiga, antes do reverse() (que muda o array no lugar).
  const recentes = anteriores.filter((m) => m.papel === 'assistente').slice(0, 3).map((m) => m.ferramentas)
  const historico = anteriores.reverse().map(({ papel, conteudo }) => ({ papel, conteudo })) as MensagemHistorico[]
  await prisma.mensagemAssistente.create({ data: { conversaId: id, papel: 'usuario', conteudo: pergunta, origem: 'ia' } })

  const contexto = await prepararContexto({ usuario, pergunta, rota: rota ?? null, recentes })

  const { resposta } = executarAgente(
    { usuario, historico, pergunta, contexto, abortSignal: AbortSignal.any([request.signal, AbortSignal.timeout(TIMEOUT_MS)]) },
    async (final) => {
      // Sem texto = abortado/falhou: a pergunta fica, a resposta não é gravada como se fosse completa.
      if (!final.texto.trim()) return
      await prisma.mensagemAssistente.create({
        data: {
          conversaId: id,
          papel: 'assistente',
          conteudo: final.texto,
          origem: 'ia',
          tipos: final.tipos,
          conferencia: final.conferencia as never,
          ferramentas: final.ferramentas as never,
          tokensEntrada: final.tokensEntrada,
          tokensSaida: final.tokensSaida,
          tokensCache: final.tokensCache,
        },
      })
      await prisma.conversaAssistente.update({ where: { id }, data: { atualizadaEm: new Date() } })
    }
  )

  // Stream do modelo + parte data-conferencia no fim; a mensagem de falha fica em executarAgente.
  return resposta
}
