import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { exigirUsuario, verificarAcessoCliente, type ModoAcesso } from '@/lib/relatorios-clientes/acesso'

export const ARQUIVO_NAO_ENCONTRADO = 'arquivo não encontrado'

/** Autentica, acha o arquivo (não removido) e checa acesso pelo cliente dele (401 → 404 → 403). */
export async function carregarArquivoComAcesso(request: NextRequest, id: string, modo: ModoAcesso = 'ver') {
  const autenticado = await exigirUsuario(request)
  if ('erro' in autenticado) return autenticado

  const arquivo = await prisma.arquivoCliente.findFirst({
    where: { id, removidoEm: null },
    select: { id: true, clienteId: true, nome: true, contentType: true, urlBlob: true },
  })
  if (!arquivo) return { erro: NextResponse.json({ error: ARQUIVO_NAO_ENCONTRADO }, { status: 404 }) }

  const negado = await verificarAcessoCliente(autenticado.usuario, arquivo.clienteId, modo)
  return negado ? { erro: negado } : { usuario: autenticado.usuario, arquivo }
}
