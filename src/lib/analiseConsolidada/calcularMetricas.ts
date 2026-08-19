export interface MetricaDocumento {
  documentoId: string
  nomeArquivo: string
  label: string
  valorNumerico: number | null
  unidade: string | null
  valorExibicao: string
}

export interface MetricaComparada {
  label: string
  valores: Array<{ documentoId: string; nomeArquivo: string; valorNumerico: number | null; valorExibicao: string }>
  divergencia: {
    minimo: number
    maximo: number
    diferencaAbsoluta: number
    diferencaPercentual: number | null
  } | null
}

function normalizarLabel(label: string): string {
  return label.trim().toLowerCase()
}

export function calcularMetricasComparadas(metricas: MetricaDocumento[]): MetricaComparada[] {
  const grupos = new Map<string, { labelOriginal: string; valores: MetricaComparada['valores'] }>()

  for (const metrica of metricas) {
    const chave = normalizarLabel(metrica.label)
    const grupo = grupos.get(chave) ?? { labelOriginal: metrica.label, valores: [] }
    grupo.valores.push({
      documentoId: metrica.documentoId,
      nomeArquivo: metrica.nomeArquivo,
      valorNumerico: metrica.valorNumerico,
      valorExibicao: metrica.valorExibicao,
    })
    grupos.set(chave, grupo)
  }

  return [...grupos.values()].map((grupo) => {
    const numericos = grupo.valores.map((v) => v.valorNumerico).filter((v): v is number => v !== null)

    let divergencia: MetricaComparada['divergencia'] = null
    if (numericos.length >= 2) {
      const minimo = Math.min(...numericos)
      const maximo = Math.max(...numericos)
      const diferencaAbsoluta = maximo - minimo
      divergencia = {
        minimo,
        maximo,
        diferencaAbsoluta,
        diferencaPercentual: minimo !== 0 ? diferencaAbsoluta / Math.abs(minimo) : null,
      }
    }

    return { label: grupo.labelOriginal, valores: grupo.valores, divergencia }
  })
}
