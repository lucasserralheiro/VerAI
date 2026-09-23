import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { buildHistoricoContratoPdfPath, deleteUpload, putUpload } from '@/lib/storage'
import { COLUNAS_PDF as COLUNAS, SELECAO_PDFS, TAMANHO_MAXIMO_PDF_BYTES, tipoPdfValido as tipoValido } from '@/lib/relatorios-clientes/pdfs-existentes'
import { carregarHistoricoComAcesso } from '../../../carregar'

type Contexto = { params: Promise<{ id: string; tipo: string }> }

/** Sobe (ou substitui) o PDF de proposta/termo de uma linha do histórico do contrato. */
export async function POST(request: NextRequest, { params }: Contexto) {
  const { id, tipo } = await params
  if (!tipoValido(tipo)) return NextResponse.json({ error: 'tipo de anexo inválido' }, { status: 404 })

  const carregado = await carregarHistoricoComAcesso(request, id)
  if ('erro' in carregado) return carregado.erro

  const formData = await request.formData().catch(() => null)
  const arquivo = formData?.get('arquivo')
  if (!(arquivo instanceof File)) {
    return NextResponse.json({ error: 'campo "arquivo" é obrigatório' }, { status: 400 })
  }
  if (!arquivo.name.toLowerCase().endsWith('.pdf') && arquivo.type !== 'application/pdf') {
    return NextResponse.json({ error: 'o arquivo precisa ser um PDF' }, { status: 400 })
  }
  if (arquivo.size > TAMANHO_MAXIMO_PDF_BYTES) {
    return NextResponse.json({ error: 'o PDF não pode passar de 15 MB' }, { status: 400 })
  }

  const buffer = Buffer.from(await arquivo.arrayBuffer())
  const url = await putUpload(buildHistoricoContratoPdfPath(id, tipo), buffer, 'application/pdf')

  const colunas = COLUNAS[tipo]
  const linha = await prisma.historicoContrato.update({
    where: { id },
    data: { [colunas.url]: url, [colunas.nome]: arquivo.name },
    select: SELECAO_PDFS,
  })
  return NextResponse.json(linha)
}

/** Remove o PDF anexado (storage + banco). */
export async function DELETE(request: NextRequest, { params }: Contexto) {
  const { id, tipo } = await params
  if (!tipoValido(tipo)) return NextResponse.json({ error: 'tipo de anexo inválido' }, { status: 404 })

  const carregado = await carregarHistoricoComAcesso(request, id)
  if ('erro' in carregado) return carregado.erro

  const colunas = COLUNAS[tipo]
  const atual = await prisma.historicoContrato.findUnique({ where: { id }, select: SELECAO_PDFS })
  const urlAtual = atual?.[colunas.url]
  if (!urlAtual) {
    return NextResponse.json({ error: 'esta linha não tem PDF anexado' }, { status: 404 })
  }

  await deleteUpload(urlAtual).catch(() => {})

  const linha = await prisma.historicoContrato.update({
    where: { id },
    data: { [colunas.url]: null, [colunas.nome]: null },
    select: SELECAO_PDFS,
  })
  return NextResponse.json(linha)
}
