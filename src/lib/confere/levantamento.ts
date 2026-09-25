import JSZip from 'jszip'

import type { Competencia } from './tipos-cadastro'

// Lê o cabeçalho da aba `Levantamento` — título, "Data do Levantamento" e o contrato de referência
// ("conforme contrato :") — sem abrir a planilha inteira. Espelha `levantamento_reader._ler_cabecalho`
// do Confere (services/confere/backend/src/infrastructure/measurement/levantamento_reader.py): as
// mesmas dez primeiras linhas e cinco colunas, as mesmas expressões. Se um lado mudar, o outro muda
// junto.
//
// Não usa o exceljs: `workbook.xlsx.load` estoura nos levantamentos reais (desenhos na planilha —
// medido em 25/09/2026). Um XLSX é um zip de XML: a aba sai do workbook.xml + rels, e o texto das
// células, do sharedStrings.

export const MENSAGEM_SEM_ABA = "planilha sem a aba 'Levantamento' — verifique se o arquivo é o levantamento"
export const MENSAGEM_NAO_ABRE = 'não foi possível abrir a planilha — verifique se o arquivo é um .xlsx'

const ABA = 'Levantamento'
const LINHAS_DO_CABECALHO = 10
const COLUNAS_LIDAS = 5
const DATA = /Data do Levantamento\s*:\s*(\d{2}\/\d{2}\/\d{4})/
const CONTRATO = /conforme contrato\s*:\s*(.+?)\s*$/

export class LevantamentoIlegivel extends Error {}

export interface CabecalhoDoLevantamento {
  titulo: string | null
  /** "AAAA-MM-DD". */
  dataLevantamento: string | null
  /** O que vem depois de "conforme contrato :" — "TC 52/SMIT/2024". */
  contratoReferencia: string | null
}

function decodificar(texto: string): string {
  return texto
    .replace(/&#x([0-9a-f]+);/gi, (_, hexadecimal: string) => String.fromCodePoint(parseInt(hexadecimal, 16)))
    .replace(/&#(\d+);/g, (_, decimal: string) => String.fromCodePoint(Number(decimal)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
}

function atributo(tag: string | undefined, nome: string): string | null {
  if (!tag) return null
  const achado = new RegExp(`\\s${nome}="([^"]*)"`).exec(tag)
  return achado ? decodificar(achado[1]) : null
}

function abertura(elemento: string): string {
  return elemento.slice(0, elemento.indexOf('>') + 1)
}

/** O texto de todos os `<t>` — texto rico chega em várias corridas. A leitura fonética (`<rPh>`)
 *  também usa `<t>` e não é texto visível. */
function textoDosT(xml: string): string {
  const semFonetica = xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, '')
  const partes = semFonetica.match(/<t(?:\s[^>]*)?>[\s\S]*?<\/t>/g) ?? []
  return partes.map((parte) => decodificar(parte.replace(/<[^>]+>/g, ''))).join('')
}

function indiceDaColuna(referencia: string): number {
  const letras = /^[A-Z]+/.exec(referencia)?.[0] ?? ''
  let indice = 0
  for (const letra of letras) indice = indice * 26 + (letra.charCodeAt(0) - 64)
  return indice - 1
}

function valorDaCelula(celula: string, textos: string[]): string {
  const tipo = atributo(abertura(celula), 't')
  if (tipo === 'inlineStr') return textoDosT(celula).trim()
  const bruto = /<v>([\s\S]*?)<\/v>/.exec(celula)?.[1]
  if (bruto === undefined) return ''
  if (tipo === 's') return (textos[Number(bruto)] ?? '').trim()
  if (tipo === 'b') return bruto === '1' ? 'True' : 'False'
  if (tipo === 'str' || tipo === 'e') return decodificar(bruto).trim()
  // Número: vírgula decimal, como o `_texto` do Confere. O cabeçalho só usa texto.
  return bruto.replace('.', ',')
}

/** As dez primeiras linhas, cinco colunas cada — o que o Confere lê em `identificar`. */
function linhasDoCabecalho(folha: string, textos: string[]): string[][] {
  const linhas = Array.from({ length: LINHAS_DO_CABECALHO }, () => Array<string>(COLUNAS_LIDAS).fill(''))
  let anterior = 0
  for (const [bloco] of folha.matchAll(/<row\b[^>]*\/>|<row\b[^>]*>[\s\S]*?<\/row>/g)) {
    const numero = Number(atributo(abertura(bloco), 'r') ?? anterior + 1)
    anterior = numero
    if (numero > LINHAS_DO_CABECALHO) break
    let colunaAnterior = -1
    for (const [celula] of bloco.matchAll(/<c\b[^>]*\/>|<c\b[^>]*>[\s\S]*?<\/c>/g)) {
      const referencia = atributo(abertura(celula), 'r')
      const coluna = referencia ? indiceDaColuna(referencia) : colunaAnterior + 1
      colunaAnterior = coluna
      if (coluna >= 0 && coluna < COLUNAS_LIDAS) linhas[numero - 1][coluna] = valorDaCelula(celula, textos)
    }
  }
  return linhas
}

function paraIso(data: string): string | null {
  const [dia, mes, ano] = data.split('/').map(Number)
  const valida = new Date(Date.UTC(ano, mes - 1, dia))
  if (valida.getUTCMonth() !== mes - 1 || valida.getUTCDate() !== dia) return null
  return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
}

export async function lerCabecalhoDoLevantamento(conteudo: ArrayBuffer | Uint8Array): Promise<CabecalhoDoLevantamento> {
  let zip: JSZip
  try {
    zip = await JSZip.loadAsync(conteudo)
  } catch {
    throw new LevantamentoIlegivel(MENSAGEM_NAO_ABRE)
  }
  const livro = await zip.file('xl/workbook.xml')?.async('string')
  if (!livro) throw new LevantamentoIlegivel(MENSAGEM_NAO_ABRE)

  const aba = (livro.match(/<sheet\b[^>]*>/g) ?? []).find((tag) => atributo(tag, 'name') === ABA)
  const relacao = atributo(aba, 'r:id')
  const relacoes = (await zip.file('xl/_rels/workbook.xml.rels')?.async('string')) ?? ''
  const alvo = (relacoes.match(/<Relationship\b[^>]*>/g) ?? []).find(
    (tag) => relacao !== null && atributo(tag, 'Id') === relacao
  )
  const destino = atributo(alvo, 'Target')
  // "/xl/worksheets/sheet2.xml" (openpyxl) ou "worksheets/sheet2.xml" (Excel, relativo a xl/).
  const caminho = destino ? (destino.startsWith('/') ? destino.slice(1) : `xl/${destino}`) : null
  const folha = caminho ? await zip.file(caminho)?.async('string') : undefined
  if (!folha) throw new LevantamentoIlegivel(MENSAGEM_SEM_ABA)

  const compartilhados = (await zip.file('xl/sharedStrings.xml')?.async('string')) ?? ''
  const textos = (compartilhados.match(/<si(?:\s[^>]*)?>[\s\S]*?<\/si>|<si\s*\/>/g) ?? []).map(textoDosT)
  const linhas = linhasDoCabecalho(folha, textos)

  let dataLevantamento: string | null = null
  let contratoReferencia: string | null = null
  for (const celulas of linhas) {
    const data = dataLevantamento === null ? DATA.exec(celulas.join(' ')) : null
    if (data) dataLevantamento = paraIso(data[1])
    const contrato = contratoReferencia === null ? CONTRATO.exec(celulas[0]) : null
    if (contrato) contratoReferencia = contrato[1].trim()
  }
  return { titulo: linhas[0][0] || null, dataLevantamento, contratoReferencia }
}

/** A competência do Confere é o mês da "Data do Levantamento" (`competencia_por_extenso`). */
export function competenciaDaData(dataIso: string | null): Competencia | null {
  if (!dataIso) return null
  const [ano, mes] = dataIso.split('-').map(Number)
  return { ano, mes }
}
