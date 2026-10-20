import { randomUUID } from 'node:crypto'

import type { Prisma } from '@prisma/client'

import type { RespostaRelatorioConfere } from '@/lib/confere/cliente'
import type { Competencia } from '@/lib/confere/tipos-cadastro'
import { prisma } from '@/lib/prisma'
import { configR2, putR2 } from '@/lib/r2'
import { buildConfereExecucaoPath, putUpload } from '@/lib/storage'

/** O histórico do ConfereAI (`/confere/historico`) — saiu da rota
 *  `api/confere/reports` em 20/10/2026 porque a geração assíncrona grava o
 *  histórico na **consulta** (`api/confere/reports/[execucao]`), e não no envio. */

export const TIPO_DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
export const TIPO_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

/** Um PDF de entrada que vai para o histórico. */
export interface EntradaParaGuardar {
  papel: 'contrato' | 'aditivo' | 'levantamento'
  nome: string
  bytes: Buffer
}

/** Entrada que já está no storage (geração assíncrona: guardada no envio). */
export interface EntradaGuardada {
  papel: 'contrato' | 'aditivo' | 'levantamento'
  nome: string
  caminho: string
}

/** Grava no R2 e, se ele não estiver configurado ou recusar, no Blob. O Blob está
 *  suspenso por cota (24/09/2026), e foi por isso que o histórico podia deixar de
 *  gravar sem ninguém perceber: o R2 vai primeiro. */
export async function gravar(chaveR2: string, caminhoBlob: string, dados: Buffer, tipo: string): Promise<string> {
  if (configR2()) {
    try {
      return await putR2(chaveR2, dados, tipo)
    } catch (erro) {
      console.error('[confere] R2 recusou a gravação do histórico, tentando o Blob —', erro)
    }
  }
  return putUpload(caminhoBlob, dados, tipo)
}

/** Grava a execução no histórico (`/confere/historico`) e devolve se gravou.
 *
 *  **A entrega não depende dele**: o relatório já foi gerado e está no corpo da
 *  resposta, e derrubá-la por uma falha de storage ou de banco cobraria de novo os
 *  ~25s de processamento. Mas a falha **não é silenciosa**: tenta duas vezes e
 *  devolve `false`, que a tela mostra como aviso ("não ficou salvo no histórico —
 *  baixe agora"). O que antes ia só para o log do servidor.
 *
 *  O `id` é gerado antes do `create` (aqui, ou por quem chama na geração
 *  assíncrona, que já guardou as entradas sob ele), porque o caminho no storage depende
 *  dele e as duas colunas de caminho são obrigatórias — criar a linha vazia pra
 *  depois atualizar deixaria registro pela metade se o upload falhasse no meio.
 *  Fica fora da repetição: a segunda tentativa sobrescreve os mesmos caminhos.
 *
 *  Os PDFs de entrada entram no mesmo registro (`arquivosEntrada`), cada um
 *  independente: um que falhe não impede o histórico, só some da lista.
 *
 *  `vinculo` diz de que contrato e competência foi o relatório (desenho de
 *  25/09/2026 §7.4) — os dois podem faltar: envio sem contrato identificado,
 *  planilha sem data.
 */
export async function registrarNoHistorico(
  resposta: RespostaRelatorioConfere,
  nomes: { contrato: string; levantamento: string; aditivos: string[] },
  vinculo: { contratoId: string | null; competencia: Competencia | null },
  entradas: (EntradaParaGuardar | EntradaGuardada)[],
  id: string = randomUUID()
): Promise<boolean> {
  for (let tentativa = 1; tentativa <= 2; tentativa++) {
    try {
      // Geração assíncrona: duas consultas podem chegar ao fim juntas (duas
      // abas, rede que repetiu). Quem chega depois acha a linha e não duplica.
      if (await prisma.confereExecucao.findUnique({ where: { id }, select: { id: true } })) return true

      const [caminhoDocx, caminhoXlsx] = await Promise.all([
        gravar(`confere-execucoes/${id}/relatorio.docx`, buildConfereExecucaoPath(id, 'docx'), Buffer.from(resposta.docx_base64, 'base64'), TIPO_DOCX),
        gravar(`confere-execucoes/${id}/analise.xlsx`, buildConfereExecucaoPath(id, 'xlsx'), Buffer.from(resposta.analise_xlsx_base64, 'base64'), TIPO_XLSX),
      ])

      const guardadas = await Promise.all(
        entradas.map(async (entrada, posicao) => {
          if ('caminho' in entrada) return entrada
          try {
            const ehPlanilha = entrada.papel === 'levantamento'
            const nomeNoStorage = `entrada-${posicao}.${ehPlanilha ? 'xlsx' : 'pdf'}`
            const caminho = await gravar(`confere-execucoes/${id}/${nomeNoStorage}`, `confere/${id}/${nomeNoStorage}`, entrada.bytes, ehPlanilha ? TIPO_XLSX : 'application/pdf')
            return { papel: entrada.papel, nome: entrada.nome, caminho }
          } catch (erro) {
            console.error(`[confere] PDF de entrada "${entrada.nome}" não foi guardado no histórico —`, erro)
            return null
          }
        })
      )

      // Os dois base64 ficam **fora** do JSON: eles já são os arquivos que
      // acabaram de subir, e guardá-los de novo dobraria ~2MB por execução
      // dentro de uma coluna que é lida inteira a cada abertura.
      const { docx_base64: _docx, analise_xlsx_base64: _xlsx, ...resultado } = resposta

      await prisma.confereExecucao.create({
        data: {
          id,
          nomeContrato: nomes.contrato,
          nomeLevantamento: nomes.levantamento,
          nomesAditivos: nomes.aditivos,
          caminhoDocx,
          caminhoXlsx,
          arquivosEntrada: guardadas.filter((g) => g !== null) as unknown as Prisma.InputJsonValue,
          contratoId: vinculo.contratoId,
          competenciaAno: vinculo.competencia?.ano ?? null,
          competenciaMes: vinculo.competencia?.mes ?? null,
          // Veio de `response.json()` do Confere, então é JSON de verdade — o
          // tipo do cliente (`[chave: string]: unknown`) só é largo demais pro
          // `InputJsonValue` do Prisma. Mesmo cast das rotas de análise.
          resultado: resultado as unknown as Prisma.InputJsonValue,
        },
      })
      return true
    } catch (erro) {
      if (tentativa < 2) continue
      // Mensagem acionável, e não um `console.error` cru. As causas mais
      // prováveis são de **configuração**, não de código.
      const detalhe =
        // `prisma.confereExecucao` é `undefined` enquanto o Prisma Client não
        // for regerado com o model novo — o acesso estoura aqui dentro.
        erro instanceof TypeError
          ? 'o Prisma Client parece não conhecer o model ConfereExecucao — rode `npx prisma generate` e aplique as migrações `20260921180000_add_confere_execucao` e `20261008143500_confere_execucao_arquivos_entrada`'
          : 'verifique as variáveis do R2 (e BLOB_READ_WRITE_TOKEN) e se a tabela ConfereExecucao tem a coluna arquivosEntrada'
      console.error(`[confere] execução gerada mas NÃO registrada no histórico — ${detalhe}.`, erro)
    }
  }
  return false
}

