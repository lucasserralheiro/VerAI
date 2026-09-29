import { valorBr } from '@/lib/controles-contratos/leitura'
import { numeroDoValor } from './categoria'

// Prova "número = extenso" (spec docs/superpowers/specs/2026-09-29-valor-vigencia-contratos-design.md §5.2): o
// termo escreve o valor duas vezes; se as duas batem, o número foi lido certo. Se não batem, o próprio documento
// se contradiz — nunca grava sozinho. Na dúvida (extenso cortado, palavra desconhecida), "não dá para conferir".

const PALAVRAS: Record<string, number> = {
  zero: 0, um: 1, hum: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9,
  dez: 10, onze: 11, doze: 12, treze: 13, quatorze: 14, catorze: 14, quinze: 15, dezesseis: 16, dezessete: 17,
  dezoito: 18, dezenove: 19, vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50, sessenta: 60, setenta: 70,
  oitenta: 80, noventa: 90, cem: 100, cento: 100, duzentos: 200, duzentas: 200, trezentos: 300, trezentas: 300,
  quatrocentos: 400, quatrocentas: 400, quinhentos: 500, quinhentas: 500, seiscentos: 600, seiscentas: 600,
  setecentos: 700, setecentas: 700, oitocentos: 800, oitocentas: 800, novecentos: 900, novecentas: 900,
}

function inteiro(texto: string): number | null {
  let total = 0
  let grupo = 0
  let achou = false
  for (const palavra of texto.split(/[^a-z]+/).filter(Boolean)) {
    if (palavra in PALAVRAS) {
      grupo += PALAVRAS[palavra]
      achou = true
    } else if (/^bilh(ao|oes)$/.test(palavra)) {
      total += (grupo || 1) * 1e9
      grupo = 0
      achou = true
    } else if (/^milh(ao|oes)$/.test(palavra)) {
      total += (grupo || 1) * 1e6
      grupo = 0
      achou = true
    } else if (palavra === 'mil') {
      total += (grupo || 1) * 1e3
      grupo = 0
      achou = true
    }
  }
  return achou ? total + grupo : null
}

/** "dois milhões, … reais e vinte centavos" → 2207992.2; sem número reconhecível → null. */
export function numeroPorExtenso(texto: string): number | null {
  const t = texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const [reais, resto] = t.split(/\breais?\b/)
  const parteInteira = inteiro(reais ?? '')
  if (parteInteira === null) return null
  const centavos = resto ? (inteiro(resto.split(/centavos?/)[0]) ?? 0) : 0
  return Math.round((parteInteira + centavos / 100) * 100) / 100
}

export function extensoDoTrecho(trecho: string, valor: string): 'igual' | 'diferente' | null {
  const numero = numeroDoValor(valor)
  const decimal = numero ? valorBr(numero) : null
  const posicao = numero ? trecho.indexOf(numero) : -1
  if (!numero || !decimal || posicao < 0) return null
  const parenteses = /^\s*\(([^)]+)/.exec(trecho.slice(posicao + numero.length, posicao + numero.length + 400))
  // Extenso cortado antes de "reais" (o trecho da ficha tem 200 caracteres) não serve de prova nem de contradição.
  if (!parenteses || !/\brea(l|is)\b/i.test(parenteses[1])) return null
  const porExtenso = numeroPorExtenso(parenteses[1])
  if (porExtenso === null) return null
  return Math.abs(porExtenso - Number(decimal)) < 0.005 ? 'igual' : 'diferente'
}
