import { NextRequest, NextResponse } from 'next/server'
import { chaveDoAnexo } from '@/lib/assistente/anexos/registrar'
import { TIPOS_MIME_ANEXO, formatoDoNome } from '@/lib/assistente/anexos/tipos'
import { prisma } from '@/lib/prisma'
import { TAMANHO_MAXIMO_ENVIO, VALIDADE_DO_LINK_S } from '@/lib/propostas/envio'
import { PREFIXO_R2, configR2, urlDeEnvioR2 } from '@/lib/r2'
import { exigirUsuario } from '@/lib/relatorios-clientes/acesso'

type Contexto = { params: Promise<{ id: string }> }

/**
 * Link pro navegador subir um anexo do chat direto ao R2 (PUT pré-assinado, amarra tipo e tamanho,
 * 15 min), sempre em `assistente/<esta conversa>/<uuid>.<ext>`. Quem lê e grava é
 * `POST /api/assistente/conversas/[id]/anexos`, com o `endereco` devolvido aqui.
 */
export async function POST(request: NextRequest, { params }: Contexto) {
  const autenticado = await exigirUsuario(request)
  if ('erro' in autenticado) return autenticado.erro
  const { id } = await params
  const conversa = await prisma.conversaAssistente.findUnique({ where: { id }, select: { usuarioId: true } })
  // Conversa é pessoal: de outro usuário responde igual a inexistente.
  if (!conversa || conversa.usuarioId !== autenticado.usuario.id) {
    return NextResponse.json({ error: 'conversa não encontrada' }, { status: 404 })
  }

  const corpo = (await request.json().catch(() => null)) as { nome?: unknown; tamanhoBytes?: unknown } | null
  const nome = typeof corpo?.nome === 'string' ? corpo.nome : ''
  const formato = formatoDoNome(nome)
  if (!formato) {
    return NextResponse.json({ error: 'formato não aceito — envie PDF, Word (.docx), Excel (.xlsx/.csv) ou texto (.txt)' }, { status: 400 })
  }
  const tamanhoBytes = corpo?.tamanhoBytes
  if (typeof tamanhoBytes !== 'number' || !Number.isInteger(tamanhoBytes) || tamanhoBytes <= 0) {
    return NextResponse.json({ error: 'tamanho do arquivo inválido' }, { status: 400 })
  }
  if (tamanhoBytes > TAMANHO_MAXIMO_ENVIO) {
    return NextResponse.json({ error: 'arquivo acima de 50 MB' }, { status: 400 })
  }

  const cfg = configR2()
  if (!cfg) return NextResponse.json({ error: 'armazenamento (R2) não configurado' }, { status: 503 })

  const chave = chaveDoAnexo(id, formato)
  const contentType = TIPOS_MIME_ANEXO[formato]
  const url = urlDeEnvioR2(chave, { contentType, tamanhoBytes, expiraEmSegundos: VALIDADE_DO_LINK_S }, cfg)
  return NextResponse.json({ url, endereco: `${PREFIXO_R2}${chave}`, contentType })
}
