/**
 * @jest-environment node
 */
import path from 'node:path'
import {
  buildUploadPath,
  getUploadFullPath,
  getUploadPublicUrl,
  buildRelatorioConsolidadoPath,
  buildRelatorioEvolucaoPath,
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

describe('getUploadFullPath', () => {
  const originalEnv = process.env.UPLOAD_DIR

  afterEach(() => {
    process.env.UPLOAD_DIR = originalEnv
  })

  it('junta UPLOAD_DIR com o caminho relativo', () => {
    process.env.UPLOAD_DIR = './uploads'
    expect(getUploadFullPath('2026/08/doc123/original.xlsx')).toBe(
      path.join('./uploads', '2026/08/doc123/original.xlsx')
    )
  })

  it('lança erro se UPLOAD_DIR não estiver configurado', () => {
    delete process.env.UPLOAD_DIR
    expect(() => getUploadFullPath('qualquer')).toThrow('UPLOAD_DIR não configurado')
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

describe('getUploadPublicUrl', () => {
  const originalEnv = process.env.UPLOAD_BASE_URL

  afterEach(() => {
    process.env.UPLOAD_BASE_URL = originalEnv
  })

  it('monta a URL pública juntando UPLOAD_BASE_URL com o caminho relativo', () => {
    process.env.UPLOAD_BASE_URL = 'http://localhost:3000/api/uploads'
    expect(getUploadPublicUrl('2026/08/doc123/original.xlsx')).toBe(
      'http://localhost:3000/api/uploads/2026/08/doc123/original.xlsx'
    )
  })

  it('lança erro se UPLOAD_BASE_URL não estiver configurado', () => {
    delete process.env.UPLOAD_BASE_URL
    expect(() => getUploadPublicUrl('qualquer')).toThrow('UPLOAD_BASE_URL não configurado')
  })
})
