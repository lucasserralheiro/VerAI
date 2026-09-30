import { categoriaDoCaminho, competenciaDoCaminho, contratoDoArquivo, siglaDoArquivo } from './caminho'

const base = 'FATURAMENTO SERVIÇOS PRODAM/Links MPLS - Relatórios para Faturamento'

it('competência pela pasta do mês, nunca pelo nome do arquivo', () => {
  expect(competenciaDoCaminho(`${base}/2025/2025.01 - Relatórios de Janeiro de 2025/Links - Solução/CGM 02-2025 - Links - TC 16-CGM -2024.pdf`)).toEqual({ ano: 2025, mes: 1 })
  expect(competenciaDoCaminho(`${base}/2025/2025.10- Relatórios de Outubro de 2025/Links Solução/SMS 10-2025.pdf`)).toEqual({ ano: 2025, mes: 10 })
  expect(competenciaDoCaminho(`${base}/2025/avulso.pdf`)).toBeNull()
})

it.each([
  ['Gerencimento de Links', 'GERENCIAMENTO'],
  ['Links Sociais', 'SOCIAL'],
  ['Link Social', 'SOCIAL'],
  ['Links Social', 'SOCIAL'],
  ['Links - Solução', 'SOLUCAO'],
  ['Link Solução', 'SOLUCAO'],
  ['Links Solução', 'SOLUCAO'],
  ['Diversos', 'OUTRA'],
])('categoria da pasta "%s"', (pasta, categoria) => {
  expect(categoriaDoCaminho(`${base}/2026/2026.09 - Relatórios de Setembro de 2026/${pasta}/X 09-2026.pdf`)).toBe(categoria)
})

it('sigla e contrato do nome do arquivo', () => {
  expect(siglaDoArquivo('CGM 09-2026 - Links - TC 16-CGM -2024.pdf')).toBe('CGM')
  expect(siglaDoArquivo('SMSUB 09-2026- Links - TC001-SMSUB-COGEL-2026.pdf')).toBe('SMSUB')
  expect(contratoDoArquivo('CGM 09-2026 - Links - TC 16-CGM -2024.pdf')).toBe('TC 16-CGM -2024')
  expect(contratoDoArquivo('SMS 04-2025 - Links - TC 142-2021 (Indenização).pdf')).toBe('TC 142-2021')
  expect(contratoDoArquivo('SMSUB 09-2026- Links - TC001-SMSUB-COGEL-2026.pdf')).toBe('TC001-SMSUB-COGEL-2026')
})
