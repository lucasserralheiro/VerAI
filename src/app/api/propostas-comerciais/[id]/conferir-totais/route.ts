import { createHash } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { getUpload } from '@/lib/storage'
import { converterPdfParaHtml } from '@/lib/extracao/pdfHtml'
import { extrairDocx } from '@/lib/extracao/docx'
import { extrairTotaisDePlanilha } from '@/lib/extracao/excel'
import {
  conferirTotais,
  conferirTotaisPlanilha,
  extrairTabelasConferidas,
  type TabelaConferida,
  type TextoParaConferirTotal,
  type TotalConferido,
} from '@/lib/conferirTotais'

function hashDocumento(texto: string): string {
  return createHash('sha256').update(texto).digest('hex')
}

/**
 * Conferência determinística (sem IA) dos totais do PDF, Word e planilha
 * (.xlsx/.csv) da proposta contra o documento — separada da checagem por IA
 * de propósito: é praticamente grátis (regex + comparação de número), não
 * pode ficar refém da latência da checagem por IA (chamada de modelo por
 * página). Sempre roda contra o Markdown/HTML JÁ SALVO da proposta. Ver
 * docs/superpowers/specs/2026-09-16-conferencia-totais-design.md.
 *
 * Planilha usa extração e comparação PRÓPRIAS (`extrairTotaisDePlanilha` +
 * `conferirTotaisPlanilha`) — número de célula não sai formatado em BR no
 * HTML final, sai como `String()` do JavaScript.
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
  const arquivosDocx = proposta.arquivos.filter((arquivo) => arquivo.tipo === 'docx').sort((a, b) => a.ordem - b.ordem)
  const arquivosPlanilha = proposta.arquivos
    .filter((arquivo) => arquivo.tipo === 'xlsx' || arquivo.tipo === 'csv')
    .sort((a, b) => a.ordem - b.ordem)
  const idsRelevantes = [...arquivosPdf, ...arquivosDocx, ...arquivosPlanilha].map((arquivo) => arquivo.id)
  const documentoAtual = proposta.conteudoMarkdown ?? ''

  const salva = lerConferenciaSalva(proposta.conferenciaTotais)
  if (salva && mesmoDocumento(salva, idsRelevantes, documentoAtual)) {
    return NextResponse.json({
      totais: salva.totais,
      tabelas: salva.tabelas,
      checadoEm: proposta.conferenciaTotaisEm?.toISOString() ?? null,
    })
  }

  const fontes: TextoParaConferirTotal[] = []
  for (const arquivo of arquivosPdf) {
    const buffer = await getUpload(arquivo.caminhoOriginal)
    const resultado = await converterPdfParaHtml(buffer)
    for (const pagina of resultado.paginasConvertidas) {
      fontes.push({
        origem: `Página ${pagina.pagina}`,
        pagina: pagina.pagina,
        textoOriginal: pagina.textoOriginal,
        html: pagina.html,
      })
    }
  }
  for (const arquivo of arquivosDocx) {
    const buffer = await getUpload(arquivo.caminhoOriginal)
    const textoOriginal = await extrairDocx(buffer)
    fontes.push({ origem: arquivo.nomeArquivo, pagina: null, textoOriginal })
  }

  const totais = conferirTotais(fontes, documentoAtual)
  const tabelas = extrairTabelasConferidas(fontes, documentoAtual)
  for (const arquivo of arquivosPlanilha) {
    const buffer = await getUpload(arquivo.caminhoOriginal)
    const candidatos = await extrairTotaisDePlanilha(buffer, arquivo.tipo as 'xlsx' | 'csv')
    totais.push(...conferirTotaisPlanilha(arquivo.nomeArquivo, candidatos, documentoAtual))
  }

  const checadoEm = new Date()
  const paraSalvar: ConferenciaSalva = {
    totais,
    tabelas,
    arquivosRelevantes: idsRelevantes,
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

  return NextResponse.json({ totais, tabelas, checadoEm: checadoEm.toISOString() })
}

interface ConferenciaSalva {
  totais: TotalConferido[]
  /** Tabela reconstruída (célula a célula) de cada fonte que tinha `<table>`
   *  no HTML — ver `extrairTabelasConferidas`. */
  tabelas: TabelaConferida[]
  /** Ids dos arquivos PDF + Word + planilha conferidos — se a proposta ganhar/perder
   *  algum, o cache não vale mais (ver `mesmoDocumento`). */
  arquivosRelevantes: string[]
  documentoHash: string
}

/** Lê o JSON salvo com cuidado — coluna pode estar vazia, ou salva antes do
 *  campo se chamar `arquivosRelevantes` (era `arquivosPdf`) ou antes de
 *  existir `tabelas`; nesses casos trata como "nunca conferido" e conta de
 *  novo. */
function lerConferenciaSalva(valor: unknown): ConferenciaSalva | null {
  if (!valor || typeof valor !== 'object') return null
  const v = valor as Partial<ConferenciaSalva>
  if (
    !Array.isArray(v.totais) ||
    !Array.isArray(v.tabelas) ||
    !Array.isArray(v.arquivosRelevantes) ||
    typeof v.documentoHash !== 'string'
  )
    return null
  return {
    totais: v.totais,
    tabelas: v.tabelas,
    arquivosRelevantes: v.arquivosRelevantes.filter((x): x is string => typeof x === 'string'),
    documentoHash: v.documentoHash,
  }
}

/** O cache só vale quando os arquivos conferidos (PDF + Word + planilha) continuam os
 *  mesmos E o documento contra o qual a última conferência rodou é
 *  EXATAMENTE o que está salvo agora — mesmo critério de
 *  `checagem-ia/route.ts` (`mesmoDocumento`). */
function mesmoDocumento(salva: ConferenciaSalva, idsAtuais: string[], documentoAtual: string): boolean {
  if (salva.arquivosRelevantes.length !== idsAtuais.length) return false
  const atuaisSet = new Set(idsAtuais)
  if (!salva.arquivosRelevantes.every((id) => atuaisSet.has(id))) return false
  return salva.documentoHash === hashDocumento(documentoAtual)
}
