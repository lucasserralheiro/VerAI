import type { OrigemTrecho } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { extensaoDe } from '@/lib/arquivos/tipos'

/** Extensões que `extrairPaginas` lê. */
export const EXTENSOES_INDEXAVEIS = ['pdf', 'docx', 'xlsx', 'csv']
/** Textos oficiais também podem vir do site da lei (txt, html). */
export const EXTENSOES_REFERENCIA = ['pdf', 'docx', 'html', 'htm', 'txt']

/** Um arquivo que o assistente deve conseguir ler, venha de onde vier. */
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
  const [historicos, faturamentos, documentos, arquivosProposta, arquivosCliente, referencias] = await Promise.all([
    prisma.historicoContrato.findMany({
      where: {
        OR: [{ propostaArquivoId: { not: null } }, { termoArquivoId: { not: null } }],
        ...(clienteId ? { contrato: { clienteId } } : {}),
      },
      select: {
        id: true,
        contratoId: true,
        contrato: { select: { clienteId: true } },
        // Servidor lendo o blob pra indexar — `urlBlob` não sai daqui.
        propostaArquivo: { select: { urlBlob: true, nome: true } },
        termoArquivo: { select: { urlBlob: true, nome: true } },
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
    // Arquivo do repositório que não é PC/PA/TC/TA do histórico nem Documento (esses têm origem própria).
    // Arquivo não tem contrato (CLAUDE.md, §7 da spec do repositório): contratoId fica null.
    prisma.arquivoCliente.findMany({
      where: {
        removidoEm: null,
        extensao: { in: EXTENSOES_INDEXAVEIS },
        linhasComoProposta: { none: {} },
        linhasComoTermo: { none: {} },
        documentos: { none: {} },
        ...(clienteId ? { clienteId } : {}),
      },
      select: { id: true, clienteId: true, nome: true, extensao: true, urlBlob: true },
    }),
    // Texto oficial (lei, decreto, regulamento): sem cliente, como as propostas comerciais.
    clienteId
      ? Promise.resolve([])
      : prisma.documentoReferencia.findMany({ where: { removidoEm: null }, select: { id: true, titulo: true, nomeArquivo: true, urlBlob: true } }),
  ])

  const fontes: FonteDocumento[] = []
  for (const h of historicos) {
    const base = { origemId: h.id, tipo: 'pdf', clienteId: h.contrato.clienteId, contratoId: h.contratoId, textoPronto: null }
    if (h.propostaArquivo) {
      fontes.push({ ...base, origem: 'HISTORICO_PROPOSTA', url: h.propostaArquivo.urlBlob, nomeArquivo: h.propostaArquivo.nome })
    }
    if (h.termoArquivo) {
      fontes.push({ ...base, origem: 'HISTORICO_TERMO', url: h.termoArquivo.urlBlob, nomeArquivo: h.termoArquivo.nome })
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
  for (const a of arquivosCliente) {
    fontes.push({
      origem: 'ARQUIVO_CLIENTE',
      origemId: a.id,
      url: a.urlBlob,
      nomeArquivo: a.nome,
      tipo: a.extensao,
      clienteId: a.clienteId,
      contratoId: null,
      textoPronto: null,
    })
  }
  for (const r of referencias) {
    fontes.push({
      origem: 'REFERENCIA',
      origemId: r.id,
      url: r.urlBlob,
      // O título vira o prefixo dos trechos ("[Lei 14.133/2021 — Art. 3º]") e o nome citado.
      nomeArquivo: r.titulo,
      tipo: extensaoDe(r.nomeArquivo),
      clienteId: null,
      contratoId: null,
      textoPronto: null,
    })
  }
  return fontes
}
