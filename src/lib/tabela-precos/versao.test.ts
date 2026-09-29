import { dataDoNome, numeroDoInformativo, papelDoArquivo, versaoDoNome } from './versao'

it('versão do nome dos arquivos reais', () => {
  expect(versaoDoNome('Memória de Cálculo 2026 v3.0.xlsx')).toEqual({ versao: '2026 v3.0', ano: 2026, numero: '3.0', ordem: 20260300 })
  expect(versaoDoNome('Tabela de Preços PRODAM-SP 2026 v3.0.pdf')?.versao).toBe('2026 v3.0')
  expect(versaoDoNome('Tabela 2027 v1.pdf')?.versao).toBe('2027 v1.0')
  expect(versaoDoNome('Publicação DOC 21.09.2026.pdf')).toBeNull()
  expect(versaoDoNome('2026 v3.1')!.ordem).toBeGreaterThan(versaoDoNome('2026 v3.0')!.ordem)
  expect(versaoDoNome('2027 v1.0')!.ordem).toBeGreaterThan(versaoDoNome('2026 v9.9')!.ordem)
})

it('o informativo só traz o número da versão', () => {
  expect(numeroDoInformativo('INFORMATIVO Alterações Tabela de Preços v3.0.pdf')).toBe('3.0')
})

it.each([
  ['Memória de Cálculo 2026 v3.0.xlsx', 'planilha'],
  ['Tabela de Preços PRODAM-SP 2026 v3.0.pdf', 'pdf'],
  ['Publicação DOC 21.09.2026.pdf', 'publicacao'],
  ['Publicação + Tabela (DOC 21.09.2026).pdf', 'publicacao'],
  ['INFORMATIVO Alterações Tabela de Preços v3.0.pdf', 'informativo'],
  ['Rascunho.docx', null],
])('papel de %s', (nome, papel) => {
  expect(papelDoArquivo(nome)).toBe(papel)
})

it('data do nome (DOC 21.09.2026)', () => {
  expect(dataDoNome('Publicação DOC 21.09.2026.pdf')).toEqual(new Date(Date.UTC(2026, 8, 21)))
  expect(dataDoNome('sem data.pdf')).toBeNull()
})
