import { alertasDoContrato, competenciasEncerradas, ordenarAlertas, projetarSaldo, type Alerta, type DadosAlerta, type FaturamentoAlerta } from './alertas'

const hoje = new Date('2026-09-26T15:00:00Z')

const dados = (over: Partial<DadosAlerta> = {}, consolidado: Partial<DadosAlerta['consolidado']> = {}): DadosAlerta => ({
  clienteId: 'c1',
  cliente: 'SMIT',
  contratoId: 'k1',
  contrato: 'TC 45/SMIT/2023',
  consolidado: {
    ativo: true,
    rescindido: false,
    vazio: false,
    vigenciaFim: new Date('2027-12-31T00:00:00Z'),
    vencimento: { nivel: 'ok', dias: 461 },
    situacaoDesatualizada: false,
    prorrogacaoEmAndamento: false,
    valorBase: '1200000',
    saldo: { valorItens: '0', faturado: '0', saldo: '1200000', percentualFaturado: '0' },
    ...consolidado,
  },
  faturamentos: [],
  termosAssinadosSemPdf: 0,
  termosSemTexto: 0,
  ...over,
})

const fat = (ano: number, mes: number, valor: string, over: Partial<FaturamentoAlerta> = {}): FaturamentoAlerta => ({
  competenciaAno: ano,
  competenciaMes: mes,
  valor,
  situacao: 'Emitido',
  enviadoCliente: true,
  enviadoGfp: true,
  createdAt: new Date(Date.UTC(ano, mes, 5)),
  ...over,
})

const codigos = (a: Alerta[]) => a.map((x) => `${x.codigo}:${x.nivel}`)

describe('competenciasEncerradas', () => {
  it('a primeira é o mês anterior ao atual, em São Paulo', () => {
    expect(competenciasEncerradas(hoje, 3)).toEqual([{ ano: 2026, mes: 8 }, { ano: 2026, mes: 7 }, { ano: 2026, mes: 6 }])
    // 01/10 02:00 UTC ainda é 30/09 em São Paulo
    expect(competenciasEncerradas(new Date('2026-10-01T02:00:00Z'), 1)).toEqual([{ ano: 2026, mes: 8 }])
    expect(competenciasEncerradas(new Date('2026-01-10T12:00:00Z'), 2)).toEqual([{ ano: 2025, mes: 12 }, { ano: 2025, mes: 11 }])
  })
})

describe('vencimento', () => {
  it('crítico até 30 dias, atenção até 90, nada depois', () => {
    expect(codigos(alertasDoContrato(dados({}, { vencimento: { nivel: 'critico', dias: 30 } }), hoje))).toEqual(['vence-sem-prorrogacao:critico'])
    expect(codigos(alertasDoContrato(dados({}, { vencimento: { nivel: 'atencao', dias: 31 } }), hoje))).toEqual(['vence-sem-prorrogacao:atencao'])
    expect(codigos(alertasDoContrato(dados({}, { vencimento: { nivel: 'atencao', dias: 90 } }), hoje))).toEqual(['vence-sem-prorrogacao:atencao'])
    expect(alertasDoContrato(dados({}, { vencimento: { nivel: 'ok', dias: 91 } }), hoje)).toEqual([])
  })

  it('com prorrogação em andamento, o alerta é o da assinatura', () => {
    const [a] = alertasDoContrato(dados({}, { vencimento: { nivel: 'critico', dias: 20 }, prorrogacaoEmAndamento: true, vigenciaFim: new Date('2026-10-16T00:00:00Z') }), hoje)
    expect(a.codigo).toBe('prorrogacao-sem-assinatura')
    expect(a.nivel).toBe('critico')
    expect(a.acao).toBe('Conseguir a assinatura antes de 16/10/2026: sem ela a vigência não estende.')
    expect(a.temaManual).toBe('prorrogacao')
  })

  it('rescindido, inativo ou vazio não alerta', () => {
    expect(alertasDoContrato(dados({}, { vencimento: { nivel: 'critico', dias: 10 }, rescindido: true }), hoje)).toEqual([])
    expect(alertasDoContrato(dados({}, { vencimento: { nivel: 'critico', dias: 10 }, ativo: false }), hoje)).toEqual([])
    expect(alertasDoContrato(dados({ termosSemTexto: 3 }, { vazio: true, valorBase: null, situacaoDesatualizada: true }), hoje)).toEqual([])
  })
})

describe('cadastro e saldo', () => {
  it('situação desatualizada, ativo sem valor e faturado acima do contratado', () => {
    expect(codigos(alertasDoContrato(dados({}, { situacaoDesatualizada: true }), hoje))).toEqual(['situacao-desatualizada:atencao'])
    expect(codigos(alertasDoContrato(dados({}, { valorBase: null, saldo: { valorItens: '0', faturado: '0', saldo: null, percentualFaturado: null } }), hoje))).toEqual([
      'ativo-sem-valor:atencao',
    ])
    const [acima] = alertasDoContrato(dados({}, { saldo: { valorItens: '0', faturado: '1205000', saldo: '-5000.00', percentualFaturado: '100.42' } }), hoje)
    expect(acima.codigo).toBe('faturado-acima-do-contratado')
    expect(acima.nivel).toBe('critico')
    expect(acima.temaManual).toBe('aditivo-valor')
  })
})

describe('projeção de saldo', () => {
  const cincoMeses = [4, 5, 6, 7, 8].map((m) => fat(2026, m, '120000'))

  it('mostra a conta e alerta quando o saldo acaba antes da vigência', () => {
    const [a] = alertasDoContrato(
      dados({ faturamentos: cincoMeses }, { saldo: { valorItens: '0', faturado: '600000', saldo: '480000', percentualFaturado: '55' }, vigenciaFim: new Date('2027-06-30T00:00:00Z') }),
      hoje
    )
    expect(a.codigo).toBe('saldo-acaba-antes-da-vigencia')
    expect(a.nivel).toBe('atencao')
    expect(a.detalhe).toBe(
      'No ritmo de R$ 120.000,00/mês (média de 5 competências, 04/2026–08/2026), o saldo de R$ 480.000,00 dura ~4 meses, até ~01/2027, antes do fim da vigência (30/06/2027).'
    )
  })

  it('crítico quando acaba em até 60 dias', () => {
    const alertas = alertasDoContrato(dados({ faturamentos: cincoMeses }, { saldo: { valorItens: '0', faturado: '1000000', saldo: '200000', percentualFaturado: '83' } }), hoje)
    expect(codigos(alertas)).toEqual(['saldo-acaba-antes-da-vigencia:critico'])
  })

  it('sem projeção com menos de 3 competências; cancelado não conta; vigência antes do fim do saldo não alerta', () => {
    expect(projetarSaldo({ saldo: 480000, vigenciaFim: new Date('2027-06-30T00:00:00Z'), faturamentos: [fat(2026, 6, '1'), fat(2026, 7, '1')], hoje })).toBeNull()
    const comCancelado = [fat(2026, 5, '120000'), fat(2026, 6, '120000', { situacao: 'Cancelado' }), fat(2026, 7, '120000')]
    expect(projetarSaldo({ saldo: 480000, vigenciaFim: new Date('2027-06-30T00:00:00Z'), faturamentos: comCancelado, hoje })).toBeNull()
    expect(
      alertasDoContrato(dados({ faturamentos: cincoMeses }, { saldo: { valorItens: '0', faturado: '0', saldo: '480000', percentualFaturado: '0' }, vigenciaFim: new Date('2026-11-30T00:00:00Z'), vencimento: { nivel: 'ok', dias: 95 } }), hoje)
    ).toEqual([])
  })
})

describe('faturamento', () => {
  it('não enviado há mais de 10 dias', () => {
    const [a] = alertasDoContrato(dados({ faturamentos: [fat(2026, 8, '1000', { enviadoGfp: false, createdAt: new Date('2026-09-10T12:00:00Z') })] }), hoje)
    expect(a.codigo).toBe('faturamento-nao-enviado')
    expect(a.temaManual).toBe('faturamento')
    expect(a.detalhe).toContain('08/2026')
    expect(alertasDoContrato(dados({ faturamentos: [fat(2026, 8, '1000', { enviadoGfp: false, createdAt: new Date('2026-09-20T12:00:00Z') })] }), hoje)).toEqual([])
    expect(
      alertasDoContrato(dados({ faturamentos: [fat(2026, 8, '1000', { enviadoGfp: false, situacao: 'Cancelado', createdAt: new Date('2026-09-10T12:00:00Z') })] }), hoje)
    ).toEqual([])
  })

  it('competência sem faturamento a partir do dia 15', () => {
    const seisMeses = [2, 3, 4, 5, 6, 7].map((m) => fat(2026, m, '1000'))
    expect(codigos(alertasDoContrato(dados({ faturamentos: seisMeses }), hoje))).toEqual(['competencia-sem-faturamento:atencao'])
    expect(alertasDoContrato(dados({ faturamentos: seisMeses }), new Date('2026-09-10T15:00:00Z'))).toEqual([])
    expect(alertasDoContrato(dados({ faturamentos: [fat(2026, 6, '1000'), fat(2026, 7, '1000')] }), hoje)).toEqual([])
  })
})

describe('documentos', () => {
  it('termo sem PDF e termo escaneado são info', () => {
    const alertas = alertasDoContrato(dados({ termosAssinadosSemPdf: 2, termosSemTexto: 1 }), hoje)
    expect(codigos(alertas)).toEqual(['termo-sem-pdf:info', 'termo-sem-texto:info'])
    expect(alertas[0].detalhe).toBe('2 termos assinados sem PDF')
  })
})

describe('ordenarAlertas', () => {
  it('nível, depois prazo (sem prazo por último), depois cliente', () => {
    const a = (nivel: Alerta['nivel'], dias: number | null, cliente: string): Alerta => ({
      codigo: 'situacao-desatualizada', nivel, dias, cliente, clienteId: cliente, contratoId: null, contrato: null, titulo: '', detalhe: '', acao: '', temaManual: null,
    })
    const ordem = ordenarAlertas([a('info', null, 'A'), a('atencao', null, 'B'), a('atencao', 40, 'C'), a('critico', 50, 'D'), a('critico', 10, 'E'), a('atencao', 40, 'A')])
    expect(ordem.map((x) => `${x.nivel}:${x.dias}:${x.cliente}`)).toEqual([
      'critico:10:E', 'critico:50:D', 'atencao:40:A', 'atencao:40:C', 'atencao:null:B', 'info:null:A',
    ])
  })
})
