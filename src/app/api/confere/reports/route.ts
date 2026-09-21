import { randomUUID } from 'node:crypto'

import type { Prisma } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'

import { chamarConfere, type RespostaRelatorioConfere } from '@/lib/confere/cliente'
import { prisma } from '@/lib/prisma'
import { buildConfereExecucaoPath, putUpload } from '@/lib/storage'

const TIPO_DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
const TIPO_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

/** Grava a execução no histórico (`/confere/historico`).
 *
 *  **Best-effort, e de propósito**: o relatório já foi gerado e já está no
 *  corpo da resposta. Derrubar a entrega por uma falha de storage ou de banco
 *  cobraria de novo os ~25s de processamento por causa de um registro que é
 *  conveniência, não o produto. A falha vai pro log do servidor.
 *
 *  O `id` é gerado aqui, antes do `create`, porque o caminho no Blob depende
 *  dele e as duas colunas de caminho são obrigatórias — criar a linha vazia
 *  pra depois atualizar deixaria registro pela metade se o upload falhasse no
 *  meio.
 */
async function registrarNoHistorico(
  resposta: RespostaRelatorioConfere,
  nomes: { contrato: string; levantamento: string; aditivos: string[] }
): Promise<void> {
  try {
    const id = randomUUID()
    const [caminhoDocx, caminhoXlsx] = await Promise.all([
      putUpload(buildConfereExecucaoPath(id, 'docx'), Buffer.from(resposta.docx_base64, 'base64'), TIPO_DOCX),
      putUpload(buildConfereExecucaoPath(id, 'xlsx'), Buffer.from(resposta.analise_xlsx_base64, 'base64'), TIPO_XLSX),
    ])

    // Os dois base64 ficam **fora** do JSON: eles já são os arquivos que
    // acabaram de subir pro Blob, e guardá-los de novo dobraria ~2MB por
    // execução dentro de uma coluna que é lida inteira a cada abertura.
    const { docx_base64: _docx, analise_xlsx_base64: _xlsx, ...resultado } = resposta

    await prisma.confereExecucao.create({
      data: {
        id,
        nomeContrato: nomes.contrato,
        nomeLevantamento: nomes.levantamento,
        nomesAditivos: nomes.aditivos,
        caminhoDocx,
        caminhoXlsx,
        // Veio de `response.json()` do Confere, então é JSON de verdade — o
        // tipo do cliente (`[chave: string]: unknown`) só é largo demais pro
        // `InputJsonValue` do Prisma. Mesmo cast das rotas de análise.
        resultado: resultado as unknown as Prisma.InputJsonValue,
      },
    })
  } catch (erro) {
    // Mensagem acionável, e não um `console.error` cru. As duas causas de
    // longe mais prováveis são de **configuração**, não de código, e as duas
    // se manifestam do mesmo jeito: a geração funciona, o histórico fica
    // vazio, e nada na tela explica por quê (a gravação é best-effort de
    // propósito — ver o comentário acima).
    const detalhe =
      // `prisma.confereExecucao` é `undefined` enquanto o Prisma Client não
      // for regerado com o model novo — o acesso estoura aqui dentro.
      erro instanceof TypeError
        ? 'o Prisma Client parece não conhecer o model ConfereExecucao — rode `npx prisma generate` e aplique a migração `20260921180000_add_confere_execucao`'
        : 'verifique BLOB_READ_WRITE_TOKEN e se a tabela ConfereExecucao existe no banco'
    console.error(`[confere] execução gerada mas NÃO registrada no histórico — ${detalhe}.`, erro)
  }
}

// Mesma folga que a integração já usava: cold start do Render (~1min, plano
// free) + geração (~30s) — ver docs/superpowers/specs/2026-09-21-integracao-confere-design.md.
export const maxDuration = 120

async function paraArquivo(arquivo: File): Promise<{ nome: string; bytes: Buffer }> {
  return { nome: arquivo.name, bytes: Buffer.from(await arquivo.arrayBuffer()) }
}

/**
 * Proxy para o Confere — usado pela página `/confere` (cópia do frontend
 * próprio do Confere, ver `src/app/confere/`). Existe só para o navegador
 * nunca falar direto com o Confere nem conhecer `CONFERE_SHARED_SECRET`:
 * recebe o mesmo multipart que o Confere espera, chama `chamarConfere()`
 * (que injeta o segredo no servidor) e devolve a resposta dele quase sem
 * tocar — mesmo contrato (200 com o relatório completo, 422 com
 * `bloqueantes`, qualquer outra coisa vira erro), pra `src/app/confere/lib/api.ts`
 * não precisar saber que está falando com um proxy.
 *
 * Sem persistência nenhuma — a rota não grava nada no banco nem em storage:
 * a aplicação portada é sem estado, igual ao Confere original (ver §3.7 do
 * design doc). Isso é diferente da rota anterior desta integração
 * (`/api/clientes/[clienteId]/competencias/[competencia]/analise-medicao`,
 * removida — ver "Nota de processo" no design doc).
 */
export async function POST(request: NextRequest) {
  const formData = await request.formData()

  const contrato = formData.get('contrato')
  const levantamento = formData.get('levantamento')
  if (!(contrato instanceof File) || !(levantamento instanceof File)) {
    return NextResponse.json({ detail: 'contrato e levantamento são obrigatórios' }, { status: 400 })
  }

  const aditivos = formData.getAll('aditivos').filter((valor): valor is File => valor instanceof File)
  const identidadeConfirmada = formData.get('identidade_confirmada') === 'true'

  const resultado = await chamarConfere({
    contrato: await paraArquivo(contrato),
    levantamento: await paraArquivo(levantamento),
    aditivos: await Promise.all(aditivos.map(paraArquivo)),
    identidadeConfirmada,
  })

  if (resultado.tipo === 'concluido') {
    // `await` e não fire-and-forget: numa função serverless a resposta
    // encerra a invocação, e trabalho pendente depois dela pode ser cortado
    // no meio — o histórico sairia gravado às vezes. São ~2 uploads sobre uma
    // requisição que já levou ~25s.
    await registrarNoHistorico(resultado.resposta, {
      contrato: contrato.name,
      levantamento: levantamento.name,
      aditivos: aditivos.map((arquivo) => arquivo.name),
    })
    return NextResponse.json(resultado.resposta, { status: 200 })
  }
  if (resultado.tipo === 'bloqueado') {
    return NextResponse.json(resultado.resposta, { status: 422 })
  }
  return NextResponse.json({ detail: resultado.mensagem }, { status: 502 })
}
