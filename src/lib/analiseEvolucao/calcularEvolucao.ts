export interface MetricaDocumento {
  documentoId: string
  nomeArquivo: string
  label: string
  valorNumerico: number | null
  unidade: string | null
  valorExibicao: string
}

export interface MetricaEvoluida {
  label: string
  valorAtual: number | null
  valorAnterior: number | null
  deltaAbsoluto: number | null
  deltaPercentual: number | null
  status: 'novo' | 'removido' | 'estavel' | 'alta' | 'baixa'
}

const LIMIAR_VARIACAO_SIGNIFICATIVA = 0.05 // 5%

function somarPorLabel(metricas: MetricaDocumento[]): Map<string, { total: number | null; labelOriginal: string }> {
  const somas = new Map<string, { total: number | null; labelOriginal: string }>()
  for (const m of metricas) {
    const chave = m.label.trim().toLowerCase()
    const atual = somas.get(chave)
    if (m.valorNumerico === null) {
      if (!atual) somas.set(chave, { total: null, labelOriginal: m.label })
      continue
    }
    somas.set(chave, {
      total: atual?.total == null ? m.valorNumerico : atual.total + m.valorNumerico,
      labelOriginal: atual?.labelOriginal ?? m.label,
    })
  }
  return somas
}

export function calcularEvolucao(
  metricasAtual: MetricaDocumento[],
  metricasAnterior: MetricaDocumento[]
): MetricaEvoluida[] {
  const somasAtual = somarPorLabel(metricasAtual)
  const somasAnterior = somarPorLabel(metricasAnterior)
  const chaves = new Set([...somasAtual.keys(), ...somasAnterior.keys()])

  return [...chaves].map((chave) => {
    const grupoAtual = somasAtual.get(chave)
    const grupoAnterior = somasAnterior.get(chave)
    const label = grupoAtual?.labelOriginal ?? grupoAnterior?.labelOriginal ?? chave

    if (!grupoAtual) {
      return {
        label,
        valorAtual: null,
        valorAnterior: grupoAnterior!.total,
        deltaAbsoluto: null,
        deltaPercentual: null,
        status: 'removido' as const,
      }
    }
    if (!grupoAnterior) {
      return {
        label,
        valorAtual: grupoAtual.total,
        valorAnterior: null,
        deltaAbsoluto: null,
        deltaPercentual: null,
        status: 'novo' as const,
      }
    }
    if (grupoAtual.total === null || grupoAnterior.total === null) {
      return {
        label,
        valorAtual: grupoAtual.total,
        valorAnterior: grupoAnterior.total,
        deltaAbsoluto: null,
        deltaPercentual: null,
        status: 'estavel' as const,
      }
    }

    const deltaAbsoluto = grupoAtual.total - grupoAnterior.total
    const deltaPercentual = grupoAnterior.total !== 0 ? deltaAbsoluto / Math.abs(grupoAnterior.total) : null

    let status: MetricaEvoluida['status'] = 'estavel'
    if (deltaPercentual !== null) {
      if (deltaPercentual > LIMIAR_VARIACAO_SIGNIFICATIVA) status = 'alta'
      else if (deltaPercentual < -LIMIAR_VARIACAO_SIGNIFICATIVA) status = 'baixa'
    } else if (deltaAbsoluto !== 0) {
      status = deltaAbsoluto > 0 ? 'alta' : 'baixa'
    }

    return {
      label,
      valorAtual: grupoAtual.total,
      valorAnterior: grupoAnterior.total,
      deltaAbsoluto,
      deltaPercentual,
      status,
    }
  })
}
