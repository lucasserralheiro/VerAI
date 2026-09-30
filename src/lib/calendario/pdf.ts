import { getDocumentProxy, getResolvedPDFJS } from 'unpdf'

// Áreas pintadas e textos da 1ª página do calendário, na coordenada da página (origem embaixo à esquerda). Os
// prazos do calendário de faturamento só existem como cor de fundo do dia (spec
// docs/superpowers/specs/2026-09-29-calendario-faturamento-design.md §4). O PDF pinta retângulos largos e RECORTA
// o que aparece (máscara W*): a área que vale é a pintura ∩ o recorte ativo, na ordem do desenho.

export interface Retangulo {
  cor: string
  x0: number
  y0: number
  x1: number
  y1: number
}

export interface TextoPosicionado {
  x: number
  y: number
  s: string
}

type Caixa = { x0: number; y0: number; x1: number; y1: number }
type Matriz = [number, number, number, number, number, number]
const multiplicar = (m: Matriz, n: Matriz): Matriz => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5],
]
const aplicar = (m: Matriz, x: number, y: number): [number, number] => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]

/** Subcaminhos do caminho (pdf.js 5: 0 moveTo x y · 1 lineTo x y · 2 curveTo 6 · 3 quadraticCurveTo 4 · 4 closePath)
 *  como caixas na coordenada da página. O calendário só desenha retângulos. */
function caixasDoCaminho(dados: ArrayLike<number>, ctm: Matriz): Caixa[] {
  const caixas: Caixa[] = []
  let pontos: [number, number][] = []
  const fechar = () => {
    if (pontos.length >= 2) {
      const xs = pontos.map((p) => p[0])
      const ys = pontos.map((p) => p[1])
      caixas.push({ x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) })
    }
    pontos = []
  }
  for (let i = 0; i < dados.length; ) {
    const op = dados[i]
    if (op === 0) {
      fechar()
      pontos.push(aplicar(ctm, dados[i + 1], dados[i + 2]))
      i += 3
    } else if (op === 1) {
      pontos.push(aplicar(ctm, dados[i + 1], dados[i + 2]))
      i += 3
    } else if (op === 2) {
      pontos.push(aplicar(ctm, dados[i + 5], dados[i + 6]))
      i += 7
    } else if (op === 3) {
      pontos.push(aplicar(ctm, dados[i + 3], dados[i + 4]))
      i += 5
    } else {
      i += 1
    }
  }
  fechar()
  return caixas
}

const intersecao = (a: Caixa[], b: Caixa[]): Caixa[] =>
  a.flatMap((p) =>
    b.flatMap((q) => {
      const c = { x0: Math.max(p.x0, q.x0), y0: Math.max(p.y0, q.y0), x1: Math.min(p.x1, q.x1), y1: Math.min(p.y1, q.y1) }
      return c.x1 - c.x0 > 0.1 && c.y1 - c.y0 > 0.1 ? [c] : []
    })
  )

export async function desenhoDoCalendario(conteudo: Buffer): Promise<{ retangulos: Retangulo[]; textos: TextoPosicionado[] }> {
  const { OPS } = await getResolvedPDFJS()
  const pdf = await getDocumentProxy(new Uint8Array(conteudo))
  const pagina = await pdf.getPage(1)
  const ops = await pagina.getOperatorList()
  const retangulos: Retangulo[] = []
  let ctm: Matriz = [1, 0, 0, 1, 0, 0]
  let recorte: Caixa[] | null = null
  let cor = ''
  let recortar = false
  const pilha: { ctm: Matriz; cor: string; recorte: Caixa[] | null }[] = []
  for (let i = 0; i < ops.fnArray.length; i++) {
    const fn = ops.fnArray[i]
    const args = ops.argsArray[i]
    if (fn === OPS.save) pilha.push({ ctm, cor, recorte })
    else if (fn === OPS.restore) ({ ctm, cor, recorte } = pilha.pop() ?? { ctm, cor, recorte })
    else if (fn === OPS.transform) ctm = multiplicar(ctm, args as Matriz)
    else if (fn === OPS.setFillRGBColor) cor = String(args[0]).toLowerCase()
    else if (fn === OPS.clip || fn === OPS.eoClip) recortar = true
    else if (fn === OPS.constructPath) {
      const [pintura, caminhos] = args as [number, ArrayLike<number>[]]
      const caixas = (caminhos ?? []).flatMap((c) => (c ? caixasDoCaminho(c, ctm) : []))
      if (recortar) {
        recorte = recorte ? intersecao(recorte, caixas) : caixas
        recortar = false
      }
      if (pintura === OPS.fill || pintura === OPS.eoFill) {
        for (const c of recorte ? intersecao(caixas, recorte) : caixas) retangulos.push({ cor, ...c })
      }
    }
  }
  const textos = (await pagina.getTextContent()).items.flatMap((t) =>
    'str' in t && t.str.trim() !== '' ? [{ x: t.transform[4] as number, y: t.transform[5] as number, s: t.str.trim() }] : []
  )
  await pdf.cleanup?.()
  return { retangulos, textos }
}
