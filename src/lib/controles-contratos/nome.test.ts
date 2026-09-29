import { chaveDoContratoTexto, contratoDoNome, mesDoCaminho } from './nome'

it.each([
  ['CGM - CO-16-CGM-2024 (Sust e Melhorias de TIC) - 2026.08.pdf', 'CGM', '16 2024'],
  ['HSPM - C.O.385-2023 - HSPM (Hospedagem) - 2026.08.pdf', 'HSPM', '385 2023'],
  ['COHAB - CO-086-21 (Sustentação) - 2026.06.pdf', 'COHAB', '86 2021'],
  ['SEGES - C.O. 24-SEGES-25- Sustentação - 2026.06.pdf', 'SEGES', '24 2025'],
  ['SMS - C.O.142-2021-TA 04 (Sustentação) - 2026.06.pdf', 'SMS', '142 2021'],
  ['ICI - C.O. S.N-2024 - 2026.08.pdf', 'ICI', null],
])('%s', (nome, sigla, chave) => {
  expect(contratoDoNome(nome)).toEqual({ sigla, chave })
})

it('contrato do cabeçalho e mês da pasta', () => {
  expect(chaveDoContratoTexto('CO 07/2024/SMDET')).toBe('7 2024')
  expect(chaveDoContratoTexto('CO 082/2024')).toBe('82 2024')
  expect(chaveDoContratoTexto(null)).toBeNull()
  expect(mesDoCaminho('FATURAMENTO SERVIÇOS PRODAM/Controles de Contratos/08.2026/x.pdf')).toEqual({ ano: 2026, mes: 8 })
  expect(mesDoCaminho('FATURAMENTO SERVIÇOS PRODAM/Controles de Contratos/x.pdf')).toBeNull()
})
