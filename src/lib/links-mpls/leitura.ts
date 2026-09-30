// Leitura dos relatórios "Links MPLS - Relatórios para Faturamento" (spec
// docs/superpowers/specs/2026-09-29-links-mpls-design.md §4). Regra pura sobre os textos posicionados do PDF.
// Prova: nº de códigos MPLS lidos = "Total Geral" do resumo = "TOTAL =" do fim. Sem prova, nada de número.

export interface ItemPdf {
  pagina: number
  x: number
  y: number
  s: string
}

export interface LinkLido {
  codigo: string
  /** Seção do relatório em que o link está ("LINKS ATIVOS" / "LINKS CANCELADOS"); null sem seção. */
  situacao: 'ATIVOS' | 'CANCELADOS' | null
  contratoTexto: string | null
  kbps: number | null
  redundancia: string | null
  dataAceite: Date | null
  dataCancelamento: Date | null
  entidade: string | null
  tipoLogradouro: string | null
  endereco: string | null
  numero: string | null
}

export interface RelatorioLido {
  /** Do título "LINKS - CGM Setembro-2026" (conferido com a pasta, nunca usado como competência). */
  titulo: { sigla: string; mes: number; ano: number } | null
  /** Do cabeçalho "CONTRATO CGM Nº 16/CGM/2024". */
  contratoTexto: string | null
  servico: string | null
  /** Seções do relatório, cada uma com a própria prova (um PDF pode ter ativos e cancelados). */
  secoes: { situacao: 'ATIVOS' | 'CANCELADOS' | null; totalGeral: number | null; totalRodape: number | null; lidos: number; conferida: boolean }[]
  links: LinkLido[]
  conferido: boolean
  avisos: string[]
}

const CODIGO = /^[A-Z]\d{5}[A-Z]?\/\d{2}$/
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const semAcento = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '')

/** "30-dez-21", "5-jan-24", "30/12/2021" → data (UTC). */
export function dataDoLink(texto: string): Date | null {
  const curta = /^(\d{1,2})[-/ ]([a-zç]{3})[a-zç]*[-/ ](\d{2}|\d{4})$/i.exec(semAcento(texto.trim()))
  if (curta) {
    const mes = MESES.indexOf(curta[2].toLowerCase()) + 1
    const ano = curta[3].length === 2 ? 2000 + Number(curta[3]) : Number(curta[3])
    return mes > 0 ? new Date(Date.UTC(ano, mes - 1, Number(curta[1]))) : null
  }
  const br = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(texto.trim())
  return br ? new Date(Date.UTC(Number(br[3]), Number(br[2]) - 1, Number(br[1]))) : null
}

/** "LINKS - CGM Setembro-2026" → { sigla: 'CGM', mes: 9, ano: 2026 }; "LINKS ABRIL-2025" → sigla ''. */
export function tituloDoRelatorio(texto: string): RelatorioLido['titulo'] {
  const t = semAcento(texto.trim())
  const m = /([A-Za-z]+)\s*[-/]\s*(\d{4})\s*$/.exec(t)
  const mes = m ? MESES.indexOf(m[1].slice(0, 3).toLowerCase()) + 1 : 0
  if (!m || mes === 0) return null
  const sigla = /^LINKS?\b[^-]*-\s*(\S+)\s/i.exec(t)?.[1]?.toUpperCase() ?? ''
  return { sigla, mes, ano: Number(m[2]) }
}

function agruparLinhas(itens: ItemPdf[]): { pagina: number; y: number; itens: ItemPdf[] }[] {
  const linhas: { pagina: number; y: number; itens: ItemPdf[] }[] = []
  for (const i of [...itens].sort((a, b) => a.pagina - b.pagina || b.y - a.y || a.x - b.x)) {
    const l = linhas.find((x) => x.pagina === i.pagina && Math.abs(x.y - i.y) < 3)
    if (l) l.itens.push(i)
    else linhas.push({ pagina: i.pagina, y: i.y, itens: [i] })
  }
  for (const l of linhas) l.itens.sort((a, b) => a.x - b.x)
  return linhas
}

const texto = (itens: ItemPdf[]) => itens.map((i) => i.s).join(' ').replace(/\s+/g, ' ').trim()

/** Ordem de leitura: página, de cima para baixo. */
const antes = (a: { pagina: number; y: number }, b: { pagina: number; y: number }) => a.pagina < b.pagina || (a.pagina === b.pagina && a.y > b.y)

export function lerRelatorioLinks(itens: ItemPdf[]): RelatorioLido {
  const linhas = agruparLinhas(itens)
  const r: RelatorioLido = { titulo: null, contratoTexto: null, servico: null, secoes: [], links: [], conferido: false, avisos: [] }
  // Marcos de seção ("LINKS ATIVOS"/"LINKS CANCELADOS") e totais, na ordem de leitura.
  const marcos: { pagina: number; y: number; situacao: 'ATIVOS' | 'CANCELADOS' }[] = []
  const totais: { pagina: number; y: number; tipo: 'geral' | 'rodape'; n: number }[] = []
  for (const l of linhas) {
    const t = texto(l.itens)
    if (!r.titulo && /^LINKS?\s*-/i.test(t)) r.titulo = tituloDoRelatorio(t)
    const contrato = /\bCONTRATO\b.*?\bN\s*[º°o.]\s*(.+?)(?:\s+CONTRATOS?)?$/i.exec(t)
    if (!r.contratoTexto && contrato) r.contratoTexto = contrato[1].trim()
    if (!r.servico && /^LINKS?\s+MPLS\s*-/i.test(t)) r.servico = t
    // "LINKS ATIVOS", "LINKS CANCELADOS", "LINKS CANCELADOS ABRIL-2025".
    const secao = /^LINKS?\b.*?\b(ATIVOS|CANCELADOS)\b/i.exec(semAcento(t))
    // O título da seção se repete no topo de cada página: seção nova só quando a situação muda.
    const situacao = secao?.[1].toUpperCase() as 'ATIVOS' | 'CANCELADOS' | undefined
    if (situacao && !/\bMPLS\b/i.test(t) && marcos[marcos.length - 1]?.situacao !== situacao) marcos.push({ pagina: l.pagina, y: l.y, situacao })
    const geral = /^Total Geral\s+(\d+)$/i.exec(t)
    if (geral) totais.push({ pagina: l.pagina, y: l.y, tipo: 'geral', n: Number(geral[1]) })
    const rodape = /^TOTAL\s*=\s*(\d+)$/i.exec(t)
    if (rodape) totais.push({ pagina: l.pagina, y: l.y, tipo: 'rodape', n: Number(rodape[1]) })
  }
  const secaoDe = (p: { pagina: number; y: number }) => {
    let s = -1
    marcos.forEach((m, i) => {
      if (antes(m, p)) s = i
    })
    return s
  }

  // Colunas pelo cabeçalho da tabela (repete a cada página): a posição x do Tipo, do Endereço e do Número.
  const cabecalhos = new Map<number, { tipo: number | null; endereco: number | null; numero: number | null }>()
  for (const l of linhas) {
    if (!l.itens.some((i) => /C[OÓ]D\s+MPLS/i.test(semAcento(i.s)) || /COD\s+MPLS/i.test(semAcento(i.s)))) continue
    const x = (re: RegExp) => l.itens.find((i) => re.test(semAcento(i.s)))?.x ?? null
    cabecalhos.set(l.pagina, { tipo: x(/^Tipo$/i), endereco: x(/^Endere/i), numero: x(/^N[uú]mero$/i) })
  }

  // Cada link começa no código MPLS; o que está mais perto (em y) desse código do que de outro é dele.
  const ancoras = itens.filter((i) => CODIGO.test(i.s))
  for (const a of ancoras) {
    const col = cabecalhos.get(a.pagina) ?? [...cabecalhos.values()][0] ?? { tipo: null, endereco: null, numero: null }
    const vizinhos = ancoras.filter((b) => b.pagina === a.pagina && b !== a)
    const meus = itens.filter(
      (i) => i.pagina === a.pagina && i !== a && Math.abs(i.y - a.y) <= 14 && vizinhos.every((b) => Math.abs(i.y - a.y) < Math.abs(i.y - b.y) || Math.abs(i.y - b.y) > 14)
    )
    const naLinha = meus.filter((i) => Math.abs(i.y - a.y) < 3).sort((p, q) => p.x - q.x)
    const secao = secaoDe(a)
    const link: LinkLido = { codigo: a.s, situacao: secao >= 0 ? marcos[secao].situacao : null, contratoTexto: null, kbps: null, redundancia: null, dataAceite: null, dataCancelamento: null, entidade: null, tipoLogradouro: null, endereco: null, numero: null }
    for (const i of naLinha.filter((i) => i.x < a.x)) {
      // A data pode vir sozinha ou grudada no status ("cancelado 07/04/2025").
      const d = dataDoLink(i.s) ?? i.s.split(/\s+/).map(dataDoLink).find(Boolean) ?? null
      if (d) link.dataCancelamento = d
    }
    let posData = a.x
    for (const i of naLinha.filter((i) => i.x > a.x)) {
      if (!link.contratoTexto && /^(TC|CO|T\.C\.|C\.O\.)\s*\S/i.test(i.s)) link.contratoTexto = i.s
      else if (link.kbps === null && /^\d{3,7}$/.test(i.s)) link.kbps = Number(i.s)
      else if (!link.redundancia && /redund/i.test(i.s)) link.redundancia = i.s
      else if (!link.dataAceite && dataDoLink(i.s)) {
        link.dataAceite = dataDoLink(i.s)
        posData = i.x
      }
    }
    // Entidade (pode quebrar linha, acima e abaixo do código), tipo, endereço e número pela posição.
    const limiteTipo = col.tipo !== null ? col.tipo - 40 : Infinity
    const limiteNumero = col.numero !== null ? col.numero - 15 : Infinity
    const entidade = meus.filter((i) => i.x > posData + 10 && i.x < limiteTipo && !dataDoLink(i.s))
    link.entidade = entidade.length ? texto(entidade.sort((p, q) => q.y - p.y || p.x - q.x)) : null
    const tipo = naLinha.filter((i) => i.x >= limiteTipo && i.x < limiteTipo + 60)
    link.tipoLogradouro = tipo.length ? texto(tipo) : null
    const inicioEndereco = tipo.length ? Math.max(...tipo.map((i) => i.x)) + 1 : limiteTipo + 60
    const endereco = meus.filter((i) => i.x >= inicioEndereco && i.x < limiteNumero)
    link.endereco = endereco.length ? texto(endereco.sort((p, q) => q.y - p.y || p.x - q.x)) : null
    const numero = naLinha.filter((i) => i.x >= limiteNumero)
    link.numero = numero.length ? texto(numero) : null
    r.links.push(link)
  }

  // Prova por seção: links lidos na seção = "Total Geral" dela = "TOTAL =" dela (o que houver; ao menos um).
  const indices = [...new Set([-1, ...marcos.map((_, i) => i)])]
  for (const i of indices) {
    const lidos = r.links.filter((_, k) => secaoDe(ancoras[k]) === i).length
    const dela = totais.filter((t) => secaoDe(t) === i)
    if (lidos === 0 && dela.length === 0) continue
    const gerais = [...new Set(dela.filter((t) => t.tipo === 'geral').map((t) => t.n))]
    const rodapes = [...new Set(dela.filter((t) => t.tipo === 'rodape').map((t) => t.n))]
    const situacao = i >= 0 ? marcos[i].situacao : null
    const nome = situacao ? `links ${situacao.toLowerCase()}` : 'relatório'
    const conferida = dela.length > 0 && gerais.length <= 1 && rodapes.length <= 1 && [...gerais, ...rodapes].every((n) => n === lidos)
    if (dela.length === 0) r.avisos.push(`${nome}: sem total para conferir a leitura (${lidos} lido(s))`)
    else if (!conferida) r.avisos.push(`${nome}: ${[...gerais.map((n) => `"Total Geral ${n}"`), ...rodapes.map((n) => `"TOTAL = ${n}"`)].join(', ')} e ${lidos} link(s) lido(s)`)
    r.secoes.push({ situacao, totalGeral: gerais[0] ?? null, totalRodape: rodapes[0] ?? null, lidos, conferida })
  }
  r.conferido = r.secoes.length > 0 && r.secoes.every((s) => s.conferida)
  const ativos = r.links.filter((l) => l.situacao !== 'CANCELADOS')
  const repetidos = ativos.length - new Set(ativos.map((l) => l.codigo)).size
  if (repetidos > 0) r.avisos.push(`${repetidos} código(s) MPLS repetido(s) entre os ativos`)
  return r
}
