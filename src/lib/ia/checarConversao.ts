import { generateObject } from 'ai'
import { z } from 'zod'
import { getModel } from './modelo'

/**
 * Checagem por IA da conversão de PDF — compara o texto ORIGINAL de cada
 * página (extraído pelo `pdf.js`) com o Markdown que a extração
 * determinística gerou pra ela, procurando divergência real de conteúdo.
 * Nunca vê a imagem da página — só texto. Puramente informativo: o score e
 * os trechos suspeitos nunca bloqueiam nada (ver
 * docs/superpowers/specs/2026-09-11-checagem-ia-conversao-design.md).
 */

const schemaPagina = z.object({
  scoreConfianca: z.number().min(0).max(1),
  trechosSuspeitos: z.array(
    z.object({
      trecho: z.string(),
      motivo: z.string(),
    })
  ),
})

export interface TrechoSuspeito {
  pagina: number
  trecho: string
  motivo: string
}

export interface ResultadoChecagem {
  /** 0-99, nunca 100 — teto aplicado no código, não no prompt. `null` quando
   *  não havia nenhuma página checável (documento só de páginas de OCR). */
  scoreExibido: number | null
  trechosSuspeitos: TrechoSuspeito[]
}

export interface PaginaParaChecar {
  pagina: number
  textoOriginal: string
  markdown: string
}

const PROMPT = [
  'Você audita a conversão automática de um PDF pra Markdown.',
  '',
  'Compare o TEXTO ORIGINAL da página com o MARKDOWN GERADO a partir dele.',
  'Aponte SÓ divergência real de conteúdo — texto que sumiu, número ou data',
  'trocado, célula de tabela faltando. NUNCA aponte estilo, escolha de',
  'formatação Markdown (títulos, negrito, listas) ou reordenação cosmética',
  'do texto — isso não é erro de conversão.',
  '',
  '"scoreConfianca": de 0 a 1, quão confiável está essa página (1 = nenhuma',
  'divergência encontrada).',
  '"trechosSuspeitos": um item por divergência encontrada, com "trecho"',
  '(cópia exata de um pedaço do MARKDOWN GERADO onde está o problema) e',
  '"motivo" (curto, em português, explicando a suspeita). Lista vazia se não',
  'achar nada.',
  '',
  'Responda SÓ com o JSON do schema pedido.',
].join('\n')

async function checarPagina(pagina: PaginaParaChecar): Promise<{
  pagina: number
  scoreConfianca: number
  trechosSuspeitos: TrechoSuspeito[]
}> {
  const { object } = await generateObject({
    model: getModel(process.env.AI_REVISAO_MODEL || undefined),
    schema: schemaPagina,
    prompt: `${PROMPT}\n\n---TEXTO ORIGINAL (página ${pagina.pagina})---\n${pagina.textoOriginal}\n\n---MARKDOWN GERADO---\n${pagina.markdown}`,
    maxOutputTokens: 2000,
  })
  return {
    pagina: pagina.pagina,
    scoreConfianca: object.scoreConfianca,
    trechosSuspeitos: object.trechosSuspeitos.map((t) => ({ ...t, pagina: pagina.pagina })),
  }
}

export async function checarConversao(paginas: PaginaParaChecar[]): Promise<ResultadoChecagem> {
  if (paginas.length === 0) return { scoreExibido: null, trechosSuspeitos: [] }

  const resultados = await Promise.allSettled(paginas.map(checarPagina))

  const ok: { pagina: number; scoreConfianca: number; trechosSuspeitos: TrechoSuspeito[] }[] = []
  resultados.forEach((resultado, indice) => {
    if (resultado.status === 'fulfilled') {
      ok.push(resultado.value)
    } else {
      console.error(`checagem por IA: página ${paginas[indice].pagina} falhou, pulando —`, resultado.reason)
    }
  })

  if (ok.length === 0) {
    throw new Error('não foi possível checar nenhuma página da conversão')
  }

  const media = ok.reduce((soma, r) => soma + r.scoreConfianca, 0) / ok.length
  const scoreExibido = Math.min(Math.round(media * 100), 99)
  const trechosSuspeitos = ok.flatMap((r) => r.trechosSuspeitos)

  return { scoreExibido, trechosSuspeitos }
}
