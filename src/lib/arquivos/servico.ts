import { createHash, randomUUID } from 'node:crypto'
import { Prisma, type CategoriaArquivo } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { deleteUpload, getUpload, putUpload } from '@/lib/storage'
import { formatarCompetencia, nomeCompetencia } from '@/lib/competencia'
import { caminhoFinalArquivo } from './caminhos'
import { contentTypeDe, extensaoDe, type UsoArquivo } from './tipos'

export type { UsoArquivo } from './tipos'

// Serviço do repositório de documentos do cliente (spec
// docs/superpowers/specs/2026-09-23-repositorio-documentos-cliente-design.md). Só servidor.

export function sha256Hex(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex')
}

/** Tudo que a tela precisa — **sem `urlBlob`**, que nunca sai do servidor (spec §3.4 regra 3). */
export const SELECT_ARQUIVO = {
  id: true,
  clienteId: true,
  categoria: true,
  nome: true,
  extensao: true,
  contentType: true,
  tamanhoBytes: true,
  sha256: true,
  origem: true,
  createdAt: true,
  enviadoPor: { select: { nome: true } },
} satisfies Prisma.ArquivoClienteSelect

export type ArquivoSelecionado = Prisma.ArquivoClienteGetPayload<{ select: typeof SELECT_ARQUIVO }>

export interface DadosRegistro {
  clienteId: string
  urlTemporaria: string
  nome: string
  categoria: CategoriaArquivo
  enviadoPorId: string
}

function existente(clienteId: string, sha256: string) {
  return prisma.arquivoCliente.findFirst({ where: { clienteId, sha256, removidoEm: null }, select: SELECT_ARQUIVO })
}

/** Registra um arquivo que o navegador subiu direto pro Blob (caminho temporário): baixa servidor a
 *  servidor, calcula o hash, e — se o cliente ainda não tem esse conteúdo — copia pro caminho final e
 *  grava. O temporário é apagado nos dois casos, mas só best-effort (`.catch(() => {})`): se essa
 *  chamada falhar, o blob fica órfão em `tmp-arquivos/` — o `validUntil` do token de upload só limita
 *  o token do navegador, o Vercel Blob não apaga o blob sozinho. Falta um job de limpeza periódica
 *  pra esse prefixo (pendente — a ser tratado no próximo plano). */
export async function registrarArquivo(dados: DadosRegistro): Promise<{ arquivo: ArquivoSelecionado; duplicado: boolean }> {
  const buffer = await getUpload(dados.urlTemporaria)
  const sha256 = sha256Hex(buffer)
  const apagarTemporario = () => deleteUpload(dados.urlTemporaria).catch(() => {})

  const jaExiste = await existente(dados.clienteId, sha256)
  if (jaExiste) {
    await apagarTemporario()
    return { arquivo: jaExiste, duplicado: true }
  }

  const id = randomUUID()
  const contentType = contentTypeDe(dados.nome)
  const urlBlob = await putUpload(caminhoFinalArquivo(dados.clienteId, id, dados.nome), buffer, contentType)
  try {
    const arquivo = await prisma.arquivoCliente.create({
      data: {
        id,
        clienteId: dados.clienteId,
        categoria: dados.categoria,
        nome: dados.nome,
        extensao: extensaoDe(dados.nome),
        contentType,
        tamanhoBytes: buffer.length,
        sha256,
        urlBlob,
        origem: 'upload',
        enviadoPorId: dados.enviadoPorId,
      },
      select: SELECT_ARQUIVO,
    })
    await apagarTemporario()
    return { arquivo, duplicado: false }
  } catch (erro) {
    // Registração falhou: apaga o blob final (órfão, nunca foi referenciado).
    await deleteUpload(urlBlob).catch(() => {})

    // Dois envios do mesmo conteúdo ao mesmo tempo: o índice único parcial barra o segundo.
    if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === 'P2002') {
      const doOutro = await existente(dados.clienteId, sha256)
      if (doOutro) {
        await apagarTemporario()
        return { arquivo: doOutro, duplicado: true }
      }
    }
    throw erro
  }
}

function rotuloDaLinha(linha: { tipo: string; numero: string | null }): string {
  return linha.tipo === 'CONTRATO' ? 'contrato inicial' : (linha.numero ?? linha.tipo.toLowerCase())
}

/** Onde cada arquivo é usado: análise por IA (`Documento`), coluna PC/PA–TC/TA de linha do histórico
 *  e lugar na biblioteca do SharePoint. Faturamento, ConfereAI e proposta comercial entram nas
 *  próximas fases do repositório. */
export async function usosDosArquivos(ids: string[]): Promise<Map<string, UsoArquivo[]>> {
  const usos = new Map<string, UsoArquivo[]>(ids.map((id) => [id, []]))
  if (ids.length === 0) return usos

  const [documentos, linhas, locais] = await Promise.all([
    prisma.documento.findMany({
      where: { arquivoId: { in: ids } },
      select: { arquivoId: true, clienteId: true, competenciaAno: true, competenciaMes: true },
    }),
    prisma.historicoContrato.findMany({
      where: { OR: [{ propostaArquivoId: { in: ids } }, { termoArquivoId: { in: ids } }] },
      select: {
        id: true,
        tipo: true,
        numero: true,
        propostaArquivoId: true,
        termoArquivoId: true,
        propostaDoSharepoint: true,
        termoDoSharepoint: true,
        contrato: { select: { id: true, numeroTermo: true, clienteId: true } },
      },
    }),
    prisma.arquivoSharepoint.findMany({
      where: { arquivoId: { in: ids }, removidoNaOrigemEm: null },
      select: {
        arquivoId: true,
        caminho: true,
        contrato: { select: { id: true, numeroTermo: true, clienteId: true } },
        arquivo: { select: { clienteId: true } },
      },
    }),
  ])

  for (const doc of documentos) {
    usos.get(doc.arquivoId!)?.push({
      tipo: 'analise-documento',
      rotulo: `Análise por IA · ${nomeCompetencia(doc.competenciaAno, doc.competenciaMes)}`,
      href: `/clientes/${doc.clienteId}/${formatarCompetencia(doc.competenciaAno, doc.competenciaMes)}`,
      contrato: null,
      competencia: { ano: doc.competenciaAno, mes: doc.competenciaMes },
    })
  }
  for (const linha of linhas) {
    const colunas = [
      ['PC/PA', linha.propostaArquivoId, linha.propostaDoSharepoint],
      ['TC/TA', linha.termoArquivoId, linha.termoDoSharepoint],
    ] as const
    for (const [rotulo, arquivoId, daSincronizacao] of colunas) {
      if (!arquivoId) continue
      usos.get(arquivoId)?.push({
        tipo: 'historico-contrato',
        rotulo: `Contrato ${linha.contrato.numeroTermo ?? 'sem nº'} · ${rotulo} de ${rotuloDaLinha(linha)}`,
        href: `/clientes/${linha.contrato.clienteId}/contratos/${linha.contrato.id}`,
        contrato: { id: linha.contrato.id, numeroTermo: linha.contrato.numeroTermo },
        competencia: null,
        daSincronizacao,
      })
    }
  }
  for (const local of locais) {
    usos.get(local.arquivoId!)?.push({
      tipo: 'sharepoint',
      rotulo: `SharePoint · ${local.caminho}`,
      href: local.contrato
        ? `/clientes/${local.contrato.clienteId}/contratos/${local.contrato.id}`
        : `/clientes/${local.arquivo!.clienteId}`,
      contrato: local.contrato ? { id: local.contrato.id, numeroTermo: local.contrato.numeroTermo } : null,
      competencia: null,
      daSincronizacao: true,
    })
  }
  return usos
}

export function serializarArquivo(arquivo: ArquivoSelecionado, usos: UsoArquivo[]) {
  return { ...arquivo, usos }
}
