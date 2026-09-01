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
].join('\n')

export async function revisarPortugues(markdown: string): Promise<string> {
  const { object } = await generateObject({
    model: getModel(process.env.AI_REVISAO_MODEL || undefined),
    schema,
    prompt: `${PROMPT}\n\n---\n\n${markdown}`,
  })
  return aplicarCorrecoes(markdown, object.correcoes)
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
