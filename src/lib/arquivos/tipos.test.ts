import { categoriaDoDocumento, contentTypeDe, extensaoDe, formatarTamanho, rotuloCategoria, sugerirCategoria } from './tipos'

describe('sugerirCategoria', () => {
  it.each([
    ['PC_SMS_211014_136_v4.0.pdf', 'PROPOSTA_COMERCIAL'],
    ['pa-sme-aditivo-2.pdf', 'PROPOSTA_ADITIVO'],
    ['TC 012-2020.pdf', 'TERMO_CONTRATO'],
    ['ta_003_2024.pdf', 'TERMO_ADITIVO'],
    ['Medição agosto 2026.xlsx', 'MEDICAO'],
    ['levantamento_08.XLSX', 'MEDICAO'],
    ['levantamento.pdf', 'OUTRO'],
    ['pcsms.pdf', 'OUTRO'],
    ['planilha de preços.xlsx', 'OUTRO'],
    ['foto.jpg', 'OUTRO'],
  ])('%s → %s', (nome, esperado) => {
    expect(sugerirCategoria(nome)).toBe(esperado)
  })
})

describe('categoriaDoDocumento', () => {
  it.each([
    ['xlsx', 'PLANILHA'],
    ['csv', 'PLANILHA'],
    ['pdf', 'OUTRO'],
    ['docx', 'OUTRO'],
  ])('%s → %s', (tipo, esperado) => {
    expect(categoriaDoDocumento(tipo)).toBe(esperado)
  })
})

describe('extensaoDe / contentTypeDe', () => {
  it('extensão em minúsculas, vazia sem ponto', () => {
    expect(extensaoDe('Relatório.Final.PDF')).toBe('pdf')
    expect(extensaoDe('LEIAME')).toBe('')
  })

  it('content type conhecido ou octet-stream', () => {
    expect(contentTypeDe('a.pdf')).toBe('application/pdf')
    expect(contentTypeDe('a.xlsx')).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    expect(contentTypeDe('a.docx')).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    expect(contentTypeDe('a.xyz')).toBe('application/octet-stream')
  })
})

describe('rotuloCategoria / formatarTamanho', () => {
  it('rótulo em português', () => {
    expect(rotuloCategoria('PROPOSTA_COMERCIAL')).toBe('Proposta comercial')
    expect(rotuloCategoria('OFICIO_SEI')).toBe('Ofício / SEI')
  })

  it('tamanho legível', () => {
    expect(formatarTamanho(512)).toBe('512 B')
    expect(formatarTamanho(2048)).toBe('2 KB')
    expect(formatarTamanho(5 * 1024 * 1024)).toBe('5.0 MB')
  })
})
