// Campos do PDF de um termo (contrato, aditivo, apostilamento, rescisão) lidos do TEXTO, de forma
// determinística. Spec docs/superpowers/specs/2026-09-24-sincronizacao-sharepoint-contratos-design.md §8.3.
//
// Tudo aqui é "melhor esforço com prova": cada campo só sai quando o padrão é inequívoco; o que não
// casa fica `null` e o importador não inventa. Valor sai como string decimal ("4874940.85") pra não
// passar por float.

export interface CamposTermo {
  numeroDocumento: string | null
  seiCliente: string | null
  seiProdam: string | null
  contratante: string | null
  objeto: string | null
  valor: string | null
  /** Data da última assinatura eletrônica do SEI ("Em 10/10/2023, às 14:01") ou "São Paulo, 15 de ...". */
  assinaturaEm: Date | null
  inicio: Date | null
  fim: Date | null
  meses: number | null
  /** "contados da sua assinatura": o início é a data da assinatura. */
  inicioNaAssinatura: boolean
  /** O texto diz que o termo prorroga a vigência. */
  prorrogaVigencia: boolean
  /** Quase sem texto: PDF escaneado (imagem) — nada foi lido. */
  semTexto: boolean
}

const MESES: Record<string, number> = {
  janeiro: 1, fevereiro: 2, marco: 3, abril: 4, maio: 5, junho: 6,
  julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
}

const DATA = String.raw`(\d{1,2}\/\d{1,2}\/\d{4}|\d{1,2}[ºo°]?\s+de\s+[A-Za-zçÇ]+\s+de\s+\d{4})`
const SEI = /\b(\d{4}\.\d{4}\/\d{7}-\d)\b/g
const DINHEIRO = String.raw`R\$\s*([\d.]{1,15},\d{2})`

function semAcento(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '')
}

/** "15/10/2023" ou "15 de outubro de 2023" → Date (UTC meia-noite). */
export function lerData(texto: string): Date | null {
  const t = semAcento(texto).toLowerCase().trim()
  let d: number, m: number, a: number
  const num = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t)
  if (num) {
    ;[d, m, a] = [Number(num[1]), Number(num[2]), Number(num[3])]
  } else {
    const ext = /^(\d{1,2})[ºo°]?\s+de\s+([a-z]+)\s+de\s+(\d{4})$/.exec(t)
    if (!ext || !MESES[ext[2]]) return null
    ;[d, m, a] = [Number(ext[1]), MESES[ext[2]], Number(ext[3])]
  }
  if (a < 2000 || a > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null
  const data = new Date(Date.UTC(a, m - 1, d))
  return data.getUTCMonth() === m - 1 ? data : null
}

/** "4.874.940,85" → "4874940.85". */
export function lerValor(texto: string): string | null {
  if (!/^\d{1,3}(\.\d{3})*,\d{2}$|^\d+,\d{2}$/.test(texto)) return null
  const v = texto.replace(/\./g, '').replace(',', '.')
  return Number(v) > 0 ? v : null
}

/** Tira rodapé de página do SEI ("Contrato nº 12 /CGM/2023 (091422354) SEI 6067... / pg. 3") — ele
 *  cai no meio das frases quando o texto é achatado — e junta tudo numa linha só. */
export function achatar(texto: string): string {
  return texto
    .split('\n')
    .filter((linha) => !/\/\s*pg\.\s*\d+\s*$/i.test(linha.trim()))
    .join(' ')
    .replace(/\s+/g, ' ')
}

function primeiro(texto: string, padroes: RegExp[]): RegExpExecArray | null {
  for (const p of padroes) {
    const m = p.exec(texto)
    if (m) return m
  }
  return null
}

export function extrairCampos(textoBruto: string, tipo: 'CONTRATO' | 'ADITIVO' | 'PRORROGACAO' | 'RESCISAO'): CamposTermo {
  const texto = achatar(textoBruto)
  const semTexto = texto.replace(/[^A-Za-z]/g, '').length < 200

  const numeroDocumento = /TERMO DE CONTRATO\s*N[º°o.]*\s*:?\s*([\w./-]*\d[\w./-]*)/i.exec(texto)?.[1] ?? null

  const seis = [...texto.matchAll(SEI)].map((m) => m[1])
  const seiProdamRotulado = /SEI\s*PRODAM\s*N?[º°o.]*\s*:?\s*(\d{4}\.\d{4}\/\d{7}-\d)/i.exec(texto)?.[1]
  const seiProdam = seiProdamRotulado ?? seis.find((s) => s.startsWith('7010.')) ?? null
  const seiCliente = seis.find((s) => s !== seiProdam && !s.startsWith('7010.')) ?? null

  const contratante = /CONTRATANTE\s*:\s*(.{5,200}?)\s*(?:CONTRATAD[AO]\s*:|VALOR|OBJETO|DOTA)/i.exec(texto)?.[1]?.trim() ?? null
  const objetoBruto = /\bOBJETO\s*:\s*(.{10,700}?)\s*(?:CONTRATANTE\s*:|CONTRATAD[AO]\s*:|VALOR\b|DOTA[CÇ])/i.exec(texto)?.[1]
  const objeto = objetoBruto ? objetoBruto.trim().replace(/[.;,\s]+$/, '') : null

  // "O valor estimado do presente contrato é de R$" — com a ligadura "ti" quebrada ("esGmado",
  // "es@mado") e OCR ("e de"); ou o cabeçalho "VALOR DO CONTRATO: R$" / "VALOR: R$".
  const doPresente = String.raw`\bvalor\s+(?:\S{1,12}\s+){0,2}d[oe]\s+presente\s+(?:contrato|ajuste|instrumento)\s+(?:[ée]|ser[aá])\s+(?:de\s+)?${DINHEIRO}`
  const valorPadroes =
    tipo === 'CONTRATO'
      ? [
          new RegExp(String.raw`VALOR\s+(?:DO\s+CONTRATO|GLOBAL|TOTAL|ESTIMADO)(?:\s+DO\s+CONTRATO)?\s*:?\s*${DINHEIRO}`, 'i'),
          new RegExp(doPresente, 'i'),
          new RegExp(String.raw`\bVALOR\s*:\s*${DINHEIRO}`),
          new RegExp(String.raw`valor\s+(?:total|global)\s+(?:do|deste|do\s+presente)\s+(?:contrato|ajuste|instrumento)[^R]{0,60}${DINHEIRO}`, 'i'),
        ]
      : tipo === 'RESCISAO'
        ? []
        : [
            new RegExp(String.raw`valor\s+(?:total\s+|global\s+)?(?:do\s+contrato|contratual)\s+passa(?:r[aá])?\s+a\s+ser\s+(?:de\s+)?${DINHEIRO}`, 'i'),
            new RegExp(String.raw`totalizando\s+o\s+valor\s+(?:anual|global|total|estimado)\s+(?:de\s+)?${DINHEIRO}`, 'i'),
            new RegExp(String.raw`valor\s+(?:\S{1,12}\s+){0,2}(?:para\s+o\s+per[ií]odo|da\s+prorroga[cç][aã]o|do\s+presente\s+(?:termo|aditamento|aditivo))[^R]{0,80}${DINHEIRO}`, 'i'),
            new RegExp(String.raw`valor\s+(?:total|global)\s+(?:do\s+presente|deste)\s+(?:termo|aditamento|aditivo)[^R]{0,60}${DINHEIRO}`, 'i'),
          ]
  const valor = (() => {
    const m = primeiro(texto, valorPadroes)
    return m ? lerValor(m[1]) : null
  })()

  // Assinatura: última assinatura eletrônica do SEI; sem SEI, "São Paulo, 15 de outubro de 2023".
  const eletronicas = [...texto.matchAll(/\bEm\s+(\d{2}\/\d{2}\/\d{4}),?\s+[àa]s\s+\d{1,2}:\d{2}/g)]
    .map((m) => lerData(m[1]))
    .filter((d): d is Date => d !== null)
  const porExtenso = [...texto.matchAll(new RegExp(String.raw`S[ãa]o\s+Paulo\s*,\s*${DATA}`, 'gi'))]
    .map((m) => lerData(m[1]))
    .filter((d): d is Date => d !== null)
  const assinaturas = eletronicas.length > 0 ? eletronicas : porExtenso
  const assinaturaEm = assinaturas.length > 0 ? new Date(Math.max(...assinaturas.map((d) => d.getTime()))) : null

  // Vigência: procura perto das frases que falam do prazo ("a vigência inicial do presente...",
  // "vigorará", "fica prorrogado", "por mais") — a primeira que render prazo ou data vale. Longe
  // delas, "a partir de" costuma ser de decreto, portaria ou início de serviço.
  const ancora = /vig[eê]ncia\s+(?:inicial\s+)?(?:do\s+presente|deste|ser[aá]|[ée])|vigorar[aá]|viger[aá]|ter[aá]\s+vig[eê]ncia|fica\s+prorrogad|prorroga(?:do|[cç][aã]o)\s+(?:do\s+)?prazo|por\s+mais\s+\d/gi
  const aPartir = String.raw`(?:a\s+(?:par\S{0,3}\s?r|contar)|contad[oa]s?(?:\s+a\s+(?:par\S{0,3}\s?r))?)\s+(?:de|da\s+data\s+de)\s+${DATA}`
  let inicio: Date | null = null
  let fim: Date | null = null
  let meses: number | null = null
  let inicioNaAssinatura = false
  for (const m of texto.matchAll(ancora)) {
    const janela = texto.slice(m.index, m.index + 380)
    const mm = /(\d{1,2})\s*\([^)]{2,30}\)\s*mes(?:es)?|por\s+mais\s+(\d{1,2})\s+mes(?:es)?|(\d{1,2})\s+mes(?:es)?/i.exec(janela)
    const ini = new RegExp(aPartir, 'i').exec(janela)
    const per = new RegExp(String.raw`(?:de|per[ií]odo\s+de)\s+${DATA}\s+(?:a|at[ée])\s+${DATA}`, 'i').exec(janela)
    const fi = new RegExp(String.raw`(?:t[ée]rmino(?:\s+previsto)?|encerrando-se|vencimento)\s+(?:em|a|no\s+dia|de)?\s*${DATA}`, 'i').exec(janela)
    if (!mm && !ini && !per && !fi) continue
    meses = mm ? Number(mm[1] ?? mm[2] ?? mm[3]) : null
    inicio = ini ? lerData(ini[1]) : per ? lerData(per[1]) : null
    fim = fi ? lerData(fi[1]) : per ? lerData(per[2]) : null
    inicioNaAssinatura = !inicio && /contad[oa]s?\s+(?:a\s+par\S{0,3}\s?r\s+)?da\s+(?:sua\s+|oportuna\s+)?assinatura|a\s+par\S{0,3}\s?r\s+d[ae]\s+(?:sua\s+)?assinatura/i.test(janela)
    break
  }
  if (inicio && fim && fim.getTime() <= inicio.getTime()) fim = null

  return {
    numeroDocumento,
    seiCliente,
    seiProdam,
    contratante,
    objeto,
    valor,
    assinaturaEm,
    inicio,
    fim,
    meses,
    inicioNaAssinatura,
    prorrogaVigencia: /prorroga\S*\s+(?:do\s+)?(?:prazo\s+de\s+)?vig[eê]ncia|fica\s+prorrogad/i.test(texto),
    semTexto,
  }
}

/** Fim da vigência a partir do início e do prazo em meses: 15/10/2023 + 12 meses → 14/10/2024. */
export function somarMeses(inicio: Date, meses: number): Date {
  const d = new Date(Date.UTC(inicio.getUTCFullYear(), inicio.getUTCMonth() + meses, inicio.getUTCDate()))
  d.setUTCDate(d.getUTCDate() - 1)
  return d
}
