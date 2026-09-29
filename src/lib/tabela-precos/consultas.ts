import type { ItemTabelaPrecos, TabelaPrecos } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import type { Conferencia, ItemSerializado, TabelaSerializada, VersaoResumo } from './tipos'

// Consultas da tabela de preços para as rotas e o assistente. A vigente é a de maior `ordem`.

function serializarTabela(t: TabelaPrecos, vigente: boolean): TabelaSerializada {
  return {
    versao: t.versao,
    publicadaEm: t.publicadaEm?.toISOString() ?? null,
    totalItens: t.totalItens,
    divergencias: t.divergencias,
    lidaEm: t.lidaEm.toISOString(),
    vigente,
    arquivos: { planilha: t.arquivoPlanilhaId, pdf: t.arquivoPdfId, publicacao: t.arquivoPublicacaoId, informativo: t.arquivoInformativoId },
  }
}

export function serializarItem(i: ItemTabelaPrecos): ItemSerializado {
  return {
    codigo: i.codigo,
    grupo: i.grupo,
    secoes: i.secoes,
    descricao: i.descricao,
    unidade: i.unidade,
    preco: i.preco?.toString() ?? null,
    sobDemanda: i.sobDemanda,
    precoTexto: i.precoTexto,
    conferencia: i.conferencia as Conferencia,
    precoNoPdf: i.precoNoPdf?.toString() ?? null,
  }
}

export async function carregarTabela(versao?: string): Promise<{ tabela: TabelaSerializada; itens: ItemSerializado[] } | null> {
  const [tabela, vigente] = await Promise.all([
    versao ? prisma.tabelaPrecos.findUnique({ where: { versao } }) : prisma.tabelaPrecos.findFirst({ orderBy: { ordem: 'desc' } }),
    prisma.tabelaPrecos.findFirst({ orderBy: { ordem: 'desc' }, select: { id: true } }),
  ])
  if (!tabela) return null
  const itens = await prisma.itemTabelaPrecos.findMany({ where: { tabelaId: tabela.id }, orderBy: { posicao: 'asc' } })
  return { tabela: serializarTabela(tabela, tabela.id === vigente?.id), itens: itens.map(serializarItem) }
}

export async function listarVersoes(): Promise<VersaoResumo[]> {
  const tabelas = await prisma.tabelaPrecos.findMany({ orderBy: { ordem: 'desc' }, select: { versao: true, publicadaEm: true, totalItens: true } })
  return tabelas.map((t, i) => ({ versao: t.versao, publicadaEm: t.publicadaEm?.toISOString() ?? null, totalItens: t.totalItens, vigente: i === 0 }))
}
