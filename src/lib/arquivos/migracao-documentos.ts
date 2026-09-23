import { randomUUID } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'
import { getUpload } from '@/lib/storage'
import { sha256Hex } from './servico'
import { categoriaDoDocumento, contentTypeDe, extensaoDe } from './tipos'

export interface ResultadoMigracao {
  total: number
  criados: number
  reaproveitados: number
  falhas: Array<{ documentoId: string; motivo: string }>
}

/** Cada `Documento` sem `arquivoId` ganha um `ArquivoCliente` com a MESMA URL do blob (nada é
 *  copiado — spec §3.7). Conteúdo repetido no mesmo cliente aponta pro mesmo registro. Idempotente:
 *  só olha documentos ainda sem `arquivoId`. Sem `aplicar`, só conta o que faria.
 *
 *  Competência não é copiada pro `ArquivoCliente` — ela é atributo de quem USA o arquivo (aqui, o
 *  próprio `Documento`), não do arquivo. */
export async function migrarDocumentos(
  prisma: PrismaClient,
  { aplicar, baixar = getUpload }: { aplicar: boolean; baixar?: (url: string) => Promise<Buffer> }
): Promise<ResultadoMigracao> {
  const documentos = await prisma.documento.findMany({
    where: { arquivoId: null },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      clienteId: true,
      nomeArquivo: true,
      tipo: true,
      caminhoOriginal: true,
      uploadedById: true,
      createdAt: true,
    },
  })

  const resultado: ResultadoMigracao = { total: documentos.length, criados: 0, reaproveitados: 0, falhas: [] }
  // No modo "só listar" nada é gravado, então o reaproveitamento é simulado aqui.
  const vistos = new Set<string>()

  for (const doc of documentos) {
    let sha256: string
    let tamanho: number
    try {
      const conteudo = await baixar(doc.caminhoOriginal)
      sha256 = sha256Hex(conteudo)
      tamanho = conteudo.length
    } catch (erro) {
      resultado.falhas.push({ documentoId: doc.id, motivo: erro instanceof Error ? erro.message : String(erro) })
      continue
    }

    const chave = `${doc.clienteId}:${sha256}`
    const existente = aplicar
      ? await prisma.arquivoCliente.findFirst({ where: { clienteId: doc.clienteId, sha256, removidoEm: null }, select: { id: true } })
      : vistos.has(chave)
        ? { id: '(simulado)' }
        : null
    vistos.add(chave)

    if (existente) {
      resultado.reaproveitados++
      if (aplicar) await prisma.documento.update({ where: { id: doc.id }, data: { arquivoId: existente.id } })
      continue
    }

    resultado.criados++
    if (!aplicar) continue
    const arquivo = await prisma.arquivoCliente.create({
      data: {
        id: randomUUID(),
        clienteId: doc.clienteId,
        categoria: categoriaDoDocumento(doc.tipo),
        nome: doc.nomeArquivo,
        extensao: extensaoDe(doc.nomeArquivo) || doc.tipo,
        contentType: contentTypeDe(doc.nomeArquivo),
        tamanhoBytes: tamanho,
        sha256,
        urlBlob: doc.caminhoOriginal,
        origem: 'migrado',
        enviadoPorId: doc.uploadedById,
        createdAt: doc.createdAt,
      },
      select: { id: true },
    })
    await prisma.documento.update({ where: { id: doc.id }, data: { arquivoId: arquivo.id } })
  }

  return resultado
}
