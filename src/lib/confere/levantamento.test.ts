/** @jest-environment node */
import { readFileSync } from 'node:fs'
import path from 'node:path'

import JSZip from 'jszip'

import {
  competenciaDaData,
  lerCabecalhoDoLevantamento,
  LevantamentoIlegivel,
  MENSAGEM_NAO_ABRE,
  MENSAGEM_SEM_ABA,
} from './levantamento'

const FIXTURES = path.join(process.cwd(), 'services/confere/backend/tests/fixtures')

/** XLSX mínimo, só com as partes que o leitor abre. `linhas[i][j]` vai para a linha i+1, coluna j. */
async function planilha(opcoes: {
  linhas: string[][]
  aba?: string
  alvo?: string
  inline?: boolean
}): Promise<Uint8Array> {
  const zip = new JSZip()
  zip.file(
    'xl/workbook.xml',
    `<workbook xmlns:r="r"><sheets><sheet name="Capa" sheetId="1" r:id="rId1"/><sheet name="${opcoes.aba ?? 'Levantamento'}" sheetId="2" r:id="rId2"/></sheets></workbook>`
  )
  zip.file(
    'xl/_rels/workbook.xml.rels',
    `<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Target="${opcoes.alvo ?? 'worksheets/sheet2.xml'}"/></Relationships>`
  )
  const textos: string[] = []
  const linhas = opcoes.linhas
    .map((celulas, i) => {
      const xml = celulas
        .map((valor, j) => {
          if (!valor) return ''
          const referencia = `${String.fromCharCode(65 + j)}${i + 1}`
          if (opcoes.inline) return `<c r="${referencia}" t="inlineStr"><is><t>${valor}</t></is></c>`
          textos.push(valor)
          return `<c r="${referencia}" t="s"><v>${textos.length - 1}</v></c>`
        })
        .join('')
      return `<row r="${i + 1}">${xml}</row>`
    })
    .join('')
  zip.file('xl/worksheets/sheet1.xml', '<worksheet><sheetData/></worksheet>')
  zip.file('xl/worksheets/sheet2.xml', `<worksheet><sheetData>${linhas}</sheetData></worksheet>`)
  zip.file('xl/sharedStrings.xml', `<sst>${textos.map((t) => `<si><t>${t}</t></si>`).join('')}</sst>`)
  return zip.generateAsync({ type: 'uint8array' })
}

const CABECALHO_CGM = [
  ['LEVANTAMENTO - COMPROVAÇÃO CGM'],
  [],
  ['Data do Levantamento : 03/08/2026', '', '', 'Quantidade', 'Quantidade'],
  ['*Valores conforme contrato : TC 16/CGM/2024', '', '', 'Contratada*', 'Medida'],
]

describe('lerCabecalhoDoLevantamento', () => {
  it('lê o levantamento real do SMIT (piloto do Confere)', async () => {
    const cabecalho = await lerCabecalhoDoLevantamento(readFileSync(path.join(FIXTURES, 'levantamento.xlsx')))
    expect(cabecalho).toEqual({
      titulo: 'LEVANTAMENTO - COMPROVAÇÃO SMIT SUSTENTAÇÃO - CATÁLOGO DE SERVIÇOS DIT',
      dataLevantamento: '2026-07-15',
      contratoReferencia: 'TC 52/SMIT/2024',
    })
  })

  it('lê o levantamento real do PGM', async () => {
    const cabecalho = await lerCabecalhoDoLevantamento(readFileSync(path.join(FIXTURES, 'levantamento_pgm.xlsx')))
    expect(cabecalho).toMatchObject({ dataLevantamento: '2026-07-23', contratoReferencia: 'TC 015/PGM/2024' })
  })

  it('aceita o caminho relativo do Excel e o absoluto do openpyxl', async () => {
    for (const alvo of ['worksheets/sheet2.xml', '/xl/worksheets/sheet2.xml']) {
      const bytes = await planilha({ alvo, linhas: CABECALHO_CGM })
      await expect(lerCabecalhoDoLevantamento(bytes)).resolves.toEqual({
        titulo: 'LEVANTAMENTO - COMPROVAÇÃO CGM',
        dataLevantamento: '2026-08-03',
        contratoReferencia: 'TC 16/CGM/2024',
      })
    }
  })

  it('texto inline e entidades XML', async () => {
    const bytes = await planilha({
      inline: true,
      linhas: [
        ['COMPROVA&#199;&#195;O HSPM &amp; CIA'],
        [],
        ['Data do Levantamento : 17/08/2026'],
        ['*Valores conforme contrato : TC 387/2024'],
      ],
    })
    await expect(lerCabecalhoDoLevantamento(bytes)).resolves.toEqual({
      titulo: 'COMPROVAÇÃO HSPM & CIA',
      dataLevantamento: '2026-08-17',
      contratoReferencia: 'TC 387/2024',
    })
  })

  it('texto rico: junta as corridas e ignora a leitura fonética', async () => {
    const zip = new JSZip()
    zip.file('xl/workbook.xml', '<workbook><sheets><sheet name="Levantamento" sheetId="1" r:id="rId1"/></sheets></workbook>')
    zip.file(
      'xl/_rels/workbook.xml.rels',
      '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>'
    )
    zip.file(
      'xl/worksheets/sheet1.xml',
      '<worksheet><sheetData><row r="4"><c r="A4" t="s"><v>0</v></c></row></sheetData></worksheet>'
    )
    zip.file(
      'xl/sharedStrings.xml',
      '<sst><si><r><t xml:space="preserve">*Valores conforme contrato : </t></r><r><rPr><b/></rPr><t>TC 52/SMIT/2024</t></r><rPh><t>ふりがな</t></rPh></si></sst>'
    )
    const cabecalho = await lerCabecalhoDoLevantamento(await zip.generateAsync({ type: 'uint8array' }))
    expect(cabecalho.contratoReferencia).toBe('TC 52/SMIT/2024')
  })

  it('só olha as dez primeiras linhas, como o Confere', async () => {
    const linhas: string[][] = Array.from({ length: 10 }, () => [''])
    linhas.push(['*Valores conforme contrato : TC 16/CGM/2024'])
    await expect(lerCabecalhoDoLevantamento(await planilha({ linhas }))).resolves.toMatchObject({
      contratoReferencia: null,
    })
  })

  it('data impossível não vira data', async () => {
    const bytes = await planilha({ linhas: [['x'], ['Data do Levantamento : 31/02/2026']] })
    await expect(lerCabecalhoDoLevantamento(bytes)).resolves.toMatchObject({ dataLevantamento: null })
  })

  it('sem a aba Levantamento: a mesma frase do Confere', async () => {
    const bytes = await planilha({ aba: 'Plan1', linhas: [['x']] })
    await expect(lerCabecalhoDoLevantamento(bytes)).rejects.toThrow(MENSAGEM_SEM_ABA)
  })

  it('arquivo que não é xlsx', async () => {
    const promessa = lerCabecalhoDoLevantamento(new TextEncoder().encode('não é zip'))
    await expect(promessa).rejects.toBeInstanceOf(LevantamentoIlegivel)
    await expect(lerCabecalhoDoLevantamento(new TextEncoder().encode('não é zip'))).rejects.toThrow(MENSAGEM_NAO_ABRE)
  })
})

describe('competenciaDaData', () => {
  it('mês e ano da data do levantamento', () => {
    expect(competenciaDaData('2026-08-03')).toEqual({ ano: 2026, mes: 8 })
  })

  it('sem data', () => {
    expect(competenciaDaData(null)).toBeNull()
  })
})
