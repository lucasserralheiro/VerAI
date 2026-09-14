import ExcelJS from 'exceljs'
import { Readable } from 'node:stream'
import { escaparHtml } from './escaparHtml'

// Amostra que vai pro preview na tela (module 5) — limitado por performance do navegador.
const PREVIEW_MAX_LINHAS = 30

// Amostra que vai pro prompt da IA (module 1) — maior, pra análise mais completa.
// As estatísticas básicas já cobrem 100% das linhas independente desse limite.
const ANALISE_MAX_LINHAS = 300

interface PlanilhaCarregada {
  planilha: ExcelJS.Worksheet
  cabecalho: string[]
  linhas: unknown[][]
}

/**
 * O ExcelJS não devolve valor "cru" pra célula de fórmula, texto rico,
 * hyperlink ou erro — devolve um objeto (`{ formula, result }`,
 * `{ richText: [...] }`, `{ text, hyperlink }`, `{ error }`). Sem
 * desembrulhar isso aqui, qualquer coluna calculada (ex.: preço, margem)
 * cai direto num `String(v)` mais adiante e aparece como "[object Object]"
 * na tela — foi o que aconteceu com a planilha de custos. Resolve
 * recursivamente pro valor de exibição de verdade (resultado da fórmula,
 * texto visível do hyperlink, texto concatenado do rich text, código do
 * erro), preservando number/string/boolean/Date como estão.
 */
function normalizarValorCelula(valor: unknown): unknown {
  if (valor === null || valor === undefined) return valor
  if (typeof valor !== 'object' || valor instanceof Date) return valor

  if ('formula' in valor || 'sharedFormula' in valor) {
    return normalizarValorCelula((valor as ExcelJS.CellFormulaValue).result)
  }
  if ('error' in valor) {
    return (valor as ExcelJS.CellErrorValue).error
  }
  if ('richText' in valor) {
    return (valor as ExcelJS.CellRichTextValue).richText.map((trecho) => trecho.text).join('')
  }
  if ('text' in valor && 'hyperlink' in valor) {
    return (valor as ExcelJS.CellHyperlinkValue).text
  }

  // Formato de célula que a lib ainda não modela explicitamente — melhor
  // aparecer o conteúdo serializado do que silenciosamente "[object Object]".
  try {
    return JSON.stringify(valor)
  } catch {
    return String(valor)
  }
}

async function carregarWorkbook(buffer: Buffer, tipo: 'xlsx' | 'csv'): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook()
  if (tipo === 'csv') {
    await workbook.csv.read(Readable.from(buffer))
  } else {
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer)
  }
  return workbook
}

/** Devolve exatamente `tamanho` células a partir de `linha` — preenche com
 *  `null` o que faltar. Necessário porque o `row.values` do ExcelJS NÃO tem
 *  tamanho fixo por planilha: cada linha só vem até a última célula
 *  preenchida NAQUELA linha, então uma linha cujo último valor está mais à
 *  esquerda que as outras chega mais curta que o cabeçalho. Sem preencher,
 *  as linhas da tabela final ficam com números de coluna diferentes entre
 *  si — o Markdown resultante não é reconhecido como tabela válida (as
 *  linhas viram um parágrafo só, tudo colado) mesmo com os dados corretos. */
function preencherAte<T>(linha: T[], tamanho: number): (T | null)[] {
  const resultado: (T | null)[] = new Array(tamanho).fill(null)
  for (let c = 0; c < tamanho && c < linha.length; c++) {
    resultado[c] = linha[c]
  }
  return resultado
}

/** Extrai cabeçalho + linhas de UMA aba, já sem o "lixo" de formatação.
 *  Devolve `null` quando a aba não tem nenhuma linha de dado real. */
function processarPlanilha(planilha: ExcelJS.Worksheet): PlanilhaCarregada | null {
  if (planilha.rowCount === 0) return null

  const cabecalhoBruto = (planilha.getRow(1).values as unknown[]).slice(1).map(normalizarValorCelula)
  const linhasBrutas: unknown[][] = []
  for (let i = 2; i <= planilha.rowCount; i++) {
    linhasBrutas.push((planilha.getRow(i).values as unknown[]).slice(1).map(normalizarValorCelula))
  }

  // O `rowCount`/tamanho de linha do ExcelJS reflete a formatação da
  // planilha (ex.: um estilo de tabela aplicado a uma faixa maior do que
  // os dados reais), não só as células preenchidas — sem filtrar isso, a
  // conversão carrega uma penca de linhas e colunas vazias como "lixo"
  // pro documento final. Mantém só linha com pelo menos um valor real, e
  // corta colunas totalmente vazias em todas as linhas (incluindo o
  // cabeçalho) a partir da direita.
  //
  // "Vazio" aqui é célula sem NENHUM caractere (null/undefined/""). Uma
  // célula com só espaços conta como valor e é preservada — na Proposta
  // Comercial o conteúdo tem que ser fiel ao original, então não se descarta
  // linha/coluna que a pessoa preencheu de propósito, mesmo que só com
  // espaço em branco.
  const temValor = (v: unknown) => v !== null && v !== undefined && String(v) !== ''
  const linhasComDado = linhasBrutas.filter((linha) => linha.some(temValor))

  let ultimaColunaComDado = -1
  for (let c = Math.max(cabecalhoBruto.length, ...linhasComDado.map((l) => l.length), 0) - 1; c >= 0; c--) {
    const colunaTemDado = temValor(cabecalhoBruto[c]) || linhasComDado.some((l) => temValor(l[c]))
    if (colunaTemDado) {
      ultimaColunaComDado = c
      break
    }
  }

  const cabecalho = preencherAte(cabecalhoBruto, ultimaColunaComDado + 1).map((v) => String(v ?? ''))
  const linhas = linhasComDado.map((l) => preencherAte(l, ultimaColunaComDado + 1))

  return linhas.length > 0 ? { planilha, cabecalho, linhas } : null
}

/** Primeira aba que TEM dados — exports reais de faturamento costumam ter uma
 *  aba de capa/resumo vazia antes da aba com os registros de verdade. Usada
 *  onde só faz sentido uma tabela (preview na tela, extração com amostragem). */
async function carregarPrimeiraPlanilha(buffer: Buffer, tipo: 'xlsx' | 'csv'): Promise<PlanilhaCarregada | null> {
  const workbook = await carregarWorkbook(buffer, tipo)
  for (const planilha of workbook.worksheets) {
    const processada = processarPlanilha(planilha)
    if (processada) return processada
  }
  return null
}

/** TODAS as abas que têm dados, na ordem do arquivo — usada na conversão
 *  determinística da Proposta Comercial, onde nenhuma aba pode ser descartada. */
async function carregarPlanilhasComDados(buffer: Buffer, tipo: 'xlsx' | 'csv'): Promise<PlanilhaCarregada[]> {
  const workbook = await carregarWorkbook(buffer, tipo)
  return workbook.worksheets
    .map(processarPlanilha)
    .filter((p): p is PlanilhaCarregada => p !== null)
}

export interface PreviewPlanilha {
  cabecalho: string[]
  linhas: string[][]
  totalLinhas: number
  truncado: boolean
}

export async function lerPlanilhaPreview(buffer: Buffer, tipo: 'xlsx' | 'csv'): Promise<PreviewPlanilha> {
  const dados = await carregarPrimeiraPlanilha(buffer, tipo)
  if (!dados) {
    return { cabecalho: [], linhas: [], totalLinhas: 0, truncado: false }
  }

  const { cabecalho, linhas } = dados
  return {
    cabecalho,
    linhas: linhas.slice(0, PREVIEW_MAX_LINHAS).map((linha) => linha.map((v) => String(v ?? ''))),
    totalLinhas: linhas.length,
    truncado: linhas.length > PREVIEW_MAX_LINHAS,
  }
}

function celulaHtml(valor: string, tag: 'td' | 'th'): string {
  return `<${tag}>${escaparHtml(valor)}</${tag}>`
}

/** Converte UMA aba numa tabela HTML (todas as linhas, sem amostragem nem
 *  estatística). */
function planilhaParaTabelaHtml({ cabecalho, linhas }: PlanilhaCarregada): string {
  const linhaCabecalho = `<tr>${cabecalho.map((c) => celulaHtml(c || '', 'th')).join('')}</tr>`
  const linhasCorpo = linhas.map((l) => `<tr>${l.map((v) => celulaHtml(String(v ?? ''), 'td')).join('')}</tr>`).join('')
  return `<table><thead>${linhaCabecalho}</thead><tbody>${linhasCorpo}</tbody></table>`
}

/** Converte a planilha inteira (todas as abas com dados, todas as linhas, sem
 *  amostragem nem estatística) em HTML — determinístico, sem IA. Usado na
 *  Proposta Comercial, onde o conteúdo final tem que ser fiel ao original, só
 *  formatado. Com mais de uma aba, cada uma vira uma seção sob o próprio nome;
 *  nenhuma aba é descartada. */
export async function converterPlanilhaParaHtml(buffer: Buffer, tipo: 'xlsx' | 'csv'): Promise<string> {
  const abas = await carregarPlanilhasComDados(buffer, tipo)
  if (abas.length === 0) {
    return '<p><em>Planilha vazia — nenhum dado encontrado.</em></p>'
  }

  if (abas.length === 1) {
    return planilhaParaTabelaHtml(abas[0])
  }

  return abas
    .map((aba) => `<h2>${escaparHtml(aba.planilha.name)}</h2>${planilhaParaTabelaHtml(aba)}`)
    .join('<hr>')
}

export async function extrairExcel(buffer: Buffer, tipo: 'xlsx' | 'csv'): Promise<string> {
  const dados = await carregarPrimeiraPlanilha(buffer, tipo)
  if (!dados) {
    return 'Planilha vazia — nenhum dado encontrado.'
  }
  const { planilha, cabecalho, linhas } = dados

  const tipos = cabecalho.map((_, colIdx) => {
    const valor = linhas[0]?.[colIdx]
    if (typeof valor === 'number') return 'número'
    if (valor instanceof Date) return 'data'
    return 'texto'
  })

  const estatisticas = cabecalho
    .map((nome, colIdx) => {
      if (tipos[colIdx] !== 'número') return null
      const valores = linhas
        .map((linha) => linha[colIdx])
        .filter((v): v is number => typeof v === 'number')
      if (valores.length === 0) return null
      const soma = valores.reduce((acc, v) => acc + v, 0)
      const min = Math.min(...valores)
      const max = Math.max(...valores)
      const media = soma / valores.length
      return `${nome}: min=${min}, máx=${max}, média=${media.toFixed(2)}, soma=${soma}`
    })
    .filter((linha): linha is string => linha !== null)

  const amostra = linhas.slice(0, ANALISE_MAX_LINHAS).map((linha) => linha.join(' | '))
  const amostraTruncada = linhas.length > ANALISE_MAX_LINHAS

  return [
    `Planilha: ${planilha.name}`,
    `Linhas de dados: ${linhas.length}`,
    `Colunas (${cabecalho.length}): ${cabecalho.map((nome, i) => `${nome} (${tipos[i]})`).join(', ')}`,
    '',
    amostraTruncada
      ? `Amostra (${ANALISE_MAX_LINHAS} das ${linhas.length} linhas — estatísticas abaixo cobrem todas as linhas):`
      : `Amostra (todas as ${linhas.length} linhas):`,
    cabecalho.join(' | '),
    ...amostra,
    '',
    estatisticas.length > 0 ? `Estatísticas básicas:\n${estatisticas.join('\n')}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}
