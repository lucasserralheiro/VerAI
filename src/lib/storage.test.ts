/**
 * @jest-environment node
 */
import {
  buildUploadPath,
  buildRelatorioPath,
  buildRelatorioConsolidadoPath,
  buildRelatorioEvolucaoPath,
  buildDocumentoPrefix,
} from './storage'

describe('buildUploadPath', () => {
  it('monta o caminho relativo com ano/mes/documentoId/original.ext', () => {
    const data = new Date('2026-08-18T12:00:00Z')
    expect(buildUploadPath('doc123', 'xlsx', data)).toBe('2026/08/doc123/original.xlsx')
  })

  it('preenche o mês com zero à esquerda', () => {
    const data = new Date('2026-01-05T12:00:00Z')
    expect(buildUploadPath('doc456', 'pdf', data)).toBe('2026/01/doc456/original.pdf')
  })
})

describe('buildRelatorioPath', () => {
  it('monta o caminho relativo com ano/mes/documentoId/relatorio.pdf', () => {
    const data = new Date('2026-08-18T12:00:00Z')
    expect(buildRelatorioPath('doc123', data)).toBe('2026/08/doc123/relatorio.pdf')
  })
})

describe('buildRelatorioConsolidadoPath', () => {
  it('monta o caminho relativo com ano/mes/consolidadas/id/relatorio.pdf', () => {
    const data = new Date('2026-08-18T12:00:00Z')
    expect(buildRelatorioConsolidadoPath('cons123', data)).toBe('2026/08/consolidadas/cons123/relatorio.pdf')
  })
})

describe('buildRelatorioEvolucaoPath', () => {
  it('monta o caminho relativo com ano/mes/evolucoes/id/relatorio.pdf', () => {
    const data = new Date('2026-08-18T12:00:00Z')
    expect(buildRelatorioEvolucaoPath('evo123', data)).toBe('2026/08/evolucoes/evo123/relatorio.pdf')
  })
})

describe('buildDocumentoPrefix', () => {
  it('monta o prefixo ano/mes/documentoId/ pra apagar tudo do documento', () => {
    const data = new Date('2026-08-18T12:00:00Z')
    expect(buildDocumentoPrefix('doc123', data)).toBe('2026/08/doc123/')
  })
})
