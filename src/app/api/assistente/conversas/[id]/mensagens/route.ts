import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { exigirUsuario } from '@/lib/relatorios-clientes/acesso'
import { configuracaoDoAssistente } from '@/lib/assistente/configuracao'
import { executarAgente, MAX_HISTORICO, type MensagemHistorico } from '@/lib/assistente/agente'
import { descreverContexto, interpretarRota } from '@/lib/assistente/contexto-pagina'
import { esquemaPergunta, excedeuLimite, LIMITE_POR_HORA } from '@/lib/assistente/conversas'
import { formatarData } from '@/lib/relatorios-clientes/formatacao'

export const maxDuration = 60
const TIMEOUT_MS = 60_000

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

  if (await excedeuLimite(usuario.id)) {
    return NextResponse.json({ error: `Limite de ${LIMITE_POR_HORA} perguntas por hora atingido. Tente de novo mais tarde.` }, { status: 429 })
  }

  const anteriores = await prisma.mensagemAssistente.findMany({
    where: { conversaId: id },
    orderBy: { createdAt: 'desc' },
    take: MAX_HISTORICO,
    select: { papel: true, conteudo: true },
  })
  const historico = anteriores.reverse() as MensagemHistorico[]
  await prisma.mensagemAssistente.create({ data: { conversaId: id, papel: 'usuario', conteudo: pergunta } })

  const tela = await descreverContexto(interpretarRota(rota ?? ''), usuario)
  const contexto = [`Hoje é ${formatarData(new Date().toISOString())}.`, tela?.texto].filter(Boolean).join(' ')

  const resultado = executarAgente(
    { usuario, historico, pergunta, contexto, abortSignal: AbortSignal.any([request.signal, AbortSignal.timeout(TIMEOUT_MS)]) },
    async (final) => {
      // Sem texto = abortado/falhou: a pergunta fica, a resposta não é gravada como se fosse completa.
      if (!final.texto.trim()) return
      await prisma.mensagemAssistente.create({
        data: {
          conversaId: id,
          papel: 'assistente',
          conteudo: final.texto,
          ferramentas: final.ferramentas as never,
          tokensEntrada: final.tokensEntrada,
          tokensSaida: final.tokensSaida,
          tokensCache: final.tokensCache,
        },
      })
      await prisma.conversaAssistente.update({ where: { id }, data: { atualizadaEm: new Date() } })
    }
  )

  return resultado.toUIMessageStreamResponse({
    onError: (erro) => {
      console.error('[assistente] falha ao responder', erro)
      return 'O assistente não respondeu. Tente de novo.'
    },
  })
}
