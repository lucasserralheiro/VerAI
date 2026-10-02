import { prisma } from '@/lib/prisma'
import { buildDocumentoPrefix, deleteUploadPrefix } from '@/lib/storage'

/**
 * UMA regra de exclusão de cliente, usada pela ficha (`DELETE /api/clientes/[clienteId]`) e por
 * "Gerenciar clientes" (`DELETE /api/admin/clientes/[id]`). Antes eram duas: a da ficha apagava tudo
 * e bastava ter acesso ao cliente; a do admin só tratava documentos e estourava com contrato.
 *
 * Só admin chama (as rotas checam). Nenhuma relação do Cliente tem `onDelete: Cascade`, então apaga a
 * árvore de baixo pra cima numa transação só — ou some tudo, ou nada. Itens do legado que esperam o
 * cliente pela sigla (`clienteSiglaLegado`, sem contrato) ficam: são do legado, não do cliente.
 */
export function operacoesExcluirCliente(clienteId: string) {
  const doCliente = { clienteId }
  return [
    prisma.notaFiscal.deleteMany({ where: { faturamento: doCliente } }),
    prisma.faturamento.deleteMany({ where: doCliente }),
    prisma.historicoContrato.deleteMany({ where: { contrato: doCliente } }),
    prisma.itemContrato.deleteMany({ where: { contrato: doCliente } }),
    prisma.termoConfirmacao.deleteMany({ where: doCliente }),
    prisma.tramiteDemanda.deleteMany({ where: { demanda: doCliente } }),
    prisma.demanda.deleteMany({ where: doCliente }),
    prisma.solicitacao.deleteMany({ where: doCliente }),
    prisma.notificacao.deleteMany({ where: { documento: doCliente } }),
    prisma.acessoDocumento.deleteMany({ where: { documento: doCliente } }),
    prisma.analise.deleteMany({ where: { documento: doCliente } }),
    prisma.analiseConsolidada.deleteMany({ where: doCliente }),
    prisma.documento.deleteMany({ where: doCliente }),
    prisma.analiseEvolucao.deleteMany({ where: doCliente }),
    // Repositório de documentos (depois de `documento`, que aponta pra `ArquivoCliente`).
    prisma.acessoArquivo.deleteMany({ where: { arquivo: doCliente } }),
    prisma.arquivoCliente.deleteMany({ where: doCliente }),
    prisma.contrato.deleteMany({ where: doCliente }),
    // Índice do assistente (sem FK — ficaria órfão e ainda apareceria na busca por permissão).
    prisma.indiceDocumento.deleteMany({ where: doCliente }),
    prisma.responsavelCliente.deleteMany({ where: doCliente }),
    // Gerência e carteira (spec 2026-10-02-gerencias): a FK já é Cascade; explícito para a regra ficar à vista.
    prisma.movimentoCarteira.deleteMany({ where: doCliente }),
    prisma.carteiraCliente.deleteMany({ where: doCliente }),
    prisma.cliente.delete({ where: { id: clienteId } }),
  ]
}

/** Transação + limpeza best-effort dos blobs dos `Documento` (IO externo, fora da transação). */
export async function excluirCliente(clienteId: string): Promise<void> {
  const documentos = await prisma.documento.findMany({ where: { clienteId }, select: { id: true, createdAt: true } })
  await prisma.$transaction(operacoesExcluirCliente(clienteId))
  for (const documento of documentos) {
    await deleteUploadPrefix(buildDocumentoPrefix(documento.id, documento.createdAt)).catch(() => {})
  }
}
