import { NextRequest, NextResponse } from 'next/server'
import { apagarAnexosDaConversa } from '@/lib/assistente/anexos/registrar'
import { prisma } from '@/lib/prisma'
import { exigirUsuario } from '@/lib/relatorios-clientes/acesso'

type Contexto = { params: Promise<{ id: string }> }

type Conversa = {
  id: string
  usuarioId: string
  titulo: string
  mensagens: { id: string; papel: string; conteudo: string; conferencia: unknown }[]
}

// Anotado explicitamente: sem isso, o TS 5.9 infere um tipo com `conversa?: undefined` no ramo
// `{ erro }`, e o `'erro' in r` em GET/DELETE deixa de estreitar `r.erro` (fica `NextResponse |
// undefined`) — falso positivo de tipagem, não um bug de runtime.
type ConversaCarregada = { erro: NextResponse } | { conversa: Conversa }

const naoEncontrada = () => NextResponse.json({ error: 'conversa não encontrada' }, { status: 404 })

async function carregar(request: NextRequest, { params }: Contexto): Promise<ConversaCarregada> {
  const autenticado = await exigirUsuario(request)
  if ('erro' in autenticado) return { erro: autenticado.erro }
  const { id } = await params
  const conversa = await prisma.conversaAssistente.findUnique({
    where: { id },
    select: {
      id: true,
      usuarioId: true,
      titulo: true,
      mensagens: { orderBy: { createdAt: 'asc' }, select: { id: true, papel: true, conteudo: true, conferencia: true } },
    },
  })
  // Conversa é pessoal: nem admin vê a de outro usuário.
  if (!conversa || conversa.usuarioId !== autenticado.usuario.id) return { erro: naoEncontrada() }
  return { conversa }
}

export async function GET(request: NextRequest, contexto: Contexto) {
  const r = await carregar(request, contexto)
  if ('erro' in r) return r.erro
  const { id, titulo, mensagens } = r.conversa
  // Reabrir mostra as mesmas marcas ⚠ da resposta ao vivo.
  const comMarcas = mensagens.map(({ conferencia, ...m }) => ({
    ...m,
    naoConfirmados: (conferencia as { naoConfirmados?: string[] } | null)?.naoConfirmados ?? [],
  }))
  return NextResponse.json({ id, titulo, mensagens: comMarcas })
}

export async function DELETE(request: NextRequest, contexto: Contexto) {
  const r = await carregar(request, contexto)
  if ('erro' in r) return r.erro
  // Arquivos dos anexos saem do R2 (best-effort); as linhas saem pelo Cascade.
  await apagarAnexosDaConversa(r.conversa.id)
  await prisma.conversaAssistente.delete({ where: { id: r.conversa.id } })
  return NextResponse.json({ ok: true })
}
