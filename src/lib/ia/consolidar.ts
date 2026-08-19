import { generateObject } from 'ai'
import { z } from 'zod'
import { getModel } from './modelo'
import type { MetricaComparada } from '@/lib/analiseConsolidada/calcularMetricas'

const schema = z.object({
  resumo: z.string(),
  pontosCriticos: z.array(
    z.object({ texto: z.string(), severidade: z.enum(['alto', 'medio', 'baixo']) })
  ),
  pontosPositivos: z.array(z.object({ texto: z.string() })),
  recomendacoes: z.array(z.string()).nullable(),
})

interface ResumoDocumento {
  nomeArquivo: string
  resumo: string
}

function montarPrompt(resumos: ResumoDocumento[], metricasComparadas: MetricaComparada[]): string {
  const listaResumos = resumos
    .map((r, i) => `Documento ${i + 1} — ${r.nomeArquivo}:\n${r.resumo}`)
    .join('\n\n')

  const listaMetricas = metricasComparadas
    .map((m) => {
      const valores = m.valores.map((v) => `${v.nomeArquivo}: ${v.valorExibicao}`).join(' | ')
      const divergencia = m.divergencia
        ? ` (divergência: ${m.divergencia.diferencaAbsoluta} absoluto${
            m.divergencia.diferencaPercentual !== null
              ? `, ${(m.divergencia.diferencaPercentual * 100).toFixed(1)}%`
              : ''
          })`
        : ''
      return `- ${m.label}: ${valores}${divergencia}`
    })
    .join('\n')

  return [
    'Você é um analista sênior de faturamento revisando um CONJUNTO de documentos do',
    'mesmo cliente e mesma competência (mês) que precisam ser consolidados num só',
    'relatório.',
    '',
    'IMPORTANTE: as métricas abaixo já foram extraídas e comparadas matematicamente',
    'em código — os números e as divergências já estão calculados. Você NUNCA deve',
    'recalcular, estimar ou arredondar de forma diferente do que está escrito. Sua',
    'tarefa é só interpretar esses números prontos e escrever a análise.',
    '',
    'Resumos individuais de cada documento selecionado:',
    listaResumos,
    '',
    'Métricas já comparadas entre os documentos (label: valor de cada documento,',
    'com a divergência entre eles quando há mais de um valor numérico):',
    listaMetricas || '(nenhuma métrica numérica em comum entre os documentos)',
    '',
    'Produza:',
    '1. RESUMO: um parágrafo consolidando o que esse conjunto de documentos mostra',
    '   no geral pra esse cliente/competência.',
    '2. PONTOS CRÍTICOS: problemas, riscos ou divergências relevantes — cite as',
    '   divergências de métrica fornecidas acima quando forem significativas.',
    '3. PONTOS POSITIVOS: o que está consistente/bem entre os documentos.',
    '4. RECOMENDAÇÕES: uma ação prática por ponto crítico relevante.',
  ].join('\n')
}

export async function analisarConsolidado(
  resumos: ResumoDocumento[],
  metricasComparadas: MetricaComparada[],
  promptVersion: string
) {
  const { object } = await generateObject({
    model: getModel(),
    schema,
    prompt: montarPrompt(resumos, metricasComparadas),
  })
  return { ...object, promptVersion }
}
