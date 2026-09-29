// Busca, grupos e seções da tela da tabela de preços (roda no navegador — sem import de servidor).

interface ItemBuscavel {
  codigo: string
  grupo: string
  secoes: string
  descricao: string
}

export const normalizarBusca = (t: string) =>
  t
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()

/** Todas as palavras na descrição (sem acento, sem caixa); só dígitos e pontos = busca por código. */
export function filtrarItens<T extends ItemBuscavel>(itens: T[], termo: string, grupo: string | null = null): T[] {
  const q = normalizarBusca(termo)
  const soCodigo = /^[\d.]+$/.test(q)
  const palavras = q ? q.split(' ') : []
  return itens.filter((i) => {
    if (grupo && i.grupo !== grupo) return false
    if (!q) return true
    if (soCodigo) return i.codigo.includes(q) || i.codigo.replace(/\./g, '').includes(q.replace(/\./g, ''))
    const alvo = normalizarBusca(`${i.codigo} ${i.descricao}`)
    return palavras.every((p) => alvo.includes(p))
  })
}

/** "A - SISTEMAS DE INFORMAÇÃO" → "Sistemas de informação". */
export function rotuloDoGrupo(secaoTopo: string): string {
  const nome = secaoTopo
    .replace(/^[A-Z]\s*-\s*/, '')
    .trim()
    .toLowerCase()
  return nome.charAt(0).toUpperCase() + nome.slice(1)
}

export function gruposDosItens<T extends ItemBuscavel>(itens: T[]): { grupo: string; rotulo: string; total: number }[] {
  const grupos = new Map<string, { grupo: string; rotulo: string; total: number }>()
  for (const i of itens) {
    const g = grupos.get(i.grupo) ?? { grupo: i.grupo, rotulo: rotuloDoGrupo(i.secoes.split(' > ')[0] ?? i.grupo), total: 0 }
    g.total++
    grupos.set(i.grupo, g)
  }
  return [...grupos.values()]
}

/** Blocos de itens seguidos com a mesma seção (a ordem vem da planilha, igual ao PDF). */
export function agruparPorSecao<T extends ItemBuscavel>(itens: T[]): { secao: string; itens: T[] }[] {
  const blocos: { secao: string; itens: T[] }[] = []
  for (const i of itens) {
    const ultimo = blocos[blocos.length - 1]
    if (ultimo && ultimo.secao === i.secoes) ultimo.itens.push(i)
    else blocos.push({ secao: i.secoes, itens: [i] })
  }
  return blocos
}

/** Pedaços do texto com as palavras da busca marcadas. Funciona porque tirar o acento de texto NFC não
 *  muda o tamanho: o índice no texto normalizado é o mesmo no original. */
export function trechosDestacados(texto: string, termo: string): { texto: string; destaque: boolean }[] {
  const palavras = normalizarBusca(termo)
    .split(' ')
    .filter((p) => p.length > 0)
  const original = texto.normalize('NFC')
  if (palavras.length === 0) return [{ texto: original, destaque: false }]
  const alvo = original
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
  const marca = new Array<boolean>(original.length).fill(false)
  for (const p of palavras) {
    let i = alvo.indexOf(p)
    while (i >= 0) {
      for (let k = i; k < i + p.length; k++) marca[k] = true
      i = alvo.indexOf(p, i + p.length)
    }
  }
  const pedacos: { texto: string; destaque: boolean }[] = []
  for (let k = 0; k < original.length; k++) {
    const ultimo = pedacos[pedacos.length - 1]
    if (ultimo && ultimo.destaque === marca[k]) ultimo.texto += original[k]
    else pedacos.push({ texto: original[k], destaque: marca[k] })
  }
  return pedacos
}
