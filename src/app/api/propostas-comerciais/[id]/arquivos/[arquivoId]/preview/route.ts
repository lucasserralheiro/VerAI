import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { getUpload } from '@/lib/storage'
import { lerPlanilhaPreview, converterDocxParaHtml } from '@/lib/extracao'

/** Preview estruturado de um arquivo de origem que não é PDF — mesmo padrão
 *  usado em "Relatórios dos clientes" (`/api/documentos/[id]/preview`):
 *  Word vira HTML pra abrir num iframe, planilha vira JSON de linhas/colunas
 *  pro cliente montar a tabela. PDF não passa por aqui — usa `/arquivos/[arquivoId]?modo=preview`. */
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

  if (arquivo.tipo === 'docx') {
    const buffer = await getUpload(arquivo.caminhoOriginal)
    const html = await converterDocxParaHtml(buffer)
    return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
  }

  if (arquivo.tipo !== 'xlsx' && arquivo.tipo !== 'csv') {
    return NextResponse.json({ error: 'preview estruturado só existe para xlsx/csv/docx' }, { status: 400 })
  }

  const buffer = await getUpload(arquivo.caminhoOriginal)
  const preview = await lerPlanilhaPreview(buffer, arquivo.tipo)

  return NextResponse.json(preview)
}
