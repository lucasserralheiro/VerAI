import { generateObject } from 'ai'
import { z } from 'zod'
import { getModel } from './modelo'
import type { MetricaEvoluida } from '@/lib/analiseEvolucao/calcularEvolucao'

const schema = z.object({
  resumo: z.string(),
  pontosAtencao: z.array(z.object({ texto: z.string() })),
  melhorias: z.array(z.object({ texto: z.string() })),
})

function montarPrompt(
  metricas: MetricaEvoluida[],
  competenciaAtual: string,
  competenciaAnterior: string
): string {
  const linhas = metricas
    .map((m) => {
      const delta =
        m.deltaPercentual !== null
          ? `${(m.deltaPercentual * 100).toFixed(1)}%`
          : m.deltaAbsoluto !== null
            ? `${m.deltaAbsoluto} (absoluto)`
            : '—'
      return `- ${m.label}: ${competenciaAnterior}=${m.valorAnterior ?? '—'} → ${competenciaAtual}=${m.valorAtual ?? '—'} (variação: ${delta}, status: ${m.status})`
    })
    .join('\n')

  return [
    'Você é um analista sênior multidisciplinar comparando duas competências (meses)',
    `consecutivas do mesmo cliente: ${competenciaAnterior} (anterior) vs. ${competenciaAtual} (atual) — leia`,
    'com o rigor que o especialista sênior do assunto real desses dados teria, sem',
    'presumir de antemão que é um assunto financeiro/contratual.',
    '',
    'IMPORTANTE: os valores e variações abaixo já foram somados e calculados em',
    'código a partir dos documentos reais de cada mês — você NUNCA deve recalcular,',
    'estimar ou arredondar de forma diferente do que está escrito. Sua tarefa é só',
    'interpretar esses números prontos.',
    '',
    'Métricas comparadas (rótulo: valor anterior → valor atual, variação, status',
    '"novo"/"removido"/"estavel"/"alta"/"baixa"):',
    linhas || '(nenhuma métrica em comum entre as duas competências)',
    '',
    'Produza:',
    '1. RESUMO: um parágrafo sobre a evolução geral do cliente entre os dois meses.',
    '2. PONTOS DE ATENÇÃO: as altas (status "alta") ou métricas novas relevantes —',
    '   cite o número real da variação.',
    '3. MELHORIAS: as baixas (status "baixa") ou reduções relevantes.',
  ].join('\n')
}

export async function analisarEvolucao(
  metricas: MetricaEvoluida[],
  competenciaAtual: string,
  competenciaAnterior: string,
  promptVersion: string
) {
  const { object } = await generateObject({
    model: getModel(),
    schema,
    prompt: montarPrompt(metricas, competenciaAtual, competenciaAnterior),
  })
  return { ...object, promptVersion }
}
