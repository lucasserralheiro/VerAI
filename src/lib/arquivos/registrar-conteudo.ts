import { randomUUID } from 'node:crypto'
import { Prisma, type CategoriaArquivo, type OrigemArquivo, type PrismaClient } from '@prisma/client'
import { deleteUpload, putUpload } from '@/lib/storage'
import { caminhoFinalArquivo } from './caminhos'
import { sha256Hex } from './servico'
import { contentTypeDe, extensaoDe } from './tipos'

// Registro de um conteúdo que o SERVIDOR já tem em memória — sincronização com o SharePoint, anexo da
// linha do histórico, migração das cópias antigas. Mesma regra do `registrarArquivo` (upload da tela):
// mesmo hash no mesmo cliente = mesmo registro (spec do repositório §3.4.1). Recebe o banco por
// parâmetro porque roda também em scripts, com o PrismaClient deles.

export interface ConteudoParaRegistrar {
  clienteId: string
  nome: string
  conteudo: Buffer
  categoria: CategoriaArquivo
  origem: OrigemArquivo
  enviadoPorId: string | null
  /** Já calculado por quem chama (evita ler o buffer de novo). */
  sha256?: string
}

export async function registrarConteudo(
  db: Pick<PrismaClient, 'arquivoCliente'>,
  dados: ConteudoParaRegistrar,
  opcoes: { gravarBlob?: (caminho: string, conteudo: Buffer, contentType: string) => Promise<string> } = {}
): Promise<{ id: string; novo: boolean }> {
  const gravarBlob = opcoes.gravarBlob ?? putUpload
  const sha256 = dados.sha256 ?? sha256Hex(dados.conteudo)
  const buscar = () => db.arquivoCliente.findFirst({ where: { clienteId: dados.clienteId, sha256, removidoEm: null }, select: { id: true } })

  const existente = await buscar()
  if (existente) return { id: existente.id, novo: false }

  const id = randomUUID()
  const contentType = contentTypeDe(dados.nome)
  const urlBlob = await gravarBlob(caminhoFinalArquivo(dados.clienteId, id, dados.nome), dados.conteudo, contentType)
  try {
    await db.arquivoCliente.create({
      data: {
        id,
        clienteId: dados.clienteId,
        categoria: dados.categoria,
        nome: dados.nome,
        extensao: extensaoDe(dados.nome),
        contentType,
        tamanhoBytes: dados.conteudo.length,
        sha256,
        urlBlob,
        origem: dados.origem,
        enviadoPorId: dados.enviadoPorId,
      },
    })
    return { id, novo: true }
  } catch (erro) {
    // O blob recém-gravado nunca foi referenciado: apaga (best-effort), como em registrarArquivo.
    await deleteUpload(urlBlob).catch(() => {})
    // Mesmo conteúdo gravado por outro caminho ao mesmo tempo: índice único parcial (clienteId, sha256).
    if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === 'P2002') {
      const outro = await buscar()
      if (outro) return { id: outro.id, novo: false }
    }
    throw erro
  }
}
