import { dataBr, lerControle, valorBr, type LinhaPdf } from './leitura'

const L = (...textos: string[]): LinhaPdf => ({ pagina: 1, textos })

// ADESAMPA CO-082-2024 (06.2026): períodos por data, vigência com ano trocado no próprio documento.
const ADESAMPA: LinhaPdf[] = [
  L('CRONOGRAMA FÍSICO FINANCEIRO - ADSAMPA(Disp. Acesso a Rede)'),
  L('CO 082/2024', '- T.A. 01 - Vigência: 18/11/2026 à 17/11/2026'),
  L('PREVISÃO DE FATURAMENTO'),
  L('DATA CENTER'),
  L('PERÍODO', 'TOTAL'),
  ...Array.from({ length: 12 }, (_, i) => L(`MÊS ${String(i + 1).padStart(2, '0')}`, '1.254,89', '1.254,89')),
  L('TOTAL', '15.058,68', '15.058,68'),
  L('CRONOGRAMA FÍSICO FINANCEIRO - ADSAMPA(Disp. Acesso a Rede)'),
  L('CO 082/2024', '- T.A. 01 - Vigência: 18/11/2026 à 17/11/2026'),
  L('FATURADO'),
  L('PERÍODO', 'TOTAL'),
  L('18/11/2025 à 30/11/2025 - 12D', '388,42', '388,42'),
  L('01/12/2025 à 31/12/2025', '896,35', '896,35'),
  L('01/01/2026 à 31/01/2026', '6.791,80', '6.791,80'),
  L('01/02/2026 à 28/02/2026', '0,00'),
  L('TOTAL', '8.076,57', '8.076,57'),
  L('SALDO A FATURAR'),
  L('18/11/2025 à 30/11/2025 - 12D', '866,47', '866,47'),
  L('TOTAL', '9.237,00', '9.237,00'),
]

it('lê cabeçalho, as três tabelas e prova cada uma pela soma', () => {
  const c = lerControle(ADESAMPA)
  expect(c.contratoTexto).toBe('CO 082/2024')
  expect(c.termoTexto).toBe('T.A. 01')
  expect(c.vigenciaTexto).toBe('18/11/2026 à 17/11/2026')
  expect(c.previsto).toMatchObject({ total: '15058.68', conferida: true })
  expect(c.previsto!.linhas).toHaveLength(12)
  expect(c.faturado).toMatchObject({ total: '8076.57', conferida: true })
  expect(c.faturado!.linhas[0]).toEqual({
    rotulo: '18/11/2025 à 30/11/2025 - 12D',
    valor: '388.42',
    inicio: new Date(Date.UTC(2025, 10, 18)),
    fim: new Date(Date.UTC(2025, 10, 30)),
  })
  expect(c.faturado!.linhas[3]).toMatchObject({ rotulo: '01/02/2026 à 28/02/2026', valor: '0.00' })
  expect(c.saldo).toMatchObject({ total: '9237.00', conferida: false })
})

it('vigência com fim antes do início: mantém o texto, não as datas, e avisa', () => {
  const c = lerControle(ADESAMPA)
  expect([c.vigenciaInicio, c.vigenciaFim]).toEqual([null, null])
  expect(c.avisos).toContain('vigência com datas trocadas no documento: 18/11/2026 à 17/11/2026')
})

it('saldo do documento diferente de previsto − faturado vira aviso', () => {
  expect(lerControle(ADESAMPA).avisos).toContain('o controle informa saldo de R$ 9.237,00; previsto − faturado dá R$ 6.982,11')
})

// SMDET CO 07/2024 (06.2026): título "PREVISTO", "VIGÊNCIA -", total de grupo diferente da coluna total.
it('"PREVISTO", "VIGÊNCIA -" e a coluna total (última) como valor da linha', () => {
  const c = lerControle([
    L('CO 07/2024/SMDET - T.A. 01 - VIGÊNCIA - 21/11/2025 à 20/10/2026'),
    L('PREVISTO'),
    L('PERÍODO', 'COMUNICAÇÃO', 'TOTAL'),
    ...Array.from({ length: 11 }, (_, i) => L(`MÊS ${String(i + 1).padStart(2, '0')}`, '21.546,39', '21.546,39')),
    L('TOTAL', '215.463,90', '237.010,29'),
    L('FATURADO'),
    L('20/11/2025 à 20/12/2025', '21.546,39', '21.546,39'),
    L('21/06/2025 á 20/07/2025', '0,00'),
    L('TOTAL', '21.546,39', '21.546,39'),
  ])
  expect(c.contratoTexto).toBe('CO 07/2024/SMDET')
  expect([c.vigenciaInicio, c.vigenciaFim]).toEqual([new Date(Date.UTC(2025, 10, 21)), new Date(Date.UTC(2026, 9, 20))])
  expect(c.previsto).toMatchObject({ total: '237010.29', conferida: true })
  expect(c.faturado).toMatchObject({ total: '21546.39', conferida: true })
  // "21/06/2025" num contrato de 2025–2026 cai dentro da vigência ± 1 ano: a data fica.
  expect(c.faturado!.linhas[1].inicio).toEqual(new Date(Date.UTC(2025, 5, 21)))
})

// CGM CO 16/2024: períodos "OUT/25-16DD", "NOV/2025"; SF: "24/09/25 a 20/10/25-27Dias", "ate".
it('períodos em mês/ano e datas de 2 dígitos com "a"/"ate"', () => {
  const c = lerControle([
    L('CO 42/2024 - T.A. 01 - Vigência: 24/09/2025 ate 23/09/2026'),
    L('FATURADO'),
    L('24/09/25 a 20/10/25-27Dias', '24.057,04', '2.871.938,09'),
    L('OUT/25-16DD', '49.333,59', '210.974,73'),
    L('NOV/2025', '93.729,36', '391.842,84'),
    L('TOTAL', '3.474.755,66'),
  ])
  expect([c.vigenciaInicio, c.vigenciaFim]).toEqual([new Date(Date.UTC(2025, 8, 24)), new Date(Date.UTC(2026, 8, 23))])
  expect(c.faturado!.linhas.map((l) => [l.rotulo, l.valor])).toEqual([
    ['24/09/25 a 20/10/25-27Dias', '2871938.09'],
    ['OUT/25-16DD', '210974.73'],
    ['NOV/2025', '391842.84'],
  ])
  expect(c.faturado!.linhas[0]).toMatchObject({ inicio: new Date(Date.UTC(2025, 8, 24)), fim: new Date(Date.UTC(2025, 9, 20)) })
  expect(c.faturado!.linhas[2]).toMatchObject({ inicio: new Date(Date.UTC(2025, 10, 1)), fim: new Date(Date.UTC(2025, 10, 30)) })
  expect(c.faturado!.conferida).toBe(true)
})

// SMUL CO 17/2024 (08.2026): mês digitado errado no rótulo ("MAR/6", "FEV/265") e o intervalo depois do mês.
it('rótulo "MÊS/ano - dd/mm/aaaa A dd/mm/aaaa", com o ano do mês digitado errado', () => {
  const c = lerControle([
    L('CO 17/2024/SMUL', '- T.A.02 - 26/2025/SMUL - Vigência: 01/11/2025 à 31/10/2026'),
    L('FATURADO'),
    L('NOV/25 - 01/11/2025 a 20/11/2025-20Dias', '14.965,25', '1.548.778,83'),
    L('FEV/265 - 21/01/2026 A 20/02/2026', '28.277,14', '3.135.491,19'),
    L('MAR/6 - 21/02/2026 A 20/03/2026', '23.662,31', '1.759.420,80'),
    L('SET/26 - 21/08/2026 A 20/09/2026', '0,00'),
    L('TOTAL', '6.443.690,82'),
  ])
  expect(c.termoTexto).toBe('T.A. 02')
  expect(c.faturado).toMatchObject({ total: '6443690.82', conferida: true })
  expect(c.faturado!.linhas[2]).toMatchObject({ rotulo: 'MAR/6 - 21/02/2026 A 20/03/2026', inicio: new Date(Date.UTC(2026, 1, 21)), fim: new Date(Date.UTC(2026, 2, 20)) })
  expect(c.faturado!.linhas[0].inicio).toEqual(new Date(Date.UTC(2025, 10, 1)))
})

it('data de período fora da vigência ± 1 ano (ano digitado errado) perde a data, fica o texto', () => {
  const c = lerControle([
    L('CO 1/2025 - Vigência: 01/01/2026 à 31/12/2026'),
    L('FATURADO'),
    L('01/01/2020 à 31/01/2020', '10,00'),
    L('TOTAL', '10,00'),
  ])
  expect(c.faturado!.linhas[0]).toEqual({ rotulo: '01/01/2020 à 31/01/2020', valor: '10.00', inicio: null, fim: null })
})

it('duas tabelas do mesmo tipo (termo anterior + atual): vale a última', () => {
  const c = lerControle([
    L('CO 1/2024 - Vigência: 01/01/2024 à 31/12/2024'),
    L('FATURADO'),
    L('JAN/2024', '10,00'),
    L('TOTAL', '10,00'),
    L('CO 1/2024 - T.A. 01 - Vigência: 01/01/2025 à 31/12/2025'),
    L('FATURADO'),
    L('JAN/2025', '20,00'),
    L('FEV/2025', '5,00'),
    L('TOTAL', '25,00'),
  ])
  expect(c.termoTexto).toBe('T.A. 01')
  expect(c.faturado).toMatchObject({ total: '25.00', conferida: true })
})

it('tabela que não fecha fica não conferida; sem TOTAL também', () => {
  const c = lerControle([L('FATURADO'), L('JAN/2026', '10,00'), L('TOTAL', '11,00'), L('PREVISTO'), L('MÊS 1', '5,00')])
  expect(c.faturado!.conferida).toBe(false)
  expect(c.previsto).toMatchObject({ total: null, conferida: false })
})

it('valorBr e dataBr', () => {
  expect(valorBr('1.254,89')).toBe('1254.89')
  expect(valorBr('-154.131,60')).toBe('-154131.60')
  expect(valorBr('0,00')).toBe('0.00')
  expect(valorBr('10.000')).toBeNull()
  expect(dataBr('24/09/25')).toEqual(new Date(Date.UTC(2025, 8, 24)))
  expect(dataBr('31/02/2026')).toBeNull()
})
