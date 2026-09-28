/** @jest-environment node */
import { chaveDeEnvio, chaveDoOriginalNoR2, chaveOriginalProposta, ehEnderecoDeEnvio, extensaoDeEnvio } from './envio'

const UUID = '0f8fad5b-d9cb-469f-a165-70867728950e'

describe('extensaoDeEnvio', () => {
  it('aceita pdf/xlsx/csv/docx, sem diferença de caixa', () => {
    expect(extensaoDeEnvio('Proposta Final.PDF')).toBe('pdf')
    expect(extensaoDeEnvio('itens.xlsx')).toBe('xlsx')
    expect(extensaoDeEnvio('itens.csv')).toBe('csv')
    expect(extensaoDeEnvio('carta.docx')).toBe('docx')
  })

  it('recusa o resto e nome sem extensão', () => {
    expect(extensaoDeEnvio('malware.exe')).toBeNull()
    expect(extensaoDeEnvio('pdf')).toBeNull()
    expect(extensaoDeEnvio('')).toBeNull()
  })
})

describe('chaveDeEnvio', () => {
  it('só uuid e extensão — o nome do arquivo não entra no caminho', () => {
    expect(chaveDeEnvio('pdf', UUID)).toBe(`tmp-uploads/${UUID}.pdf`)
    expect(chaveDeEnvio('docx')).toMatch(/^tmp-uploads\/[0-9a-f-]{36}\.docx$/)
    expect(chaveDeEnvio('pdf')).not.toBe(chaveDeEnvio('pdf'))
  })
})

describe('ehEnderecoDeEnvio', () => {
  it('aceita só o temporário do envio', () => {
    expect(ehEnderecoDeEnvio(`r2:tmp-uploads/${UUID}.pdf`)).toBe(true)
    expect(ehEnderecoDeEnvio(`r2:tmp-uploads/${UUID}.xlsx`)).toBe(true)
  })

  it('recusa arquivo de outro lugar do bucket, extensão estranha e URL do Blob', () => {
    expect(ehEnderecoDeEnvio(`r2:tmp-uploads/${UUID}.exe`)).toBe(false)
    expect(ehEnderecoDeEnvio('r2:clientes/c1/TC 1.pdf')).toBe(false)
    expect(ehEnderecoDeEnvio(`r2:tmp-uploads/../clientes/${UUID}.pdf`)).toBe(false)
    expect(ehEnderecoDeEnvio(`r2:tmp-uploads/${UUID}.pdf/../../x.pdf`)).toBe(false)
    expect(ehEnderecoDeEnvio('https://blob.vercel-storage.com/tmp-uploads/a.pdf')).toBe(false)
  })
})

describe('original da proposta no R2', () => {
  it('mora ao lado das imagens da proposta', () => {
    expect(chaveOriginalProposta('p1', 0, 'pdf')).toBe('propostas-comerciais/p1/0/original.pdf')
  })

  it('só reconhece como da proposta o que está na pasta dela', () => {
    expect(chaveDoOriginalNoR2('r2:propostas-comerciais/p1/0/original.pdf', 'p1')).toBe('propostas-comerciais/p1/0/original.pdf')
    expect(chaveDoOriginalNoR2('r2:propostas-comerciais/p10/0/original.pdf', 'p1')).toBeNull()
    expect(chaveDoOriginalNoR2('r2:clientes/c1/pc.pdf', 'p1')).toBeNull()
    expect(chaveDoOriginalNoR2('https://blob/2026/09/p1/0/original.pdf', 'p1')).toBeNull()
  })
})
