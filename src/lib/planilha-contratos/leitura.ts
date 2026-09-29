import ExcelJS from 'exceljs'
import { valorBr } from '@/lib/controles-contratos/leitura'
import { chaveNumerica } from '@/lib/relatorios-clientes/vincular-itens'

// Aba "BaseContratos" da planilha "Contratos Receita" (spec docs/superpowers/specs/2026-09-29-valor-vigencia-contratos-design.md
// §0.5): uma linha por termo. A aba é achada pelo cabeçalho. Nada aqui decide valor de contrato — é fonte de
// prova para `src/lib/valores-contratos/decidir.ts`.

export interface LinhaPlanilhaLida {
  linha: number
  sigla: string
  contratoTexto: string
  /** "SIGLA|nº ano" — a chave da sincronização do SharePoint. */
  chave: string | null
  termoTexto: string | null
  /** 0 = contrato inicial; n = nº do termo; null = sem número. */
  termoNumero: number | null
  tipoTermo: string | null
  valor: string | null
  inicio: Date | null
  fim: Date | null
  statusFormalizacao: string | null
}

const normal = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim()

type Coluna = 'cliente' | 'contrato' | 'termo' | 'tipo' | 'inicio' | 'fim' | 'valor' | 'status'
// Igualdade onde há colunas parecidas ("Cliente Antes", "CONTRATO PROTHEUS", "Vínculo Contrato anterior").
const COLUNAS: Record<Coluna, (t: string) => boolean> = {
  cliente: (t) => t === 'CLIENTE',
  contrato: (t) => t === 'CONTRATO',
  termo: (t) => t === 'TERMO ADITIVO',
  tipo: (t) => t === 'TIPO DE TERMO',
  inicio: (t) => t === 'INICIO CONTRATO',
  fim: (t) => t === 'TERMINO CONTRATO',
  valor: (t) => t.startsWith('VALOR ADITIVO'),
  status: (t) => t === 'STATUS FORMALIZACAO',
}

function bruto(valor: ExcelJS.CellValue): unknown {
  if (valor && typeof valor === 'object' && !(valor instanceof Date)) {
    if ('result' in valor) return valor.result ?? null
    if ('richText' in valor) return valor.richText.map((r) => r.text).join('')
    if ('text' in valor) return valor.text
    return null
  }
  return valor ?? null
}

const texto = (v: unknown) => (v === null || v === undefined ? '' : String(v).trim())
const data = (v: unknown) => (v instanceof Date && !Number.isNaN(v.getTime()) ? new Date(Date.UTC(v.getUTCFullYear(), v.getUTCMonth(), v.getUTCDate())) : null)
function valor(v: unknown): string | null {
  if (typeof v === 'number') return (Math.round(v * 100) / 100).toFixed(2)
  return typeof v === 'string' ? valorBr(v) : null
}

export async function lerPlanilhaDeContratos(conteudo: Buffer): Promise<{ linhas: LinhaPlanilhaLida[] } | { erro: string }> {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(conteudo as unknown as ArrayBuffer)
  for (const ws of wb.worksheets) {
    let cab: { linha: number; col: Record<Coluna, number> } | null = null
    for (let l = 1; l <= Math.min(ws.rowCount, 20) && !cab; l++) {
      const col: Partial<Record<Coluna, number>> = {}
      const row = ws.getRow(l)
      for (let c = 1; c <= ws.columnCount; c++) {
        const t = normal(texto(bruto(row.getCell(c).value)))
        for (const [k, casa] of Object.entries(COLUNAS) as [Coluna, (t: string) => boolean][]) if (col[k] === undefined && casa(t)) col[k] = c
      }
      if ((Object.keys(COLUNAS) as Coluna[]).every((k) => col[k] !== undefined)) cab = { linha: l, col: col as Record<Coluna, number> }
    }
    if (!cab) continue
    const linhas: LinhaPlanilhaLida[] = []
    for (let l = cab.linha + 1; l <= ws.rowCount; l++) {
      const row = ws.getRow(l)
      const celula = (k: Coluna) => bruto(row.getCell(cab!.col[k]).value)
      const contratoTexto = texto(celula('contrato'))
      const sigla = texto(celula('cliente')).toUpperCase()
      if (!contratoTexto || !sigla) continue
      const termoBruto = texto(celula('termo'))
      const tipoTermo = texto(celula('tipo')) || null
      const semTermo = !termoBruto || termoBruto === '-'
      const numero = semTermo ? null : /(\d+)/.exec(termoBruto)?.[1]
      const chaveNum = chaveNumerica(contratoTexto)
      linhas.push({
        linha: l,
        sigla,
        contratoTexto,
        chave: chaveNum ? `${sigla}|${chaveNum}` : null,
        termoTexto: semTermo ? null : termoBruto,
        termoNumero: semTermo ? (tipoTermo && /inicial/i.test(tipoTermo) ? 0 : null) : numero ? Number(numero) : null,
        tipoTermo,
        valor: valor(celula('valor')),
        inicio: data(celula('inicio')),
        fim: data(celula('fim')),
        statusFormalizacao: texto(celula('status')) || null,
      })
    }
    return { linhas }
  }
  return { erro: 'nenhuma aba com o cabeçalho CLIENTE / Contrato / Termo Aditivo / TIPO DE TERMO / Valor' }
}
