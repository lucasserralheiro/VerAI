import { randomUUID } from 'node:crypto'
import { head } from '@vercel/blob'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getUpload } from '@/lib/storage'
import { extrairPaginas, semCamadaDeTexto } from './extrair'
import { listarFontes, type FonteDocumento } from './fontes'
import { cortarEmTrechos, hashTexto, htmlParaTexto, type PaginaDeTexto, type Trecho } from './trechos'

export type StatusIndice = 'ok' | 'sem_texto' | 'erro'

export interface DepsIndexacao {
  baixar(url: string): Promise<Buffer>
  /** Identidade da versão do arquivo no Blob — muda quando alguém sobrescreve o mesmo caminho. */
  versaoDoBlob(url: string): Promise<string>
}

export const depsPadrao: DepsIndexacao = {
  baixar: getUpload,
  versaoDoBlob: async (url) => (await head(url)).uploadedAt.toISOString(),
}

export interface ResumoSincronizacao {
  ok: number
  sem_texto: number
  erro: number
  removidos: number
  /** Arquivos pendentes que ficaram para a próxima rodada por causa do `limite`. */
  restantes: number
}

const LOTE_INSERT = 100

async function gravarIndice(
  fonte: FonteDocumento,
  resultado: { status: StatusIndice; versao: string | null; mensagem?: string; trechos: Trecho[] }
) {
  await prisma.$transaction(
    async (tx) => {
      await tx.indiceDocumento.deleteMany({ where: { origem: fonte.origem, origemId: fonte.origemId } })
      const indice = await tx.indiceDocumento.create({
        data: {
          origem: fonte.origem,
          origemId: fonte.origemId,
          url: fonte.url,
          versao: resultado.versao,
          nomeArquivo: fonte.nomeArquivo,
          clienteId: fonte.clienteId,
          contratoId: fonte.contratoId,
          status: resultado.status,
          mensagem: resultado.mensagem ?? null,
          totalTrechos: resultado.trechos.length,
        },
      })
      for (let i = 0; i < resultado.trechos.length; i += LOTE_INSERT) {
        const lote = resultado.trechos.slice(i, i + LOTE_INSERT)
        await tx.$executeRaw(Prisma.sql`
          INSERT INTO "TrechoDocumento"
            ("id", "indiceId", "origem", "origemId", "clienteId", "contratoId", "nomeArquivo", "pagina", "ordem", "texto", "busca", "createdAt")
          VALUES ${Prisma.join(
            lote.map(
              (t) => Prisma.sql`(${randomUUID()}, ${indice.id}, ${fonte.origem}::"OrigemTrecho", ${fonte.origemId},
                ${fonte.clienteId}, ${fonte.contratoId}, ${fonte.nomeArquivo}, ${t.pagina}, ${t.ordem}, ${t.texto},
                to_tsvector('portuguese', unaccent(${t.texto})), now())`
            )
          )}`)
      }
    },
    { timeout: 60_000 }
  )
}

export async function indexarFonte(fonte: FonteDocumento, deps: DepsIndexacao = depsPadrao): Promise<StatusIndice> {
  try {
    let paginas: PaginaDeTexto[]
    let versao: string
    if (fonte.textoPronto !== null) {
      paginas = [{ pagina: null, texto: htmlParaTexto(fonte.textoPronto) }]
      versao = hashTexto(fonte.textoPronto)
    } else {
      versao = await deps.versaoDoBlob(fonte.url)
      paginas = await extrairPaginas(await deps.baixar(fonte.url), fonte.tipo)
    }
    if (semCamadaDeTexto(paginas)) {
      await gravarIndice(fonte, { status: 'sem_texto', versao, trechos: [] })
      return 'sem_texto'
    }
    await gravarIndice(fonte, { status: 'ok', versao, trechos: cortarEmTrechos(paginas) })
    return 'ok'
  } catch (erro) {
    const mensagem = (erro instanceof Error ? erro.message : String(erro)).slice(0, 500)
    try {
      await gravarIndice(fonte, { status: 'erro', versao: null, mensagem, trechos: [] })
    } catch (erroGravacao) {
      console.error('[assistente] falha ao registrar erro de indexação', fonte.origem, fonte.origemId, erroGravacao)
    }
    return 'erro'
  }
}

const chave = (origem: string, origemId: string) => `${origem}:${origemId}`

/**
 * Deixa o índice igual ao banco: indexa arquivo novo ou trocado (URL diferente, ou texto pronto com
 * hash diferente), remove o que não existe mais e — com `conferirVersao` — reindexa arquivo
 * sobrescrito no mesmo caminho do Blob (as rotas de PDF do histórico/faturamento gravam sempre no
 * mesmo caminho). `conferirVersao` custa um HEAD por arquivo: usar no cron/admin/script, não na
 * sincronização sob demanda da busca.
 */
export async function sincronizarIndice(
  opcoes: { clienteId?: string; conferirVersao?: boolean; limite?: number; deps?: DepsIndexacao } = {}
): Promise<ResumoSincronizacao> {
  const { clienteId, conferirVersao = false, limite = 50, deps = depsPadrao } = opcoes
  const [fontes, indices] = await Promise.all([
    listarFontes({ clienteId }),
    prisma.indiceDocumento.findMany({
      where: clienteId ? { clienteId } : {},
      select: { id: true, origem: true, origemId: true, url: true, versao: true },
    }),
  ])
  const porChave = new Map(indices.map((i) => [chave(i.origem, i.origemId), i]))
  const atuais = new Set(fontes.map((f) => chave(f.origem, f.origemId)))

  const orfaos = indices.filter((i) => !atuais.has(chave(i.origem, i.origemId)))
  if (orfaos.length > 0) await prisma.indiceDocumento.deleteMany({ where: { id: { in: orfaos.map((o) => o.id) } } })

  const pendentes: FonteDocumento[] = []
  for (const fonte of fontes) {
    const indice = porChave.get(chave(fonte.origem, fonte.origemId))
    if (!indice || indice.url !== fonte.url) {
      pendentes.push(fonte)
    } else if (fonte.textoPronto !== null) {
      if (indice.versao !== hashTexto(fonte.textoPronto)) pendentes.push(fonte)
    } else if (conferirVersao) {
      try {
        if ((await deps.versaoDoBlob(fonte.url)) !== indice.versao) pendentes.push(fonte)
      } catch {
        // Blob inacessível agora: mantém o índice como está e tenta na próxima rodada.
      }
    }
  }

  const lote = pendentes.slice(0, limite)
  const resumo: ResumoSincronizacao = { ok: 0, sem_texto: 0, erro: 0, removidos: orfaos.length, restantes: pendentes.length - lote.length }
  for (const fonte of lote) resumo[await indexarFonte(fonte, deps)]++
  return resumo
}
