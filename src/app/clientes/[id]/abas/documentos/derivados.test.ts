import {
  competenciasDoArquivo,
  contratosDoArquivo,
  opcoesDeContrato,
  rotuloCompetencias,
  rotuloContratos,
} from './derivados'
import type { UsoArquivo } from './tipos'

const uso = (contrato: UsoArquivo['contrato'], competencia: UsoArquivo['competencia']): UsoArquivo => ({
  tipo: 'analise-documento',
  rotulo: 'r',
  href: 'h',
  contrato,
  competencia,
})
const k1 = { id: 'k1', numeroTermo: 'TC 012/2020' }
const k2 = { id: 'k2', numeroTermo: 'TC 003/2024' }
const k3 = { id: 'k3', numeroTermo: null }

describe('derivados dos usos', () => {
  it('contratos distintos, na ordem dos usos', () => {
    const a = { usos: [uso(k1, null), uso(k2, null), uso(k1, { ano: 2026, mes: 6 })] }
    expect(contratosDoArquivo(a)).toEqual([k1, k2])
    expect(rotuloContratos(a)).toBe('TC 012/2020, TC 003/2024')
  })

  it('competências distintas, mais recente primeiro', () => {
    const a = { usos: [uso(null, { ano: 2026, mes: 6 }), uso(k1, { ano: 2026, mes: 8 }), uso(null, { ano: 2026, mes: 6 })] }
    expect(competenciasDoArquivo(a)).toEqual([
      { ano: 2026, mes: 8 },
      { ano: 2026, mes: 6 },
    ])
    expect(rotuloCompetencias(a)).toBe('Agosto/2026, Junho/2026')
  })

  it('sem usos: traço', () => {
    expect(rotuloContratos({ usos: [] })).toBe('—')
    expect(rotuloCompetencias({ usos: [] })).toBe('—')
  })

  it('opções de contrato de todos os arquivos, por número, sem número por último', () => {
    const arquivos = [{ usos: [uso(k1, null), uso(k3, null)] }, { usos: [uso(k2, null), uso(k1, null)] }]
    expect(opcoesDeContrato(arquivos)).toEqual([k2, k1, k3])
    expect(rotuloContratos({ usos: [uso(k3, null)] })).toBe('(sem número)')
  })
})
