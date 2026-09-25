import { avisosDoContrato, moeda, data, sei, semAcento, resumirContrato, competenciaTexto } from './comum'

const consolidado = {
  vigenciaFim: new Date('2026-12-31T00:00:00Z'),
  vencimento: { nivel: 'ok' as const, dias: 99 },
  rescindido: false,
  vazio: false,
  ativo: true,
  situacaoDesatualizada: false,
  prorrogacaoEmAndamento: false,
  resumoHistorico: { aditivos: 2, prorrogacoes: 1, valorAtual: null, proposta: null, termo: null },
  valorBase: '1000.5',
  saldo: { valorItens: '1000.5', faturado: '250', saldo: '750.5', percentualFaturado: '24.99' },
}
const contrato = {
  id: 'k1',
  clienteId: 'c1',
  numeroTermo: '031/2023',
  descricao: 'Rede',
  seiCliente: '7010202600096354',
  seiProdam: null,
  situacao: 'Ativo',
  dataInicio: new Date('2023-01-01T00:00:00Z'),
  dataVencimento: new Date('2025-12-31T00:00:00Z'),
  vigente: true,
  linkSei: null,
}

it('formatadores', () => {
  expect(moeda('1000.5')).toBe('R$ 1.000,50')
  expect(moeda(null)).toBe('—')
  expect(data(new Date('2026-09-23T00:00:00Z'))).toBe('23/09/2026')
  expect(data(null)).toBe('—')
  expect(sei('7010202600096354')).toBe('7010.2026/0009635-4')
  expect(sei(null)).toBeNull()
  expect(semAcento('Secretaria de Inovação')).toBe('secretaria de inovacao')
  expect(competenciaTexto(2026, 3)).toBe('03/2026')
})

it('resumirContrato usa só o consolidado para ativo, vigência, valor e saldo', () => {
  expect(resumirContrato(contrato, consolidado)).toEqual({
    id: 'k1',
    numero: '031/2023',
    descricao: 'Rede',
    seiCliente: '7010.2026/0009635-4',
    seiProdam: null,
    situacao: 'Ativo',
    ativo: true,
    rescindido: false,
    situacaoDesatualizada: false,
    prorrogacaoEmAndamento: false,
    inicio: '01/01/2023',
    fimVigencia: '31/12/2026',
    vencimento: 'ok',
    diasParaVencer: 99,
    valorContratado: 'R$ 1.000,50',
    faturado: 'R$ 250,00',
    saldo: 'R$ 750,50',
    percentualFaturado: '24.99%',
    aditivos: 2,
    prorrogacoes: 1,
    href: '/clientes/c1/contratos/k1',
  })
})

it('situacaoDesatualizada e prorrogacaoEmAndamento passam do consolidado pro resumo (spec §11.5/§11.6)', () => {
  const r = resumirContrato(contrato, { ...consolidado, situacaoDesatualizada: true, prorrogacaoEmAndamento: true })
  expect(r.situacaoDesatualizada).toBe(true)
  expect(r.prorrogacaoEmAndamento).toBe(true)
})

it('contrato sem valor não inventa saldo', () => {
  const r = resumirContrato(contrato, { ...consolidado, valorBase: null, saldo: { valorItens: '0', faturado: '0', saldo: null, percentualFaturado: null } })
  expect(r.valorContratado).toBe('sem valor cadastrado')
  expect(r.saldo).toBeNull()
  expect(r.percentualFaturado).toBeNull()
})

it('avisosDoContrato em palavras curtas', () => {
  expect(avisosDoContrato({ vencimento: 'ok', situacaoDesatualizada: false, prorrogacaoEmAndamento: false })).toBe('')
  expect(avisosDoContrato({ vencimento: 'vencido', situacaoDesatualizada: true, prorrogacaoEmAndamento: true })).toBe(
    'vencido, situação desatualizada, prorrogação sem assinatura'
  )
})
