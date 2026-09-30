import { lerCalendario, tipoDaLegenda } from './leitura'
import type { Retangulo, TextoPosicionado } from './pdf'

// Calendário sintético com a geometria do PDF de 2026 (4 meses por linha, cabeçalho "D S T Q Q S S", legenda com
// quadradinhos à esquerda do texto, célula colorida em volta do número). Cores inventadas: a leitura tira o
// significado da legenda, nunca da cor.
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
const LEGENDA: [string, string][] = [
  ['#aa0001', 'Período de Emissão de NFS-e'],
  ['#aa0002', 'Data de Encerramento do Faturamento'],
  ['#aa0003', 'Prazo para Envio do Relatório de Faturamento'],
  ['#aa0004', 'Prazo para Recebimento de Contratos e|Aditamentos (para faturamento no mês)'],
  ['#aa0005', 'Prazo para Recebimento de Processos SEI com|Recursos e Informações para Faturamento'],
  ['#aa0006', 'Expediente Suspenso'],
]
const utc = (a: number, m: number, d: number) => new Date(Date.UTC(a, m - 1, d))
const util = (d: Date) => d.getUTCDay() !== 0 && d.getUTCDay() !== 6
const proximoUtil = (a: number, m: number, d: number) => {
  let x = utc(a, m, d)
  while (!util(x)) x = new Date(x.getTime() + 86_400_000)
  return x.getUTCDate()
}

function montar(opcoes: { semEncerramentoEm?: number; corEstranhaEm?: number; sabadoEm?: number; gradeErradaEm?: number } = {}) {
  const textos: TextoPosicionado[] = [{ x: 209, y: 519, s: '2026' }]
  const retangulos: Retangulo[] = []
  const pintar = (cor: string, x: number, y: number) => retangulos.push({ cor, x0: x - 5, y0: y - 3, x1: x + 11, y1: y + 10 })
  const plano: Record<number, Record<number, string>> = {}
  for (let m = 1; m <= 12; m++) {
    const x0 = 37 + ((m - 1) % 4) * 131
    const yCab = 486 - Math.floor((m - 1) / 4) * 116
    textos.push({ x: x0 + 38, y: yCab + 13, s: MESES[m - 1] })
    'DSTQQSS'.split('').forEach((s, i) => textos.push({ x: x0 + i * 16.4, y: yCab, s }))
    const deslocamento = opcoes.gradeErradaEm === m ? 1 : 0
    const posicao = new Map<number, [number, number]>()
    const dias = new Date(Date.UTC(2026, m, 0)).getUTCDate()
    let linha = 0
    for (let d = 1; d <= dias; d++) {
      const col = (utc(2026, m, d).getUTCDay() + deslocamento) % 7
      if (d > 1 && col === 0) linha++
      const p: [number, number] = [x0 + col * 16.4, yCab - 12 - linha * 12.8]
      posicao.set(d, p)
      textos.push({ x: p[0], y: p[1], s: String(d) })
    }
    // Plano do mês: emissão nos 2 primeiros dias úteis, encerramento no 1º útil a partir do dia 8, envio a partir
    // do 13, contratos a partir do 24, processos SEI a partir do 27.
    const enc = proximoUtil(2026, m, 8)
    const p: Record<number, string> = {}
    const e1 = proximoUtil(2026, m, 1)
    p[e1] = '#aa0001'
    p[proximoUtil(2026, m, e1 + 1)] = '#aa0001'
    if (opcoes.semEncerramentoEm !== m) p[enc] = '#aa0002'
    p[proximoUtil(2026, m, 13)] = '#aa0003'
    p[proximoUtil(2026, m, 20)] = '#aa0004'
    p[proximoUtil(2026, m, 27)] = '#aa0005'
    if (opcoes.corEstranhaEm === m) p[proximoUtil(2026, m, 22)] = '#123456'
    if (opcoes.sabadoEm === m) {
      const sabado = [...posicao.keys()].find((d) => utc(2026, m, d).getUTCDay() === 6)!
      p[sabado] = '#aa0003'
    }
    for (const [d, cor] of Object.entries(p)) pintar(cor, ...posicao.get(Number(d))!)
    plano[m] = p
  }
  let y = 151
  for (const [cor, texto] of LEGENDA) {
    retangulos.push({ cor, x0: 291.7, y0: y - 7, x1: 310.7, y1: y + 10 })
    texto.split('|').forEach((t, i) => textos.push({ x: 317.5, y: y - i * 8, s: t }))
    y -= 19
  }
  textos.push({ x: 578, y: 460, s: '01/01/2026' }, { x: 624, y: 460, s: 'quinta-feira' }, { x: 669, y: 460, s: 'Confraternização Universal' })
  return { textos, retangulos, plano }
}

it('lê os prazos pela cor da legenda, junta dias seguidos em faixa e traz os feriados', () => {
  const { textos, retangulos, plano } = montar()
  const r = lerCalendario(retangulos, textos)
  expect(r.avisos).toEqual([])
  expect(r.status).toBe('ok')
  expect(r.ano).toBe(2026)
  const jan = r.datas.filter((d) => d.inicio.getUTCMonth() === 0)
  expect(jan.find((d) => d.tipo === 'FERIADO')).toMatchObject({ descricao: 'Confraternização Universal' })
  expect(jan.find((d) => d.tipo === 'ENCERRAMENTO')?.inicio).toEqual(utc(2026, 1, 8))
  // Emissão em janeiro: 1º e 2 (quinta e sexta) numa faixa só.
  expect(jan.find((d) => d.tipo === 'EMISSAO_NFSE')).toMatchObject({ inicio: utc(2026, 1, 1), fim: utc(2026, 1, 2) })
  const prazos = r.datas.filter((d) => d.tipo !== 'FERIADO')
  expect(prazos.filter((d) => d.tipo === 'ENCERRAMENTO')).toHaveLength(12)
  expect(Object.values(plano).flatMap((p) => Object.keys(p)).length).toBe(prazos.reduce((s, d) => s + Math.round((d.fim.getTime() - d.inicio.getTime()) / 86_400_000) + 1, 0))
  expect(prazos.find((d) => d.tipo === 'RECEBIMENTO_CONTRATOS')?.descricao).toBe('Prazo para Recebimento de Contratos e Aditamentos (para faturamento no mês)')
})

it.each([
  ['mês sem encerramento', { semEncerramentoEm: 3 }, /mês 2026-3: 0 data\(s\) de encerramento/],
  ['cor que não está na legenda', { corEstranhaEm: 5 }, /cor\(es\) nos dias sem legenda: #123456/],
  ['prazo em sábado', { sabadoEm: 6 }, /ENVIO_RELATORIO em dia não útil/],
])('%s: sem prova, só os feriados', (_nome, opcoes, aviso) => {
  const { textos, retangulos } = montar(opcoes)
  const r = lerCalendario(retangulos, textos)
  expect(r.status).toBe('so-feriados')
  expect(r.avisos.join(' · ')).toMatch(aviso)
  expect(r.datas.every((d) => d.tipo === 'FERIADO')).toBe(true)
})

it('mês com a grade errada no PDF fica de fora, com aviso; os outros seguem', () => {
  const { textos, retangulos } = montar({ gradeErradaEm: 12 })
  const r = lerCalendario(retangulos, textos)
  expect(r.avisos).toEqual([expect.stringMatching(/^dezembro\/2026: a grade do PDF está errada .* o dia 1º é terça/)])
  // Sem dezembro, o encerramento aparece em 11 meses — ainda passa da régua de 10.
  expect(r.status).toBe('ok')
  expect(r.datas.some((d) => d.tipo !== 'FERIADO' && d.inicio.getUTCMonth() === 11)).toBe(false)
})

it('tipo pelo texto da legenda; texto novo é OUTRO', () => {
  expect(tipoDaLegenda('Período de Emissão de NFS-e')).toBe('EMISSAO_NFSE')
  expect(tipoDaLegenda('EXPEDIENTE SUSPENSO')).toBe('EXPEDIENTE_SUSPENSO')
  expect(tipoDaLegenda('Reunião de alinhamento')).toBe('OUTRO')
})
