import type { PrismaClient } from '@prisma/client'
import { deleteUpload, getUpload } from '@/lib/storage'
import { registrarConteudo } from '@/lib/arquivos/registrar-conteudo'
import { COLUNAS_ANEXO, categoriaDaColuna, dadosDaColuna, type ColunaAnexo } from '@/lib/relatorios-clientes/anexos-historico'

// Migração das cópias de PDF nas linhas do histórico (`*PdfUrl`) para referência ao repositório do
// cliente (spec docs/superpowers/specs/2026-09-23-sharepoint-lugar-certo-design.md §6.3). Duas etapas,
// porque o código antigo lê as URLs até o deploy do novo:
//   1. `migrarAnexosParaReferencia`: preenche `*ArquivoId` (não apaga nada) — roda ANTES do deploy;
//   2. `apagarCopiasMigradas`: apaga os blobs das cópias e limpa as URLs — roda DEPOIS do deploy.
// Cópia de linha que veio do SharePoint (`chaveSharepoint`) NÃO é baixada por padrão: o original está
// na biblioteca e a sincronização religa a coluna a ele (a coluna sem referência conta como vazia).
// Evita baixar e subir de novo centenas de MB — e não depende do Blob estar legível. `incluirSharepoint`
// migra também essas, para o que sobrar depois da sincronização (PDF que não existe mais no SharePoint).

const COLUNAS_URL = {
  proposta: { url: 'propostaPdfUrl', nome: 'propostaPdfNome' },
  termo: { url: 'termoPdfUrl', nome: 'termoPdfNome' },
} as const

const SEM_REFERENCIA = {
  OR: [
    { propostaPdfUrl: { not: null }, propostaArquivoId: null },
    { termoPdfUrl: { not: null }, termoArquivoId: null },
  ],
}

export interface ResultadoMigracaoAnexos {
  referenciados: number
  novosNoRepositorio: number
  reaproveitados: number
  /** Linhas do SharePoint com cópia ainda sem referência — a sincronização religa ao original. */
  deixadosParaSincronizacao: number
  falhas: Array<{ linhaId: string; coluna: ColunaAnexo; motivo: string }>
}

export async function migrarAnexosParaReferencia(
  db: PrismaClient,
  opcoes: {
    aplicar: boolean
    incluirSharepoint?: boolean
    baixar?: (url: string) => Promise<Buffer>
    gravarBlob?: (c: string, b: Buffer, t: string) => Promise<string>
  }
): Promise<ResultadoMigracaoAnexos> {
  const baixar = opcoes.baixar ?? getUpload
  const r: ResultadoMigracaoAnexos = { referenciados: 0, novosNoRepositorio: 0, reaproveitados: 0, deixadosParaSincronizacao: 0, falhas: [] }
  if (!opcoes.incluirSharepoint) {
    r.deixadosParaSincronizacao = await db.historicoContrato.count({ where: { AND: [SEM_REFERENCIA, { chaveSharepoint: { not: null } }] } })
  }
  const linhas = await db.historicoContrato.findMany({
    where: opcoes.incluirSharepoint ? SEM_REFERENCIA : { AND: [SEM_REFERENCIA], chaveSharepoint: null },
    select: {
      id: true,
      tipo: true,
      chaveSharepoint: true,
      propostaPdfUrl: true,
      propostaPdfNome: true,
      propostaArquivoId: true,
      termoPdfUrl: true,
      termoPdfNome: true,
      termoArquivoId: true,
      contrato: { select: { clienteId: true } },
    },
  })

  for (const linha of linhas) {
    for (const coluna of ['proposta', 'termo'] as const) {
      const url = linha[COLUNAS_URL[coluna].url]
      if (!url || linha[COLUNAS_ANEXO[coluna].arquivoId]) continue
      try {
        const conteudo = await baixar(url)
        if (!opcoes.aplicar) {
          r.referenciados++
          continue
        }
        const { id, novo } = await registrarConteudo(
          db,
          {
            clienteId: linha.contrato.clienteId,
            nome: linha[COLUNAS_URL[coluna].nome] ?? `${COLUNAS_ANEXO[coluna].rotulo.replace('/', '-')}.pdf`,
            conteudo,
            categoria: categoriaDaColuna(coluna, linha.tipo),
            origem: 'migrado',
            enviadoPorId: null,
          },
          { gravarBlob: opcoes.gravarBlob }
        )
        if (novo) r.novosNoRepositorio++
        else r.reaproveitados++
        // Linha criada pela importação do SharePoint → a coluna acompanha o SharePoint; senão foi à mão.
        await db.historicoContrato.update({ where: { id: linha.id }, data: dadosDaColuna(coluna, id, linha.chaveSharepoint !== null) })
        r.referenciados++
      } catch (erro) {
        r.falhas.push({ linhaId: linha.id, coluna, motivo: erro instanceof Error ? erro.message : String(erro) })
      }
    }
  }
  return r
}

export async function apagarCopiasMigradas(
  db: PrismaClient,
  opcoes: { aplicar: boolean; apagarBlob?: (url: string) => Promise<void> }
): Promise<{ apagadas: number }> {
  const apagarBlob = opcoes.apagarBlob ?? deleteUpload
  const pendentes = await db.historicoContrato.count({ where: SEM_REFERENCIA })
  if (pendentes > 0) {
    throw new Error(
      `${pendentes} linha(s) ainda com cópia e sem referência — rode a sincronização (religa as do SharePoint) ` +
        `e, para o que sobrar, a migração com --incluir-sharepoint, antes de --apagar-copias`
    )
  }

  const linhas = await db.historicoContrato.findMany({
    where: { OR: [{ propostaPdfUrl: { not: null } }, { termoPdfUrl: { not: null } }] },
    select: { id: true, propostaPdfUrl: true, termoPdfUrl: true },
  })
  let apagadas = 0
  for (const linha of linhas) {
    for (const coluna of ['proposta', 'termo'] as const) {
      const url = linha[COLUNAS_URL[coluna].url]
      if (!url) continue
      apagadas++
      if (!opcoes.aplicar) continue
      await apagarBlob(url).catch(() => {})
      await db.historicoContrato.update({
        where: { id: linha.id },
        data: coluna === 'proposta' ? { propostaPdfUrl: null, propostaPdfNome: null } : { termoPdfUrl: null, termoPdfNome: null },
      })
    }
  }
  return { apagadas }
}
