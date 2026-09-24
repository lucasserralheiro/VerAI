import type { CategoriaArquivo, Prisma } from '@prisma/client'

// Colunas PC/PA (proposta) e TC/TA (termo) da linha do histórico apontam para o repositório do cliente
// (spec docs/superpowers/specs/2026-09-23-sharepoint-lugar-certo-design.md §3.4). Para a tela e os
// relatórios a forma continua `propostaPdfUrl/Nome` e `termoPdfUrl/Nome` — só que a URL é a rota
// autenticada do repositório (a do Blob nunca vai ao navegador).

export type ColunaAnexo = 'proposta' | 'termo'

export const COLUNAS_ANEXO = {
  proposta: { arquivoId: 'propostaArquivoId', doSharepoint: 'propostaDoSharepoint', rotulo: 'PC/PA' },
  termo: { arquivoId: 'termoArquivoId', doSharepoint: 'termoDoSharepoint', rotulo: 'TC/TA' },
} as const

export const SELECAO_ANEXOS = {
  propostaArquivo: { select: { id: true, nome: true } },
  termoArquivo: { select: { id: true, nome: true } },
  propostaDoSharepoint: true,
  termoDoSharepoint: true,
} satisfies Prisma.HistoricoContratoSelect

export function urlDoArquivo(arquivoId: string): string {
  return `/api/arquivos/${arquivoId}?modo=inline`
}

interface ComAnexos {
  propostaArquivo: { id: string; nome: string } | null
  termoArquivo: { id: string; nome: string } | null
  propostaDoSharepoint: boolean
  termoDoSharepoint: boolean
}

export function anexosDaLinha(linha: ComAnexos) {
  return {
    propostaPdfUrl: linha.propostaArquivo ? urlDoArquivo(linha.propostaArquivo.id) : null,
    propostaPdfNome: linha.propostaArquivo?.nome ?? null,
    propostaArquivoId: linha.propostaArquivo?.id ?? null,
    propostaDoSharepoint: linha.propostaDoSharepoint,
    termoPdfUrl: linha.termoArquivo ? urlDoArquivo(linha.termoArquivo.id) : null,
    termoPdfNome: linha.termoArquivo?.nome ?? null,
    termoArquivoId: linha.termoArquivo?.id ?? null,
    termoDoSharepoint: linha.termoDoSharepoint,
  }
}

/** O que o arquivo É, quando ele entra no repositório pela coluna da linha. */
export function categoriaDaColuna(coluna: ColunaAnexo, tipoLinha: string): CategoriaArquivo {
  const inicial = tipoLinha === 'CONTRATO'
  if (coluna === 'proposta') return inicial ? 'PROPOSTA_COMERCIAL' : 'PROPOSTA_ADITIVO'
  return inicial ? 'TERMO_CONTRATO' : 'TERMO_ADITIVO'
}

/** `data` do Prisma para gravar (ou soltar, com `null`) uma coluna. Objeto explícito por coluna: chave
 *  calculada com valores de tipos diferentes não passa no tipo do Prisma. */
export function dadosDaColuna(coluna: ColunaAnexo, arquivoId: string | null, doSharepoint: boolean) {
  return coluna === 'proposta'
    ? { propostaArquivoId: arquivoId, propostaDoSharepoint: doSharepoint }
    : { termoArquivoId: arquivoId, termoDoSharepoint: doSharepoint }
}
