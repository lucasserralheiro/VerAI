import type { OrigemTrecho } from '@prisma/client'
import { prisma } from '@/lib/prisma'

/** Um arquivo que o assistente deve conseguir ler, venha de onde vier. Quando o `ArquivoCliente`
 *  (spec do repositório de documentos) existir, ele entra aqui como mais uma origem. */
export interface FonteDocumento {
  origem: OrigemTrecho
  origemId: string
  url: string
  nomeArquivo: string
  tipo: string
  clienteId: string | null
  contratoId: string | null
  /** Texto já extraído por outro fluxo (Proposta Comercial) — não baixa o arquivo de novo. */
  textoPronto: string | null
}

export async function listarFontes(filtro: { clienteId?: string } = {}): Promise<FonteDocumento[]> {
  const { clienteId } = filtro
  const [historicos, faturamentos, documentos, arquivosProposta] = await Promise.all([
    prisma.historicoContrato.findMany({
      where: {
        OR: [{ propostaPdfUrl: { not: null } }, { termoPdfUrl: { not: null } }],
        ...(clienteId ? { contrato: { clienteId } } : {}),
      },
      select: {
        id: true,
        contratoId: true,
        contrato: { select: { clienteId: true } },
        propostaPdfUrl: true,
        propostaPdfNome: true,
        termoPdfUrl: true,
        termoPdfNome: true,
      },
    }),
    prisma.faturamento.findMany({
      where: { pdfUrl: { not: null }, ...(clienteId ? { clienteId } : {}) },
      select: { id: true, pdfUrl: true, pdfNomeArquivo: true, clienteId: true, contratoId: true },
    }),
    prisma.documento.findMany({
      where: clienteId ? { clienteId } : {},
      select: { id: true, caminhoOriginal: true, nomeArquivo: true, tipo: true, clienteId: true },
    }),
    clienteId
      ? Promise.resolve([])
      : prisma.propostaComercialArquivo.findMany({
          where: { conteudoExtraido: { not: null } },
          select: { id: true, caminhoOriginal: true, nomeArquivo: true, tipo: true, conteudoExtraido: true },
        }),
  ])

  const fontes: FonteDocumento[] = []
  for (const h of historicos) {
    const base = { origemId: h.id, tipo: 'pdf', clienteId: h.contrato.clienteId, contratoId: h.contratoId, textoPronto: null }
    if (h.propostaPdfUrl) {
      fontes.push({ ...base, origem: 'HISTORICO_PROPOSTA', url: h.propostaPdfUrl, nomeArquivo: h.propostaPdfNome ?? 'proposta.pdf' })
    }
    if (h.termoPdfUrl) {
      fontes.push({ ...base, origem: 'HISTORICO_TERMO', url: h.termoPdfUrl, nomeArquivo: h.termoPdfNome ?? 'termo.pdf' })
    }
  }
  for (const f of faturamentos) {
    fontes.push({
      origem: 'FATURAMENTO_PDF',
      origemId: f.id,
      url: f.pdfUrl!,
      nomeArquivo: f.pdfNomeArquivo ?? 'faturamento.pdf',
      tipo: 'pdf',
      clienteId: f.clienteId,
      contratoId: f.contratoId,
      textoPronto: null,
    })
  }
  for (const d of documentos) {
    fontes.push({
      origem: 'DOCUMENTO',
      origemId: d.id,
      url: d.caminhoOriginal,
      nomeArquivo: d.nomeArquivo,
      tipo: d.tipo,
      clienteId: d.clienteId,
      contratoId: null,
      textoPronto: null,
    })
  }
  for (const a of arquivosProposta) {
    fontes.push({
      origem: 'PROPOSTA_COMERCIAL_ARQUIVO',
      origemId: a.id,
      url: a.caminhoOriginal,
      nomeArquivo: a.nomeArquivo,
      tipo: a.tipo,
      clienteId: null,
      contratoId: null,
      textoPronto: a.conteudoExtraido,
    })
  }
  return fontes
}
