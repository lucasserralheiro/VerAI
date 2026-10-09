import type { LinhaDaAba } from './levantamento'

export type TipoDeLinha = 'titulo' | 'cabecalho' | 'dado' | 'alvo' | 'lacuna'

export interface LinhaDoTrecho {
  tipo: TipoDeLinha
  /** Número da linha na aba; ausente na `lacuna`. */
  linha?: number
  celulas: string[]
}

const SEM_ESPACO = (texto: string) => texto.replace(/\s+/g, '')
const SEM_ACENTO = (texto: string) => texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
const CODIGO_DE_SERVICO = /^\d+\.\d{3}\.\d{5}\.\d{2}$/

const VIZINHAS = 2
const MAXIMO_DE_OCORRENCIAS = 3

function preenchidas(linha: LinhaDaAba): string[] {
  return linha.celulas.filter((celula) => celula !== '')
}

/** Título de seção: o mesmo texto repetido pela linha (célula mesclada). */
function ehTitulo(linha: LinhaDaAba): boolean {
  const textos = preenchidas(linha)
  return textos.length >= 2 && new Set(textos).size === 1
}

/** Cabeçalho de tabela de itens: tem "Código" e "Quantidade". */
function ehCabecalho(linha: LinhaDaAba): boolean {
  const texto = SEM_ACENTO(linha.celulas.join(' '))
  return texto.includes('codigo') && texto.includes('quantidade')
}

function comoLinha(tipo: TipoDeLinha, linha: LinhaDaAba): LinhaDoTrecho {
  return { tipo, linha: linha.linha, celulas: linha.celulas }
}

/** O trecho da planilha em que o código aparece: o título da seção, o cabeçalho da tabela, duas linhas
 *  de cada lado e a linha do item. Uma lista por ocorrência — o código pode estar em mais de uma seção
 *  (a apuração bruta e a descontada, por exemplo). Vazio quando o código não está na aba. */
export function trechoDoItem(linhas: LinhaDaAba[], codigo: string): LinhaDoTrecho[][] {
  const procurado = SEM_ESPACO(codigo)
  const alvos = linhas
    .map((linha, indice) => (linha.celulas.some((celula) => SEM_ESPACO(celula) === procurado) ? indice : -1))
    .filter((indice) => indice >= 0)
    .slice(0, MAXIMO_DE_OCORRENCIAS)

  return alvos.map((alvo) => {
    let cabecalho = -1
    for (let i = alvo - 1; i >= 0; i--) {
      if (ehCabecalho(linhas[i])) {
        cabecalho = i
        break
      }
      // Passou por outra seção antes de achar um cabeçalho: o item não tem tabela própria.
      if (ehTitulo(linhas[i])) break
    }

    const trecho: LinhaDoTrecho[] = []
    if (cabecalho > 0) {
      const acima = linhas[cabecalho - 1]
      if (!preenchidas(acima).some((celula) => CODIGO_DE_SERVICO.test(SEM_ESPACO(celula)))) {
        trecho.push(comoLinha('titulo', acima))
      }
    }
    if (cabecalho >= 0) trecho.push(comoLinha('cabecalho', linhas[cabecalho]))

    const primeira = Math.max(alvo - VIZINHAS, cabecalho + 1, 0)
    if (cabecalho >= 0 && primeira > cabecalho + 1) trecho.push({ tipo: 'lacuna', celulas: [] })
    for (let i = primeira; i < alvo; i++) trecho.push(comoLinha('dado', linhas[i]))
    trecho.push(comoLinha('alvo', linhas[alvo]))
    for (let i = alvo + 1; i <= Math.min(alvo + VIZINHAS, linhas.length - 1); i++) {
      // A seção seguinte não é vizinha do item.
      if (ehTitulo(linhas[i]) || ehCabecalho(linhas[i])) break
      trecho.push(comoLinha('dado', linhas[i]))
    }
    return trecho
  })
}
