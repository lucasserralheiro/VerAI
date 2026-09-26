import type { PaginaDeTexto } from '@/lib/assistente/indexacao/trechos'

const JANELA_SOBREPOSICAO = 260
const AMOSTRA = 40

/** Cola `proximo` ao fim de `acumulado` sem repetir a sobreposição de ~200 caracteres dos trechos. */
function colar(acumulado: string, proximo: string): string {
  const cauda = acumulado.slice(-JANELA_SOBREPOSICAO)
  const amostra = proximo.slice(0, AMOSTRA)
  for (let i = cauda.indexOf(amostra); i !== -1; i = cauda.indexOf(amostra, i + 1)) {
    const sobreposto = cauda.slice(i)
    if (proximo.startsWith(sobreposto)) return acumulado + proximo.slice(sobreposto.length)
  }
  // Sem sobreposição achada (trecho curto ou corte em espaço): junta separado por espaço.
  return `${acumulado} ${proximo}`
}

/**
 * Texto de cada página a partir dos trechos do índice (`TrechoDocumento`), sem baixar o PDF de novo:
 * o índice já tem o texto reparado e sem caractere de controle. Desfaz a sobreposição do corte.
 */
export function juntarTrechos(trechos: { pagina: number | null; ordem: number; texto: string }[]): PaginaDeTexto[] {
  const ordenados = [...trechos].sort((a, b) => (a.pagina ?? 0) - (b.pagina ?? 0) || a.ordem - b.ordem)
  const paginas: PaginaDeTexto[] = []
  for (const t of ordenados) {
    const ultima = paginas[paginas.length - 1]
    if (ultima && ultima.pagina === t.pagina) ultima.texto = colar(ultima.texto, t.texto)
    else paginas.push({ pagina: t.pagina, texto: t.texto })
  }
  return paginas
}
