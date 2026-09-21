import { corredoresDoBloco, type LinhaPosicionada } from '../extracao/corredores'
import { montarTabelaHtml } from '../extracao/pdfHtml'
import { escaparHtml } from '../extracao/escaparHtml'
import type { PalavraReconhecidaOcr } from './rodarOcr'

/** Diferença máxima de Y (em pixels do canvas renderizado, escala 4 — ver
 *  `ESCALA_RENDER_OCR` em depsOcrPadrao.ts) pra duas palavras contarem como
 *  a MESMA linha. Não medido contra um corpus de página escaneada real
 *  (mesma ressalva de `TOLERANCIA_MESMA_LINHA` em pdfHtml.ts, que é o
 *  equivalente calibrado pro PDF nativo, em pontos em vez de pixels);
 *  ajustar com cautela se `ESCALA_RENDER_OCR` mudar. */
const TOLERANCIA_MESMA_LINHA_PX = 16

/** Largura mínima (em pixels) de um corredor vertical vazio pra virar
 *  separação de coluna — mesmo princípio de `LARGURA_MINIMA_CORREDOR` em
 *  pdfHtml.ts, em pixels de canvas em vez de pontos de PDF (OCR não tem
 *  acesso à coordenada de ponto do PDF original, só ao bitmap renderizado). */
const LARGURA_MINIMA_CORREDOR_PX = 48

function agruparEmLinhas(palavras: PalavraReconhecidaOcr[]): PalavraReconhecidaOcr[][] {
  const ordenadas = [...palavras].sort((a, b) => a.y - b.y || a.x - b.x)
  const linhas: PalavraReconhecidaOcr[][] = []
  for (const palavra of ordenadas) {
    const ultima = linhas[linhas.length - 1]
    if (ultima && Math.abs(ultima[0].y - palavra.y) <= TOLERANCIA_MESMA_LINHA_PX) {
      ultima.push(palavra)
    } else {
      linhas.push([palavra])
    }
  }
  return linhas.map((linha) => [...linha].sort((a, b) => a.x - b.x))
}

function paraLinhaPosicionada(linha: PalavraReconhecidaOcr[]): LinhaPosicionada {
  return { itens: linha.map((p) => ({ x: p.x, width: p.largura })) }
}

function linhaParaColunas(linha: PalavraReconhecidaOcr[], divisores: number[]): string[] {
  const colunas: string[] = Array(divisores.length + 1).fill('')
  for (const palavra of linha) {
    const indice = divisores.filter((divisor) => palavra.x >= divisor).length
    // Texto bruto do OCR é escapado antes de virar célula — mesma cautela de
    // `montarCorpoDoOcr` em rodarOcr.ts (nunca confiar em `&`/`<`/`>` vindos
    // de reconhecimento de caractere); sem isso, `montarTabelaHtml` (que
    // espera célula já em HTML seguro) podia gerar tabela quebrada.
    const texto = escaparHtml(palavra.texto)
    colunas[indice] = colunas[indice] ? `${colunas[indice]} ${texto}` : texto
  }
  return colunas
}

/**
 * Reconstrói uma tabela HTML a partir da posição das palavras reconhecidas
 * pelo OCR — mesmo princípio geométrico de `absorverTabelaPorPosicao` em
 * pdfHtml.ts (corredor vertical vazio que atravessa várias linhas), só que
 * a fonte de posição é o bounding box do `tesseract.js` em vez da posição
 * de texto nativo do PDF. Devolve `null` quando não reconhece padrão de
 * coluna nenhum — quem chama cai pro texto corrido (comportamento de hoje).
 */
export function reconstruirTabelaOcr(palavras: PalavraReconhecidaOcr[]): string | null {
  if (palavras.length === 0) return null

  const linhas = agruparEmLinhas(palavras)
  if (linhas.length < 2) return null

  const corredores = corredoresDoBloco(linhas.map(paraLinhaPosicionada), LARGURA_MINIMA_CORREDOR_PX)
  if (corredores.length === 0) return null

  const divisores = corredores.map((c) => (c.inicio + c.fim) / 2).sort((a, b) => a - b)
  const celulas = linhas.map((linha) => linhaParaColunas(linha, divisores))
  return montarTabelaHtml(celulas)
}
