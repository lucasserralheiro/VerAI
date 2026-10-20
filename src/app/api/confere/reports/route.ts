import { randomUUID } from 'node:crypto'

import { NextRequest, NextResponse } from 'next/server'

import {
  ArquivoDoCadastroRecusado,
  carregarArquivosDoCadastro,
  contratoDoUsuario,
  type ArquivoBaixado,
} from '@/lib/confere/cadastro'
import { chamarConfere, iniciarNoConfere } from '@/lib/confere/cliente'
import { emitirBilhete } from '@/lib/confere/execucao-assincrona'
import { gravar, registrarNoHistorico, TIPO_XLSX, type EntradaGuardada } from '@/lib/confere/historico'
import { competenciaDaData, lerCabecalhoDoLevantamento } from '@/lib/confere/levantamento'
import { PREFIXO_DO_CADASTRO, type Competencia } from '@/lib/confere/tipos-cadastro'
import { exigirUsuario } from '@/lib/relatorios-clientes/acesso'

// Teto do plano Hobby com Fluid compute, e também o padrão de quem não declara
// nada. O valor anterior (120) *reduzia* o prazo: medido em 24/09/2026 no
// Render free, o Confere leva 134 s num contrato com aditivo (serviço acordado)
// e mais ~23 s quando hiberna — a Vercel matava a função no meio e a tela
// recebia o 504 cru dela. Ver docs/superpowers/specs/2026-09-21-integracao-confere-design.md.
export const maxDuration = 300

/** O que ainda precisa caber no mesmo `maxDuration` depois de o Confere
 *  responder: gravar o histórico (dois uploads e um insert) e mandar os ~5 MB
 *  da resposta de volta. */
const FOLGA_DEPOIS_DO_CONFERE_MS = 30_000

const MENSAGEM_TEMPO_ESGOTADO =
  'O Confere não terminou dentro do tempo máximo de processamento e a geração foi interrompida. ' +
  'Ele continua trabalhando neste envio por mais alguns minutos — espere um pouco antes de tentar de novo.'

async function paraArquivo(arquivo: File): Promise<ArquivoBaixado> {
  return { nome: arquivo.name, bytes: Buffer.from(await arquivo.arrayBuffer()) }
}

/** O que a planilha diz ser a competência — só para o histórico; planilha ilegível fica sem. */
async function competenciaDoLevantamento(bytes: Buffer): Promise<Competencia | null> {
  try {
    return competenciaDaData((await lerCabecalhoDoLevantamento(bytes)).dataLevantamento)
  } catch {
    return null
  }
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
 * A geração é sem estado, igual ao Confere original (ver §3.7 do design doc):
 * os arquivos de entrada não são guardados. O que fica é o registro no
 * histórico, no caminho de sucesso e só nele (ver `registrarNoHistorico` e o
 * adendo "histórico do ConfereAI" do design doc).
 *
 * Contrato e aditivos também podem vir **do cadastro do cliente**, por id
 * (`contrato_arquivo_id`; `aditivos=cadastro:<id>`, na mesma lista e ordem dos
 * enviados do computador): o servidor confere o acesso e baixa o PDF do R2, e o
 * corpo da requisição fica só com a planilha — ver
 * docs/superpowers/specs/2026-09-25-confere-contrato-do-cadastro-design.md §7.2.
 */
export async function POST(request: NextRequest) {
  // O relógio do `maxDuration` corre desde a invocação, e o upload dos arquivos
  // — e o download do cadastro — acontecem dentro dele: o orçamento do Confere
  // é o que sobrar.
  const inicio = Date.now()
  const autenticado = await exigirUsuario(request)
  if ('erro' in autenticado) return autenticado.erro
  const { usuario } = autenticado
  const formData = await request.formData()

  const levantamento = formData.get('levantamento')
  const contratoEnviado = formData.get('contrato')
  const idDoContrato = formData.get('contrato_arquivo_id')
  const contratoDoCadastro = typeof idDoContrato === 'string' && idDoContrato !== '' ? idDoContrato : null
  if (!(levantamento instanceof File) || (!(contratoEnviado instanceof File) && !contratoDoCadastro)) {
    return NextResponse.json({ detail: 'contrato e levantamento são obrigatórios' }, { status: 400 })
  }

  // Em ordem de aplicação: cada entrada é um arquivo ou `cadastro:<id>`.
  const entradas = formData
    .getAll('aditivos')
    .filter(
      (valor): valor is File | string =>
        valor instanceof File || (typeof valor === 'string' && valor.startsWith(PREFIXO_DO_CADASTRO))
    )
  const idDoCadastro = (entrada: string) => entrada.slice(PREFIXO_DO_CADASTRO.length)
  const identidadeConfirmada = formData.get('identidade_confirmada') === 'true'

  const contratoInformado = formData.get('contrato_id')
  const contratoId = typeof contratoInformado === 'string' && contratoInformado !== '' ? contratoInformado : null
  const contratoEscolhido = contratoId ? await contratoDoUsuario(usuario, contratoId) : null
  if (contratoId && !contratoEscolhido) {
    return NextResponse.json({ detail: 'Sem acesso ao contrato escolhido.' }, { status: 403 })
  }

  let doCadastro: Map<string, ArquivoBaixado>
  try {
    doCadastro = await carregarArquivosDoCadastro(
      usuario,
      [
        ...(contratoDoCadastro ? [contratoDoCadastro] : []),
        ...entradas.filter((entrada): entrada is string => typeof entrada === 'string').map(idDoCadastro),
      ],
      contratoEscolhido?.clienteId ?? null
    )
  } catch (erro) {
    if (erro instanceof ArquivoDoCadastroRecusado) {
      return NextResponse.json({ detail: erro.message }, { status: erro.status })
    }
    throw erro
  }

  const planilha = await paraArquivo(levantamento)
  const parametros = {
    contrato: contratoEnviado instanceof File ? await paraArquivo(contratoEnviado) : doCadastro.get(contratoDoCadastro!)!,
    levantamento: planilha,
    aditivos: await Promise.all(
      entradas.map((entrada) =>
        entrada instanceof File ? paraArquivo(entrada) : Promise.resolve(doCadastro.get(idDoCadastro(entrada))!)
      )
    ),
    identidadeConfirmada,
  }
  const vinculo = {
    contratoId: contratoEscolhido?.id ?? null,
    competencia: await competenciaDoLevantamento(planilha.bytes),
  }
  const nomes = {
    contrato: parametros.contrato.nome,
    levantamento: levantamento.name,
    aditivos: parametros.aditivos.map((arquivo) => arquivo.nome),
  }
  const entradasDoHistorico = [
    { papel: 'contrato' as const, nome: parametros.contrato.nome, bytes: parametros.contrato.bytes },
    ...parametros.aditivos.map((aditivo) => ({ papel: 'aditivo' as const, nome: aditivo.nome, bytes: aditivo.bytes })),
    { papel: 'levantamento' as const, nome: levantamento.name, bytes: planilha.bytes },
  ]

  // 20/10/2026 — geração assíncrona, quando a tela pede (`assincrono=1`). O
  // Confere recebe os arquivos e devolve um id; a tela consulta
  // `GET /api/confere/reports/<bilhete>` até o resultado ficar pronto, e o
  // histórico é gravado nessa consulta. Nenhuma chamada passa de segundos, e os
  // 300 s da função deixam de cortar a geração — no Render free ela leva minutos.
  // Confere antigo, sem `/jobs`: segue pelo caminho síncrono abaixo.
  if (formData.get('assincrono') === '1') {
    const inicio = await iniciarNoConfere(parametros)
    if (inicio.tipo === 'erro') {
      return NextResponse.json({ detail: inicio.mensagem }, { status: 502 })
    }
    if (inicio.tipo === 'iniciado') {
      const execucao = randomUUID()
      // As entradas vão para o storage **agora**, enquanto o Confere trabalha:
      // a consulta que vai gravar o histórico não tem mais os bytes. Cada uma é
      // independente — a que falhar só some da lista, como no caminho síncrono.
      const guardadas = (
        await Promise.all(
          entradasDoHistorico.map(async (entrada, posicao): Promise<EntradaGuardada | null> => {
            const ehPlanilha = entrada.papel === 'levantamento'
            const nomeNoStorage = `entrada-${posicao}.${ehPlanilha ? 'xlsx' : 'pdf'}`
            try {
              const caminho = await gravar(
                `confere-execucoes/${execucao}/${nomeNoStorage}`,
                `confere/${execucao}/${nomeNoStorage}`,
                entrada.bytes,
                ehPlanilha ? TIPO_XLSX : 'application/pdf'
              )
              return { papel: entrada.papel, nome: entrada.nome, caminho }
            } catch (erro) {
              console.error(`[confere] PDF de entrada "${entrada.nome}" não foi guardado no histórico —`, erro)
              return null
            }
          })
        )
      ).filter((entrada): entrada is EntradaGuardada => entrada !== null)

      const bilhete = emitirBilhete({
        job: inicio.id,
        execucao,
        usuarioId: usuario.id,
        contratoId: vinculo.contratoId,
        competencia: vinculo.competencia,
        nomes,
        entradas: guardadas,
        emitidoEm: Date.now(),
      })
      return NextResponse.json({ execucao: bilhete }, { status: 202 })
    }
  }

  // Desistir do Confere **antes** de a Vercel desistir da função é o que
  // garante que a tela receba uma resposta nossa, com `detail`.
  const tempoLimiteMs = maxDuration * 1000 - FOLGA_DEPOIS_DO_CONFERE_MS - (Date.now() - inicio)
  const resultado = await chamarConfere(parametros, { tempoLimiteMs })

  if (resultado.tipo === 'concluido') {
    // `await` e não fire-and-forget: numa função serverless a resposta
    // encerra a invocação, e trabalho pendente depois dela pode ser cortado
    // no meio — o histórico sairia gravado às vezes. São ~2 uploads sobre uma
    // requisição que já levou ~25s.
    const salvo = await registrarNoHistorico(resultado.resposta, nomes, vinculo, entradasDoHistorico)
    // `historico_salvo` fica fora do que é guardado: é o aviso desta resposta.
    return NextResponse.json({ ...resultado.resposta, historico_salvo: salvo }, { status: 200 })
  }
  if (resultado.tipo === 'bloqueado') {
    return NextResponse.json(resultado.resposta, { status: 422 })
  }
  if (resultado.tipo === 'tempo-esgotado') {
    return NextResponse.json({ detail: MENSAGEM_TEMPO_ESGOTADO }, { status: 504 })
  }
  return NextResponse.json({ detail: resultado.mensagem }, { status: 502 })
}
