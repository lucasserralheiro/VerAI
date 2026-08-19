import { generateObject } from 'ai'
import { z } from 'zod'
import { getModel } from './modelo'

export const PROMPT_VERSION_ATUAL = 'v1'

const schema = z.object({
  resumo: z.string(),
  pontosCriticos: z.array(
    z.object({
      texto: z.string(),
      severidade: z.enum(['alto', 'medio', 'baixo']),
    })
  ),
  pontosPositivos: z.array(z.object({ texto: z.string() })),
  // .nullable() em vez de .optional(): alguns provedores (Groq, OpenAI-compatíveis)
  // usam saída estruturada em modo estrito, que exige todo campo em "required" —
  // mesmo quando pode ser vazio. Precisa vir null, não ausente.
  metricasChave: z
    .array(
      z.object({
        label: z.string(),
        valorNumerico: z.number().nullable(),
        unidade: z.string().nullable(),
        valorExibicao: z.string(),
      })
    )
    .nullable(),
  recomendacoes: z.array(z.string()).nullable(),
})

function montarPrompt(conteudoExtraido: string): string {
  return [
    'Você é um analista sênior que revisa documentos internos e produz um relatório',
    'estruturado, detalhado e acionável — não um resumo superficial.',
    '',
    'Regras pra cada seção:',
    '',
    '1. RESUMO: um parágrafo substancial (não uma frase). Cubra o que o documento é,',
    '   o que ele mostra no geral e o contexto necessário pra alguém que não abriu',
    '   o arquivo entender do que se trata.',
    '',
    '2. PONTOS CRÍTICOS: liste TODOS os problemas, riscos, inconsistências ou',
    '   anomalias reais que você conseguir identificar nos dados — não invente só',
    '   pra preencher, mas também não pare no primeiro óbvio. Seja específico:',
    '   cite valores, linhas ou nomes concretos do documento, não generalidades.',
    '   Classifique a severidade com critério (alto = risco real e imediato,',
    '   medio = atenção mas não urgente, baixo = observação menor).',
    '',
    '3. PONTOS POSITIVOS: destaque o que está bem, com a mesma especificidade',
    '   (números e nomes concretos, não elogios genéricos).',
    '',
    '4. MÉTRICAS-CHAVE: liste as métricas numéricas mais relevantes presentes no',
    '   conteúdo extraído (totais, médias, proporções, contagens já calculadas no',
    '   texto). Para cada uma, informe "valorNumerico" com o número exatamente',
    '   como aparece no texto extraído — nunca estime, arredonde ou invente um',
    '   valor que não esteja lá; se não houver um número exato pra essa métrica,',
    '   deixe "valorNumerico" null e descreva só em "valorExibicao". Preencha',
    '   "unidade" quando fizer sentido (ex: "BRL", "%", "GB", null se não houver)',
    '   e "valorExibicao" formatado como deve aparecer pro leitor (ex:',
    '   "R$ 11.200,00").',
    '',
    '5. RECOMENDAÇÕES: pra cada ponto crítico relevante, uma recomendação prática',
    '   do que fazer a respeito. Deve ser específica e executável, não genérica',
    '   ("investigar mais a fundo" não vale — diga o quê investigar e por quê).',
    '',
    'Se o conteúdo for insuficiente pra alguma seção (ex: documento muito curto),',
    'diga isso explicitamente em vez de inventar conteúdo.',
    '',
    'Conteúdo extraído do documento:',
    conteudoExtraido,
  ].join('\n')
}

export async function analisarDocumento(conteudoExtraido: string, promptVersion: string) {
  const { object } = await generateObject({
    model: getModel(),
    schema,
    prompt: montarPrompt(conteudoExtraido),
  })
  return { ...object, promptVersion }
}
