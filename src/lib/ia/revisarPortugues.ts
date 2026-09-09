import { generateObject } from 'ai'
import { z } from 'zod'
import { getModel } from './modelo'

/**
 * Revisão ortográfica da Proposta Comercial — a ÚNICA etapa de IA permitida
 * nesse fluxo.
 *
 * A IA NÃO reescreve o documento: ela devolve só uma LISTA de trocas de trecho
 * ({ antes, depois }), e o código aplica cada uma por substituição literal de
 * string. Assim a estrutura (linhas, títulos, tabelas, números) é intocável
 * por construção, e a resposta é curta — muito mais rápida que regerar tudo.
 */

const schema = z.object({
  correcoes: z.array(
    z.object({
      antes: z.string(),
      depois: z.string(),
    })
  ),
})

export interface Correcao {
  antes: string
  depois: string
}

const PROMPT = [
  'Você é um revisor ortográfico de português do Brasil.',
  '',
  'Encontre TODOS os erros de ortografia, acentuação, concordância e digitação',
  'no texto Markdown abaixo. Para cada erro, devolva um item com:',
  '- "antes": o trecho EXATO como aparece no texto, copiado ao pé da letra,',
  '  incluindo de 1 a 3 palavras vizinhas pra o trecho ficar único e',
  '  inconfundível dentro do documento.',
  '- "depois": esse mesmo trecho com APENAS o erro corrigido — as palavras',
  '  vizinhas ficam idênticas.',
  '',
  'Regras rígidas:',
  '- Não corrija o que já está certo. Se não houver nenhum erro, devolva a',
  '  lista "correcoes" vazia.',
  '- NUNCA altere número, data, valor monetário, sigla, nome próprio, e-mail',
  '  nem a marcação Markdown (#, *, |, -).',
  '- Não reescreva frases, não troque palavras por sinônimos, não mude estilo,',
  '  não reordene nada. Só o erro de português.',
  '- "antes" e "depois" não podem conter quebra de linha.',
  '- Responda SÓ com o JSON do schema pedido — nada de texto fora dele.',
  '  Nunca inclua comentário (tipo "// ..."), dúvida, explicação ou',
  '  raciocínio dentro de "antes"/"depois": cada campo é só o trecho puro,',
  '  sem nada a mais. Se ficar em dúvida sobre um trecho, não o inclua.',
].join('\n')

// Tamanho-alvo (em caracteres) de cada pedaço mandado pro modelo numa
// chamada. A Proposta Comercial às vezes é um contrato inteiro — pedir a
// revisão do documento inteiro numa chamada só faz o modelo estourar o
// limite de tokens de saída no meio do JSON (erro "length") e, sob a pressão
// de um texto muito grande de uma vez, ele às vezes passa a "pensar alto"
// dentro do próprio JSON (comentário, dúvida) e quebra o parsing. Pedaços
// menores mantêm a saída de cada chamada curta e o modelo focado.
const TAMANHO_ALVO_BLOCO = 6000

/** Divide o Markdown em blocos de até `tamanhoAlvo` caracteres, cortando só
 *  entre parágrafos (nunca no meio de uma linha/tabela) — cada bloco
 *  continua sendo um trecho literal do documento original, então a busca de
 *  "antes" em `aplicarCorrecoes` funciona igual não importa como foi
 *  dividido. */
export function dividirEmBlocos(markdown: string, tamanhoAlvo = TAMANHO_ALVO_BLOCO): string[] {
  const paragrafos = markdown.split('\n\n')
  const blocos: string[] = []
  let atual = ''
  for (const paragrafo of paragrafos) {
    const candidato = atual ? `${atual}\n\n${paragrafo}` : paragrafo
    if (atual && candidato.length > tamanhoAlvo) {
      blocos.push(atual)
      atual = paragrafo
    } else {
      atual = candidato
    }
  }
  if (atual) blocos.push(atual)
  return blocos.length > 0 ? blocos : [markdown]
}

/** Reparo best-effort pra saída de modelo que "vazou" comentário estilo JS
 *  (`// ...`) dentro do JSON — corta da primeira ocorrência até o fim da
 *  linha, preservando URL (`http://`/`https://`, onde a "//" vem logo após
 *  ":"). Não salva todo tipo de JSON quebrado (ex.: modelo que interrompeu
 *  uma string no meio com aspas soltas), mas cobre o caso comum — o resto
 *  fica protegido pelo `try/catch` por bloco em `revisarPortugues`, que
 *  descarta só o bloco problemático em vez de derrubar a revisão inteira. */
function repararComentarioJson(texto: string): string {
  return texto
    .split('\n')
    .map((linha) => {
      const indice = linha.search(/(?<!:)\/\/(?!\/)/)
      return indice === -1 ? linha : linha.slice(0, indice).trimEnd()
    })
    .join('\n')
}

async function revisarBloco(bloco: string): Promise<Correcao[]> {
  const { object } = await generateObject({
    model: getModel(process.env.AI_REVISAO_MODEL || undefined),
    schema,
    prompt: `${PROMPT}\n\n---\n\n${bloco}`,
    maxOutputTokens: 8000,
    repairText: async ({ text }) => repararComentarioJson(text),
  })
  return object.correcoes
}

export async function revisarPortugues(markdown: string): Promise<string> {
  const blocos = dividirEmBlocos(markdown)
  const resultados = await Promise.allSettled(blocos.map(revisarBloco))

  const correcoes: Correcao[] = []
  let falhas = 0
  resultados.forEach((resultado, indice) => {
    if (resultado.status === 'fulfilled') {
      correcoes.push(...resultado.value)
    } else {
      falhas++
      console.error(
        `revisão de português: bloco ${indice + 1}/${blocos.length} falhou, pulando esse trecho —`,
        resultado.reason
      )
    }
  })

  // Só falha a revisão inteira se NENHUM bloco deu certo — um bloco ruim
  // isolado (ex.: um trecho que fez o modelo alucinar) não deve derrubar a
  // revisão do documento inteiro; o usuário ainda recebe as correções dos
  // blocos que funcionaram.
  if (blocos.length > 0 && falhas === blocos.length) {
    throw new Error('não foi possível revisar nenhum trecho do documento')
  }

  return aplicarCorrecoes(markdown, correcoes)
}

/**
 * Aplica as trocas propostas pela IA por substituição literal, descartando
 * qualquer uma que não seja uma correção segura de palavra:
 * - "antes" curto demais (< 3 caracteres) — risco de casar em todo canto;
 * - "antes"/"depois" com quebra de linha — mudaria a estrutura;
 * - "antes" que não aparece literalmente no texto;
 * - troca que mexe nos dígitos do trecho.
 */
export function aplicarCorrecoes(markdown: string, correcoes: Correcao[]): string {
  let resultado = markdown
  for (const { antes, depois } of correcoes) {
    if (!antes || antes === depois) continue
    if (antes.length < 3) continue
    if (antes.includes('\n') || depois.includes('\n')) continue
    if (!resultado.includes(antes)) continue
    const digitos = (s: string) => (s.match(/\d/g) ?? []).join('')
    if (digitos(antes) !== digitos(depois)) continue
    resultado = resultado.split(antes).join(depois)
  }
  return resultado
}
