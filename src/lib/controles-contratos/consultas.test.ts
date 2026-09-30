/** @jest-environment node */
jest.mock('@/lib/prisma', () => ({ prisma: {} }))

import { serializarControle } from './consultas'

/* eslint-disable @typescript-eslint/no-explicit-any */

const dec = (v: string) => ({ toString: () => v })
const linha = (posicao: number, rotulo: string, valor: string) => ({ tipo: 'faturado', posicao, rotulo, valor: dec(valor) })

// FTM 094/2024 no controle de ago/2026 (valores reais, tabela encurtada): primeira linha com o ano errado e
// setembro/outubro já lançados.
const controle = {
  arquivoId: 'a1',
  mesAno: 2026,
  mesMes: 8,
  sigla: 'FTM',
  contratoTexto: 'CO 094/FTMSP/2024',
  contratoId: 'k1',
  clienteId: 'c1',
  termoTexto: 'T.A. 01',
  vigenciaTexto: '28/10/2025 à 27/10/2026',
  vigenciaInicio: new Date(Date.UTC(2025, 9, 28)),
  vigenciaFim: new Date(Date.UTC(2026, 9, 27)),
  previstoTotal: dec('195350.16'),
  faturadoTotal: dec('47433.47'),
  saldoTotal: dec('147916.69'),
  previstoConferido: true,
  faturadoConferido: true,
  avisos: [],
  linhas: [
    linha(0, 'OUT/26-3DIAS', '666.98'),
    linha(1, 'nov/25', '6669.98'),
    linha(2, 'ago/26', '3755.20'),
    linha(3, 'set/26', '12702.23'),
    linha(4, 'OUT/26-27DIAS', '24309.06'),
    linha(5, 'nov/26', '0.00'),
  ],
}

it('faturado só até o mês do controle; o lançado à frente fica à parte e fora do % e do saldo', () => {
  const s = serializarControle(controle as any, 'Fundação Theatro Municipal')
  expect(s).toMatchObject({
    previsto: '195350.16',
    faturadoDocumento: '47433.47',
    faturado: '11092.16',
    aFrente: { total: '37011.29', periodos: ['set/26', 'OUT/26-27DIAS'] },
    saldoCalculado: '184258.00',
    percentual: 5.7,
    ultimoFaturado: 'ago/26',
    conferido: true,
  })
  expect(s.avisos).toEqual(['mês fora de ordem no documento: "OUT/26-3DIAS" — contado pela posição na tabela'])
})

it('tabela que não fecha pela soma continua sem número', () => {
  const s = serializarControle({ ...controle, faturadoTotal: null, faturadoConferido: false } as any, null)
  expect(s).toMatchObject({ faturado: null, aFrente: null, percentual: null, conferido: false })
})

it('ordem dos meses que não dá pra resolver: não mostra faturado e avisa', () => {
  const s = serializarControle(
    { ...controle, linhas: [linha(0, 'mar/26', '1.00'), linha(1, 'abr/26', '1.00'), linha(2, 'jan/26', '1.00'), linha(3, 'fev/26', '1.00')] } as any,
    null
  )
  expect(s.faturado).toBeNull()
  expect(s.conferido).toBe(false)
  expect(s.avisos).toContain('os meses da tabela do faturado não estão em ordem no documento — faturado até o mês não calculado; confira no PDF')
})
