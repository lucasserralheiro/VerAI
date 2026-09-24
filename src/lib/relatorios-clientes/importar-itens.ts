import ExcelJS from 'exceljs'
import { Readable } from 'stream'
import { Prisma } from '@prisma/client'
import { normalizarDecimal } from './numero'

/**
 * Leitura de planilha (.xlsx ou .csv) de itens de contrato — determinística, sem IA.
 *
 * A primeira linha é o cabeçalho. Colunas reconhecidas (sem diferenciar acento/caixa):
 * descrição (descricao, produto, item), quantidade (qtd), valor unitário (vl unit) e valor total
 * (vl total). Precisa de descrição e de valor total — ou de quantidade + valor unitário, caso em
 * que o total é quantidade × unitário. Valores aceitam célula numérica ou texto pt-BR
 * ("R$ 1.234,56").
 */

export const LIMITE_LINHAS_IMPORTACAO = 500

export interface LinhaItemImportada {
  /** Linha na planilha (1 = cabeçalho), pra apontar o erro pro usuário. */
  linha: number
  descricao: string | null
  quantidade: string | null
  valorUnitario: string | null
  valorTotal: string
}

export interface ErroImportacao {
  /** 0 = erro do arquivo como um todo. */
  linha: number
  mensagem: string
}

export interface ResultadoLeitura {
  linhas: LinhaItemImportada[]
  erros: ErroImportacao[]
}

type Coluna = 'descricao' | 'quantidade' | 'valorUnitario' | 'valorTotal'

const SINONIMOS: Record<Coluna, string[]> = {
  descricao: ['descricao', 'descricao produto', 'produto', 'item', 'servico', 'descricao do item'],
  quantidade: ['quantidade', 'qtd', 'qtde'],
  valorUnitario: ['valor unitario', 'vl unit', 'vl unitario', 'preco unitario', 'unitario'],
  valorTotal: ['valor total', 'vl total', 'total', 'valor'],
}

function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function textoDaCelula(valor: ExcelJS.CellValue): string {
  if (valor === null || valor === undefined) return ''
  if (valor instanceof Date) return valor.toISOString()
  if (typeof valor === 'object') {
    if ('richText' in valor) return valor.richText.map((parte) => parte.text).join('')
    if ('result' in valor && valor.result !== undefined) return textoDaCelula(valor.result as ExcelJS.CellValue)
    if ('text' in valor) return String(valor.text)
    return ''
  }
  return String(valor).trim()
}

/** Texto de célula → decimal, pela MESMA regra da tela e do importador (`numero.ts`): "R$ 1.234,56" →
 *  "1234.56"; "1.234" é ambíguo e é recusado. `null` quando não é número válido. */
export function numeroPtBr(bruto: string): string | null {
  if (!bruto.replace(/R\$|\s/gi, '')) return null
  const lido = normalizarDecimal(bruto)
  return 'valor' in lido ? lido.valor : null
}

/** Célula numérica do Excel vai direto (número JS nunca é ambíguo — `0.125` não pode virar 125);
 *  texto passa pela regra única. */
function lerNumeroDaCelula(valor: ExcelJS.CellValue): { valor: string } | { erro: string } | null {
  if (valor === null || valor === undefined) return null
  if (typeof valor === 'number') return normalizarDecimal(valor)
  if (typeof valor === 'object' && !(valor instanceof Date) && 'result' in valor && typeof valor.result === 'number') {
    return normalizarDecimal(valor.result)
  }
  const texto = textoDaCelula(valor)
  if (!texto.replace(/R\$|\s/gi, '')) return null
  return normalizarDecimal(texto)
}

async function carregarPlanilha(buffer: Buffer, nomeArquivo: string): Promise<ExcelJS.Worksheet> {
  const workbook = new ExcelJS.Workbook()
  if (/\.csv$/i.test(nomeArquivo)) {
    // `map` identidade: sem ele o ExcelJS converte "1.500" em 1.5 antes de a regra única ver o texto.
    return workbook.csv.read(Readable.from(buffer), {
      parserOptions: { delimiter: detectarSeparador(buffer) },
      map: (valor: string) => valor,
    })
  }
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer)
  const aba = workbook.worksheets[0]
  if (!aba) throw new Error('planilha sem abas')
  return aba
}

/** CSV brasileiro costuma vir com ";" (Excel pt-BR); cai pra "," quando o cabeçalho não tem ";". */
function detectarSeparador(buffer: Buffer): string {
  const primeiraLinha = buffer.toString('utf8').split(/\r?\n/, 1)[0] ?? ''
  return primeiraLinha.includes(';') ? ';' : ','
}

export async function lerPlanilhaItens(buffer: Buffer, nomeArquivo: string): Promise<ResultadoLeitura> {
  let aba: ExcelJS.Worksheet
  try {
    aba = await carregarPlanilha(buffer, nomeArquivo)
  } catch {
    return { linhas: [], erros: [{ linha: 0, mensagem: 'Não foi possível ler o arquivo. Envie um .xlsx ou .csv válido.' }] }
  }

  const colunas = new Map<Coluna, number>()
  aba.getRow(1).eachCell({ includeEmpty: false }, (celula, indice) => {
    const cabecalho = normalizar(textoDaCelula(celula.value))
    for (const [coluna, nomes] of Object.entries(SINONIMOS) as Array<[Coluna, string[]]>) {
      if (!colunas.has(coluna) && nomes.includes(cabecalho)) colunas.set(coluna, indice)
    }
  })

  const temTotal = colunas.has('valorTotal') || (colunas.has('quantidade') && colunas.has('valorUnitario'))
  if (!colunas.has('descricao') || !temTotal) {
    return {
      linhas: [],
      erros: [
        {
          linha: 0,
          mensagem:
            'Cabeçalho não reconhecido. A primeira linha precisa ter "Descrição" e "Valor total" (ou "Quantidade" e "Valor unitário").',
        },
      ],
    }
  }

  const linhas: LinhaItemImportada[] = []
  const erros: ErroImportacao[] = []
  const bruta = (numeroLinha: number, coluna: Coluna): ExcelJS.CellValue => {
    const indice = colunas.get(coluna)
    return indice ? aba.getRow(numeroLinha).getCell(indice).value : null
  }
  const ler = (numeroLinha: number, coluna: Coluna): string => textoDaCelula(bruta(numeroLinha, coluna))

  for (let numeroLinha = 2; numeroLinha <= aba.rowCount; numeroLinha++) {
    const descricao = ler(numeroLinha, 'descricao')
    const bruto = {
      quantidade: ler(numeroLinha, 'quantidade'),
      valorUnitario: ler(numeroLinha, 'valorUnitario'),
      valorTotal: ler(numeroLinha, 'valorTotal'),
    }
    if (!descricao && !bruto.quantidade && !bruto.valorUnitario && !bruto.valorTotal) continue // linha em branco

    if (linhas.length + erros.length >= LIMITE_LINHAS_IMPORTACAO) {
      erros.push({ linha: 0, mensagem: `A planilha passa de ${LIMITE_LINHAS_IMPORTACAO} linhas. Divida em arquivos menores.` })
      break
    }

    const numeros: Partial<Record<'quantidade' | 'valorUnitario' | 'valorTotal', string>> = {}
    let invalido = false
    for (const campo of ['quantidade', 'valorUnitario', 'valorTotal'] as const) {
      if (!bruto[campo]) continue
      const lido = lerNumeroDaCelula(bruta(numeroLinha, campo))
      if (lido === null) continue
      if ('erro' in lido) {
        erros.push({ linha: numeroLinha, mensagem: `${ROTULO[campo]} "${bruto[campo]}": ${lido.erro}` })
        invalido = true
      } else numeros[campo] = lido.valor
    }
    if (invalido) continue

    const valorTotal = numeros.valorTotal
      ? new Prisma.Decimal(numeros.valorTotal).toDecimalPlaces(2).toString()
      : numeros.quantidade && numeros.valorUnitario
        ? new Prisma.Decimal(numeros.quantidade).times(numeros.valorUnitario).toDecimalPlaces(2).toString()
        : null
    if (valorTotal === null) {
      erros.push({ linha: numeroLinha, mensagem: 'Sem valor total (nem quantidade × valor unitário)' })
      continue
    }

    linhas.push({
      linha: numeroLinha,
      descricao: descricao || null,
      quantidade: numeros.quantidade ? new Prisma.Decimal(numeros.quantidade).toDecimalPlaces(2).toString() : null,
      valorUnitario: numeros.valorUnitario ? new Prisma.Decimal(numeros.valorUnitario).toDecimalPlaces(2).toString() : null,
      valorTotal,
    })
  }

  if (linhas.length === 0 && erros.length === 0) {
    erros.push({ linha: 0, mensagem: 'A planilha não tem nenhuma linha de item abaixo do cabeçalho.' })
  }
  return { linhas, erros }
}

const ROTULO = { quantidade: 'Quantidade', valorUnitario: 'Valor unitário', valorTotal: 'Valor total' } as const
