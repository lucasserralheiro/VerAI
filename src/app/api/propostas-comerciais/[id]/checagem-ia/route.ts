import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { getUpload } from '@/lib/storage'
import { converterPdfParaMarkdown, type PaginaConvertida } from '@/lib/extracao/pdfMarkdown'
import { checarConversao } from '@/lib/ia/checarConversao'

/**
 * Checagem por IA sob demanda — recalcula a conversão determinística de cada
 * arquivo PDF da proposta (o mesmo `converterPdfParaMarkdown` do upload) só
 * pra obter texto original x Markdown por página, e manda pro modelo
 * auditar. Não lê o `conteudoMarkdown` salvo nem grava nada — stateless,
 * como a revisão de português.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const usuario = await getAuthUser(request)
  if (!usuario) {
    return NextResponse.json({ error: 'não autenticado' }, { status: 401 })
  }

  const { id } = await params
  const proposta = await prisma.propostaComercial.findUnique({
    where: { id },
    include: { arquivos: true },
  })
  if (!proposta) {
    return NextResponse.json({ error: 'proposta comercial não encontrada' }, { status: 404 })
  }

  const arquivosPdf = proposta.arquivos.filter((arquivo) => arquivo.tipo === 'pdf')

  const paginasConvertidas: PaginaConvertida[] = []
  for (const arquivo of arquivosPdf) {
    const buffer = await getUpload(arquivo.caminhoOriginal)
    const resultado = await converterPdfParaMarkdown(buffer)
    paginasConvertidas.push(...resultado.paginasConvertidas)
  }

  if (paginasConvertidas.length === 0) {
    return NextResponse.json({ scoreExibido: null, trechosSuspeitos: [] })
  }

  try {
    const resultado = await checarConversao(paginasConvertidas)
    return NextResponse.json(resultado)
  } catch (erro) {
    console.error('checagem por IA falhou:', erro)
    const detalhe = erro instanceof Error ? erro.message : String(erro)
    return NextResponse.json({ error: `não foi possível checar a conversão agora (${detalhe})` }, { status: 502 })
  }
}
