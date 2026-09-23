/** @jest-environment node */
jest.mock('unpdf', () => ({
  getDocumentProxy: jest.fn(async () => ({})),
  extractTextItems: jest.fn(),
}))
jest.mock('@/lib/extracao', () => ({ extrairConteudo: jest.fn(async () => 'planilha em texto') }))

import { extractTextItems } from 'unpdf'
import { extrairPaginas, semCamadaDeTexto } from './extrair'

const item = (str: string, hasEOL = false) => ({ str, hasEOL })

describe('extrairPaginas', () => {
  it('PDF: uma entrada por página, respeitando fim de linha', async () => {
    ;(extractTextItems as jest.Mock).mockResolvedValue({
      totalPages: 2,
      items: [[item('Contrato', false), item('nº 031/2023', true), item('Objeto')], [item('Página dois')]],
    })
    expect(await extrairPaginas(Buffer.from('x'), 'pdf')).toEqual([
      { pagina: 1, texto: 'Contrato nº 031/2023\nObjeto' },
      { pagina: 2, texto: 'Página dois' },
    ])
  })

  it('PDF: aplica o reparo de camada de texto sem tocar token com dígito', async () => {
    ;(extractTextItems as jest.Mock).mockResolvedValue({
      totalPages: 1,
      items: [[item('licenşas'), item(' R$ 1.234,56')]],
    })
    const [pagina] = await extrairPaginas(Buffer.from('x'), 'pdf')
    expect(pagina.texto).toContain('licenças')
    expect(pagina.texto).toContain('1.234,56')
  })

  it('outros tipos: um bloco só, sem página', async () => {
    expect(await extrairPaginas(Buffer.from('x'), 'xlsx')).toEqual([{ pagina: null, texto: 'planilha em texto' }])
  })
})

describe('semCamadaDeTexto', () => {
  it('verdadeiro quando nenhuma página tem texto de verdade', () => {
    expect(semCamadaDeTexto([{ pagina: 1, texto: '  \n ' }, { pagina: 2, texto: '12' }])).toBe(true)
    expect(semCamadaDeTexto([{ pagina: 1, texto: 'Termo de contrato de prestação de serviços' }])).toBe(false)
  })
})
