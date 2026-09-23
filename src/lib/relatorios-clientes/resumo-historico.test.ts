import { resumirHistorico, type LinhaResumoHistorico } from './resumo-historico'

function linha(parcial: Partial<LinhaResumoHistorico>): LinhaResumoHistorico {
  return {
    tipo: 'CONTRATO',
    data: null,
    createdAt: new Date('2026-01-01'),
    numero: null,
    proposta: null,
    valor: null,
    propostaPdfUrl: null,
    propostaPdfNome: null,
    termoPdfUrl: null,
    termoPdfNome: null,
    ...parcial,
  }
}

describe('resumirHistorico', () => {
  it('sem histórico: tudo vazio', () => {
    expect(resumirHistorico([])).toEqual({ aditivos: 0, prorrogacoes: 0, valorAtual: null, proposta: null, termo: null })
  })

  it('valor atual é o da linha mais recente com valor (cada linha guarda o total, não o acréscimo)', () => {
    const resumo = resumirHistorico([
      linha({ tipo: 'CONTRATO', data: new Date('2021-11-09'), valor: '69687389.32' }),
      linha({ tipo: 'PRORROGACAO', data: new Date('2024-08-09'), valor: '68071931.88' }),
      linha({ tipo: 'ADITIVO', data: new Date('2022-01-28'), valor: '1919161.09' }),
    ])
    expect(resumo.valorAtual).toEqual({ valor: '68071931.88', tipo: 'PRORROGACAO', data: '2024-08-09T00:00:00.000Z' })
    expect(resumo.aditivos).toBe(1)
    expect(resumo.prorrogacoes).toBe(1)
  })

  it('ignora prospecção e linhas sem valor ao escolher o valor atual', () => {
    const resumo = resumirHistorico([
      linha({ tipo: 'CONTRATO', data: new Date('2025-12-12'), valor: '1241864.52' }),
      linha({ tipo: 'PROSPECCAO', data: new Date('2026-06-01'), valor: '9999999' }),
      linha({ tipo: 'ADITIVO', data: new Date('2026-07-01'), valor: null }),
    ])
    expect(resumo.valorAtual?.valor).toBe('1241864.52')
  })

  it('aceita o Decimal do Prisma (usa toString)', () => {
    const decimal = { toString: () => '823635.30' }
    expect(resumirHistorico([linha({ valor: decimal })]).valorAtual?.valor).toBe('823635.30')
  })

  it('linha datada vence a sem data; entre duas sem data vale a criada por último', () => {
    const resumo = resumirHistorico([
      linha({ valor: '1', data: null, createdAt: new Date('2026-01-01') }),
      linha({ valor: '2', data: null, createdAt: new Date('2026-02-01') }),
    ])
    expect(resumo.valorAtual?.valor).toBe('2')
    const datada = resumirHistorico([linha({ valor: '3', data: new Date('2020-01-01') }), linha({ valor: '4', data: null })])
    expect(datada.valorAtual?.valor).toBe('3')
  })

  it('PDFs: pega o mais recente de cada tipo, independente um do outro', () => {
    const resumo = resumirHistorico([
      linha({ data: new Date('2021-01-01'), numero: 'TC 1', proposta: 'PC-1', propostaPdfUrl: 'p1', termoPdfUrl: 't1' }),
      linha({ tipo: 'ADITIVO', data: new Date('2022-01-01'), proposta: 'PA-2', propostaPdfUrl: 'p2' }),
    ])
    expect(resumo.proposta).toEqual({ url: 'p2', nome: null, referencia: 'PA-2' })
    expect(resumo.termo).toEqual({ url: 't1', nome: null, referencia: 'TC 1' })
  })
})
