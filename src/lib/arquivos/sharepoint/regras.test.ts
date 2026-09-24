import { motivoIgnorar, mudouPorMetadado, normalizarChave, pastaContratoDe, resolverCliente } from './regras'

const clientes = new Map([
  ['SGM', { id: 'c-sgm', nome: 'Secretaria de Governo' }],
  ['SMS', { id: 'c-sms', nome: 'Secretaria da Saúde' }],
])

describe('normalizarChave', () => {
  it('tira acento, caixa e espaço repetido', () => {
    expect(normalizarChave('  Sub-Itaím   Paulista ')).toBe('SUB-ITAIM PAULISTA')
  })
})

describe('resolverCliente', () => {
  it('casa a pasta direto com a sigla', () => {
    expect(resolverCliente('sms', clientes, {})).toEqual({ tipo: 'cliente', clienteId: 'c-sms', nome: 'Secretaria da Saúde' })
  })
  it('usa o mapa quando a pasta não é a sigla', () => {
    expect(resolverCliente('SGM - CASA CIVIL', clientes, { 'SGM - Casa Civil': 'SGM' })).toMatchObject({ clienteId: 'c-sgm' })
  })
  it('null no mapa ignora a pasta', () => {
    expect(resolverCliente('1. PUBLICAÇÕES NO DOC', clientes, { '1. PUBLICACOES NO DOC': null })).toEqual({ tipo: 'ignorar' })
  })
  it('nunca inventa cliente', () => {
    expect(resolverCliente('SPTURIS', clientes, {})).toEqual({ tipo: 'sem-cliente' })
  })
})

describe('motivoIgnorar', () => {
  const pdf = ['SMS', 'TC 1-2023 - X', '1) Inicial', 'TC 1-2023.pdf']
  it('aceita PDF comum', () => {
    expect(motivoIgnorar(pdf, 1000, false)).toBeNull()
  })
  it('ignora trava do Office e oculto', () => {
    expect(motivoIgnorar(['SMS', 'TC 1', '~$proposta.docx'], 10, false)).toBe('oculto ou temporário')
    expect(motivoIgnorar(['.849C9593'], 10, false)).toBe('arquivo solto na raiz')
  })
  it('ignora WORK, a não ser que peça', () => {
    const work = ['SMSUB', 'TC 36', '1) Inicial', 'WORK', 'Mem_Calc.xlsx']
    expect(motivoIgnorar(work, 10, false)).toBe('rascunho (WORK)')
    expect(motivoIgnorar(work, 10, true)).toBeNull()
  })
  it('recusa extensão desconhecida e arquivo grande', () => {
    expect(motivoIgnorar(['SMS', 'TC 1', 'x.msg'], 10, false)).toBe('extensão não aceita')
    expect(motivoIgnorar(pdf, 51 * 1024 * 1024, false)).toBe('acima de 50 MB')
  })
})

describe('pastaContratoDe', () => {
  it('acha a pasta do contrato, mesmo dentro de "Contratos Finalizados"', () => {
    expect(pastaContratoDe(['SMIT', 'Contratos Finalizados', 'TC 12-SMIT-2023 - Infra', '1) Inicial', 'a.pdf'])).toBe(
      'TC 12-SMIT-2023 - Infra'
    )
    expect(pastaContratoDe(['SMS', 'solto.pdf'])).toBeNull()
  })
})

describe('mudouPorMetadado', () => {
  const base = { tamanhoBytes: 10, modificadoEm: new Date('2026-09-24T10:00:00Z') }
  it('tolera 2 s de diferença na data', () => {
    expect(mudouPorMetadado(base, { tamanhoBytes: 10, modificadoEm: new Date('2026-09-24T10:00:01Z') })).toBe(false)
    expect(mudouPorMetadado(base, { tamanhoBytes: 10, modificadoEm: new Date('2026-09-24T10:05:00Z') })).toBe(true)
    expect(mudouPorMetadado(base, { tamanhoBytes: 11, modificadoEm: base.modificadoEm })).toBe(true)
  })
})
