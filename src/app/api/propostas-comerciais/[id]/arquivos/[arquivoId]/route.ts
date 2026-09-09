import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { getUpload, deleteUpload } from '@/lib/storage'

const CONTENT_TYPE_POR_TIPO: Record<string, string> = {
  pdf: 'application/pdf',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: 'text/csv',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
}

/** Serve o binário original de UM dos arquivos de uma proposta (substitui a
 *  antiga rota `/original`, que só existia porque cada proposta tinha um
 *  único PDF — agora uma proposta pode ter vários arquivos de origem). */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; arquivoId: string }> }
) {
  const usuario = await getAuthUser(request)
  if (!usuario) {
    return NextResponse.json({ error: 'não autenticado' }, { status: 401 })
  }

  const { id, arquivoId } = await params
  const arquivo = await prisma.propostaComercialArquivo.findFirst({
    where: { id: arquivoId, propostaId: id },
  })
  if (!arquivo) {
    return NextResponse.json({ error: 'arquivo não encontrado' }, { status: 404 })
  }

  const modoPreview = request.nextUrl.searchParams.get('modo') === 'preview'
  const buffer = await getUpload(arquivo.caminhoOriginal)
  const contentType = CONTENT_TYPE_POR_TIPO[arquivo.tipo] ?? 'application/octet-stream'

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `${modoPreview ? 'inline' : 'attachment'}; filename="${arquivo.nomeArquivo}"`,
    },
  })
}

/** Remove um arquivo original da proposta — usado quando o usuário enviou
 *  algo por engano ou não quer mais que ele faça parte da consolidação.
 *  Não altera o `conteudoMarkdown` já gerado: só some da lista de originais. */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; arquivoId: string }> }
) {
  const usuario = await getAuthUser(request)
  if (!usuario) {
    return NextResponse.json({ error: 'não autenticado' }, { status: 401 })
  }

  const { id, arquivoId } = await params
  const arquivo = await prisma.propostaComercialArquivo.findFirst({
    where: { id: arquivoId, propostaId: id },
  })
  if (!arquivo) {
    return NextResponse.json({ error: 'arquivo não encontrado' }, { status: 404 })
  }

  const totalArquivos = await prisma.propostaComercialArquivo.count({ where: { propostaId: id } })
  if (totalArquivos <= 1) {
    return NextResponse.json(
      { error: 'não é possível remover o único arquivo da proposta — exclua a proposta inteira em vez disso' },
      { status: 400 }
    )
  }

  await prisma.propostaComercialArquivo.delete({ where: { id: arquivoId } })
  await deleteUpload(arquivo.caminhoOriginal).catch(() => {})

  return NextResponse.json({ ok: true })
}
