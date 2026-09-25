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
  ])('%s', (referencia, titulo, esperado) => {
    expect(identidadeDoContrato(referencia, titulo)).toEqual(esperado)
  })

  it('peça sozinha não rende identidade (como no Confere)', () => {
    expect(identidadeDoContrato('PA-SMIT-260319-739')).toBeNull()
  })

  it('sem referência', () => {
    expect(identidadeDoContrato(null)).toBeNull()
    expect(identidadeDoContrato('')).toBeNull()
  })
})
