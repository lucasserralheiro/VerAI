import type { Retangulo, TextoPosicionado } from './pdf'

// Leitura do "Calendário de Faturamento PRODAM <ano>.pdf" (spec
// docs/superpowers/specs/2026-09-29-calendario-faturamento-design.md §4). Feriados pelo texto; prazos pela COR do
// dia, com o significado da cor tirado da própria legenda do PDF (nenhuma cor escrita aqui). Sem a prova, os prazos
// não entram: status "so-feriados".

export type TipoData =
  | 'EMISSAO_NFSE'
  | 'ENCERRAMENTO'
  | 'ENVIO_RELATORIO'
  | 'RECEBIMENTO_CONTRATOS'
  | 'RECEBIMENTO_PROCESSOS_SEI'
  | 'EXPEDIENTE_SUSPENSO'
  | 'FERIADO'
  | 'OUTRO'

export interface DataLida {
  inicio: Date
  fim: Date
  tipo: TipoData
  descricao: string
}

export interface CalendarioLido {
  ano: number | null
  status: 'ok' | 'so-feriados'
  datas: DataLida[]
  avisos: string[]
}

const MESES = ['janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
const semAcento = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const utc = (a: number, m: number, d: number) => new Date(Date.UTC(a, m - 1, d))
const dia = (d: Date) => d.toISOString().slice(0, 10)
const PRAZOS: TipoData[] = ['EMISSAO_NFSE', 'ENCERRAMENTO', 'ENVIO_RELATORIO', 'RECEBIMENTO_CONTRATOS', 'RECEBIMENTO_PROCESSOS_SEI']

/** O tipo pelo texto da legenda (tolerante a caixa e acento); texto novo → OUTRO com a própria descrição. */
export function tipoDaLegenda(texto: string): TipoData {
  const t = semAcento(texto)
  if (/emissao/.test(t)) return 'EMISSAO_NFSE'
  if (/encerramento/.test(t)) return 'ENCERRAMENTO'
  if (/envio do relatorio/.test(t)) return 'ENVIO_RELATORIO'
  if (/recebimento de contratos/.test(t)) return 'RECEBIMENTO_CONTRATOS'
  if (/processos sei/.test(t)) return 'RECEBIMENTO_PROCESSOS_SEI'
  if (/expediente suspenso/.test(t)) return 'EXPEDIENTE_SUSPENSO'
  return 'OUTRO'
}

/** "01/01/2026 quinta-feira Confraternização Universal" (em pedaços na mesma linha). */
function feriados(textos: TextoPosicionado[]): DataLida[] {
  const r: DataLida[] = []
  // A partir de cada data, o que está à direita dela na mesma linha (a grade dos meses fica à esquerda).
  for (const marco of textos.filter((t) => /^\d{2}\/\d{2}\/\d{4}$/.test(t.s))) {
    const itens = textos.filter((t) => Math.abs(t.y - marco.y) < 2 && t.x >= marco.x)
    const linha = itens.sort((a, b) => a.x - b.x).map((i) => i.s).join(' ')
    const m = /^(\d{2})\/(\d{2})\/(\d{4})\s+\S+-feira\s+(.+)$|^(\d{2})\/(\d{2})\/(\d{4})\s+(?:sabado|sábado|domingo)\s+(.+)$/i.exec(linha.trim())
    if (!m) continue
    const [d, mes, ano, nome] = m[1] ? [m[1], m[2], m[3], m[4]] : [m[5], m[6], m[7], m[8]]
    const data = utc(Number(ano), Number(mes), Number(d))
    r.push({ inicio: data, fim: data, tipo: 'FERIADO', descricao: nome.replace(/^(?:\S+-feira|domingo|s[aá]bado)\s+/i, '').trim() })
  }
  return r
}

interface Bloco {
  mes: number
  ano: number
  y: number
  colunas: number[]
  x0: number
  x1: number
}

/** Cabeçalhos "D S T Q Q S S" de cada mês e o rótulo do mês logo acima deles. */
function blocos(textos: TextoPosicionado[], anoPadrao: number): Bloco[] {
  const letras = textos.filter((t) => /^[DSTQ]$/.test(t.s))
  const linhas = new Map<number, TextoPosicionado[]>()
  for (const t of letras) {
    const y = [...linhas.keys()].find((k) => Math.abs(k - t.y) < 2) ?? t.y
    linhas.set(y, [...(linhas.get(y) ?? []), t])
  }
  const rotulos = textos.flatMap((t) => {
    const m = /^([a-zç]+)(?:\/(\d{4}))?$/i.exec(semAcento(t.s))
    const mes = m ? MESES.indexOf(m[1]) + 1 : 0
    return mes > 0 ? [{ ...t, mes, ano: m![2] ? Number(m![2]) : null }] : []
  })
  const r: Bloco[] = []
  for (const [y, itens] of linhas) {
    const ordenados = itens.sort((a, b) => a.x - b.x)
    for (let i = 0; i + 7 <= ordenados.length; i += 7) {
      const grupo = ordenados.slice(i, i + 7)
      if (grupo.map((g) => g.s).join('') !== 'DSTQQSS') continue
      const x0 = grupo[0].x - 8
      const x1 = grupo[6].x + 14
      const rotulo = rotulos
        .filter((l) => l.y > y && l.y - y < 25 && l.x >= x0 - 15 && l.x <= x1)
        .sort((a, b) => a.y - b.y)[0]
      if (!rotulo) continue
      r.push({ mes: rotulo.mes, ano: rotulo.ano ?? anoPadrao, y, colunas: grupo.map((g) => g.x), x0, x1 })
    }
  }
  return r
}

export function lerCalendario(retangulos: Retangulo[], textos: TextoPosicionado[]): CalendarioLido {
  const avisos: string[] = []
  // Falha de prova derruba os prazos (status "so-feriados"); aviso só informa.
  const falhas: string[] = []
  const anoTexto = textos.map((t) => /^(20\d{2})$/.exec(t.s)?.[1]).find(Boolean)
  const lidosFeriados = feriados(textos)
  const ano = anoTexto ? Number(anoTexto) : (lidosFeriados[0]?.inicio.getUTCFullYear() ?? null)
  if (!ano) return { ano: null, status: 'so-feriados', datas: lidosFeriados, avisos: ['não achei o ano do calendário'] }

  // Legenda: o quadradinho colorido à esquerda de cada texto; linhas sem quadradinho continuam a de cima.
  const textosLegenda = textos.filter((t) => /^(Per[ií]odo|Data de Encerramento|Prazo|Aditamentos|Recursos|Expediente)/i.test(t.s)).sort((a, b) => b.y - a.y)
  const legenda: { cor: string; texto: string; tipo: TipoData }[] = []
  for (const t of textosLegenda) {
    const quadrado = retangulos.find((r) => r.x1 <= t.x + 2 && t.x - r.x1 < 40 && r.y0 - 3 <= t.y && r.y1 + 3 >= t.y && r.x1 - r.x0 < 40)
    const anterior = legenda[legenda.length - 1]
    // Item de duas linhas: a segunda fica ao lado do mesmo quadradinho (ou de nenhum) — continua o de cima.
    if (quadrado && quadrado.cor !== anterior?.cor) legenda.push({ cor: quadrado.cor, texto: t.s, tipo: 'OUTRO' })
    else if (anterior) anterior.texto += ` ${t.s}`
  }
  for (const l of legenda) l.tipo = tipoDaLegenda(l.texto)
  const tipoDaCor = new Map(legenda.map((l) => [l.cor, l]))
  if (legenda.length === 0) falhas.push('não achei a legenda das cores')

  // Dias: número dentro de um bloco de mês, na coluna do dia da semana. Prova: o dia da semana da data = a coluna.
  // Mês cuja grade não bate com o calendário (o PDF de 2026 desenhou janeiro/2027 com o 1º na quinta — é sexta)
  // fica de fora inteiro, com aviso; os outros meses seguem.
  const bs = blocos(textos, ano)
  const dias: { data: Date; x: number; y: number; bloco: Bloco }[] = []
  const errados = new Map<Bloco, number>()
  for (const t of textos.filter((t) => /^\d{1,2}$/.test(t.s))) {
    const bloco = bs.filter((b) => t.x >= b.x0 && t.x <= b.x1 && t.y < b.y && b.y - t.y < 90).sort((a, b) => a.y - t.y - (b.y - t.y))[0]
    if (!bloco) continue
    const coluna = bloco.colunas.reduce((melhor, x, i) => (Math.abs(x - t.x) < Math.abs(bloco.colunas[melhor] - t.x) ? i : melhor), 0)
    const data = utc(bloco.ano, bloco.mes, Number(t.s))
    if (data.getUTCMonth() !== bloco.mes - 1 || data.getUTCDay() !== coluna) errados.set(bloco, (errados.get(bloco) ?? 0) + 1)
    else dias.push({ data, x: t.x, y: t.y, bloco })
  }
  const NOMES = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
  for (const [b, n] of errados) {
    const primeiro = utc(b.ano, b.mes, 1)
    avisos.push(
      `${MESES[b.mes - 1].replace('marco', 'março')}/${b.ano}: a grade do PDF está errada (${n} dia(s) na coluna errada; o dia 1º é ${NOMES[primeiro.getUTCDay()]}) — prazos deste mês não lidos, veja o PDF`
    )
  }
  const mesValido = (b: Bloco) => !errados.has(b)
  for (let i = dias.length - 1; i >= 0; i--) if (!mesValido(dias[i].bloco)) dias.splice(i, 1)

  // Marcações: cada dia cujo número está dentro de um retângulo de cor da legenda.
  const marcados = new Map<string, TipoData>()
  const semLegenda = new Set<string>()
  for (const d of dias) {
    // Vale o retângulo desenhado por último sobre o número (é o que aparece); faixas da largura da página
    // (título dos meses) não são marcação. Branco/cinza por cima = dia sem prazo.
    const r = [...retangulos].reverse().find((q) => d.x + 2 >= q.x0 && d.x + 2 <= q.x1 && d.y + 3 >= q.y0 && d.y + 3 <= q.y1 && q.x1 - q.x0 < 400)
    if (!r || /^#(f2f2f2|ffffff|d9d9d9|808080|a6a6a6|bfbfbf|4bacc6)$/.test(r.cor)) continue
    const l = tipoDaCor.get(r.cor)
    if (!l) semLegenda.add(r.cor)
    else marcados.set(dia(d.data), l.tipo)
  }
  if (semLegenda.size > 0) falhas.push(`cor(es) nos dias sem legenda: ${[...semLegenda].join(', ')}`)

  // Faixas: dias seguidos do mesmo tipo, dentro do mês.
  const datas: DataLida[] = []
  const ordenadas = [...marcados].sort(([a], [b]) => a.localeCompare(b))
  for (const [d, tipo] of ordenadas) {
    const data = new Date(`${d}T00:00:00Z`)
    const ultima = datas[datas.length - 1]
    const seguinte = ultima && ultima.tipo === tipo && dia(new Date(ultima.fim.getTime() + 86_400_000)) === d && ultima.fim.getUTCMonth() === data.getUTCMonth()
    if (seguinte) ultima.fim = data
    else datas.push({ inicio: data, fim: data, tipo, descricao: legenda.find((l) => l.tipo === tipo)?.texto ?? tipo })
  }

  // Prova (§4.5): um encerramento por mês; toda cor de dia está na legenda; cada prazo em ao menos 10 meses;
  // nenhum prazo em fim de semana ou feriado; cada dia do calendário do ano lido.
  const meses = new Set(bs.filter(mesValido).map((b) => `${b.ano}-${b.mes}`))
  const mesesDe = (tipo: TipoData) => new Set(datas.filter((d) => d.tipo === tipo).map((d) => `${d.inicio.getUTCFullYear()}-${d.inicio.getUTCMonth() + 1}`))
  for (const m of meses) {
    const encerramentos = datas.filter((d) => d.tipo === 'ENCERRAMENTO' && `${d.inicio.getUTCFullYear()}-${d.inicio.getUTCMonth() + 1}` === m)
    if (encerramentos.length !== 1 || dia(encerramentos[0].inicio) !== dia(encerramentos[0].fim)) falhas.push(`mês ${m}: ${encerramentos.length} data(s) de encerramento`)
  }
  for (const tipo of PRAZOS) {
    if (!legenda.some((l) => l.tipo === tipo)) falhas.push(`a legenda não tem "${tipo}"`)
    else if (mesesDe(tipo).size < 10) falhas.push(`"${legenda.find((l) => l.tipo === tipo)!.texto}" aparece em só ${mesesDe(tipo).size} mês(es)`)
  }
  const naoUteis = new Set(lidosFeriados.map((f) => dia(f.inicio)))
  for (const d of datas.filter((d) => PRAZOS.includes(d.tipo))) {
    for (let t = d.inicio.getTime(); t <= d.fim.getTime(); t += 86_400_000) {
      const x = new Date(t)
      if ((x.getUTCDay() === 0 || x.getUTCDay() === 6 || naoUteis.has(dia(x))) && d.tipo !== 'EMISSAO_NFSE') falhas.push(`${d.tipo} em dia não útil: ${dia(x)}`)
    }
  }
  // Cada mês válido com todos os seus dias lidos na grade.
  for (const b of bs.filter(mesValido)) {
    const lidos = dias.filter((d) => d.bloco === b).length
    const total = new Date(Date.UTC(b.ano, b.mes, 0)).getUTCDate()
    if (lidos !== total) falhas.push(`${b.mes}/${b.ano}: ${lidos} de ${total} dias lidos na grade`)
  }
  if (legenda.length === 0 || meses.size === 0) falhas.push('sem legenda ou sem mês legível')

  const status = falhas.length === 0 ? 'ok' : 'so-feriados'
  return { ano, status, datas: status === 'ok' ? [...lidosFeriados, ...datas] : lidosFeriados, avisos: [...avisos, ...falhas] }
}
