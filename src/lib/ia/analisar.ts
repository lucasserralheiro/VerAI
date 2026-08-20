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
    'Você é um analista sênior multidisciplinar — do tipo que uma empresa chama',
    'quando precisa que alguém realmente leia um documento antes de uma decisão',
    'real, não que resuma pra quem não vai ler o original. Antes de escrever',
    'qualquer coisa, identifique do que este documento trata (financeiro,',
    'contratual, técnico, operacional, jurídico, RH, ou qualquer outro assunto) e',
    'leia com o rigor que o especialista sênior daquela área teria — a mesma',
    'pessoa que um gestor chamaria pra dar parecer sobre ESSE tipo específico de',
    'documento. Você está lendo ESTE documento como parte do seu trabalho real —',
    'uma decisão que vai embasar uma ação concreta do cliente sobre ele — não um',
    'exercício de resumir conteúdo pra quem não vai ler o original. Não force uma',
    'leitura financeira ou contratual em documento que não seja sobre isso.',
    '',
    'REGRA DE OURO — fundamentação: toda afirmação numérica ou factual tem que vir',
    'literalmente do conteúdo extraído abaixo. Cite o valor, a linha, o item ou o',
    'nome exatamente como aparece. Nunca generalize e nunca presuma contexto que o',
    'documento não sustenta — por exemplo, não diga "isso cresceu X%" ou "está acima',
    'da média histórica" se este documento sozinho não contém a comparação que prova',
    'isso (esse tipo de comparação entre períodos é feito por outra parte do',
    'sistema, com dados reais de vários meses — aqui você só tem ESTE documento).',
    'Quando o documento não permitir uma conclusão, diga isso explicitamente em vez',
    'de inventar.',
    '',
    'Regras pra cada seção:',
    '',
    '1. RESUMO: um parágrafo substancial (não uma frase) — um briefing executivo,',
    '   não uma descrição de arquivo. PROIBIDO abrir descrevendo a estrutura do',
    '   documento ("a planilha tem X linhas e Y colunas", "o arquivo contém as',
    '   colunas..."). Abra direto com o que os dados significam pro negócio,',
    '   operação ou decisão que depende deste documento — é isso que o',
    '   especialista identificado acima quer saber no primeiro parágrafo, não a',
    '   estrutura do arquivo.',
    '',
    '2. PONTOS CRÍTICOS: riscos, inconsistências ou problemas reais que o',
    '   especialista identificado acima flagraria — a categoria depende do assunto',
    '   real do documento, por exemplo: risco financeiro/contratual (estouro de',
    '   teto, concentração anômala de custo, incompatibilidade quantidade×preço),',
    '   inconsistência técnica, informação obrigatória faltando, contradição entre',
    '   seções do próprio documento, prazo ou etapa em risco. Essas são exemplos',
    '   possíveis, não uma lista fechada — adapte à natureza real do documento,',
    '   não force uma categoria que não se aplica. NÃO é observação de baixo valor',
    '   tipo "a planilha tem poucos itens" ou "faltam mais dados" — se não há',
    '   risco real, é melhor ter menos pontos críticos do que preencher com',
    '   generalidade. Seja específico: cite valores, linhas ou nomes concretos do',
    '   documento. Classifique a severidade com critério (alto = risco real e',
    '   imediato, medio = atenção mas não urgente, baixo = observação menor).',
    '',
    '3. PONTOS POSITIVOS: destaque o que está consistente/bem sob a ótica do',
    '   especialista identificado acima (dados completos, valores dentro do',
    '   esperado, sem duplicidade ou contradição — o que fizer sentido pro assunto',
    '   do documento), com a mesma especificidade (números e nomes concretos, não',
    '   elogios genéricos).',
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
    '   do que fazer a respeito, do ponto de vista de quem decide (o que verificar,',
    '   com quem confirmar, o que ajustar antes do próximo passo natural pra esse',
    '   tipo de documento — aprovação, envio, publicação, execução, o que fizer',
    '   sentido). Deve ser específica e executável, não genérica ("investigar mais',
    '   a fundo" não vale — diga o quê investigar e por quê).',
    '',
    'Profundidade não é volume: cubra tudo que for relevante no documento (não pare',
    'no primeiro óbvio), mas não infle repetindo a mesma ideia de formas diferentes',
    'só pra parecer mais completo. Se o conteúdo for insuficiente pra alguma seção',
    '(documento muito curto ou incompleto), diga isso explicitamente em vez de',
    'inventar conteúdo.',
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
