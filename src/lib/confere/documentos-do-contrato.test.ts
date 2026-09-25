/** @jest-environment node */
import type { TipoDaLinha } from './tipos-cadastro'
import { avisoDeVigencia, dataDaProposta, escolherDocumentos, type LinhaDoHistorico } from './documentos-do-contrato'

let sequencia = 0
const d = (iso: string) => new Date(`${iso}T00:00:00Z`)

function linha(
  tipo: TipoDaLinha,
  campos: Omit<Partial<LinhaDoHistorico>, 'pdf'> & { pdf?: string } = {}
): LinhaDoHistorico {
  sequencia += 1
  const { pdf, ...resto } = campos
  return {
    id: `l${sequencia}`,
    tipo,
    numero: null,
    data: null,
    dataInicio: null,
    dataVencimento: null,
    situacao: null,
    proposta: null,
    createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, sequencia)),
    pdf: pdf ? { arquivoId: pdf, nome: `${pdf}.pdf` } : null,
    ...resto,
  }
}

// Os três contratos do cadastro de desenvolvimento (25/09/2026), na ordem em que o banco devolve.
const PGM = [
  linha('ADITIVO', { numero: 'TA 05', data: d('2026-04-30'), proposta: 'PA-PGM-260304-715 - Q-00715-5', pdf: 'pa-05' }),
  linha('CONTRATO', {
    numero: 'TC 015/PGM/2024',
    data: d('2024-11-29'),
    dataInicio: d('2024-12-01'),
    dataVencimento: d('2025-11-30'),
    pdf: 'pc',
  }),
  linha('ADITIVO', { numero: 'TA 03', data: d('2025-10-30'), pdf: 'pa-03' }),
  linha('ADITIVO', { numero: 'TA 01', data: d('2025-03-28'), pdf: 'pa-01' }),
  linha('ADITIVO', { numero: 'TA 02', data: d('2025-04-30'), pdf: 'pa-02' }),
  linha('PRORROGACAO', { numero: 'TA 04', dataInicio: d('2025-12-01'), proposta: 'PA-PGM-251015-159 v5.0', pdf: 'pa-04' }),
]
const SMIT = [
  linha('CONTRATO', {
    numero: 'TC 52/SMIT/2024',
    data: d('2024-06-11'),
    dataInicio: d('2024-07-01'),
    dataVencimento: d('2025-06-30'),
    pdf: 'pc',
  }),
  linha('PRORROGACAO', {
    numero: 'TA 01',
    data: d('2025-06-30'),
    dataInicio: d('2025-07-01'),
    dataVencimento: d('2026-06-30'),
    pdf: 'pa-01',
  }),
  linha('PRORROGACAO', {
    numero: 'TA 02',
    data: d('2026-06-30'),
    dataInicio: d('2026-07-01'),
    dataVencimento: d('2027-06-30'),
    pdf: 'pa-02',
  }),
]
const CGM = [
  linha('ADITIVO', { numero: 'TA 01', data: d('2025-04-29'), proposta: 'PA-CGM-250403-035 v1.0', pdf: 'pa-01' }),
  linha('PRORROGACAO', {
    numero: 'TA 02',
    data: d('2025-10-14'),
    dataInicio: d('2025-10-15'),
    dataVencimento: d('2026-10-14'),
    pdf: 'pa-02',
  }),
  linha('CONTRATO', { numero: 'TC 16/CGM/2024', pdf: 'pc' }),
]

describe('escolherDocumentos — os casos reais', () => {
  it('PGM, julho/2026: base na renovação TA 04 e o aditivo TA 05 (como a equipe do Confere montou)', () => {
    const escolha = escolherDocumentos(PGM, { ano: 2026, mes: 7 })
    expect(escolha.base).toEqual({
      arquivoId: 'pa-04',
      nome: 'pa-04.pdf',
      origem: { tipo: 'PRORROGACAO', numero: 'TA 04', inicio: '2025-12-01' },
    })
    expect(escolha.aditivos.map((a) => a.arquivoId)).toEqual(['pa-05'])
    expect(escolha.decisoes).toEqual([
      { rotulo: 'Contrato inicial', papel: 'fora', motivo: 'já está dentro da renovação TA 04' },
      { rotulo: 'TA 01', papel: 'fora', motivo: 'já está dentro da renovação TA 04' },
      { rotulo: 'TA 02', papel: 'fora', motivo: 'já está dentro da renovação TA 04' },
      { rotulo: 'TA 03', papel: 'fora', motivo: 'já está dentro da renovação TA 04' },
      { rotulo: 'TA 04', papel: 'base', motivo: null },
      { rotulo: 'TA 05', papel: 'aditivo', motivo: null },
    ])
    expect(escolha.avisos).toEqual([])
  })

  it('SMIT, julho/2026: base na TA 02, que começa em 01/07/2026', () => {
    const escolha = escolherDocumentos(SMIT, { ano: 2026, mes: 7 })
    expect(escolha.base?.arquivoId).toBe('pa-02')
    expect(escolha.aditivos).toEqual([])
  })

  it('SMIT, maio/2026: a TA 02 ainda não vale — base na TA 01', () => {
    const escolha = escolherDocumentos(SMIT, { ano: 2026, mes: 5 })
    expect(escolha.base?.arquivoId).toBe('pa-01')
    expect(escolha.decisoes).toContainEqual({
      rotulo: 'TA 02',
      papel: 'fora',
      motivo: 'começa depois da competência (01/07/2026)',
    })
  })

  it('CGM, agosto/2026: base na renovação TA 02; o TA 01 já está dentro dela', () => {
    const escolha = escolherDocumentos(CGM, { ano: 2026, mes: 8 })
    expect(escolha.base?.arquivoId).toBe('pa-02')
    expect(escolha.aditivos).toEqual([])
    expect(escolha.decisoes).toContainEqual({ rotulo: 'TA 01', papel: 'fora', motivo: 'já está dentro da renovação TA 02' })
  })

  it('HSPM: renovação sem PA não vira base — continua a PC, e o aditivo depois dela entra', () => {
    const hspm = [
      linha('CONTRATO', { numero: 'TC 387/2024/HSPM', dataInicio: d('2024-10-11'), pdf: 'pc' }),
      linha('ADITIVO', { numero: 'TA 590-2025', dataInicio: d('2026-03-23'), pdf: 'pa-590' }),
      linha('PRORROGACAO', { numero: 'TA 521-2025', dataInicio: d('2025-11-01') }),
    ]
    const escolha = escolherDocumentos(hspm, { ano: 2026, mes: 8 })
    expect(escolha.base?.arquivoId).toBe('pc')
    expect(escolha.aditivos.map((a) => a.arquivoId)).toEqual(['pa-590'])
    expect(escolha.decisoes).toContainEqual({
      rotulo: 'TA 521-2025',
      papel: 'fora',
      motivo: 'prorrogação sem proposta (PA) no cadastro — a base continua a anterior',
    })
  })
})

describe('escolherDocumentos — bordas', () => {
  it('aditivo sem PA: fica fora e avisa', () => {
    const escolha = escolherDocumentos(
      [linha('CONTRATO', { pdf: 'pc' }), linha('ADITIVO', { numero: 'TA 03', data: d('2025-10-30') })],
      { ano: 2026, mes: 1 }
    )
    expect(escolha.aditivos).toEqual([])
    expect(escolha.avisos).toEqual([
      {
        codigo: 'aditivo-sem-pa',
        texto:
          'TA 03 (aditivo de 30/10/2025): sem a proposta (PA) no cadastro — o relatório sai sem ele. Anexe a PA na linha do histórico do contrato ou envie o arquivo aqui.',
      },
    ])
  })

  it('termo sem data no cadastro: posicionado pela data da proposta, com aviso', () => {
    const escolha = escolherDocumentos(
      [linha('CONTRATO', { pdf: 'pc' }), linha('ADITIVO', { numero: 'TA 02', proposta: 'PA-SF-250806-091 v1.0', pdf: 'pa-02' })],
      { ano: 2026, mes: 1 }
    )
    expect(escolha.aditivos.map((a) => a.arquivoId)).toEqual(['pa-02'])
    expect(escolha.avisos[0]).toEqual({
      codigo: 'termo-sem-data',
      texto:
        'TA 02: sem data de início nem de assinatura no cadastro — posicionado pela data da proposta (06/08/2025). Confira.',
    })
  })

  it('termo sem data nenhuma: fica fora, com aviso', () => {
    const escolha = escolherDocumentos([linha('CONTRATO', { pdf: 'pc' }), linha('ADITIVO', { numero: 'TA 09', pdf: 'x' })], {
      ano: 2026,
      mes: 1,
    })
    expect(escolha.aditivos).toEqual([])
    expect(escolha.decisoes).toContainEqual({ rotulo: 'TA 09', papel: 'fora', motivo: 'sem data no cadastro' })
    expect(escolha.avisos[0].codigo).toBe('termo-sem-data')
  })

  it('cancelado, em elaboração, rescisão e prospecção nunca entram', () => {
    const escolha = escolherDocumentos(
      [
        linha('CONTRATO', { pdf: 'pc' }),
        linha('ADITIVO', { numero: 'TA 01', data: d('2025-01-10'), situacao: 'Cancelado (não efetivado)', pdf: 'a' }),
        linha('ADITIVO', { numero: 'TA XX', dataInicio: d('2025-02-10'), situacao: 'Em elaboração', pdf: 'b' }),
        linha('RESCISAO', { numero: 'TRA 01', data: d('2025-03-10'), pdf: 'c' }),
        linha('PROSPECCAO', { data: d('2025-03-11'), pdf: 'e' }),
      ],
      { ano: 2026, mes: 1 }
    )
    expect(escolha.aditivos).toEqual([])
    expect(escolha.decisoes.map((x) => x.motivo)).toEqual([
      null,
      'cancelado ou não efetivado',
      'em elaboração',
      'rescisão',
      'prospecção',
    ])
  })

  it('a mesma PA em duas linhas vai uma vez só (o Confere bloqueia peça repetida)', () => {
    const escolha = escolherDocumentos(
      [
        linha('CONTRATO', { pdf: 'pc' }),
        linha('ADITIVO', { numero: 'TA 02', data: d('2025-01-10'), pdf: 'pa' }),
        linha('ADITIVO', { numero: 'TA 03', data: d('2025-02-10'), pdf: 'pa' }),
      ],
      { ano: 2026, mes: 1 }
    )
    expect(escolha.aditivos.map((a) => a.arquivoId)).toEqual(['pa'])
    expect(escolha.decisoes).toContainEqual({ rotulo: 'TA 03', papel: 'fora', motivo: 'mesma proposta de TA 02' })
    expect(escolha.alternativas.map((a) => a.arquivoId)).toEqual(['pc', 'pa'])
  })

  it('sem PC e sem renovação com PA: base vazia, aviso e os aditivos mesmo assim', () => {
    const escolha = escolherDocumentos([linha('CONTRATO'), linha('ADITIVO', { numero: 'TA 01', data: d('2025-01-10'), pdf: 'pa' })], {
      ano: 2026,
      mes: 1,
    })
    expect(escolha.base).toBeNull()
    expect(escolha.aditivos.map((a) => a.arquivoId)).toEqual(['pa'])
    expect(escolha.avisos.map((a) => a.codigo)).toEqual(['sem-proposta'])
    expect(escolha.decisoes[0]).toEqual({ rotulo: 'Contrato inicial', papel: 'fora', motivo: 'sem proposta (PC) no cadastro' })
  })
})

describe('dataDaProposta', () => {
  it.each([
    ['PA-SF-250806-091 v1.0', '2025-08-06'],
    ['PA-CGM- 250912-127 v4.0', '2025-09-12'],
    ['PC-SMT-210603-64 - v4.0', '2021-06-03'],
    ['PA-SUB-ITP-250101-12', '2025-01-01'],
    ['PA-PGM-260304-715 - Q-00715-5.pdf', '2026-03-04'],
  ])('%s', (codigo, iso) => {
    expect(dataDaProposta(codigo)?.toISOString().slice(0, 10)).toBe(iso)
  })

  it('sem código ou data impossível', () => {
    expect(dataDaProposta('proposta final.pdf')).toBeNull()
    expect(dataDaProposta('PA-SF-251345-091')).toBeNull()
    expect(dataDaProposta(null)).toBeNull()
  })
})

describe('avisoDeVigencia', () => {
  it('PGM, julho/2026: fora da vigência cadastrada, e diz qual renovação está sem data de fim', () => {
    const aviso = avisoDeVigencia({ ano: 2026, mes: 7 }, { vigenciaFim: d('2025-11-30'), inicio: d('2024-12-01') }, PGM)
    expect(aviso).toEqual({
      codigo: 'fora-da-vigencia',
      texto:
        'Julho/2026 está depois do fim de vigência cadastrado (30/11/2025). TA 04 (renovação desde 01/12/2025) está sem data de fim no cadastro. Confira.',
    })
  })

  it('dentro da vigência: nada', () => {
    expect(avisoDeVigencia({ ano: 2026, mes: 7 }, { vigenciaFim: d('2027-06-30'), inicio: d('2024-07-01') }, SMIT)).toBeNull()
  })

  it('antes do início do contrato', () => {
    expect(avisoDeVigencia({ ano: 2024, mes: 5 }, { vigenciaFim: null, inicio: d('2024-12-01') }, [])).toEqual({
      codigo: 'fora-da-vigencia',
      texto: 'Maio/2024 é anterior ao início do contrato (01/12/2024). Confira.',
    })
  })
})
