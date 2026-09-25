/**
 * Texto compacto que o MODELO recebe de uma ferramenta (spec 2026-09-25-assistente-base-economica §4).
 * A tela continua recebendo o objeto inteiro pelo stream. Cabeçalho da tabela uma vez, sem campos
 * vazios, sem `href`.
 */
export const MAX_CARACTERES_MODELO = 8000

const avisoDeCorte = (mostradas: number, total: number) =>
  `… mostrando ${mostradas} de ${total} linhas. Para ver o resto, use filtro ou limite menor.`

function vazio(valor: unknown): boolean {
  return valor === null || valor === undefined || valor === false || valor === '' || valor === '—' || (Array.isArray(valor) && valor.length === 0)
}

function ehObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor) && !(valor instanceof Date)
}

const campos = (objeto: Record<string, unknown>) => Object.entries(objeto).filter(([chave, valor]) => chave !== 'href' && !vazio(valor))

/** Qualquer valor numa linha só: objeto vira "chave valor · chave valor", lista vira "a; b". */
export function emLinha(valor: unknown): string {
  if (Array.isArray(valor)) return valor.filter((v) => !vazio(v)).map(emLinha).join('; ')
  if (ehObjeto(valor)) return campos(valor).map(([chave, v]) => `${chave} ${emLinha(v)}`).join(' · ')
  if (valor === true) return 'sim'
  if (valor instanceof Date) return valor.toISOString().slice(0, 10)
  return String(valor).replace(/\s+/g, ' ').trim()
}

const celula = (valor: unknown) => (vazio(valor) ? '' : emLinha(valor).replace(/\|/g, '/'))

export function tabela(titulo: string, itens: Record<string, unknown>[], opcoes: { total?: number; colunas?: string[] } = {}): string {
  if (itens.length === 0) return `${titulo}: nenhum`
  const todas = opcoes.colunas ?? [...new Set(itens.flatMap((i) => Object.keys(i)))]
  const colunas = todas.filter((c) => c !== 'href' && itens.some((i) => !vazio(i[c])))
  return [
    `${titulo} (total ${opcoes.total ?? itens.length}, mostrando ${itens.length}):`,
    colunas.join('|'),
    ...itens.map((i) => colunas.map((c) => celula(i[c])).join('|')),
  ].join('\n')
}

const listaDeObjetos = (valor: unknown): valor is Record<string, unknown>[] => Array.isArray(valor) && valor.length > 0 && valor.every(ehObjeto)

/** Formato genérico: linhas `chave: valor` e uma tabela por lista de objetos. */
export function compactar(valor: unknown): string {
  if (!ehObjeto(valor)) return emLinha(valor)
  const listas = Object.values(valor).filter(listaDeObjetos)
  const totalDaLista = typeof valor.total === 'number' && listas.length === 1 ? valor.total : undefined
  const linhas: string[] = []
  for (const [chave, v] of campos(valor)) {
    if (chave === 'total' && totalDaLista !== undefined) continue
    linhas.push(listaDeObjetos(v) ? tabela(chave, v, { total: totalDaLista }) : `${chave}: ${emLinha(v)}`)
  }
  return linhas.join('\n')
}

/** Corta em linha inteira, nunca no meio (o JSON cortado de antes chegava quebrado ao modelo). */
export function cortarPorLinha(texto: string, max = MAX_CARACTERES_MODELO): string {
  if (texto.length <= max) return texto
  const linhas = texto.split('\n')
  const folga = avisoDeCorte(linhas.length, linhas.length).length + 1
  const mantidas: string[] = []
  let tamanho = 0
  for (const linha of linhas) {
    if (tamanho + linha.length + 1 > max - folga) break
    mantidas.push(linha)
    tamanho += linha.length + 1
  }
  if (mantidas.length === 0) mantidas.push(linhas[0].slice(0, max - folga - 1))
  return `${mantidas.join('\n')}\n${avisoDeCorte(mantidas.length, linhas.length)}`
}
