/** @jest-environment node */
import { identidadeDoContrato } from './identidade'

describe('identidadeDoContrato', () => {
  // As formas medidas nos levantamentos reais de 25/09/2026 (Downloads do usuário e fixtures do Confere).
  it.each([
    ['TC 52/SMIT/2024', null, { base: 52, orgao: 'SMIT', ano: '2024' }],
    ['TC 015/PGM/2024', null, { base: 15, orgao: 'PGM', ano: '2024' }],
    ['TC 16/CGM/2024', null, { base: 16, orgao: 'CGM', ano: '2024' }],
    ['TC 094/FTMSP/2024', null, { base: 94, orgao: 'FTMSP', ano: '2024' }],
    ['52-A/SMIT/2024', null, { base: 52, orgao: 'SMIT', ano: '2024' }],
    ['TC 07/2024/SMDET', null, { base: 7, orgao: 'SMDET', ano: '2024' }],
    ['TC 107/2025/SMS-1', null, { base: 107, orgao: 'SMS', ano: '2025' }],
    ['TC 387/2024', 'LEVANTAMENTO - COMPROVAÇÃO HSPM - CATÁLOGO DE SERVIÇOS DIT', { base: 387, orgao: 'HSPM', ano: '2024' }],
    ['TC 387/2024', null, { base: 387, orgao: null, ano: '2024' }],
    ['52 / smit / 2024', null, { base: 52, orgao: 'SMIT', ano: '2024' }],
    // Formatos dos números do cadastro que a primeira versão não lia (simulação de 25/09/2026 com os
    // 122 contratos em vigor): órgão com barra, ano com dois dígitos, hífen no lugar da barra.
    ['TC 04/SP/REGULA/2022', null, { base: 4, orgao: 'SPREGULA', ano: '2022' }],
    ['TC 30/SMC/G/2025', null, { base: 30, orgao: 'SMCG', ano: '2025' }],
    ['TC 65/SMSUB/COGEL/2025', null, { base: 65, orgao: 'SMSUBCOGEL', ano: '2025' }],
    ['TC 001/SUB/IT/2026', null, { base: 1, orgao: 'SUBIT', ano: '2026' }],
    ['TC 01/SUB-ITP/2026', null, { base: 1, orgao: 'SUBITP', ano: '2026' }],
    ['TC 103/SIURB/24', null, { base: 103, orgao: 'SIURB', ano: '2024' }],
    ['TC 050-2024', 'LEVANTAMENTO - COMPROVAÇÃO SF - CATÁLOGO DE SERVIÇOS DIT', { base: 50, orgao: 'SF', ano: '2024' }],
    ['TC 012/2020/COVISA.G', null, { base: 12, orgao: 'COVISA', ano: '2020' }],
    ['TC 105/2025/SMS-1/CONTRATOS', null, { base: 105, orgao: 'SMS', ano: '2025' }],
  ])('%s', (referencia, titulo, esperado) => {
    expect(identidadeDoContrato(referencia, titulo)).toEqual(esperado)
  })

  it('peça sozinha não rende identidade (como no Confere)', () => {
    expect(identidadeDoContrato('PA-SMIT-260319-739')).toBeNull()
  })

  it('contrato sem número não rende identidade', () => {
    expect(identidadeDoContrato('TC SN/2024')).toBeNull()
    expect(identidadeDoContrato('Novo Sustenta')).toBeNull()
  })

  it('sem referência', () => {
    expect(identidadeDoContrato(null)).toBeNull()
    expect(identidadeDoContrato('')).toBeNull()
  })
})
