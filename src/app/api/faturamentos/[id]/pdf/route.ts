import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { buildFaturamentoPdfPath, deleteUpload, putUpload } from '@/lib/storage'
import { carregarFaturamentoComAcesso } from '../../carregar'

type Contexto = { params: Promise<{ id: string }> }

const TAMANHO_MAXIMO_BYTES = 15 * 1024 * 1024 // 15 MB

/** Sobe (ou substitui) o PDF anexado manualmente a um faturamento — o ícone "ver PDF" da
 *  tabela da aba Faturamento. Caminho fixo por faturamento (buildFaturamentoPdfPath), então
 *  reanexar sobrescreve o mesmo blob sem deixar lixo no storage. */
export async function POST(request: NextRequest, { params }: Contexto) {
  const { id } = await params
  const carregado = await carregarFaturamentoComAcesso(request, id, 'editar')
  if ('erro' in carregado) return carregado.erro

  const formData = await request.formData().catch(() => null)
  const arquivo = formData?.get('arquivo')
  if (!(arquivo instanceof File)) {
    return NextResponse.json({ error: 'campo "arquivo" é obrigatório' }, { status: 400 })
  }

  const nomeMinusculo = arquivo.name.toLowerCase()
  if (!nomeMinusculo.endsWith('.pdf') && arquivo.type !== 'application/pdf') {
    return NextResponse.json({ error: 'o arquivo precisa ser um PDF' }, { status: 400 })
  }
  if (arquivo.size > TAMANHO_MAXIMO_BYTES) {
    return NextResponse.json({ error: 'o PDF não pode passar de 15 MB' }, { status: 400 })
  }

  const buffer = Buffer.from(await arquivo.arrayBuffer())
  const url = await putUpload(buildFaturamentoPdfPath(id), buffer, 'application/pdf')

  const faturamento = await prisma.faturamento.update({
    where: { id },
    data: { pdfUrl: url, pdfNomeArquivo: arquivo.name },
    select: { pdfUrl: true, pdfNomeArquivo: true },
  })

  return NextResponse.json(faturamento)
}

/** Remove o PDF anexado (storage + banco). */
export async function DELETE(request: NextRequest, { params }: Contexto) {
  const { id } = await params
  const carregado = await carregarFaturamentoComAcesso(request, id, 'editar')
  if ('erro' in carregado) return carregado.erro

  const atual = await prisma.faturamento.findUnique({ where: { id }, select: { pdfUrl: true } })
  if (!atual?.pdfUrl) {
    return NextResponse.json({ error: 'este faturamento não tem PDF anexado' }, { status: 404 })
  }

  await deleteUpload(atual.pdfUrl).catch(() => {})

  const faturamento = await prisma.faturamento.update({
    where: { id },
    data: { pdfUrl: null, pdfNomeArquivo: null },
    select: { pdfUrl: true, pdfNomeArquivo: true },
  })

  return NextResponse.json(faturamento)
}
