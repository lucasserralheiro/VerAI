import { areaDoCaminho, chaveR2Biblioteca, ehArea, podeVerArea } from './areas'

describe('areaDoCaminho', () => {
  it.each([
    ['TABELA DE PREÇOS PRODAM-SP/Tabela de Preços PRODAM-SP 2026 v3.0.pdf', 'TABELA_PRECOS'],
    ['tabela de precos prodam-sp/x.xlsx', 'TABELA_PRECOS'],
    ['FATURAMENTO SERVIÇOS PRODAM/Links MPLS - Relatórios para Faturamento/2026/a.pdf', 'LINKS_MPLS'],
    ['CALENDÁRIO FATURAMENTO/Calendário de Faturamento PRODAM 2026.pdf', 'CALENDARIO'],
    ['PLANILHA DE CONTRATOS DE RECEITA PRODAM/2026.01 - Contratos Receita.xlsx', 'PLANILHA_CONTRATOS'],
    ['OUTRA PASTA/qualquer.pdf', 'OUTRO'],
  ])('%s → %s', (caminho, area) => {
    expect(areaDoCaminho(caminho)).toBe(area)
  })
})

it('chave do R2 pelo conteúdo — dev e produção dividem o bucket', () => {
  expect(chaveR2Biblioteca('ab12', 'pdf')).toBe('biblioteca-documentos/ab12.pdf')
  expect(chaveR2Biblioteca('ab12', '')).toBe('biblioteca-documentos/ab12')
})

it('permissão por área: preços e calendário para todos, o resto só admin', () => {
  expect(podeVerArea('uploader', 'TABELA_PRECOS')).toBe(true)
  expect(podeVerArea('responsavel', 'CALENDARIO')).toBe(true)
  expect(podeVerArea('responsavel', 'LINKS_MPLS')).toBe(false)
  expect(podeVerArea('uploader', 'PLANILHA_CONTRATOS')).toBe(false)
  expect(podeVerArea('admin', 'OUTRO')).toBe(true)
})

it('ehArea', () => {
  expect(ehArea('TABELA_PRECOS')).toBe(true)
  expect(ehArea('tabela_precos')).toBe(false)
})
