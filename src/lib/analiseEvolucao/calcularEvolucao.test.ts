/**
 * @jest-environment node
 */
import { calcularEvolucao } from './calcularEvolucao'

function metrica(label: string, valorNumerico: number | null, documentoId = 'd1') {
  return { documentoId, nomeArquivo: `${documentoId}.pdf`, label, valorNumerico, unidade: null, valorExibicao: String(valorNumerico) }
}

describe('calcularEvolucao', () => {
  it('marca "alta" quando a variação passa de +5%', () => {
    const resultado = calcularEvolucao([metrica('Storage', 11200)], [metrica('Storage', 10000)])
    expect(resultado).toEqual([
      {
        label: 'Storage',
        valorAtual: 11200,
        valorAnterior: 10000,
        deltaAbsoluto: 1200,
        deltaPercentual: 0.12,
        status: 'alta',
      },
    ])
  })

  it('marca "baixa" quando a variação passa de -5%', () => {
    const resultado = calcularEvolucao([metrica('Storage', 8000)], [metrica('Storage', 10000)])
    expect(resultado[0].status).toBe('baixa')
    expect(resultado[0].deltaPercentual).toBeCloseTo(-0.2)
  })

  it('marca "estavel" dentro de +/-5%', () => {
    const resultado = calcularEvolucao([metrica('Storage', 10300)], [metrica('Storage', 10000)])
    expect(resultado[0].status).toBe('estavel')
  })

  it('marca "novo" quando o label só existe na competência atual', () => {
    const resultado = calcularEvolucao([metrica('Backup', 500)], [])
    expect(resultado).toEqual([
      { label: 'Backup', valorAtual: 500, valorAnterior: null, deltaAbsoluto: null, deltaPercentual: null, status: 'novo' },
    ])
  })

  it('marca "removido" quando o label só existe na competência anterior', () => {
    const resultado = calcularEvolucao([], [metrica('Backup', 500)])
    expect(resultado).toEqual([
      { label: 'Backup', valorAtual: null, valorAnterior: 500, deltaAbsoluto: null, deltaPercentual: null, status: 'removido' },
    ])
  })

  it('soma múltiplos documentos com o mesmo label (case-insensitive) dentro da mesma competência', () => {
    const resultado = calcularEvolucao(
      [metrica('storage', 100, 'd1'), metrica('Storage', 50, 'd2')],
      [metrica('Storage', 90, 'd3')]
    )
    expect(resultado[0].valorAtual).toBe(150)
    expect(resultado[0].valorAnterior).toBe(90)
  })

  it('deltaPercentual é null quando o valor anterior é zero, mas o status ainda reflete o delta absoluto', () => {
    const resultado = calcularEvolucao([metrica('Créditos', 50)], [metrica('Créditos', 0)])
    expect(resultado[0].deltaPercentual).toBeNull()
    expect(resultado[0].deltaAbsoluto).toBe(50)
    expect(resultado[0].status).toBe('alta')
  })
})
