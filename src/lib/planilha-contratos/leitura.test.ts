/** @jest-environment node */
import ExcelJS from 'exceljs'
import { lerPlanilhaDeContratos } from './leitura'

// O mesmo cabeçalho da aba BaseContratos de "2026.01 - Contratos Receita.xlsx" (linha 3, coluna A vazia).
const CAB = [
  null, 'ORDEM', 'Gerência', 'Gerente/Gestor', 'Coordenador/Gestor', 'Cliente Antes', 'CLIENTE', 'Descrição', 'Proposta',
  'Versão Proposta', 'Data Proposta', 'CONTRATO PROTHEUS', 'Vínculo Contrato anterior', 'Contrato', 'Termo Aditivo',
  'TIPO DE TERMO', 'Início Contrato', 'Término Contrato ', 'Prazo para o vcto. Contrato (dias)', 'Valor Aditivo / Contrato (R$)',
  'STATUS VIGÊNCIA', 'STATUS FORMALIZAÇÃO', 'SEI PRODAM', 'SEI CLIENTE',
]
const d = (a: number, m: number, dia: number) => new Date(Date.UTC(a, m - 1, dia))
const linha = (cliente: string, contrato: string, termo: string, tipo: string, inicio: Date, fim: Date, valor: number | string, status = 'CONTRATAÇÃO CONCLUÍDA') => [
  null, 1, 'GRC-3', 'X', 'Y', 'ANTIGO', cliente, 'Sustentação', 'PC-1', '1.0', null, 2888, '-', contrato, termo, tipo, inicio, fim, 10, valor, 'VENCIDO', status, '7010.2022/0011902-0', '6076.2022/0000497-2',
]

async function planilha(linhas: unknown[][], aba = 'BaseContratos'): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  wb.addWorksheet('Resumo VIGENTES').addRow(['CONTRATOS VIGENTES'])
  const ws = wb.addWorksheet(aba)
  ws.addRow([])
  ws.addRow([])
  for (const l of linhas) ws.addRow(l)
  return Buffer.from(await wb.xlsx.writeBuffer())
}

it('lê cada termo com chave do contrato, nº do termo, valor, vigência e status', async () => {
  const r = await lerPlanilhaDeContratos(
    await planilha([
      CAB,
      linha('SMTUR', 'TC 001/2023-SMTUR', '-', 'Contrato inicial', d(2023, 1, 6), d(2024, 1, 5), 248147.76),
      linha('SMTUR', 'TC 001/2023-SMTUR', 'TA 01', 'Acréscimo', d(2023, 7, 10), d(2024, 1, 5), 299801.6),
      linha('HSPM', 'TC 312/2021', 'TA 392/2022', 'Prorrogação', d(2022, 12, 10), d(2023, 12, 9), '442.774,40 ', 'Despacho publicado'),
    ])
  )
  if ('erro' in r) throw new Error(r.erro)
  expect(r.linhas).toEqual([
    {
      linha: 4, sigla: 'SMTUR', contratoTexto: 'TC 001/2023-SMTUR', chave: 'SMTUR|1 2023', termoTexto: null, termoNumero: 0, tipoTermo: 'Contrato inicial',
      valor: '248147.76', inicio: d(2023, 1, 6), fim: d(2024, 1, 5), statusFormalizacao: 'CONTRATAÇÃO CONCLUÍDA',
    },
    {
      linha: 5, sigla: 'SMTUR', contratoTexto: 'TC 001/2023-SMTUR', chave: 'SMTUR|1 2023', termoTexto: 'TA 01', termoNumero: 1, tipoTermo: 'Acréscimo',
      valor: '299801.60', inicio: d(2023, 7, 10), fim: d(2024, 1, 5), statusFormalizacao: 'CONTRATAÇÃO CONCLUÍDA',
    },
    {
      linha: 6, sigla: 'HSPM', contratoTexto: 'TC 312/2021', chave: 'HSPM|312 2021', termoTexto: 'TA 392/2022', termoNumero: 392, tipoTermo: 'Prorrogação',
      valor: '442774.40', inicio: d(2022, 12, 10), fim: d(2023, 12, 9), statusFormalizacao: 'Despacho publicado',
    },
  ])
})

it('termo "-" que não é contrato inicial fica sem número; linha sem contrato é ignorada', async () => {
  const r = await lerPlanilhaDeContratos(
    await planilha([CAB, linha('SMJ', 'TC 001/SMJ/2021', '-', 'Alteração Titularidade', d(2022, 2, 1), d(2022, 3, 2), -932.7), linha('SMJ', '', '-', 'x', d(2022, 2, 1), d(2022, 3, 2), 1)])
  )
  if ('erro' in r) throw new Error(r.erro)
  expect(r.linhas).toHaveLength(1)
  expect(r.linhas[0]).toMatchObject({ termoNumero: null, valor: '-932.70' })
})

it('sem o cabeçalho: erro', async () => {
  expect(await lerPlanilhaDeContratos(await planilha([['a', 'b']]))).toEqual({ erro: 'nenhuma aba com o cabeçalho CLIENTE / Contrato / Termo Aditivo / TIPO DE TERMO / Valor' })
})
