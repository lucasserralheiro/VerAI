import type { LanguageModel } from 'ai'
import type { OrigemTrecho } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { configuracaoDoAssistente } from '@/lib/assistente/configuracao'
import { NOMES_CAMPOS, type CamposFicha, type NomeCampo } from './campos'
import { lerComIa } from './ia'
import { juntarTrechos } from './paginas'
import { camposPorRegra } from './regras'

export const ORIGENS_FICHA: OrigemTrecho[] = ['HISTORICO_PROPOSTA', 'HISTORICO_TERMO']
const TIPOS_COM_ALTERACOES = new Set(['ADITIVO', 'PRORROGACAO'])

export interface ResumoFichas {
  porRegra: number
  comIa: number
  parciais: number
  semTexto: number
  erros: number
  tokens: number
  restantes: number
}

/** Campos que valem para o tipo da linha: "o que mudou" só em aditivo e prorrogação. */
export const camposDoTipo = (tipoLinha: string): NomeCampo[] => NOMES_CAMPOS.filter((n) => n !== 'alteracoes' || TIPOS_COM_ALTERACOES.has(tipoLinha))

/**
 * Gera a ficha dos PDFs do histórico que ainda não têm ficha da versão atual do índice (spec fase 2
 * §5.3). Regra primeiro; IA uma vez só para o que faltou, se `comIa`. Um erro não para o lote.
 */
export async function gerarFichasPendentes(
  opcoes: { limite?: number; comIa?: boolean; modelo?: LanguageModel; ler?: typeof lerComIa } = {}
): Promise<ResumoFichas> {
  const { limite = 50, comIa = true, modelo, ler = lerComIa } = opcoes
  const [indices, fichas] = await Promise.all([
    prisma.indiceDocumento.findMany({
      where: { origem: { in: ORIGENS_FICHA }, status: { in: ['ok', 'sem_texto'] } },
      select: { origem: true, origemId: true, versao: true, status: true },
    }),
    prisma.fichaDocumento.findMany({ where: { origem: { in: ORIGENS_FICHA } }, select: { origem: true, origemId: true, versao: true } }),
  ])
  const versaoDaFicha = new Map(fichas.map((f) => [`${f.origem}:${f.origemId}`, f.versao]))
  const pendentes = indices.filter((i) => {
    const chave = `${i.origem}:${i.origemId}`
    return !versaoDaFicha.has(chave) || versaoDaFicha.get(chave) !== i.versao
  })
  const lote = pendentes.slice(0, limite)
  const resumo: ResumoFichas = { porRegra: 0, comIa: 0, parciais: 0, semTexto: 0, erros: 0, tokens: 0, restantes: pendentes.length - lote.length }
  if (lote.length === 0) return resumo

  const tipos = new Map(
    (await prisma.historicoContrato.findMany({ where: { id: { in: lote.map((i) => i.origemId) } }, select: { id: true, tipo: true } })).map((h) => [h.id, h.tipo])
  )
  const nomeDoModelo = configuracaoDoAssistente()?.modelo ?? null

  for (const indice of lote) {
    const chave = { origem: indice.origem, origemId: indice.origemId }
    const gravar = (dados: { campos: CamposFicha; status: string; mensagem?: string; modelo?: string | null; tokensEntrada?: number; tokensSaida?: number }) =>
      prisma.fichaDocumento.upsert({
        where: { origem_origemId: chave },
        create: { ...chave, versao: indice.versao, geradaEm: new Date(), ...dados, campos: dados.campos as object },
        update: { versao: indice.versao, geradaEm: new Date(), mensagem: null, modelo: null, tokensEntrada: null, tokensSaida: null, ...dados, campos: dados.campos as object },
      })
    try {
      if (indice.status === 'sem_texto') {
        await gravar({ campos: {}, status: 'sem_texto' })
        resumo.semTexto++
        continue
      }
      const tipoLinha = tipos.get(indice.origemId) ?? 'CONTRATO'
      const trechos = await prisma.trechoDocumento.findMany({ where: chave, select: { pagina: true, ordem: true, texto: true } })
      const paginas = juntarTrechos(trechos)
      const porRegra = camposPorRegra(paginas, tipoLinha)
      const aplicaveis = camposDoTipo(tipoLinha)
      const faltando = aplicaveis.filter((n) => !porRegra[n])

      let campos: CamposFicha = porRegra
      let tokensEntrada: number | undefined
      let tokensSaida: number | undefined
      let naoConfirmados: string[] = []
      if (comIa && faltando.length > 0) {
        const lido = await ler({ paginas, faltando, tipoLinha, modelo })
        campos = { ...porRegra, ...lido.campos }
        tokensEntrada = lido.tokensEntrada
        tokensSaida = lido.tokensSaida
        naoConfirmados = lido.descartados
        resumo.tokens += (tokensEntrada ?? 0) + (tokensSaida ?? 0)
        resumo.comIa++
      } else {
        resumo.porRegra++
      }
      const parcial = aplicaveis.some((n) => !campos[n])
      if (parcial) resumo.parciais++
      await gravar({
        campos,
        status: parcial ? 'parcial' : 'ok',
        // A IA achou, mas o trecho não se confirmou no texto: a ferramenta mostra "não confirmado".
        ...(naoConfirmados.length ? { mensagem: `não confirmados: ${naoConfirmados.join(', ')}` } : {}),
        modelo: tokensEntrada !== undefined ? nomeDoModelo : null,
        tokensEntrada,
        tokensSaida,
      })
    } catch (erro) {
      resumo.erros++
      const mensagem = (erro instanceof Error ? erro.message : String(erro)).slice(0, 500)
      try {
        await gravar({ campos: {}, status: 'erro', mensagem })
      } catch (erroGravacao) {
        console.error('[assistente] falha ao registrar erro da ficha', indice.origem, indice.origemId, mensagem, erroGravacao)
      }
    }
  }
  return resumo
}
