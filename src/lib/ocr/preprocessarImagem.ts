export interface ImagemEmMemoria {
  data: Uint8ClampedArray
  width: number
  height: number
}

/**
 * Converte pra escala de cinza e estica o contraste (normalização min-max):
 * a luminância mais escura do bitmap vira preto, a mais clara vira branco, o
 * resto escala linearmente entre os dois. PDF escaneado costuma sair com
 * contraste baixo (cinza sobre cinza, sombra de scanner) — esticar isso
 * ajuda o `tesseract.js` a separar traço de caractere do fundo.
 *
 * Não é binarização de verdade (preto/branco puro, tipo Otsu) — mais
 * simples e já suficiente pro ganho que dá; binarização propriamente dita
 * fica como melhoria futura se isso não bastar.
 */
export function binarizarEContrastar(imagem: ImagemEmMemoria): void {
  const { data, width, height } = imagem
  const totalPixels = width * height
  const luminancias = new Float64Array(totalPixels)

  let min = 255
  let max = 0
  for (let i = 0; i < totalPixels; i++) {
    const r = data[i * 4]
    const g = data[i * 4 + 1]
    const b = data[i * 4 + 2]
    // Luminância perceptual (ITU-R BT.601) — fórmula padrão de conversão
    // pra escala de cinza em processamento de imagem.
    const luminancia = 0.299 * r + 0.587 * g + 0.114 * b
    luminancias[i] = luminancia
    if (luminancia < min) min = luminancia
    if (luminancia > max) max = luminancia
  }

  const amplitude = max - min
  if (amplitude === 0) return // página em branco/uniforme — nada pra esticar

  for (let i = 0; i < totalPixels; i++) {
    const esticado = ((luminancias[i] - min) / amplitude) * 255
    data[i * 4] = esticado
    data[i * 4 + 1] = esticado
    data[i * 4 + 2] = esticado
    // data[i*4+3] (alpha) preservado — não é tocado.
  }
}
