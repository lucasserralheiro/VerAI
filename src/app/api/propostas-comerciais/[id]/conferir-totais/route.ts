import { createHash } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { getUpload } from '@/lib/storage'
import { converterPdfParaHtml, type PaginaConvertida } from '@/lib/extracao/pdfHtml'
import { conferirTotais, type TotalConferido } from '@/lib/conferirTotais'

function hashDocumento(texto: string): string {
  return createHash('sha256').update(texto).digest('hex')
}

/**
 * Conferência determinística (sem IA) dos totais do PDF contra o
 * documento — separada da checagem por IA de propósito: é praticamente
 * grátis (regex + comparação de número), não pode ficar refém da latência
 * da checagem por IA (chamada de modelo por página). Sempre roda contra o
 * Markdown/HTML JÁ SALVO da proposta. Ver
 * docs/superpowers/specs/2026-09-16-conferencia-totais-design.md.
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

  const arquivosPdf = proposta.arquivos.filter((arquivo) => arquivo.tipo === 'pdf').sort((a, b) => a.ordem - b.ordem)
  const idsPdf = arquivosPdf.map((arquivo) => arquivo.id)
  const documentoAtual = proposta.conteudoMarkdown ?? ''

  const salva = lerConferenciaSalva(proposta.conferenciaTotais)
  if (salva && mesmoDocumento(salva, idsPdf, documentoAtual)) {
    return NextResponse.json({ totais: salva.totais, checadoEm: proposta.conferenciaTotaisEm?.toISOString() ?? null })
  }

  const paginasConvertidas: PaginaConvertida[] = []
  for (const arquivo of arquivosPdf) {
    const buffer = await getUpload(arquivo.caminhoOriginal)
    const resultado = await converterPdfParaHtml(buffer)
    paginasConvertidas.push(...resultado.paginasConvertidas)
  }

  const totais = conferirTotais(paginasConvertidas, documentoAtual)
  const checadoEm = new Date()
  const paraSalvar: ConferenciaSalva = {
    totais,
    arquivosPdf: idsPdf,
    documentoHash: hashDocumento(documentoAtual),
  }

  // Falhar ao gravar não pode esconder um resultado que já está pronto —
  // no pior caso, a próxima chamada confere de novo.
  await prisma.propostaComercial
    .update({
      where: { id },
      data: { conferenciaTotais: paraSalvar as unknown as Prisma.InputJsonValue, conferenciaTotaisEm: checadoEm },
    })
    .catch((erro) => console.error('conferência de totais: não foi possível salvar o resultado —', erro))

  return NextResponse.json({ totais, checadoEm: checadoEm.toISOString() })
}

interface ConferenciaSalva {
  totais: TotalConferido[]
  arquivosPdf: string[]
  documentoHash: string
}

/** Lê o JSON salvo com cuidado — coluna pode estar vazia; nesse caso trata
 *  como "nunca conferido" e conta de novo. */
function lerConferenciaSalva(valor: unknown): ConferenciaSalva | null {
  if (!valor || typeof valor !== 'object') return null
  const v = valor as Partial<ConferenciaSalva>
  if (!Array.isArray(v.totais) || !Array.isArray(v.arquivosPdf) || typeof v.documentoHash !== 'string') return null
  return {
    totais: v.totais,
    arquivosPdf: v.arquivosPdf.filter((x): x is string => typeof x === 'string'),
    documentoHash: v.documentoHash,
  }
}

/** O cache só vale quando os PDFs continuam os mesmos E o documento contra
 *  o qual a última conferência rodou é EXATAMENTE o que está salvo agora —
 *  mesmo critério de `checagem-ia/route.ts` (`mesmoDocumento`). */
function mesmoDocumento(salva: ConferenciaSalva, idsPdfAtuais: string[], documentoAtual: string): boolean {
  if (salva.arquivosPdf.length !== idsPdfAtuais.length) return false
  const atuaisSet = new Set(idsPdfAtuais)
  if (!salva.arquivosPdf.every((id) => atuaisSet.has(id))) return false
  return salva.documentoHash === hashDocumento(documentoAtual)
}
