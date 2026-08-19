/**
 * @jest-environment node
 */
import { calcularMetricasComparadas } from './calcularMetricas'

describe('calcularMetricasComparadas', () => {
  it('agrupa por label (case-insensitive) e calcula divergência quando há 2+ valores numéricos', () => {
    const resultado = calcularMetricasComparadas([
      { documentoId: 'd1', nomeArquivo: 'azure.pdf', label: 'Storage', valorNumerico: 11200, unidade: 'BRL', valorExibicao: 'R$ 11.200,00' },
      { documentoId: 'd2', nomeArquivo: 'interno.xlsx', label: 'storage', valorNumerico: 10900, unidade: 'BRL', valorExibicao: 'R$ 10.900,00' },
    ])

    expect(resultado).toEqual([
      {
        label: 'Storage',
        valores: [
          { documentoId: 'd1', nomeArquivo: 'azure.pdf', valorNumerico: 11200, valorExibicao: 'R$ 11.200,00' },
          { documentoId: 'd2', nomeArquivo: 'interno.xlsx', valorNumerico: 10900, valorExibicao: 'R$ 10.900,00' },
        ],
        divergencia: {
          minimo: 10900,
          maximo: 11200,
          diferencaAbsoluta: 300,
          diferencaPercentual: 300 / 10900,
        },
      },
    ])
  })

  it('não calcula divergência quando só há um valor pro label', () => {
    const resultado = calcularMetricasComparadas([
      { documentoId: 'd1', nomeArquivo: 'a.pdf', label: 'Licenças', valorNumerico: 5, unidade: null, valorExibicao: '5' },
    ])
    expect(resultado[0].divergencia).toBeNull()
  })

  it('não calcula divergência quando os valores não são numéricos', () => {
    const resultado = calcularMetricasComparadas([
      { documentoId: 'd1', nomeArquivo: 'a.pdf', label: 'Status', valorNumerico: null, unidade: null, valorExibicao: 'Ativo' },
      { documentoId: 'd2', nomeArquivo: 'b.pdf', label: 'Status', valorNumerico: null, unidade: null, valorExibicao: 'Ativo' },
    ])
    expect(resultado[0].divergencia).toBeNull()
  })

  it('trata diferencaPercentual como null quando o mínimo é zero (evita divisão por zero)', () => {
    const resultado = calcularMetricasComparadas([
      { documentoId: 'd1', nomeArquivo: 'a.pdf', label: 'Créditos usados', valorNumerico: 0, unidade: null, valorExibicao: '0' },
      { documentoId: 'd2', nomeArquivo: 'b.pdf', label: 'Créditos usados', valorNumerico: 50, unidade: null, valorExibicao: '50' },
    ])
    expect(resultado[0].divergencia).toEqual({
      minimo: 0,
      maximo: 50,
      diferencaAbsoluta: 50,
      diferencaPercentual: null,
    })
  })

  it('mantém labels diferentes em grupos separados, na ordem de primeira aparição', () => {
    const resultado = calcularMetricasComparadas([
      { documentoId: 'd1', nomeArquivo: 'a.pdf', label: 'Storage', valorNumerico: 100, unidade: null, valorExibicao: '100' },
      { documentoId: 'd1', nomeArquivo: 'a.pdf', label: 'Licenças', valorNumerico: 5, unidade: null, valorExibicao: '5' },
    ])
    expect(resultado.map((m) => m.label)).toEqual(['Storage', 'Licenças'])
  })
})
