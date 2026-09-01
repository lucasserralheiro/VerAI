import { generateText } from 'ai'
import { getModel } from './modelo'

/**
 * Revisão ortográfica da Proposta Comercial — a ÚNICA etapa de IA permitida
 * nesse fluxo. Corrige só ortografia e acentuação; não reescreve, não mexe em
 * número nem em estrutura. O resultado nunca é aplicado sozinho: o endpoint
 * roda um guardrail e a UI mostra o diff pro usuário aceitar ou recusar.
 */
const PROMPT = [
  'Você é um revisor ortográfico de português do Brasil, não um editor de texto.',
  '',
  'Sua ÚNICA tarefa é corrigir erros de ortografia, acentuação, concordância e',
  'digitação no texto abaixo, que está em Markdown.',
  '',
  'É PROIBIDO:',
  '- reescrever, reformular ou "melhorar" frases que já estão gramaticalmente corretas;',
  '- reordenar, resumir, expandir ou traduzir qualquer trecho;',
  '- adicionar ou remover qualquer informação, frase, item ou parágrafo;',
  '- alterar qualquer número, data, valor monetário, sigla, nome próprio ou e-mail;',
  '- alterar a marcação Markdown: mantenha exatamente os mesmos #, **, |, -, as',
  '  mesmas quebras de linha e as mesmas linhas em branco.',
  '',
  'Se uma frase já está correta, copie-a sem nenhuma mudança. Se o texto inteiro',
  'já está correto, devolva-o idêntico.',
  '',
  'Responda SOMENTE com o Markdown corrigido — sem comentários, sem explicação e',
  'sem cercas de código ``` ao redor.',
].join('\n')

export async function revisarPortugues(markdown: string): Promise<string> {
  const { text } = await generateText({
    model: getModel(),
    prompt: `${PROMPT}\n\n---\n\n${markdown}`,
  })
  return removerCercas(text)
}

function removerCercas(texto: string): string {
  const aparado = texto.trim()
  const comCerca = aparado.match(/^```(?:markdown|md)?\n([\s\S]*?)\n```$/)
  return comCerca ? comCerca[1] : aparado
}
