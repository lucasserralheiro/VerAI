import { agruparPorCompetencia, resumirFaturamentos, type FaturamentoResumivel } from './resumo-faturamento'

function fat(parcial: Partial<FaturamentoResumivel> & { id: string }): FaturamentoResumivel {
  return { competenciaAno: 2026, competenciaMes: 8, valorExibido: '0', enviadoCliente: true, enviadoGfp: true, ...parcial }
}

describe('resumirFaturamentos', () => {
  it('conta lançamentos, envios e soma valores sem erro de ponto flutuante', () => {
    const resumo = resumirFaturamentos([
      fat({ id: 'a', valorExibido: '0.1', enviadoGfp: false }),
      fat({ id: 'b', valorExibido: '0.2', enviadoCliente: false, enviadoGfp: null }),
      fat({ id: 'c', valorExibido: '1000000.05' }),
    ])
    expect(resumo).toEqual({ total: 3, valorTotal: '1000000.35', enviadoCliente: 2, enviadoGfp: 1 })
  })

  it('lista vazia e valor ilegível não quebram', () => {
    expect(resumirFaturamentos([])).toEqual({ total: 0, valorTotal: '0.00', enviadoCliente: 0, enviadoGfp: 0 })
    expect(resumirFaturamentos([fat({ id: 'x', valorExibido: 'abc' })]).valorTotal).toBe('0.00')
  })
})

describe('agruparPorCompetencia', () => {
  it('agrupa por mês/ano mantendo a ordem de chegada e calcula total e pendências', () => {
    const grupos = agruparPorCompetencia([
      fat({ id: 'a', competenciaMes: 8, valorExibido: '10.50' }),
      fat({ id: 'b', competenciaMes: 7, valorExibido: '5', enviadoGfp: false }),
      fat({ id: 'c', competenciaMes: 8, valorExibido: '4.50', enviadoCliente: false }),
    ])
    expect(grupos.map((g) => [g.rotulo, g.itens.length, g.valorTotal, g.pendentes])).toEqual([
      ['Agosto de 2026', 2, '15.00', 1],
      ['Julho de 2026', 1, '5.00', 1],
    ])
  })

  it('anos diferentes não se misturam e dado incompleto vai pra "Sem competência"', () => {
    const grupos = agruparPorCompetencia([
      fat({ id: 'a', competenciaAno: 2025 }),
      fat({ id: 'b', competenciaAno: 2026 }),
      fat({ id: 'c', competenciaAno: null, competenciaMes: null }),
      fat({ id: 'd', competenciaMes: null }),
    ])
    expect(grupos.map((g) => [g.rotulo, g.itens.length])).toEqual([
      ['Agosto de 2025', 1],
      ['Agosto de 2026', 1],
      ['Sem competência', 2],
    ])
  })
})
