export interface ItemPosicionado {
  x: number
  width: number
}

export interface LinhaPosicionada {
  itens: ItemPosicionado[]
}

export interface Intervalo {
  inicio: number
  fim: number
}

/** Em quantas linhas do bloco o corredor precisa aparecer como espaço ENTRE
 *  dois trechos de texto — e não como sobra à direita de uma linha curta, que
 *  toda última linha de parágrafo tem. */
const LINHAS_PARA_CONFIRMAR_CORREDOR = 2

function intervalosOcupados(linha: LinhaPosicionada): Intervalo[] {
  return linha.itens
    .map((item) => ({ inicio: item.x, fim: item.x + item.width }))
    .sort((a, b) => a.inicio - b.inicio)
}

/** Recorta de `livres` tudo que `ocupados` cobre — o que sobra é espaço em
 *  branco. */
function subtrairIntervalos(livres: Intervalo[], ocupados: Intervalo[]): Intervalo[] {
  let resultado = livres
  for (const ocupado of ocupados) {
    const proximo: Intervalo[] = []
    for (const livre of resultado) {
      if (ocupado.fim <= livre.inicio || ocupado.inicio >= livre.fim) {
        proximo.push(livre)
        continue
      }
      if (ocupado.inicio > livre.inicio) proximo.push({ inicio: livre.inicio, fim: ocupado.inicio })
      if (ocupado.fim < livre.fim) proximo.push({ inicio: ocupado.fim, fim: livre.fim })
    }
    resultado = proximo
  }
  return resultado
}

/** O corredor é espaço ENTRE textos nesta linha (tem conteúdo dos dois lados),
 *  e não a sobra à direita de uma linha que simplesmente acabou antes. */
function ehEspacoEntreTextos(corredor: Intervalo, linha: LinhaPosicionada): boolean {
  const ocupados = intervalosOcupados(linha)
  return ocupados.some((item) => item.fim <= corredor.inicio) && ocupados.some((item) => item.inicio >= corredor.fim)
}

/**
 * Corredores verticais que atravessam TODAS as linhas do bloco sem encostar em
 * texto nenhum — é isso que separa coluna de tabela de espaço esticado de
 * parágrafo justificado.
 *
 * Num parágrafo justificado os vãos entre palavras são largos, mas caem num X
 * diferente a cada linha; empilhadas, uma linha tapa o vão da outra e não sobra
 * corredor. Numa tabela as colunas ficam sempre no mesmo lugar, então o
 * corredor atravessa o bloco inteiro de cima a baixo.
 *
 * O corredor ainda precisa ser espaço entre textos em pelo menos duas linhas
 * (`LINHAS_PARA_CONFIRMAR_CORREDOR`): sem isso, a área vazia à direita das
 * linhas curtas de um parágrafo comum viraria "coluna".
 *
 * Extraído de `pdfHtml.ts` (heurística original pro PDF nativo, calibrada
 * contra `scripts/diagnostico-conversao.mts`) pra ser reaproveitado também
 * pela reconstrução de tabela do OCR (`tabelaPorPosicaoOcr.ts`) — mesmo
 * princípio geométrico, fonte de posição diferente (ponto de PDF vs. pixel
 * de canvas renderizado).
 */
export function corredoresDoBloco(linhas: LinhaPosicionada[], larguraMinima: number): Intervalo[] {
  const inicios = linhas.flatMap((linha) => linha.itens.map((item) => item.x))
  const fins = linhas.flatMap((linha) => linha.itens.map((item) => item.x + item.width))
  if (inicios.length === 0) return []

  let livres: Intervalo[] = [{ inicio: Math.min(...inicios), fim: Math.max(...fins) }]
  for (const linha of linhas) livres = subtrairIntervalos(livres, intervalosOcupados(linha))

  return livres.filter((corredor) => {
    if (corredor.fim - corredor.inicio < larguraMinima) return false
    const confirmacoes = linhas.filter((linha) => ehEspacoEntreTextos(corredor, linha)).length
    return confirmacoes >= LINHAS_PARA_CONFIRMAR_CORREDOR
  })
}
