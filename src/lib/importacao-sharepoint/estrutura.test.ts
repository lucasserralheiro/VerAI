import { chaveDoNome, classificarTermo, montarEstrutura } from './estrutura'

describe('chaveDoNome', () => {
  it.each([
    ['TC 073-2019 - Acesso a Rede', { numero: '73', ano: '2019' }],
    ['1) TC 11-PGM-23 - Contrato Inicial', { numero: '11', ano: '2023' }],
    ['TC 012-2020-COVISA.G - Sustentação', { numero: '12', ano: '2020' }],
    ['2) TC SN-2024 - TA 02 - Prorrogação 24 meses', { numero: 'sn', ano: '2024' }],
    ['1) 385-2023 - Contrato Inicial', { numero: '385', ano: '2023' }],
  ])('%s', (nome, esperado) => expect(chaveDoNome(nome)).toEqual(esperado))
  it('pasta sem número não é contrato', () => expect(chaveDoNome('Contratos Finalizados')).toBeNull())
})

describe('classificarTermo', () => {
  it('contrato inicial', () => expect(classificarTermo('1) TC 073-2019 - Contrato Inicial')).toMatchObject({ ordem: 1, tipo: 'CONTRATO', numero: null }))
  it('prorrogação pelo prazo no nome', () =>
    expect(classificarTermo('3) TC 073-2019 - TA 02 - 12m')).toMatchObject({ tipo: 'PRORROGACAO', numero: 'TA 02', meses: 12 }))
  it('número com sigla e ano', () =>
    expect(classificarTermo('2) TC 027-FTMSP-2021 - TA 304-FTMSP-2022 - Prorrogação')).toMatchObject({ tipo: 'PRORROGACAO', numero: 'TA 304-FTMSP-2022' }))
  it('apostilamento é aditivo', () => expect(classificarTermo('3) TC 012-2020-COVISA.G - TAP 001-2021- reajuste')).toMatchObject({ tipo: 'ADITIVO', numero: 'TAP 001-2021' }))
  it('rescisão', () => expect(classificarTermo('4) TC 012-2020-COVISA.G - TRA - antecipada')).toMatchObject({ tipo: 'RESCISAO' }))
  it('termo que não valeu', () => expect(classificarTermo('3) TC 006-SMC-G-2021 - TA 02-2022 - 12m (não virou)')).toMatchObject({ aviso: 'nao-efetivado' }))
  it('termo sem número', () => expect(classificarTermo('12) TC 39-2019 - TA XX - Redução')).toMatchObject({ aviso: 'sem-numero' }))
})

describe('montarEstrutura', () => {
  const e = montarEstrutura([
    'ADESAMPA/TC 073-2019 - Acesso a Rede/1) TC 073-2019 - Contrato Inicial/PC-ADESAMPA-191007-139 v1.0.pdf',
    'ADESAMPA/TC 073-2019 - Acesso a Rede/1) TC 073-2019 - Contrato Inicial/TC 073-2019- ADESAMPA (assinado SEI).pdf',
    'ADESAMPA/TC 073-2019 - Acesso a Rede/2) TC 073-2019 - TA 01-2020 - acréscimo/TA 01 ao TC 073-2019 - assinado.pdf',
    'ADESAMPA/TC 073-2019 - Acesso a Rede/2) TC 073-2019 - TA 01-2020 - acréscimo/WORK/Mem_Calc.xlsx',
    'ICI/1) TC SN-2024 - Serviços em Nuvem/1) TC SN-2024 - Contrato Inicial/TC SN-2024.pdf',
    'ICI/2) TC SN-2024 - TA 02 - Prorrogação 24 meses/TC SN-2024 - TA 02.pdf',
    'SEHAB/Contratos Finalizados - SEHAB/TC 014-2019-SEHAB - Sustentação/1) TC 014-2019-SEHAB/TC 014-2019.pdf',
    'SF/TC 06-2023 - Centralização Pagamentos/TC 06-2023.pdf',
  ])
  const porChave = Object.fromEntries(e.map((c) => [c.chave, c]))

  it('contrato → termos, com PDF de termo e de proposta separados e WORK de fora', () => {
    const c = porChave['ADESAMPA|73 2019']
    expect(c).toMatchObject({ numeroTermo: 'TC 073/2019', descricao: 'Acesso a Rede', finalizado: false })
    expect(c.termos.map((t) => t.tipo)).toEqual(['CONTRATO', 'ADITIVO'])
    expect(c.termos[0].propostaPdf).toMatch(/PC-ADESAMPA/)
    expect(c.termos[0].termoPdf).toMatch(/assinado SEI/)
    expect(c.termos[1].outros).toEqual([])
  })
  it('termo solto na pasta do cliente cai no mesmo contrato', () => {
    expect(porChave['ICI|sn 2024'].termos.map((t) => t.tipo)).toEqual(['CONTRATO', 'PRORROGACAO'])
  })
  it('"Contratos Finalizados" marca o contrato como finalizado', () => {
    expect(porChave['SEHAB|14 2019'].finalizado).toBe(true)
  })
  it('pasta de contrato sem subpasta vira o contrato inicial', () => {
    expect(porChave['SF|6 2023'].termos).toEqual([expect.objectContaining({ tipo: 'CONTRATO', termoPdf: 'SF/TC 06-2023 - Centralização Pagamentos/TC 06-2023.pdf' })])
  })
})
